import { useLocation } from "react-router-dom";
import { useUiStore } from "../../store/uiStore";

const PAGE_TITLES = {
  "/inbox":    "Inbox",
  "/today":    "Hoje",
  "/upcoming": "Em Breve",
  "/someday":  "Depois",
  "/logbook":  "Histórico",
  "/trash":    "Lixeira",
  "/archive":  "Arquivo",
};

export function MobileHeader() {
  const { pathname } = useLocation();
  const { openDrawer } = useUiStore();

  const title = PAGE_TITLES[pathname] ?? "LCTarefas";

  return (
    <header
      className="md:hidden flex items-center gap-3 px-4 bg-card border-b border-border shrink-0"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)", paddingBottom: "10px" }}
    >
      <button
        onClick={openDrawer}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-main hover:bg-bg transition-colors text-xl"
        aria-label="Menu"
      >
        ☰
      </button>
      <div className="flex items-center gap-2">
        <img src="/lc-logo.png" alt="LC" className="w-6 h-6 object-contain" />
        <span className="font-semibold text-sm text-text-main">{title}</span>
      </div>
    </header>
  );
}
