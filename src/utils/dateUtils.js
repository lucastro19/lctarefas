// Extraído de TaskCard.jsx (estava duplicado lá) — usado também em TaskDetail.jsx pro
// card de urgência do Prazo, pra não reinventar rótulos/cores/limiares.

// Usa data LOCAL (não UTC) para evitar bug de timezone em fusos negativos (BR = UTC-3)
export function localDateStr(d = new Date()) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

export const todayStr = () => localDateStr();

export function isOverdue(date) {
  return date && date < todayStr();
}

export function deadlineUrgency(dateStr) {
  if (!dateStr) return null;
  const today = localDateStr();
  if (dateStr < today) return { level: "overdue", label: "Venceu!", color: "#FF3B30", pulse: true };
  if (dateStr === today) return { level: "today", label: "Vence hoje", color: "#FF3B30", pulse: true };
  const diff = Math.round((new Date(dateStr + "T12:00:00") - new Date(today + "T12:00:00")) / 86400000);
  if (diff === 1) return { level: "tomorrow", label: "Vence amanhã", color: "#FF9500", pulse: false };
  if (diff <= 3) return { level: "soon", label: `Vence em ${diff} dias`, color: "#FF9500", pulse: false };
  if (diff <= 7) return { level: "week", label: `Vence em ${diff} dias`, color: "#FFCC00", pulse: false };
  return null; // mais de 7 dias → mostra só a data normal
}
