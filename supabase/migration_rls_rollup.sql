-- ================================================================
-- FASE 2.1 — Roll-up hierárquico na RLS de `tasks`
-- Execute no SQL Editor do Supabase.
--
-- O QUE MUDA: um gestor passa a poder LER as tarefas CORPORATIVAS
-- (org_id preenchido) de quem reporta a ele, direta ou indiretamente,
-- pela árvore `org_members.manager_id`. Tarefa pessoal (org_id nulo)
-- NUNCA entra no roll-up. Modificar (insert/update/delete) continua
-- exclusivo do dono da tarefa.
--
-- SEGURANÇA: hoje nenhuma tarefa tem org_id/assignee_id preenchido,
-- então a cláusula de roll-up não casa com nada — o comportamento
-- pessoal permanece idêntico. Rollback disponível em
-- migration_rls_rollup_rollback.sql.
-- ================================================================

-- ----------------------------------------------------------------
-- Função: "sou gestor (ancestral na árvore) deste subordinado?"
-- Caminha manager_id de baixo pra cima, dentro da mesma org.
-- security definer para não recursar na RLS de org_members.
-- ----------------------------------------------------------------
create or replace function public.is_manager_of(
  manager_uid uuid,
  report_uid  uuid,
  org         uuid
)
returns boolean language sql stable security definer set search_path = public
as $$
  with recursive chain as (
    -- membro (subordinado) na org alvo
    select m.id, m.user_id, m.manager_id
    from org_members m
    where m.user_id = report_uid and m.org_id = org
    union all
    -- sobe um nível na árvore de reporte
    select p.id, p.user_id, p.manager_id
    from org_members p
    join chain c on p.id = c.manager_id
  )
  select exists (
    select 1 from chain
    where user_id = manager_uid
      and user_id <> report_uid   -- não é gestor de si mesmo
  );
$$;

-- ----------------------------------------------------------------
-- RLS de tasks: troca a policy única `tasks_own` (for all) por
-- policies explícitas por comando. SELECT ganha o roll-up; as demais
-- continuam restritas ao dono.
-- ----------------------------------------------------------------
drop policy if exists "tasks_own"    on tasks;
drop policy if exists "tasks_select" on tasks;
drop policy if exists "tasks_insert" on tasks;
drop policy if exists "tasks_update" on tasks;
drop policy if exists "tasks_delete" on tasks;

create policy "tasks_select" on tasks for select using (
  user_id = auth.uid()
  or assignee_id = auth.uid()
  or (
    org_id is not null
    and assignee_id is not null
    and public.is_manager_of(auth.uid(), assignee_id, org_id)
  )
);

create policy "tasks_insert" on tasks for insert
  with check (user_id = auth.uid());

create policy "tasks_update" on tasks for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "tasks_delete" on tasks for delete
  using (user_id = auth.uid());
