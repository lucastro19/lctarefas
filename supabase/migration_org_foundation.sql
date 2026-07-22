-- ================================================================
-- FASE 2.0 — Fundação Organizacional
-- Plataforma hierárquica multi-tenant sobre o app pessoal.
-- Execute no SQL Editor do Supabase.
--
-- IMPORTANTE: esta migração NÃO altera a RLS de `tasks` nem o
-- comportamento atual. Só cria tabelas novas isoladas e adiciona
-- colunas nullable que nada lê ainda. O app pessoal segue idêntico.
-- ================================================================

-- ORGANIZAÇÃO (a empresa)
create table if not exists organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid references auth.users(id) on delete cascade not null,
  plan       text not null default 'free' check (plan in ('free','pro','business')),
  created_at timestamptz default now()
);

-- MEMBROS + ÁRVORE DE REPORTE (manager_id auto-referencial)
create table if not exists org_members (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid references organizations(id) on delete cascade not null,
  user_id    uuid references auth.users(id) on delete cascade not null,
  role       text not null check (role in ('estrategico','supervisor','membro')),
  manager_id uuid references org_members(id) on delete set null,
  created_at timestamptz default now(),
  unique (org_id, user_id)
);

-- TIMES (a unidade que o supervisor cuida)
create table if not exists teams (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid references organizations(id) on delete cascade not null,
  name       text not null,
  lead_id    uuid references org_members(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists team_members (
  team_id       uuid references teams(id) on delete cascade not null,
  org_member_id uuid references org_members(id) on delete cascade not null,
  primary key (team_id, org_member_id)
);

-- TIPOS DE DEMANDA (taxonomia compartilhada tarefas <-> atendimentos)
create table if not exists demand_types (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations(id) on delete cascade not null,
  key         text not null,
  label       text not null,
  color       text not null default '#8E8E93',
  archived_at timestamptz,
  unique (org_id, key)
);

-- CONVITES (link com token, compartilhado manualmente na Fase 2.0)
create table if not exists org_invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations(id) on delete cascade not null,
  email       text not null,
  role        text not null check (role in ('supervisor','membro')),
  manager_id  uuid references org_members(id) on delete set null,
  token       uuid not null default gen_random_uuid() unique,
  invited_by  uuid references auth.users(id) not null,
  status      text not null default 'pending' check (status in ('pending','accepted','revoked')),
  created_at  timestamptz default now(),
  accepted_at timestamptz
);

-- ================================================================
-- COLUNAS EM TABELAS EXISTENTES
-- nulo = pessoal (comportamento atual, intocado); preenchido = corporativo
-- ================================================================
alter table tasks    add column if not exists org_id uuid references organizations(id) on delete set null;
alter table areas    add column if not exists org_id uuid references organizations(id) on delete set null;
alter table projects add column if not exists org_id uuid references organizations(id) on delete set null;

alter table tasks add column if not exists assignee_id    uuid references auth.users(id) on delete set null;
alter table tasks add column if not exists demand_type_id uuid references demand_types(id) on delete set null;

-- ================================================================
-- FUNÇÕES SECURITY DEFINER
-- ================================================================

-- "sou membro desta org?" — usada nas policies sem recursão de RLS
create or replace function public.is_org_member(check_org_id uuid, check_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from org_members where org_id = check_org_id and user_id = check_user_id)
      or exists (select 1 from organizations where id = check_org_id and owner_id = check_user_id);
$$;

-- "compartilho org com este usuário?" — libera leitura de perfil entre colegas de org
create or replace function public.shares_org_with(target_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from org_members m1
    join org_members m2 on m1.org_id = m2.org_id
    where m1.user_id = auth.uid() and m2.user_id = target_user
  );
$$;

-- Aceitar convite — RPC porque o convidado ainda não é membro
-- (não passaria nas policies normais de org_members).
create or replace function public.accept_org_invite(p_token uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_invite org_invites%rowtype;
  v_email  text;
begin
  select email into v_email from auth.users where id = auth.uid();
  select * into v_invite from org_invites where token = p_token and status = 'pending';

  if v_invite.id is null then
    raise exception 'Convite inválido ou já utilizado.';
  end if;
  if lower(v_invite.email) <> lower(v_email) then
    raise exception 'Este convite foi enviado para outro e-mail.';
  end if;

  insert into org_members (org_id, user_id, role, manager_id)
  values (v_invite.org_id, auth.uid(), v_invite.role, v_invite.manager_id)
  on conflict (org_id, user_id) do nothing;

  update org_invites set status = 'accepted', accepted_at = now() where id = v_invite.id;
  return v_invite.org_id;
end;
$$;

-- ================================================================
-- ROW LEVEL SECURITY
-- Isolamento entre organizações (NÃO o roll-up hierárquico — isso é a Fase 2.1).
-- ================================================================
alter table organizations enable row level security;
alter table org_members   enable row level security;
alter table teams         enable row level security;
alter table team_members  enable row level security;
alter table demand_types  enable row level security;
alter table org_invites   enable row level security;

-- organizations
drop policy if exists "organizations_member_select" on organizations;
create policy "organizations_member_select" on organizations for select
  using (public.is_org_member(id, auth.uid()));
drop policy if exists "organizations_owner_all" on organizations;
create policy "organizations_owner_all" on organizations for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- org_members
drop policy if exists "org_members_select" on org_members;
create policy "org_members_select" on org_members for select
  using (public.is_org_member(org_id, auth.uid()));
drop policy if exists "org_members_owner_insert" on org_members;
create policy "org_members_owner_insert" on org_members for insert
  with check (exists (select 1 from organizations where id = org_id and owner_id = auth.uid()));
drop policy if exists "org_members_owner_update" on org_members;
create policy "org_members_owner_update" on org_members for update
  using (exists (select 1 from organizations where id = org_id and owner_id = auth.uid()));
drop policy if exists "org_members_owner_delete" on org_members;
create policy "org_members_owner_delete" on org_members for delete
  using (exists (select 1 from organizations where id = org_id and owner_id = auth.uid()));

-- teams
drop policy if exists "teams_member_select" on teams;
create policy "teams_member_select" on teams for select
  using (public.is_org_member(org_id, auth.uid()));
drop policy if exists "teams_owner_all" on teams;
create policy "teams_owner_all" on teams for all
  using (exists (select 1 from organizations where id = org_id and owner_id = auth.uid()));

-- team_members
drop policy if exists "team_members_select" on team_members;
create policy "team_members_select" on team_members for select
  using (exists (select 1 from teams t where t.id = team_id and public.is_org_member(t.org_id, auth.uid())));
drop policy if exists "team_members_owner_all" on team_members;
create policy "team_members_owner_all" on team_members for all
  using (exists (
    select 1 from teams t join organizations o on o.id = t.org_id
    where t.id = team_id and o.owner_id = auth.uid()
  ));

-- demand_types
drop policy if exists "demand_types_member_select" on demand_types;
create policy "demand_types_member_select" on demand_types for select
  using (public.is_org_member(org_id, auth.uid()));
drop policy if exists "demand_types_owner_all" on demand_types;
create policy "demand_types_owner_all" on demand_types for all
  using (exists (select 1 from organizations where id = org_id and owner_id = auth.uid()));

-- org_invites: dono gerencia; convidado lê o próprio pelo e-mail do JWT
drop policy if exists "org_invites_owner_all" on org_invites;
create policy "org_invites_owner_all" on org_invites for all
  using (exists (select 1 from organizations where id = org_id and owner_id = auth.uid()));
drop policy if exists "org_invites_own_email_select" on org_invites;
create policy "org_invites_own_email_select" on org_invites for select
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- profiles: colegas de organização podem ler nome/avatar/e-mail uns dos outros
-- (necessário para listar membros; não afeta a policy de leitura do próprio perfil).
drop policy if exists "profile_select_orgmate" on public.profiles;
create policy "profile_select_orgmate" on public.profiles for select
  using (public.shares_org_with(id));

-- ================================================================
-- ÍNDICES
-- ================================================================
create index if not exists org_members_org_idx    on org_members(org_id);
create index if not exists org_members_user_idx    on org_members(user_id);
create index if not exists org_members_manager_idx on org_members(manager_id);
create index if not exists teams_org_idx           on teams(org_id);
create index if not exists demand_types_org_idx    on demand_types(org_id);
create index if not exists org_invites_token_idx   on org_invites(token);
create index if not exists org_invites_org_idx     on org_invites(org_id);
create index if not exists tasks_org_idx           on tasks(org_id);
create index if not exists tasks_assignee_idx      on tasks(assignee_id);
create index if not exists areas_org_idx           on areas(org_id);
create index if not exists projects_org_idx        on projects(org_id);
