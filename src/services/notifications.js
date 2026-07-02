/*
  Sistema de notificações — alinhado com Things 3 / Todoist / TickTick:
  ─ "Urgente" = flag visual. Notificações disparam apenas no horário agendado.
  ─ Cobre hoje e amanhã (setTimeout seguro até ~36h).
  ─ Urgente com horário: aviso 30min antes + aviso 5min antes + na hora.
  ─ Urgente sem horário: notifica às 09:00.
  ─ Deadline hoje: notificação às 08:00 (antes do dia começar).
  ─ Resumo matinal às 08:00 se houver tarefas no dia.
  ─ Por-tarefa: respeita task.reminder_minutes se definido.
  ─ Ao concluir: cancelNotification() cancela timers pendentes.
*/

const timers = new Map();

function localDateStr(d = new Date()) {
  return (
    d.getFullYear() +
    "-" + String(d.getMonth() + 1).padStart(2, "0") +
    "-" + String(d.getDate()).padStart(2, "0")
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

function fire(key, title, body, { tag, taskId, url } = {}) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    // Notification Actions API — suportado no Chrome/Edge; silenciosamente ignorado em Safari
    const opts = {
      body,
      icon: "/icon-192.png",
      badge: "/favicon-32.png",
      tag: tag ?? key,
      requireInteraction: false,
      data: { taskId, url: url ?? "/today" },
    };
    if (taskId) {
      opts.actions = [
        { action: "complete", title: "✓ Concluir" },
        { action: "snooze",   title: "⏰ +30 min"  },
      ];
    }
    new Notification(title, opts);
  } catch {
    // Silently ignore (iOS Safari sem PWA instalado)
  }
  timers.delete(key);
}

function scheduleAt(fireAt, key, title, body, meta = {}) {
  const delay = fireAt.getTime() - Date.now();
  if (delay < 0) return;                          // já passou
  if (delay > 36 * 60 * 60 * 1000) return;       // além de 36h — fora do range seguro
  const t = setTimeout(() => fire(key, title, body, meta), delay);
  timers.set(key, t);
}

function buildFireTime(dateStr, timeStr) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  if (timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    return new Date(y, mo - 1, d, h, m, 0, 0);
  }
  return new Date(y, mo - 1, d, 9, 0, 0, 0);    // sem horário → 09:00
}

export function scheduleTaskNotifications(tasks) {
  timers.forEach((t) => clearTimeout(t));
  timers.clear();

  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const today    = todayStr();
  const tomorrow = tomorrowStr();

  const eligible = tasks.filter(
    (t) => !t.completed_at && !t.deleted_at && !t.archived_at
  );

  // ── Resumo matinal às 08:00 ─────────────────────────────────
  const todayCount = eligible.filter((t) => t.scheduled_date === today).length;
  if (todayCount > 0) {
    const summaryAt = new Date();
    summaryAt.setHours(8, 0, 0, 0);
    scheduleAt(
      summaryAt,
      "daily-summary",
      `📋 ${todayCount} tarefa${todayCount > 1 ? "s" : ""} para hoje`,
      eligible
        .filter((t) => t.scheduled_date === today)
        .slice(0, 3)
        .map((t) => `• ${t.title}`)
        .join("\n") + (todayCount > 3 ? `\n…e mais ${todayCount - 3}` : ""),
      { url: "/today" }
    );
  }

  // ── Por tarefa ───────────────────────────────────────────────
  eligible
    .filter((t) => t.scheduled_date === today || t.scheduled_date === tomorrow)
    .forEach((task) => {
      const isTomorrow = task.scheduled_date === tomorrow;
      const prefix     = isTomorrow ? "Amanhã · " : "";
      const fireAt     = buildFireTime(task.scheduled_date, task.scheduled_time);
      const isUrgent   = !!task.is_urgent;

      // Lembrete personalizado por tarefa (task.reminder_minutes, ex: 15)
      const reminderMin = task.reminder_minutes ?? (isUrgent ? 30 : null);

      // ── Deadline: avisa às 08:00 do dia do vencimento ────────
      if (task.deadline) {
        const [dy, dm, dd] = task.deadline.split("-").map(Number);
        const deadlineDay  = localDateStr(new Date(dy, dm - 1, dd));
        if (deadlineDay === today || deadlineDay === tomorrow) {
          const deadlinePrefix = deadlineDay === tomorrow ? "Amanhã vence · " : "Vence hoje · ";
          const deadlineAt = new Date(dy, dm - 1, dd, 8, 0, 0, 0);
          scheduleAt(
            deadlineAt,
            `${task.id}-deadline`,
            `⏳ ${deadlinePrefix}${task.title}`,
            "Prazo se encerra hoje. Não esqueça!",
            { taskId: task.id, url: "/today" }
          );
        }
      }

      if (!task.scheduled_time && !task.deadline) {
        // Sem horário e sem deadline: 09:00 apenas para urgentes
        if (!isUrgent) return;
        scheduleAt(
          fireAt,
          task.id,
          `🔴 ${prefix}${task.title}`,
          task.notes?.slice(0, 120) ?? "Tarefa urgente para hoje sem horário definido.",
          { taskId: task.id }
        );
        return;
      }

      if (!task.scheduled_time) return; // tem deadline mas não agendamento — já tratado acima

      // ── Avisos antecipados ────────────────────────────────────
      if (reminderMin) {
        const earlyAt = new Date(fireAt.getTime() - reminderMin * 60 * 1000);
        scheduleAt(
          earlyAt,
          `${task.id}-early`,
          `${isUrgent ? "⚠️" : "🔔"} ${prefix}Em ${reminderMin} min — ${task.title}`,
          isUrgent ? "Tarefa urgente começando em breve." : "Lembrete antecipado.",
          { taskId: task.id }
        );
      }

      // Para urgentes: aviso adicional a 5 min antes (se não coincidir com o early)
      if (isUrgent && reminderMin !== 5) {
        const fiveAt = new Date(fireAt.getTime() - 5 * 60 * 1000);
        scheduleAt(
          fiveAt,
          `${task.id}-5min`,
          `🚨 ${prefix}Em 5 min — ${task.title}`,
          "Últimos minutos!",
          { taskId: task.id }
        );
      }

      // ── Notificação principal (no horário) ───────────────────
      scheduleAt(
        fireAt,
        task.id,
        isUrgent ? `🔴 ${prefix}${task.title}` : `🔔 ${prefix}${task.title}`,
        task.notes?.slice(0, 120) ?? (isUrgent ? "Tarefa urgente no horário." : "Tarefa agendada para agora."),
        { taskId: task.id, url: "/today" }
      );
    });
}

export function cancelNotification(taskId) {
  for (const key of [`${taskId}-early`, `${taskId}-5min`, `${taskId}-deadline`, taskId]) {
    if (timers.has(key)) {
      clearTimeout(timers.get(key));
      timers.delete(key);
    }
  }
}
