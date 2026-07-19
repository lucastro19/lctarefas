import { useState, useEffect, useRef } from "react";
import { useTaskStore } from "../../store/taskStore";
import { useTagStore } from "../../store/tagStore";
import { useAreaStore } from "../../store/areaStore";
import { useAuthStore } from "../../store/authStore";
import { DURATION_PRESETS, durationLabel } from "../../store/settingsStore";
import { RecurrenceDeleteModal } from "../ui/RecurrenceDeleteModal";
import { createMeetingEvent, deleteMeetingEvent } from "../../lib/googleCalendar";

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
  const day = d.getDay();
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7;
  d.setDate(d.getDate() + daysUntilMonday);
  return localDateStr(d);
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
}

const TAG_COLORS = ["#8E8E93", "#4F8EF7", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#FF2D55", "#5AC8FA"];

function getCustomLabel(str) {
  if (!str?.startsWith("custom:")) return "Personalizada";
  try {
    const r = JSON.parse(str.slice(7));
    const units = { hourly: ["hora","horas"], daily: ["dia","dias"], weekly: ["semana","semanas"], monthly: ["mês","meses"], yearly: ["ano","anos"] };
    const [s, p] = units[r.freq] ?? ["?","?"];
    const n = r.interval ?? 1;
    return `A cada ${n} ${n === 1 ? s : p}`;
  } catch { return "Personalizada"; }
}

function Toggle({ on, onChange, red = false }) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onChange(!on); }}
      className={[
        "relative inline-flex w-[51px] h-[31px] rounded-full transition-colors duration-200 shrink-0",
        on ? (red ? "bg-[#FF3B30]" : "bg-[#34C759]") : "bg-[#E5E5EA] dark:bg-[#3A3A3C]",
      ].join(" ")}
    >
      <span className={[
        "absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full transition-transform duration-200",
        "shadow-[0_2px_4px_rgba(0,0,0,0.3)]",
        on ? "translate-x-[22px]" : "translate-x-[2px]",
      ].join(" ")} />
    </button>
  );
}

function ChevronRight() {
  return (
    <svg width="7" height="12" viewBox="0 0 7 12" fill="none" className="text-text-secondary/50 shrink-0">
      <path d="M1 1L6 6L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MeetIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className="shrink-0">
      <rect width="48" height="48" rx="8" fill="#00BFA5"/>
      <path d="M8 16C8 13.8 9.8 12 12 12H28C30.2 12 32 13.8 32 16V32C32 34.2 30.2 36 28 36H12C9.8 36 8 34.2 8 32V16Z" fill="white"/>
      <path d="M34 20L40 15V33L34 28V20Z" fill="white"/>
      <circle cx="20" cy="24" r="5" fill="#00BFA5"/>
    </svg>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-semibold text-text-secondary/60 uppercase tracking-wider mb-1.5 ml-1">
      {children}
    </p>
  );
}

export function TaskDetail({ task, onClose }) {
  const { updateTask, deleteTask, deleteRecurrenceFuture, archiveTask, completeTask, uncompleteTask, subtasks, fetchSubtasks, createSubtask, toggleSubtask, updateSubtask, deleteSubtask } = useTaskStore();
  const { tags, taskTags, fetchTaskTags, fetchTags, createTag, addTagToTask, removeTagFromTask } = useTagStore();
  const { areas, projects } = useAreaStore();
  const { getGoogleToken, connectGoogleCalendar } = useAuthStore();
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);

  // Custom recurrence
  const [recurrence, setRecurrence] = useState(task.recurrence ?? "");
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [cFreq, setCFreq] = useState("weekly");
  const [cInterval, setCInterval] = useState(1);
  const [cWeekDays, setCWeekDays] = useState([]);
  const [cMonthMode, setCMonthMode] = useState("weekday");
  const [cMonthDays, setCMonthDays] = useState([]);
  const [cMonthOrd, setCMonthOrd] = useState("primeiro");
  const [cMonthWd, setCMonthWd] = useState(0);
  const [cYearMonths, setCYearMonths] = useState([]);
  const [cYearHasWd, setCYearHasWd] = useState(false);
  const [cYearOrd, setCYearOrd] = useState("primeiro");
  const [cYearWd, setCYearWd] = useState(0);

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [scheduledDate, setScheduledDate] = useState(task.scheduled_date ?? "");
  const [scheduledTime, setScheduledTime] = useState(task.scheduled_time ?? "");
  const [deadline, setDeadline] = useState(task.deadline ?? "");
  const [someday, setSomeday] = useState(task.someday);
  const [isUrgent, setIsUrgent] = useState(!!task.is_urgent);
  const [reminderMinutes, setReminderMinutes] = useState(task.reminder_minutes ?? null);
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

  // Meeting
  const [meetingUrl, setMeetingUrl] = useState(task.meeting_url ?? null);
  const [meetingEventId, setMeetingEventId] = useState(task.meeting_event_id ?? null);
  const [meetingAttendees, setMeetingAttendees] = useState(task.meeting_attendees ?? []);
  const [showMeetingPanel, setShowMeetingPanel] = useState(false);
  const [attendeeInput, setAttendeeInput] = useState("");
  const [meetingLoading, setMeetingLoading] = useState(false);
  const [meetingError, setMeetingError] = useState("");
  const contextPickerRef = useRef(null);
  const titleRef = useRef(null);
  const resizeTitle = (el) => { if (!el) return; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; };
  const [localAreaId, setLocalAreaId] = useState(task.area_id ?? null);
  const [localProjectId, setLocalProjectId] = useState(task.project_id ?? null);

  const taskSubtasks = subtasks[task.id] ?? [];
  const taskTagList = taskTags[task.id] ?? [];

  useEffect(() => {
    fetchSubtasks(task.id);
    fetchTaskTags(task.id);
    fetchTags();
  }, [task.id]);

  useEffect(() => { resizeTitle(titleRef.current); }, [title]);

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

  const handleDelete = () => {
    if (task.recurrence) {
      setShowRecurrenceModal(true);
    } else {
      deleteTask(task.id);
      onClose();
    }
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
  const isDone = !!task.completed_at;

  const handleComplete = async () => {
    if (isDone) {
      await uncompleteTask(task.id);
    } else {
      await completeTask(task.id);
      onClose();
    }
  };

  const contextLabel = localProjectId
    ? projects.find(p => p.id === localProjectId)?.name ?? "Projeto"
    : localAreaId
      ? areas.find(a => a.id === localAreaId)?.name ?? "Área"
      : "Inbox";

  const handleAddAttendee = () => {
    const email = attendeeInput.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    if (meetingAttendees.includes(email)) { setAttendeeInput(""); return; }
    setMeetingAttendees(prev => [...prev, email]);
    setAttendeeInput("");
  };

  const handleCreateMeeting = async () => {
    const token = getGoogleToken();
    if (!token) { setMeetingError("token_missing"); return; }
    setMeetingLoading(true);
    setMeetingError("");
    try {
      const { meetLink, eventId } = await createMeetingEvent(token, {
        title: title || task.title,
        date: scheduledDate || localDateStr(),
        time: scheduledTime || "09:00",
        duration: durationMinutes || 60,
        attendees: meetingAttendees,
        notes: notes,
      });
      setMeetingUrl(meetLink);
      setMeetingEventId(eventId);
      await updateTask(task.id, {
        meeting_url: meetLink,
        meeting_event_id: eventId,
        meeting_attendees: meetingAttendees,
      });
      setShowMeetingPanel(false);
    } catch (e) {
      setMeetingError(e.message ?? "Erro ao criar reunião");
    } finally {
      setMeetingLoading(false);
    }
  };

  const handleCancelMeeting = async () => {
    const token = getGoogleToken();
    if (token && meetingEventId) {
      try { await deleteMeetingEvent(token, meetingEventId); } catch (_) {}
    }
    setMeetingUrl(null);
    setMeetingEventId(null);
    setMeetingAttendees([]);
    await updateTask(task.id, { meeting_url: null, meeting_event_id: null, meeting_attendees: null });
  };

  const handleCopyMeetLink = () => {
    if (!meetingUrl) return;
    navigator.clipboard.writeText(meetingUrl);
  };

  const openCustomModal = () => {
    if (recurrence?.startsWith("custom:")) {
      try {
        const r = JSON.parse(recurrence.slice(7));
        setCFreq(r.freq ?? "weekly");
        setCInterval(r.interval ?? 1);
        setCWeekDays(r.freq === "weekly" ? (r.days ?? []) : []);
        setCMonthMode(r.freq === "monthly" ? (r.mode ?? "weekday") : "weekday");
        setCMonthDays(r.freq === "monthly" && r.mode === "day" ? (r.days ?? []) : []);
        setCMonthOrd(r.ord ?? "primeiro");
        setCMonthWd(r.wd ?? 0);
        setCYearMonths(r.freq === "yearly" ? (r.months ?? []) : []);
        setCYearHasWd(r.freq === "yearly" && !!r.ord);
        setCYearOrd(r.ord ?? "primeiro");
        setCYearWd(r.wd ?? 0);
      } catch {}
    }
    setShowCustomModal(true);
  };

  const saveCustomRecurrence = () => {
    const base = { freq: cFreq, interval: Number(cInterval) || 1 };
    if (cFreq === "weekly") base.days = cWeekDays;
    if (cFreq === "monthly") {
      base.mode = cMonthMode;
      if (cMonthMode === "day") base.days = cMonthDays;
      else { base.ord = cMonthOrd; base.wd = cMonthWd; }
    }
    if (cFreq === "yearly") {
      base.months = cYearMonths;
      if (cYearHasWd) { base.ord = cYearOrd; base.wd = cYearWd; }
    }
    const rule = "custom:" + JSON.stringify(base);
    setRecurrence(rule);
    updateTask(task.id, { recurrence: rule });
    setShowCustomModal(false);
  };

  return (
    <>
      <aside
        className="fixed inset-0 z-[100] md:static md:inset-auto md:z-auto md:w-96 md:border-l border-border bg-bg md:bg-card md:h-full flex flex-col animate-slide-up md:[animation:none]"
        onClick={e => e.stopPropagation()}
      >
        {/* Content — min-h-0 is critical for flex scroll to work */}
        <div
          className="flex-1 min-h-0 overflow-y-auto"
          style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
        >
          {/* Back button row — visible on all screen sizes */}
          <div
            className="flex items-center justify-between px-3 pb-1"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 2px)" }}
          >
            <button
              type="button"
              onPointerDown={e => e.stopPropagation()}
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-card/80 text-text-secondary hover:text-text-main transition-colors"
            >
              <svg width="18" height="15" viewBox="0 0 18 15" fill="none">
                <path d="M7 1L1 7.5L7 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M1.5 7.5H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
            {saving && <span className="text-xs text-text-secondary pr-2">Salvando…</span>}
          </div>

          <div className="px-4 pt-3 space-y-5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}>

            {/* Title + Notes */}
            <div className="rounded-2xl overflow-hidden bg-card">
              <textarea
                ref={titleRef}
                value={title}
                onChange={e => { setTitle(e.target.value); resizeTitle(e.target); }}
                onBlur={() => save()}
                rows={1}
                placeholder="Título"
                className="w-full text-[20px] font-bold text-text-main bg-transparent px-4 pt-4 pb-3 outline-none leading-tight placeholder:text-text-secondary/40 resize-none overflow-hidden"
                style={{ minHeight: "2rem" }}
              />
              <div className="h-px bg-border/40 mx-4" />
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onBlur={() => save()}
                rows={3}
                placeholder="Adicionar notas…"
                className="w-full text-[15px] text-text-main bg-transparent px-4 py-3 outline-none resize-none placeholder:text-text-secondary/40"
              />
            </div>

            {/* Data e hora */}
            <div>
              <SectionLabel>Data e hora</SectionLabel>
              <div className="rounded-2xl overflow-hidden bg-card divide-y divide-border/50">

                {/* Data */}
                <div>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="text-[17px] w-6 text-center leading-none">📅</span>
                    <span className="flex-1 text-[16px] text-text-main">Data</span>
                    {scheduledDate && (
                      <span className="text-[13px] text-primary mr-2 truncate max-w-[130px]">{fmtDate(scheduledDate)}</span>
                    )}
                    <Toggle on={!!scheduledDate} onChange={v => {
                      if (v) { const d = localDateStr(); setScheduledDate(d); updateTask(task.id, { scheduled_date: d }); }
                      else { setScheduledDate(""); updateTask(task.id, { scheduled_date: null }); }
                    }} />
                  </div>
                  {scheduledDate && (
                    <div className="px-4 pb-3 space-y-2">
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={e => { setScheduledDate(e.target.value); updateTask(task.id, { scheduled_date: e.target.value || null }); }}
                        className="w-full text-sm bg-bg border border-border rounded-xl px-3 py-2 outline-none focus:border-primary"
                      />
                      <div className="flex gap-1.5">
                        {[
                          { l: "Hoje", d: () => localDateStr() },
                          { l: "Amanhã", d: () => addDays(1) },
                          { l: "Prox. seg.", d: nextMonday },
                        ].map(({ l, d }) => (
                          <button key={l} onClick={() => { const dt = d(); setScheduledDate(dt); updateTask(task.id, { scheduled_date: dt }); }}
                            className={["flex-1 text-[11px] py-1.5 rounded-lg border transition-colors",
                              scheduledDate === d() ? "bg-primary/10 text-primary border-primary/40 font-medium" : "text-text-secondary border-border",
                            ].join(" ")}>{l}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Horário */}
                <div>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="text-[17px] w-6 text-center leading-none">🕐</span>
                    <span className="flex-1 text-[16px] text-text-main">Horário</span>
                    {scheduledTime && (
                      <span className="text-[13px] text-primary mr-2">{scheduledTime.slice(0, 5)}</span>
                    )}
                    <Toggle on={!!scheduledTime} onChange={v => {
                      if (v) { setScheduledTime("09:00"); updateTask(task.id, { scheduled_time: "09:00" }); }
                      else { setScheduledTime(""); updateTask(task.id, { scheduled_time: null }); }
                    }} />
                  </div>
                  {scheduledTime && (
                    <div className="px-4 pb-3">
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={e => setScheduledTime(e.target.value)}
                        onBlur={e => updateTask(task.id, { scheduled_time: e.target.value || null })}
                        className="w-full text-sm bg-bg border border-border rounded-xl px-3 py-2 outline-none focus:border-primary"
                      />
                    </div>
                  )}
                </div>

                {/* Urgente */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-[17px] w-6 text-center leading-none">🔔</span>
                  <span className={["flex-1 text-[16px]", isUrgent ? "text-[#FF3B30] font-medium" : "text-text-main"].join(" ")}>Urgente</span>
                  <Toggle on={isUrgent} red onChange={async v => { setIsUrgent(v); await updateTask(task.id, { is_urgent: v }); }} />
                </div>

                {/* Prazo */}
                <div>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="text-[17px] w-6 text-center leading-none">🚨</span>
                    <span className="flex-1 text-[16px] text-text-main">Prazo</span>
                    {deadline && (
                      <span className="text-[13px] text-[#FF3B30] mr-2">{fmtDate(deadline)}</span>
                    )}
                    <Toggle on={!!deadline} onChange={v => {
                      if (!v) { setDeadline(""); save({ deadline: null }); }
                      else { const d = localDateStr(); setDeadline(d); save({ deadline: d }); }
                    }} />
                  </div>
                  {deadline && (
                    <div className="px-4 pb-3">
                      <input
                        type="date"
                        value={deadline}
                        onChange={e => setDeadline(e.target.value)}
                        onBlur={() => save()}
                        className="w-full text-sm bg-bg border border-border/60 rounded-xl px-3 py-2 outline-none focus:border-[#FF3B30]"
                      />
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Reunião Google Meet */}
            <div>
              <SectionLabel>Reunião</SectionLabel>
              <div className="rounded-2xl overflow-hidden bg-card">
                {meetingUrl ? (
                  /* ── Reunião criada ── */
                  <div className="divide-y divide-border/50">
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <MeetIcon size={36} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-text-main leading-tight">Google Meet</p>
                        {meetingAttendees.length > 0 && (
                          <p className="text-[12px] text-text-secondary truncate mt-0.5">
                            {meetingAttendees.length === 1 ? meetingAttendees[0] : `${meetingAttendees.length} participantes`}
                          </p>
                        )}
                        {scheduledDate && scheduledTime && (
                          <p className="text-[12px] text-text-secondary/70 mt-0.5">
                            {fmtDate(scheduledDate)} · {scheduledTime.slice(0, 5)}
                          </p>
                        )}
                      </div>
                      <a
                        href={meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-[13px] font-semibold text-white bg-[#00BFA5] px-4 py-2 rounded-xl hover:bg-[#009688] transition-colors shrink-0 shadow-sm"
                      >
                        Entrar
                      </a>
                    </div>
                    {meetingAttendees.length > 1 && (
                      <div className="px-4 py-2.5">
                        <p className="text-[11px] text-text-secondary/60 uppercase tracking-wide font-semibold mb-1.5">Participantes</p>
                        <div className="flex flex-wrap gap-1.5">
                          {meetingAttendees.map(email => (
                            <span key={email} className="text-[11px] bg-bg text-text-secondary px-2.5 py-0.5 rounded-full border border-border">
                              {email}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center px-4 py-2.5 gap-4">
                      <button onClick={handleCopyMeetLink} className="text-[13px] text-primary hover:opacity-70 transition-opacity">
                        Copiar link
                      </button>
                      <div className="flex-1" />
                      <button onClick={handleCancelMeeting} className="text-[13px] text-[#FF3B30] hover:opacity-70 transition-opacity">
                        Cancelar reunião
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Criar reunião ── */
                  <>
                    <button
                      onClick={() => { setShowMeetingPanel(v => !v); setMeetingError(""); }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                    >
                      <MeetIcon size={32} />
                      <span className="flex-1 text-[15px] text-text-main font-medium">Criar reunião Google Meet</span>
                      <ChevronRight />
                    </button>

                    {showMeetingPanel && (
                      <div className="border-t border-border px-4 pt-4 pb-4 space-y-4 bg-bg dark:bg-[#1C1C1E]">
                        {meetingError === "token_missing" ? (
                          <div className="space-y-3 py-1">
                            <p className="text-[13px] text-text-secondary leading-relaxed">
                              Para criar reuniões, reconecte sua conta Google com permissão ao Calendar.
                            </p>
                            <button
                              onClick={connectGoogleCalendar}
                              className="w-full py-2.5 rounded-xl bg-primary text-white text-[14px] font-semibold"
                            >
                              Conectar Google Calendar
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="space-y-2">
                              <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Convidar participantes</p>
                              <div className="flex gap-2">
                                <input
                                  type="email"
                                  value={attendeeInput}
                                  onChange={e => setAttendeeInput(e.target.value)}
                                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddAttendee(); } }}
                                  placeholder="email@exemplo.com"
                                  className="flex-1 text-[14px] bg-card dark:bg-[#2C2C2E] border border-border dark:border-[#3A3A3C] rounded-xl px-3 py-2.5 outline-none focus:border-[#00BFA5] text-text-main placeholder:text-text-secondary/40 min-w-0"
                                />
                                <button
                                  onClick={handleAddAttendee}
                                  className="px-3.5 py-2 rounded-xl bg-[#00BFA5]/15 text-[#00897B] dark:text-[#00BFA5] text-[13px] font-semibold shrink-0 hover:bg-[#00BFA5]/25 transition-colors"
                                >
                                  + Add
                                </button>
                              </div>
                              {meetingAttendees.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {meetingAttendees.map(email => (
                                    <span
                                      key={email}
                                      onClick={() => setMeetingAttendees(prev => prev.filter(e => e !== email))}
                                      className="text-[11px] bg-card dark:bg-[#2C2C2E] text-text-secondary px-2.5 py-1 rounded-full border border-border dark:border-[#3A3A3C] cursor-pointer hover:border-[#FF3B30] hover:text-[#FF3B30] transition-colors select-none"
                                    >
                                      {email} ×
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {(scheduledDate || scheduledTime) && (
                              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card dark:bg-[#2C2C2E] border border-border dark:border-[#3A3A3C]">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary shrink-0">
                                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                                </svg>
                                <span className="text-[12px] text-text-secondary">
                                  {scheduledDate ? fmtDate(scheduledDate) : "Sem data"}
                                  {scheduledTime ? ` · ${scheduledTime.slice(0, 5)}` : ""}
                                  {durationMinutes ? ` · ${durationMinutes} min` : " · 60 min"}
                                </span>
                              </div>
                            )}

                            {!scheduledDate && !scheduledTime && (
                              <p className="text-[12px] text-text-secondary/50 leading-relaxed">
                                Dica: defina data e horário para o evento aparecer no Google Calendar no horário correto.
                              </p>
                            )}

                            {meetingError && (
                              <p className="text-[12px] text-[#FF3B30] leading-relaxed">{meetingError}</p>
                            )}

                            <button
                              onClick={handleCreateMeeting}
                              disabled={meetingLoading}
                              className="w-full py-3 rounded-2xl text-white text-[15px] font-semibold disabled:opacity-40 transition-all active:scale-[0.98]"
                              style={{ backgroundColor: "#00BFA5" }}
                            >
                              {meetingLoading ? "Criando reunião…" : "Criar link Google Meet"}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Duração + Repetição + Lembrete */}
            <div className="rounded-2xl overflow-hidden bg-card divide-y divide-border/50">

              {/* Duração */}
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-[17px] w-6 text-center leading-none">⏱</span>
                <span className="flex-1 text-[16px] text-text-main">Duração</span>
                {!customDuration ? (
                  <select
                    value={durationMinutes}
                    onChange={e => {
                      if (e.target.value === "custom") { setCustomDuration(true); return; }
                      const v = e.target.value ? Number(e.target.value) : null;
                      setDurationMinutes(v ?? "");
                      updateTask(task.id, { duration_minutes: v });
                    }}
                    className="text-[14px] text-text-secondary bg-transparent outline-none text-right"
                  >
                    <option value="">Sem duração</option>
                    {DURATION_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    <option value="custom">Personalizado…</option>
                  </select>
                ) : (
                  <div className="flex gap-1 items-center">
                    <input type="number" min={0} max={23} placeholder="0" id="dur-h"
                      defaultValue={durationMinutes ? Math.floor(Number(durationMinutes) / 60) : ""}
                      className="w-10 text-xs bg-bg border border-border rounded-lg px-1.5 py-1.5 outline-none text-center" />
                    <span className="text-xs text-text-secondary">h</span>
                    <input type="number" min={0} max={59} placeholder="30" id="dur-m"
                      defaultValue={durationMinutes ? Number(durationMinutes) % 60 : ""}
                      className="w-12 text-xs bg-bg border border-border rounded-lg px-1.5 py-1.5 outline-none text-center"
                      onBlur={() => {
                        const h = Number(document.getElementById("dur-h").value) || 0;
                        const m = Number(document.getElementById("dur-m").value) || 0;
                        const total = h * 60 + m;
                        setDurationMinutes(total || "");
                        setCustomDuration(false);
                        updateTask(task.id, { duration_minutes: total || null });
                      }} />
                  </div>
                )}
              </div>

              {/* Repetição */}
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-[17px] w-6 text-center leading-none">🔁</span>
                <span className="flex-1 text-[16px] text-text-main">Repetição</span>
                <select
                  value={recurrence?.startsWith("custom:") ? "custom" : (recurrence ?? "")}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === "custom_open") { openCustomModal(); return; }
                    setRecurrence(val);
                    updateTask(task.id, { recurrence: val || null });
                  }}
                  className="text-[14px] text-text-secondary bg-transparent outline-none text-right max-w-[140px]"
                >
                  <option value="">Nunca</option>
                  <option value="daily">Diariamente</option>
                  <option value="weekdays">Dias úteis</option>
                  <option value="weekly">Semanalmente</option>
                  <option value="biweekly">Quinzenal</option>
                  <option value="monthly">Mensalmente</option>
                  <option value="annually">Anualmente</option>
                  {recurrence?.startsWith("custom:") && (
                    <option value="custom">{getCustomLabel(recurrence)}</option>
                  )}
                  <option value="custom_open">Personalizada…</option>
                </select>
              </div>

              {/* Lembrete — só se horário definido */}
              {scheduledTime && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-[17px] w-6 text-center leading-none">🔕</span>
                  <span className="flex-1 text-[16px] text-text-main">Lembrete</span>
                  <select
                    value={reminderMinutes ?? ""}
                    onChange={e => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      setReminderMinutes(v);
                      updateTask(task.id, { reminder_minutes: v });
                    }}
                    className="text-[14px] text-text-secondary bg-transparent outline-none text-right"
                  >
                    <option value="">Sem lembrete</option>
                    <option value="5">5 min antes</option>
                    <option value="15">15 min antes</option>
                    <option value="30">30 min antes</option>
                    <option value="60">1h antes</option>
                    <option value="120">2h antes</option>
                    <option value="1440">1 dia antes</option>
                  </select>
                </div>
              )}

            </div>

            {/* Organização */}
            <div>
              <SectionLabel>Organização</SectionLabel>
              <div className="rounded-2xl overflow-hidden bg-card divide-y divide-border/50">

                {/* Contexto */}
                <div ref={contextPickerRef} className="relative">
                  <button
                    onClick={() => setShowContextPicker(v => !v)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="text-[17px] w-6 text-center leading-none">📂</span>
                    <span className="flex-1 text-[16px] text-text-main">Contexto</span>
                    <span className="text-[13px] text-text-secondary mr-2 truncate max-w-[120px]">{contextLabel}</span>
                    <ChevronRight />
                  </button>
                  {showContextPicker && (
                    <div className="mx-4 mb-3 bg-bg border border-border rounded-2xl shadow-xl z-50 py-1.5 max-h-52 overflow-y-auto">
                      <button
                        onClick={() => { handleContextChange(""); setShowContextPicker(false); }}
                        className={["w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors",
                          !localProjectId && !localAreaId ? "text-primary font-medium" : "text-text-secondary hover:bg-card/50",
                        ].join(" ")}
                      >
                        <span className="w-2 h-2 rounded-full bg-[#8E8E93] shrink-0" />
                        Inbox (sem contexto)
                      </button>
                      {areas.length > 0 && <div className="h-px bg-border mx-3 my-1" />}
                      {areas.map(area => {
                        const areaProjects = projects.filter(p => p.area_id === area.id);
                        return (
                          <div key={area.id}>
                            <button
                              onClick={() => { handleContextChange(`area:${area.id}`); setShowContextPicker(false); }}
                              className={["w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors font-medium",
                                localAreaId === area.id && !localProjectId ? "text-primary" : "text-text-main hover:bg-card/50",
                              ].join(" ")}
                            >
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: area.color }} />
                              {area.name}
                            </button>
                            {areaProjects.map(p => (
                              <button
                                key={p.id}
                                onClick={() => { handleContextChange(`project:${p.id}`); setShowContextPicker(false); }}
                                className={["w-full flex items-center gap-2.5 pl-8 pr-3 py-2.5 text-sm text-left transition-colors",
                                  localProjectId === p.id ? "text-primary font-medium" : "text-text-secondary hover:bg-card/50",
                                ].join(" ")}
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

                {/* Tags */}
                <div>
                  <button
                    onClick={() => { setShowTagPicker(!showTagPicker); setCreatingTag(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="text-[17px] w-6 text-center leading-none">🏷️</span>
                    <span className="flex-1 text-[16px] text-text-main">Tags</span>
                    <span className="text-[13px] text-text-secondary mr-2 truncate max-w-[130px]">
                      {taskTagList.length > 0 ? taskTagList.map(t => t.name).join(", ") : "Nenhuma"}
                    </span>
                    <ChevronRight />
                  </button>
                  {taskTagList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                      {taskTagList.map(tag => (
                        <span
                          key={tag.id}
                          onClick={() => removeTagFromTask(task.id, tag.id)}
                          className="text-xs px-2.5 py-1 rounded-full cursor-pointer hover:opacity-70 transition-opacity"
                          style={{ backgroundColor: tag.color + "20", color: tag.color }}
                        >
                          {tag.name} ×
                        </span>
                      ))}
                    </div>
                  )}
                  {showTagPicker && (
                    <div className="mx-4 mb-3 bg-bg border border-border rounded-2xl p-2">
                      {!creatingTag ? (
                        <>
                          <div className="space-y-0.5 max-h-32 overflow-y-auto mb-2">
                            {availableTags.map(tag => (
                              <button
                                key={tag.id}
                                onClick={() => { addTagToTask(task.id, tag.id); setShowTagPicker(false); }}
                                className="flex items-center gap-2 w-full px-3 py-2 rounded-xl hover:bg-card text-sm text-left"
                              >
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                                {tag.name}
                              </button>
                            ))}
                            {availableTags.length === 0 && (
                              <p className="text-sm text-text-secondary text-center py-2">Nenhuma tag disponível</p>
                            )}
                          </div>
                          <button
                            onClick={() => setCreatingTag(true)}
                            className="text-sm text-primary w-full text-left px-3 py-1.5"
                          >
                            + Nova tag
                          </button>
                        </>
                      ) : (
                        <div className="space-y-2 p-1">
                          <input
                            autoFocus
                            value={newTagName}
                            onChange={e => setNewTagName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleCreateTag()}
                            placeholder="Nome da tag…"
                            className="w-full text-sm bg-card border border-border rounded-xl px-3 py-2 outline-none focus:border-primary"
                          />
                          <div className="flex gap-1.5 flex-wrap px-1">
                            {TAG_COLORS.map(c => (
                              <button
                                key={c}
                                onClick={() => setNewTagColor(c)}
                                className={["w-6 h-6 rounded-full border-2 transition-all", newTagColor === c ? "border-text-main scale-110" : "border-transparent"].join(" ")}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                          <div className="flex gap-3 px-1">
                            <button onClick={() => setCreatingTag(false)} className="text-sm text-text-secondary">Cancelar</button>
                            <button onClick={handleCreateTag} className="text-sm text-primary font-medium">Criar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Checklist / Subtarefas */}
                <div className="px-4 py-3">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[17px] w-6 text-center leading-none">☑️</span>
                    <span className="flex-1 text-[16px] text-text-main">Checklist</span>
                    {taskSubtasks.length > 0 && (
                      <span className="text-[13px] text-text-secondary">
                        {taskSubtasks.filter(s => s.completed).length}/{taskSubtasks.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 ml-9">
                    {taskSubtasks.map(st => (
                      <div key={st.id} className="flex items-center gap-2.5 group">
                        <input
                          type="checkbox"
                          checked={st.completed}
                          onChange={e => toggleSubtask(task.id, st.id, e.target.checked)}
                          className="accent-[#34C759] w-[18px] h-[18px] rounded-full cursor-pointer shrink-0"
                        />
                        {editingSubtaskId === st.id ? (
                          <input
                            autoFocus
                            value={editingSubtaskTitle}
                            onChange={e => setEditingSubtaskTitle(e.target.value)}
                            onBlur={() => {
                              if (editingSubtaskTitle.trim()) updateSubtask(task.id, st.id, editingSubtaskTitle.trim());
                              setEditingSubtaskId(null);
                            }}
                            onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") e.target.blur(); }}
                            className="text-[15px] flex-1 bg-transparent outline-none border-b border-primary text-text-main"
                          />
                        ) : (
                          <span
                            onClick={() => { setEditingSubtaskId(st.id); setEditingSubtaskTitle(st.title); }}
                            className={["text-[15px] flex-1 cursor-text", st.completed ? "line-through text-text-secondary" : "text-text-main"].join(" ")}
                          >
                            {st.title}
                          </span>
                        )}
                        <button
                          onClick={() => deleteSubtask(task.id, st.id)}
                          className="text-transparent group-hover:text-text-secondary hover:!text-[#FF3B30] text-base transition-colors shrink-0 leading-none"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleAddSubtask} className="mt-2 ml-9">
                    <input
                      value={newSubtask}
                      onChange={e => setNewSubtask(e.target.value)}
                      placeholder="+ Nova etapa…"
                      className="w-full text-[15px] outline-none bg-transparent text-text-secondary placeholder:text-text-secondary/40 border-b border-transparent focus:border-border pb-0.5"
                    />
                  </form>
                </div>

              </div>
            </div>

            {/* Algum dia + Prioridade + Ações */}
            <div className="rounded-2xl overflow-hidden bg-card divide-y divide-border/50">
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-[17px] w-6 text-center leading-none">🌙</span>
                <span className="flex-1 text-[16px] text-text-main">Algum dia</span>
                <Toggle on={someday} onChange={async v => { setSomeday(v); await updateTask(task.id, { someday: v }); }} />
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-[17px] w-6 text-center leading-none">⚑</span>
                <span className="flex-1 text-[16px] text-text-main">Prioridade</span>
                <select
                  defaultValue={task.priority ?? ""}
                  onChange={e => updateTask(task.id, { priority: e.target.value || null })}
                  className="text-[14px] text-text-secondary bg-transparent outline-none text-right"
                >
                  <option value="">Nenhuma</option>
                  <option value="high">🔴 Alta</option>
                  <option value="medium">🟡 Média</option>
                  <option value="low">🟢 Baixa</option>
                </select>
              </div>
              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#FF3B30]/5 transition-colors"
              >
                <span className="text-[17px] w-6 text-center leading-none">🗑️</span>
                <span className="flex-1 text-[16px] text-[#FF3B30]">Mover para Lixeira</span>
              </button>
              <button
                onClick={handleArchive}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-border/20 transition-colors"
              >
                <span className="text-[17px] w-6 text-center leading-none">📥</span>
                <span className="flex-1 text-[16px] text-text-secondary">Arquivar</span>
              </button>
            </div>

          </div>
        </div>

      </aside>

      {showRecurrenceModal && (
        <RecurrenceDeleteModal
          task={task}
          onDeleteThis={() => { deleteTask(task.id); onClose(); }}
          onDeleteFuture={() => { deleteRecurrenceFuture(task.id); onClose(); }}
          onCancel={() => setShowRecurrenceModal(false)}
        />
      )}

      {showCustomModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCustomModal(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl p-5 w-full max-w-[340px] space-y-4 max-h-[88vh] overflow-y-auto">

            {/* Frequência */}
            <div className="flex items-center gap-3">
              <span className="text-[14px] text-text-secondary whitespace-nowrap">Frequência:</span>
              <select
                value={cFreq}
                onChange={e => setCFreq(e.target.value)}
                className="flex-1 text-[14px] text-text-main bg-bg border border-border rounded-xl px-3 py-2 outline-none"
              >
                <option value="hourly">A Cada Hora</option>
                <option value="daily">Diariamente</option>
                <option value="weekly">Semanalmente</option>
                <option value="monthly">Mensalmente</option>
                <option value="yearly">Anualmente</option>
              </select>
            </div>

            {/* Intervalo */}
            <div className="flex items-center gap-2">
              <span className="text-[14px] text-text-secondary">A Cada</span>
              <input
                type="number" min={1} max={99}
                value={cInterval}
                onChange={e => setCInterval(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 text-[14px] font-semibold text-text-main bg-bg border-2 border-primary rounded-xl px-2 py-1.5 outline-none text-center"
              />
              <span className="text-[14px] text-text-secondary">
                {cFreq === "hourly" ? (cInterval > 1 ? "Horas" : "Hora")
                 : cFreq === "daily" ? (cInterval > 1 ? "Dias" : "Dia")
                 : cFreq === "weekly" ? (cInterval > 1 ? "Semanas" : "Semana")
                 : cFreq === "monthly" ? (cInterval > 1 ? "Meses" : "Mês")
                 : (cInterval > 1 ? "Anos" : "Ano")}
              </span>
            </div>

            {/* Semanal: seletor de dias */}
            {cFreq === "weekly" && (
              <div className="flex gap-1.5 justify-between">
                {["D","S","T","Q","Q","S","S"].map((l, i) => (
                  <button
                    key={i} type="button"
                    onClick={() => setCWeekDays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i])}
                    className={["w-9 h-9 rounded-full text-[13px] font-semibold transition-colors",
                      cWeekDays.includes(i)
                        ? "bg-primary text-white"
                        : "bg-border/40 text-text-secondary hover:bg-border/70"
                    ].join(" ")}
                  >{l}</button>
                ))}
              </div>
            )}

            {/* Mensal: Cada (dia do mês) ou No(a) (dia da semana) */}
            {cFreq === "monthly" && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="radio" name="cMonthMode" value="day" checked={cMonthMode === "day"}
                    onChange={() => setCMonthMode("day")} className="accent-primary" />
                  <span className="text-[14px] text-text-main">Cada</span>
                </label>
                {cMonthMode === "day" && (
                  <div className="grid grid-cols-7 gap-px bg-border/30 border border-border rounded-xl overflow-hidden text-center ml-5">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <button key={d} type="button"
                        onClick={() => setCMonthDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                        className={["py-1.5 text-[12px] transition-colors bg-card",
                          cMonthDays.includes(d) ? "!bg-primary text-white font-semibold" : "text-text-main hover:bg-border/30"
                        ].join(" ")}
                      >{d}</button>
                    ))}
                    {Array.from({ length: (7 - 31 % 7) % 7 }, (_, i) => (
                      <div key={`pad${i}`} className="bg-card py-1.5" />
                    ))}
                  </div>
                )}

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="radio" name="cMonthMode" value="weekday" checked={cMonthMode === "weekday"}
                    onChange={() => setCMonthMode("weekday")} className="accent-primary" />
                  <span className="text-[14px] text-text-main">No(a)</span>
                </label>
                {cMonthMode === "weekday" && (
                  <div className="flex gap-2 ml-5">
                    <select value={cMonthOrd} onChange={e => setCMonthOrd(e.target.value)}
                      className="flex-1 text-[13px] text-text-main bg-bg border border-border rounded-xl px-2 py-2 outline-none">
                      {["primeiro","segundo","terceiro","quarto","quinto","último"].map(o => (
                        <option key={o} value={o}>{o}(a)</option>
                      ))}
                    </select>
                    <select value={cMonthWd} onChange={e => setCMonthWd(Number(e.target.value))}
                      className="flex-1 text-[13px] text-text-main bg-bg border border-border rounded-xl px-2 py-2 outline-none">
                      {["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"].map((wd, i) => (
                        <option key={i} value={i}>{wd}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Anual: grade de meses + opcional dia da semana */}
            {cFreq === "yearly" && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-px bg-border/30 border border-border rounded-xl overflow-hidden text-center">
                  {["jan.","fev.","mar.","abr.","mai.","jun.","jul.","ago.","set.","out.","nov.","dez."].map((m, i) => (
                    <button key={i} type="button"
                      onClick={() => setCYearMonths(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                      className={["py-2 text-[13px] transition-colors bg-card",
                        cYearMonths.includes(i) ? "!bg-primary text-white font-semibold" : "text-text-main hover:bg-border/30"
                      ].join(" ")}
                    >{m}</button>
                  ))}
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={cYearHasWd} onChange={e => setCYearHasWd(e.target.checked)}
                    className="accent-primary w-4 h-4" />
                  <span className="text-[14px] text-text-main">No(a):</span>
                </label>
                {cYearHasWd && (
                  <div className="flex gap-2 ml-5">
                    <select value={cYearOrd} onChange={e => setCYearOrd(e.target.value)}
                      className="flex-1 text-[13px] text-text-main bg-bg border border-border rounded-xl px-2 py-2 outline-none">
                      {["primeiro","segundo","terceiro","quarto","quinto","último"].map(o => (
                        <option key={o} value={o}>{o}(a)</option>
                      ))}
                    </select>
                    <select value={cYearWd} onChange={e => setCYearWd(Number(e.target.value))}
                      className="flex-1 text-[13px] text-text-main bg-bg border border-border rounded-xl px-2 py-2 outline-none">
                      {["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"].map((wd, i) => (
                        <option key={i} value={i}>{wd}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowCustomModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-border/40 text-text-main text-[15px] font-medium hover:bg-border/60 transition-colors">
                Cancelar
              </button>
              <button type="button" onClick={saveCustomRecurrence}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-[15px] font-semibold hover:bg-primary/90 transition-colors">
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
