const timers = new Map();

function localDateStr() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function fireNotification(id, title, body, tag) {
  new Notification(title, { body, icon: "/favicon.ico", tag });
  timers.delete(tag ?? id);
}

export function scheduleTaskNotifications(tasks) {
  timers.forEach((t) => clearTimeout(t));
  timers.clear();

  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const todayDate = localDateStr();
  const now = Date.now();

  tasks
    .filter((t) => !t.completed_at && !t.deleted_at && !t.archived_at)
    .forEach((task) => {
      const isToday = task.scheduled_date === todayDate;
      if (!isToday) return;

      if (task.scheduled_time) {
        const [h, m] = task.scheduled_time.split(":").map(Number);
        const fireAt = new Date();
        fireAt.setHours(h, m, 0, 0);
        const delay = fireAt.getTime() - now;
        if (delay < 0) return;

        if (task.is_urgent) {
          // Aviso 15 min antes para urgentes
          const earlyDelay = delay - 15 * 60 * 1000;
          if (earlyDelay > 0) {
            const earlyTimer = setTimeout(
              () => fireNotification(
                task.id,
                `🔔 Em 15 min — ${task.title}`,
                "⚠️ Tarefa urgente em 15 minutos. Prepare-se!",
                `${task.id}-early`
              ),
              earlyDelay
            );
            timers.set(`${task.id}-early`, earlyTimer);
          }
          // Notificação principal urgente
          const t = setTimeout(
            () => fireNotification(
              task.id,
              `🔔 URGENTE: ${task.title}`,
              task.notes ? task.notes.slice(0, 100) : "⚠️ Esta tarefa foi marcada como urgente",
              task.id
            ),
            delay
          );
          timers.set(task.id, t);
        } else {
          // Notificação padrão
          const t = setTimeout(
            () => fireNotification(
              task.id,
              `⏰ ${task.title}`,
              task.notes ? task.notes.slice(0, 100) : "Tarefa agendada para agora",
              task.id
            ),
            delay
          );
          timers.set(task.id, t);
        }
      } else if (task.is_urgent) {
        // Urgente sem horário: notifica às 09:00 do dia (se ainda não passou)
        const fireAt = new Date();
        fireAt.setHours(9, 0, 0, 0);
        const delay = fireAt.getTime() - now;
        if (delay < 0) return;
        const t = setTimeout(
          () => fireNotification(
            task.id,
            `🔔 URGENTE: ${task.title}`,
            task.notes ? task.notes.slice(0, 100) : "⚠️ Tarefa urgente para hoje sem horário definido",
            task.id
          ),
          delay
        );
        timers.set(task.id, t);
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
