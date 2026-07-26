// Conteúdo do roteiro de QA, portado do antigo artifact externo (scratchpad/roteiro-teste-v1.html)
// pra dentro do app. Nova versão = nova entrada aqui quando uma fase for ao ar (só com o que
// mudou/nunca foi testado). O estado (done/notes/imagens/fixed) vive em `qa_notes` no Supabase,
// não aqui — isto é só o roteiro em si (ação/esperado), igual releaseNotes.js é só o texto.
export const QA_VERSIONS = [
  {
    id: "v1.0.0",
    label: "v1.0.0",
    date: "25/07/2026",
    summary: "Primeira versão com controle formal — cobre tudo que existe até aqui, do cadastro básico às novidades da Fase 4 (trilho de navegação, views por página, notificações, comentários).",
    groups: [
      { id: "cadastros", label: "Cadastros", sections: [
        { id: "cad-tarefas", title: "Tarefas", why: "Cobre todos os campos, incluindo o painel reorganizado em 4 blocos.", steps: [
          { a: "Crie uma tarefa pela Inbox só com título.", e: "Aparece na Inbox, sem outro campo preenchido." },
          { a: "Abra o painel de detalhe e confira a ordem dos blocos.", e: "Nessa ordem: Quando, Importância, Organização, Delegação/Reunião." },
          { a: "No bloco Quando, marque um Prazo.", e: "Aparece um card de urgência no topo (cor muda conforme a proximidade: vermelho/laranja/amarelo) com atalhos Hoje/Amanhã/Fim de semana/Em 1 semana." },
          { a: "Clique em 'Início' (vem recolhido) e escolha uma data pelos atalhos Hoje/Amanhã/Prox. seg.", e: "Expande ao clicar; ao recolher de novo, o resumo mostra 'Início: {data}'." },
          { a: "Clique em 'Agendar horário/repetição' e preencha Horário e Duração.", e: "Duração só aparece depois que Horário está definido; ao recolher, o resumo mostra horário e duração numa linha só." },
          { a: "Numa tarefa organizacional com prazo, tente adiar a data usando os chips de atalho (não o campo manual).", e: "Pede aprovação igual quando editado manualmente — chip não pula a regra." },
          { a: "No bloco Importância, marque Urgente e escolha Prioridade Alta.", e: "Badge correspondente aparece no card da lista." },
          { a: "No bloco Organização, mova a tarefa pra uma Área e adicione uma Tag.", e: "Contexto e tag aparecem como badges separadas no card." },
          { a: "Adicione 2 itens no Checklist e marque 1 como concluído.", e: "Contador mostra 1/2 no cabeçalho do checklist." }
        ]},
        { id: "cad-areas", title: "Áreas", why: "Contêiner pessoal básico.", steps: [
          { a: "Crie uma área nova (+ Nova área).", e: "Aparece na lista, cor padrão atribuída." },
          { a: "Botão direito → Renomear e mude a cor.", e: "Atualiza na navegação e no card das tarefas dela." },
          { a: "Arquive a área.", e: "Some da lista principal, aparece em inativas com opção de reativar." },
          { a: "Reative.", e: "Volta à lista principal, tarefas continuam vinculadas." }
        ]},
        { id: "cad-projetos", title: "Projetos", why: "Vive dentro de uma área, tem progresso próprio.", steps: [
          { a: "Dentro de uma área, crie um projeto novo.", e: "Aparece como sub-item, com cor própria." },
          { a: "Adicione 2 tarefas e conclua 1.", e: "Barra de progresso mostra 50%." },
          { a: "Arquive o projeto.", e: "Some da área ativa, aparece em inativos." }
        ]},
        { id: "cad-tags", title: "Tags", why: "Rótulo pessoal livre, diferente do Tipo de demanda (que é da organização).", steps: [
          { a: "Crie uma tag nova com cor customizada.", e: "Aparece na seção Tags da navegação." },
          { a: "Aplique em 2 tarefas diferentes.", e: "Badge aparece nos dois cards." },
          { a: "Clique na tag na navegação.", e: "Abre a view só com as tarefas marcadas." },
          { a: "Remova a tag de uma tarefa pelo × do chip.", e: "Badge some só daquele card." }
        ]},
        { id: "cad-colaboradores", title: "Colaboradores locais", why: "Contato pra delegar, sem precisar ter conta no app.", steps: [
          { a: "Cadastre um colaborador local novo (sem e-mail).", e: "Aparece em 'Colaboradores locais', sem opção de vincular." },
          { a: "Edite nome, telefone e cor.", e: "Muda em qualquer lugar que ele apareça (avatar, menus)." },
          { a: "Arquive o colaborador.", e: "Some da lista ativa; tarefas já delegadas continuam existindo." },
          { a: "Reative.", e: "Volta a aparecer pra novas delegações." }
        ]}
      ]},
      { id: "config", label: "Configurações", sections: [
        { id: "config-geral", title: "Preferências gerais", why: "Tema, horários do dia, atalhos.", steps: [
          { a: "Troque o tema pra Escuro, depois Auto.", e: "Interface muda na hora, sem recarregar." },
          { a: "Mude o horário de início do dia e o intervalo de almoço.", e: "Lista Hoje reorganiza os blocos (manhã/almoço/tarde)." },
          { a: "Mude a duração padrão de tarefa nova.", e: "Próxima tarefa criada já nasce com essa duração." },
          { a: "Edite os atalhos da barra inferior (visualize em tela estreita).", e: "Tab bar mobile reflete a escolha." }
        ]},
        { id: "config-export", title: "Exportação de dados", why: "Backup manual.", steps: [
          { a: "Exporte os dados em JSON.", e: "Baixa arquivo com todas as tarefas." },
          { a: "Exporte em CSV.", e: "Abre numa planilha, colunas legíveis." }
        ]},
        { id: "config-push", title: "Notificações push", why: "Aviso fora do app.", steps: [
          { a: "Ative notificações push.", e: "Navegador pede permissão; toggle liga depois de aceitar." },
          { a: "Desative.", e: "Toggle desliga, sem erro no console." }
        ]},
        { id: "config-booking", title: "Agendamento (Booking)", why: "Link público de reunião.", steps: [
          { a: "Configure seu perfil (nome, duração, buffer).", e: "Link público gerado (/book/seu-slug)." },
          { a: "Defina disponibilidade semanal.", e: "Só os horários marcados aparecem como livres no link público." },
          { a: "Abra o link público (janela anônima) e marque um horário de teste.", e: "Reunião aparece na sua Hoje/Calendário, com link do Meet se conectado." }
        ]}
      ]},
      { id: "org", label: "Organização", sections: [
        { id: "org-criar", title: "Criar organização", why: "Ponto de entrada da plataforma de equipe.", steps: [
          { a: "Crie uma organização (nome da empresa) — pule se a sua já existe.", e: "Você vira estratégico/dono; seção 'Organização' aparece." }
        ]},
        { id: "org-convite", title: "Convidar membro", why: "Convite compartilhado manualmente, sem e-mail automático.", steps: [
          { a: "Gere um convite pra um e-mail novo, papel Membro.", e: "Link de convite aparece pra copiar." },
          { a: "Aceite logado com o e-mail certo.", e: "Pessoa vira membro, aparece na lista de Membros." },
          { a: "Tente usar o mesmo link de novo.", e: "Convite já aceito não deveria funcionar de novo." }
        ]},
        { id: "org-hierarquia", title: "Papéis e hierarquia", why: "Base do roll-up do Cockpit.", steps: [
          { a: "Mude o papel de um membro (Membro → Supervisor).", e: "Badge de papel muda na lista." },
          { a: "Mude quem é o gestor direto dele.", e: "Reflete na árvore usada pelo Cockpit." }
        ]},
        { id: "org-editar-membro", title: "Editar membro", why: "Fase 1b — só dado que não compromete a conta Google.", steps: [
          { a: "Clique 'Editar' num membro com contato local vinculado.", e: "Abre modal de colaborador — nome de exibição e telefone editáveis, sem e-mail/foto (isso vem do Google)." },
          { a: "Mude o nome de exibição.", e: "Nome novo aparece no Cockpit e badges de delegação, sem mudar o nome real da conta dele." },
          { a: "Num membro sem contato local, clique '+ Criar contato'.", e: "Cria o vínculo; próxima vez mostra 'Editar' no lugar." }
        ]},
        { id: "org-desativar-membro", title: "Desativar/reativar membro", why: "Inativação em vez de exclusão.", steps: [
          { a: "Desative um membro.", e: "Some da lista ativa, aparece em inativos; histórico de tarefas continua intacto." },
          { a: "Reative.", e: "Volta a aparecer, inclusive nos seletores de delegar." }
        ]},
        { id: "org-tipos-demanda", title: "Tipos de demanda", why: "Taxonomia da organização, usada em relatório.", steps: [
          { a: "Crie um tipo com cor e prazo padrão de 24h.", e: "Aparece na lista com a cor e '24h' ao lado." },
          { a: "Use numa tarefa organizacional sem prazo definido.", e: "Prazo se preenche sozinho (agora + 24h)." },
          { a: "Arquive o tipo.", e: "Some da seleção em tarefa nova; tarefas antigas mantêm o tipo." }
        ]},
        { id: "org-espacos", title: "Espaços", why: "Contêiner compartilhado real (Fase 2/3).", steps: [
          { a: "Crie um espaço Aberto.", e: "Aparece na navegação pra todos os membros da organização." },
          { a: "Crie um espaço Fechado com só 1 membro.", e: "Só esse membro (+ você) enxerga na navegação." },
          { a: "Crie uma tarefa dentro de um espaço.", e: "Ganha o selo 'Org' no card automaticamente, sem exigir tipo de demanda." },
          { a: "Arquive um espaço.", e: "Some da navegação ativa, aparece em inativos." }
        ]}
      ]},
      { id: "times", label: "Times", sections: [
        { id: "times-criar", title: "Criar e gerenciar time", why: "Agrupamento de pessoas dentro da organização.", steps: [
          { a: "Crie um time e defina um líder.", e: "Aparece na lista, líder com destaque." },
          { a: "Adicione 2 membros.", e: "Aparecem na lista do time." },
          { a: "Remova 1 membro do time.", e: "Some do time, sem afetar o cadastro dele na organização." }
        ]},
        { id: "times-desativar", title: "Desativar/reativar time", why: "Mesmo padrão de inativação.", steps: [
          { a: "Desative um time.", e: "Some da lista ativa, aparece em inativos." },
          { a: "Reative.", e: "Volta a aparecer, membros continuam os mesmos." }
        ]},
        { id: "times-filtro", title: "Filtro de time no Cockpit", why: "Recorte do mesmo roll-up, sem view paralela.", steps: [
          { a: "No Cockpit, use 'Todos os times' pra escolher um time específico.", e: "Lista estreita só pras pessoas daquele time, sem recarregar." }
        ]}
      ]},
      { id: "modulos", label: "Módulos", sections: [
        { id: "mod-navegacao", title: "Navegação (trilho + painel)", why: "Maior mudança de navegação do app até hoje — Fase 4.2.", steps: [
          { a: "Confira o trilho escuro à esquerda (desktop).", e: "Logo, módulo Tarefas ativo, ícones de utilidade e avatar, sempre visível." },
          { a: "Clique no ícone de ocultar painel.", e: "Painel some, trilho continua; clicar de novo traz de volta." },
          { a: "Use a busca do painel pra filtrar por nome de uma área.", e: "Só o que bate com o texto aparece, mesmo em seção recolhida." },
          { a: "Fixe uma área e uma pessoa (★ ou menu '···' → Fixar).", e: "Aparecem numa seção 'Fixados' no topo." },
          { a: "Recolha/expanda a seção Áreas clicando no cabeçalho.", e: "Abre/fecha suavemente." },
          { a: "Em tela estreita/celular, abra o menu hambúrguer.", e: "Drawer mostra o mesmo conteúdo do painel, sem trilho." }
        ]},
        { id: "mod-inbox", title: "Inbox", why: "Tarefa sem contexto nenhum.", steps: [
          { a: "Crie uma tarefa sem contexto.", e: "Cai direto na Inbox." },
          { a: "Mova pra uma área arrastando.", e: "Some da Inbox, aparece na área." }
        ]},
        { id: "mod-hoje", title: "Hoje", why: "Painéis novos: Planejar meu dia, Organizar horários.", steps: [
          { a: "Agende uma tarefa pra hoje com horário.", e: "Aparece no bloco certo (manhã/tarde/etc)." },
          { a: "Marque uma tarefa como urgente.", e: "Aparece em 'Resolver Primeiro', antes das atrasadas." },
          { a: "Deixe algo com prazo/cobrança vencida.", e: "Aparece em 'Revisar hoje'." },
          { a: "Clique '🗓️ Planejar meu dia'.", e: "Modal com atrasadas + Inbox sem data; Hoje/Amanhã/✕ remove da lista de triagem." },
          { a: "Clique '🕐 Organizar horários' (desktop) e arraste uma tarefa sem horário pra um slot.", e: "Tarefa ganha aquele horário, reflete na lista principal." }
        ]},
        { id: "mod-embreve", title: "Em Breve", why: "Tarefas futuras agrupadas por data.", steps: [
          { a: "Agende 3 tarefas pros próximos dias.", e: "Aparecem agrupadas por data." }
        ]},
        { id: "mod-depois", title: "Depois", why: "Sem data nenhuma, de propósito.", steps: [
          { a: "Marque uma tarefa como 'Algum dia'.", e: "Sai de qualquer lista com data, aparece em Depois." }
        ]},
        { id: "mod-area-espaco", title: "Área/Projeto/Espaço — Lista/Board/Linha do tempo", why: "Seletor de visão novo (Fase 4.3–4.5), testar nos 3 contextos.", steps: [
          { a: "Numa Área sua, troque entre Lista, Board e Linha do tempo.", e: "Mesmas tarefas, só reorganizadas; escolha fica salva ao voltar na página." },
          { a: "No Board de uma Área pessoal, confira as colunas.", e: "Só 2 — A fazer/Concluída (sem status de delegação)." },
          { a: "No Board de um Espaço com tarefa delegada, confira as colunas.", e: "5 — Pendente/Em andamento/Aguardando aceite/Bloqueada/Concluída." },
          { a: "Use os filtros de Pessoa e Tipo de demanda.", e: "Só aparece quando faz sentido; resultado filtra de verdade." },
          { a: "Marque '🚨 Atrasadas' e depois 'Agrupar: Pessoa'.", e: "Filtro e agrupamento combinam." },
          { a: "Clique '👤 Só minhas' e de novo pra desligar.", e: "Isola suas tarefas com 1 clique; segundo clique restaura." },
          { a: "Salve a combinação atual como view (+ Salvar view atual).", e: "Pill ⭐ nova aplica os mesmos filtros depois." },
          { a: "Ordene por Prazo, depois por Tempo parado.", e: "Reordena de verdade." }
        ]},
        { id: "mod-delegadas", title: "Delegadas", why: "Ganhou Board/Linha do tempo, Lista continua igual.", steps: [
          { a: "Alterne entre os filtros Todas/Cobrar/Aguardando aceite/Bloqueadas.", e: "Contagem de cada chip bate com a lista." },
          { a: "Troque pra Board.", e: "Mesmas tarefas dos filtros, em colunas de status." },
          { a: "Volte pra Lista.", e: "Agrupamento por pessoa de sempre, com Pauta 1:1 e cobrança por WhatsApp." }
        ]},
        { id: "mod-cockpit", title: "Cockpit", why: "Roll-up + carga de trabalho nova.", steps: [
          { a: "Abra o Cockpit.", e: "Tarefas organizacionais da equipe por pessoa — nenhuma tarefa SUA aparece." },
          { a: "Confira 'Carga de trabalho' no topo.", e: "Barra por pessoa, cor pela proporção de atrasadas." },
          { a: "Se houver pedido de prorrogação, aprove/recuse.", e: "Prazo muda de acordo; pedido some da lista." }
        ]},
        { id: "mod-calendario", title: "Calendário", why: "Feed de urgentes.", steps: [
          { a: "Marque uma tarefa urgente com data.", e: "Aparece no Calendário no dia certo." }
        ]},
        { id: "mod-historico", title: "Histórico", why: "Estatísticas por área e tipo de demanda.", steps: [
          { a: "Conclua tarefas de áreas/tipos diferentes.", e: "'Por área' e 'Por tipo de demanda' batem com o que foi concluído." }
        ]},
        { id: "mod-lixeira", title: "Lixeira", why: "Soft-delete — nada some de vez sem querer.", steps: [
          { a: "Mova uma tarefa pra lixeira.", e: "Aparece lá com opção de restaurar ou excluir de vez." },
          { a: "Restaure.", e: "Volta pro contexto original." }
        ]},
        { id: "mod-arquivo", title: "Arquivo", why: "Diferente de lixeira — sem intenção de excluir.", steps: [
          { a: "Arquive uma tarefa (não delete).", e: "Aparece em Arquivo, some das listas ativas." }
        ]},
        { id: "mod-colaborador", title: "Colaborador (pauta 1:1)", why: "Placar de execução por pessoa.", steps: [
          { a: "Abra a página de um colaborador.", e: "Mostra placar (no prazo, tempo médio, cobranças) + tarefas abertas/concluídas." }
        ]},
        { id: "mod-quickentry", title: "QuickEntry (⌘N)", why: "Atalhos por texto + fileira de ícones.", steps: [
          { a: "Digite um título com '!alta #tagexistente @pessoa'.", e: "Prioridade, tag e delegado reconhecidos e removidos do título." },
          { a: "Clique num ícone (ex: Prazo) depois de digitar o atalho equivalente.", e: "Clique manual vence sobre o texto." },
          { a: "Pressione Enter com foco em qualquer campo do popup.", e: "Cria a tarefa, não só com foco no título." }
        ]},
        { id: "mod-commandbar", title: "Busca / Command bar (⌘K)", why: "Ganhou Ações e Recentes.", steps: [
          { a: "Abra a busca vazia.", e: "Mostra 'Ações' (criar tarefa, ir pra Hoje/Inbox/...) e 'Recentes'." },
          { a: "Digite parte do nome de uma tarefa.", e: "Resultados aparecem, filtros de status/prioridade/área continuam funcionando." },
          { a: "Clique numa ação (ex: 'Ir para Hoje').", e: "Navega e fecha a busca." }
        ]},
        { id: "mod-notificacoes", title: "Notificações", why: "Central nova (Fase 4.11).", steps: [
          { a: "Aceite uma tarefa delegada até o elo raiz fechar.", e: "Quem criou recebe notificação nova (sino atualiza)." },
          { a: "Abra o sino e clique numa notificação não lida.", e: "Marca como lida; 'Marcar tudo como lido' zera o contador." }
        ]},
        { id: "mod-delegacao", title: "Delegação em cadeia", why: "Núcleo da Fase 2.7 — histórico completo, aceite em cascata.", steps: [
          { a: "Delegue uma tarefa pra alguém com conta vinculada.", e: "Some das suas listas, toast com Desfazer." },
          { a: "Como a pessoa, marque como concluída.", e: "Vira 'aguardando aceite', não fecha sozinha." },
          { a: "Como você, aceite em Delegadas.", e: "Fecha de vez, vai pro Histórico." },
          { a: "Delegue de novo e, antes do aceite, redelegue pra outra pessoa.", e: "Histórico mostra os dois elos, o mais recente como atual." },
          { a: "Cobre pelo WhatsApp.", e: "Abre com mensagem pré-pronta; contador de cobranças incrementa." }
        ]},
        { id: "mod-prorrogacao", title: "Aprovação de prorrogação de prazo", why: "Só adiar pede aprovação — antecipar é livre.", steps: [
          { a: "Numa tarefa organizacional com prazo, tente ADIAR a data.", e: "Fica pendente — prazo na tela continua mostrando a data antiga, com aviso '🕓 Aguardando aprovação'." },
          { a: "Tente ANTECIPAR o prazo de outra tarefa.", e: "Salva na hora, sem pedir aprovação." },
          { a: "Como aprovador, aprove o pedido do passo 1 (no Cockpit).", e: "Prazo muda pra data pedida; notificação chega pra quem pediu." }
        ]},
        { id: "mod-comentarios", title: "Comentários em tarefa", why: "Novo (Fase 4.12) — aditivo ao campo 'O combinado'.", steps: [
          { a: "Numa tarefa delegada, escreva um comentário.", e: "Aparece na thread com seu nome e horário." },
          { a: "Peça pra outra pessoa envolvida comentar também.", e: "Comentário dela aparece na próxima abertura do painel." },
          { a: "Confirme que uma tarefa pessoal (sem organização) não mostra comentários.", e: "Seção só aparece em tarefa delegada." }
        ]}
      ]},
      { id: "admin", label: "Painel Admin", sections: [
        { id: "admin-ideias", title: "Ideias & Roadmap", why: "Backlog interno pra não esquecer ideias futuras — só admin vê.", steps: [
          { a: "Abra Configurações → Painel administrativo → aba Ideias & Roadmap.", e: "Mostra captura rápida no topo e colunas por status (Ideia/Pesquisando/Planejado/Em andamento/Feito/Descartado)." },
          { a: "Digite um título e aperte Enter na captura rápida.", e: "Ideia nova aparece na coluna 'Ideia'." },
          { a: "Mude o status de uma ideia pelo seletor do card.", e: "Card muda de coluna imediatamente." },
          { a: "Preencha o campo de timing e expanda as notas de pesquisa.", e: "Texto salva ao sair do campo, sem botão de salvar." },
          { a: "Marque uma ideia como 'Feito'.", e: "Campo pra anotar a versão que entregou só aparece nesse status." },
          { a: "Exclua uma ideia de teste.", e: "Pede confirmação antes de excluir." }
        ]},
        { id: "admin-qa", title: "Roteiro de QA", why: "Substituiu o artifact externo — progresso, notas e imagens ficam no banco.", steps: [
          { a: "Abra a aba Roteiro de QA.", e: "Mostra abas de versão, barra de progresso geral e navegação lateral por grupo." },
          { a: "Marque um item como concluído e escreva uma nota.", e: "Progresso da barra atualiza; nota persiste ao trocar de aba e voltar." },
          { a: "Cole uma imagem (print) dentro do campo de nota.", e: "Miniatura aparece logo abaixo, clicável pra abrir em tamanho real." },
          { a: "Clique em 'marcar como corrigido' num item sem nota nenhuma.", e: "Botão aparece normalmente (não exige nota) e pede um comentário curto antes de salvar." },
          { a: "Recarregue a página (F5) com o item corrigido.", e: "Selo verde 'corrigido em' continua aparecendo, com o comentário salvo." }
        ]}
      ]}
    ]
  }
  // v1.1.0 (e seguintes) entram aqui — só com o que mudou ou nunca foi testado.
];
