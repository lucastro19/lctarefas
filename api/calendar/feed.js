import { generateCalendarToken } from './token.js';
import { createClient } from '@supabase/supabase-js';

function escapeIcal(str) {
  return (str ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + (minutes ?? 30);
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Converte data/hora de Brasília (UTC-3) para string iCal UTC
function toIcalUTC(dateStr, timeStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = (timeStr ?? '09:00').split(':').map(Number);
  // Brasília = UTC-3, soma 3h para obter UTC
  const utc = new Date(Date.UTC(y, mo - 1, d, h + 3, mi));
  return utc.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export default async function handler(req, res) {
  const { uid, token } = req.query ?? {};
  if (!uid || !token) return res.status(400).end();

  const expected = generateCalendarToken(uid);
  if (token !== expected) return res.status(401).end();

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, notes, scheduled_date, scheduled_time, duration_minutes')
    .eq('user_id', uid)
    .eq('is_urgent', true)
    .is('completed_at', null)
    .is('deleted_at', null)
    .not('scheduled_date', 'is', null);

  if (error) return res.status(500).end();

  const events = (tasks ?? []).map((task) => {
    const startTime = task.scheduled_time ?? '09:00';
    const endTime = addMinutes(startTime, task.duration_minutes ?? 30);
    const dtStart = toIcalUTC(task.scheduled_date, startTime);
    const dtEnd = toIcalUTC(task.scheduled_date, endTime);

    return [
      'BEGIN:VEVENT',
      `UID:task-${task.id}@lctarefas`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:🔔 ${escapeIcal(task.title)}`,
      task.notes ? `DESCRIPTION:${escapeIcal(task.notes)}` : null,
      'BEGIN:VALARM',
      'TRIGGER:PT0S',
      'ACTION:AUDIO',
      'DESCRIPTION:Tarefa urgente — LCTarefas',
      'END:VALARM',
      'END:VEVENT',
    ].filter(Boolean).join('\r\n');
  });

  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LCTarefas//PT',
    'NAME:LCTarefas Urgentes',
    'X-WR-CALNAME:🔔 LCTarefas Urgentes',
    'X-WR-CALDESC:Tarefas urgentes do LCTarefas',
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
    'COLOR:red',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).send(ical);
}
