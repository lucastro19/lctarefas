# LCTarefas

App de gestão de tarefas pessoais (clone do Things 3, com identidade própria) para uso diário. MVP Fase 1 completo e **em uso ativo em produção** — não quebrar funcionalidades existentes.

## Comandos

```bash
npm run dev          # Vite dev server (localhost:5173)
npm run build        # Build de produção (Vite)
npm run lint         # ESLint
npm run preview      # Preview do build
npm run android      # build + cap sync + abre Android Studio (Capacitor)
npm run android:sync # build + cap sync android
```

> `npm run build` pode demorar; se rodar por ferramenta com timeout curto, prefira validar por `npm run lint` ou build em background.

## Stack

- **React 18 + Vite + Tailwind CSS v3** (`darkMode: "class"`)
- **Zustand** para estado (stores em `src/store/`)
- **Supabase** — Auth (Google OAuth) + PostgreSQL com RLS
- **React Router v6**
- **@dnd-kit** (core + sortable + utilities) para drag & drop
- **chrono-node** para datas em linguagem natural (PT)
- **Capacitor** para build Android
- **web-push** + Vercel Serverless para push notifications
- Deploy: push em `main` → deploy automático (repo `github.com/lucastro19/lctarefas`)

## Estrutura

```
src/
├── store/        # Zustand: auth, task, area, tag, settings, selection, ui, template,
│                 #   booking, collaborator
├── pages/        # Uma por rota: Today, Inbox, Upcoming, Someday, Delegadas, Trash, Archive,
│                 #   Logbook, AreaPage, ProjectPage, ColaboradorPage, TagPage, Calendar,
│                 #   Login, Landing, Admin, Book*
├── components/
│   ├── tasks/    # TaskCard, TaskDetail, TimedTaskList, TaskList, NewTaskInput,
│   │             #   BulkActionBar, SortBar, TimeSlotPickerModal, FollowUpPanel
│   ├── delegation/ # shared (avatar/pills/aging), DelegatedRow, DelegationSection,
│   │             #   CollaboratorModal
│   ├── ui/       # Checkbox, Badge, ToastContainer, RecurrenceDeleteModal
│   ├── layout/   # Sidebar, shell
│   ├── search/, settings/, quickentry/
├── lib/          # supabase.js, googleCalendar.js, pushNotifications.js
├── utils/        # timeSlots.js, nlpDate.js, nudge.js
├── hooks/        # usePlanLimits.js
└── services/     # notifications.js
supabase/         # schema.sql + migration_*.sql (rodados no SQL Editor manualmente)
```

## Conceitos de domínio

- **Soft-delete:** tarefas NUNCA são excluídas permanentemente. `deleted_at` marca lixeira; `archived_at` arquivo; `completed_at` conclusão. `active() = !completed_at && !deleted_at && !archived_at`.
- **Toda nova tarefa** nasce com `duration_minutes: 30` por padrão.
- **Períodos do dia** (`src/utils/timeSlots.js`): `getPeriod(time, settings)` retorna `manha` / `almoco` / `tarde` / `noite` / `sem-horario`, usando `settings.lunchStart`, `settings.lunchEnd`, `settings.dayEnd` como divisores. A lista "Hoje" (`TimedTaskList.jsx`) tem bloco "Intervalo" (🍽️ almoço) explícito, oculto quando vazio.
- **Recorrência personalizada:** armazenada em `task.recurrence` como string `"custom:{json}"`, ex.: `custom:{"freq":"weekly","interval":1,"days":[1,3]}`. `getCustomLabel()` (em TaskDetail) faz o parse para exibição. Valores simples: `daily`, `weekdays`, `weekly`, `biweekly`, `monthly`, `annually`.
- **Urgência:** `is_urgent` alimenta o painel "Resolver Primeiro" (todas as urgentes, qualquer data), renderizado ANTES de "Atrasadas" na lista Hoje. Usa `UrgentRow` compacta.
- **Abrir tarefa:** chevron `›` no card abre o `TaskDetail`. `ESC` fecha (modal interno primeiro, depois o painel).
- **Delegação (Fase 1):** colaboradores são *contatos locais* do gestor (tabela `collaborators`,
  sem conta e sem acesso; `linked_user_id` está reservado para a Fase 2). Uma tarefa delegada
  **sai das listas de execução** — `isDelegated(t)` (exportado de `taskStore`) é `!!delegated_to &&
  delegation_status !== 'concluida'`, e todos os `get*` de execução o excluem. Ela reaparece em
  Hoje pelo `FollowUpPanel` quando `follow_up_date <= hoje`. Só o gestor fecha: `acceptDelegatedTask`.
  Cobrança por `wa.me` (`utils/nudge.js`) + resumo diário às 08:00 no cron de push.
- **Organização (Fase 2.0):** camada multi-tenant em construção (`migration_org_foundation.sql`).
  Tabelas `organizations`, `org_members` (com `manager_id` = árvore de reporte), `teams`,
  `team_members`, `demand_types`, `org_invites`. `orgStore.js` gerencia; tela `/organizacao`
  (semente do painel de config da org). Convite = link `/convite/:token` compartilhado manualmente,
  aceito via RPC `accept_org_invite`. **A RLS de `tasks` NÃO foi tocada** — `org_id`/`assignee_id`/
  `demand_type_id` entraram como colunas nullable que nada lê ainda (o roll-up hierárquico é a Fase 2.1).
  Isolamento entre orgs via `is_org_member()` (security definer). Blueprint completo: artifact
  `LCTarefas — Blueprint Fase 2`.

## Convenções e gotchas (aprendidos na prática)

- **NÃO reintroduzir swipe-to-delete/complete no mobile.** O gesto de deslizar cards causava exclusões/conclusões acidentais durante o scroll e foi removido. Ações destrutivas devem ser explícitas (menu `···`, botão, linha dedicada). Long-press para multi-seleção pode permanecer.
- **NÃO usar pull-to-refresh via touch events** no container de scroll — conflita estruturalmente com @dnd-kit no mobile. Usar botão de refresh no header.
- **Períodos: nunca hardcodar limites** (ex.: `tarde: [13,18]`). Um slot "13:00" só é "tarde" se `lunchEnd <= 13:00`, senão `getPeriod` o classifica como `almoco` e a tarefa some da seção esperada. Sempre usar `nextSlotInPeriod(period, periodTasks, settings, defaultDuration)` de `timeSlots.js`, que respeita os settings.
- **Datas sempre em formato LOCAL, não UTC.** Usar helpers `localDateStr()` para evitar bug de timezone em fusos negativos (BR = UTC-3).
- **Modais/portais** renderizados fora do `<aside>` do TaskDetail devem `stopPropagation` nos cliques, senão fecham o painel pai.
- **`fetchTasks` não filtra por `user_id`** — depende 100% da policy `tasks_own` da RLS. Se algum dia
  a policy for alargada (ex.: Fase 2 da delegação, com colaborador vendo a tarefa), é obrigatório
  adicionar `.eq("user_id", user.id)` **antes**, senão todas as views vazam tarefas de terceiros.
- **Delegadas não ocupam slot de horário.** `nextSequentialTime` (taskStore), `bulkMoveToToday` e o
  cálculo de `target === "today"` no `Layout.jsx` filtram `!isDelegated(t)` — sem isso a agenda do dia
  reserva blocos para trabalho que não é seu.
- **Menus flyout aninhados** checam limites da viewport via `getBoundingClientRect()` para não estourar a tela nas laterais.

## Deploy

Após validar mudanças, fazer `git add` / `git commit` / `git push origin main` **automaticamente, sem pedir confirmação**. O push para `main` dispara o deploy de produção.

Mensagens de commit terminam com:
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```
