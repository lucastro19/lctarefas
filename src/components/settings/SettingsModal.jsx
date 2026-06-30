import { useState, useEffect } from "react";
import { useSettingsStore, DURATION_PRESETS } from "../../store/settingsStore";
import { useTagStore } from "../../store/tagStore";
import { useAuthStore } from "../../store/authStore";
import { isPushSupported, subscribeToPush, unsubscribeFromPush, getSubscriptionStatus } from "../../lib/pushNotifications";

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
  { id: "calendar", icon: "📅", label: "Calendário" },
  { id: "logbook",  icon: "📋", label: "Histórico" },
  { id: "trash",    icon: "🗑️", label: "Lixeira" },
  { id: "archive",  icon: "📦", label: "Arquivo" },
];

export function SettingsModal({ onClose }) {
  const { dayStart, defaultDurationMinutes, theme, tabBarIds, setDayStart, setDefaultDuration, setTheme, setTabBarIds } = useSettingsStore();
  const { tags } = useTagStore();
  const { session } = useAuthStore();

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState("");
  const pushSupported = isPushSupported();

  const [calUrl, setCalUrl] = useState("");
  const [calLoading, setCalLoading] = useState(false);
  const [calCopied, setCalCopied] = useState(false);

  useEffect(() => {
    getSubscriptionStatus().then(setPushEnabled);
  }, []);

  const loadCalUrl = async () => {
    if (calUrl) return;
    setCalLoading(true);
    try {
      const res = await fetch('/api/calendar/token', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      setCalUrl(data.url ?? "");
    } catch {
      setCalUrl("");
    } finally {
      setCalLoading(false);
    }
  };

  const copyCalUrl = () => {
    navigator.clipboard.writeText(calUrl);
    setCalCopied(true);
    setTimeout(() => setCalCopied(false), 2000);
  };

  const togglePush = async () => {
    setPushLoading(true);
    setPushError("");
    try {
      if (pushEnabled) {
        await unsubscribeFromPush(session?.access_token);
        setPushEnabled(false);
      } else {
        await subscribeToPush(session?.access_token);
        setPushEnabled(true);
      }
    } catch (err) {
      setPushError(err.message);
    } finally {
      setPushLoading(false);
    }
  };

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
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-card border border-border md:rounded-2xl rounded-t-2xl shadow-xl w-full md:w-80 z-10 flex flex-col"
        style={{
          maxHeight: "calc(100dvh - env(safe-area-inset-top) - 16px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header fixo */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0 border-b border-border">
          <h2 className="font-semibold text-base text-text-main">Configurações</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-main text-lg leading-none">×</button>
        </div>

        {/* Conteúdo rolável */}
        <div
          className="overflow-y-auto flex-1 px-6 py-5 space-y-5"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
        >
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

          {/* Notificações Push */}
          <div className="border-t border-border pt-4">
            <label className="text-xs font-medium text-text-secondary block mb-3">🔔 Notificações</label>
            {!pushSupported ? (
              <p className="text-xs text-text-secondary">
                Instale o app na tela inicial do iPhone para ativar notificações push (iOS 16.4+).
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-text-main font-medium">Notificações push</p>
                    <p className="text-[11px] text-text-secondary mt-0.5">
                      Avisa quando uma tarefa começa
                    </p>
                  </div>
                  <button
                    onClick={togglePush}
                    disabled={pushLoading}
                    className={["w-11 h-6 rounded-full transition-colors relative shrink-0", pushEnabled ? "bg-success" : "bg-[#C7C7CC]", pushLoading ? "opacity-60" : ""].join(" ")}
                  >
                    <span className={["absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform", pushEnabled ? "translate-x-5" : "translate-x-0.5"].join(" ")} />
                  </button>
                </div>
                {pushError && (
                  <p className="text-[11px] text-danger">{pushError}</p>
                )}
                {pushEnabled && (
                  <p className="text-[11px] text-success">✓ Notificações ativas neste dispositivo</p>
                )}
              </div>
            )}
          </div>

          {/* Calendário de urgentes */}
          <div className="border-t border-border pt-4">
            <label className="text-xs font-medium text-text-secondary block mb-1">📅 Calendário de urgentes</label>
            <p className="text-[11px] text-text-secondary mb-3 leading-relaxed">
              Assine no Calendário do iPhone para receber alarmes automáticos das tarefas urgentes — mesmo no silencioso, se ativar Alertas Críticos.
            </p>

            {!calUrl ? (
              <button
                onClick={loadCalUrl}
                disabled={calLoading}
                className="w-full text-xs py-2 rounded-lg border border-primary text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                {calLoading ? "Gerando URL…" : "Gerar URL do calendário"}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-bg border border-border rounded-lg px-3 py-2">
                  <span className="text-[10px] text-text-secondary flex-1 truncate font-mono">{calUrl}</span>
                  <button
                    onClick={copyCalUrl}
                    className={["text-xs font-medium shrink-0 transition-colors", calCopied ? "text-success" : "text-primary"].join(" ")}
                  >
                    {calCopied ? "Copiado!" : "Copiar"}
                  </button>
                </div>
                <p className="text-[10px] text-text-secondary leading-relaxed">
                  No iPhone: <strong>Ajustes → Calendário → Contas → Adicionar conta → Outro → Cal. subscrito</strong> → cole a URL acima.
                </p>
                <p className="text-[10px] text-text-secondary leading-relaxed">
                  Para tocar no silencioso: <strong>Ajustes → Notificações → Calendário → Alertas críticos → Ativar</strong>
                </p>
              </div>
            )}
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
