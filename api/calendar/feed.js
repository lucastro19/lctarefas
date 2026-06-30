import { createClient } from '@supabase/supabase-js';
import { generateCalendarToken } from '../_lib/calToken.js';

function escapeIcal(str) {
  return (str ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function toIcalUTC(dateStr, timeStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = (timeStr ?? '09:00').split(':').map(Number);
  // Brasília UTC-3: soma 3h para obter UTC
  const utc = new Date(Date.UTC(y, mo - 1, d, h + 3, mi));
  return utc.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + (minutes ?? 30);
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export default async function handler(req, res) {
  const { uid, token } = req.query ?? {};
  if (!uid || !token) return res.status(400).send('Missing params');

  let expected;
  try {
    expected = generateCalendarToken(uid);
  } catch (err) {
    return res.status(500).send(`Config error: ${err.message}`);
  }
  if (!process.env.CALENDAR_SECRET) return res.status(500).send('CALENDAR_SECRET not set');
  if (token !== expected) return res.status(401).send(`Unauthorized (got: ${token?.slice(0,8)}, expected: ${expected?.slice(0,8)}`);

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

  if (error) return res.status(500).send(`DB error: ${JSON.stringify(error)}`);

  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

  const events = (tasks ?? []).map((task) => {
    const startTime = task.scheduled_time ?? '09:00';
    const endTime = addMinutes(startTime, task.duration_minutes ?? 30);
    const dtStart = toIcalUTC(task.scheduled_date, startTime);
    const dtEnd = toIcalUTC(task.scheduled_date, endTime);

    const lines = [
      'BEGIN:VEVENT',
      `UID:task-${task.id}@lctarefas`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escapeIcal(`🔔 ${task.title}`)}`,
    ];
    if (task.notes) lines.push(`DESCRIPTION:${escapeIcal(task.notes)}`);
    lines.push(
      'BEGIN:VALARM',
      'TRIGGER:PT0S',
      'ACTION:AUDIO',
      'DESCRIPTION:Tarefa urgente',
      'END:VALARM',
      'END:VEVENT'
    );
    return lines.join('\r\n');
  });

  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LCTarefas//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:LCTarefas Urgentes',
    'X-WR-CALDESC:Tarefas urgentes',
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).send(ical);
}
