-- ================================================================
-- DELEGAÇÃO — Fase 1: colaboradores como contatos locais do gestor
-- Execute no SQL Editor do Supabase
-- ================================================================

-- COLABORADORES (contatos do gestor; sem conta e sem acesso na Fase 1)
create table if not exists collaborators (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null, -- o gestor
  linked_user_id uuid references auth.users(id) on delete set null,         -- reservado p/ Fase 2
  name           text not null,
  role           text,                        -- cargo
  email          text,
  phone          text,                        -- só dígitos, formato wa.me: 5531999999999
  color          text not null default '#AF52DE',
  avatar_url     text,
  position       integer not null default 0,
  archived_at    timestamptz,
  deleted_at     timestamptz,                 -- soft-delete, coerente com o resto do app
  created_at     timestamptz default now()
);

-- CAMPOS DE DELEGAÇÃO EM TAREFAS
-- delegation_status fica nullable de propósito: null = tarefa não delegada.
alter table tasks
  add column if not exists delegated_to      uuid references collaborators(id) on delete set null,
  add column if not exists delegated_at      timestamptz,
  add column if not exists follow_up_date    date,
  add column if not exists delegation_status text,
  add column if not exists delegation_note   text,        -- o combinado / definição de pronto
  add column if not exists last_update_at    timestamptz,  -- alimenta o cálculo de aging
  add column if not exists nudge_count       integer not null default 0,
  add column if not exists last_nudge_at     timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_delegation_status_check'
  ) then
    alter table tasks add constraint tasks_delegation_status_check
      check (delegation_status in
        ('pendente','em_andamento','aguardando_aceite','bloqueada','concluida'));
  end if;
end $$;

-- ROW LEVEL SECURITY
-- Mesmo padrão das demais tabelas. A policy de tasks NÃO é alterada.
alter table collaborators enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'collaborators' and policyname = 'collaborators_own'
  ) then
    create policy "collaborators_own" on collaborators for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- ÍNDICES
create index if not exists tasks_delegated_to_idx    on tasks(delegated_to);
create index if not exists tasks_follow_up_date_idx  on tasks(follow_up_date);
create index if not exists collaborators_user_id_idx on collaborators(user_id);
