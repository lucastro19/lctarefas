import { useSettingsStore, DURATION_PRESETS } from "../../store/settingsStore";
import { useTagStore } from "../../store/tagStore";

const THEMES = [
  { value: "light", label: "☀️ Claro" },
  { value: "dark",  label: "🌙 Escuro" },
  { value: "system",label: "💻 Sistema" },
];

const ROUTE_OPTIONS = [
  { id: "inbox",    icon: "📥", label: "Inbox" },
  { id: "today",    icon: "☀️", label: "Hoje" },
  { id: "upcoming", icon: "⏰", label: "Em Breve" },
  { id: "someday",  icon: "🔮", label: "Depois" },
  { id: "logbook",  icon: "📋", label: "Histórico" },
  { id: "trash",    icon: "🗑️", label: "Lixeira" },
  { id: "archive",  icon: "📦", label: "Arquivo" },
];

export function SettingsModal({ onClose }) {
  const { dayStart, defaultDurationMinutes, theme, tabBarIds, setDayStart, setDefaultDuration, setTheme, setTabBarIds } = useSettingsStore();
  const { tags } = useTagStore();

  const toggle = (id) => {
    if (tabBarIds.includes(id)) {
      // manter pelo menos 1 item
      if (tabBarIds.length <= 1) return;
      setTabBarIds(tabBarIds.filter((i) => i !== id));
    } else {
      setTabBarIds([...tabBarIds, id]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative bg-card border border-border rounded-2xl shadow-xl w-80 p-6 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base text-text-main">Configurações</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-main text-lg leading-none">×</button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1.5">🎨 Aparência</label>
            <div className="grid grid-cols-3 gap-1.5">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  className={["text-xs py-1.5 rounded-lg border transition-colors", theme === t.value ? "border-primary bg-primary text-white font-medium" : "border-[#C7C7CC] text-text-secondary hover:border-primary/50"].join(" ")}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1.5">
              ☀️ Início do dia
            </label>
            <input
              type="time"
              value={dayStart}
              onChange={(e) => setDayStart(e.target.value)}
              className="w-full text-sm bg-bg border border-border rounded-lg px-3 py-2 outline-none focus:border-primary"
            />
            <p className="text-xs text-text-secondary mt-1">
              Primeira tarefa do dia começa neste horário.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1.5">
              ⏱ Duração padrão por tarefa
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setDefaultDuration(p.value)}
                  className={[
                    "text-xs py-1.5 rounded-lg border transition-colors",
                    defaultDurationMinutes === p.value
                      ? "border-primary bg-primary text-white font-medium"
                      : "border-border text-text-secondary hover:border-primary/50",
                  ].join(" ")}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-text-secondary mt-1.5">
              Usado quando a tarefa não tem duração definida.
            </p>
          </div>

          <div className="border-t border-border pt-4">
            <label className="text-xs font-medium text-text-secondary block mb-2">📱 Barra inferior (mobile)</label>
            <div className="space-y-1">
              {ROUTE_OPTIONS.map(({ id, icon, label }) => {
                const active = tabBarIds.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => toggle(id)}
                    className={[
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors text-xs",
                      active
                        ? "border-primary bg-primary/5 text-text-main"
                        : "border-border text-text-secondary hover:border-primary/40",
                    ].join(" ")}
                  >
                    <span className="text-base w-5 text-center">{icon}</span>
                    <span className="flex-1">{label}</span>
                    <span className={["w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors", active ? "border-primary bg-primary" : "border-[#C7C7CC]"].join(" ")}>
                      {active && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
                    </span>
                  </button>
                );
              })}

              {tags.length > 0 && (
                <>
                  <p className="text-[10px] text-text-secondary uppercase tracking-widest pt-1 px-1">Tags</p>
                  {tags.map((tag) => {
                    const id = `tag:${tag.id}`;
                    const active = tabBarIds.includes(id);
                    return (
                      <button
                        key={id}
                        onClick={() => toggle(id)}
                        className={[
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors text-xs",
                          active
                            ? "border-primary bg-primary/5 text-text-main"
                            : "border-border text-text-secondary hover:border-primary/40",
                        ].join(" ")}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                        <span className="flex-1">{tag.name}</span>
                        <span className={["w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors", active ? "border-primary bg-primary" : "border-[#C7C7CC]"].join(" ")}>
                          {active && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
                        </span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs text-text-secondary leading-relaxed">
              Ao reordenar tarefas em <strong className="text-text-secondary">Hoje</strong>, os horários são recalculados automaticamente somando as durações.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
