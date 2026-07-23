-- ================================================================
-- FASE 2.3 — Colaborador vinculado → tarefa espelhada
-- Execute no SQL Editor do Supabase (depois da 2.1).
--
-- 1) Aceitar convite passa a VINCULAR os contatos (collaborators) que
--    casam por e-mail com o convidado, dentro da org — assim delegar
--    para esse contato preenche assignee_id e a tarefa espelha na
--    lista pessoal do executor.
-- 2) O EXECUTOR (assignee) ganha UPDATE na própria tarefa atribuída.
-- 3) O EXECUTOR passa a enxergar as subtarefas da tarefa atribuída.
-- ================================================================

-- ----------------------------------------------------------------
-- 1) accept_org_invite: mesmo corpo da 2.0 + passo de vínculo.
-- ----------------------------------------------------------------
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

  -- NOVO: vincula os contatos locais que casam por e-mail, dentro da org.
  -- Contatos são de outros usuários (os gestores) — só passa por ser
  -- security definer (o cliente não conseguiria, pela policy collaborators_own).
  update collaborators c
     set linked_user_id = auth.uid()
   where lower(c.email) = lower(v_email)
     and c.linked_user_id is null
     and exists (
       select 1 from org_members m
       where m.org_id = v_invite.org_id and m.user_id = c.user_id
     );

  return v_invite.org_id;
end;
$$;

-- ----------------------------------------------------------------
-- 2) tasks_update: dono OU executor podem atualizar.
--    (insert/delete continuam só do dono; select já cobre o executor
--    desde a 2.1.)
-- ----------------------------------------------------------------
drop policy if exists "tasks_update" on tasks;
create policy "tasks_update" on tasks for update
  using (user_id = auth.uid() or assignee_id = auth.uid())
  with check (user_id = auth.uid() or assignee_id = auth.uid());

-- ----------------------------------------------------------------
-- 3) subtasks_own: dono da tarefa OU executor enxergam/gerenciam.
-- ----------------------------------------------------------------
drop policy if exists "subtasks_own" on subtasks;
create policy "subtasks_own" on subtasks for all using (
  exists (
    select 1 from tasks
    where tasks.id = subtasks.task_id
      and (tasks.user_id = auth.uid() or tasks.assignee_id = auth.uid())
  )
);
