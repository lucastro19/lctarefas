-- ================================================================
-- PROFILES — tabela de perfis de usuário com planos e papéis
-- Execute no SQL Editor do Supabase
-- ================================================================

-- 1. Tabela de perfis
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  full_name           text,
  avatar_url          text,
  email               text,
  role                text not null default 'free'
                        check (role in ('free', 'pro', 'admin')),
  plan_expires_at     timestamptz,
  stripe_customer_id  text,
  suspended_at        timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- 2. RLS
alter table public.profiles enable row level security;

-- Usuário lê e edita apenas o próprio perfil
drop policy if exists "profile_select_own" on public.profiles;
create policy "profile_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profile_update_own" on public.profiles;
create policy "profile_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Admins têm acesso total (usa função security definer para evitar recursão)
create or replace function public.is_admin()
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "profile_select_admin" on public.profiles;
create policy "profile_select_admin" on public.profiles
  for select using (public.is_admin());

drop policy if exists "profile_update_admin" on public.profiles;
create policy "profile_update_admin" on public.profiles
  for update using (public.is_admin());

-- 3. Trigger: cria perfil automaticamente ao cadastrar usuário
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    new.raw_user_meta_data->>'avatar_url',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Função admin para listar todos os usuários com contagem de tarefas
create or replace function public.admin_list_users()
returns table (
  id              uuid,
  full_name       text,
  avatar_url      text,
  email           text,
  role            text,
  plan_expires_at timestamptz,
  suspended_at    timestamptz,
  created_at      timestamptz,
  task_count      bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas administradores podem listar usuários.';
  end if;

  return query
    select
      p.id,
      p.full_name,
      p.avatar_url,
      p.email,
      p.role,
      p.plan_expires_at,
      p.suspended_at,
      p.created_at,
      count(t.id)::bigint as task_count
    from public.profiles p
    left join public.tasks t
      on t.user_id = p.id
      and t.deleted_at is null
      and t.completed_at is null
    group by p.id
    order by p.created_at desc;
end;
$$;

-- 5. Função admin para atualizar papel/plano de um usuário
create or replace function public.admin_set_user_role(
  target_id  uuid,
  new_role   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado.';
  end if;
  if new_role not in ('free', 'pro', 'admin') then
    raise exception 'Papel inválido: %.', new_role;
  end if;
  update public.profiles
  set role = new_role, updated_at = now()
  where id = target_id;
end;
$$;

-- 6. Função admin para suspender/reativar usuário
create or replace function public.admin_toggle_suspend(
  target_id  uuid,
  suspend    boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado.';
  end if;
  update public.profiles
  set suspended_at = case when suspend then now() else null end,
      updated_at = now()
  where id = target_id;
end;
$$;

-- 7. Backfill: o trigger só dispara para contas criadas DEPOIS dele existir.
-- Usuários que já tinham conta (ex.: você mesmo) precisam do perfil criado manualmente aqui.
insert into public.profiles (id, full_name, avatar_url, email)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
  u.raw_user_meta_data->>'avatar_url',
  u.email
from auth.users u
on conflict (id) do nothing;

-- ================================================================
-- PASSO FINAL (manual): defina você mesmo como admin
-- Substitua pelo seu email:
-- update public.profiles set role = 'admin' where email = 'lucastro19@gmail.com';
-- ================================================================
