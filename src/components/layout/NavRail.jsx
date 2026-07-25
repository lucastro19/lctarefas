import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useUiStore } from "../../store/uiStore";
import { SettingsModal } from "../settings/SettingsModal";

const RAIL_ITEM = "w-[38px] h-[38px] rounded-lg flex items-center justify-center text-[16px] text-white/60 hover:text-white hover:bg-white/10 transition-colors mb-0.5 shrink-0";

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
