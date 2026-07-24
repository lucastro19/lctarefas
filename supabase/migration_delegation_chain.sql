-- ================================================================
-- FASE 2.7 — Redelegação em cadeia (elos de delegação)
--
-- `tasks` continua com os mesmos campos de sempre, agora como espelho
-- do ELO ATIVO da cadeia (evita reescrever TaskCard/Delegadas/
-- ColaboradorPage/Cockpit, que só sabem ler campos escalares).
-- `task_delegations` é a fonte de verdade do histórico completo.
-- Toda escrita passa pelas funções security definer abaixo — sem
-- policy de insert/update/delete pro client, porque os invariantes
-- (um elo aberto por tarefa, cascata de aceite) exigem lock de linha
-- e checagens cruzadas que RLS por linha não expressa com segurança.
-- ================================================================

create table if not exists public.task_delegations (
  id                      uuid primary key default gen_random_uuid(),
  task_id                 uuid not null references public.tasks(id) on delete cascade,
  chain_position          integer not null check (chain_position >= 1),
  delegator_id            uuid not null references auth.users(id),
  collaborator_id         uuid not null references public.collaborators(id) on delete restrict,
  assignee_user_id        uuid references auth.users(id) on delete set null,
  org_id                  uuid references public.organizations(id) on delete set null,
  status                  text not null default 'pendente'
                            check (status in ('pendente','em_andamento','aguardando_aceite',
                                               'bloqueada','concluida','redelegada')),
  follow_up_date          date,
  note                    text,
  nudge_count             integer not null default 0,
  last_nudge_at           timestamptz,
  delegated_at            timestamptz not null default now(),
  accepted_at             timestamptz,
  last_update_at          timestamptz default now(),
  created_at              timestamptz not null default now(),
  watcher_collaborator_id uuid references public.collaborators(id) on delete set null,
  watcher_user_id         uuid references auth.users(id) on delete set null,
  unique (task_id, chain_position)
);

create unique index if not exists task_delegations_one_open_idx
  on public.task_delegations (task_id) where status not in ('concluida', 'redelegada');
create index if not exists task_delegations_task_idx      on public.task_delegations(task_id);
create index if not exists task_delegations_delegator_idx on public.task_delegations(delegator_id);
create index if not exists task_delegations_assignee_idx  on public.task_delegations(assignee_user_id);
create index if not exists task_delegations_watcher_idx   on public.task_delegations(watcher_user_id);

alter table public.tasks
  add column if not exists current_delegator_id  uuid references auth.users(id) on delete set null,
  add column if not exists current_delegation_id uuid references public.task_delegations(id) on delete set null;

create index if not exists tasks_current_delegation_idx on public.tasks(current_delegation_id);

alter table public.task_delegations enable row level security;

create policy "task_delegations_select" on public.task_delegations for select using (
  exists (
    select 1 from public.tasks t
    where t.id = task_delegations.task_id
      and (t.user_id = auth.uid() or t.assignee_id = auth.uid()
           or (t.org_id is not null and t.assignee_id is not null
               and public.is_manager_of(auth.uid(), t.assignee_id, t.org_id)))
  )
  or delegator_id = auth.uid() or assignee_user_id = auth.uid() or watcher_user_id = auth.uid()
);

-- ----------------------------------------------------------------
-- RPC: criar elo (1ª delegação e toda redelegação)
-- ----------------------------------------------------------------
create or replace function public.create_delegation_link(
  p_task_id                 uuid,
  p_collaborator_id         uuid,
  p_follow_up_date          date default null,
  p_note                    text default null,
  p_watcher_collaborator_id uuid default null
)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task           tasks%rowtype;
  v_collab         collaborators%rowtype;
  v_watcher        collaborators%rowtype;
  v_expected_from  uuid;
  v_next_position  integer;
  v_caller_org     uuid;
  v_new_id         uuid;
  v_follow_up      date := coalesce(p_follow_up_date, (current_date + 3));
  v_now            timestamptz := now();
begin
  select * into v_task from tasks where id = p_task_id and deleted_at is null for update;
  if v_task.id is null then
    raise exception 'Tarefa não encontrada.';
  end if;

  if v_task.delegation_status = 'aguardando_aceite' then
    raise exception 'Aceite ou rejeite a conclusão atual antes de redelegar.';
  end if;

  v_expected_from := coalesce(v_task.assignee_id, v_task.user_id);
  if v_task.delegated_to is null then
    if v_task.user_id <> auth.uid() then
      raise exception 'Só o dono da tarefa pode iniciar uma delegação.';
    end if;
  elsif v_expected_from <> auth.uid() then
    raise exception 'Só o executor atual pode redelegar esta tarefa.';
  end if;

  select * into v_collab from collaborators
    where id = p_collaborator_id and user_id = auth.uid() and deleted_at is null;
  if v_collab.id is null then
    raise exception 'Colaborador inválido.';
  end if;

  if p_watcher_collaborator_id is not null then
    select * into v_watcher from collaborators
      where id = p_watcher_collaborator_id and user_id = auth.uid() and deleted_at is null;
    if v_watcher.id is null then
      raise exception 'Observador inválido.';
    end if;
  end if;

  -- Trava as linhas existentes desta tarefa (sem agregação, FOR UPDATE não
  -- é permitido junto de max()) e só então calcula a próxima posição.
  perform 1 from task_delegations where task_id = p_task_id for update;
  select coalesce(max(chain_position), 0) into v_next_position
    from task_delegations where task_id = p_task_id;
  v_next_position := v_next_position + 1;

  -- Redelegar pro mesmo colaborador do elo aberto: só atualiza prazo/nota,
  -- não infla a cadeia com cliques redundantes.
  if v_next_position > 1 and v_task.delegated_to = p_collaborator_id
     and v_task.delegation_status not in ('concluida') then
    update task_delegations
       set follow_up_date = v_follow_up, note = coalesce(p_note, note), last_update_at = v_now
     where task_id = p_task_id and chain_position = v_next_position - 1;

    update tasks set
      follow_up_date  = v_follow_up,
      delegation_note = coalesce(p_note, delegation_note),
      last_update_at  = v_now
    where id = p_task_id
    returning * into v_task;

    return v_task;
  end if;

  select org_id into v_caller_org from org_members where user_id = auth.uid() order by created_at limit 1;

  update task_delegations
     set status = 'redelegada', last_update_at = v_now
   where task_id = p_task_id and chain_position = v_next_position - 1;

  insert into task_delegations (
    task_id, chain_position, delegator_id, collaborator_id, assignee_user_id,
    org_id, status, follow_up_date, note, delegated_at, last_update_at,
    watcher_collaborator_id, watcher_user_id
  ) values (
    p_task_id, v_next_position, auth.uid(), p_collaborator_id,
    case when v_collab.linked_user_id is not null and v_caller_org is not null
         then v_collab.linked_user_id end,
    v_caller_org, 'pendente', v_follow_up, p_note, v_now, v_now,
    p_watcher_collaborator_id,
    case when v_watcher.id is not null then v_watcher.linked_user_id end
  ) returning id into v_new_id;

  update tasks set
    delegated_to          = p_collaborator_id,
    delegated_at           = v_now,
    delegation_status      = 'pendente',
    follow_up_date         = v_follow_up,
    delegation_note        = p_note,
    last_update_at         = v_now,
    nudge_count            = 0,
    last_nudge_at          = null,
    assignee_id            = case when v_collab.linked_user_id is not null and v_caller_org is not null
                                   then v_collab.linked_user_id end,
    org_id                 = case when v_collab.linked_user_id is not null and v_caller_org is not null
                                   then v_caller_org end,
    current_delegator_id   = auth.uid(),
    current_delegation_id  = v_new_id,
    scheduled_date         = null,
    scheduled_time         = null,
    someday                = false
  where id = p_task_id
  returning * into v_task;

  return v_task;
end;
$$;
revoke all on function public.create_delegation_link(uuid,uuid,date,text,uuid) from public;
grant execute on function public.create_delegation_link(uuid,uuid,date,text,uuid) to authenticated;

-- ----------------------------------------------------------------
-- RPC: aceite em cascata reversa — um nível por vez, até fechar a
-- tarefa de vez quando o delegador original (elo raiz) aceita.
-- ----------------------------------------------------------------
create or replace function public.accept_delegation_link(p_delegation_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link   task_delegations%rowtype;
  v_task   tasks%rowtype;
  v_parent task_delegations%rowtype;
  v_now    timestamptz := now();
begin
  select * into v_link from task_delegations where id = p_delegation_id for update;
  if v_link.id is null then
    raise exception 'Elo de delegação não encontrado.';
  end if;

  select * into v_task from tasks where id = v_link.task_id for update;
  if v_task.id is null then
    raise exception 'Tarefa não encontrada.';
  end if;

  if v_task.current_delegation_id is distinct from v_link.id then
    raise exception 'Este elo não é mais o elo ativo da cadeia.';
  end if;
  if v_link.delegator_id <> auth.uid() then
    raise exception 'Só quem delegou este elo pode aceitá-lo.';
  end if;
  -- Não exige status = 'aguardando_aceite': o delegador precisa poder aceitar
  -- a qualquer momento (comportamento de sempre), essencial pra colaborador
  -- local sem conta, que nunca consegue se auto-marcar como aguardando.
  if v_link.status in ('concluida', 'redelegada') then
    raise exception 'Este elo já foi encerrado.';
  end if;

  update task_delegations
     set status = 'concluida', accepted_at = v_now, last_update_at = v_now
   where id = v_link.id;

  select * into v_parent from task_delegations
    where task_id = v_link.task_id and chain_position = v_link.chain_position - 1
    for update;

  if v_parent.id is not null then
    update task_delegations
       set status = 'aguardando_aceite', last_update_at = v_now
     where id = v_parent.id;

    update tasks set
      delegated_to          = v_parent.collaborator_id,
      delegation_status      = 'aguardando_aceite',
      assignee_id            = v_parent.assignee_user_id,
      current_delegator_id   = v_parent.delegator_id,
      current_delegation_id  = v_parent.id,
      last_update_at         = v_now
    where id = v_task.id
    returning * into v_task;
  else
    update tasks set
      delegation_status = 'concluida',
      completed_at        = v_now,
      last_update_at       = v_now
    where id = v_task.id
    returning * into v_task;
  end if;

  return v_task;
end;
$$;
revoke all on function public.accept_delegation_link(uuid) from public;
grant execute on function public.accept_delegation_link(uuid) to authenticated;

-- ----------------------------------------------------------------
-- RPC: atualiza o status do elo ativo — equivalente ao
-- setDelegationStatus/completeAssignedTask de hoje. Permite tanto o
-- executor atual (marcando o próprio progresso) quanto o delegador do
-- elo (que também gerencia status manualmente, inclusive pra
-- colaborador local sem conta — nesse caso não existe
-- assignee_user_id nenhum, só o delegador pode agir).
-- ----------------------------------------------------------------
create or replace function public.update_delegation_link_status(p_delegation_id uuid, p_status text)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link task_delegations%rowtype;
  v_task tasks%rowtype;
begin
  if p_status not in ('pendente', 'em_andamento', 'bloqueada', 'aguardando_aceite') then
    raise exception 'Status inválido para esta operação.';
  end if;

  select * into v_link from task_delegations where id = p_delegation_id for update;
  if v_link.id is null then raise exception 'Elo não encontrado.'; end if;

  select * into v_task from tasks where id = v_link.task_id for update;
  if v_task.current_delegation_id is distinct from v_link.id then
    raise exception 'Este elo não é mais o elo ativo.';
  end if;
  if auth.uid() is distinct from v_link.delegator_id and auth.uid() is distinct from v_link.assignee_user_id then
    raise exception 'Só quem delegou ou o executor atual pode atualizar este status.';
  end if;

  update task_delegations set status = p_status, last_update_at = now() where id = v_link.id;
  update tasks set delegation_status = p_status, last_update_at = now() where id = v_task.id
    returning * into v_task;

  return v_task;
end;
$$;
revoke all on function public.update_delegation_link_status(uuid,text) from public;
grant execute on function public.update_delegation_link_status(uuid,text) to authenticated;

-- ----------------------------------------------------------------
-- RPC: delegador do elo ativo registra uma cobrança
-- ----------------------------------------------------------------
create or replace function public.register_delegation_nudge(p_delegation_id uuid, p_next_follow_up date default null)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link task_delegations%rowtype;
  v_task tasks%rowtype;
  v_now  timestamptz := now();
begin
  select * into v_link from task_delegations where id = p_delegation_id for update;
  if v_link.id is null then raise exception 'Elo não encontrado.'; end if;

  select * into v_task from tasks where id = v_link.task_id for update;
  if v_task.current_delegation_id is distinct from v_link.id then
    raise exception 'Este elo não é mais o elo ativo.';
  end if;
  if v_link.delegator_id <> auth.uid() then
    raise exception 'Só quem delegou este elo pode cobrar por ele.';
  end if;

  update task_delegations set
    nudge_count = nudge_count + 1,
    last_nudge_at = v_now,
    follow_up_date = coalesce(p_next_follow_up, follow_up_date),
    last_update_at = v_now
  where id = v_link.id;

  update tasks set
    nudge_count = nudge_count + 1,
    last_nudge_at = v_now,
    follow_up_date = coalesce(p_next_follow_up, follow_up_date),
    last_update_at = v_now
  where id = v_task.id
  returning * into v_task;

  return v_task;
end;
$$;
revoke all on function public.register_delegation_nudge(uuid,date) from public;
grant execute on function public.register_delegation_nudge(uuid,date) to authenticated;

-- ----------------------------------------------------------------
-- RPC: delegador do elo ativo adia a próxima cobrança
-- ----------------------------------------------------------------
create or replace function public.snooze_delegation_followup(p_delegation_id uuid, p_days integer)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link task_delegations%rowtype;
  v_task tasks%rowtype;
  v_next date := current_date + p_days;
  v_now  timestamptz := now();
begin
  select * into v_link from task_delegations where id = p_delegation_id for update;
  if v_link.id is null then raise exception 'Elo não encontrado.'; end if;

  select * into v_task from tasks where id = v_link.task_id for update;
  if v_task.current_delegation_id is distinct from v_link.id then
    raise exception 'Este elo não é mais o elo ativo.';
  end if;
  if v_link.delegator_id <> auth.uid() then
    raise exception 'Só quem delegou este elo pode adiar a cobrança.';
  end if;

  update task_delegations set follow_up_date = v_next, last_update_at = v_now where id = v_link.id;
  update tasks set follow_up_date = v_next, last_update_at = v_now where id = v_task.id
    returning * into v_task;

  return v_task;
end;
$$;
revoke all on function public.snooze_delegation_followup(uuid,integer) from public;
grant execute on function public.snooze_delegation_followup(uuid,integer) to authenticated;

-- ----------------------------------------------------------------
-- RPC: cancela a delegação (equivalente ao "undelegate" de hoje) — só
-- quando é o ÚNICO elo da cadeia (chain_position = 1) e ainda não teve
-- nenhuma atividade. Redelegações intermediárias não são canceláveis
-- no MVP — por design, para não recriar a complexidade que o "desfazer"
-- de uma redelegação exigiria (não sabemos pra que status voltar um
-- elo intermediário sem guardar histórico de status por elo).
-- ----------------------------------------------------------------
create or replace function public.cancel_delegation_link(p_task_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link task_delegations%rowtype;
  v_task tasks%rowtype;
  v_now  timestamptz := now();
begin
  select * into v_task from tasks where id = p_task_id for update;
  if v_task.id is null then raise exception 'Tarefa não encontrada.'; end if;

  select * into v_link from task_delegations where id = v_task.current_delegation_id for update;
  if v_link.id is null then raise exception 'Não há delegação ativa nesta tarefa.'; end if;
  if v_link.chain_position <> 1 then
    raise exception 'Só é possível cancelar a delegação original — esta tarefa já foi redelegada.';
  end if;
  if v_link.delegator_id <> auth.uid() then
    raise exception 'Só quem delegou pode cancelar.';
  end if;

  delete from task_delegations where id = v_link.id;

  update tasks set
    delegated_to = null, delegated_at = null, delegation_status = null, follow_up_date = null,
    delegation_note = null, last_update_at = null, nudge_count = 0, last_nudge_at = null,
    assignee_id = null, org_id = null, current_delegator_id = null, current_delegation_id = null
  where id = p_task_id
  returning * into v_task;

  return v_task;
end;
$$;
revoke all on function public.cancel_delegation_link(uuid) from public;
grant execute on function public.cancel_delegation_link(uuid) to authenticated;
