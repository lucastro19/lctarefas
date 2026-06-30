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

// Converte Date UTC para string de tempo no fuso do Brasil (UTC-3)
function brTimeStr(date) {
  const br = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return `${String(br.getUTCHours()).padStart(2, '0')}:${String(br.getUTCMinutes()).padStart(2, '0')}`;
}

function brDateStr(date) {
  const br = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return br.toISOString().split('T')[0];
}

export default async function handler(req, res) {
  // Proteção: exige CRON_SECRET via header ou query param
  const secret = (req.headers['x-cron-secret'] ?? req.query?.secret ?? '').trim();
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = getSupabase();
  const now = new Date();
  const todayBR = brDateStr(now);
  const currentTime = brTimeStr(now);
  const futureTime = brTimeStr(new Date(now.getTime() + 16 * 60 * 1000)); // janela +16 min

  // Busca tarefas com horário dentro da janela (hoje, não concluídas)
  const { data: tasks, error: tasksErr } = await supabase
    .from('tasks')
    .select('id, title, scheduled_time, user_id')
    .eq('scheduled_date', todayBR)
    .gte('scheduled_time', currentTime)
    .lte('scheduled_time', futureTime)
    .is('completed_at', null)
    .is('deleted_at', null);

  if (tasksErr) return res.status(500).json({ error: tasksErr.message });
  if (!tasks?.length) return res.status(200).json({ sent: 0, message: 'Sem tarefas no período' });

  // Agrupa por usuário
  const byUser = {};
  for (const t of tasks) {
    (byUser[t.user_id] ??= []).push(t);
  }

  // Busca subscriptions dos usuários com tarefas
  const { data: subs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', Object.keys(byUser));

  if (subsErr) return res.status(500).json({ error: subsErr.message });
  if (!subs?.length) return res.status(200).json({ sent: 0, message: 'Sem subscriptions' });

  let sent = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      const userTasks = byUser[sub.user_id] ?? [];
      if (!userTasks.length) return;

      const firstTask = userTasks[0];
      const title = userTasks.length === 1
        ? firstTask.title
        : `${userTasks.length} tarefas agendadas`;
      const body = userTasks.length === 1
        ? `⏰ ${firstTask.scheduled_time} — toque para abrir`
        : userTasks.slice(0, 3).map((t) => `· ${t.title}`).join('\n');

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, url: '/today', tag: `task-${firstTask.id}` })
        );
        sent++;
      } catch (err) {
        // Remove subscriptions expiradas
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    })
  );

  return res.status(200).json({ sent, tasks: tasks.length });
}
