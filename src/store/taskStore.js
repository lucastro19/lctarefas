import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { supabase } from "../lib/supabase";
import { useSettingsStore, minutesToTime } from "./settingsStore";
import { useUiStore } from "./uiStore";
import { useAuthStore } from "./authStore";
import { cancelNotification } from "../services/notifications";

const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => localDate();
const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localDate(d);
};

const active = (t) => !t.completed_at && !t.deleted_at && !t.archived_at;

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
  } else if (recurrence === "biweekly") {
    d.setDate(d.getDate() + 14);
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

export const useTaskStore = create(
  persist(
    (set, get) => ({
      tasks: [],
      subtasks: {},
      offlineQueue: [], // [{ qid, op, taskId?, tempId?, fields? }]
      loading: false,
      _creating: false,
      _realtimeUnsub: null, // não persiste (função)

      // --- Load ---
      fetchTasks: async () => {
        set({ loading: true });
        const { data, error } = await supabase
          .from("tasks")
          .select("*, projects(deleted_at), areas(deleted_at)")
          .is("deleted_at", null)
          .order("position", { ascending: true });

        if (!error && data) {
          const tasks = data
            .filter((t) => !t.projects?.deleted_at && !t.areas?.deleted_at)
            .map(({ projects: _p, areas: _a, ...t }) => t);
          set({ tasks, loading: false });
          // Drena fila pendente sobre os dados frescos do servidor
          setTimeout(() => get().drainQueue(), 200);
        } else {
          set({ loading: false });
        }
      },

      fetchSubtasks: async (taskId) => {
        const { data } = await supabase
          .from("subtasks")
          .select("*")
          .eq("task_id", taskId)
          .order("position", { ascending: true });
        set((s) => ({ subtasks: { ...s.subtasks, [taskId]: data ?? [] } }));
      },

      // --- Offline queue ---
      drainQueue: async () => {
        if (!navigator.onLine) return;
        const queue = [...get().offlineQueue];
        if (queue.length === 0) return;

        const user = useAuthStore.getState().user;
        if (!user?.id) return;

        const processed = [];

        for (const item of queue) {
          try {
            if (item.op === "update") {
              const { data } = await supabase
                .from("tasks")
                .update(item.fields)
                .eq("id", item.taskId)
                .select()
                .single();
              if (data) {
                set((s) => ({ tasks: s.tasks.map((t) => (t.id === item.taskId ? data : t)) }));
              }
              processed.push(item.qid);
            } else if (item.op === "create") {
              const { data } = await supabase
                .from("tasks")
                .insert([{ ...item.fields, user_id: user.id }])
                .select()
                .single();
              if (data) {
                set((s) => ({
                  tasks: s.tasks.map((t) => (t.id === item.tempId ? data : t)),
                }));
                processed.push(item.qid);
              }
            } else if (item.op === "permanentDelete") {
              await supabase.from("tasks").delete().eq("id", item.taskId);
              processed.push(item.qid);
            }
          } catch (e) {
            console.error("drainQueue item failed:", item.op, e);
            processed.push(item.qid); // pula item com erro para não travar a fila
          }
        }

        if (processed.length > 0) {
          set((s) => ({
            offlineQueue: s.offlineQueue.filter((q) => !processed.includes(q.qid)),
          }));
        }
      },

      // --- Create ---
      createTask: async (fields) => {
        if (get()._creating) return null;
        // Usa o user do authStore (já em memória, sem requisição de rede)
        const user = useAuthStore.getState().user;
        if (!user?.id) return null;
        set({ _creating: true });

        try {
          const autoTime = fields.scheduled_date && !fields.scheduled_time
            ? { scheduled_time: nextSequentialTime(fields.scheduled_date, get().tasks) }
            : {};
          const fullFields = { duration_minutes: 30, ...autoTime, ...fields, user_id: user.id };

          // Otimismo: adiciona IMEDIATAMENTE com ID temporário, antes de qualquer await
          const tempId = `temp_${Date.now()}`;
          const optimistic = {
            ...fullFields,
            id: tempId,
            created_at: new Date().toISOString(),
            completed_at: null,
            deleted_at: null,
            archived_at: null,
            position: 0,
            someday: fields.someday ?? false,
          };
          set((s) => ({ tasks: [optimistic, ...s.tasks] }));

          if (!navigator.onLine) {
            set((s) => ({
              offlineQueue: [...s.offlineQueue, { qid: Date.now(), op: "create", tempId, fields: fullFields }],
            }));
            return optimistic;
          }

          const { data, error } = await supabase
            .from("tasks")
            .insert([fullFields])
            .select()
            .single();

          if (error) {
            // Remove o otimista apenas se foi erro não-rede (rede = fica na fila)
            const isNetworkErr = !navigator.onLine || error.message?.includes("fetch");
            if (isNetworkErr) {
              set((s) => ({
                offlineQueue: [...s.offlineQueue, { qid: Date.now(), op: "create", tempId, fields: fullFields }],
              }));
            } else {
              set((s) => ({ tasks: s.tasks.filter((t) => t.id !== tempId) }));
              console.error("createTask error:", error);
              alert("Erro ao criar tarefa: " + error.message + "\n\nVerifique se rodou as migrations no Supabase.");
            }
            return null;
          }

          if (data) {
            // Substitui tempId pelo ID real, preservando campos relacionais que o Supabase
            // pode omitir quando a migration ainda não foi aplicada (area_id, project_id, etc.)
            const merged = { ...data };
            if (fields.area_id   && !merged.area_id)   merged.area_id   = fields.area_id;
            if (fields.project_id && !merged.project_id) merged.project_id = fields.project_id;
            set((s) => ({ tasks: s.tasks.map((t) => (t.id === tempId ? merged : t)) }));
          }

          return data;
        } finally {
          set({ _creating: false });
        }
      },

      // --- Update (otimista: estado local primeiro, Supabase em background) ---
      updateTask: async (id, fields) => {
        // Atualiza local imediatamente — resolve o bug de horário no Inbox
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...fields } : t)),
        }));

        // ID temporário (task criada offline ainda não foi enviada)
        if (String(id).startsWith("temp_")) {
          set((s) => ({
            offlineQueue: s.offlineQueue.map((q) =>
              q.op === "create" && q.tempId === id
                ? { ...q, fields: { ...q.fields, ...fields } }
                : q
            ),
          }));
          return { id, ...fields };
        }

        if (!navigator.onLine) {
          set((s) => ({
            offlineQueue: [...s.offlineQueue, { qid: Date.now(), op: "update", taskId: id, fields }],
          }));
          return;
        }

        const { data, error } = await supabase
          .from("tasks")
          .update(fields)
          .eq("id", id)
          .select()
          .single();

        if (error) {
          console.error("updateTask:", error.message, "fields:", fields);
          // Se falhou por rede, enfileira para retry
          set((s) => ({
            offlineQueue: [...s.offlineQueue, { qid: Date.now(), op: "update", taskId: id, fields }],
          }));
          return null;
        }

        if (data) {
          set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? data : t)) }));
        }

        return data;
      },

      // --- Complete/Uncomplete ---
      completeTask: async (id) => {
        const task = get().tasks.find((t) => t.id === id);
        cancelNotification(id);
        await get().updateTask(id, { completed_at: new Date().toISOString() });
        useUiStore.getState().showToast({
          message: "Tarefa concluída",
          action: "Desfazer",
          onAction: () => get().uncompleteTask(id),
        });
        if (task?.recurrence) {
          const next = nextRecurrenceDate(task.recurrence, task.scheduled_date);
          if (next) {
            const user = useAuthStore.getState().user;
            if (!user?.id) return;
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

      // --- Archive ---
      archiveTask: async (id) => get().updateTask(id, { archived_at: new Date().toISOString() }),
      unarchiveTask: async (id) => get().updateTask(id, { archived_at: null }),

      // --- Mover para Hoje ---
      moveToToday: async (id) => {
        const t = today();
        const time = nextSequentialTime(t, get().tasks.filter((task) => task.id !== id));
        const result = await get().updateTask(id, { scheduled_date: t, someday: false, archived_at: null, scheduled_time: time });
        if (result) useUiStore.getState().showToast({ message: "Tarefa movida para Hoje ☀️" });
        return result;
      },

      // --- Mover para Depois ---
      moveToSomeday: async (id) =>
        get().updateTask(id, { someday: true, scheduled_date: null, archived_at: null }),

      // --- Ações em lote ---
      bulkUpdate: async (ids, fields) => {
        // Otimismo local
        set((s) => ({ tasks: s.tasks.map((t) => (ids.includes(t.id) ? { ...t, ...fields } : t)) }));
        if (navigator.onLine) {
          await Promise.all(ids.map((id) => supabase.from("tasks").update(fields).eq("id", id)));
        } else {
          ids.forEach((id) => {
            set((s) => ({
              offlineQueue: [...s.offlineQueue, { qid: Date.now() + Math.random(), op: "update", taskId: id, fields }],
            }));
          });
        }
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

        set((s) => ({
          tasks: s.tasks.map((task) => {
            const u = updates.find((upd) => upd.id === task.id);
            if (!u) return task;
            return { ...task, scheduled_date: t, someday: false, archived_at: null, scheduled_time: u.time };
          }),
        }));

        if (navigator.onLine) {
          await Promise.all(
            updates.map(({ id, time }) =>
              supabase.from("tasks").update({
                scheduled_date: t, someday: false, archived_at: null, scheduled_time: time,
              }).eq("id", id)
            )
          );
        }
      },

      // --- Reordenar ---
      reorderTasks: async (reordered, timeUpdates = []) => {
        const timeMap = Object.fromEntries(timeUpdates.map((u) => [u.id, u.scheduled_time]));
        set((s) => ({
          tasks: reordered.map((t, i) => ({
            ...t,
            position: i,
            ...(timeMap[t.id] !== undefined ? { scheduled_time: timeMap[t.id] } : {}),
          })),
        }));
        if (navigator.onLine) {
          await Promise.all(
            reordered.map((task, index) => {
              const fields = { position: index };
              if (timeMap[task.id] !== undefined) fields.scheduled_time = timeMap[task.id];
              return supabase.from("tasks").update(fields).eq("id", task.id);
            })
          );
        }
      },

      // --- Duplicate ---
      duplicateTask: async (id) => {
        const task = get().tasks.find((t) => t.id === id);
        if (!task) return;
        const user = useAuthStore.getState().user;
        if (!user?.id) return;
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

      deleteRecurrenceFuture: async (id) => {
        const task = get().tasks.find((t) => t.id === id);
        if (!task) return;

        const now = new Date().toISOString().split("T")[0];
        const { data: siblings } = await supabase
          .from("tasks")
          .select("id")
          .eq("title", task.title)
          .eq("recurrence", task.recurrence)
          .eq("user_id", task.user_id)
          .gte("scheduled_date", task.scheduled_date ?? now)
          .is("completed_at", null)
          .is("deleted_at", null);

        const idsToDelete = (siblings ?? []).map((s) => s.id);
        if (idsToDelete.length === 0) {
          await get().deleteTask(id);
          return;
        }

        const deletedAt = new Date().toISOString();
        set((s) => ({
          tasks: s.tasks.map((t) =>
            idsToDelete.includes(t.id) ? { ...t, deleted_at: deletedAt } : t
          ),
        }));
        if (navigator.onLine) {
          await supabase.from("tasks").update({ deleted_at: deletedAt }).in("id", idsToDelete);
        }
        useUiStore.getState().showToast({
          message: `${idsToDelete.length} lembrete${idsToDelete.length > 1 ? "s" : ""} na lixeira`,
        });
      },

      restoreTask: async (id) => get().updateTask(id, { deleted_at: null }),

      permanentDeleteTask: async (id) => {
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
        if (navigator.onLine) {
          await supabase.from("tasks").delete().eq("id", id);
        } else {
          set((s) => ({
            offlineQueue: [...s.offlineQueue, { qid: Date.now(), op: "permanentDelete", taskId: id }],
          }));
        }
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
        set((s) => ({
          subtasks: {
            ...s.subtasks,
            [taskId]: (s.subtasks[taskId] ?? []).map((st) =>
              st.id === subtaskId ? { ...st, completed } : st
            ),
          },
        }));
        if (navigator.onLine) {
          await supabase.from("subtasks").update({ completed }).eq("id", subtaskId);
        }
      },

      updateSubtask: async (taskId, subtaskId, title) => {
        set((s) => ({
          subtasks: {
            ...s.subtasks,
            [taskId]: (s.subtasks[taskId] ?? []).map((st) =>
              st.id === subtaskId ? { ...st, title } : st
            ),
          },
        }));
        if (navigator.onLine) {
          await supabase.from("subtasks").update({ title }).eq("id", subtaskId);
        }
      },

      deleteSubtask: async (taskId, subtaskId) => {
        set((s) => ({
          subtasks: {
            ...s.subtasks,
            [taskId]: (s.subtasks[taskId] ?? []).filter((st) => st.id !== subtaskId),
          },
        }));
        if (navigator.onLine) {
          await supabase.from("subtasks").delete().eq("id", subtaskId);
        }
      },

      // --- Realtime ---
      subscribeRealtime: () => {
        if (get()._realtimeUnsub) return; // já inscrito

        const channel = supabase
          .channel("lctarefas-tasks")
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks" }, (payload) => {
            // Ignora se já temos (pode ser nossa própria criação)
            if (get().tasks.find((t) => t.id === payload.new.id)) return;
            set((s) => ({ tasks: [payload.new, ...s.tasks] }));
          })
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks" }, (payload) => {
            // Não sobrescreve se há item pendente na fila para esta tarefa
            const hasPending = get().offlineQueue.some((q) => q.taskId === payload.new.id);
            if (!hasPending) {
              set((s) => ({
                tasks: s.tasks.map((t) => (t.id === payload.new.id ? payload.new : t)),
              }));
            }
          })
          .on("postgres_changes", { event: "DELETE", schema: "public", table: "tasks" }, (payload) => {
            set((s) => ({ tasks: s.tasks.filter((t) => t.id !== payload.old.id) }));
          })
          .subscribe();

        const unsub = () => {
          supabase.removeChannel(channel);
          set({ _realtimeUnsub: null });
        };
        set({ _realtimeUnsub: unsub });
        return unsub;
      },

      unsubscribeRealtime: () => {
        const unsub = get()._realtimeUnsub;
        if (unsub) unsub();
      },

      // --- Filtered views ---
      getInbox: () =>
        get().tasks.filter(
          (t) => !t.project_id && !t.area_id && !t.someday && !t.scheduled_date && active(t)
        ),

      getToday: () =>
        get().tasks.filter(
          (t) => t.scheduled_date && t.scheduled_date <= today() && active(t)
        ),

      getUpcoming: (days = null) =>
        get().tasks.filter(
          (t) =>
            t.scheduled_date &&
            t.scheduled_date > today() &&
            (days === null || t.scheduled_date <= inDays(days)) &&
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

      // --- Completed sections (sempre ordenadas por conclusão decrescente) ---
      getCompletedInbox: () =>
        get().tasks
          .filter((t) => !t.project_id && !t.area_id && !!t.completed_at && !t.deleted_at)
          .sort((a, b) => b.completed_at.localeCompare(a.completed_at)),

      getCompletedToday: () => {
        const t = today();
        return get().tasks
          .filter((task) => {
            if (!task.completed_at || task.deleted_at || task.archived_at) return false;
            return task.completed_at.slice(0, 10) === t;
          })
          .sort((a, b) => b.completed_at.localeCompare(a.completed_at));
      },

      getCompletedSomeday: () =>
        get().tasks
          .filter((t) => t.someday && !!t.completed_at && !t.deleted_at && !t.archived_at)
          .sort((a, b) => b.completed_at.localeCompare(a.completed_at)),

      getCompletedByProject: (projectId) =>
        get().tasks
          .filter((t) => t.project_id === projectId && !!t.completed_at && !t.deleted_at)
          .sort((a, b) => b.completed_at.localeCompare(a.completed_at)),

      getCompletedByArea: (areaId) =>
        get().tasks
          .filter((t) => t.area_id === areaId && !t.project_id && !!t.completed_at && !t.deleted_at)
          .sort((a, b) => b.completed_at.localeCompare(a.completed_at)),

      getAllCompleted: () =>
        get().tasks
          .filter((t) => !!t.completed_at && !t.deleted_at)
          .sort((a, b) => b.completed_at.localeCompare(a.completed_at)),
    }),
    {
      name: "lctarefas-v1",
      storage: createJSONStorage(() => localStorage),
      // Persiste apenas os dados; exclui estado efêmero e não-serializável
      partialize: (state) => ({
        tasks: state.tasks,
        subtasks: state.subtasks,
        offlineQueue: state.offlineQueue,
      }),
    }
  )
);
