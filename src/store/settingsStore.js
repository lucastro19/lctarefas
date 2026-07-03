import { create } from "zustand";
import { persist } from "zustand/middleware";

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else if (theme === "light") root.classList.remove("dark");
  else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
  }
}

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      dayStart: "09:00",
      defaultDurationMinutes: 30,
      theme: "auto",
      tabBarIds: ["inbox", "today", "upcoming", "someday"],

      setDayStart: (v) => set({ dayStart: v }),
      setDefaultDuration: (v) => set({ defaultDurationMinutes: Number(v) }),
      setTabBarIds: (v) => set({ tabBarIds: v }),
      setTheme: (v) => {
        set({ theme: v });
        applyTheme(v);
      },

      calcTimes: (tasks) => {
        const { dayStart, defaultDurationMinutes } = get();
        const [h, m] = dayStart.split(":").map(Number);
        let cursor = h * 60 + m;
        return tasks.map((task) => {
          const time = minutesToTime(cursor);
          cursor += task.duration_minutes ?? defaultDurationMinutes;
          return { id: task.id, scheduled_time: time };
        });
      },
    }),
    { name: "lctarefas-settings" }
  )
);

export function minutesToTime(total) {
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function durationLabel(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export const DURATION_PRESETS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1 hora", value: 60 },
  { label: "1h 30min", value: 90 },
  { label: "2 horas", value: 120 },
];
