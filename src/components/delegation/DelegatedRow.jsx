import { useState, useRef, useEffect } from "react";
import { useTaskStore } from "../../store/taskStore";
import { useCollaboratorStore } from "../../store/collaboratorStore";
import { useUiStore } from "../../store/uiStore";
import { openWhatsApp, nudgeMessage } from "../../utils/nudge";
import {
  CollaboratorAvatar, StatusPill, AgingLabel, FollowUpLabel, NudgeCountLabel,
  WhatsAppButton, STATUS_ORDER, STATUS_META, fmtShortDate, inDays,
} from "./shared";

const SNOOZE_OPTIONS = [
  { label: "Amanhã", days: 1 },
  { label: "Em 2 dias", days: 2 },
  { label: "Em 1 semana", days: 7 },
  { label: "Em 15 dias", days: 15 },
];

function Popover({ children, onClose, align = "right" }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      className={[
        "absolute top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-50 py-1 min-w-[170px]",
        align === "right" ? "right-0" : "left-0",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function DelegatedRow({ task, showAvatar = true, onOpen }) {
  const { setDelegationStatus, acceptDelegatedTask, registerNudge, snoozeFollowUp } = useTaskStore();
  const { getById } = useCollaboratorStore();
  const { showToast } = useUiStore();
  const [menu, setMenu] = useState(null); // "status" | "snooze"

  const collaborator = getById(task.delegated_to);
  const status = task.delegation_status ?? "pendente";

  const handleNudge = () => {
    const ok = openWhatsApp(collaborator, nudgeMessage(collaborator, task));
    if (!ok) return;
    // Cobrou hoje: registra e reagenda a próxima cobrança para daqui a 2 dias
    registerNudge(task.id, inDays(2));
    showToast({ message: `Cobrança registrada — próxima em ${fmtShortDate(inDays(2))}` });
  };

  return (
    <div
      // stopPropagation: as páginas fecham o TaskDetail ao clicar no fundo
      onClick={(e) => { e.stopPropagation(); onOpen?.(task); }}
      className="group relative flex items-center gap-2 px-3 py-2.5 rounded-card bg-card border border-border hover:border-primary/40 transition-colors cursor-pointer min-w-0"
    >
      {showAvatar && collaborator && (
        <CollaboratorAvatar collaborator={collaborator} size={28} />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-[14px] text-text-main truncate leading-tight">{task.title}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <StatusPill status={status} onClick={() => setMenu(menu === "status" ? null : "status")} />
          <AgingLabel task={task} />
          <FollowUpLabel task={task} />
          <NudgeCountLabel task={task} />
          {task.deadline && (
            <span className="text-[10px] text-text-secondary shrink-0" title="Prazo combinado">
              🚨 {fmtShortDate(task.deadline)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        <WhatsAppButton collaborator={collaborator} onClick={handleNudge} />

        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setMenu(menu === "snooze" ? null : "snooze"); }}
            title="Adiar cobrança"
            className="text-[11px] px-2 py-1 rounded-lg text-text-secondary hover:text-text-main hover:bg-bg transition-colors"
          >
            Adiar
          </button>
          {menu === "snooze" && (
            <Popover onClose={() => setMenu(null)}>
              {SNOOZE_OPTIONS.map((o) => (
                <button
                  key={o.days}
                  onClick={() => { snoozeFollowUp(task.id, o.days); setMenu(null); }}
                  className="menu-item w-full text-left px-3 py-2 text-sm transition-colors"
                >
                  {o.label}
                </button>
              ))}
            </Popover>
          )}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); acceptDelegatedTask(task.id); }}
          title="Aceitar e concluir"
          className="text-[11px] font-medium px-2 py-1 rounded-lg text-success bg-success/10 hover:bg-success/20 transition-colors"
        >
          Aceitar
        </button>
      </div>

      {menu === "status" && (
        <Popover onClose={() => setMenu(null)} align="left">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => { setDelegationStatus(task.id, s); setMenu(null); }}
              className={[
                "menu-item w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2",
                s === status ? "font-semibold" : "",
              ].join(" ")}
            >
              <span>{STATUS_META[s].icon}</span>
              <span>{STATUS_META[s].label}</span>
              {s === status && <span className="ml-auto text-primary">✓</span>}
            </button>
          ))}
        </Popover>
      )}
    </div>
  );
}
