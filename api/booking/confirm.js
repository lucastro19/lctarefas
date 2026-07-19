import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function formatDateTime(iso, locale = "pt-BR") {
  const d = new Date(iso);
  return d.toLocaleString(locale, {
    weekday: "long", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  });
}

async function sendConfirmationEmail({ guestEmail, guestName, hostName, scheduledAt, durationMinutes, meetingUrl }) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return; // email desativado se sem key

  const dateStr = formatDateTime(scheduledAt);
  const body = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="font-size:20px;color:#1C1C1E">Reunião confirmada! 🎉</h2>
      <p style="color:#3C3C43;font-size:15px">Olá, <strong>${guestName}</strong>.</p>
      <p style="color:#3C3C43;font-size:15px">Sua reunião com <strong>${hostName}</strong> foi confirmada.</p>
      <div style="background:#F2F2F7;border-radius:12px;padding:16px;margin:20px 0">
        <p style="margin:0 0 8px;font-size:13px;color:#8E8E93;font-weight:600;text-transform:uppercase">Detalhes</p>
        <p style="margin:4px 0;font-size:15px;color:#1C1C1E">📅 ${dateStr}</p>
        <p style="margin:4px 0;font-size:15px;color:#1C1C1E">⏱ ${durationMinutes} minutos</p>
        ${meetingUrl ? `<p style="margin:4px 0;font-size:15px;color:#4F8EF7">🎥 <a href="${meetingUrl}" style="color:#4F8EF7">Link da reunião Google Meet</a></p>` : ""}
      </div>
      <p style="color:#8E8E93;font-size:13px">Este é um email automático. Não é necessário responder.</p>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${hostName} <noreply@lcgestor.com.br>`,
      to: [guestEmail],
      subject: `Reunião confirmada com ${hostName} — ${formatDateTime(scheduledAt)}`,
      html: body,
    }),
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { user_id, guest_name, guest_email, guest_notes, scheduled_at, duration_minutes, host_name } = req.body ?? {};

  if (!user_id || !guest_name || !guest_email || !scheduled_at || !duration_minutes) {
    return res.status(400).json({ error: "Campos obrigatórios faltando" });
  }

  const supabase = getSupabase();

  // Verifica se o slot ainda está disponível (proteção contra double-booking)
  const slotStart = new Date(scheduled_at);
  const slotEnd = new Date(slotStart.getTime() + duration_minutes * 60000);

  const { data: conflicts } = await supabase
    .from("bookings")
    .select("id")
    .eq("user_id", user_id)
    .eq("status", "confirmed")
    .lt("scheduled_at", slotEnd.toISOString())
    .gt("scheduled_at", new Date(slotStart.getTime() - duration_minutes * 60000).toISOString());

  if (conflicts?.length > 0) {
    return res.status(409).json({ error: "Este horário não está mais disponível. Por favor, escolha outro." });
  }

  // Cria tarefa no app do host
  const { data: task } = await supabase.from("tasks").insert({
    user_id,
    title: `Reunião com ${guest_name}`,
    notes: guest_notes ? `Cliente: ${guest_email}\n\n${guest_notes}` : `Cliente: ${guest_email}`,
    scheduled_date: slotStart.toISOString().split("T")[0],
    scheduled_time: slotStart.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
    duration_minutes,
    position: Date.now(),
  }).select().single();

  // Cria o agendamento
  const { data: booking, error } = await supabase.from("bookings").insert({
    user_id,
    guest_name,
    guest_email,
    guest_notes: guest_notes ?? null,
    scheduled_at,
    duration_minutes,
    task_id: task?.id ?? null,
    status: "confirmed",
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });

  // Envia email de confirmação (não bloqueia a resposta se falhar)
  sendConfirmationEmail({
    guestEmail: guest_email,
    guestName: guest_name,
    hostName: host_name ?? "Consultor",
    scheduledAt: scheduled_at,
    durationMinutes: duration_minutes,
    meetingUrl: booking.meeting_url,
  }).catch(() => {});

  return res.status(200).json({ booking });
}
