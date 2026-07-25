import { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useUiStore } from "../../store/uiStore";
import { useNotificationStore } from "../../store/notificationStore";
import { SettingsModal } from "../settings/SettingsModal";

const RAIL_ITEM = "w-[38px] h-[38px] rounded-lg flex items-center justify-center text-[16px] text-white/60 hover:text-white hover:bg-white/10 transition-colors mb-0.5 shrink-0";

// Central de notificações (Fase 4.11) — populada por ações que já existem (aceite de
// delegação, resolução de prorrogação de prazo), ver notify() em notificationStore.js.
function NotificationBell() {
  const { notifications, fetchNotifications, markAsRead, markAllRead } = useNotificationStore();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const unread = notifications.filter((n) => !n.read_at).length;

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} title="Notificações" className={[RAIL_ITEM, "relative"].join(" ")}>
        🔔
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-danger text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-full bottom-0 ml-2 w-72 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-[12.5px] font-semibold text-text-main">Notificações</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-[11px] text-primary hover:underline">Marcar tudo como lido</button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-[12px] text-text-secondary text-center py-6">Nenhuma notificação ainda.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className="w-full text-left flex items-start gap-2 px-3 py-2.5 hover:bg-bg transition-colors border-b border-border/50 last:border-0"
                >
                  {!n.read_at && <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
                  <div className={n.read_at ? "opacity-60" : ""}>
                    <p className="text-[12.5px] text-text-main leading-snug">{n.title}</p>
                    <p className="text-[10.5px] text-text-secondary mt-0.5">
                      {new Date(n.created_at).toLocaleDateString("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Trilho de módulos (Fase 4.2) — hoje só "Tarefas" existe de verdade; os 2 slots fantasma
// marcam onde CRM/Projetos entrariam depois, sem construir nada especulativo agora. Calendário/
// Agendamento/Configurações/Sair vivem aqui (fora do módulo Tarefas), decisão já travada no
// blueprint — mas continuam TAMBÉM na lista de views do painel (ver Sidebar.jsx), porque no
// mobile não existe trilho e o painel/drawer precisa continuar dando acesso a eles sozinho.
export function NavRail() {
  const { user, signOut } = useAuthStore();
  const { focusMode, toggleFocusMode } = useUiStore();
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <aside className="hidden md:flex w-16 bg-[#111112] flex-col items-center py-3.5 shrink-0 h-full">
      <div className="w-[30px] h-[30px] rounded-lg bg-primary text-white text-[11px] font-extrabold flex items-center justify-center mb-4 shrink-0">
        LC
      </div>

      <button
        onClick={() => navigate("/today")}
        title="Tarefas"
        className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-[19px] mb-1.5 bg-primary/25 text-white shrink-0"
      >
        ☀️
      </button>
      <div title="CRM (em breve)" className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-[16px] opacity-30 mb-1.5 shrink-0 text-white">
        🧩
      </div>
      <div title="Projetos (em breve)" className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-[16px] opacity-30 mb-1.5 shrink-0 text-white">
        📁
      </div>

      <div className="flex-1" />

      <NotificationBell />
      <button onClick={toggleFocusMode} title={focusMode ? "Mostrar painel" : "Ocultar painel"} className={RAIL_ITEM}>
        <svg width="16" height="13" viewBox="0 0 18 14" fill="none">
          <rect x="0.6" y="0.6" width="16.8" height="12.8" rx="2.4" stroke="currentColor" strokeWidth="1.2" />
          <line x1="6" y1="0.6" x2="6" y2="13.4" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      <NavLink to="/calendar" title="Calendário" className={RAIL_ITEM}>📅</NavLink>
      <NavLink to="/booking-settings" title="Agendamento" className={RAIL_ITEM}>🗓️</NavLink>
      <button onClick={() => setShowSettings(true)} title="Configurações" className={RAIL_ITEM}>⚙️</button>
      <button onClick={signOut} title="Sair" className={[RAIL_ITEM, "mb-2"].join(" ")}>🚪</button>

      {user?.user_metadata?.avatar_url ? (
        <img src={user.user_metadata.avatar_url} className="w-8 h-8 rounded-full ring-2 ring-white/15 shrink-0" alt="" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-primary/30 text-white text-xs font-bold flex items-center justify-center shrink-0">
          {(user?.user_metadata?.full_name ?? user?.email ?? "?")[0].toUpperCase()}
        </div>
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </aside>
  );
}
