// Fonte única do modal "Novidades" (WhatsNewModal). Espelha o CHANGELOG.md, mas em linguagem
// de usuário — sem jargão de fase interna. Mais recente primeiro. `type` decide o ícone/cor
// no modal: "new" (✨), "improved" (🔧) ou "fixed" (🐛).
export const CURRENT_VERSION = "1.0.0";

const SEEN_KEY = "lc_last_seen_version";

export function hasUnseenRelease() {
  try {
    return localStorage.getItem(SEEN_KEY) !== CURRENT_VERSION;
  } catch {
    return false;
  }
}

export function markReleaseSeen() {
  try {
    localStorage.setItem(SEEN_KEY, CURRENT_VERSION);
  } catch { /* localStorage indisponível — badge só não some, sem quebrar nada */ }
}

export const RELEASE_NOTES = [
  {
    version: "1.0.0",
    date: "2026-07-25",
    title: "Navegação nova e plataforma de equipe completa",
    highlights: [
      { type: "new", text: "Navegação por trilho de ícones + painel com busca e itens fixados." },
      { type: "new", text: "Espaços — um lugar compartilhado de verdade pra trabalho em equipe." },
      { type: "new", text: "Lista, Board ou Linha do tempo em qualquer Área, Projeto ou Espaço, com filtros e views salvas." },
      { type: "new", text: "Carga de trabalho da equipe, direto no Cockpit." },
      { type: "new", text: "Planejamento guiado do dia e organizar horários arrastando tarefas, no Hoje." },
      { type: "new", text: "Busca (⌘K) agora sugere ações e mostra os lugares que você visitou por último." },
      { type: "new", text: "Central de notificações e comentários em tarefas delegadas." },
      { type: "new", text: "Atalhos por texto no Cmd+N: !alta, #tag, @pessoa." },
      { type: "improved", text: "Tela de detalhe da tarefa reorganizada — campos de data, importância, organização e pessoas agora ficam juntos por assunto." },
      { type: "fixed", text: "Esc não fecha mais duas telas de uma vez quando uma está aberta sobre a outra." },
      { type: "fixed", text: "Badge de duração some quando a tarefa não tem horário marcado." },
    ],
  },
];
