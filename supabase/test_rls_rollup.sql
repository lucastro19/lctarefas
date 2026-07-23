-- ================================================================
-- TESTE DE VAZAMENTO — Fase 2.1 (roll-up hierárquico)
-- Execute no SQL Editor DEPOIS de rodar migration_rls_rollup.sql.
--
-- Roda numa transação com ROLLBACK no fim: não grava nada de verdade.
-- `session_replication_role = replica` desliga as checagens de FK
-- durante o teste, pra podermos inserir membros/tarefas com UUIDs
-- fictícios sem precisar de usuários reais em auth.users.
--
-- Se algum assert falhar, o bloco levanta exceção com a mensagem —
-- e a transação aborta sozinha. "Sucesso" = ver o NOTICE final.
-- ================================================================

begin;
set local session_replication_role = replica;

-- Árvore de reporte de teste, dentro da org O:
--   E (estratégico, topo)
--   └─ S (supervisor)   reporta a E
--      ├─ M (membro)    reporta a S
--      └─ P (par)        reporta a S
insert into organizations (id, name, owner_id, plan)
values ('aaaaaaaa-0000-0000-0000-000000000000', 'Org Teste',
        'e0000000-0000-0000-0000-000000000000', 'free');

insert into org_members (id, org_id, user_id, role, manager_id) values
  ('0000000e-0000-0000-0000-000000000000',
   'aaaaaaaa-0000-0000-0000-000000000000',
   'e0000000-0000-0000-0000-000000000000', 'estrategico', null),
  ('0000000c-0000-0000-0000-000000000000',
   'aaaaaaaa-0000-0000-0000-000000000000',
   'c0000000-0000-0000-0000-000000000000', 'supervisor',
   '0000000e-0000-0000-0000-000000000000'),
  ('0000000d-0000-0000-0000-000000000000',
   'aaaaaaaa-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000000', 'membro',
   '0000000c-0000-0000-0000-000000000000'),
  ('0000000f-0000-0000-0000-000000000000',
   'aaaaaaaa-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000000', 'membro',
   '0000000c-0000-0000-0000-000000000000');

do $$
declare
  o     uuid := 'aaaaaaaa-0000-0000-0000-000000000000';
  uE    uuid := 'e0000000-0000-0000-0000-000000000000';
  uS    uuid := 'c0000000-0000-0000-0000-000000000000';
  uM    uuid := 'd0000000-0000-0000-0000-000000000000';
  uP    uuid := 'f0000000-0000-0000-0000-000000000000';
  other uuid := 'bbbbbbbb-0000-0000-0000-000000000000'; -- org onde ninguém é membro
begin
  -- Gestor VÊ subordinado direto e indireto
  assert public.is_manager_of(uS, uM, o) = true,  'FALHOU: supervisor deveria ser gestor do membro (direto)';
  assert public.is_manager_of(uE, uM, o) = true,  'FALHOU: estratégico deveria ser gestor do membro (indireto)';
  assert public.is_manager_of(uE, uS, o) = true,  'FALHOU: estratégico deveria ser gestor do supervisor (direto)';

  -- Subordinado NÃO vê gestor
  assert public.is_manager_of(uM, uS, o) = false, 'FALHOU: membro NÃO pode ser gestor do supervisor';
  assert public.is_manager_of(uM, uE, o) = false, 'FALHOU: membro NÃO pode ser gestor do estratégico';

  -- Par NÃO vê par
  assert public.is_manager_of(uP, uM, o) = false, 'FALHOU: par NÃO pode ser gestor de par';
  assert public.is_manager_of(uM, uP, o) = false, 'FALHOU: par NÃO pode ser gestor de par (inverso)';

  -- Ninguém é gestor de si mesmo
  assert public.is_manager_of(uM, uM, o) = false, 'FALHOU: ninguém é gestor de si mesmo';
  assert public.is_manager_of(uE, uE, o) = false, 'FALHOU: ninguém é gestor de si mesmo (topo)';

  -- Isolamento por org: a mesma relação em OUTRA org não vale
  assert public.is_manager_of(uE, uM, other) = false, 'FALHOU: relação não pode valer em org onde não são membros';

  raise notice '✅ TODOS OS ASSERTS DE is_manager_of PASSARAM';
end $$;

rollback;

-- ================================================================
-- CHECKLIST — teste completo da POLICY (precisa de 2 usuários reais)
-- A função acima cobre a lógica do roll-up; a policy `tasks_select`
-- soma o gate `org_id is not null`. Para validar ponta a ponta:
--
-- 1. Com o usuário GESTOR: crie uma org, convide um MEMBRO, e faça o
--    membro aceitar (fluxo /convite/:token).
-- 2. Como o MEMBRO, crie uma tarefa PESSOAL (org_id nulo) e uma tarefa
--    CORPORATIVA. Como ainda não há UI que preencha org_id/assignee_id
--    (isso é a Fase 2.3), simule no SQL Editor logado como o membro:
--       update tasks set org_id = '<org>', assignee_id = '<uid_membro>'
--       where id = '<tarefa_corporativa>';
-- 3. Como o GESTOR, rode:
--       select id, title, org_id from tasks;
--    ESPERADO: aparece a tarefa CORPORATIVA do membro; NÃO aparece a
--    PESSOAL (org_id nulo).
-- 4. Confirme que o app pessoal do GESTOR (Hoje/Inbox) NÃO passou a
--    mostrar a tarefa do membro — a blindagem do fetchTasks/realtime
--    (taskStore.js) mantém as views pessoais só com as tarefas dele.
-- ================================================================
