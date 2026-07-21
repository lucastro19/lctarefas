/*
  Cron de notificações — roda a cada 15 minutos via Vercel Cron.
  Janela de busca: [now, now+16min] para cobrir cada execução.

  Notificações enviadas:
  ─ Urgente: aviso 15min antes + aviso 5min antes + na hora
  ─ Normal: na hora agendada
  ─ Deadline: às 08:00 do dia de vencimento
  ─ Resumo matinal: às 08:00 com contagem e lista das tarefas do dia
  ─ Payload inclui taskId para ações "Concluir" e "Adiar" no SW
*/

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

function getSupabase() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Converte Date UTC → horário de Brasília (UTC-3)
function toBR(date) {
  return new Date(date.getTime() - 3 * 60 * 60 * 1000);
}
function brTimeStr(date) {
  const br = toBR(date);
  return `${String(br.getUTCHours()).padStart(2,'0')}:${String(br.getUTCMinutes()).padStart(2,'0')}`;
}
function brDateStr(date) {
  return toBR(date).toISOString().split('T')[0];
}

async function sendPush(sub, payload) {
  await webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload)
  );
}

export default async function handler(req, res) {
  // Vercel Cron injeta: Authorization: Bearer {CRON_SECRET}
  const authHeader = req.headers.authorization ?? '';
  const token      = authHeader.replace('Bearer ', '').trim();
  // Suporte a query param como fallback (debug manual)
  const secret = process.env.CRON_SECRET ?? '';
  if (!secret || (token !== secret && req.query?.secret !== secret)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = getSupabase();
  const now      = new Date();
  const todayBR  = brDateStr(now);
  const nowTime  = brTimeStr(now);
  const windowEnd = brTimeStr(new Date(now.getTime() + 16 * 60 * 1000));
  const hourBR    = toBR(now).getUTCHours();
  const minBR     = toBR(now).getUTCMinutes();

  // ── 1. Tarefas na janela de horário (notificação principal) ──
  const { data: tasksNow } = await supabase
    .from('tasks')
    .select('id, title, notes, scheduled_time, is_urgent, user_id')
    .eq('scheduled_date', todayBR)
    .not('scheduled_time', 'is', null)
    .gte('scheduled_time', nowTime)
    .lte('scheduled_time', windowEnd)
    .is('completed_at', null)
    .is('deleted_at', null);

  // ── 2. Urgentes: aviso 15 min antes ─────────────────────────
  const early15Start = brTimeStr(new Date(now.getTime() + 15 * 60 * 1000));
  const early15End   = brTimeStr(new Date(now.getTime() + 31 * 60 * 1000));
  const { data: tasksEarly15 } = await supabase
    .from('tasks')
    .select('id, title, scheduled_time, user_id')
    .eq('scheduled_date', todayBR)
    .eq('is_urgent', true)
    .not('scheduled_time', 'is', null)
    .gte('scheduled_time', early15Start)
    .lte('scheduled_time', early15End)
    .is('completed_at', null)
    .is('deleted_at', null);

  // ── 3. Urgentes: aviso 5 min antes ──────────────────────────
  const early5Start = brTimeStr(new Date(now.getTime() + 5 * 60 * 1000));
  const early5End   = brTimeStr(new Date(now.getTime() + 21 * 60 * 1000));
  const { data: tasksEarly5 } = await supabase
    .from('tasks')
    .select('id, title, scheduled_time, user_id')
    .eq('scheduled_date', todayBR)
    .eq('is_urgent', true)
    .not('scheduled_time', 'is', null)
    .gte('scheduled_time', early5Start)
    .lte('scheduled_time', early5End)
    .is('completed_at', null)
    .is('deleted_at', null);

  // ── 4, 5 & 6. Deadline + Resumo matinal + Cobranças (só entre 08:00–08:16) ─
  let tasksDeadline   = [];
  let tasksSummary    = [];
  let tasksDelegation = [];
  if (hourBR === 8 && minBR < 16) {
    const [{ data: dl }, { data: sm }, { data: dg }] = await Promise.all([
      supabase.from('tasks').select('id, title, user_id')
        .eq('deadline', todayBR).is('completed_at', null).is('deleted_at', null),
      supabase.from('tasks').select('id, title, user_id')
        .eq('scheduled_date', todayBR).is('completed_at', null).is('deleted_at', null),
      // Delegadas cuja data de cobrança já chegou
      supabase.from('tasks')
        .select('id, title, user_id, follow_up_date, collaborators(name)')
        .not('delegated_to', 'is', null)
        .neq('delegation_status', 'concluida')
        .lte('follow_up_date', todayBR)
        .is('completed_at', null).is('deleted_at', null).is('archived_at', null),
    ]);
    tasksDeadline   = dl ?? [];
    tasksSummary    = sm ?? [];
    tasksDelegation = dg ?? [];
  }

  // ── Coleta user_ids e subscriptions ─────────────────────────
  const allTasks = [
    ...(tasksNow     ?? []),
    ...(tasksEarly15 ?? []),
    ...(tasksEarly5  ?? []),
    ...tasksDeadline,
    ...tasksSummary,
    ...tasksDelegation,
  ];
  if (!allTasks.length) {
    return res.status(200).json({ sent: 0, message: 'Sem notificações nesta janela' });
  }

  const userIds = [...new Set(allTasks.map((t) => t.user_id))];
  const { data: subs } = await supabase
    .from('push_subscriptions').select('*').in('user_id', userIds);

  if (!subs?.length) {
    return res.status(200).json({ sent: 0, message: 'Sem subscriptions ativas' });
  }

  const subsByUser = {};
  for (const s of subs) (subsByUser[s.user_id] ??= []).push(s);

  let sent = 0;

  async function pushToUser(userId, payload) {
    await Promise.allSettled(
      (subsByUser[userId] ?? []).map(async (sub) => {
        try {
          await sendPush(sub, payload);
          sent++;
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          }
        }
      })
    );
  }

  // ── Dispara notificações ─────────────────────────────────────
  await Promise.allSettled([
    // Principais
    ...(tasksNow ?? []).map((t) => pushToUser(t.user_id, {
      title : t.is_urgent ? `🔴 ${t.title}` : `🔔 ${t.title}`,
      body  : t.notes?.slice(0, 120) ?? (t.is_urgent ? 'Tarefa urgente no horário.' : 'Tarefa agendada para agora.'),
      url   : '/today', tag: `task-${t.id}`, taskId: t.id,
    })),
    // 15 min antes
    ...(tasksEarly15 ?? []).map((t) => pushToUser(t.user_id, {
      title : `⚠️ Em 15 min — ${t.title}`,
      body  : 'Tarefa urgente começando em breve.',
      url   : '/today', tag: `task-${t.id}-early15`, taskId: t.id,
    })),
    // 5 min antes
    ...(tasksEarly5 ?? []).map((t) => pushToUser(t.user_id, {
      title : `🚨 Em 5 min — ${t.title}`,
      body  : 'Últimos minutos!',
      url   : '/today', tag: `task-${t.id}-early5`, taskId: t.id,
    })),
    // Deadlines (agrupado por usuário)
    ...Object.entries(
      tasksDeadline.reduce((acc, t) => { (acc[t.user_id] ??= []).push(t); return acc; }, {})
    ).map(([uid, tasks]) => pushToUser(uid, {
      title : tasks.length === 1 ? `⏳ Vence hoje — ${tasks[0].title}` : `⏳ ${tasks.length} prazos vencem hoje`,
      body  : tasks.length > 1 ? tasks.slice(0,3).map((t) => `· ${t.title}`).join('\n') : 'Prazo encerra hoje.',
      url   : '/today', tag: `deadline-${uid}`,
    })),
    // Resumo matinal (agrupado por usuário)
    ...Object.entries(
      tasksSummary.reduce((acc, t) => { (acc[t.user_id] ??= []).push(t); return acc; }, {})
    ).map(([uid, tasks]) => pushToUser(uid, {
      title : `📋 ${tasks.length} tarefa${tasks.length > 1 ? 's' : ''} para hoje`,
      body  : tasks.slice(0,3).map((t) => `· ${t.title}`).join('\n') + (tasks.length > 3 ? `\n…e mais ${tasks.length - 3}` : ''),
      url   : '/today', tag: `summary-${uid}`,
    })),
    // Cobranças de tarefas delegadas (agrupado por usuário)
    ...Object.entries(
      tasksDelegation.reduce((acc, t) => { (acc[t.user_id] ??= []).push(t); return acc; }, {})
    ).map(([uid, tasks]) => {
      const atrasadas = tasks.filter((t) => t.follow_up_date < todayBR).length;
      return pushToUser(uid, {
        title : `🤝 ${tasks.length} cobrança${tasks.length > 1 ? 's' : ''} pendente${tasks.length > 1 ? 's' : ''}`
                + (atrasadas > 0 ? ` — ${atrasadas} atrasada${atrasadas > 1 ? 's' : ''}` : ''),
        body  : tasks.slice(0,3).map((t) => `· ${t.collaborators?.name ?? 'Alguém'} — ${t.title}`).join('\n')
                + (tasks.length > 3 ? `\n…e mais ${tasks.length - 3}` : ''),
        url   : '/delegadas', tag: `delegation-${uid}`,
      });
    }),
  ]);

  return res.status(200).json({ sent, tasks: allTasks.length });
}
