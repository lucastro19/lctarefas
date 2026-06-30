import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Checkbox } from "../ui/Checkbox";
import { useTaskStore } from "../../store/taskStore";
import { useTagStore } from "../../store/tagStore";
import { useSelectionStore } from "../../store/selectionStore";
import { useUiStore } from "../../store/uiStore";
import { durationLabel, DURATION_PRESETS } from "../../store/settingsStore";
import { useAuthStore } from "../../store/authStore";
import { sendUrgentPush } from "../../lib/pushNotifications";

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

const RECURRENCE_LABELS = {
  daily: "Diariamente",
  weekly: "Semanalmente",
  monthly: "Mensalmente",
  yearly: "Anualmente",
};

// Todos os slots de 30 em 30 min
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

/* ── Campo de data: texto digitável + ícone abre calendário nativo ── */
function DateField({ value, onChange }) {
  const hiddenRef = useRef(null);
  const [display, setDisplay] = useState(isoToDisplay(value));

  useEffect(() => { setDisplay(isoToDisplay(value)); }, [value]);

  const handleTextChange = (e) => {
    const v = e.target.value;
    setDisplay(v);
    const iso = displayToIso(v);
    if (iso) onChange(iso);
    else if (!v) onChange("");
  };

  const handleHiddenChange = (e) => {
    const iso = e.target.value;
    setDisplay(isoToDisplay(iso));
    onChange(iso || "");
  };

  return (
    <div className={["inline-flex items-center gap-1 rounded-full transition-colors", value ? "meta-chip-filled pl-2 pr-1 py-0.5" : ""].join(" ")}>
      <button
        tabIndex={-1}
        onClick={() => hiddenRef.current?.showPicker?.()}
        title="Abrir calendário"
        className="text-[12px] shrink-0 text-text-secondary hover:text-primary transition-colors leading-none"
      >
        📅
      </button>
      <input
        type="text"
        value={display}
        onChange={handleTextChange}
        placeholder="dd/mm/aaaa"
        maxLength={10}
        className="text-xs bg-transparent outline-none text-text-main w-[72px] placeholder:text-[#AEAEB2] dark:placeholder:text-[#636366]"
        style={{ colorScheme: "normal" }}
      />
      {value && (
        <button
          tabIndex={-1}
          onClick={() => { setDisplay(""); onChange(""); }}
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

/* ── Campo de hora: texto digitável + dropdown de slots ── */
function TimeField({ value, onChange }) {
  const [input, setInput] = useState(value || "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { setInput(value || ""); }, [value]);

  // Fecha ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Scroll para o horário atual quando abre
  useEffect(() => {
    if (!open || !listRef.current) return;
    const idx = TIME_SLOTS.findIndex((t) => t === value);
    if (idx > -1) {
      const item = listRef.current.children[idx];
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [open]);

  const handleChange = (e) => {
    let v = e.target.value.replace(/[^0-9:]/g, "");
    if (v.length === 2 && !v.includes(":") && input.length < 2) v = v + ":";
    setInput(v);
    if (/^\d{2}:\d{2}$/.test(v)) {
      const [h, m] = v.split(":").map(Number);
      if (h < 24 && m < 60) onChange(v);
    } else if (!v) {
      onChange("");
    }
  };

  const select = (t) => {
    setInput(t);
    onChange(t);
    setOpen(false);
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
        onChange={handleChange}
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
          onClick={() => { setInput(""); onChange(""); }}
          className="text-text-secondary hover:text-danger transition-colors text-[10px] leading-none px-0.5"
        >×</button>
      )}

      {open && (
        <div
          ref={listRef}
          className="absolute left-0 top-full mt-1 bg-card border border-border rounded-lg shadow-md z-50 py-1 max-h-44 overflow-y-auto min-w-[72px]"
        >
          {TIME_SLOTS.map((t) => (
            <button
              key={t}
              onMouseDown={(e) => { e.preventDefault(); select(t); }}
              className={["menu-item w-full text-left px-3 py-1 text-xs", t === value ? "!text-primary font-medium" : ""].join(" ")}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Botão de urgência com dropdown ── */
function UrgencyButton({ task, updateTask }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { session } = useAuthStore();

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const setUrgent = (val) => {
    updateTask(task.id, { is_urgent: val });
    if (val) sendUrgentPush(session?.access_token, task.title);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        title={task.is_urgent ? "Urgente — clique para alterar" : "Definir urgência"}
        className={[
          "text-[13px] transition-all leading-none",
          task.is_urgent
            ? "text-danger drop-shadow-[0_0_4px_rgba(255,59,48,0.5)]"
            : "text-text-secondary hover:text-danger",
        ].join(" ")}
      >
        🔔
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 bg-card border border-border rounded-lg shadow-md z-50 py-1 min-w-[170px]">
          <button
            onMouseDown={(e) => { e.preventDefault(); setUrgent(false); }}
            className="menu-item w-full text-left px-3 py-2 text-xs flex items-center gap-2"
          >
            <span className={["w-3 text-primary text-center", !task.is_urgent ? "opacity-100" : "opacity-0"].join(" ")}>✓</span>
            Nenhum
          </button>
          <div className="h-px bg-border mx-2 my-0.5" />
          <button
            onMouseDown={(e) => { e.preventDefault(); setUrgent(true); }}
            className="menu-item w-full text-left px-3 py-2 text-xs flex items-center gap-2"
          >
            <span className={["w-3 text-danger text-center", task.is_urgent ? "opacity-100" : "opacity-0"].join(" ")}>✓</span>
            <span className="text-danger font-medium">🔔 Marcar como Urgente</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Menu contextual ── */
function TaskMenu({ task, onClose }) {
  const { deleteTask, archiveTask, unarchiveTask, moveToToday, moveToSomeday, duplicateTask, updateTask } = useTaskStore();
  const ref = useRef(null);

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

  const tomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  };

  const run = (fn) => async (e) => { e?.stopPropagation(); await fn(); onClose(); };
  const isToday = task.scheduled_date === todayStr();
  const isSomeday = task.someday;
  const isArchived = !!task.archived_at;

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-50 py-1.5 min-w-[185px]"
    >
      {!isToday && (
        <button onClick={run(() => moveToToday(task.id))} className="menu-item w-full text-left px-3 py-2.5 text-sm transition-colors">
          ☀️ Mover para Hoje
        </button>
      )}
      <button onClick={run(() => updateTask(task.id, { scheduled_date: tomorrow(), someday: false }))} className="menu-item w-full text-left px-3 py-2.5 text-sm transition-colors">
        📅 Adiar para Amanhã
      </button>
      {!isSomeday && (
        <button onClick={run(() => moveToSomeday(task.id))} className="menu-item w-full text-left px-3 py-2.5 text-sm transition-colors">
          🔮 Mover para Depois
        </button>
      )}
      <div className="h-px bg-border mx-2 my-1" />
      <button onClick={run(() => duplicateTask(task.id))} className="menu-item w-full text-left px-3 py-2.5 text-sm transition-colors">
        📋 Duplicar tarefa
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
      <button onClick={run(() => deleteTask(task.id))} className="menu-item w-full text-left px-3 py-2.5 text-sm !text-danger transition-colors">
        🗑️ Mover para lixeira
      </button>
    </div>
  );
}

/* ── Componente principal ── */
export function TaskCard({ task, subtasks = [], onClick }) {
  const { completeTask, uncompleteTask, updateTask } = useTaskStore();
  const { tags, taskTags, fetchTaskTags, addTagToTask, removeTagFromTask } = useTagStore();
  const { toggle, isSelected, selectedIds } = useSelectionStore();
  const { expandedTaskId, setExpandedTaskId } = useUiStore();

  const [completing, setCompleting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [focusField, setFocusField] = useState("title");
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [notesDraft, setNotesDraft] = useState(task.notes ?? "");
  const [date, setDate] = useState(task.scheduled_date ?? "");
  const [time, setTime] = useState(task.scheduled_time ?? "");
  const [duration, setDuration] = useState(task.duration_minutes ?? "");
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [swipeX, setSwipeX] = useState(0);

  const titleInputRef = useRef(null);
  const notesRef = useRef(null);
  const tagPickerRef = useRef(null);
  const collapseRef = useRef(null);
  const pendingCursorRef = useRef(null);
  const longPressRef = useRef(null);
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
    }
  }, [task.title, task.notes, task.scheduled_date, task.scheduled_time, task.duration_minutes, expanded]);

  useEffect(() => { if (expanded) fetchTaskTags(task.id); }, [expanded, task.id]);

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

  // Ajusta altura do textarea quando muda conteúdo ou expande
  useEffect(() => {
    if (expanded && notesRef.current) resizeTextarea(notesRef.current);
  }, [notesDraft, expanded]);

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
    if (checked) await completeTask(task.id);
    else await uncompleteTask(task.id);
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
    task.deadline || task.duration_minutes || subtaskTotal > 0 || isUrgent;

  const handleTouchStart = (e) => {
    swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (anySelected) return;
    longPressRef.current = setTimeout(() => {
      toggle(task.id);
      navigator.vibrate?.(50);
    }, 700);
  };

  const handleTouchMove = (e) => {
    if (!swipeStartRef.current) return;
    const dx = e.touches[0].clientX - swipeStartRef.current.x;
    const dy = e.touches[0].clientY - swipeStartRef.current.y;
    // Cancel long press if moved
    clearTimeout(longPressRef.current);
    // Only handle horizontal swipe (ignore if mostly vertical)
    if (Math.abs(dy) > Math.abs(dx) * 1.5) return;
    if (expanded || anySelected) return;
    const clamped = Math.max(-100, Math.min(100, dx));
    setSwipeX(clamped);
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressRef.current);
    const THRESHOLD = 72;
    if (swipeX > THRESHOLD && !task.completed_at) {
      handleCheck(true);
    } else if (swipeX > THRESHOLD && task.completed_at) {
      handleCheck(false);
    } else if (swipeX < -THRESHOLD) {
      setShowMenu(true); // Abre menu de ações em vez de deletar direto
    }
    setSwipeX(0);
    swipeStartRef.current = null;
  };

  const swipeActive = Math.abs(swipeX) > 8;
  const swipeRight = swipeX > 0;

  return (
    <div ref={cardRef} className="relative overflow-hidden rounded-card">
      {/* Swipe reveal backgrounds */}
      {swipeActive && (
        <div className={[
          "absolute inset-0 flex items-center px-5 rounded-card transition-opacity",
          swipeRight ? "justify-start bg-success/15" : "justify-end bg-danger/15",
        ].join(" ")}>
          <span className="text-xl">{swipeRight ? (task.completed_at ? "↩️" : "✅") : "🗑️"}</span>
        </div>
      )}
    <div
      ref={setNodeRef}
      style={{
        transform: swipeX !== 0
          ? `translateX(${swipeX}px)`
          : CSS.Transform.toString(transform),
        transition: swipeX !== 0 ? "none" : transition,
      }}
      onDoubleClick={() => onClick?.()}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      className={[
        "task-card group relative",
        completing ? "opacity-50" : "",
        task.completed_at ? "opacity-40" : "",
        isDragging ? "opacity-30" : "",
        selected ? "ring-2 ring-primary/40 bg-primary/5" : "",
        expanded ? "ring-1 ring-primary/20" : "",
        isUrgent ? "is-urgent" : "",
      ].join(" ")}
    >
      <div className="task-card-row">
        {/* Arraste */}
        <div
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className={[
            "hidden md:block cursor-grab active:cursor-grabbing text-[#8E8E93] hover:text-[#3C3C43] dark:text-white/50 dark:hover:text-white/80 shrink-0 px-0.5 pt-0.5 transition-all select-none text-base",
            anySelected ? "opacity-0" : "opacity-100",
          ].join(" ")}
        >
          ⠿
        </div>

        {/* Checkbox circular */}
        <div className="pt-0.5 shrink-0" onDoubleClick={(e) => e.stopPropagation()}>
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
        <div className="flex-1 min-w-0 py-0.5" onDoubleClick={(e) => e.stopPropagation()}>
          {expanded ? (
            /* ── EXPANDIDO ── */
            <>
              <input
                ref={titleInputRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); notesRef.current?.focus(); } }}
                onClick={(e) => e.stopPropagation()}
                className="w-full text-sm text-text-main bg-transparent outline-none leading-snug"
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
                <div className="relative" ref={tagPickerRef}>
                  <button
                    onClick={() => setShowTagPicker((v) => !v)}
                    className="text-[11px] text-[#AEAEB2] dark:text-[#636366] hover:text-text-secondary transition-colors"
                  >
                    + Adicionar Etiqueta
                  </button>
                  {showTagPicker && available.length > 0 && (
                    <div className="absolute left-0 top-full mt-1 bg-card border border-border rounded-lg shadow-md z-50 py-1 min-w-[130px]">
                      {available.map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => { addTagToTask(task.id, tag.id); setShowTagPicker(false); }}
                          className="menu-item flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs"
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Linha de meta: data · hora · urgência · duração */}
              <div className="flex items-center gap-2 flex-wrap mt-1" onClick={(e) => e.stopPropagation()}>
                <DateField
                  value={date}
                  onChange={(v) => { setDate(v); updateTask(task.id, { scheduled_date: v || null }); }}
                />
                <TimeField
                  value={time}
                  onChange={(v) => { setTime(v); updateTask(task.id, { scheduled_time: v || null }); }}
                />
                <UrgencyButton task={task} updateTask={updateTask} />
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
                  <option value="monthly">Mensalmente</option>
                </select>
              </div>
            </>
          ) : (
            /* ── RECOLHIDO ── */
            <>
              <p
                onClick={(e) => {
                  e.stopPropagation();
                  if (anySelected) { toggle(task.id); return; }
                  if (!task.completed_at) {
                    if (window.innerWidth < 768) { onClick?.(); } else { expandTask("title"); }
                  }
                }}
                onDoubleClick={(e) => e.stopPropagation()}
                className={[
                  "text-sm leading-snug",
                  task.completed_at
                    ? "line-through text-text-secondary cursor-default"
                    : "text-text-main cursor-text",
                ].join(" ")}
              >
                {task.title}
              </p>

              {task.notes && (
                <p
                  onClick={(e) => {
                    e.stopPropagation();
                    if (anySelected) { toggle(task.id); return; }
                    if (window.innerWidth < 768) { onClick?.(); } else { expandTask("notes"); }
                  }}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className="text-xs text-text-secondary mt-0.5 leading-relaxed whitespace-pre-wrap break-words cursor-text"
                >
                  {task.notes}
                </p>
              )}

              {hasMetadata && (
                <div
                  className="flex items-center gap-2 mt-0.5 flex-wrap"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (anySelected) { toggle(task.id); return; }
                    if (window.innerWidth < 768) { onClick?.(); } else { expandTask("title"); }
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
                  {task.deadline && (
                    <span className={[
                      "text-xs flex items-center gap-0.5",
                      isOverdue(task.deadline) ? "text-danger font-medium" : "text-text-secondary",
                    ].join(" ")}>
                      <span>🚨</span>{formatDate(task.deadline)}
                    </span>
                  )}
                  {task.duration_minutes && (
                    <span className="text-xs text-text-secondary">{durationLabel(task.duration_minutes)}</span>
                  )}
                  {subtaskTotal > 0 && (
                    <span className="text-xs text-text-secondary">{subtaskDone}/{subtaskTotal}</span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Menu ··· */}
        <div className="relative shrink-0" onDoubleClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v); }}
            className="text-[#8E8E93] hover:text-[#1C1C1E] dark:text-white/50 dark:hover:text-white/90 w-8 h-8 flex items-center justify-center rounded-lg transition-all active:bg-bg"
          >
            ···
          </button>
          {showMenu && <TaskMenu task={task} onClose={() => setShowMenu(false)} />}
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
  );
}
