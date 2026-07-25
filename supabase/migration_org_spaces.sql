-- ================================================================
-- FASE 2 — Espaço da organização: contêiner compartilhado real, com
-- membros/permissões próprias (não mais uma área privada com flag).
--
-- Por padrão um espaço é ABERTO (is_open = true): qualquer membro ATIVO
-- da org enxerga tudo dentro dele, sem precisar gerenciar lista de
-- membros — decisão do Lucas pra equipe pequena, transparência interna
-- reduz atrito. Fechar um espaço (is_open = false) exige adicionar
-- membros explicitamente em space_members — pra casos tipo Financeiro/
-- Diretoria. Dono da org sempre tem acesso, aberto ou fechado.
--
-- Escopo desta fase: só dados + RLS (ver o espaço, ver tarefas nele).
-- Quem pode EDITAR uma tarefa continua igual (dono ou assignee) — virar
-- membro do espaço não dá permissão de editar tarefa de outra pessoa,
-- só visibilidade. Fluxo de criação de tarefa dentro de um espaço fica
-- pra Fase 3.
-- ================================================================

create table if not exists public.spaces (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  color       text not null default '#4F8EF7',
  is_open     boolean not null default true,
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.space_members (
  space_id      uuid not null references public.spaces(id) on delete cascade,
  org_member_id uuid not null references public.org_members(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (space_id, org_member_id)
);

alter table public.tasks
  add column if not exists space_id uuid references public.spaces(id) on delete set null;

create index if not exists spaces_org_idx on public.spaces(org_id) where archived_at is null;
create index if not exists tasks_space_idx on public.tasks(space_id) where space_id is not null;

-- "esse usuário tem acesso a este espaço?" — aberto: qualquer membro ativo da
-- org; fechado: só quem está em space_members; dono da org sempre tem acesso.
create or replace function public.is_space_member(check_space_id uuid, check_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from spaces s
    join org_members m on m.org_id = s.org_id and m.user_id = check_user_id and m.archived_at is null
    where s.id = check_space_id
      and (s.is_open or exists (
        select 1 from space_members sm where sm.space_id = s.id and sm.org_member_id = m.id
      ))
  )
  or exists (
    select 1 from spaces s join organizations o on o.id = s.org_id
    where s.id = check_space_id and o.owner_id = check_user_id
  );
$$;

-- Toda tarefa filiada a um espaço herda o org_id daquele espaço automaticamente
-- — garante que roll-up (is_manager_of), tipo de demanda e aprovação de prazo
-- (que dependem de org_id) continuem consistentes sem depender de disciplina
-- do client em cada tela que grava tasks.
create or replace function public.sync_task_org_from_space()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.space_id is not null then
    select org_id into new.org_id from spaces where id = new.space_id;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_sync_org_from_space on public.tasks;
create trigger tasks_sync_org_from_space
  before insert or update of space_id on public.tasks
  for each row execute function public.sync_task_org_from_space();

alter table public.spaces enable row level security;
alter table public.space_members enable row level security;

create policy "spaces_member_select" on public.spaces for select
  using (public.is_space_member(id, auth.uid()));
create policy "spaces_owner_all" on public.spaces for all
  using (exists (select 1 from organizations where id = org_id and owner_id = auth.uid()));

create policy "space_members_select" on public.space_members for select
  using (exists (select 1 from spaces s where s.id = space_id and public.is_space_member(s.id, auth.uid())));
create policy "space_members_owner_all" on public.space_members for all
  using (exists (
    select 1 from spaces s join organizations o on o.id = s.org_id
    where s.id = space_id and o.owner_id = auth.uid()
  ));

-- tasks_select ganha a visibilidade do espaço, mantendo as regras já existentes
-- (dono, assignee, roll-up hierárquico) intactas.
drop policy if exists "tasks_select" on public.tasks;
create policy "tasks_select" on public.tasks for select using (
  (user_id = auth.uid())
  or (assignee_id = auth.uid())
  or (org_id is not null and assignee_id is not null and public.is_manager_of(auth.uid(), assignee_id, org_id))
  or (space_id is not null and public.is_space_member(space_id, auth.uid()))
);
