import { daysSince } from "../../store/taskStore";
import { canNudgeByWhatsApp } from "../../utils/nudge";

export const STATUS_META = {
  pendente:          { label: "Pendente",          icon: "⏳", color: "#8E8E93" },
  em_andamento:      { label: "Em andamento",      icon: "🔧", color: "#4F8EF7" },
  aguardando_aceite: { label: "Aguardando aceite", icon: "👀", color: "#FF9500" },
  bloqueada:         { label: "Bloqueada",         icon: "🚧", color: "#FF3B30" },
  concluida:         { label: "Concluída",         icon: "✅", color: "#34C759" },
};

export const STATUS_ORDER = ["pendente", "em_andamento", "aguardando_aceite", "bloqueada"];

// Datas sempre em formato LOCAL (BR = UTC-3), nunca UTC
const localDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localDateStr(d);
};

export const isFollowUpDue = (task) =>
  !!task.follow_up_date && task.follow_up_date <= localDateStr();

// Dias desde o último sinal de vida da tarefa (update de status ou a própria delegação)
export const agingDays = (task) => daysSince(task.last_update_at ?? task.delegated_at) ?? 0;

export function fmtShortDate(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T12:00:00");
  const today = localDateStr();
  if (iso === today) return "hoje";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (iso === localDateStr(tomorrow)) return "amanhã";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function CollaboratorAvatar({ collaborator, size = 28, className = "" }) {
  const color = collaborator?.color ?? "#8E8E93";
  const initials = (collaborator?.name ?? "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (collaborator?.avatar_url) {
    return (
      <img
        src={collaborator.avatar_url}
        alt={collaborator.name}
        title={collaborator.name}
        className={["rounded-full object-cover shrink-0", className].join(" ")}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      title={collaborator?.name}
      className={["rounded-full flex items-center justify-center font-bold shrink-0 select-none", className].join(" ")}
      style={{
        width: size,
        height: size,
        backgroundColor: color + "26",
        color,
        fontSize: Math.max(9, Math.round(size * 0.4)),
      }}
    >
      {initials}
    </span>
  );
}

export function StatusPill({ status, onClick }) {
  const meta = STATUS_META[status] ?? STATUS_META.pendente;
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(e); } : undefined}
      className={[
        "text-[10px] font-semibold leading-none px-1.5 py-1 rounded-full flex items-center gap-1 shrink-0",
        onClick ? "hover:opacity-75 transition-opacity" : "",
      ].join(" ")}
      style={{ color: meta.color, backgroundColor: meta.color + "22" }}
    >
      <span>{meta.icon}</span>
      {meta.label}
    </Tag>
  );
}

// "parada há N dias" — só aparece a partir de 3 dias, para não virar ruído
export function AgingLabel({ task, threshold = 3 }) {
  const days = agingDays(task);
  if (days < threshold) return null;
  const critical = days >= 7;
  return (
    <span
      className={[
        "text-[10px] font-medium tabular-nums shrink-0",
        critical ? "text-danger" : "text-warning",
      ].join(" ")}
      title={`Sem atualização há ${days} dias`}
    >
      ⏱ {days}d parada
    </span>
  );
}

export function FollowUpLabel({ task }) {
  if (!task.follow_up_date) return null;
  const due = isFollowUpDue(task);
  return (
    <span
      className={["text-[10px] font-medium shrink-0", due ? "text-danger font-semibold" : "text-text-secondary"].join(" ")}
      title="Data de cobrança"
    >
      🔔 {due ? "cobrar " : ""}{fmtShortDate(task.follow_up_date)}
    </span>
  );
}

export function NudgeCountLabel({ task }) {
  if (!task.nudge_count || task.nudge_count < 2) return null;
  return (
    <span className="text-[10px] text-text-secondary shrink-0" title="Vezes que você já cobrou">
      cobrada {task.nudge_count}×
    </span>
  );
}

export function WhatsAppButton({ collaborator, onClick, label = "Cobrar", className = "" }) {
  const enabled = canNudgeByWhatsApp(collaborator);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (enabled) onClick(e); }}
      disabled={!enabled}
      title={enabled ? `Cobrar ${collaborator.name} no WhatsApp` : "Colaborador sem WhatsApp cadastrado"}
      className={[
        "text-[11px] font-medium px-2 py-1 rounded-lg flex items-center gap-1 shrink-0 transition-colors",
        enabled
          ? "text-[#25D366] bg-[#25D366]/10 hover:bg-[#25D366]/20"
          : "text-text-secondary/40 bg-border/40 cursor-not-allowed",
        className,
      ].join(" ")}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.2-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5 0-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.6.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2m0 1.7a8.3 8.3 0 016.6 13.3 8.3 8.3 0 01-11 2.1l-.4-.2-3 .8.8-2.9-.2-.4A8.3 8.3 0 0112 3.7"/>
      </svg>
      {label}
    </button>
  );
}
