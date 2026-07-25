// Recentes do command bar (Fase 4.10) — últimos lugares visitados (área/projeto/espaço),
// guardado por usuário em localStorage. Gravado ao abrir a página, lido só quando o
// command bar abre vazio.
const storageKey = (userId) => `lc_recent_${userId}`;

export function recordRecentVisit(userId, entry) {
  if (!userId) return;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    let list = raw ? JSON.parse(raw) : [];
    list = list.filter((e) => !(e.type === entry.type && e.id === entry.id));
    list.unshift({ ...entry, at: Date.now() });
    localStorage.setItem(storageKey(userId), JSON.stringify(list.slice(0, 6)));
  } catch { /* localStorage indisponível — recentes ficam vazios, sem quebrar a página */ }
}

export function getRecentVisits(userId) {
  if (!userId) return [];
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) ?? "[]");
  } catch {
    return [];
  }
}
