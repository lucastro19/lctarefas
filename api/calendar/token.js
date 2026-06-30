import { createClient } from '@supabase/supabase-js';
import { generateCalendarToken } from '../_lib/calToken.js';

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
  const isLocal = host.includes('localhost');

  // webcals:// = HTTPS webcal — iOS abre direto no app Calendário
  const protocol = isLocal ? 'http' : 'webcals';
  const url = `${protocol}://${host}/api/calendar/feed?uid=${user.id}&token=${calToken}`;

  return res.status(200).json({ url });
}
