import { useState, useRef, useEffect, useMemo } from "react";
import { useTaskStore } from "../../store/taskStore";
import { useAreaStore } from "../../store/areaStore";
import { useTagStore } from "../../store/tagStore";
import { useCollaboratorStore } from "../../store/collaboratorStore";
import { useAuthStore } from "../../store/authStore";
import { useUiStore } from "../../store/uiStore";
import { parseNaturalDate, parseShorthand, formatDateHint } from "../../utils/nlpDate";
import { createMeetingEvent } from "../../lib/googleCalendar";
import { CollaboratorAvatar } from "../delegation/shared";

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

function inDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

function fmtShort(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

const PRIORITY_CONFIG = {
  high: { label: "Alta", color: "#FF3B30", dot: "🔴" },
  medium: { label: "Média", color: "#FF9500", dot: "🟡" },
  low: { label: "Baixa", color: "#34C759", dot: "🟢" },
};

const REMINDER_OPTIONS = [
  { value: 5, label: "5 min antes" },
  { value: 15, label: "15 min antes" },
  { value: 30, label: "30 min antes" },
  { value: 60, label: "1 hora antes" },
  { value: 120, label: "2 horas antes" },
  { value: 1440, label: "1 dia antes" },
];

const RECURRENCE_OPTIONS = [
  { value: "daily", label: "Todo dia" },
  { value: "weekdays", label: "Dias de semana" },
  { value: "weekly", label: "Toda semana" },
  { value: "biweekly", label: "A cada 2 semanas" },
  { value: "monthly", label: "Todo mês" },
  { value: "annually", label: "Todo ano" },
];

// Fileira de ícone: fechado é um botão neutro; preenchido vira um chip colorido com o valor
// (mesmo espírito visual do PriorityButton/ReminderField do TaskCard, sem createPortal — o
// QuickEntry já é um modal fixed centralizado, não precisa fugir de overflow de lista).
function IconPopover({ icon, label, active, activeLabel, activeColor, onClear, isOpen, onToggle, children, align = "left" }) {
  return (
    <div className="relative">
      {active ? (
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1.5 rounded-lg shrink-0 max-w-[130px]"
          style={{ color: activeColor, backgroundColor: activeColor + "1A" }}
        >
          <span className="truncate">{icon} {activeLabel}</span>
          <span
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="opacity-60 hover:opacity-100 shrink-0"
          >
            ×
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          title={label}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary hover:bg-bg hover:text-text-main transition-colors text-[15px] shrink-0"
        >
          {icon}
        </button>
      )}
      {isOpen && (
        <div
          className={[
            "absolute bottom-full mb-1.5 bg-card border border-border rounded-xl shadow-xl z-20 p-2 min-w-[190px]",
            align === "right" ? "right-0" : "left-0",
          ].join(" ")}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function OptRow({ children, onClick, dot }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg text-[13px] text-text-main hover:bg-bg transition-colors"
    >
      {dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dot }} />}
      <span className="truncate">{children}</span>
    </button>
  );
}

export function QuickEntry({ onClose }) {
  const [title, setTitle] = useState("");
  const [contextValue, setContextValue] = useState("");
  const [date, setDate] = useState("");
  const [selectedTagId, setSelectedTagId] = useState("");
  const [priority, setPriority] = useState(null);
  const [deadline, setDeadline] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState(null);
  const [recurrence, setRecurrence] = useState("");
  const [delegateId, setDelegateId] = useState("");
  const [notes, setNotes] = useState("");
  const [wantMeeting, setWantMeeting] = useState(false);
  const [meetingAttendees, setMeetingAttendees] = useState([]);
  const [attendeeInput, setAttendeeInput] = useState("");
  const [openPopover, setOpenPopover] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);
  const rowRef = useRef(null);

  const { createTask, delegateTask, updateTask } = useTaskStore();
  const { addTagToTask, tags } = useTagStore();
  const { areas, projects } = useAreaStore();
  const { collaborators } = useCollaboratorStore();
  const { getGoogleToken, connectGoogleCalendar } = useAuthStore();
  const { showToast } = useUiStore();

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (openPopover == null) return;
    const handler = (e) => {
      if (rowRef.current && !rowRef.current.contains(e.target)) setOpenPopover(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openPopover]);

  // !alta / #tag / @Pessoa — sempre reconhecido e limpo do título, independente de o campo
  // correspondente já ter sido definido manualmente (o manual só decide quem GANHA no fim).
  const shorthand = useMemo(() => parseShorthand(title, { tags, collaborators }), [title, tags, collaborators]);
  const nlp = useMemo(() => (!date ? parseNaturalDate(shorthand.cleanTitle) : null), [shorthand.cleanTitle, date]);

  const finalPriority = priority ?? shorthand.priority ?? null;
  const finalTagId = selectedTagId || shorthand.tagId || "";
  const finalDelegateId = delegateId || shorthand.collaboratorId || "";

  const toggle = (id) => setOpenPopover((v) => (v === id ? null : id));

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (submitting) return;
    const t = (nlp ? nlp.cleanTitle || shorthand.cleanTitle : shorthand.cleanTitle).trim();
    if (!t) return;
    setSubmitting(true);

    const fields = {};
    if (contextValue.startsWith("area:")) fields.area_id = contextValue.slice(5);
    else if (contextValue.startsWith("project:")) fields.project_id = contextValue.slice(8);
    if (date) fields.scheduled_date = date;
    else if (nlp?.dateStr) fields.scheduled_date = nlp.dateStr;
    if (nlp?.timeStr) fields.scheduled_time = nlp.timeStr;
    if (deadline) fields.deadline = deadline;
    if (finalPriority) fields.priority = finalPriority;
    if (reminderMinutes != null) fields.reminder_minutes = reminderMinutes;
    if (recurrence) fields.recurrence = recurrence;
    if (notes.trim()) fields.notes = notes.trim();

    const created = await createTask({ title: t, ...fields });
    if (!created?.id) { setSubmitting(false); return; }

    if (finalTagId) await addTagToTask(created.id, finalTagId);
    if (finalDelegateId) await delegateTask(created.id, { collaboratorId: finalDelegateId, followUpDate: inDays(3) });

    if (wantMeeting) {
      const token = getGoogleToken();
      if (token) {
        try {
          const { meetLink, eventId } = await createMeetingEvent(token, {
            title: t,
            date: fields.scheduled_date || localDateStr(),
            time: fields.scheduled_time || "09:00",
            attendees: meetingAttendees,
          });
          await updateTask(created.id, { meeting_url: meetLink, meeting_event_id: eventId, meeting_attendees: meetingAttendees });
        } catch (err) {
          showToast({ message: "Tarefa criada, mas a reunião falhou: " + err.message });
        }
      } else {
        showToast({ message: "Tarefa criada — conecte o Google Calendar pra criar reuniões." });
      }
    }

    setSubmitting(false);
    onClose();
  };

  const todayDate = localDateStr();
  const isToday = date === todayDate;

  const addAttendee = () => {
    const email = attendeeInput.trim().toLowerCase();
    if (!email.includes("@")) return;
    setMeetingAttendees((a) => (a.includes(email) ? a : [...a, email]));
    setAttendeeInput("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50" />
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-10"
      >
        <div className="px-4 pt-4 pb-2">
          <p className="text-xs text-text-secondary/60 font-medium uppercase tracking-widest mb-2">Nova Tarefa</p>
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="O que precisa ser feito? (ex: amanhã às 9h !alta #suporte @Lucas Ruan)"
            className="w-full text-base font-medium text-text-main outline-none bg-transparent placeholder:text-text-secondary/40"
          />
          {(nlp || (!priority && shorthand.priority) || (!selectedTagId && shorthand.tagName) || (!delegateId && shorthand.collaboratorName)) && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {nlp && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-medium">
                  📅 {formatDateHint(nlp.dateStr)}{nlp.timeStr ? ` às ${nlp.timeStr}` : ""}
                </span>
              )}
              {!priority && shorthand.priority && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                  style={{ color: PRIORITY_CONFIG[shorthand.priority].color, backgroundColor: PRIORITY_CONFIG[shorthand.priority].color + "1A" }}
                >
                  {PRIORITY_CONFIG[shorthand.priority].dot} {PRIORITY_CONFIG[shorthand.priority].label}
                </span>
              )}
              {!selectedTagId && shorthand.tagName && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-medium">
                  🏷️ {shorthand.tagName}
                </span>
              )}
              {!delegateId && shorthand.collaboratorName && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-medium">
                  🤝 {shorthand.collaboratorName}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Linha 1: data + contexto + tag (já existia) */}
        <div className="flex items-center gap-2 px-4 pt-1 border-t border-border mt-3 flex-wrap">
          <button
            type="button"
            onClick={() => { setDate(isToday ? "" : todayDate); inputRef.current?.focus(); }}
            className={[
              "text-xs px-2.5 py-1.5 rounded-lg border transition-colors font-medium shrink-0",
              isToday
                ? "bg-primary text-white border-primary"
                : "bg-bg border-border text-text-secondary hover:border-primary hover:text-primary",
            ].join(" ")}
          >
            Hoje
          </button>

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-xs bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary text-text-secondary"
          />

          <select
            value={contextValue}
            onChange={(e) => setContextValue(e.target.value)}
            className="flex-1 min-w-0 text-xs bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary text-text-secondary"
          >
            <option value="">Inbox</option>
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

        {/* Linha 2: fileira de ícones — prazo, prioridade, lembrete, repetição, delegar, reunião, notas, tag */}
        <div ref={rowRef} className="flex items-center gap-1 px-4 pt-2.5 pb-1 flex-wrap">
          <IconPopover
            id="deadline" icon="🚨" label="Prazo"
            active={!!deadline} activeLabel={fmtShort(deadline)} activeColor="#FF3B30"
            onClear={() => setDeadline("")}
            isOpen={openPopover === "deadline"} onToggle={() => toggle("deadline")}
          >
            <input
              type="date"
              value={deadline}
              onChange={(e) => { setDeadline(e.target.value); setOpenPopover(null); }}
              className="text-xs bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary text-text-main"
            />
          </IconPopover>

          <IconPopover
            id="priority" icon="🚩" label="Prioridade"
            active={!!priority} activeLabel={priority ? PRIORITY_CONFIG[priority].label : ""} activeColor={priority ? PRIORITY_CONFIG[priority].color : "#8E8E93"}
            onClear={() => setPriority(null)}
            isOpen={openPopover === "priority"} onToggle={() => toggle("priority")}
          >
            {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
              <OptRow key={key} dot={cfg.color} onClick={() => { setPriority(key); setOpenPopover(null); }}>{cfg.label}</OptRow>
            ))}
          </IconPopover>

          <IconPopover
            id="reminder" icon="🔔" label="Lembrete"
            active={reminderMinutes != null} activeLabel={REMINDER_OPTIONS.find((r) => r.value === reminderMinutes)?.label ?? ""} activeColor="#FF9500"
            onClear={() => setReminderMinutes(null)}
            isOpen={openPopover === "reminder"} onToggle={() => toggle("reminder")}
          >
            {REMINDER_OPTIONS.map((opt) => (
              <OptRow key={opt.value} onClick={() => { setReminderMinutes(opt.value); setOpenPopover(null); }}>{opt.label}</OptRow>
            ))}
          </IconPopover>

          <IconPopover
            id="recurrence" icon="🔁" label="Repetição"
            active={!!recurrence} activeLabel={RECURRENCE_OPTIONS.find((r) => r.value === recurrence)?.label ?? ""} activeColor="#AF52DE"
            onClear={() => setRecurrence("")}
            isOpen={openPopover === "recurrence"} onToggle={() => toggle("recurrence")}
          >
            {RECURRENCE_OPTIONS.map((opt) => (
              <OptRow key={opt.value} onClick={() => { setRecurrence(opt.value); setOpenPopover(null); }}>{opt.label}</OptRow>
            ))}
          </IconPopover>

          {collaborators.length > 0 && (
            <IconPopover
              id="delegate" icon="🤝" label="Delegar"
              active={!!delegateId} activeLabel={collaborators.find((c) => c.id === delegateId)?.name ?? ""} activeColor="#4F8EF7"
              onClear={() => setDelegateId("")}
              isOpen={openPopover === "delegate"} onToggle={() => toggle("delegate")}
            >
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {collaborators.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setDelegateId(c.id); setOpenPopover(null); }}
                    className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg text-[13px] text-text-main hover:bg-bg transition-colors"
                  >
                    <CollaboratorAvatar collaborator={c} size={20} />
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
              </div>
            </IconPopover>
          )}

          <IconPopover
            id="meeting" icon="📹" label="Reunião Meet"
            active={wantMeeting} activeLabel="Reunião" activeColor="#34C759"
            onClear={() => { setWantMeeting(false); setMeetingAttendees([]); }}
            isOpen={openPopover === "meeting"} onToggle={() => toggle("meeting")}
            align="right"
          >
            <div className="w-56 space-y-2">
              <label className="flex items-center gap-2 text-[12.5px] text-text-main px-1">
                <input type="checkbox" checked={wantMeeting} onChange={(e) => setWantMeeting(e.target.checked)} />
                Criar reunião Google Meet
              </label>
              {wantMeeting && (
                <div className="px-1 space-y-2">
                  {!getGoogleToken() ? (
                    <button
                      type="button"
                      onClick={() => connectGoogleCalendar()}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Conectar Google Calendar
                    </button>
                  ) : (
                    <>
                      {meetingAttendees.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {meetingAttendees.map((email) => (
                            <span key={email} className="text-[10px] bg-bg px-1.5 py-0.5 rounded-full flex items-center gap-1 text-text-secondary">
                              {email}
                              <span onClick={() => setMeetingAttendees((a) => a.filter((x) => x !== email))} className="cursor-pointer opacity-60 hover:opacity-100">×</span>
                            </span>
                          ))}
                        </div>
                      )}
                      <input
                        type="email"
                        value={attendeeInput}
                        onChange={(e) => setAttendeeInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); addAttendee(); } }}
                        placeholder="convidado@email.com"
                        className="w-full text-[12px] bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary text-text-main"
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          </IconPopover>

          <IconPopover
            id="notes" icon="📝" label="Notas"
            active={!!notes.trim()} activeLabel="Nota" activeColor="#8E8E93"
            onClear={() => setNotes("")}
            isOpen={openPopover === "notes"} onToggle={() => toggle("notes")}
            align="right"
          >
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="O combinado, contexto…"
              rows={3}
              className="w-56 text-[12.5px] bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary text-text-main resize-none"
            />
          </IconPopover>

          {tags.length > 0 && (
            <select
              value={selectedTagId}
              onChange={(e) => setSelectedTagId(e.target.value)}
              className="text-xs bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary text-text-secondary shrink-0 ml-auto"
            >
              <option value="">🏷️ Tag</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Linha 3: ações */}
        <div className="flex items-center justify-end gap-2 px-4 pb-3 pt-2">
          <button
            type="submit"
            disabled={!title.trim() || submitting}
            className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-primary/90 transition-colors font-medium shrink-0"
          >
            {submitting ? "Adicionando…" : "Adicionar"}
          </button>
        </div>

        <p className="text-xs text-text-secondary/40 text-center pb-3">
          Enter para salvar · Esc para cancelar
        </p>
      </form>
    </div>
  );
}
