/*
  Sistema de notificações baseado em setTimeout.
  Regras (alinhadas com Todoist / Things 3 / TickTick):
  ─ "Urgente" é flag de prioridade visual, NÃO dispara push imediato.
  ─ Notificações disparam APENAS no horário agendado (ou aviso antecipado).
  ─ Cobre hoje e amanhã (limite do setTimeout ≈ 24h é confiável na prática).
  ─ Tarefas urgentes recebem aviso 15 min antes (se ainda houver tempo).
  ─ Tarefas sem horário: notificam às 09:00 do dia agendado.
*/

const timers = new Map();

function localDateStr(d = new Date()) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function todayStr()    { return localDateStr(); }
function tomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return localDateStr(d); }

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function fire(id, title, body, tag) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: tag ?? id,
      requireInteraction: false,
    });
  } catch {
    // Silently ignore (e.g. iOS Safari without PWA install)
  }
  timers.delete(tag ?? id);
}

function scheduleAt(fireAt, id, title, body, tag) {
  const delay = fireAt.getTime() - Date.now();
  if (delay < 0) return; // já passou
  if (delay > 36 * 60 * 60 * 1000) return; // além de 36h — não agenda via setTimeout
  const timer = setTimeout(() => fire(id, title, body, tag), delay);
  timers.set(tag ?? id, timer);
}

function buildFireTime(dateStr, timeStr) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  if (timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    return new Date(y, mo - 1, d, h, m, 0, 0);
  }
  // Sem horário → 09:00 do dia
  return new Date(y, mo - 1, d, 9, 0, 0, 0);
}

export function scheduleTaskNotifications(tasks) {
  // Limpa todos os timers anteriores e reagenda tudo do zero
  timers.forEach((t) => clearTimeout(t));
  timers.clear();

  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const today    = todayStr();
  const tomorrow = tomorrowStr();

  tasks
    .filter((t) => !t.completed_at && !t.deleted_at && !t.archived_at)
    .filter((t) => t.scheduled_date === today || t.scheduled_date === tomorrow)
    .forEach((task) => {
      const fireAt = buildFireTime(task.scheduled_date, task.scheduled_time);
      const isUrgent = !!task.is_urgent;
      const isTomorrow = task.scheduled_date === tomorrow;
      const prefix = isTomorrow ? "Amanhã · " : "";

      if (isUrgent) {
        // Aviso antecipado 15 min antes (só se houver horário definido)
        if (task.scheduled_time) {
          const earlyAt = new Date(fireAt.getTime() - 15 * 60 * 1000);
          scheduleAt(
            earlyAt,
            task.id,
            `⚠️ ${prefix}Em 15 min — ${task.title}`,
            "Tarefa urgente começando em breve.",
            `${task.id}-early`
          );
        }
        // Notificação principal
        scheduleAt(
          fireAt,
          task.id,
          `🔴 ${prefix}${task.title}`,
          task.notes?.slice(0, 120) ?? "Tarefa urgente no horário.",
          task.id
        );
      } else {
        // Notificação padrão no horário
        scheduleAt(
          fireAt,
          task.id,
          `🔔 ${prefix}${task.title}`,
          task.notes?.slice(0, 120) ?? (task.scheduled_time ? "Tarefa agendada para agora." : "Tarefa agendada para hoje."),
          task.id
        );
      }
    });
}

export function cancelNotification(taskId) {
  for (const key of [`${taskId}-early`, taskId]) {
    if (timers.has(key)) {
      clearTimeout(timers.get(key));
      timers.delete(key);
    }
  }
}
