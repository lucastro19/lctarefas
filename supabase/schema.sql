-- =============================================
-- LCTarefas — Schema Supabase
-- Execute no SQL Editor do Supabase Dashboard
-- =============================================

-- ÁREAS (contextos macro: LC Tecnologia, Pessoal, Família...)
create table if not exists areas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  color text not null default '#4F8EF7',
  position integer not null default 0,
  created_at timestamptz default now()
);

-- PROJETOS (dentro das áreas, com objetivo e prazo opcional)
create table if not exists projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  area_id uuid references areas(id) on delete set null,
  name text not null,
  notes text,
  deadline date,
  color text not null default '#34C759',
  position integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- TAREFAS
create table if not exists tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  project_id uuid references projects(id) on delete set null,
  area_id uuid references areas(id) on delete set null,
  title text not null,
  notes text,
  scheduled_date date,
  deadline date,
  someday boolean not null default false,
  position integer not null default 0,
  completed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  -- Reunião Google Meet
  meeting_url text,
  meeting_event_id text,
  meeting_attendees text[]
);

-- SUBTAREFAS (checklist dentro de uma tarefa)
create table if not exists subtasks (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references tasks(id) on delete cascade not null,
  title text not null,
  completed boolean not null default false,
  position integer not null default 0
);

-- TAGS
create table if not exists tags (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  color text not null default '#8E8E93'
);

-- RELACIONAMENTO TAREFA <-> TAG
create table if not exists task_tags (
  task_id uuid references tasks(id) on delete cascade not null,
  tag_id uuid references tags(id) on delete cascade not null,
  primary key (task_id, tag_id)
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

alter table areas enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table subtasks enable row level security;
alter table tags enable row level security;
alter table task_tags enable row level security;

-- Áreas: usuário gerencia apenas as próprias
create policy "areas_own" on areas for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Projetos: usuário gerencia apenas os próprios
create policy "projects_own" on projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Tarefas: usuário gerencia apenas as próprias
create policy "tasks_own" on tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Subtarefas: via ownership da tarefa pai
create policy "subtasks_own" on subtasks for all using (
  exists (select 1 from tasks where tasks.id = subtasks.task_id and tasks.user_id = auth.uid())
);

-- Tags: usuário gerencia apenas as próprias
create policy "tags_own" on tags for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Task-tags: via ownership da tarefa
create policy "task_tags_own" on task_tags for all using (
  exists (select 1 from tasks where tasks.id = task_tags.task_id and tasks.user_id = auth.uid())
);

-- =============================================
-- ÍNDICES para performance
-- =============================================

create index if not exists tasks_user_id_idx on tasks(user_id);
create index if not exists tasks_scheduled_date_idx on tasks(scheduled_date);
create index if not exists tasks_deleted_at_idx on tasks(deleted_at);
create index if not exists tasks_completed_at_idx on tasks(completed_at);
create index if not exists subtasks_task_id_idx on subtasks(task_id);
