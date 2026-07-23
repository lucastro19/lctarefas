-- ================================================================
-- ROLLBACK da Fase 2.1 — restaura a RLS original de `tasks`.
-- Execute no SQL Editor se algo der errado com o roll-up.
-- Volta ao comportamento pré-2.1: cada usuário só vê/gerencia
-- as próprias tarefas (policy única `tasks_own`, for all).
-- ================================================================

drop policy if exists "tasks_select" on tasks;
drop policy if exists "tasks_insert" on tasks;
drop policy if exists "tasks_update" on tasks;
drop policy if exists "tasks_delete" on tasks;
drop policy if exists "tasks_own"    on tasks;

create policy "tasks_own" on tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- A função is_manager_of pode ficar; não é usada por nenhuma policy
-- após o rollback. Para removê-la também, descomente:
-- drop function if exists public.is_manager_of(uuid, uuid, uuid);
