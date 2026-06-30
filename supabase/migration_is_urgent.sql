-- Adiciona campo is_urgent à tabela tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false;

-- Índice para busca rápida por urgentes
CREATE INDEX IF NOT EXISTS tasks_is_urgent_idx ON tasks (user_id, is_urgent) WHERE is_urgent = true;
