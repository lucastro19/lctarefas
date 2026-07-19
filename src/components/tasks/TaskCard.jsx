import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Checkbox } from "../ui/Checkbox";
import { useTaskStore } from "../../store/taskStore";
import { useTagStore } from "../../store/tagStore";
import { useSelectionStore } from "../../store/selectionStore";
import { useUiStore } from "../../store/uiStore";
import { durationLabel, DURATION_PRESETS, useSettingsStore } from "../../store/settingsStore";
import { useAreaStore } from "../../store/areaStore";
import { RecurrenceDeleteModal } from "../ui/RecurrenceDeleteModal";
import { useTemplateStore } from "../../store/templateStore";
import { TimeSlotPickerModal } from "./TimeSlotPickerModal";
import { computeAvailableSlots } from "../../utils/timeSlots";
import { useAuthStore } from "../../store/authStore";
import { createMeetingEvent } from "../../lib/googleCalendar";

// Usa data LOCAL (não UTC) para evitar bug de timezone em fusos negativos (BR = UTC-3)
function localDateStr(d = new Date()) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

const todayStr = () => localDateStr();

function isoToDisplay(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function displayToIso(display) {
  const parts = display.split("/");
  if (parts.length === 3 && parts[2].length === 4) {
    const iso = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    const dt = new Date(iso + "T12:00:00");
    if (!isNaN(dt.getTime())) return iso;
  }
  return null;
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T12:00:00");
  const today = localDateStr();
  const yest = localDateStr(new Date(new Date().setDate(new Date().getDate() - 1)));
  const tom = localDateStr(new Date(new Date().setDate(new Date().getDate() + 1)));
  if (dateStr === today) return "Hoje";
  if (dateStr === yest) return "Ontem";
  if (dateStr === tom) return "Amanhã";
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

function isOverdue(date) {
  return date && date < todayStr();
}

function deadlineUrgency(dateStr) {
  if (!dateStr) return null;
  const today = localDateStr();
  if (dateStr < today) return { level: "overdue", label: "Venceu!", color: "#FF3B30", pulse: true };
  if (dateStr === today) return { level: "today", label: "Vence hoje", color: "#FF3B30", pulse: true };
  const diff = Math.round((new Date(dateStr + "T12:00:00") - new Date(today + "T12:00:00")) / 86400000);
  if (diff === 1) return { level: "tomorrow", label: "Vence amanhã", color: "#FF9500", pulse: false };
  if (diff <= 3) return { level: "soon", label: `Vence em ${diff} dias`, color: "#FF9500", pulse: false };
  if (diff <= 7) return { level: "week", label: `Vence em ${diff} dias`, color: "#FFCC00", pulse: false };
  return null; // mais de 7 dias → mostra só a data normal
}

const RECURRENCE_LABELS = {
  daily: "Diariamente",
  weekdays: "Dias úteis",
  weekly: "Semanalmente",
  biweekly: "Quinzenalmente",
  monthly: "Mensalmente",
  yearly: "Anualmente",
};

const TIME_SLOTS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

const REMINDER_OPTIONS = [
  { value: null,  label: "Sem lembrete" },
  { value: 5,     label: "5 min antes" },
  { value: 15,    label: "15 min antes" },
  { value: 30,    label: "30 min antes" },
  { value: 60,    label: "1 hora antes" },
  { value: 120,   label: "2 horas antes" },
  { value: 1440,  label: "1 dia antes" },
];

const NOTE_SEGMENT_RE = /(\*\*(.+?)\*\*|_(.+?)_|`([^`]+)`|https?:\/\/[^\s<]+|(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)(?:9\s?)?\d{4}[-\s]?\d{4})/g;

function parseNotes(text) {
  const parts = [];
  let last = 0, m;
  NOTE_SEGMENT_RE.lastIndex = 0;
  while ((m = NOTE_SEGMENT_RE.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: "text", value: text.slice(last, m.index) });
    const val = m[0];
    if (val.startsWith("**")) parts.push({ type: "bold", value: m[2] });
    else if (val.startsWith("_")) parts.push({ type: "italic", value: m[3] });
    else if (val.startsWith("`")) parts.push({ type: "code", value: m[4] });
    else if (val.startsWith("http")) parts.push({ type: "url", value: val });
    else parts.push({ type: "phone", value: val });
    last = m.index + val.length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

/* ── Campo de data: clique abre calendário nativo ── */
function DateField({ value, onChange }) {
  const hiddenRef = useRef(null);

  const openPicker = () => {
    if (hiddenRef.current) {
      hiddenRef.current.showPicker?.();
      hiddenRef.current.focus();
    }
  };

  const handleHiddenChange = (e) => {
    onChange(e.target.value || "");
  };

  return (
    <div
      onClick={openPicker}
      className={["inline-flex items-center gap-1 rounded-full cursor-pointer transition-colors select-none", value ? "meta-chip-filled pl-2 pr-1 py-0.5" : ""].join(" ")}
    >
      <span className="text-[12px] shrink-0 text-text-secondary leading-none">📅</span>
      <span className={["text-xs", value ? "text-text-main" : "text-[#AEAEB2] dark:text-[#636366]"].join(" ")}>
        {value ? isoToDisplay(value) : "dd/mm/aa"}
      </span>
      {value && (
        <button
          tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); onChange(""); }}
          className="text-text-secondary hover:text-danger transition-colors text-[10px] leading-none px-0.5"
        >×</button>
      )}
      <input
        ref={hiddenRef}
        type="date"
        value={value}
        onChange={handleHiddenChange}
        tabIndex={-1}
        className="sr-only"
      />
    </div>
  );
}

/* ── Campo de hora: dois painéis hora | minuto ── */
function TimeField({ value, onChange }) {
  const [input, setInput] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [selHour, setSelHour] = useState(value ? value.split(":")[0] : null);
  const wrapRef = useRef(null);
  const dropdownRef = useRef(null);
  const hourListRef = useRef(null);

  useEffect(() => {
    setInput(value || "");
    setSelHour(value ? value.split(":")[0] : null);
  }, [value]);

  useEffect(() => {
    const handler = (e) => {
      const insideWrap = wrapRef.current && wrapRef.current.contains(e.target);
      const insideDropdown = dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!insideWrap && !insideDropdown) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  // Scroll para hora atual ao abrir
  useEffect(() => {
    if (!open || !hourListRef.current) return;
    const h = value ? value.split(":")[0] : String(new Date().getHours()).padStart(2, "0");
    const idx = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).indexOf(h);
    if (idx > -1) hourListRef.current.children[idx]?.scrollIntoView({ block: "center" });
  }, [open]);

  const handleTextChange = (e) => {
    let v = e.target.value.replace(/[^0-9:]/g, "");
    if (v.length === 2 && !v.includes(":") && input.length < 2) v = v + ":";
    setInput(v);
    if (/^\d{2}:\d{2}$/.test(v)) {
      const [h, m] = v.split(":").map(Number);
      if (h < 24 && m < 60) { onChange(v); setSelHour(String(h).padStart(2, "0")); }
    } else if (!v) { onChange(""); }
  };

  // Clicar na hora já confirma HH:00 imediatamente e mantém dropdown aberto para refinar minuto
  const pickHour = (h) => {
    const t = `${h}:00`;
    setSelHour(h);
    setInput(t);
    onChange(t);
  };

  const pickMinute = (m) => {
    const t = `${selHour}:${m}`;
    setInput(t); onChange(t); setOpen(false);
  };

  const pos = () => {
    if (!wrapRef.current) return { top: 0, left: 0 };
    const r = wrapRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow > 200 ? r.bottom + 4 : r.top - 208;
    return { top, left: r.left };
  };

  return (
    <div
      ref={wrapRef}
      className={["relative inline-flex items-center gap-1 rounded-full transition-colors", value ? "meta-chip-filled pl-2 pr-1 py-0.5" : ""].join(" ")}
    >
      <span className="text-[12px] shrink-0 text-text-secondary leading-none">⏰</span>
      <input
        type="text"
        value={input}
        onChange={handleTextChange}
        onFocus={() => setOpen(true)}
        placeholder="00:00"
        maxLength={5}
        className="text-xs bg-transparent outline-none text-text-main w-10 placeholder:text-[#AEAEB2] dark:placeholder:text-[#636366]"
      />
      <button
        tabIndex={-1}
        onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        className="text-text-secondary hover:text-primary transition-colors text-[10px] leading-none"
      >▾</button>
      {value && (
        <button
          tabIndex={-1}
          onClick={() => { setInput(""); onChange(""); setSelHour(null); }}
          className="text-text-secondary hover:text-danger transition-colors text-[10px] leading-none px-0.5"
        >×</button>
      )}

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: "fixed", ...pos(), zIndex: 9999, width: 148 }}
          className="flex bg-card border border-border rounded-xl shadow-xl overflow-hidden"
        >
          {/* Coluna horas */}
          <div ref={hourListRef} className="w-16 max-h-52 overflow-y-auto border-r border-border py-1">
            {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
              <button
                key={h}
                onClick={() => pickHour(h)}
                className={[
                  "w-full text-center py-1.5 text-xs transition-colors",
                  h === selHour
                    ? "bg-primary/15 text-primary font-semibold"
                    : "hover:bg-bg text-text-secondary",
                ].join(" ")}
              >
                {h}h
              </button>
            ))}
          </div>
          {/* Coluna minutos */}
          <div className="flex-1 flex flex-col justify-center gap-1 p-2">
            {selHour ? (
              ["00", "15", "30", "45"].map((m) => {
                const t = `${selHour}:${m}`;
                return (
                  <button
                    key={m}
                    onClick={() => pickMinute(m)}
                    className={[
                      "w-full text-center py-1.5 rounded-lg text-xs font-medium transition-colors",
                      t === value
                        ? "bg-primary text-white"
                        : "hover:bg-bg text-text-secondary",
                    ].join(" ")}
                  >
                    :{m}
                  </button>
                );
              })
            ) : (
              <p className="text-[10px] text-text-secondary text-center px-1 leading-tight">
                Escolha a hora
              </p>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

const PRIORITY_CONFIG = {
  high:   { label: "Alta",   color: "#FF3B30", dot: "🔴" },
  medium: { label: "Média",  color: "#FF9500", dot: "🟡" },
  low:    { label: "Baixa",  color: "#34C759", dot: "🟢" },
};

/* ── Botão de prioridade ── */
function PriorityButton({ task, updateTask }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnId = `priority-btn-${task.id}`;

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current = task.priority ? PRIORITY_CONFIG[task.priority] : null;

  const pos = () => {
    const el = document.getElementById(btnId);
    if (!el) return { top: 0, left: 0 };
    const r = el.getBoundingClientRect();
    return { top: r.bottom + 4, left: r.left };
  };

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        id={btnId}
        onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        title="Prioridade"
        className={["text-[13px] transition-all leading-none", current ? "" : "text-text-secondary hover:text-warning opacity-60 hover:opacity-100"].join(" ")}
        style={current ? { color: current.color } : {}}
      >
        {current ? current.dot : "⚑"}
      </button>
      {open && createPortal(
        <div style={{ position: "fixed", ...pos(), zIndex: 9999 }}
          className="bg-card border border-border rounded-xl shadow-xl py-1.5 min-w-[160px]">
          <button onMouseDown={(e) => { e.preventDefault(); updateTask(task.id, { priority: null }); setOpen(false); }}
            className="menu-item w-full text-left px-3 py-2 text-xs flex items-center gap-2">
            <span className={["w-3 text-center shrink-0", !task.priority ? "opacity-100 text-primary" : "opacity-0"].join(" ")}>✓</span>
            <span className="text-text-secondary">⚑ Sem prioridade</span>
          </button>
          <div className="h-px bg-border mx-2 my-0.5" />
          {(["high","medium","low"]).map((p) => (
            <button key={p} onMouseDown={(e) => { e.preventDefault(); updateTask(task.id, { priority: p }); setOpen(false); }}
              className="menu-item w-full text-left px-3 py-2 text-xs flex items-center gap-2">
              <span className={["w-3 text-center shrink-0", task.priority === p ? "opacity-100 text-primary" : "opacity-0"].join(" ")}>✓</span>
              <span style={{ color: PRIORITY_CONFIG[p].color }}>{PRIORITY_CONFIG[p].dot} {PRIORITY_CONFIG[p].label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── Botão de urgência com dropdown ── */
function UrgencyButton({ task, updateTask }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); updateTask(task.id, { is_urgent: !task.is_urgent }); }}
      title={task.is_urgent ? "Urgente — clique para remover" : "Marcar como urgente"}
      className={[
        "text-[13px] transition-all leading-none",
        task.is_urgent
          ? "text-danger drop-shadow-[0_0_4px_rgba(255,59,48,0.5)]"
          : "text-text-secondary hover:text-danger",
      ].join(" ")}
    >
      🔔
    </button>
  );
}

/* ── Campo de lembrete com antecedência ── */
function ReminderField({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnId = `reminder-btn-${Math.random().toString(36).slice(2)}`;
  const refId = useRef(btnId);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current = REMINDER_OPTIONS.find((o) => o.value === value) ?? REMINDER_OPTIONS[0];

  const pos = () => {
    const el = document.getElementById(refId.current);
    if (!el) return { top: 0, left: 0 };
    const r = el.getBoundingClientRect();
    return { top: r.bottom + 4, left: r.left };
  };

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        id={refId.current}
        onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        className={[
          "inline-flex items-center gap-1 rounded-full text-xs transition-colors px-2 py-0.5",
          value != null
            ? "meta-chip-filled text-primary font-medium"
            : "text-[#AEAEB2] dark:text-[#636366] hover:text-text-secondary",
        ].join(" ")}
        title="Lembrete com antecedência"
      >
        <span className="text-[11px]">🔔</span>
        {value != null ? current.label : "Lembrete"}
      </button>

      {open && createPortal(
        <div
          style={{ position: "fixed", ...pos(), zIndex: 9999 }}
          className="bg-card border border-border rounded-xl shadow-xl py-1.5 min-w-[170px]"
        >
          {REMINDER_OPTIONS.map((opt) => (
            <button
              key={String(opt.value)}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt.value);
                setOpen(false);
              }}
              className="menu-item w-full text-left px-3 py-2 text-xs flex items-center gap-2"
            >
              <span className={["w-3 text-primary text-center shrink-0", opt.value === value ? "opacity-100" : "opacity-0"].join(" ")}>✓</span>
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── Menu contextual ── */
function TaskMenuPortal({ task, buttonId, onClose, onRecurrenceDelete, cursorPos, onSelect, onMoveToToday }) {
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (cursorPos) {
      // Botão direito: abre nas coordenadas do cursor, flip se sair da tela
      const menuW = 200;
      const menuH = 280;
      const left = Math.min(cursorPos.x, window.innerWidth - menuW - 8);
      const top = cursorPos.y + menuH > window.innerHeight
        ? cursorPos.y - menuH
        : cursorPos.y;
      setPos({ top, right: window.innerWidth - left - menuW });
    } else {
      const btn = document.getElementById(buttonId);
      if (btn) {
        const r = btn.getBoundingClientRect();
        const menuH = 320;
        const top = r.bottom + menuH > window.innerHeight - 8
          ? r.top - menuH
          : r.bottom + 4;
        setPos({ top, right: window.innerWidth - r.right });
      }
    }
  }, [buttonId, cursorPos]);

  return (
    <div style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}>
      <TaskMenu task={task} onClose={onClose} onRecurrenceDelete={onRecurrenceDelete} onSelect={onSelect} onMoveToToday={onMoveToToday} />
    </div>
  );
}

function dateStr(d) {
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}

function nextWeekday(weekday) {
  // weekday: 0=dom, 1=seg, 6=sab
  const d = new Date();
  const diff = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return dateStr(d);
}

// Linha de menu com flyout lateral (desktop) ou accordion (mobile)
function FlyoutRow({ label, rowRef, open, onEnter, onLeave, onToggle, children }) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  if (isMobile) {
    return (
      <div ref={rowRef}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
          className="menu-item w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center justify-between"
        >
          <span>{label}</span>
          <span className="text-text-secondary text-xs ml-2 transition-transform" style={{ display: "inline-block", transform: open ? "rotate(90deg)" : "none" }}>▸</span>
        </button>
        {open && (
          <div className="border-t border-border bg-bg/60">
            {children}
          </div>
        )}
      </div>
    );
  }

  // Desktop: flyout lateral com hover
  const side = (() => {
    if (!rowRef.current) return { left: "100%", top: 0 };
    const r = rowRef.current.getBoundingClientRect();
    return r.right + 210 > window.innerWidth - 8
      ? { right: "100%", top: 0 }
      : { left: "100%", top: 0 };
  })();

  return (
    <div ref={rowRef} className="relative" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <div className="menu-item w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center justify-between cursor-default select-none">
        <span>{label}</span>
        <span className="text-text-secondary text-xs ml-2">▸</span>
      </div>
      {open && (
        <div
          className="absolute bg-card border border-border rounded-xl shadow-xl py-1.5 z-[9999]"
          style={{ ...side, minWidth: 200 }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function TaskMenu({ task, onClose, onRecurrenceDelete, onSelect, onMoveToToday }) {
  const { deleteTask, archiveTask, unarchiveTask, moveToToday, moveToSomeday, duplicateTask, updateTask } = useTaskStore();
  const { tags, taskTags, addTagToTask, removeTagFromTask } = useTagStore();
  const { areas, projects } = useAreaStore();
  const { saveTemplate } = useTemplateStore();
  const ref = useRef(null);
  const [openSub, setOpenSub] = useState(null); // "date" | "tags" | "areas"
  const dateRowRef = useRef(null);
  const tagsRowRef = useRef(null);
  const areasRowRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [onClose]);

  const run = (fn) => async (e) => { e?.stopPropagation(); await fn(); onClose(); };
  const isSomeday = task.someday;
  const isArchived = !!task.archived_at;
  const activeTags = taskTags[task.id] ?? [];

  const DATE_OPTIONS = [
    {
      label: "Nenhum",
      icon: "✕",
      apply: () => updateTask(task.id, { scheduled_date: null, scheduled_time: null, someday: false }),
    },
    {
      label: "Hoje",
      icon: "☀️",
      apply: () => onMoveToToday ? onMoveToToday() : updateTask(task.id, { scheduled_date: todayStr(), someday: false }),
    },
    {
      label: "Amanhã",
      icon: "📅",
      apply: () => {
        const d = new Date(); d.setDate(d.getDate() + 1);
        updateTask(task.id, { scheduled_date: dateStr(d), someday: false });
      },
    },
    {
      label: "Depois de Amanhã",
      icon: "⏩",
      apply: () => {
        const d = new Date(); d.setDate(d.getDate() + 2);
        updateTask(task.id, { scheduled_date: dateStr(d), someday: false });
      },
    },
    {
      label: "Próximo Fim de Semana",
      icon: "🏖️",
      apply: () => updateTask(task.id, { scheduled_date: nextWeekday(6), scheduled_time: "09:00", someday: false }),
    },
    {
      label: "Próxima Semana",
      icon: "📆",
      apply: () => updateTask(task.id, { scheduled_date: nextWeekday(1), scheduled_time: "09:00", someday: false }),
    },
  ];

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-50 py-1.5 min-w-[200px]"
    >
      {/* Selecionar (inicia multi-select) */}
      <button
        onClick={(e) => { e.stopPropagation(); onSelect?.(); onClose(); }}
        className="menu-item w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2"
      >
        <span>☑️</span>
        <span>Selecionar</span>
      </button>
      <div className="h-px bg-border mx-2 my-1" />

      {/* Data Limite */}
      <FlyoutRow
        label="📅 Data Limite"
        rowRef={dateRowRef}
        open={openSub === "date"}
        onEnter={() => setOpenSub("date")}
        onLeave={() => setOpenSub(null)}
        onToggle={() => setOpenSub(openSub === "date" ? null : "date")}
      >
        {DATE_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            onClick={run(opt.apply)}
            className="menu-item w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2"
          >
            <span>{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </FlyoutRow>

      {/* Etiquetas */}
      <FlyoutRow
        label="🏷️ Etiquetas"
        rowRef={tagsRowRef}
        open={openSub === "tags"}
        onEnter={() => setOpenSub("tags")}
        onLeave={() => setOpenSub(null)}
        onToggle={() => setOpenSub(openSub === "tags" ? null : "tags")}
      >
        {tags.length === 0 && (
          <p className="px-3 py-2 text-xs text-text-secondary">Nenhuma etiqueta criada</p>
        )}
        {tags.map((tag) => {
          const active = activeTags.some((t) => t.id === tag.id);
          return (
            <button
              key={tag.id}
              onClick={async (e) => {
                e.stopPropagation();
                active ? await removeTagFromTask(task.id, tag.id) : await addTagToTask(task.id, tag.id);
              }}
              className="menu-item w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: tag.color ?? "#8E8E93" }}
              />
              <span className="flex-1">{tag.name}</span>
              {active && <span className="text-primary text-xs">✓</span>}
            </button>
          );
        })}
      </FlyoutRow>

      {/* Áreas & Projetos */}
      <FlyoutRow
        label="📁 Áreas"
        rowRef={areasRowRef}
        open={openSub === "areas"}
        onEnter={() => setOpenSub("areas")}
        onLeave={() => setOpenSub(null)}
        onToggle={() => setOpenSub(openSub === "areas" ? null : "areas")}
      >
        {/* Sem área */}
        <button
          onClick={run(() => updateTask(task.id, { area_id: null, project_id: null }))}
          className="menu-item w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2"
        >
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-border" />
          <span className="flex-1 text-text-secondary">Sem área</span>
          {!task.area_id && !task.project_id && <span className="text-primary text-xs">✓</span>}
        </button>
        <div className="h-px bg-border mx-2 my-1" />
        {areas.length === 0 && (
          <p className="px-3 py-2 text-xs text-text-secondary">Nenhuma área criada</p>
        )}
        {areas.map((area) => {
          const areaProjects = projects.filter((p) => p.area_id === area.id);
          return (
            <div key={area.id}>
              {/* Área */}
              <button
                onClick={run(() => updateTask(task.id, { area_id: area.id, project_id: null }))}
                className="menu-item w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: area.color ?? "#8E8E93" }}
                />
                <span className="flex-1 font-medium">{area.name}</span>
                {task.area_id === area.id && !task.project_id && <span className="text-primary text-xs">✓</span>}
              </button>
              {/* Projetos da área */}
              {areaProjects.map((proj) => (
                <button
                  key={proj.id}
                  onClick={run(() => updateTask(task.id, { project_id: proj.id, area_id: area.id }))}
                  className="menu-item w-full text-left pl-7 pr-3 py-2 text-sm transition-colors flex items-center gap-2"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: proj.color ?? "#8E8E93" }}
                  />
                  <span className="flex-1 text-text-secondary">{proj.name}</span>
                  {task.project_id === proj.id && <span className="text-primary text-xs">✓</span>}
                </button>
              ))}
            </div>
          );
        })}
      </FlyoutRow>

      {!isSomeday && (
        <button onClick={run(() => moveToSomeday(task.id))} className="menu-item w-full text-left px-3 py-2.5 text-sm transition-colors">
          🔮 Mover para Depois
        </button>
      )}
      <div className="h-px bg-border mx-2 my-1" />
      <button onClick={run(() => duplicateTask(task.id))} className="menu-item w-full text-left px-3 py-2.5 text-sm transition-colors">
        📋 Duplicar tarefa
      </button>
      <button onClick={run(() => { saveTemplate(task); })} className="menu-item w-full text-left px-3 py-2.5 text-sm transition-colors">
        ⭐ Salvar como modelo
      </button>
      {isArchived ? (
        <button onClick={run(() => unarchiveTask(task.id))} className="menu-item w-full text-left px-3 py-2.5 text-sm transition-colors">
          📤 Desarquivar
        </button>
      ) : (
        <button onClick={run(() => archiveTask(task.id))} className="menu-item w-full text-left px-3 py-2.5 text-sm transition-colors">
          📦 Arquivar
        </button>
      )}
      <div className="h-px bg-border mx-2 my-1" />
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (task.recurrence) {
            onClose();
            onRecurrenceDelete();
          } else {
            deleteTask(task.id);
            onClose();
          }
        }}
        className="menu-item w-full text-left px-3 py-2.5 text-sm !text-danger transition-colors"
      >
        🗑️ Mover para lixeira
      </button>
    </div>
  );
}

/* ── Componente principal ── */
export function TaskCard({ task, subtasks = [], onClick }) {
  const { completeTask, uncompleteTask, updateTask, deleteTask, deleteRecurrenceFuture, toggleSubtask, addSubtask } = useTaskStore();
  const { tags, taskTags, fetchTaskTags, addTagToTask, removeTagFromTask } = useTagStore();
  const { areas, projects } = useAreaStore();
  const { toggle, isSelected, selectedIds } = useSelectionStore();
  const { expandedTaskId, setExpandedTaskId, showToast, dismissToast } = useUiStore();

  const [completing, setCompleting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [contextPos, setContextPos] = useState(null);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [longPressing, setLongPressing] = useState(false);
  const [focusField, setFocusField] = useState("title");
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [notesDraft, setNotesDraft] = useState(task.notes ?? "");
  const [date, setDate] = useState(task.scheduled_date ?? "");
  const [time, setTime] = useState(task.scheduled_time ?? "");
  const [duration, setDuration] = useState(task.duration_minutes ?? "");
  const [reminder, setReminder] = useState(task.reminder_minutes ?? null);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showSlotPicker, setShowSlotPicker] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [meetQuick, setMeetQuick] = useState(false);
  const [meetCreating, setMeetCreating] = useState(false);
  const [showMeetPopover, setShowMeetPopover] = useState(false);
  const meetBadgeRef = useRef(null);
  const swipingRef = useRef(false); // true quando comprometido com gesto horizontal
  const hapticFiredRef = useRef(false);

  const titleInputRef = useRef(null);
  const notesRef = useRef(null);
  const tagPickerRef = useRef(null);
  const tagBtnRef = useRef(null);
  const collapseRef = useRef(null);
  const pendingCursorRef = useRef(null);
  const longPressRef = useRef(null);
  const longPressFiredRef = useRef(false);
  const swipeStartRef = useRef(null);
  const cardRef = useRef(null);

  const expanded = expandedTaskId === task.id;
  const selected = isSelected(task.id);
  const anySelected = selectedIds.length > 0;
  const taskTagList = taskTags[task.id] ?? [];
  const available = tags.filter((t) => !taskTagList.find((tt) => tt.id === t.id));
  const subtaskTotal = subtasks.length;
  const subtaskDone = subtasks.filter((s) => s.completed).length;
  const overdueDeadline = isOverdue(task.deadline);
  const isUrgent = !!task.is_urgent && !task.completed_at;

  const taskProject = task.project_id ? projects.find((p) => p.id === task.project_id) : null;
  const taskArea = task.area_id ? areas.find((a) => a.id === task.area_id) : null;
  const contextLabel = taskProject ?? taskArea ?? null;
  const collapsedTags = taskTags[task.id] ?? [];
  const settings = useSettingsStore();

  const handleMoveToToday = () => {
    const { tasks: allTasks } = useTaskStore.getState();
    const todayDate = todayStr();
    const todayTasks = allTasks.filter(
      (t) => t.scheduled_date === todayDate && !t.completed_at && !t.deleted_at && t.id !== task.id
    );
    const slots = computeAvailableSlots(todayTasks, settings);
    if (!slots.manha.full) {
      updateTask(task.id, { scheduled_date: todayDate, scheduled_time: slots.manha.time, someday: false });
    } else {
      setShowMenu(false);
      setContextPos(null);
      setShowSlotPicker(true);
    }
  };

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });

  // Sincroniza estado local quando a prop muda (e não está editando)
  useEffect(() => {
    if (!expanded) {
      setTitleDraft(task.title);
      setNotesDraft(task.notes ?? "");
      setDate(task.scheduled_date ?? "");
      setTime(task.scheduled_time ?? "");
      setDuration(task.duration_minutes ?? "");
      setReminder(task.reminder_minutes ?? null);
    }
  }, [task.title, task.notes, task.scheduled_date, task.scheduled_time, task.duration_minutes, task.reminder_minutes, expanded]);

  useEffect(() => { if (expanded) fetchTaskTags(task.id); }, [expanded, task.id]);

  // Cancela o long-press quando DnD ativa o drag (evita multi-select disparar no meio do arraste)
  useEffect(() => {
    if (isDragging) {
      clearTimeout(longPressRef.current);
      longPressFiredRef.current = false;
      setLongPressing(false);
    }
  }, [isDragging]);

  // Foca o campo certo ao expandir
  useEffect(() => {
    if (!expanded) return;
    const timer = setTimeout(() => {
      if (focusField === "title" && titleInputRef.current) {
        titleInputRef.current.focus();
        const len = titleInputRef.current.value.length;
        titleInputRef.current.setSelectionRange(len, len);
      } else if (focusField === "notes" && notesRef.current) {
        notesRef.current.focus();
        resizeTextarea(notesRef.current);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [expanded, focusField]);

  // Ajusta altura dos textareas quando muda conteúdo ou expande
  useEffect(() => {
    if (expanded && notesRef.current) resizeTextarea(notesRef.current);
    if (expanded && titleInputRef.current) resizeTextarea(titleInputRef.current);
  }, [notesDraft, titleDraft, expanded]);

  // Restaura posição do cursor após atualização de estado (bullet list)
  useLayoutEffect(() => {
    if (pendingCursorRef.current !== null && notesRef.current) {
      const pos = pendingCursorRef.current;
      notesRef.current.setSelectionRange(pos, pos);
      pendingCursorRef.current = null;
      resizeTextarea(notesRef.current);
    }
  }, [notesDraft]);

  // Fecha tag picker ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target))
        setShowTagPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Listener non-passive separado só para cancelar scroll vertical durante swipe horizontal
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const preventScroll = (e) => {
      if (swipingRef.current) e.preventDefault();
    };
    el.addEventListener("touchmove", preventScroll, { passive: false });
    return () => el.removeEventListener("touchmove", preventScroll);
  }, []);

  // Esc → salva e recolhe
  useEffect(() => {
    if (!expanded) return;
    const handler = (e) => {
      if (e.key === "Escape") { e.preventDefault(); collapseRef.current?.(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [expanded]);

  // Clique fora do card → recolhe
  useEffect(() => {
    if (!expanded) return;
    const handler = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        collapseRef.current?.();
      }
    };
    // mousedown no desktop, touchstart no mobile
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [expanded]);

  const resizeTextarea = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  const saveTitle = () => {
    const t = titleDraft.trim();
    if (t && t !== task.title) updateTask(task.id, { title: t });
    else if (!t) setTitleDraft(task.title);
  };

  const saveNotes = () => {
    const n = notesDraft.trim() || null;
    if (n !== (task.notes ?? null)) updateTask(task.id, { notes: n });
  };

  // ── Bullet list no textarea de notas ──
  const handleNotesKeyDown = (e) => {
    const ta = e.target;
    const { value, selectionStart: ss, selectionEnd: se } = ta;

    const lineStart = value.lastIndexOf("\n", ss - 1) + 1;
    const lineEndRaw = value.indexOf("\n", ss);
    const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw;
    const currentLine = value.substring(lineStart, lineEnd);

    // Detecta se a linha atual é um marcador: "  • texto"
    const bulletMatch = currentLine.match(/^(\s*)•\s/);

    // Espaço após "-" no início da linha → converte para "• "
    if (e.key === " " && ss === se) {
      const textBefore = value.substring(lineStart, ss);
      const dashMatch = textBefore.match(/^(\s*)-$/);
      if (dashMatch) {
        e.preventDefault();
        const indent = dashMatch[1];
        const newVal = value.substring(0, lineStart) + indent + "• " + value.substring(ss);
        const newPos = lineStart + indent.length + 2;
        setNotesDraft(newVal);
        pendingCursorRef.current = newPos;
        return;
      }
    }

    // Tab / Shift+Tab em linha com marcador → indent / unindent
    if (e.key === "Tab") {
      e.preventDefault();
      if (bulletMatch) {
        const indent = bulletMatch[1];
        if (e.shiftKey) {
          // Remove 2 espaços de indentação
          if (indent.length >= 2) {
            const newLine = indent.slice(2) + currentLine.slice(indent.length);
            const newVal = value.substring(0, lineStart) + newLine + value.substring(lineEnd);
            setNotesDraft(newVal);
            pendingCursorRef.current = Math.max(lineStart, ss - 2);
          }
        } else {
          // Adiciona 2 espaços de indentação
          const newVal = value.substring(0, lineStart) + "  " + currentLine + value.substring(lineEnd);
          setNotesDraft(newVal);
          pendingCursorRef.current = ss + 2;
        }
      }
      return;
    }

    // Enter em linha com marcador → continua ou encerra a lista
    if (e.key === "Enter" && bulletMatch && ss === se) {
      const indent = bulletMatch[1];
      const afterBullet = currentLine.slice(indent.length + 2); // depois de "• "

      e.preventDefault();
      if (afterBullet.trim() === "") {
        // Linha vazia → encerra a lista (remove o marcador)
        const newVal = value.substring(0, lineStart) + "\n" + value.substring(lineEnd);
        setNotesDraft(newVal);
        pendingCursorRef.current = lineStart + 1;
      } else {
        // Continua a lista com mesmo nível de indentação
        const insertion = "\n" + indent + "• ";
        const newVal = value.substring(0, ss) + insertion + value.substring(se);
        setNotesDraft(newVal);
        pendingCursorRef.current = ss + insertion.length;
      }
      return;
    }
  };

  // collapseRef sempre aponta para a versão atual (evita stale closure no handler do Esc)
  const collapseTask = () => {
    saveTitle();
    saveNotes();
    setExpandedTaskId(null);
  };
  collapseRef.current = collapseTask;

  const expandTask = (field = "title") => {
    setFocusField(field);
    setExpandedTaskId(task.id);
    // Scroll card into view after expansion (helps on mobile with keyboard)
    setTimeout(() => {
      const ref = field === "notes" ? notesRef.current : titleInputRef.current;
      ref?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };

  const doComplete = async (checked) => {
    setCompleting(true);
    setConfirmComplete(false);
    if (checked) {
      await completeTask(task.id);
      // Toast com Desfazer — desfaz a conclusão se clicado dentro do timeout
      const toastId = showToast({
        message: `✓ "${task.title.slice(0, 28)}${task.title.length > 28 ? "…" : ""}" concluída`,
        action: "Desfazer",
        onAction: async () => {
          dismissToast(toastId);
          await uncompleteTask(task.id);
        },
        duration: 5000,
      });
    } else {
      await uncompleteTask(task.id);
    }
    setCompleting(false);
  };

  const handleCheck = async (checked) => {
    if (checked && subtaskTotal > 0 && subtaskDone < subtaskTotal) {
      setConfirmComplete(true);
      return;
    }
    await doComplete(checked);
  };

  const hasMetadata = task.scheduled_date || task.scheduled_time || task.recurrence ||
    task.deadline || task.duration_minutes || subtaskTotal > 0 || isUrgent ||
    contextLabel || collapsedTags.length > 0 || task.priority || task.meeting_url;

  const SWIPE_THRESHOLD = 80;

  const handleTouchStart = (e) => {
    swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    swipingRef.current = false;
    hapticFiredRef.current = false;
    if (anySelected) return;
    setLongPressing(true);
    longPressRef.current = setTimeout(() => {
      setLongPressing(false);
      longPressFiredRef.current = true;
      toggle(task.id);
      navigator.vibrate?.(40);
    }, 500);
  };

  const handleTouchMove = (e) => {
    if (!swipeStartRef.current) return;
    const dx = e.touches[0].clientX - swipeStartRef.current.x;
    const dy = e.touches[0].clientY - swipeStartRef.current.y;
    clearTimeout(longPressRef.current);
    setLongPressing(false);

    // Se ainda não comprometeu: decide se é horizontal ou vertical
    if (!swipingRef.current) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; // movimento pequeno demais
      if (Math.abs(dy) > Math.abs(dx)) return; // vertical — deixa o scroll agir
      swipingRef.current = true;
    }

    if (expanded || anySelected) return;

    const clamped = Math.max(-120, Math.min(120, dx));
    setSwipeX(clamped);

    // Haptic ao cruzar o threshold (uma vez por gesto)
    if (!hapticFiredRef.current && Math.abs(clamped) >= SWIPE_THRESHOLD) {
      navigator.vibrate?.(10);
      hapticFiredRef.current = true;
    }
    if (Math.abs(clamped) < SWIPE_THRESHOLD) {
      hapticFiredRef.current = false;
    }
  };

  const handleTouchEnd = (e) => {
    clearTimeout(longPressRef.current);
    setLongPressing(false);
    // Bloqueia o click sintético que o iOS dispara após long-press
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      e.preventDefault();
      setSwipeX(0);
      swipeStartRef.current = null;
      swipingRef.current = false;
      return;
    }
    if (swipeX > SWIPE_THRESHOLD) {
      handleCheck(!task.completed_at); // concluir ou desfazer
    } else if (swipeX < -SWIPE_THRESHOLD) {
      deleteTask(task.id); // lixeira direta
    }
    setSwipeX(0);
    swipeStartRef.current = null;
    swipingRef.current = false;
  };

  const swipeActive = Math.abs(swipeX) > 8;
  const swipeRight = swipeX > 0;
  const swipePct = Math.min(Math.abs(swipeX) / SWIPE_THRESHOLD, 1); // 0→1 até o threshold

  return (
    <>
    <div
      ref={cardRef}
      className="relative rounded-card overflow-hidden"
      style={{ zIndex: showMenu ? 20 : undefined }}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextPos({ x: e.clientX, y: e.clientY });
        setShowMenu(true);
      }}
    >
      {/* Swipe reveal backgrounds — ficam ATRÁS do card, revelados pelo slide */}
      {swipeActive && (
        <div
          className={[
            "absolute inset-0 flex items-center px-5 rounded-card",
            swipeRight ? "justify-start" : "justify-end",
          ].join(" ")}
          style={{
            backgroundColor: swipeRight
              ? `rgba(52,199,89,${0.15 + swipePct * 0.55})`  // verde progressivo
              : `rgba(255,59,48,${0.15 + swipePct * 0.55})`, // vermelho progressivo
          }}
        >
          <span
            className="transition-transform"
            style={{ fontSize: `${16 + swipePct * 8}px`, transform: `scale(${0.8 + swipePct * 0.4})` }}
          >
            {swipeRight ? (task.completed_at ? "↩️" : "✅") : "🗑️"}
          </span>
        </div>
      )}
    <div
      ref={setNodeRef}
      {...attributes}
      style={{
        transform: swipeX !== 0
          ? `translateX(${swipeX}px)`
          : CSS.Transform.toString(transform),
        transition: swipeX !== 0 ? "none" : `${transition}, transform 0.25s cubic-bezier(.25,.8,.25,1)`,
      }}
      onDoubleClick={() => onClick?.()}
      onTouchStart={(e) => { listeners?.onTouchStart?.(e); handleTouchStart(e); }}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      className={[
        "task-card group relative overflow-hidden rounded-card",
        completing ? "opacity-50" : "",
        task.completed_at ? "opacity-40" : "",
        isDragging ? "opacity-30" : "",
        selected ? "bg-primary/15 border-l-[3px] border-primary" : "",
        expanded ? "ring-1 ring-primary/20" : "",
        isUrgent ? "is-urgent" : "",
        longPressing ? "scale-[0.98] opacity-80 transition-transform duration-150" : "",
      ].join(" ")}
    >
      {/* Overlay de seleção: captura todos os toques quando no modo multi-select */}
      {anySelected && !expanded && (
        <div
          className="absolute inset-0 z-[15]"
          onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); toggle(task.id); }}
          onClick={(e) => { e.stopPropagation(); toggle(task.id); }}
        />
      )}
      <div className="task-card-row">
        {/* Ícone de arraste — desktop: com pointer listeners; mobile: card inteiro tem TouchSensor via onTouchStart composto */}
        <div
          className="hidden md:block shrink-0"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <div
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-[#8E8E93] hover:text-[#3C3C43] dark:text-white/50 dark:hover:text-white/80 px-0.5 pt-0.5 transition-all select-none text-base opacity-0 group-hover:opacity-100"
          >
            ⠿
          </div>
        </div>

        {/* Checkbox circular */}
        <div className="shrink-0" onDoubleClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={!!task.completed_at}
            onChange={(checked) => {
              if (anySelected) { toggle(task.id); return; }
              handleCheck(checked);
            }}
            deadline={overdueDeadline}
          />
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0" onDoubleClick={(e) => e.stopPropagation()}>
          {expanded ? (
            /* ── EXPANDIDO ── */
            <>
              <textarea
                ref={titleInputRef}
                value={titleDraft}
                onChange={(e) => { setTitleDraft(e.target.value); resizeTextarea(e.target); }}
                onBlur={saveTitle}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); notesRef.current?.focus(); } }}
                onClick={(e) => e.stopPropagation()}
                rows={1}
                className="w-full text-base font-medium text-text-main bg-transparent outline-none leading-snug resize-none overflow-hidden"
                style={{ minHeight: "24px" }}
                placeholder="Título"
              />

              <textarea
                ref={notesRef}
                value={notesDraft}
                onChange={(e) => { setNotesDraft(e.target.value); resizeTextarea(e.target); }}
                onKeyDown={handleNotesKeyDown}
                onBlur={saveNotes}
                onClick={(e) => e.stopPropagation()}
                placeholder="Notas  ·  digite - espaço para criar lista"
                rows={1}
                className="w-full text-xs text-text-secondary bg-transparent outline-none resize-none overflow-hidden leading-normal mt-0.5 py-0 placeholder:text-[#C7C7CC] dark:placeholder:text-[#48484A]"
                style={{ minHeight: "16px" }}
              />

              {/* Linha de topo mobile: botão ··· inline */}
              <div className="flex md:hidden items-center justify-end -mt-0.5 mb-1" onClick={e => e.stopPropagation()}>
                <button
                  ref={(el) => { if (el) el._menuBtn = true; }}
                  id={`menu-btn-exp-${task.id}`}
                  onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v); }}
                  className="text-[#8E8E93] w-8 h-6 flex items-center justify-center rounded-lg text-sm tracking-widest"
                >
                  ···
                </button>
              </div>

              {/* Etiquetas */}
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5" onClick={(e) => e.stopPropagation()}>
                {taskTagList.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => removeTagFromTask(task.id, tag.id)}
                    className="text-[11px] px-2 py-0.5 rounded-full hover:opacity-70 transition-opacity flex items-center gap-0.5"
                    style={{ backgroundColor: tag.color + "20", color: tag.color }}
                  >
                    {tag.name} ×
                  </button>
                ))}
                <div ref={tagPickerRef}>
                  <button
                    ref={tagBtnRef}
                    onClick={() => setShowTagPicker((v) => !v)}
                    className="text-[11px] text-[#AEAEB2] dark:text-[#636366] hover:text-text-secondary transition-colors"
                  >
                    + Adicionar Etiqueta
                  </button>
                  {showTagPicker && available.length > 0 && createPortal(
                    <div
                      style={{
                        position: "fixed",
                        top: (tagBtnRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
                        left: tagBtnRef.current?.getBoundingClientRect().left ?? 0,
                        zIndex: 9999,
                      }}
                      className="bg-card border border-border rounded-xl shadow-xl py-1.5 min-w-[150px]"
                    >
                      {available.map((tag) => (
                        <button
                          key={tag.id}
                          onMouseDown={(e) => { e.preventDefault(); addTagToTask(task.id, tag.id); setShowTagPicker(false); }}
                          className="menu-item flex items-center gap-2 w-full text-left px-3 py-2 text-xs"
                        >
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                          {tag.name}
                        </button>
                      ))}
                    </div>,
                    document.body
                  )}
                </div>
              </div>

              {/* Mini checklist de subtarefas */}
              {subtasks.length > 0 && (
                <div className="mt-2 space-y-0.5" onClick={(e) => e.stopPropagation()}>
                  {subtasks.map((st) => (
                    <label key={st.id} className="flex items-center gap-2 cursor-pointer group/st">
                      <input
                        type="checkbox"
                        checked={st.completed}
                        onChange={(e) => toggleSubtask(task.id, st.id, e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-success shrink-0"
                      />
                      <span className={["text-xs transition-colors", st.completed ? "line-through text-text-secondary" : "text-text-main"].join(" ")}>
                        {st.title}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* Linha de meta: data · hora · urgência · duração */}
              <div
                className="flex items-center gap-2 flex-wrap mt-1"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                <DateField
                  value={date}
                  onChange={(v) => { setDate(v); updateTask(task.id, { scheduled_date: v || null }); }}
                />
                <TimeField
                  value={time}
                  onChange={(v) => { setTime(v); updateTask(task.id, { scheduled_time: v || null }); }}
                />
                <PriorityButton task={task} updateTask={updateTask} />
                <UrgencyButton task={task} updateTask={updateTask} />
                {time && (
                  <ReminderField
                    value={reminder}
                    onChange={(v) => { setReminder(v); updateTask(task.id, { reminder_minutes: v }); }}
                  />
                )}
                <select
                  value={duration}
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    setDuration(v ?? "");
                    updateTask(task.id, { duration_minutes: v });
                  }}
                  className={[
                    "text-xs rounded-full px-2 py-0.5 outline-none cursor-pointer",
                    duration
                      ? "meta-chip-filled text-text-secondary"
                      : "bg-transparent text-[#AEAEB2] dark:text-[#636366]",
                  ].join(" ")}
                >
                  <option value="">⏱ Duração</option>
                  {DURATION_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <select
                  defaultValue={task.recurrence ?? ""}
                  onChange={(e) => updateTask(task.id, { recurrence: e.target.value || null })}
                  className={[
                    "text-xs rounded-full px-2 py-0.5 outline-none cursor-pointer",
                    task.recurrence
                      ? "meta-chip-filled text-text-secondary"
                      : "bg-transparent text-[#AEAEB2] dark:text-[#636366]",
                  ].join(" ")}
                >
                  <option value="">↺ Repetir</option>
                  <option value="daily">Diariamente</option>
                  <option value="weekdays">Dias úteis</option>
                  <option value="weekly">Semanalmente</option>
                  <option value="biweekly">Quinzenalmente</option>
                  <option value="monthly">Mensalmente</option>
                </select>

                {/* Meet na tarefa expandida */}
                {!task.completed_at && (
                  task.meeting_url ? (
                    <button
                      ref={meetBadgeRef}
                      onClick={e => { e.stopPropagation(); setShowMeetPopover(v => !v); }}
                      className="text-xs rounded-full px-2 py-0.5 font-semibold flex items-center gap-1 meta-chip-filled text-[#00897B] transition-colors"
                    >
                      <svg width="10" height="10" viewBox="0 0 48 48" fill="none">
                        <rect width="48" height="48" rx="8" fill="#00BFA5"/>
                        <path d="M8 16C8 13.8 9.8 12 12 12H28C30.2 12 32 13.8 32 16V32C32 34.2 30.2 36 28 36H12C9.8 36 8 34.2 8 32V16Z" fill="white"/>
                        <path d="M34 20L40 15V33L34 28V20Z" fill="white"/>
                        <circle cx="20" cy="24" r="5" fill="#00BFA5"/>
                      </svg>
                      Meet
                    </button>
                  ) : (
                    <button
                      onClick={async e => {
                        e.stopPropagation();
                        const token = useAuthStore.getState().getGoogleToken();
                        if (!token) { setMeetQuick(true); return; }
                        setMeetCreating(true);
                        try {
                          const today = new Date();
                          const d = task.scheduled_date ?? `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
                          const t = task.scheduled_time ?? "09:00";
                          const { meetLink, eventId } = await createMeetingEvent(token, {
                            title: task.title,
                            date: d,
                            time: t,
                            duration: task.duration_minutes || 60,
                            attendees: [],
                          });
                          useTaskStore.getState().updateTask(task.id, {
                            meeting_url: meetLink,
                            meeting_event_id: eventId,
                            meeting_attendees: [],
                          });
                        } catch (_) {
                          setMeetQuick(true);
                        } finally {
                          setMeetCreating(false);
                        }
                      }}
                      className="text-xs rounded-full px-2 py-0.5 flex items-center gap-1 bg-transparent text-[#AEAEB2] dark:text-[#636366] hover:text-[#00897B] transition-colors"
                    >
                      {meetCreating ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="animate-spin">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="50" strokeDashoffset="15"/>
                        </svg>
                      ) : (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                        </svg>
                      )}
                      Meet
                    </button>
                  )
                )}
              </div>
            </>
          ) : (
            /* ── RECOLHIDO ── */
            <>
              <p
                onClick={(e) => {
                  e.stopPropagation();
                  if (anySelected) { toggle(task.id); return; }
                  if (!task.completed_at) expandTask("title");
                }}
                onDoubleClick={(e) => e.stopPropagation()}
                className={[
                  "text-[15px] leading-snug flex items-baseline gap-1.5",
                  task.completed_at
                    ? "line-through text-text-secondary cursor-default"
                    : "text-text-main cursor-text",
                ].join(" ")}
              >
                {task.priority && !task.completed_at && (
                  <span className="text-[10px] shrink-0 leading-none" style={{ color: PRIORITY_CONFIG[task.priority].color }}>⚑</span>
                )}
                {task.title}
              </p>

              {task.notes && (
                <p
                  onClick={(e) => {
                    if (e.target.tagName === "A") return;
                    e.stopPropagation();
                    if (anySelected) { toggle(task.id); return; }
                    if (!task.completed_at) expandTask("notes");
                  }}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className="text-[13px] text-text-secondary mt-0.5 leading-relaxed whitespace-pre-wrap break-words cursor-text"
                >
                  {parseNotes(task.notes).map((part, i) =>
                    part.type === "bold" ? (
                      <strong key={i} className="font-semibold text-text-main">{part.value}</strong>
                    ) : part.type === "italic" ? (
                      <em key={i} className="italic">{part.value}</em>
                    ) : part.type === "code" ? (
                      <code key={i} className="font-mono text-[10px] bg-bg px-1 py-0.5 rounded border border-border">{part.value}</code>
                    ) : part.type === "url" ? (
                      <a
                        key={i}
                        href={part.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary underline underline-offset-2 hover:opacity-75 transition-opacity break-all"
                      >{part.value}</a>
                    ) : part.type === "phone" ? (
                      <a
                        key={i}
                        href={`tel:${part.value.replace(/\D/g, "")}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary underline underline-offset-2 hover:opacity-75 transition-opacity"
                      >{part.value}</a>
                    ) : (
                      <span key={i}>{part.value}</span>
                    )
                  )}
                </p>
              )}

              {hasMetadata && (
                <div
                  className="flex items-center gap-2 mt-1 flex-wrap"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (anySelected) { toggle(task.id); return; }
                    if (!task.completed_at) expandTask("title");
                  }}
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  {isUrgent && (
                    <span className="text-xs text-danger font-medium flex items-center gap-0.5">
                      🔔 Urgente
                    </span>
                  )}
                  {(task.scheduled_date || task.scheduled_time) && (
                    <span className={[
                      "text-xs flex items-center gap-0.5",
                      isOverdue(task.scheduled_date) ? "text-warning" : "text-text-secondary",
                    ].join(" ")}>
                      <span className="text-[10px]">📅</span>
                      {task.scheduled_date && formatDate(task.scheduled_date)}
                      {task.scheduled_date && task.scheduled_time && ","}
                      {task.scheduled_time && ` ${task.scheduled_time}`}
                    </span>
                  )}
                  {task.recurrence && (
                    <span className="text-xs text-text-secondary flex items-center gap-0.5">
                      <span>↺</span>{RECURRENCE_LABELS[task.recurrence] ?? task.recurrence}
                    </span>
                  )}
                  {task.deadline && !task.completed_at && (() => {
                    const urg = deadlineUrgency(task.deadline);
                    if (urg) return (
                      <span
                        className={["text-[10px] font-semibold flex items-center gap-1 px-1.5 py-0.5 rounded-full", urg.pulse ? "animate-pulse" : ""].join(" ")}
                        style={{ color: urg.color, backgroundColor: urg.color + "22" }}
                      >
                        🚨 {urg.label}
                      </span>
                    );
                    return (
                      <span className="text-xs text-text-secondary flex items-center gap-0.5">
                        <span>🚨</span>{formatDate(task.deadline)}
                      </span>
                    );
                  })()}
                  {task.duration_minutes && (
                    <span className="text-xs text-text-secondary">{durationLabel(task.duration_minutes)}</span>
                  )}
                  {task.meeting_url && !task.completed_at && (
                    <button
                      ref={meetBadgeRef}
                      onClick={e => { e.stopPropagation(); setShowMeetPopover(v => !v); }}
                      className="text-[10px] font-semibold flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#00BFA5]/10 text-[#00897B] hover:bg-[#00BFA5]/20 transition-colors select-none"
                    >
                      <svg width="10" height="10" viewBox="0 0 48 48" fill="none">
                        <rect width="48" height="48" rx="8" fill="#00BFA5"/>
                        <path d="M8 16C8 13.8 9.8 12 12 12H28C30.2 12 32 13.8 32 16V32C32 34.2 30.2 36 28 36H12C9.8 36 8 34.2 8 32V16Z" fill="white"/>
                        <path d="M34 20L40 15V33L34 28V20Z" fill="white"/>
                        <circle cx="20" cy="24" r="5" fill="#00BFA5"/>
                      </svg>
                      Meet
                    </button>
                  )}
                  {subtaskTotal > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-16 h-1 bg-border rounded-full overflow-hidden shrink-0">
                        <span
                          className="block h-full rounded-full bg-success transition-all"
                          style={{ width: `${Math.round((subtaskDone / subtaskTotal) * 100)}%` }}
                        />
                      </span>
                      <span className="text-[10px] text-text-secondary tabular-nums">{subtaskDone}/{subtaskTotal}</span>
                    </span>
                  )}
                  {contextLabel && (
                    <span
                      className="text-[10px] font-medium leading-none px-1.5 py-0.5 rounded-full"
                      style={{
                        color: contextLabel.color ?? "#8E8E93",
                        backgroundColor: (contextLabel.color ?? "#8E8E93") + "22",
                      }}
                    >
                      {taskProject ? "◆" : "▣"} {contextLabel.name}
                    </span>
                  )}
                  {collapsedTags.length > 0 && (
                    <span className="flex items-center gap-0.5">
                      {collapsedTags.map((tag) => (
                        <span
                          key={tag.id}
                          title={tag.name}
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                      ))}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Botão rápido Google Meet — oculto no mobile quando expandido */}
        {!task.completed_at && !anySelected && !expanded && (
          <div className="relative shrink-0" onDoubleClick={e => e.stopPropagation()}>
            {task.meeting_url ? (
              /* Reunião existente — abre direto */
              <a
                href={task.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                title="Entrar na reunião"
                className="w-9 h-9 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-[#00BFA5]/10"
              >
                <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
                  <rect width="48" height="48" rx="8" fill="#00BFA5"/>
                  <path d="M8 16C8 13.8 9.8 12 12 12H28C30.2 12 32 13.8 32 16V32C32 34.2 30.2 36 28 36H12C9.8 36 8 34.2 8 32V16Z" fill="white"/>
                  <path d="M34 20L40 15V33L34 28V20Z" fill="white"/>
                  <circle cx="20" cy="24" r="5" fill="#00BFA5"/>
                </svg>
              </a>
            ) : (
              /* Sem reunião — cria rapidamente */
              <>
                <button
                  onClick={async e => {
                    e.stopPropagation();
                    const token = useAuthStore.getState().getGoogleToken();
                    if (!token) { setMeetQuick(true); return; }
                    setMeetCreating(true);
                    try {
                      const today = new Date();
                      const d = task.scheduled_date ?? `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
                      const t = task.scheduled_time ?? "09:00";
                      const { meetLink, eventId } = await createMeetingEvent(token, {
                        title: task.title,
                        date: d,
                        time: t,
                        duration: task.duration_minutes || 60,
                        attendees: [],
                      });
                      useTaskStore.getState().updateTask(task.id, {
                        meeting_url: meetLink,
                        meeting_event_id: eventId,
                        meeting_attendees: [],
                      });
                    } catch (_) {
                      setMeetQuick(true);
                    } finally {
                      setMeetCreating(false);
                    }
                  }}
                  title="Criar reunião Google Meet"
                  className="w-9 h-9 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-all text-text-secondary/50 hover:text-[#00BFA5] hover:bg-[#00BFA5]/10"
                >
                  {meetCreating ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="50" strokeDashoffset="15"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                    </svg>
                  )}
                </button>
                {meetQuick && createPortal(
                  <div
                    className="fixed inset-0 z-[200] flex items-center justify-center px-6"
                    onClick={() => setMeetQuick(false)}
                  >
                    <div
                      className="bg-card border border-border rounded-2xl shadow-2xl p-5 w-full max-w-xs space-y-3"
                      onClick={e => e.stopPropagation()}
                    >
                      <p className="text-[14px] font-semibold text-text-main">Conectar Google Calendar</p>
                      <p className="text-[13px] text-text-secondary leading-relaxed">
                        Para criar reuniões, você precisa reconectar sua conta Google com permissão ao Calendar.
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => setMeetQuick(false)} className="flex-1 py-2 rounded-xl text-[13px] text-text-secondary border border-border">
                          Cancelar
                        </button>
                        <button
                          onClick={() => { setMeetQuick(false); useAuthStore.getState().connectGoogleCalendar(); }}
                          className="flex-1 py-2 rounded-xl text-[13px] font-semibold text-white"
                          style={{ backgroundColor: "#00BFA5" }}
                        >
                          Conectar
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body
                )}
              </>
            )}
          </div>
        )}

        {/* Menu ··· */}
        <div className="relative shrink-0" onDoubleClick={(e) => e.stopPropagation()}>
          <button
            ref={(el) => { if (el) el._menuBtn = true; }}
            id={`menu-btn-${task.id}`}
            onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v); }}
            className={[
              "text-[#8E8E93] hover:text-[#1C1C1E] dark:text-white/50 dark:hover:text-white/90 w-11 h-11 flex items-center justify-center rounded-lg transition-all active:bg-bg",
              expanded ? "hidden md:flex" : "",
            ].join(" ")}
          >
            ···
          </button>
          {showMenu && createPortal(
            <TaskMenuPortal
              task={task}
              buttonId={expanded ? `menu-btn-exp-${task.id}` : `menu-btn-${task.id}`}
              onClose={() => { setShowMenu(false); setContextPos(null); }}
              onRecurrenceDelete={() => setShowRecurrenceModal(true)}
              cursorPos={contextPos}
              onSelect={() => toggle(task.id)}
              onMoveToToday={handleMoveToToday}
            />,
            document.body
          )}
        </div>
      </div>

      {/* Confirmação: tarefas com subtarefas incompletas */}
      {confirmComplete && (
        <div
          className="px-3 pb-3 pt-1 flex items-center gap-2 flex-wrap animate-toast-in"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-xs text-text-secondary flex-1">
            {subtaskDone}/{subtaskTotal} subtarefas concluídas. Concluir mesmo assim?
          </span>
          <button
            onClick={() => setConfirmComplete(false)}
            className="text-xs text-text-secondary hover:text-text-main px-2 py-1 rounded-lg hover:bg-bg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => doComplete(true)}
            className="text-xs text-white bg-primary hover:bg-primary/90 px-3 py-1 rounded-lg transition-colors font-medium"
          >
            Concluir
          </button>
        </div>
      )}
    </div>
    </div>
    {showRecurrenceModal && (
      <RecurrenceDeleteModal
        task={task}
        onDeleteThis={() => { deleteTask(task.id); setShowRecurrenceModal(false); }}
        onDeleteFuture={() => { deleteRecurrenceFuture(task.id); setShowRecurrenceModal(false); }}
        onCancel={() => setShowRecurrenceModal(false)}
      />
    )}
    {showSlotPicker && (
      <TimeSlotPickerModal
        task={task}
        todayTasks={useTaskStore.getState().tasks.filter(
          (t) => t.scheduled_date === todayStr() && !t.completed_at && !t.deleted_at && t.id !== task.id
        )}
        settings={settings}
        onPick={(slotTime) => {
          updateTask(task.id, { scheduled_date: todayStr(), scheduled_time: slotTime, someday: false });
          setShowSlotPicker(false);
        }}
        onClose={() => setShowSlotPicker(false)}
      />
    )}

    {/* Meet popover — fora do condicional expandido/recolhido para funcionar nos dois modos */}
    {showMeetPopover && task.meeting_url && createPortal(
      <>
        <div className="fixed inset-0 z-[199]" onClick={() => setShowMeetPopover(false)} />
        <div
          className="fixed z-[200] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          style={(() => {
            const rect = meetBadgeRef.current?.getBoundingClientRect();
            if (!rect) return { top: 0, left: 0, minWidth: 160 };
            const popoverH = 88;
            const spaceBelow = window.innerHeight - rect.bottom;
            const showAbove = spaceBelow < popoverH + 12;
            return {
              top: showAbove ? rect.top - popoverH - 6 : rect.bottom + 6,
              left: Math.min(rect.left, window.innerWidth - 170),
              minWidth: 160,
            };
          })()}
        >
          <a
            href={task.meeting_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => { e.stopPropagation(); setShowMeetPopover(false); }}
            className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-[#00BFA5]/8 transition-colors"
          >
            <span className="w-6 h-6 rounded-full bg-[#00BFA5] flex items-center justify-center shrink-0">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
            </span>
            <span className="text-[12px] font-semibold text-[#00897B]">Entrar</span>
          </a>
          <button
            onClick={e => {
              e.stopPropagation();
              setShowMeetPopover(false);
              const token = useAuthStore.getState().getGoogleToken();
              const eventId = task.meeting_event_id;
              if (token && eventId) {
                import("../../lib/googleCalendar").then(({ deleteMeetingEvent }) => {
                  deleteMeetingEvent(token, eventId).catch(() => {});
                });
              }
              useTaskStore.getState().updateTask(task.id, {
                meeting_url: null,
                meeting_event_id: null,
                meeting_attendees: null,
              });
            }}
            className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-[#FF3B30]/5 transition-colors w-full text-left border-t border-border/60"
          >
            <span className="w-6 h-6 rounded-full bg-[#FF3B30]/10 flex items-center justify-center shrink-0">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </span>
            <span className="text-[12px] font-medium text-[#FF3B30]">Cancelar reunião</span>
          </button>
        </div>
      </>,
      document.body
    )}
    </>
  );
}
