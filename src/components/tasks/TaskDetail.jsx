import { useState, useEffect, useRef } from "react";
import { useTaskStore } from "../../store/taskStore";
import { useTagStore } from "../../store/tagStore";
import { useAreaStore } from "../../store/areaStore";
import { useAuthStore } from "../../store/authStore";
import { DURATION_PRESETS, durationLabel } from "../../store/settingsStore";
import { sendUrgentPush } from "../../lib/pushNotifications";

function localDateStr(d = new Date()) {
  return (
    d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

function nextMonday() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7;
  d.setDate(d.getDate() + daysUntilMonday);
  return localDateStr(d);
}

const TAG_COLORS = ["#8E8E93", "#4F8EF7", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#FF2D55", "#5AC8FA"];

export function TaskDetail({ task, onClose }) {
  const { updateTask, deleteTask, archiveTask, subtasks, fetchSubtasks, createSubtask, toggleSubtask, updateSubtask, deleteSubtask } = useTaskStore();
  const { tags, taskTags, fetchTaskTags, fetchTags, createTag, addTagToTask, removeTagFromTask } = useTagStore();
  const { areas, projects } = useAreaStore();
  const { session } = useAuthStore();

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [scheduledDate, setScheduledDate] = useState(task.scheduled_date ?? "");
  const [scheduledTime, setScheduledTime] = useState(task.scheduled_time ?? "");
  const [deadline, setDeadline] = useState(task.deadline ?? "");
  const [someday, setSomeday] = useState(task.someday);
  const [isUrgent, setIsUrgent] = useState(!!task.is_urgent);
  const [durationMinutes, setDurationMinutes] = useState(task.duration_minutes ?? "");
  const [customDuration, setCustomDuration] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#4F8EF7");
  const [saving, setSaving] = useState(false);
  const [showContextPicker, setShowContextPicker] = useState(false);
  const contextPickerRef = useRef(null);
  const [localAreaId, setLocalAreaId] = useState(task.area_id ?? null);
  const [localProjectId, setLocalProjectId] = useState(task.project_id ?? null);

  const taskSubtasks = subtasks[task.id] ?? [];
  const taskTagList = taskTags[task.id] ?? [];

  useEffect(() => {
    fetchSubtasks(task.id);
    fetchTaskTags(task.id);
    fetchTags();
  }, [task.id]);

  // Close context picker on outside click
  useEffect(() => {
    const handler = (e) => {
      if (contextPickerRef.current && !contextPickerRef.current.contains(e.target))
        setShowContextPicker(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  const save = async (extra = {}) => {
    setSaving(true);
    await updateTask(task.id, { title, notes: notes || null, scheduled_date: scheduledDate || null, deadline: deadline || null, someday, ...extra });
    setSaving(false);
  };

  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    await createSubtask(task.id, newSubtask.trim());
    setNewSubtask("");
  };

  const handleDelete = async () => {
    await deleteTask(task.id);
    onClose();
  };

  const handleArchive = async () => {
    await archiveTask(task.id);
    onClose();
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    const tag = await createTag(newTagName.trim(), newTagColor);
    if (tag) {
      await addTagToTask(task.id, tag.id);
      setNewTagName("");
      setNewTagColor("#4F8EF7");
      setCreatingTag(false);
      setShowTagPicker(false);
    }
  };

  const handleContextChange = async (val) => {
    if (val === "") {
      setLocalAreaId(null);
      setLocalProjectId(null);
      await updateTask(task.id, { project_id: null, area_id: null });
    } else if (val.startsWith("area:")) {
      const id = val.replace("area:", "");
      setLocalAreaId(id);
      setLocalProjectId(null);
      await updateTask(task.id, { area_id: id, project_id: null });
    } else if (val.startsWith("project:")) {
      const id = val.replace("project:", "");
      setLocalProjectId(id);
      setLocalAreaId(null);
      await updateTask(task.id, { project_id: id, area_id: null });
    }
  };

  const availableTags = tags.filter((t) => !taskTagList.find((tt) => tt.id === t.id));

  return (
    <>
      {/* Mobile backdrop */}
      <div className="md:hidden fixed inset-0 bg-black/30 z-40" onClick={onClose} />
    <aside
      className="fixed bottom-0 left-0 right-0 z-50 md:static md:inset-auto md:z-auto md:w-96 md:border-l border-border bg-card md:h-full overflow-y-auto flex flex-col rounded-t-2xl md:rounded-none animate-slide-up md:[animation:none]"
      style={{ maxHeight: "92dvh" }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Drag handle (mobile only) */}
      <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
        <div className="w-10 h-1 rounded-full bg-border" />
      </div>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <button onClick={onClose} className="md:hidden flex items-center gap-1 text-primary text-sm font-medium">
          ← Voltar
        </button>
        <span className="hidden md:block text-xs text-text-secondary font-medium uppercase tracking-wide">Detalhe</span>
        <button onClick={onClose} className="text-text-secondary hover:text-text-main text-lg leading-none">×</button>
      </div>

      <div className="flex-1 px-5 py-4 space-y-5">
        {/* Title */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => save()}
          className="w-full font-semibold text-xl text-text-main outline-none bg-transparent border-b border-transparent focus:border-border pb-1"
        />

        {/* Context (projeto / área) — visual picker */}
        <div ref={contextPickerRef} className="relative">
          <label className="text-xs text-text-secondary font-medium block mb-1">📂 Contexto</label>
          <button
            onClick={() => setShowContextPicker((v) => !v)}
            className="w-full flex items-center gap-2 text-xs bg-bg border border-border rounded-lg px-3 py-2 outline-none text-left hover:border-primary/50 transition-colors"
          >
            {localProjectId ? (
              <>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: projects.find((p) => p.id === localProjectId)?.color ?? "#8E8E93" }} />
                <span className="flex-1 text-text-main truncate">{projects.find((p) => p.id === localProjectId)?.name ?? "Projeto"}</span>
              </>
            ) : localAreaId ? (
              <>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: areas.find((a) => a.id === localAreaId)?.color ?? "#8E8E93" }} />
                <span className="flex-1 text-text-main truncate">{areas.find((a) => a.id === localAreaId)?.name ?? "Área"}</span>
              </>
            ) : (
              <span className="flex-1 text-text-secondary">Inbox (sem contexto)</span>
            )}
            <span className="text-text-secondary text-[10px]">▾</span>
          </button>

          {showContextPicker && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-50 py-1.5 max-h-64 overflow-y-auto">
              <button
                onClick={() => { handleContextChange(""); setShowContextPicker(false); }}
                className={["w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors hover:bg-bg", !localProjectId && !localAreaId ? "text-primary font-medium" : "text-text-secondary"].join(" ")}
              >
                <span className="w-2 h-2 rounded-full bg-[#8E8E93] shrink-0" />
                Inbox (sem contexto)
              </button>
              {areas.length > 0 && <div className="h-px bg-border mx-2 my-1" />}
              {areas.map((area) => {
                const areaProjects = projects.filter((p) => p.area_id === area.id);
                return (
                  <div key={area.id}>
                    <button
                      onClick={() => { handleContextChange(`area:${area.id}`); setShowContextPicker(false); }}
                      className={["w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors hover:bg-bg font-medium", localAreaId === area.id && !localProjectId ? "text-primary" : "text-text-main"].join(" ")}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: area.color }} />
                      {area.name}
                    </button>
                    {areaProjects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { handleContextChange(`project:${p.id}`); setShowContextPicker(false); }}
                        className={["w-full flex items-center gap-2.5 pl-7 pr-3 py-2 text-xs text-left transition-colors hover:bg-bg", localProjectId === p.id ? "text-primary font-medium" : "text-text-secondary"].join(" ")}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs text-text-secondary font-medium block mb-1">Notas</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => save()}
            rows={3}
            placeholder="Adicionar notas…"
            className="w-full text-sm text-text-main outline-none bg-bg rounded-lg p-2.5 resize-none border border-transparent focus:border-border"
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-text-secondary font-medium block mb-1">📅 Execução</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => { setScheduledDate(e.target.value); updateTask(task.id, { scheduled_date: e.target.value || null }); }}
              className="w-full text-xs bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary"
            />
            <div className="flex gap-1.5 mt-2">
              {[
                { label: "Hoje", date: () => localDateStr() },
                { label: "Amanhã", date: () => addDays(1) },
                { label: "Próx. semana", date: () => nextMonday() },
              ].map(({ label, date }) => (
                <button
                  key={label}
                  onClick={() => { const d = date(); setScheduledDate(d); updateTask(task.id, { scheduled_date: d }); }}
                  className={[
                    "flex-1 text-[11px] py-1 rounded-lg border transition-colors",
                    scheduledDate === date()
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border text-text-secondary hover:border-primary/50 hover:text-text-main",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-text-secondary font-medium block mb-1">🕐 Horário</label>
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              onBlur={(e) => updateTask(task.id, { scheduled_time: e.target.value || null })}
              className="w-full text-xs bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary font-medium block mb-1">🚨 Prazo</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              onBlur={() => save()}
              className="w-full text-xs bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-danger"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary font-medium block mb-1">⏱ Duração</label>
            {!customDuration ? (
              <select
                value={durationMinutes}
                onChange={(e) => {
                  if (e.target.value === "custom") { setCustomDuration(true); return; }
                  const v = e.target.value ? Number(e.target.value) : null;
                  setDurationMinutes(v ?? "");
                  updateTask(task.id, { duration_minutes: v });
                }}
                className="w-full text-xs bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary"
              >
                <option value="">Sem duração</option>
                {DURATION_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
                <option value="custom">Personalizado…</option>
              </select>
            ) : (
              <div className="flex gap-1 items-center">
                <input
                  type="number"
                  min={0} max={23} placeholder="h"
                  defaultValue={durationMinutes ? Math.floor(Number(durationMinutes) / 60) : ""}
                  className="w-10 text-xs bg-bg border border-border rounded px-1.5 py-1.5 outline-none focus:border-primary"
                  id="dur-h"
                />
                <span className="text-xs text-text-secondary">h</span>
                <input
                  type="number"
                  min={0} max={59} placeholder="min"
                  defaultValue={durationMinutes ? Number(durationMinutes) % 60 : ""}
                  className="w-12 text-xs bg-bg border border-border rounded px-1.5 py-1.5 outline-none focus:border-primary"
                  id="dur-m"
                  onBlur={() => {
                    const h = Number(document.getElementById("dur-h").value) || 0;
                    const m = Number(document.getElementById("dur-m").value) || 0;
                    const total = h * 60 + m;
                    setDurationMinutes(total || "");
                    setCustomDuration(false);
                    updateTask(task.id, { duration_minutes: total || null });
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Recorrência */}
        <div>
          <label className="text-xs text-text-secondary font-medium block mb-1">🔁 Recorrência</label>
          <select
            defaultValue={task.recurrence ?? ""}
            onChange={(e) => updateTask(task.id, { recurrence: e.target.value || null })}
            className="w-full text-xs bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary text-text-main"
          >
            <option value="">Não repetir</option>
            <option value="daily">Diariamente</option>
            <option value="weekdays">Dias úteis (seg–sex)</option>
            <option value="weekly">Semanalmente</option>
            <option value="monthly">Mensalmente</option>
          </select>
        </div>

        {/* Urgente toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={async () => {
              const next = !isUrgent;
              setIsUrgent(next);
              await updateTask(task.id, { is_urgent: next });
              if (next) sendUrgentPush(session?.access_token, title);
            }}
            className={["w-9 h-5 rounded-full transition-colors", isUrgent ? "bg-[#FF3B30]" : "bg-[#C7C7CC]"].join(" ")}
          >
            <div className={["w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform", isUrgent ? "translate-x-4" : "translate-x-0.5"].join(" ")} />
          </div>
          <span className={["text-sm", isUrgent ? "text-[#FF3B30] font-medium" : "text-text-secondary"].join(" ")}>
            {isUrgent ? "🔔 Urgente" : "Urgente"}
          </span>
        </label>

        {/* Someday toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={async () => {
              const next = !someday;
              setSomeday(next);
              await updateTask(task.id, { someday: next });
            }}
            className={["w-9 h-5 rounded-full transition-colors", someday ? "bg-primary" : "bg-[#C7C7CC]"].join(" ")}
          >
            <div className={["w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform", someday ? "translate-x-4" : "translate-x-0.5"].join(" ")} />
          </div>
          <span className="text-sm text-text-secondary">Depois</span>
        </label>

        {/* Tags */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-text-secondary font-medium">Tags</label>
            <button onClick={() => { setShowTagPicker(!showTagPicker); setCreatingTag(false); }} className="text-xs text-primary hover:underline">
              + Adicionar
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {taskTagList.map((tag) => (
              <span
                key={tag.id}
                onClick={() => removeTagFromTask(task.id, tag.id)}
                className="text-xs px-2 py-0.5 rounded-full cursor-pointer hover:opacity-70 transition-opacity"
                style={{ backgroundColor: tag.color + "20", color: tag.color }}
              >
                {tag.name} ×
              </span>
            ))}
          </div>

          {showTagPicker && (
            <div className="mt-2 bg-bg border border-border rounded-lg p-2">
              {!creatingTag ? (
                <>
                  <div className="space-y-1 max-h-28 overflow-y-auto mb-2">
                    {availableTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => { addTagToTask(task.id, tag.id); setShowTagPicker(false); }}
                        className="flex items-center gap-2 w-full px-2 py-1 rounded hover:bg-card text-xs text-left"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                        {tag.name}
                      </button>
                    ))}
                    {availableTags.length === 0 && (
                      <p className="text-xs text-text-secondary text-center py-1">Nenhuma tag disponível</p>
                    )}
                  </div>
                  <button
                    onClick={() => setCreatingTag(true)}
                    className="text-xs text-primary hover:underline w-full text-left px-2"
                  >
                    + Nova tag
                  </button>
                </>
              ) : (
                <div className="space-y-2">
                  <input
                    autoFocus
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
                    placeholder="Nome da tag…"
                    className="w-full text-xs bg-card border border-border rounded px-2 py-1.5 outline-none focus:border-primary"
                  />
                  <div className="flex gap-1.5 flex-wrap">
                    {TAG_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewTagColor(c)}
                        className={["w-5 h-5 rounded-full border-2 transition-all", newTagColor === c ? "border-text-main scale-110" : "border-transparent"].join(" ")}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setCreatingTag(false)} className="text-xs text-text-secondary hover:text-text-main">Cancelar</button>
                    <button onClick={handleCreateTag} className="text-xs text-primary hover:underline font-medium">Criar</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Subtasks */}
        <div>
          <label className="text-xs text-text-secondary font-medium block mb-2">
            Checklist {taskSubtasks.length > 0 && `(${taskSubtasks.filter((s) => s.completed).length}/${taskSubtasks.length})`}
          </label>
          <div className="space-y-1.5">
            {taskSubtasks.map((st) => (
              <div key={st.id} className="flex items-center gap-2 group">
                <input
                  type="checkbox"
                  checked={st.completed}
                  onChange={(e) => toggleSubtask(task.id, st.id, e.target.checked)}
                  className="accent-success w-4 h-4 rounded cursor-pointer shrink-0"
                />
                {editingSubtaskId === st.id ? (
                  <input
                    autoFocus
                    value={editingSubtaskTitle}
                    onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                    onBlur={() => {
                      if (editingSubtaskTitle.trim()) updateSubtask(task.id, st.id, editingSubtaskTitle.trim());
                      setEditingSubtaskId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") e.target.blur();
                    }}
                    className="text-sm flex-1 bg-transparent outline-none border-b border-primary text-text-main"
                  />
                ) : (
                  <span
                    onClick={() => { setEditingSubtaskId(st.id); setEditingSubtaskTitle(st.title); }}
                    className={["text-sm flex-1 cursor-text", st.completed ? "line-through text-text-secondary" : "text-text-main"].join(" ")}
                  >
                    {st.title}
                  </span>
                )}
                <button
                  onClick={() => deleteSubtask(task.id, st.id)}
                  className="text-transparent group-hover:text-text-secondary hover:!text-danger text-xs transition-colors shrink-0"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddSubtask} className="mt-2">
            <input
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              placeholder="+ Nova etapa…"
              className="w-full text-sm outline-none bg-transparent text-text-secondary placeholder:text-text-secondary/50 border-b border-transparent focus:border-border pb-0.5"
            />
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={handleDelete} className="text-xs text-danger hover:underline">
            Lixeira
          </button>
          <button onClick={handleArchive} className="text-xs text-text-secondary hover:underline">
            Arquivar
          </button>
        </div>
        {saving && <span className="text-xs text-text-secondary">Salvando…</span>}
      </div>
      {/* Safe area spacer on mobile */}
      <div className="md:hidden shrink-0" style={{ height: "env(safe-area-inset-bottom)" }} />
    </aside>
    </>
  );
}
