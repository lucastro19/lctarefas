import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Token inválido' });

  // ── Salvar subscription ──
  if (req.method === 'POST') {
    const { subscription } = req.body ?? {};
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'Subscription inválida' });
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      { onConflict: 'endpoint' }
    );

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  // ── Remover subscription ──
  if (req.method === 'DELETE') {
    const { endpoint } = req.body ?? {};
    if (!endpoint) return res.status(400).json({ error: 'endpoint obrigatório' });

    await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
