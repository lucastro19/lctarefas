-- ================================================================
-- Vincular Times a Espaços: linkar um time a um espaço faz todo membro
-- ATIVO do time herdar acesso automaticamente — vínculo vivo (entra/sai
-- do time => ganha/perde acesso), não uma cópia estática. Espelha
-- space_members em tudo (mesmo formato de PK, mesmas policies), só
-- troca org_member_id por team_id.
-- ================================================================

create table if not exists public.space_teams (
  space_id   uuid not null references public.spaces(id) on delete cascade,
  team_id    uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (space_id, team_id)
);

create index if not exists space_teams_team_idx on public.space_teams(team_id);

-- is_space_member ganha um terceiro ramo: membro ativo de um time ATIVO
-- vinculado ao espaço também tem acesso, igual a estar em space_members
-- diretamente. Time desativado (archived_at) deixa de contar, igual a
-- como org_members.archived_at já é ignorado no ramo existente.
create or replace function public.is_space_member(check_space_id uuid, check_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from spaces s
    join org_members m on m.org_id = s.org_id and m.user_id = check_user_id and m.archived_at is null
    where s.id = check_space_id
      and (
        s.is_open
        or exists (
          select 1 from space_members sm where sm.space_id = s.id and sm.org_member_id = m.id
        )
        or exists (
          select 1
          from space_teams st
          join teams t on t.id = st.team_id and t.archived_at is null
          join team_members tm on tm.team_id = t.id and tm.org_member_id = m.id
          where st.space_id = s.id
        )
      )
  )
  or exists (
    select 1 from spaces s join organizations o on o.id = s.org_id
    where s.id = check_space_id and o.owner_id = check_user_id
  );
$$;

alter table public.space_teams enable row level security;

create policy "space_teams_select" on public.space_teams for select
  using (exists (select 1 from spaces s where s.id = space_id and public.is_space_member(s.id, auth.uid())));

create policy "space_teams_owner_all" on public.space_teams for all
  using (exists (
    select 1
    from spaces s
    join organizations o on o.id = s.org_id
    join teams t on t.id = team_id
    where s.id = space_id and o.owner_id = auth.uid() and t.org_id = s.org_id
  ));
