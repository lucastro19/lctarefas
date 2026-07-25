# Changelog

Todas as mudanças notáveis do LCTarefas ficam registradas aqui. Formato baseado em
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/); versionamento segue
[SemVer](https://semver.org/lang/pt-BR/) (`MAJOR.MINOR.PATCH`).

## [1.0.0] - 2026-07-25

Primeira versão com controle formal de versionamento — marca o fim da Fase 4 (navegação por
trilho + plataforma de equipe completa). Daqui pra frente, cada release ganha uma entrada nova
aqui em vez de só um push silencioso pro `main`.

### Added
- Navegação por trilho de ícones + painel lateral com busca, itens fixados e seções recolhíveis.
- Espaços da organização — contêiner de trabalho compartilhado de verdade, aberto ou com acesso
  controlado.
- Seletor de visão Lista / Board / Linha do tempo em Áreas, Projetos e Espaços, com filtros,
  agrupar por, ordenar por, views salvas e atalho "só minhas".
- Carga de trabalho da equipe, dentro do Cockpit.
- Board / Linha do tempo também em Delegadas.
- Planejamento guiado do dia e organização de horários arrastando tarefas, na tela Hoje.
- Busca (⌘K) com ações rápidas e lugares visitados recentemente.
- Central de notificações.
- Comentários em tarefas delegadas.
- Times e tipos de demanda com uso real nas telas (não só cadastro).
- Cadastro unificado de pessoa — colaborador local e membro da organização deixam de duplicar.
- Inativar (em vez de excluir) membros, times e colaboradores, com opção de reativar.
- QuickEntry (⌘N) com atalhos por texto (`!alta`, `#tag`, `@pessoa`) e fileira de ícones pra
  prazo, prioridade, lembrete, repetição, delegação e reunião.
- Delegação em cadeia com histórico completo e aceite em cascata reversa.
- Aprovação de prorrogação de prazo em tarefas organizacionais.

### Changed
- Painel de detalhe da tarefa reorganizado em 4 blocos (Quando / Importância / Organização /
  Pessoas), agrupando campos por como são usados no dia a dia.

### Fixed
- Ajustes de UX acumulados: edição de prazo e cor de tipo de demanda, fechamento de modais
  empilhados (Escape fechando mais de uma tela de uma vez), badge de duração aparecendo em
  tarefa sem horário.
