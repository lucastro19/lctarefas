import { useState, useEffect } from "react";
import { useTaskStore } from "../../store/taskStore";
import { useTagStore } from "../../store/tagStore";
import { useAreaStore } from "../../store/areaStore";
import { DURATION_PRESETS, durationLabel } from "../../store/settingsStore";

const TAG_COLORS = ["#8E8E93", "#4F8EF7", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#FF2D55", "#5AC8FA"];

export function TaskDetail({ task, onClose }) {
  const { updateTask, deleteTask, archiveTask, subtasks, fetchSubtasks, createSubtask, toggleSubtask, deleteSubtask } = useTaskStore();
  const { tags, taskTags, fetchTaskTags, fetchTags, createTag, addTagToTask, removeTagFromTask } = useTagStore();
  const { areas, projects } = useAreaStore();

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
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#4F8EF7");
  const [saving, setSaving] = useState(false);

  const taskSubtasks = subtasks[task.id] ?? [];
  const taskTagList = taskTags[task.id] ?? [];

  useEffect(() => {
    fetchSubtasks(task.id);
    fetchTaskTags(task.id);
    fetchTags();
  }, [task.id]);

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

  const handleContextChange = async (e) => {
    const val = e.target.value;
    if (val === "") {
      await updateTask(task.id, { project_id: null, area_id: null });
    } else if (val.startsWith("area:")) {
      await updateTask(task.id, { area_id: val.replace("area:", ""), project_id: null });
    } else if (val.startsWith("project:")) {
      await updateTask(task.id, { project_id: val.replace("project:", ""), area_id: null });
    }
  };

  const currentContextValue = task.project_id
    ? `project:${task.project_id}`
    : task.area_id
    ? `area:${task.area_id}`
    : "";

  const availableTags = tags.filter((t) => !taskTagList.find((tt) => tt.id === t.id));

  return (
    <aside className="fixed inset-0 z-50 md:static md:inset-auto md:z-auto w-full md:w-96 border-l border-border bg-card h-full overflow-y-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <span className="text-xs text-text-secondary font-medium uppercase tracking-wide">Detalhe</span>
        <button onClick={onClose} className="text-text-secondary hover:text-text-main text-lg leading-none">×</button>
      </div>

      <div className="flex-1 px-5 py-4 space-y-5">
        {/* Title */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => save()}
          className="w-full font-semibold text-base text-text-main outline-none bg-transparent border-b border-transparent focus:border-border pb-1"
        />

        {/* Context (projeto / área) */}
        <div>
          <label className="text-xs text-text-secondary font-medium block mb-1">📂 Contexto</label>
          <select
            defaultValue={currentContextValue}
            onChange={handleContextChange}
            className="w-full text-xs bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary text-text-main"
          >
            <option value="">Sem contexto (Inbox)</option>
            {areas.map((area) => (
              <optgroup key={area.id} label={area.name}>
                <option value={`area:${area.id}`}>{area.name}</option>
                {projects.filter((p) => p.area_id === area.id).map((p) => (
                  <option key={p.id} value={`project:${p.id}`}>↳ {p.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
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
          <div>
            <label className="text-xs text-text-secondary font-medium block mb-1">📅 Execução</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              onBlur={(e) => updateTask(task.id, { scheduled_date: e.target.value || null })}
              className="w-full text-xs bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary"
            />
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
          <span className="text-sm text-text-secondary">Algum Dia</span>
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
                  className="accent-success w-4 h-4 rounded cursor-pointer"
                />
                <span className={["text-sm flex-1", st.completed ? "line-through text-text-secondary" : "text-text-main"].join(" ")}>
                  {st.title}
                </span>
                <button
                  onClick={() => deleteSubtask(task.id, st.id)}
                  className="text-transparent group-hover:text-text-secondary hover:!text-danger text-xs transition-colors"
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
    </aside>
  );
}
