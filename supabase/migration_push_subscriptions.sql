-- Web Push subscriptions por dispositivo/usuário
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users NOT NULL,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Usuário gerencia apenas suas próprias subscriptions
CREATE POLICY "Users manage own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
