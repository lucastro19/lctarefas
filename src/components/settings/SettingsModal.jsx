import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSettingsStore, DURATION_PRESETS } from "../../store/settingsStore";
import { useTagStore } from "../../store/tagStore";
import { useAuthStore } from "../../store/authStore";
import { useTaskStore } from "../../store/taskStore";
import { usePlanLimits } from "../../hooks/usePlanLimits";
import { isPushSupported, subscribeToPush, unsubscribeFromPush, getSubscriptionStatus } from "../../lib/pushNotifications";

const TAG_COLORS = ["#8E8E93", "#4F8EF7", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#FF2D55", "#5AC8FA"];

const THEMES = [
  { value: "light", label: "☀️ Claro" },
  { value: "dark",  label: "🌙 Escuro" },
  { value: "auto",  label: "💻 Auto" },
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

const PLAN_LABEL = { free: "Free", pro: "Pro", admin: "Admin" };
const PLAN_COLOR = {
  free:  "text-text-secondary bg-border/60",
  pro:   "text-primary bg-primary/10 border border-primary/20",
  admin: "text-danger bg-danger/10 border border-danger/20",
};

export function SettingsModal({ onClose }) {
  const navigate = useNavigate();
  const {
    dayStart, lunchStart, lunchEnd, dayEnd, defaultDurationMinutes, theme, tabBarIds,
    setDayStart, setLunchStart, setLunchEnd, setDayEnd, setDefaultDuration, setTheme, setTabBarIds,
  } = useSettingsStore();
  const { tasks } = useTaskStore();
  const { tags, createTag, updateTag, deleteTag, fetchTags } = useTagStore();
  const [editingTagId, setEditingTagId] = useState(null);
  const [editingTagName, setEditingTagName] = useState("");
  const [editingTagColor, setEditingTagColor] = useState("#8E8E93");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#4F8EF7");
  const [addingTag, setAddingTag] = useState(false);

  useEffect(() => { fetchTags(); }, []);
  const { session, profile, signOut } = useAuthStore();
  const { plan, isPro, isAdmin, limits, usage, taskUsagePct } = usePlanLimits();

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

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lctarefas-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const cols = ["id", "title", "notes", "scheduled_date", "scheduled_time", "priority", "completed_at", "deleted_at", "someday"];
    const rows = tasks.map((t) => cols.map((c) => JSON.stringify(t[c] ?? "")).join(","));
    const csv = [cols.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lctarefas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
          {/* ── Minha Conta ── */}
          <div className="rounded-xl border border-border overflow-hidden">
            {/* Perfil */}
            <div className="flex items-center gap-3 px-4 py-3 bg-card">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="w-10 h-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                  {(profile?.full_name ?? "?").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-main truncate">{profile?.full_name ?? "Usuário"}</p>
                <p className="text-xs text-text-secondary truncate">{profile?.email ?? ""}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${PLAN_COLOR[plan]}`}>
                {PLAN_LABEL[plan]}
              </span>
            </div>

            {/* Uso do plano free */}
            {!isPro && (
              <div className="px-4 py-3 bg-bg border-t border-border space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-text-secondary">Tarefas ativas</span>
                  <span className="text-xs font-medium text-text-main">{usage.tasks} / {limits.tasks}</span>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${taskUsagePct >= 90 ? "bg-danger" : taskUsagePct >= 70 ? "bg-warning" : "bg-primary"}`}
                    style={{ width: `${taskUsagePct}%` }}
                  />
                </div>
                {taskUsagePct >= 80 && (
                  <p className="text-[10px] text-warning">
                    {taskUsagePct >= 100 ? "Limite atingido — faça upgrade para continuar." : `${100 - taskUsagePct}% do limite. Considere fazer upgrade.`}
                  </p>
                )}
              </div>
            )}

            {/* Ações */}
            <div className="divide-y divide-border border-t border-border">
              {isAdmin && (
                <button
                  onClick={() => { onClose(); navigate("/admin"); }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-danger hover:bg-danger/5 transition-colors"
                >
                  <span>Painel administrativo</span>
                  <span className="text-text-secondary text-xs">→</span>
                </button>
              )}
              <button
                onClick={() => { signOut(); onClose(); }}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-text-secondary hover:text-text-main hover:bg-bg transition-colors"
              >
                <span>Sair da conta</span>
                <span className="text-xs">→</span>
              </button>
            </div>
          </div>

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

          {/* Horários do dia */}
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-3">
              🕐 Horários do dia
            </label>
            <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
              {[
                { label: "🌅 Início da manhã", value: dayStart, setter: setDayStart, hint: "Primeira tarefa do período da manhã" },
                { label: "🍽️ Início do almoço", value: lunchStart, setter: setLunchStart, hint: "Limite do período da manhã" },
                { label: "☀️ Fim do almoço", value: lunchEnd, setter: setLunchEnd, hint: "Início do período da tarde" },
                { label: "🌆 Fim da tarde", value: dayEnd, setter: setDayEnd, hint: "Início do período da noite" },
              ].map(({ label, value, setter, hint }) => (
                <div key={label} className="flex items-center gap-3 px-3 py-2.5 bg-card">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-main">{label}</p>
                    <p className="text-xs text-text-secondary">{hint}</p>
                  </div>
                  <input
                    type="time"
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    className="text-sm bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary w-28 text-center"
                  />
                </div>
              ))}
            </div>
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
              Assine no Calendário do iPhone para receber alarmes automáticos das tarefas urgentes, mesmo no silencioso (com Alertas Críticos).
            </p>

            {!calUrl ? (
              <button
                onClick={loadCalUrl}
                disabled={calLoading}
                className="w-full text-xs py-2 rounded-lg border border-primary text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                {calLoading ? "Gerando…" : "Gerar link de assinatura"}
              </button>
            ) : (
              <div className="space-y-2.5">
                <button
                  onClick={copyCalUrl}
                  className={["w-full flex items-center justify-center gap-2 text-xs py-2.5 rounded-lg font-medium transition-colors", calCopied ? "bg-success text-white" : "bg-primary text-white hover:bg-primary/90"].join(" ")}
                >
                  {calCopied ? "✓ URL copiada!" : "📋 Copiar link de assinatura"}
                </button>

                <div className="bg-bg rounded-lg border border-border px-3 py-2">
                  <p className="text-[10px] text-text-secondary font-mono break-all leading-relaxed select-all">
                    {calUrl}
                  </p>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700 px-3 py-2.5 space-y-1.5">
                  <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300">Como assinar no iPhone:</p>
                  <ol className="text-[10px] text-amber-700 dark:text-amber-400 space-y-1 list-none">
                    <li>1. Toque em <strong>Copiar link</strong> acima</li>
                    <li>2. Abra <strong>Ajustes → Calendário → Contas</strong></li>
                    <li>3. <strong>Adicionar conta → Outro → Calendário Assinado</strong></li>
                    <li>4. Cole a URL e toque em <strong>Avançar</strong></li>
                  </ol>
                </div>

                <div className="rounded-lg border border-border px-3 py-2 space-y-1">
                  <p className="text-[10px] font-medium text-text-secondary">Para alarmes no silencioso:</p>
                  <p className="text-[10px] text-text-secondary leading-relaxed">
                    <strong>Ajustes → Notificações → Calendário → Alertas Críticos → Ativar</strong>
                  </p>
                </div>

                <button
                  onClick={loadCalUrl}
                  disabled={calLoading}
                  className="w-full text-[10px] py-1.5 rounded-lg border border-border text-text-secondary hover:border-primary/50 transition-colors disabled:opacity-50"
                >
                  {calLoading ? "Atualizando…" : "↻ Regenerar link"}
                </button>
              </div>
            )}
          </div>

          {/* Gerenciar Tags */}
          <div className="border-t border-border pt-4">
            <label className="text-xs font-medium text-text-secondary block mb-2">🏷️ Etiquetas</label>
            <div className="space-y-1.5">
              {tags.map((tag) => (
                <div key={tag.id} className="flex items-center gap-2">
                  {editingTagId === tag.id ? (
                    <>
                      <div className="flex gap-1 flex-wrap">
                        {TAG_COLORS.map((c) => (
                          <button key={c} onClick={() => setEditingTagColor(c)}
                            className={["w-4 h-4 rounded-full border-2 transition-transform", editingTagColor === c ? "border-white scale-125" : "border-transparent"].join(" ")}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <input
                        autoFocus
                        value={editingTagName}
                        onChange={(e) => setEditingTagName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { updateTag(tag.id, { name: editingTagName.trim(), color: editingTagColor }); setEditingTagId(null); }
                          if (e.key === "Escape") setEditingTagId(null);
                        }}
                        className="flex-1 text-xs bg-bg border border-primary rounded px-2 py-1 outline-none text-text-main"
                      />
                      <button onClick={() => { updateTag(tag.id, { name: editingTagName.trim(), color: editingTagColor }); setEditingTagId(null); }}
                        className="text-[10px] text-primary font-medium px-1">✓</button>
                      <button onClick={() => setEditingTagId(null)} className="text-[10px] text-text-secondary px-1">✕</button>
                    </>
                  ) : (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                      <span className="flex-1 text-xs text-text-main">{tag.name}</span>
                      <button onClick={() => { setEditingTagId(tag.id); setEditingTagName(tag.name); setEditingTagColor(tag.color); }}
                        className="text-[10px] text-text-secondary hover:text-primary transition-colors px-1">✎</button>
                      <button onClick={() => { if (confirm(`Excluir etiqueta "${tag.name}"?`)) deleteTag(tag.id); }}
                        className="text-[10px] text-text-secondary hover:text-danger transition-colors px-1">🗑</button>
                    </>
                  )}
                </div>
              ))}

              {addingTag ? (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-1 flex-wrap">
                    {TAG_COLORS.map((c) => (
                      <button key={c} onClick={() => setNewTagColor(c)}
                        className={["w-4 h-4 rounded-full border-2 transition-transform", newTagColor === c ? "border-white scale-125" : "border-transparent"].join(" ")}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && newTagName.trim()) { await createTag(newTagName.trim(), newTagColor); setNewTagName(""); setNewTagColor("#4F8EF7"); setAddingTag(false); }
                        if (e.key === "Escape") setAddingTag(false);
                      }}
                      placeholder="Nome da etiqueta"
                      className="flex-1 text-xs bg-bg border border-border rounded px-2 py-1 outline-none focus:border-primary text-text-main"
                    />
                    <button
                      onClick={async () => { if (newTagName.trim()) { await createTag(newTagName.trim(), newTagColor); setNewTagName(""); setNewTagColor("#4F8EF7"); setAddingTag(false); } }}
                      className="text-xs text-white bg-primary px-2 py-1 rounded"
                    >Criar</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingTag(true)}
                  className="w-full text-xs py-1.5 rounded-lg border border-dashed border-border text-text-secondary hover:border-primary/50 hover:text-primary transition-colors">
                  + Nova etiqueta
                </button>
              )}
            </div>
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

          {/* Exportar dados */}
          <div className="border-t border-border pt-4">
            <label className="text-xs font-medium text-text-secondary block mb-2">📤 Exportar dados</label>
            <p className="text-[11px] text-text-secondary mb-3 leading-relaxed">
              Faça backup de todas as suas tarefas ({tasks.length} no total).
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={exportJSON}
                className="text-xs py-2 rounded-lg border border-primary text-primary hover:bg-primary/5 transition-colors font-medium"
              >
                ⬇ JSON
              </button>
              <button
                onClick={exportCSV}
                className="text-xs py-2 rounded-lg border border-primary text-primary hover:bg-primary/5 transition-colors font-medium"
              >
                ⬇ CSV
              </button>
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
