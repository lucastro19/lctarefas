import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export function generateCalendarToken(userId) {
  return crypto
    .createHmac('sha256', process.env.CALENDAR_SECRET)
    .update(userId)
    .digest('base64url')
    .slice(0, 32);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const token = (req.headers.authorization ?? '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Token inválido' });

  const calToken = generateCalendarToken(user.id);
  const host = req.headers.host ?? 'tarefas.lcgestor.com.br';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const url = `${protocol}://${host}/api/calendar/feed?uid=${user.id}&token=${calToken}`;

  return res.status(200).json({ url });
}
