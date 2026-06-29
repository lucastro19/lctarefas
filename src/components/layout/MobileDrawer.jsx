import { useEffect } from "react";
import { useUiStore } from "../../store/uiStore";
import { Sidebar } from "./Sidebar";

export function MobileDrawer() {
  const { showDrawer, closeDrawer } = useUiStore();

  // Fecha ao pressionar Esc
  useEffect(() => {
    if (!showDrawer) return;
    const handler = (e) => { if (e.key === "Escape") closeDrawer(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showDrawer]);

  if (!showDrawer) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50 flex">
      {/* Overlay escuro */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={closeDrawer}
      />

      {/* Drawer */}
      <div className="relative w-72 h-full shadow-2xl animate-slide-in-left">
        <Sidebar className="flex w-72 bg-sidebar border-r border-border flex-col h-full" />
      </div>
    </div>
  );
}
