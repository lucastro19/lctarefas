export function minsToStr(mins) {
  const h = Math.floor(Math.max(0, mins) / 60) % 24;
  const m = Math.max(0, mins) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function strToMins(str) {
  if (!str) return 0;
  const [h, m] = str.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function getPeriod(time, settings) {
  if (!time) return "sem-horario";
  const mins = strToMins(time);
  const ls = strToMins(settings.lunchStart);
  const le = strToMins(settings.lunchEnd);
  const de = strToMins(settings.dayEnd);
  if (mins >= de) return "noite";
  if (mins >= le) return "tarde";
  if (mins >= ls) return "almoco";
  return "manha";
}

// Retorna { time: "HH:MM", full: bool }
// full=true quando o período não tem mais espaço
export function nextSlotInPeriod(periodKey, periodTasks, settings, defaultDuration = 30) {
  const ds = strToMins(settings.dayStart);
  const ls = strToMins(settings.lunchStart);
  const le = strToMins(settings.lunchEnd);
  const de = strToMins(settings.dayEnd);

  const periodStart = periodKey === "manha" ? ds : periodKey === "tarde" ? le : de;
  const periodEnd   = periodKey === "manha" ? ls : periodKey === "tarde" ? de : null;

  if (periodTasks.length === 0) return { time: minsToStr(periodStart), full: false };

  const sorted = [...periodTasks].sort((a, b) => strToMins(a.scheduled_time) - strToMins(b.scheduled_time));
  const last = sorted[sorted.length - 1];
  const nextStart = strToMins(last.scheduled_time) + (last.duration_minutes ?? defaultDuration);

  if (periodEnd !== null && nextStart >= periodEnd) {
    return { time: minsToStr(periodStart), full: true };
  }
  return { time: minsToStr(nextStart), full: false };
}

// Retorna slots disponíveis para todos os períodos
export function computeAvailableSlots(todayTasks, settings) {
  const tasksWithTime = todayTasks.filter((t) => t.scheduled_time);
  const byPeriod = (key) => tasksWithTime.filter((t) => getPeriod(t.scheduled_time, settings) === key);
  return {
    manha: nextSlotInPeriod("manha", byPeriod("manha"), settings, settings.defaultDurationMinutes),
    tarde: nextSlotInPeriod("tarde", byPeriod("tarde"), settings, settings.defaultDurationMinutes),
    noite: nextSlotInPeriod("noite", byPeriod("noite"), settings, settings.defaultDurationMinutes),
  };
}
