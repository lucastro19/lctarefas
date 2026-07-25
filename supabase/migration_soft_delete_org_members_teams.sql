-- ================================================================
-- FASE 1c — Inativação (soft-delete) de membros e times, em vez de
-- exclusão real. Colaboradores locais já tinham esse padrão desde a
-- Fase 1 (archived_at); aqui estende pra org_members e teams.
--
-- Membro desativado: perde acesso (is_org_member/is_manager_of param de
-- de baixo pra cima ignoram archived_at not null), mas continua visível
-- pra quem já é membro ativo — histórico de tarefas/delegação não quebra.
-- ================================================================

alter table public.org_members add column if not exists archived_at timestamptz;
alter table public.teams add column if not exists archived_at timestamptz;

create index if not exists org_members_archived_idx on public.org_members(org_id) where archived_at is null;
create index if not exists teams_archived_idx on public.teams(org_id) where archived_at is null;

-- "sou membro ATIVO desta org?" — membro desativado deixa de passar aqui,
-- perdendo acesso a organizations/teams/demand_types/team_members via RLS.
create or replace function public.is_org_member(check_org_id uuid, check_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from org_members
    where org_id = check_org_id and user_id = check_user_id and archived_at is null
  )
  or exists (select 1 from organizations where id = check_org_id and owner_id = check_user_id);
$$;

-- Cadeia de hierarquia (roll-up) ignora membros desativados nos dois sentidos —
-- um gestor desativado não conta mais como ancestral, e um subordinado
-- desativado não é mais alcançado a partir da raiz.
create or replace function public.is_manager_of(
  manager_uid uuid,
  report_uid  uuid,
  org         uuid
)
returns boolean language sql stable security definer set search_path = public
as $$
  with recursive chain as (
    select m.id, m.user_id, m.manager_id
    from org_members m
    where m.user_id = report_uid and m.org_id = org and m.archived_at is null
    union all
    select p.id, p.user_id, p.manager_id
    from org_members p
    join chain c on p.id = c.manager_id
    where p.archived_at is null
  )
  select exists (
    select 1 from chain
    where user_id = manager_uid
      and user_id <> report_uid
  );
$$;

-- Colega de org só enxerga perfil de outros enquanto ELE (o observador) está
-- ativo — não exige o alvo ativo, pra não quebrar exibição de nome/avatar em
-- registros históricos (tarefas antigas, elos de delegação já concluídos).
create or replace function public.shares_org_with(target_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from org_members m1
    join org_members m2 on m1.org_id = m2.org_id
    where m1.user_id = auth.uid() and m2.user_id = target_user
      and m1.archived_at is null
  );
$$;
