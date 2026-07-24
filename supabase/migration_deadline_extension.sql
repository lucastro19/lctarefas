-- ================================================================
-- FASE 2.8 — Aprovação de prorrogação de prazo
--
-- Só ADIAR o prazo de uma tarefa organizacional exige aprovação
-- (antecipar continua livre). Aprovador é resolvido no servidor, nunca
-- confiado do client, pra não abrir brecha de auto-aprovação: quem
-- delegou o elo ativo (task_delegations via tasks.current_delegator_id)
-- ou o manager_id direto de quem criou a tarefa (tarefa autocriada numa
-- área organizacional). Se não há ninguém pra aprovar (ex.: criador sem
-- gestor definido ainda), o pedido é auto-aplicado — a aprovação existe
-- pra ter acompanhamento, não pra travar o app quando a hierarquia
-- ainda não foi configurada.
--
-- `tasks.pending_deadline_extension_id` espelha o pedido pendente ativo
-- (mesmo padrão do `current_delegation_id` da Fase 2.7) — TaskDetail lê
-- direto da tarefa pra mostrar o selo "aguardando aprovação", sem fetch
-- separado.
-- ================================================================

create table if not exists public.deadline_extension_requests (
  id                  uuid primary key default gen_random_uuid(),
  task_id             uuid not null references public.tasks(id) on delete cascade,
  requested_by        uuid not null references auth.users(id),
  approver_id         uuid not null references auth.users(id),
  current_deadline    date not null,
  requested_deadline  date not null,
  status              text not null default 'pendente' check (status in ('pendente','aprovado','recusado')),
  reason              text,
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz
);

create index if not exists deadline_ext_task_idx     on public.deadline_extension_requests(task_id);
create index if not exists deadline_ext_approver_idx on public.deadline_extension_requests(approver_id) where status = 'pendente';

alter table public.tasks
  add column if not exists pending_deadline_extension_id uuid references public.deadline_extension_requests(id) on delete set null;

alter table public.deadline_extension_requests enable row level security;

create policy "deadline_ext_select" on public.deadline_extension_requests for select using (
  requested_by = auth.uid() or approver_id = auth.uid()
);
-- Sem policy de insert/update para authenticated — só via RPCs abaixo.

-- ----------------------------------------------------------------
-- request_deadline_extension: cria o pedido (ou aplica direto se não
-- há aprovador resolvível). Chamado por quem é dono OU executor atual
-- da tarefa.
-- ----------------------------------------------------------------
create or replace function public.request_deadline_extension(
  p_task_id uuid,
  p_requested_deadline date,
  p_reason text default null
) returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task            public.tasks;
  v_creator_member  public.org_members;
  v_manager_member  public.org_members;
  v_approver_id     uuid;
  v_request_id      uuid;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if v_task is null then
    raise exception 'Tarefa não encontrada';
  end if;
  if v_task.user_id is distinct from auth.uid() and v_task.assignee_id is distinct from auth.uid() then
    raise exception 'Sem permissão para alterar o prazo desta tarefa';
  end if;
  if v_task.pending_deadline_extension_id is not null then
    raise exception 'Já existe um pedido de prorrogação pendente para esta tarefa';
  end if;
  if p_requested_deadline <= coalesce(v_task.deadline, p_requested_deadline - 1) then
    raise exception 'Esta função só trata adiamento de prazo';
  end if;

  -- Aprovador: quem delegou o elo ativo, senão o gestor direto de quem criou.
  if v_task.current_delegator_id is not null then
    v_approver_id := v_task.current_delegator_id;
  else
    select * into v_creator_member from public.org_members
      where user_id = v_task.user_id and org_id = v_task.org_id;
    if v_creator_member.manager_id is not null then
      select * into v_manager_member from public.org_members where id = v_creator_member.manager_id;
      v_approver_id := v_manager_member.user_id;
    end if;
  end if;

  if v_approver_id is null or v_approver_id = auth.uid() then
    -- Ninguém pra aprovar (ou o próprio solicitante seria o aprovador,
    -- o que nunca deve resultar em auto-aprovação) — aplica direto e
    -- registra o pedido já resolvido, só pra manter o histórico.
    update public.tasks set deadline = p_requested_deadline where id = p_task_id;
    insert into public.deadline_extension_requests
      (task_id, requested_by, approver_id, current_deadline, requested_deadline, status, reason, resolved_at)
    values
      (p_task_id, auth.uid(), auth.uid(), coalesce(v_task.deadline, p_requested_deadline), p_requested_deadline, 'aprovado', p_reason, now());
  else
    insert into public.deadline_extension_requests
      (task_id, requested_by, approver_id, current_deadline, requested_deadline, status, reason)
    values
      (p_task_id, auth.uid(), v_approver_id, v_task.deadline, p_requested_deadline, 'pendente', p_reason)
    returning id into v_request_id;
    update public.tasks set pending_deadline_extension_id = v_request_id where id = p_task_id;
  end if;

  select * into v_task from public.tasks where id = p_task_id;
  return v_task;
end;
$$;

-- ----------------------------------------------------------------
-- resolve_deadline_extension: só o aprovador resolvido no request
-- pode chamar. Aprova aplica o novo prazo; recusa mantém o original.
-- ----------------------------------------------------------------
create or replace function public.resolve_deadline_extension(
  p_request_id uuid,
  p_approve boolean
) returns public.deadline_extension_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.deadline_extension_requests;
begin
  select * into v_req from public.deadline_extension_requests where id = p_request_id for update;
  if v_req is null then
    raise exception 'Pedido não encontrado';
  end if;
  if v_req.approver_id <> auth.uid() then
    raise exception 'Sem permissão para resolver este pedido';
  end if;
  if v_req.status <> 'pendente' then
    raise exception 'Pedido já resolvido';
  end if;

  if p_approve then
    update public.tasks set deadline = v_req.requested_deadline, pending_deadline_extension_id = null where id = v_req.task_id;
    update public.deadline_extension_requests set status = 'aprovado', resolved_at = now() where id = p_request_id
      returning * into v_req;
  else
    update public.tasks set pending_deadline_extension_id = null where id = v_req.task_id;
    update public.deadline_extension_requests set status = 'recusado', resolved_at = now() where id = p_request_id
      returning * into v_req;
  end if;

  return v_req;
end;
$$;

revoke all on function public.request_deadline_extension from public;
revoke all on function public.resolve_deadline_extension from public;
grant execute on function public.request_deadline_extension to authenticated;
grant execute on function public.resolve_deadline_extension to authenticated;
