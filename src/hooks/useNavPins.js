import { useState, useCallback } from "react";
import { useAuthStore } from "../store/authStore";

const storageKey = (userId) => `lc_pins_${userId}`;

function readPins(userId) {
  if (!userId) return [];
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) ?? "[]");
  } catch {
    return [];
  }
}

// Fixados do 2º painel (Fase 4.2) — guardado por usuário no localStorage, sem tabela nova no
// banco. Cada pin já guarda {label, color, to} pra renderizar sem precisar re-resolver o item
// nas stores (funciona mesmo se o item for arquivado depois).
export function useNavPins() {
  const { user } = useAuthStore();
  const [pins, setPins] = useState(() => readPins(user?.id));

  const isPinned = useCallback(
    (type, id) => pins.some((p) => p.type === type && p.id === id),
    [pins]
  );

  const togglePin = useCallback((type, id, extra = {}) => {
    setPins((prev) => {
      const exists = prev.some((p) => p.type === type && p.id === id);
      const next = exists
        ? prev.filter((p) => !(p.type === type && p.id === id))
        : [...prev, { type, id, ...extra }];
      if (user?.id) localStorage.setItem(storageKey(user.id), JSON.stringify(next));
      return next;
    });
  }, [user]);

  return { pins, isPinned, togglePin };
}
