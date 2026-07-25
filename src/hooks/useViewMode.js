import { useState } from "react";

// Preferência de visão (Lista/Board/Linha do tempo) por página — Fase 4.3, guardada por
// localStorage (chave única por área/projeto/espaço), sem precisar de coluna no banco.
export function useViewMode(storageKey, defaultMode = "list") {
  const [mode, setModeState] = useState(() => localStorage.getItem(storageKey) || defaultMode);

  const setMode = (m) => {
    setModeState(m);
    localStorage.setItem(storageKey, m);
  };

  return [mode, setMode];
}
