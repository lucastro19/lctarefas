import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { useSettingsStore, minutesToTime } from "./settingsStore";
import { useUiStore } from "./uiStore";

const today = () => new Date().toISOString().split("T")[0];
const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
};

const active = (t) => !t.completed_at && !t.deleted_at && !t.archived_at;

// Calcula o próximo horário sequencial para uma data, baseado nas tarefas existentes
function nextSequentialTime(date, existingTasks) {
  const { dayStart, defaultDurationMinutes } = useSettingsStore.getState();
  const [h, m] = dayStart.split(":").map(Number);
  let cursor = h * 60 + m;
  const isToday = date === today();
  const dateTasks = existingTasks
    .filter((t) =>
      (isToday ? t.scheduled_date && t.scheduled_date <= date : t.scheduled_date === date) &&
      !t.completed_at && !t.deleted_at && !t.archived_at
    )
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  for (const t of dateTasks) {
    cursor += t.duration_minutes ?? defaultDurationMinutes;
  }
  return minutesToTime(cursor);
}

function nextRecurrenceDate(recurrence, fromDate) {
  const base = fromDate ? new Date(fromDate + "T12:00:00") : new Date();
  const d = new Date(base);
  if (recurrence === "daily") {
    d.setDate(d.getDate() + 1);
  } else if (recurrence === "weekdays") {
    d.setDate(d.getDate() + 1);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  } else if (recurrence === "weekly") {
    d.setDate(d.getDate() + 7);
  } else if (recurrence === "monthly") {
    d.setMonth(d.getMonth() + 1);
  } else {
    return null;
  }
  return d.toISOString().split("T")[0];
}

const nextFullHour = () => {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return `${String(d.getHours()).padStart(2, "0")}:00`;
};


export const useTaskStore = create((set, get) => ({
  tasks: [],
  subtasks: {},
  loading: false,

  // --- Load ---
  fetchTasks: async () => {
    set({ loading: true });
    const { data } = await supabase
      .from("tasks")
      .select("*, projects(deleted_at), areas(deleted_at)")
      .is("deleted_at", null)
      .order("position", { ascending: true });
    const tasks = (data ?? [])
      .filter((t) => !t.projects?.deleted_at && !t.areas?.deleted_at)
      .map(({ projects: _p, areas: _a, ...t }) => t);
    set({ tasks, loading: false });
  },

  fetchSubtasks: async (taskId) => {
    const { data } = await supabase
      .from("subtasks")
      .select("*")
      .eq("task_id", taskId)
      .order("position", { ascending: true });
    set((s) => ({ subtasks: { ...s.subtasks, [taskId]: data ?? [] } }));
  },

  // --- Create ---
  createTask: async (fields) => {
    const { data: { user } } = await supabase.auth.getUser();
    const autoTime = fields.scheduled_date
      ? { scheduled_time: nextSequentialTime(fields.scheduled_date, get().tasks) }
      : {};
    const { data, error } = await supabase
      .from("tasks")
      .insert([{ duration_minutes: 30, ...autoTime, ...fields, user_id: user.id }])
      .select()
      .single();
    if (error) {
      console.error("createTask error:", error);
      alert("Erro ao criar tarefa: " + error.message + "\n\nVerifique se rodou as migrations no Supabase.");
      return null;
    }
    if (data) set((s) => ({ tasks: [data, ...s.tasks] }));
    return data;
  },

  // --- Update ---
  updateTask: async (id, fields) => {
    const { data } = await supabase
      .from("tasks")
      .update(fields)
      .eq("id", id)
      .select()
      .single();
    if (data) set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? data : t)) }));
    return data;
  },

  // --- Complete/Uncomplete ---
  completeTask: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    await get().updateTask(id, { completed_at: new Date().toISOString() });
    useUiStore.getState().showToast({
      message: "Tarefa concluída",
      action: "Desfazer",
      onAction: () => get().uncompleteTask(id),
    });
    if (task?.recurrence) {
      const next = nextRecurrenceDate(task.recurrence, task.scheduled_date);
      if (next) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data } = await supabase.from("tasks").insert([{
          title: task.title,
          notes: task.notes,
          area_id: task.area_id,
          project_id: task.project_id,
          scheduled_date: next,
          scheduled_time: task.scheduled_time,
          duration_minutes: task.duration_minutes,
          recurrence: task.recurrence,
          someday: false,
          position: 0,
          user_id: user.id,
        }]).select().single();
        if (data) {
          set((s) => ({ tasks: [data, ...s.tasks] }));
          // Herda as tags da tarefa original
          const { data: tagRows } = await supabase
            .from("task_tags")
            .select("tag_id")
            .eq("task_id", id);
          if (tagRows?.length) {
            await supabase.from("task_tags").insert(
              tagRows.map((r) => ({ task_id: data.id, tag_id: r.tag_id }))
            );
          }
        }
      }
    }
  },
  uncompleteTask: async (id) => get().updateTask(id, { completed_at: null }),

  // --- Archive (tarefas arquivadas somem das listas mas ficam acessíveis no Arquivo) ---
  archiveTask: async (id) => get().updateTask(id, { archived_at: new Date().toISOString() }),
  unarchiveTask: async (id) => get().updateTask(id, { archived_at: null }),

  // --- Mover para Hoje ---
  moveToToday: async (id) => {
    const t = today();
    const time = nextSequentialTime(t, get().tasks.filter((task) => task.id !== id));
    return get().updateTask(id, { scheduled_date: t, someday: false, archived_at: null, scheduled_time: time });
  },

  // --- Mover para Depois ---
  moveToSomeday: async (id) =>
    get().updateTask(id, { someday: true, scheduled_date: null, archived_at: null }),

  // --- Ações em lote ---
  bulkUpdate: async (ids, fields) => {
    await Promise.all(ids.map((id) => supabase.from("tasks").update(fields).eq("id", id)));
    set((s) => ({ tasks: s.tasks.map((t) => (ids.includes(t.id) ? { ...t, ...fields } : t)) }));
  },

  bulkMoveToToday: async (ids) => {
    const t = today();
    const { dayStart, defaultDurationMinutes } = useSettingsStore.getState();
    const [h, m] = dayStart.split(":").map(Number);
    let cursor = h * 60 + m;

    const allTasks = get().tasks;
    const existingToday = allTasks
      .filter((task) =>
        !ids.includes(task.id) &&
        task.scheduled_date && task.scheduled_date <= t &&
        !task.completed_at && !task.deleted_at && !task.archived_at
      )
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    for (const task of existingToday) {
      cursor += task.duration_minutes ?? defaultDurationMinutes;
    }

    const updates = ids.map((id) => {
      const task = allTasks.find((tk) => tk.id === id);
      const time = minutesToTime(cursor);
      cursor += task?.duration_minutes ?? defaultDurationMinutes;
      return { id, time };
    });

    await Promise.all(
      updates.map(({ id, time }) =>
        supabase.from("tasks").update({
          scheduled_date: t, someday: false, archived_at: null, scheduled_time: time,
        }).eq("id", id)
      )
    );

    set((s) => ({
      tasks: s.tasks.map((task) => {
        const u = updates.find((upd) => upd.id === task.id);
        if (!u) return task;
        return { ...task, scheduled_date: t, someday: false, archived_at: null, scheduled_time: u.time };
      }),
    }));
  },

  // --- Reordenar tarefas e recalcular horários ---
  reorderTasks: async (reordered, timeUpdates = []) => {
    // Atualiza store imediatamente (otimista)
    const timeMap = Object.fromEntries(timeUpdates.map((u) => [u.id, u.scheduled_time]));
    set((s) => ({
      tasks: reordered.map((t, i) => ({
        ...t,
        position: i,
        ...(timeMap[t.id] !== undefined ? { scheduled_time: timeMap[t.id] } : {}),
      })),
    }));
    // Persiste no banco em paralelo
    await Promise.all(
      reordered.map((task, index) => {
        const fields = { position: index };
        if (timeMap[task.id] !== undefined) fields.scheduled_time = timeMap[task.id];
        return supabase.from("tasks").update(fields).eq("id", task.id);
      })
    );
  },

  // --- Duplicate ---
  duplicateTask: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from("tasks").insert([{
      title: task.title + " (cópia)",
      notes: task.notes,
      area_id: task.area_id,
      project_id: task.project_id,
      scheduled_date: task.scheduled_date,
      scheduled_time: task.scheduled_time,
      duration_minutes: task.duration_minutes,
      recurrence: task.recurrence,
      someday: task.someday,
      is_urgent: task.is_urgent,
      position: (task.position ?? 0) + 1,
      user_id: user.id,
    }]).select().single();
    if (data) set((s) => ({ tasks: [data, ...s.tasks] }));
    useUiStore.getState().showToast({ message: "Tarefa duplicada" });
  },

  // --- Soft delete ---
  deleteTask: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    await get().updateTask(id, { deleted_at: new Date().toISOString() });
    useUiStore.getState().showToast({
      message: `"${task?.title ?? "Tarefa"}" na lixeira`,
      action: "Desfazer",
      onAction: () => get().restoreTask(id),
    });
  },
  restoreTask: async (id) => get().updateTask(id, { deleted_at: null }),
  permanentDeleteTask: async (id) => {
    await supabase.from("tasks").delete().eq("id", id);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
  },

  // --- Subtasks ---
  createSubtask: async (taskId, title) => {
    const existing = get().subtasks[taskId] ?? [];
    const { data } = await supabase
      .from("subtasks")
      .insert([{ task_id: taskId, title, position: existing.length }])
      .select()
      .single();
    if (data)
      set((s) => ({ subtasks: { ...s.subtasks, [taskId]: [...(s.subtasks[taskId] ?? []), data] } }));
  },

  toggleSubtask: async (taskId, subtaskId, completed) => {
    await supabase.from("subtasks").update({ completed }).eq("id", subtaskId);
    set((s) => ({
      subtasks: {
        ...s.subtasks,
        [taskId]: (s.subtasks[taskId] ?? []).map((st) =>
          st.id === subtaskId ? { ...st, completed } : st
        ),
      },
    }));
  },

  updateSubtask: async (taskId, subtaskId, title) => {
    await supabase.from("subtasks").update({ title }).eq("id", subtaskId);
    set((s) => ({
      subtasks: {
        ...s.subtasks,
        [taskId]: (s.subtasks[taskId] ?? []).map((st) =>
          st.id === subtaskId ? { ...st, title } : st
        ),
      },
    }));
  },

  deleteSubtask: async (taskId, subtaskId) => {
    await supabase.from("subtasks").delete().eq("id", subtaskId);
    set((s) => ({
      subtasks: {
        ...s.subtasks,
        [taskId]: (s.subtasks[taskId] ?? []).filter((st) => st.id !== subtaskId),
      },
    }));
  },

  // --- Filtered views (todas excluem arquivadas) ---
  getInbox: () =>
    get().tasks.filter(
      (t) => !t.project_id && !t.area_id && !t.someday && !t.scheduled_date && active(t)
    ),

  getToday: () =>
    get().tasks.filter(
      (t) => t.scheduled_date && t.scheduled_date <= today() && active(t)
    ),

  getUpcoming: () =>
    get().tasks.filter(
      (t) =>
        t.scheduled_date &&
        t.scheduled_date > today() &&
        t.scheduled_date <= inDays(7) &&
        active(t)
    ),

  getSomeday: () => get().tasks.filter((t) => t.someday && active(t)),

  getTrash: () => {
    const limit = inDays(-30);
    return get().tasks.filter((t) => t.deleted_at && t.deleted_at >= limit);
  },

  getArchived: () => get().tasks.filter((t) => t.archived_at && !t.deleted_at),

  getByArea: (areaId) =>
    get().tasks.filter((t) => t.area_id === areaId && !t.project_id && active(t)),

  getByProject: (projectId) =>
    get().tasks.filter((t) => t.project_id === projectId && active(t)),

  // --- Completed sections ---
  getCompletedInbox: () =>
    get().tasks.filter((t) => !t.project_id && !t.area_id && !!t.completed_at && !t.deleted_at),

  getCompletedToday: () => {
    const t = today();
    return get().tasks.filter(
      (task) => task.completed_at && task.scheduled_date && task.scheduled_date <= t && !task.deleted_at && !task.archived_at
    );
  },

  getCompletedSomeday: () =>
    get().tasks.filter((t) => t.someday && !!t.completed_at && !t.deleted_at && !t.archived_at),

  getCompletedByProject: (projectId) =>
    get().tasks.filter((t) => t.project_id === projectId && !!t.completed_at && !t.deleted_at),

  getCompletedByArea: (areaId) =>
    get().tasks.filter((t) => t.area_id === areaId && !t.project_id && !!t.completed_at && !t.deleted_at),

  getAllCompleted: () =>
    get().tasks
      .filter((t) => !!t.completed_at && !t.deleted_at)
      .sort((a, b) => b.completed_at.localeCompare(a.completed_at)),
}));
