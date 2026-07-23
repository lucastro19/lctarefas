-- ================================================================
-- ROLLBACK da Fase 2.3 — restaura RLS/RPC ao estado da Fase 2.1.
-- Execute no SQL Editor se algo der errado com o espelhamento.
-- (Não desfaz vínculos linked_user_id já gravados — inofensivos por si.)
-- ================================================================

-- 1) tasks_update volta a ser só do dono (como na 2.1)
drop policy if exists "tasks_update" on tasks;
create policy "tasks_update" on tasks for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 2) subtasks_own volta a ser só via dono da tarefa
drop policy if exists "subtasks_own" on subtasks;
create policy "subtasks_own" on subtasks for all using (
  exists (select 1 from tasks where tasks.id = subtasks.task_id and tasks.user_id = auth.uid())
);

-- 3) accept_org_invite volta à versão sem o passo de vínculo (2.0)
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
