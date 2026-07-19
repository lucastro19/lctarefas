import { useState, useEffect } from "react";
import { useBookingStore, DAYS } from "../store/bookingStore";
import { useNavigate } from "react-router-dom";

const DURATION_OPTIONS = [15, 30, 45, 60, 90];
const BUFFER_OPTIONS = [0, 5, 10, 15, 30];

const DEFAULT_HOURS = {
  1: { start: "09:00", end: "17:00" },
  2: { start: "09:00", end: "17:00" },
  3: { start: "09:00", end: "17:00" },
  4: { start: "09:00", end: "17:00" },
  5: { start: "09:00", end: "17:00" },
};

export function BookingSettings() {
  const navigate = useNavigate();
  const { profile, availability, bookings, fetchProfile, fetchAvailability, fetchBookings, saveProfile, saveAvailability, cancelBooking } = useBookingStore();

  const [tab, setTab] = useState("profile");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form de perfil
  const [form, setForm] = useState({
    slug: "", display_name: "", title: "", bio: "",
    meeting_duration: 30, buffer_minutes: 15,
    advance_days: 30, min_notice_hours: 2,
  });

  // Disponibilidade: map de day_of_week → { active, start_time, end_time }
  const [avail, setAvail] = useState(() => {
    const m = {};
    for (let i = 0; i < 7; i++) m[i] = { active: DEFAULT_HOURS[i] !== undefined, ...( DEFAULT_HOURS[i] ?? { start: "09:00", end: "17:00" }) };
    return m;
  });

  useEffect(() => {
    fetchProfile();
    fetchAvailability();
    fetchBookings();
  }, []);

  useEffect(() => {
    if (profile) {
      setForm({
        slug: profile.slug ?? "",
        display_name: profile.display_name ?? "",
        title: profile.title ?? "",
        bio: profile.bio ?? "",
        meeting_duration: profile.meeting_duration ?? 30,
        buffer_minutes: profile.buffer_minutes ?? 15,
        advance_days: profile.advance_days ?? 30,
        min_notice_hours: profile.min_notice_hours ?? 2,
      });
    }
  }, [profile]);

  useEffect(() => {
    if (availability.length > 0) {
      const m = {};
      for (let i = 0; i < 7; i++) m[i] = { active: false, start: "09:00", end: "17:00" };
      availability.forEach((a) => {
        m[a.day_of_week] = { active: a.is_active, start: a.start_time.slice(0, 5), end: a.end_time.slice(0, 5) };
      });
      setAvail(m);
    }
  }, [availability]);

  const handleSaveProfile = async () => {
    setSaving(true);
    const { error } = await saveProfile(form);
    setSaving(false);
    if (error) { alert("Erro: " + error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveAvailability = async () => {
    setSaving(true);
    const rows = Object.entries(avail)
      .filter(([, v]) => v.active)
      .map(([day, v]) => ({
        day_of_week: Number(day),
        start_time: v.start,
        end_time: v.end,
        is_active: true,
      }));
    await saveAvailability(rows);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const bookingUrl = form.slug ? `${window.location.origin}/book/${form.slug}` : null;

  const upcomingBookings = bookings.filter(b => new Date(b.scheduled_at) > new Date());

  function formatDt(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }) +
      " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary hover:bg-card">
          <svg width="16" height="14" viewBox="0 0 16 14" fill="none"><path d="M6 1L1 7l5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M1.5 7H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
        <div>
          <h1 className="text-lg font-bold text-text-main">Página de Agendamento</h1>
          {bookingUrl && (
            <a href={bookingUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate block max-w-xs">
              {bookingUrl}
            </a>
          )}
        </div>
        {bookingUrl && (
          <button
            onClick={() => navigator.clipboard.writeText(bookingUrl)}
            className="ml-auto text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors shrink-0"
          >
            Copiar link
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-bg rounded-xl p-1">
        {[["profile","Perfil"],["availability","Disponibilidade"],["bookings","Agendamentos"]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={["flex-1 py-2 text-sm font-medium rounded-lg transition-all", tab === id ? "bg-card text-text-main shadow-sm" : "text-text-secondary hover:text-text-main"].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Perfil */}
      {tab === "profile" && (
        <div className="bg-card rounded-2xl p-5 space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">URL da sua página</label>
              <div className="flex items-center border border-border rounded-xl overflow-hidden focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                <span className="px-3 py-2.5 text-sm text-text-secondary bg-bg border-r border-border shrink-0">{window.location.origin}/book/</span>
                <input
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                  placeholder="seu-nome"
                  className="flex-1 px-3 py-2.5 text-sm text-text-main bg-transparent outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Nome de exibição</label>
              <input value={form.display_name} onChange={e => setForm(f => ({...f, display_name: e.target.value}))} placeholder="Lucas Lamounier" className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-text-main bg-transparent outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Título / cargo <span className="text-text-secondary/60 font-normal">(opcional)</span></label>
              <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="Consultor de TI · LC Tecnologia" className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-text-main bg-transparent outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Descrição <span className="text-text-secondary/60 font-normal">(opcional)</span></label>
              <textarea value={form.bio} onChange={e => setForm(f => ({...f, bio: e.target.value}))} rows={2} placeholder="Breve apresentação para seus clientes..." className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-text-main bg-transparent outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none" />
            </div>
          </div>

          <div className="border-t border-border pt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Duração da reunião</label>
              <select value={form.meeting_duration} onChange={e => setForm(f => ({...f, meeting_duration: Number(e.target.value)}))} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text-main bg-card outline-none focus:border-primary">
                {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Pausa entre reuniões</label>
              <select value={form.buffer_minutes} onChange={e => setForm(f => ({...f, buffer_minutes: Number(e.target.value)}))} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text-main bg-card outline-none focus:border-primary">
                {BUFFER_OPTIONS.map(d => <option key={d} value={d}>{d === 0 ? "Nenhuma" : `${d} min`}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Agendar com até (dias)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={form.advance_days}
                  onChange={e => setForm(f => ({ ...f, advance_days: Math.max(1, Math.min(365, Number(e.target.value) || 1)) }))}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text-main bg-transparent outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-xs text-text-secondary shrink-0">dias</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Aviso mínimo</label>
              <select value={form.min_notice_hours} onChange={e => setForm(f => ({...f, min_notice_hours: Number(e.target.value)}))} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text-main bg-card outline-none focus:border-primary">
                {[1,2,4,8,24,48].map(h => <option key={h} value={h}>{h < 24 ? `${h}h` : `${h/24} dia${h > 24 ? "s" : ""}`} de aviso</option>)}
              </select>
            </div>
          </div>

          <button onClick={handleSaveProfile} disabled={saving || !form.slug || !form.display_name} className="w-full bg-primary text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? "Salvando..." : saved ? "✓ Salvo!" : "Salvar perfil"}
          </button>
        </div>
      )}

      {/* Tab: Disponibilidade */}
      {tab === "availability" && (
        <div className="space-y-3">
          {/* Presets rápidos */}
          <div className="bg-card rounded-2xl p-4 space-y-3">
            <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-widest">Presets rápidos</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setAvail(a => {
                  const next = { ...a };
                  [1,2,3,4,5].forEach(d => { next[d] = { ...next[d], active: true }; });
                  [0,6].forEach(d => { next[d] = { ...next[d], active: false }; });
                  return next;
                })}
                className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 hover:border-primary/40 transition-all text-center"
              >
                <span className="text-xl">💼</span>
                <span className="text-[11px] font-semibold text-primary">Seg – Sex</span>
              </button>
              <button
                onClick={() => setAvail(a => {
                  const next = { ...a };
                  [0,1,2,3,4,5,6].forEach(d => { next[d] = { ...next[d], active: true }; });
                  return next;
                })}
                className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-[#34C759]/10 border border-[#34C759]/20 hover:bg-[#34C759]/20 hover:border-[#34C759]/40 transition-all text-center"
              >
                <span className="text-xl">📅</span>
                <span className="text-[11px] font-semibold text-[#34C759]">Todos os dias</span>
              </button>
              <button
                onClick={() => setAvail(a => {
                  const next = { ...a };
                  [0,1,2,3,4,5,6].forEach(d => { next[d] = { ...next[d], active: false }; });
                  return next;
                })}
                className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-danger/10 border border-danger/20 hover:bg-danger/20 hover:border-danger/40 transition-all text-center"
              >
                <span className="text-xl">🚫</span>
                <span className="text-[11px] font-semibold text-danger">Limpar tudo</span>
              </button>
            </div>
          </div>

          {/* Dias */}
          <div className="bg-card rounded-2xl overflow-hidden divide-y divide-border/40">
            {[1,2,3,4,5,0,6].map((day, idx) => {
              const isActive = avail[day]?.active;
              const start = avail[day]?.start ?? "09:00";
              const end = avail[day]?.end ?? "17:00";

              return (
                <div key={day}>
                  {/* Separador fim de semana */}
                  {idx === 5 && (
                    <div className="px-4 py-2 bg-border/20 flex items-center gap-2">
                      <div className="h-px flex-1 bg-border/60" />
                      <span className="text-[10px] font-bold text-text-secondary/70 uppercase tracking-widest">Fim de semana</span>
                      <div className="h-px flex-1 bg-border/60" />
                    </div>
                  )}
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    {/* Toggle */}
                    <button
                      onClick={() => setAvail(a => ({ ...a, [day]: { ...a[day], active: !a[day].active } }))}
                      className={[
                        "relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 focus:outline-none overflow-hidden",
                        isActive ? "bg-primary" : "bg-border/50 dark:bg-zinc-600",
                      ].join(" ")}
                    >
                      <span className={[
                        "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200",
                        isActive ? "left-5" : "left-0.5",
                      ].join(" ")} />
                    </button>

                    {/* Nome do dia */}
                    <span className={[
                      "text-sm w-7 shrink-0 font-semibold transition-colors",
                      isActive ? "text-text-main" : "text-text-secondary/40",
                    ].join(" ")}>
                      {DAYS[day]}
                    </span>

                    {/* Horários ou indisponível */}
                    {isActive ? (
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <input
                          type="time"
                          value={start}
                          onChange={e => setAvail(a => ({ ...a, [day]: { ...a[day], start: e.target.value } }))}
                          className="flex-1 min-w-0 border border-primary/30 rounded-lg px-2 py-1.5 text-sm font-medium text-text-main bg-primary/5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 tabular-nums"
                        />
                        <span className="text-text-secondary/40 text-xs shrink-0 font-medium">–</span>
                        <input
                          type="time"
                          value={end}
                          onChange={e => setAvail(a => ({ ...a, [day]: { ...a[day], end: e.target.value } }))}
                          className="flex-1 min-w-0 border border-primary/30 rounded-lg px-2 py-1.5 text-sm font-medium text-text-main bg-primary/5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 tabular-nums"
                        />
                        {/* Botão replicar este dia */}
                        <button
                          title="Replicar este horário para todos os dias ativos"
                          onClick={() => setAvail(a => {
                            const next = { ...a };
                            [0,1,2,3,4,5,6].forEach(d => {
                              if (d !== day && next[d]?.active) next[d] = { ...next[d], start, end };
                            });
                            return next;
                          })}
                          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-primary/60 hover:text-primary hover:bg-primary/10 transition-all"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                            <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <span className="flex-1 text-xs text-text-secondary/30 italic pl-0.5">Não disponível</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Replicar primeiro dia ativo para todos */}
          {(() => {
            const firstActive = [1,2,3,4,5,0,6].find(d => avail[d]?.active);
            if (firstActive === undefined) return null;
            const { start, end } = avail[firstActive];
            return (
              <button
                onClick={() => setAvail(a => {
                  const next = { ...a };
                  [0,1,2,3,4,5,6].forEach(d => {
                    if (next[d]?.active) next[d] = { ...next[d], start, end };
                  });
                  return next;
                })}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-primary/30 text-sm text-primary/70 bg-primary/5 hover:text-primary hover:border-primary/60 hover:bg-primary/10 transition-all font-medium"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                Replicar {DAYS[firstActive]} ({start}–{end}) para todos os dias ativos
              </button>
            );
          })()}

          <button onClick={handleSaveAvailability} disabled={saving} className="w-full bg-primary text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? "Salvando..." : saved ? "✓ Salvo!" : "Salvar disponibilidade"}
          </button>
        </div>
      )}

      {/* Tab: Agendamentos */}
      {tab === "bookings" && (
        <div className="space-y-3">
          {upcomingBookings.length === 0 ? (
            <div className="bg-card rounded-2xl p-8 text-center space-y-2">
              <p className="text-3xl">📅</p>
              <p className="text-sm font-medium text-text-main">Nenhum agendamento confirmado</p>
              <p className="text-xs text-text-secondary">Os agendamentos dos seus clientes aparecerão aqui.</p>
            </div>
          ) : (
            upcomingBookings.map((b) => (
              <div key={b.id} className="bg-card rounded-2xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-sm font-bold">
                  {b.guest_name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-main">{b.guest_name}</p>
                  <p className="text-xs text-text-secondary">{b.guest_email}</p>
                  <p className="text-xs text-primary mt-0.5">{formatDt(b.scheduled_at)} · {b.duration_minutes} min</p>
                  {b.guest_notes && <p className="text-xs text-text-secondary mt-1 truncate">{b.guest_notes}</p>}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {b.meeting_url && (
                    <a href={b.meeting_url} target="_blank" rel="noreferrer" className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-lg hover:bg-primary/20 transition-colors text-center">
                      Meet
                    </a>
                  )}
                  <button onClick={() => { if (confirm("Cancelar este agendamento?")) cancelBooking(b.id); }} className="text-xs text-danger px-2.5 py-1 rounded-lg hover:bg-danger/10 transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
