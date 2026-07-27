# LCTarefas

Plataforma de gestão de tarefas **pessoais + de equipe**. Começou como clone do Things 3 para uso
pessoal do Lucas e evoluiu para uma plataforma multi-tenant hierárquica usada de verdade, todo dia,
pela equipe da LC Tecnologia.

**Versão atual: v1.0.0** (tag git `v1.0.0`) · **em produção, em uso diário** — não quebrar nada existente.

**Usuários reais hoje:** Lucas Lamounier (dono/admin), Lucas Ruan, Administrativo Maxdata — mais
perfis de família (Gabriela, Tatiana, Davi) sem uso de equipe.

---

## 1. Setup em máquina nova (transferência)

O repositório **não contém** alguns arquivos necessários. Depois de `git clone` + `npm install`:

| Arquivo | Situação | O que fazer |
|---|---|---|
| `.env.local` | **não versionado** (tem chave real) | criar a partir de `.env.example` — é o único passo manual obrigatório |
| `android/` | não versionado | pasta gerada pelo Capacitor; recriável com `npx cap add android` |

`.env.local`:
```
VITE_SUPABASE_URL=https://srzscodpccfapglfxefs.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key do projeto — pegar no painel do Supabase>
```

`capacitor.config.ts` e `.mcp.json` passaram a ser versionados nesta atualização (nenhum dos dois
tem credencial), então na máquina nova já vêm prontos.

> O `.mcp.json` é o que dá ao Claude acesso ao banco. As ferramentas `mcp__supabase__*` só carregam
> em **sessão nova** — se o Claude Code já estiver aberto quando o arquivo aparecer, reinicie.

Variáveis extras (só no Vercel, para as funções serverless): `SUPABASE_SERVICE_ROLE_KEY`,
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, credenciais do Google Calendar.

---

## 2. Comandos

```bash
npm run dev          # Vite dev server (localhost:5173)
npm run build        # Build de produção
npm run lint         # ESLint
npm run preview      # Preview do build
npm run android      # build + cap sync + abre Android Studio
npm run android:sync # build + cap sync android
```

> O projeto tem **débito de lint pré-existente** (~40 erros, quase todos de regras novas do
> `eslint-plugin-react-hooks`: `refs`/`purity`/`set-state-in-effect`). O padrão de trabalho é
> comparar contra a baseline, nunca zerar: `git stash && npx eslint <arquivos> > /tmp/base.txt;
> git stash pop && npx eslint <arquivos> > /tmp/new.txt; diff /tmp/base.txt /tmp/new.txt`.
> Só importa não introduzir problema **novo**.

> `npm run build` demora ~10-15s — rodar em background quando a ferramenta tiver timeout curto.

---

## 3. Stack

- **React 19 + Vite 8 + Tailwind CSS v3** (`darkMode: "class"`)
- **Zustand** — 14 stores em `src/store/`
- **Supabase** — Auth (Google OAuth) + PostgreSQL com RLS + Storage
- **React Router v7**
- **@dnd-kit** (core + sortable + utilities) — drag & drop
- **chrono-node** — datas em linguagem natural (PT)
- **Capacitor 8** — build Android
- **web-push** + Vercel Serverless (`api/`) — push notifications, feed iCal, booking
- Deploy: push em `main` → deploy automático (repo `github.com/lucastro19/lctarefas`)

---

## 4. Estrutura

```
src/
├── store/          # Zustand (14): auth, task, area, tag, settings, selection, ui, template,
│                   #   booking, collaborator, org, notification, devIdeas, qaNotes
├── pages/          # 22 rotas — ver tabela na seção 6
├── components/
│   ├── tasks/      # TaskCard, TaskDetail, TimedTaskList, TaskList, NewTaskInput, BulkActionBar,
│   │               #   SortBar, FilterSortBar, ViewSwitcher, BoardView, TimelineView, DayPlanner,
│   │               #   TimeSlotPlanner, TimeSlotPickerModal, FollowUpPanel
│   ├── delegation/ # shared (avatar/pills/aging/memberDisplayName), DelegatedRow,
│   │               #   DelegationSection, CollaboratorModal, DelegateFollowUpModal
│   ├── layout/     # NavRail (trilho), Sidebar (2º painel), Layout, MobileDrawer/Header/TabBar
│   ├── admin/      # DevIdeasBoard, QaRoteiro  (admin-only)
│   ├── settings/   # SettingsModal, WhatsNewModal
│   ├── ui/, search/, quickentry/
├── data/           # releaseNotes.js (novidades p/ usuário), qaRoteiro.js (roteiro de QA)
├── hooks/          # usePlanLimits, useTaskFilters, useViewMode, useNavPins
├── lib/            # supabase.js, googleCalendar.js, pushNotifications.js
├── utils/          # timeSlots.js, nlpDate.js, nudge.js, recentVisits.js
└── services/       # notifications.js
api/                # Vercel Serverless: push/{cron,subscribe,urgent}, calendar/{feed,token},
                    #   booking/confirm, _lib/calToken
supabase/           # schema.sql + migration_*.sql (aplicadas manualmente / via MCP)
CHANGELOG.md        # técnico, formato Keep a Changelog
```

---

## 5. Banco de dados (27 tabelas, todas com RLS)

**Pessoal:** `tasks`, `subtasks`, `areas`, `projects`, `tags`, `task_tags`, `profiles`

**Delegação:** `collaborators` (contatos locais do gestor), `task_delegations` (histórico de elos
da cadeia), `deadline_extension_requests`

**Organização (multi-tenant):** `organizations`, `org_members` (com `manager_id` = árvore de
reporte), `teams`, `team_members`, `demand_types`, `org_invites`, `spaces`, `space_members`,
`space_teams`

**Colaboração:** `notifications`, `task_comments`

**Infra:** `push_subscriptions`, `booking_profiles`, `availability`, `bookings`

**Admin-only:** `dev_ideas` (backlog de ideias), `qa_notes` (roteiro de QA — progresso/notas/prints)

### Funções `security definer` (o coração do controle de acesso)

Toda visibilidade passa por essas funções, **nunca** por lógica duplicada no client:

- **`is_org_member(org, user)`** — pertence à org (ignora membro desativado)
- **`is_manager_of(manager, report, org)`** — sobe a árvore `manager_id` (roll-up hierárquico)
- **`is_space_member(space, user)`** — acesso a espaço. 3 ramos: espaço aberto → toda a org;
  `space_members` → pessoa específica; **`space_teams` → time inteiro (vínculo vivo: entra/sai do
  time muda o acesso sozinho)**. Dono da org sempre vê.
- **`is_admin()`** — `profiles.role = 'admin'` (só `lucastro19@gmail.com` hoje)
- **`shares_org_with(target)`**, **`sync_task_org_from_space()`** (trigger)

**Policy `tasks_select`** — a mais importante do sistema:
```sql
(user_id = auth.uid())
or (assignee_id = auth.uid())
or (org_id is not null and assignee_id is not null and is_manager_of(auth.uid(), assignee_id, org_id))
or (space_id is not null and is_space_member(space_id, auth.uid()))
```
Escrita (`insert`/`update`/`delete`) continua só do dono/assignee — **ser membro de espaço dá
visibilidade, nunca permissão de edição**.

### RPCs (escrita que precisa de regra de negócio no servidor)

`accept_org_invite`, `create_delegation_link`, `accept_delegation_link`,
`update_delegation_link_status`, `register_delegation_nudge`, `snooze_delegation_followup`,
`cancel_delegation_link`, `request_deadline_extension`, `resolve_deadline_extension`,
`create_notification`, `admin_list_users`, `admin_set_user_role`, `admin_toggle_suspend`

### Storage

Bucket **`qa-screenshots`** (público, path com UUID aleatório) — prints colados nas notas do
roteiro de QA. Insert/select/delete restritos a `is_admin()`. Único uso de Storage no projeto.

---

## 6. Como cada recurso funciona

### Rotas

| Rota | O que é |
|---|---|
| `/today` | **Hoje** — o centro do app (detalhado abaixo) |
| `/inbox` | Tarefas sem contexto nenhum (sem área/projeto/data) |
| `/upcoming` | Em Breve — futuras, agrupadas por data |
| `/someday` | Depois — `someday: true`, sem data |
| `/delegadas` | O que **eu** deleguei, agrupado por pessoa |
| `/colaborador/:id` | Pauta de 1:1 — placar de execução da pessoa |
| `/cockpit` | Roll-up hierárquico da equipe (só leitura) + carga de trabalho + aprovações |
| `/area/:id`, `/project/:id`, `/espaco/:id` | Contêineres, com Lista/Board/Linha do tempo |
| `/tag/:id`, `/calendar`, `/logbook`, `/archive`, `/trash` | Views auxiliares |
| `/organizacao` | Config da org: Membros/Times/Tipos de demanda/Espaços/Configurações |
| `/admin` | Painel admin (3 abas: Usuários, Ideias & Roadmap, Roteiro de QA) |
| `/booking-settings`, `/book/:slug` | Agendamento público de reunião |
| `/convite/:token` | Aceitar convite de organização |

### Navegação (Fase 4.2)

**Trilho escuro (`NavRail`, 64px, desktop)** — logo, módulo Tarefas, 2 slots fantasma (CRM/Projetos,
futuros), sino de notificações, ocultar painel, Calendário, Agendamento, Configurações (com bolinha
quando há novidade não vista), Sair, avatar.

**2º painel (`Sidebar`)** — busca + seção "Fixados" (localStorage) + 4 accordions: Tags, Espaços,
Áreas, Equipe. No mobile o trilho não existe e o `MobileDrawer` renderiza o **mesmo** `Sidebar` —
por isso Calendário/Agendamento continuam **também** na lista do painel (tirar de lá quebraria o
mobile).

### Tela "Hoje" — 4 painéis

1. **🔎 Revisar hoje** (`FollowUpPanel`) — cobranças de delegação vencidas + tarefas com **`deadline`**
   (prazo) vencido. É um **lembrete extra**, proposital: a tarefa continua também onde ela mora.
2. **🔴 Resolver primeiro** — todas com `is_urgent`, de qualquer data.
3. **⚠️ Atrasadas** — `scheduled_date` (data marcada) no passado. **Campo diferente** do painel 1.
4. **Blocos do dia** — Manhã / Intervalo (almoço) / Tarde / Noite / sem horário.

Os painéis 1 e 2 são recolhíveis. Botões no header: **🗓️ Planejar meu dia** (`DayPlanner` — triagem
rápida de atrasadas + Inbox sem data, com Hoje/Amanhã/✕ por linha) e **🕐 Organizar horários**
(`TimeSlotPlanner` — arrastar tarefa sem horário para um slot; `DndContext` isolado, não mexe no DnD
global).

> ⚠️ **Há sobreposição conhecida entre esses painéis** — ver seção 9 (pendências).

### Delegação (o núcleo do uso real)

Dois mundos que se encontram:
- **Colaborador local** (`collaborators`) — contato do gestor, sem conta. Serve pra delegar e cobrar
  por WhatsApp.
- **Membro da org** (`org_members`) — conta real. Quando o e-mail bate, `collaborators.linked_user_id`
  liga os dois e a tarefa **espelha** na lista pessoal do executor.

**Cadeia de delegação (Fase 2.7):** `task_delegations` guarda todos os elos; `tasks` espelha o elo
ativo (`current_delegator_id`/`current_delegation_id`). Aceite cascateia um nível por vez — o
executor final aceita, libera o elo pai, e só o **elo raiz** fecha a tarefa. Redelegar pulando o
gestor direto oferece incluí-lo como observador.

**Regra de ouro:** tarefa delegada em aberto **sai de todas as listas de execução** do gestor
(`isDelegated`) e **não ocupa slot de horário**. Ela reaparece em Hoje pelo `FollowUpPanel` quando
`follow_up_date <= hoje`. Só o gestor fecha (`acceptDelegatedTask`).

**Prorrogação de prazo (Fase 2.8):** em tarefa organizacional, só **adiar** exige aprovação
(antecipar é livre). O aprovador é resolvido **no servidor** (nunca confiado do client): quem delegou
o elo ativo, ou o `manager_id` de quem criou. Sem ninguém para aprovar, o RPC auto-aplica.

### Organização, Espaços e Times

- **Espaço** = contêiner compartilhado real (modelo Bitrix Workgroup / Notion Teamspace). Aberto por
  padrão (toda a org vê); fechado restringe a `space_members` + `space_teams`.
- **Tarefa herda o contexto onde nasce**: criada dentro de um espaço → organizacional (trigger
  sincroniza `org_id` sozinho); criada na área pessoal/Inbox → pessoal. `TaskCard` mostra o selo
  "Org". **Visões ≠ contêineres**: Hoje/Em Breve continuam mostrando pessoal + org juntos.
- **Times vinculados a espaço** — vínculo vivo: todo membro do time herda o acesso, e sair do time
  revoga sozinho.
- **Padrão de inativação** (`archived_at`) em membros/times/tipos de demanda/colaboradores/espaços —
  nunca exclusão real. Botão usa ícone ⏸ (não lixeira).
- **Tipos de demanda** — taxonomia da org, com `default_deadline_hours` que pré-calcula o prazo.

### Cockpit

Roll-up hierárquico, **só leitura** (o gestor não é dono nem assignee — a RLS bloquearia update de
qualquer forma). Mostra tarefas da equipe agrupadas por pessoa, **carga de trabalho** (barra por
pessoa, cor pela *proporção* de atrasadas — nunca volume bruto), pedidos de prorrogação pendentes e
filtro por time.

### Views por página (Fase 4.3–4.5)

Área/Projeto/Espaço/Delegadas têm **Lista / Board / Linha do tempo** (`ViewSwitcher`, preferência em
localStorage). Board agrupa por Status/Pessoa/Tipo — em área pessoal cai para 2 colunas simples
(A fazer/Concluída), já que não existe status de delegação ali. `FilterSortBar` + `useTaskFilters`
dão filtro por pessoa/tipo/atrasadas, "só minhas", ordenação e **views salvas** — tudo client-side
sobre o array já carregado, sem fetch novo.

### Painel Admin (`/admin`, só `is_admin()`)

1. **Usuários** — listar, mudar plano (free/pro/admin), suspender.
2. **Ideias & Roadmap** — backlog de ideias futuras (captura rápida + board por status; campos de
   origem, "melhor momento", notas de pesquisa, versão que entregou). É o "caderno" persistente:
   consultar `dev_ideas` via MCP antes de sugerir próximos passos.
3. **Roteiro de QA** — o roteiro de teste por versão **dentro do app**. Cada passo tem checkbox +
   nota + **colar imagem** (Ctrl+V → sobe pro Storage) + "marcar como corrigido" (grava data e
   comentário). Substituiu o artifact externo.

**Fluxo de QA que o Lucas usa:** ele testa e anota (com prints) → pede "revisar o roteiro" → eu leio
direto via SQL:
```sql
select version_id, group_label, section_title, step_action, notes, images
from public.qa_notes
where done = true and notes <> '' and fixed = false
order by version_id, group_label, section_title, step_index;
```
As imagens estão em bucket público — abro pela URL montada com o `path`. Depois de corrigir, marco
`fixed = true, fixed_at = now(), fixed_comment = '...'`.

### Versionamento

Toda fase nova que vai ao ar exige **3 atualizações**:
1. `CHANGELOG.md` — técnico (Keep a Changelog)
2. `src/data/releaseNotes.js` — mesma coisa em linguagem de usuário (alimenta o "🎉 Novidades" no
   Settings + bolinha no ⚙️ do trilho)
3. `src/data/qaRoteiro.js` — nova entrada em `QA_VERSIONS`, **só com o que mudou/nunca foi testado**

E considerar bump de versão em `package.json` + tag git.

### Outros

- **Planos** (`usePlanLimits`): free = 150 tarefas, 3 áreas, 10 projetos, 10 tags, 2 colaboradores;
  pro/admin = ilimitado.
- **Push** (`api/push/cron.js`, a cada 15min): urgente avisa 15min/5min antes e na hora; normal na
  hora; prazo às 08:00 do dia; resumo matinal às 08:00; resumo diário de cobranças.
- **QuickEntry (Cmd+N)**: fileira de ícones + atalhos por texto (`!alta`, `#tag`, `@Pessoa`) —
  só reconhece tag/pessoa que já existe. O valor do ícone sempre vence o que o texto sugeriu.
- **Command bar (Cmd+K)**: ações + recentes + busca de tarefa com filtros.
- **Agendamento**: link público `/book/:slug`, disponibilidade semanal, cria reunião com Meet.

---

## 7. Convenções e gotchas (aprendidos na prática — não repetir os erros)

- **NÃO reintroduzir swipe-to-delete/complete no mobile.** Causava exclusões acidentais no scroll.
  Ações destrutivas devem ser explícitas. Long-press para multi-seleção pode ficar.
- **NÃO usar pull-to-refresh via touch events** — conflita estruturalmente com @dnd-kit no mobile.
  Usar botão de refresh no header.
- **Datas sempre em formato LOCAL, nunca UTC** — `localDateStr()`. BR é UTC-3; usar UTC quebra o dia.
- **Períodos: nunca hardcodar limites** (ex. `tarde: [13,18]`). Um slot "13:00" só é "tarde" se
  `lunchEnd <= 13:00`. Sempre usar `nextSlotInPeriod(...)` de `timeSlots.js`, que respeita os settings.
- **`fetchTasks` filtra por `user_id`/`assignee_id`** desde a Fase 2.1 — a RLS hoje é ampla
  (roll-up + espaço), então **sem esse filtro as views pessoais vazam tarefa de terceiro**.
  Tarefa de colega vem por fetch separado (`fetchSpaceTasks`, `fetchTeamTasks`), nunca no store pessoal.
- **Delegadas não ocupam slot de horário** — `nextSequentialTime`, `bulkMoveToToday` e o cálculo de
  `target === "today"` no `Layout.jsx` filtram `!isDelegated(t)`.
- **Modais/portais fora do `<aside>` do TaskDetail** devem `stopPropagation` nos cliques.
- **Escape em modais empilhados**: o modal de cima registra o listener em **capture phase**
  (`addEventListener("keydown", fn, true)`), senão um Esc fecha os dois de uma vez.
- **`confirm()` nativo** é o padrão do projeto para ação destrutiva (Trash, Organização, Admin) —
  não criar modal customizado novo sem motivo.
- **Menus flyout aninhados** checam `getBoundingClientRect()` para não estourar a viewport.
- **Ícone de desativar é ⏸, não 🗑** — a ação é reversível.

---

## 8. Ritual de trabalho (seguir sempre)

**Mudança de banco:**
1. `mcp__supabase__apply_migration` (e salvar o `.sql` em `supabase/` como registro)
2. `mcp__supabase__get_advisors({type:"security"})` — só devem aparecer os avisos **já conhecidos**:
   `SECURITY DEFINER` exposto a anon/authenticated (por design), `bookings_public_insert` sempre-true,
   `auth_leaked_password_protection`. **Categoria nova = investigar.**
3. Validar RLS com `mcp__supabase__execute_sql` dentro de `begin; ... rollback;`, simulando usuário
   real:
   ```sql
   set local role authenticated;
   set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
   ```
   Testar sempre o **caso negativo** (quem não pode, não consegue), não só o feliz.
   > Para ver o resultado de vários `select` na mesma transação, junte tudo numa temp table e faça
   > um `select` final — o MCP só retorna o resultado do último comando.

**UUIDs reais para validação:**
- Org: `6d6749f6-62ab-41f8-b4e4-744d7cea1ef6`
- Lucas Lamounier (dono/admin): `6b51ea6b-0d06-4f98-be5a-c64bd0cb42ff`
- Lucas Ruan (membro, role `free`): `fcd6bad5-3a87-4ec3-972d-a1b15c14c7f7`
- Administrativo Maxdata (supervisor): `ca672c5f-b82e-4c87-831e-dc0fc993c1db`

**Mudança de client:** lint contra baseline (`git stash`) → `npm run build` em background →
`git add` **só dos arquivos tocados** (nunca `-A`) → commit → push.

**Fases grandes:** 1 commit por fase, revertível isoladamente. Mockup antes de codar quando a mudança
é visual/estrutural.

---

## 9. Pendências e melhorias em aberto

### Bugs / ajustes conhecidos

- **Sobreposição entre os painéis do Hoje** (análise feita, correção **não** aplicada):
  - "Atrasada" significa **duas coisas diferentes**: em "Revisar hoje"/"Planejar seu dia" é
    `deadline` vencido; no painel "Atrasadas" é `scheduled_date` vencido.
  - Uma tarefa **urgente + atrasada** aparece **duas vezes** na tela (Resolver primeiro + Atrasadas).
  - O "Planejar seu dia" **não cobre** tarefas atrasadas por data marcada nem urgentes sem data —
    só `getReviewToday()` + `getInbox()`. Ou seja, dá pra deixar coisa pra trás.
  - Proposta desenhada (não aprovada): DayPlanner passa a juntar 4 fontes com dedupe e etiqueta de
    motivo; "Atrasadas" para de mostrar o que já está em "Resolver primeiro". Precisa de decisão.
- **Nota de QA em aberto** (`qa_notes`): "Delegação/Reunião está antes de Organização no TaskDetail"
  — o Lucas registrou que **prefere assim**, então não é bug; só falta marcar como resolvido.

### Nunca testado ponta a ponta

O loop completo com 2+ pessoas reais (convite → aceite → `linked_user_id` → delegação → cadeia →
aceite em cascata → aprovação de prazo) **nunca foi validado ao vivo** — só por SQL. Criar conta de
teste esbarra em confirmação de e-mail + rate limit do Supabase.

### Assuntos sinalizados, ainda não iniciados

- **Tutoriais dentro do app** (onboarding) — o Lucas pediu, ficou pra depois.
- **Hora no Prazo** (`deadline` de `date` → `timestamp`) — fecharia o gap com Bitrix/Asana, mas toca
  ~15 arquivos (`deadline_extension_requests` + 2 RPCs, `TimelineView`, `useTaskFilters`,
  estatísticas de pontualidade que fazem `.slice(0,10)`, `notifications.js` que faz
  `deadline.split("-")`, `nudge.js`). Decisão adiada de propósito.
- **DISC + IA de comunicação** (`dev_ideas`): questionário de perfil comportamental por colaborador,
  com IA sugerindo ao gestor como conversar em cada tarefa conforme o perfil. Status: ideia, futuro.
- **Módulos CRM / Projetos** — os 2 slots fantasma no trilho já marcam o lugar. Nada construído.
- **TendiChat** (Frente 2 de dados: atendimentos de suporte via bot do parceiro) — parado desde a
  Fase 2.8, aguardando o contrato da API do parceiro.
- **SaaS vendável** (billing multi-seat) — final do roadmap; `org_id` desde a fundação garante que
  adiar não gera retrabalho de isolamento.

### Reversão importante (não repetir sem perguntar)

O **"Modelo 2"** do painel de tarefa (Prazo em destaque com selo de urgência + chips
Hoje/Amanhã/Fim de semana/Em 1 semana, Início/Agendamento recolhíveis) foi implementado
(`f7d42bd`) e **revertido no mesmo dia** (`fbe0058`) a pedido do Lucas, sem motivo declarado.

Pista provável do motivo, achada depois nas notas de QA: *"os atalhos Fim de semana e Em 1 semana
estão ficando marcados juntos"* — bug real, porque quando hoje é sábado `nextSaturday()` retorna
+7 dias, colidindo com "Em 1 semana". Se o assunto voltar, **perguntar primeiro** o que não
funcionou; a pesquisa de mercado e o mockup continuam válidos, mas a execução foi rejeitada no uso
real.

---

## 10. Deploy

Após validar as mudanças, fazer `git add` / `git commit` / `git push origin main`
**automaticamente, sem pedir confirmação**. Push em `main` dispara o deploy de produção.

Mensagens de commit terminam com a linha de co-autoria do modelo em uso, ex.:
```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
