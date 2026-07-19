import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useBookingStore, computeSlots } from "../store/bookingStore";

function pad(n) { return String(n).padStart(2, "0"); }
function formatTime(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function formatDate(d) {
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}
function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function generateICS({ title, start, durationMinutes, meetingUrl }) {
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`, `SUMMARY:${title}`,
    meetingUrl ? `DESCRIPTION:Link: ${meetingUrl}` : "",
    meetingUrl ? `URL:${meetingUrl}` : "",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAYS_SHORT = ["D","S","T","Q","Q","S","S"];

// ── Paleta dark ─────────────────────────────────────────────────────────────
const C = {
  bg:        "#0C0C11",
  card:      "rgba(255,255,255,0.045)",
  border:    "rgba(255,255,255,0.085)",
  borderSub: "rgba(255,255,255,0.055)",
  text1:     "rgba(255,255,255,0.92)",
  text2:     "rgba(255,255,255,0.45)",
  text3:     "rgba(255,255,255,0.22)",
  blue:      "#4F8EF7",
  blueGlow:  "rgba(79,142,247,0.30)",
  green:     "#30D158",
  greenGlow: "rgba(48,209,88,0.25)",
  red:       "#FF453A",
};

const glass = {
  background: C.card,
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: `1px solid ${C.border}`,
  borderRadius: 24,
};

export function BookPage() {
  const { slug } = useParams();
  const { fetchPublicProfile, fetchPublicSlots } = useBookingStore();

  const [profile,      setProfile]      = useState(null);
  const [availability, setAvailability] = useState([]);
  const [bookings,     setBookings]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [notFound,     setNotFound]     = useState(false);

  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [step, setStep] = useState("calendar");

  const [form,       setForm]       = useState({ name: "", email: "", notes: "" });
  const [touched,    setTouched]    = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [booking,    setBooking]    = useState(null);

  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ");

  useEffect(() => {
    (async () => {
      const { data, error } = await fetchPublicProfile(slug);
      if (error || !data) { setNotFound(true); setLoading(false); return; }
      setProfile(data);
      const from = new Date();
      const to   = new Date(); to.setDate(to.getDate() + (data.advance_days ?? 30));
      const { availability: av, bookings: bk } = await fetchPublicSlots(data.user_id, from.toISOString(), to.toISOString());
      setAvailability(av); setBookings(bk); setLoading(false);
    })();
  }, [slug]);

  const slots = useMemo(() => {
    if (!selectedDate || !profile) return [];
    return computeSlots({
      availability, bookings, date: selectedDate,
      duration: profile.meeting_duration,
      bufferMinutes: profile.buffer_minutes,
      minNoticeHours: profile.min_notice_hours,
    });
  }, [selectedDate, availability, bookings, profile]);

  const availableDays = useMemo(() => {
    if (!profile) return new Set();
    const set   = new Set();
    const today = new Date(); today.setHours(0,0,0,0);
    const limit = new Date(); limit.setDate(limit.getDate() + (profile.advance_days ?? 30));
    const d = new Date(calMonth.year, calMonth.month, 1);
    while (d.getMonth() === calMonth.month) {
      const copy = new Date(d);
      if (copy >= today && copy <= limit) {
        const s = computeSlots({
          availability, bookings, date: copy,
          duration: profile.meeting_duration,
          bufferMinutes: profile.buffer_minutes,
          minNoticeHours: profile.min_notice_hours,
        });
        if (s.length > 0) set.add(isoDate(copy));
      }
      d.setDate(d.getDate() + 1);
    }
    return set;
  }, [calMonth, availability, bookings, profile]);

  const emailOk   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const isFormValid = form.name.trim().length > 0 && emailOk;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot || !profile || !isFormValid) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/booking/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: profile.user_id, guest_name: form.name,
          guest_email: form.email, guest_notes: form.notes,
          scheduled_at: selectedSlot.toISOString(),
          duration_minutes: profile.meeting_duration,
          host_name: profile.display_name, host_email: null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao agendar");
      setBooking(data.booking); setStep("success");
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const downloadICS = () => {
    const ics = generateICS({
      title: `Reunião com ${profile.display_name}`,
      start: selectedSlot, durationMinutes: profile.meeting_duration,
      meetingUrl: booking?.meeting_url,
    });
    const blob = new Blob([ics], { type: "text/calendar" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "reuniao.ics"; a.click();
    URL.revokeObjectURL(url);
  };

  const resetFlow = () => {
    setStep("calendar"); setSelectedDate(null); setSelectedSlot(null);
    setForm({ name: "", email: "", notes: "" }); setTouched({}); setBooking(null);
  };

  // ── Loading / not found ──────────────────────────────────────────────────
  if (loading) return (
    <div style={{ background: C.bg, minHeight: "100vh" }} className="flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: C.blue, borderTopColor: "transparent" }} />
    </div>
  );

  if (notFound) return (
    <div style={{ background: C.bg, minHeight: "100vh" }} className="flex items-center justify-center px-4">
      <div className="text-center space-y-3">
        <p className="text-5xl">🔍</p>
        <h1 className="text-xl font-semibold" style={{ color: C.text1 }}>Página não encontrada</h1>
        <p className="text-sm" style={{ color: C.text2 }}>O link <strong>/{slug}</strong> não existe.</p>
      </div>
    </div>
  );

  const firstDay    = new Date(calMonth.year, calMonth.month, 1).getDay();
  const daysInMonth = new Date(calMonth.year, calMonth.month + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);
  const limit = new Date(); limit.setDate(limit.getDate() + (profile.advance_days ?? 30));
  const stepIdx = ["calendar","form","success"].indexOf(step);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>

      {/* ── Hero / perfil ───────────────────────────────────────────────── */}
      <div style={{ background: "linear-gradient(180deg, rgba(79,142,247,0.10) 0%, transparent 100%)", borderBottom: `1px solid ${C.borderSub}` }}>
        <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col items-center gap-4">

          {/* Avatar */}
          <div style={{
            width: 68, height: 68, borderRadius: 20,
            background: "linear-gradient(135deg, #4F8EF7 0%, #7B61FF 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 32px ${C.blueGlow}, 0 4px 16px rgba(0,0,0,0.4)`,
            fontSize: 26, fontWeight: 700, color: "#fff",
          }}>
            {profile.display_name?.[0]?.toUpperCase() ?? "?"}
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold" style={{ color: C.text1 }}>{profile.display_name}</h1>
            {profile.title && <p className="text-sm" style={{ color: C.text2 }}>{profile.title}</p>}
            {profile.bio   && <p className="text-sm max-w-sm mx-auto pt-0.5" style={{ color: C.text2 }}>{profile.bio}</p>}
          </div>

          {/* Chips */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              { icon: <IcoClock />, label: `${profile.meeting_duration} min` },
              { icon: <IcoMeet />,  label: "Google Meet" },
              { icon: <IcoGlobe />, label: userTz },
            ].map(({ icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full"
                style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, color: C.text2 }}>
                {icon}{label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Progresso ───────────────────────────────────────────────────── */}
      {step !== "success" && (
        <div className="max-w-3xl mx-auto px-4 pt-5 pb-1 flex items-center justify-center gap-3">
          {[{ label: "Data & Horário" }, { label: "Seus dados" }].map((s, i) => {
            const isCurrent = i === stepIdx;
            const isDone    = stepIdx > i;
            return (
              <div key={i} className="flex items-center gap-3">
                {i > 0 && (
                  <div style={{ height: 1, width: 40, background: isDone ? C.blue : C.borderSub, transition: "background .3s" }} />
                )}
                <div className="flex items-center gap-2">
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", fontSize: 10, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isCurrent ? C.blue : isDone ? C.green : "rgba(255,255,255,0.08)",
                    color: (isCurrent || isDone) ? "#fff" : C.text3,
                    boxShadow: isCurrent ? `0 0 10px ${C.blueGlow}` : isDone ? `0 0 10px ${C.greenGlow}` : "none",
                    transition: "all .3s",
                  }}>
                    {isDone ? "✓" : i + 1}
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 600,
                    color: isCurrent ? C.blue : isDone ? C.green : C.text3,
                    transition: "color .3s",
                  }}>{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Conteúdo ────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 py-5 pb-16">

        {/* ─ Sucesso ─ */}
        {step === "success" && (
          <div key="success" className="book-step-in" style={{ ...glass }}>
            {/* Topo verde */}
            <div style={{
              background: "linear-gradient(135deg, rgba(48,209,88,0.12) 0%, rgba(48,209,88,0.04) 100%)",
              borderBottom: `1px solid rgba(48,209,88,0.15)`,
              borderRadius: "24px 24px 0 0",
              padding: "36px 24px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center",
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: C.green, display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 28px ${C.greenGlow}`,
              }}>
                <IcoCheck />
              </div>
              <div>
                <p style={{ fontSize: 22, fontWeight: 700, color: C.text1 }}>Reunião confirmada!</p>
                <p style={{ fontSize: 13, color: C.text2, marginTop: 4 }}>Convite enviado para {form.email}</p>
              </div>
            </div>

            {/* Detalhes */}
            <div style={{ padding: 24 }} className="space-y-4">
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, border: `1px solid ${C.borderSub}`, padding: 16 }} className="space-y-3">
                <DRow icon={<IcoCal color={C.blue} />}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: C.text1 }} className="capitalize">{formatDate(selectedSlot)}</p>
                  <p style={{ fontSize: 12, color: C.text2 }}>{formatTime(selectedSlot)} · {profile.meeting_duration} minutos</p>
                </DRow>
                <DRow icon={<IcoPerson color={C.blue} />}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: C.text1 }}>{form.name}</p>
                  <p style={{ fontSize: 12, color: C.text2 }}>{form.email}</p>
                </DRow>
              </div>

              <div className="flex flex-col gap-2">
                {booking?.meeting_url && (
                  <a href={booking.meeting_url} target="_blank" rel="noreferrer"
                    style={{ background: C.blue, color: "#fff", borderRadius: 14, padding: "13px 20px", fontSize: 14, fontWeight: 600, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: `0 4px 20px ${C.blueGlow}`, textDecoration: "none" }}>
                    <IcoMeet white /> Entrar na reunião
                  </a>
                )}
                <button onClick={downloadICS}
                  style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, color: C.text1, borderRadius: 14, padding: "13px 20px", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <IcoDownload /> Adicionar ao calendário (.ics)
                </button>
                <button onClick={resetFlow}
                  style={{ background: "none", border: "none", color: C.text2, fontSize: 13, cursor: "pointer", padding: "8px 0" }}>
                  Agendar outra reunião
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─ Formulário ─ */}
        {step === "form" && (
          <div key="form" className="book-step-in" style={{ ...glass }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderSub}`, display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setStep("calendar")}
                style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <IcoBack />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.text1 }} className="capitalize truncate">{formatDate(selectedSlot)}</p>
                <p style={{ fontSize: 12, color: C.text2 }}>{formatTime(selectedSlot)} · {profile.meeting_duration} min · Google Meet</p>
              </div>
              <span style={{ background: "rgba(79,142,247,0.15)", color: C.blue, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8, flexShrink: 0 }}>
                {profile.meeting_duration}min
              </span>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: 20 }} className="space-y-4">
              <DField label="Nome completo" error={touched.name && !form.name.trim() ? "Campo obrigatório" : null} valid={touched.name && form.name.trim().length > 0}>
                <input
                  required value={form.name} placeholder="Seu nome"
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onBlur={() => setTouched(t => ({ ...t, name: true }))}
                  className={`book-input${touched.name ? (form.name.trim() ? " valid" : " invalid") : ""}`}
                />
              </DField>

              <DField label="Email" error={touched.email && form.email && !emailOk ? "Email inválido" : null} valid={touched.email && emailOk}>
                <input
                  required type="email" value={form.email} placeholder="seu@email.com"
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  onBlur={() => setTouched(t => ({ ...t, email: true }))}
                  className={`book-input${touched.email ? (emailOk ? " valid" : (form.email ? " invalid" : "")) : ""}`}
                />
              </DField>

              <DField label={<>Mensagem <span style={{ color: C.text3, fontWeight: 400 }}>(opcional)</span></>}>
                <textarea
                  value={form.notes} rows={3} placeholder="Assunto, dúvidas..."
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="book-input book-input is-textarea"
                />
              </DField>

              <button type="submit" disabled={submitting || !isFormValid}
                style={{
                  width: "100%", padding: "14px", borderRadius: 14, fontSize: 14, fontWeight: 600, border: "none", cursor: isFormValid && !submitting ? "pointer" : "not-allowed",
                  background: isFormValid && !submitting ? C.blue : "rgba(255,255,255,0.08)",
                  color: isFormValid && !submitting ? "#fff" : C.text3,
                  boxShadow: isFormValid && !submitting ? `0 4px 20px ${C.blueGlow}` : "none",
                  transition: "all .2s",
                }}>
                {submitting ? "Confirmando..." : "Confirmar agendamento"}
              </button>
            </form>
          </div>
        )}

        {/* ─ Calendário + Slots ─ */}
        {step === "calendar" && (
          <div key="calendar" className="book-step-in" style={{ ...glass, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr" }}>
              <div style={{ display: "contents" }}>
                {/* Painel esquerdo: calendário */}
                <div style={{ padding: "24px 20px" }}>
                  {/* Navegação mês */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <NavBtn onClick={() => setCalMonth(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 })}>
                      <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6l5 5" stroke={C.text2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </NavBtn>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.text1 }}>{MONTHS_PT[calMonth.month]} {calMonth.year}</span>
                    <NavBtn onClick={() => setCalMonth(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 })}>
                      <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M1 1l5 5-5 5" stroke={C.text2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </NavBtn>
                  </div>

                  {/* Grade */}
                  <div className="grid grid-cols-7 gap-1">
                    {DAYS_SHORT.map((d, i) => (
                      <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: C.text3, paddingBottom: 6 }}>{d}</div>
                    ))}
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day  = i + 1;
                      const date = new Date(calMonth.year, calMonth.month, day);
                      date.setHours(0,0,0,0);
                      const iso        = isoDate(date);
                      const isAvail    = availableDays.has(iso);
                      const isToday    = iso === isoDate(today);
                      const isPast     = date < today || date > limit;
                      const isSelected = selectedDate && isoDate(selectedDate) === iso;

                      return (
                        <button
                          key={day}
                          disabled={!isAvail || isPast}
                          onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                          style={{
                            aspectRatio: "1", display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center", gap: 3,
                            borderRadius: 12, border: "none", cursor: isAvail && !isPast ? "pointer" : "default",
                            fontSize: 13, fontWeight: isSelected || isAvail ? 600 : 400,
                            background: isSelected ? "#fff" : isToday && !isSelected ? "rgba(79,142,247,0.12)" : "transparent",
                            color: isSelected ? "#0C0C11" : isAvail && !isPast ? C.text1 : C.text3,
                            boxShadow: isSelected ? `0 0 18px ${C.blueGlow}` : "none",
                            outline: isToday && !isSelected ? `2px solid rgba(79,142,247,0.5)` : "none",
                            outlineOffset: -2, transition: "all .15s",
                          }}
                          onMouseEnter={e => { if (isAvail && !isPast && !isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isToday ? "rgba(79,142,247,0.12)" : "transparent"; }}
                        >
                          {day}
                          {isAvail && !isPast && !isSelected && (
                            <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.blue, opacity: 0.8 }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Divisor */}
                <div style={{ background: C.borderSub }} />

                {/* Painel direito: slots */}
                <div style={{ padding: "24px 20px" }}>
                  {!selectedDate ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 220, gap: 12, textAlign: "center" }}>
                      <div style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <IcoCal color={C.text3} />
                      </div>
                      <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.5 }}>Selecione uma data<br/>no calendário</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p style={{ fontSize: 11, fontWeight: 700, color: C.text3, letterSpacing: "0.08em", textTransform: "uppercase" }} className="capitalize">
                        {formatDate(selectedDate)}
                      </p>

                      {slots.length === 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 160, gap: 10 }}>
                          <span style={{ fontSize: 32 }}>😕</span>
                          <p style={{ fontSize: 13, color: C.text2, textAlign: "center", lineHeight: 1.6 }}>
                            Sem horários disponíveis<br/>neste dia
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {slots.map((slot) => {
                            const key   = slot.toISOString();
                            const isSel = selectedSlot?.toISOString() === key;
                            return (
                              <SlotBtn key={key} selected={isSel} onClick={() => setSelectedSlot(isSel ? null : slot)}>
                                {formatTime(slot)}
                              </SlotBtn>
                            );
                          })}
                        </div>
                      )}

                      {selectedSlot && (
                        <div style={{ marginTop: 8, borderRadius: 16, border: `1px solid rgba(79,142,247,0.25)`, background: "rgba(79,142,247,0.07)", padding: 16 }} className="space-y-3">
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(79,142,247,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <IcoCal color={C.blue} size={14} />
                            </div>
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 600, color: C.text1, lineHeight: 1.4 }} className="capitalize">{formatDate(selectedSlot)}</p>
                              <p style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>{formatTime(selectedSlot)} · {profile.meeting_duration} min · Google Meet</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setStep("form")}
                            style={{ width: "100%", padding: "11px", background: C.blue, border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: `0 4px 16px ${C.blueGlow}` }}>
                            Continuar →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 11, color: C.text3, marginTop: 24 }}>Powered by LCTarefas</p>
      </div>
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function NavBtn({ onClick, children }) {
  return (
    <button onClick={onClick}
      style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.10)"}
      onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}>
      {children}
    </button>
  );
}

function SlotBtn({ selected, onClick, children }) {
  return (
    <button onClick={onClick}
      style={{
        padding: "13px 0", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
        border: selected ? `1px solid rgba(79,142,247,0.6)` : "1px solid rgba(255,255,255,0.10)",
        background: selected ? "rgba(79,142,247,0.18)" : "rgba(255,255,255,0.04)",
        color: selected ? "#4F8EF7" : "rgba(255,255,255,0.80)",
        boxShadow: selected ? "0 0 16px rgba(79,142,247,0.25)" : "none",
        transition: "all .15s",
      }}
      onMouseEnter={e => { if (!selected) { e.currentTarget.style.border = "1px solid rgba(79,142,247,0.35)"; e.currentTarget.style.color = "#4F8EF7"; } }}
      onMouseLeave={e => { if (!selected) { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.10)"; e.currentTarget.style.color = "rgba(255,255,255,0.80)"; } }}>
      {children}
    </button>
  );
}

function DField({ label, children, error, valid }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>{label}</label>
      {children}
      {error && <span style={{ fontSize: 11, color: "#FF453A" }}>{error}</span>}
      {valid && !error && (
        <span style={{ fontSize: 11, color: "#30D158", display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          OK
        </span>
      )}
    </div>
  );
}

function DRow({ icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(79,142,247,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{children}</div>
    </div>
  );
}

// ── Ícones ───────────────────────────────────────────────────────────────────

function IcoClock() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.4)" strokeWidth="2"/><path d="M12 6v6l4 2" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round"/></svg>;
}
function IcoMeet({ white } = {}) {
  const s = white ? "#fff" : "rgba(255,255,255,0.4)";
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M15 10l5 5-5 5M4 4v7a4 4 0 004 4h12" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function IcoGlobe() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8"/><path d="M12 2C9 6 9 18 12 22M12 2c3 4 3 16 0 20M2 12h20" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round"/></svg>;
}
function IcoCal({ color = "#4F8EF7", size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth="2" strokeLinecap="round"/></svg>;
}
function IcoPerson({ color = "#4F8EF7" }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth="2" strokeLinecap="round"/></svg>;
}
function IcoCheck() {
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function IcoBack() {
  return <svg width="14" height="12" viewBox="0 0 14 12" fill="none"><path d="M5 1L1 6l4 5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M1.5 6H13" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" strokeLinecap="round"/></svg>;
}
function IcoDownload() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 4v12m0 0l-4-4m4 4l4-4" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 20h16" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round"/></svg>;
}
