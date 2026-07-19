import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useBookingStore, computeSlots } from "../store/bookingStore";

function pad(n) { return String(n).padStart(2, "0"); }
function formatTime(date) { return `${pad(date.getHours())}:${pad(date.getMinutes())}`; }
function formatDate(date) {
  return date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}
function isoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function generateICS({ title, start, durationMinutes, meetingUrl }) {
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
    `SUMMARY:${title}`,
    meetingUrl ? `DESCRIPTION:Link da reunião: ${meetingUrl}` : "",
    meetingUrl ? `URL:${meetingUrl}` : "",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAYS_SHORT = ["D","S","T","Q","Q","S","S"];
const PROGRESS = [
  { id: "calendar", label: "Data & Horário" },
  { id: "form",     label: "Seus dados" },
];

export function BookPage() {
  const { slug } = useParams();
  const { fetchPublicProfile, fetchPublicSlots } = useBookingStore();

  const [profile, setProfile]         = useState(null);
  const [availability, setAvailability] = useState([]);
  const [bookings, setBookings]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [notFound, setNotFound]         = useState(false);

  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [step, setStep] = useState("calendar");

  const [form, setForm]       = useState({ name: "", email: "", notes: "" });
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking]       = useState(null);

  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ");

  useEffect(() => {
    (async () => {
      const { data, error } = await fetchPublicProfile(slug);
      if (error || !data) { setNotFound(true); setLoading(false); return; }
      setProfile(data);
      const from = new Date();
      const to   = new Date(); to.setDate(to.getDate() + (data.advance_days ?? 30));
      const { availability: av, bookings: bk } = await fetchPublicSlots(data.user_id, from.toISOString(), to.toISOString());
      setAvailability(av);
      setBookings(bk);
      setLoading(false);
    })();
  }, [slug]);

  const slots = useMemo(() => {
    if (!selectedDate || !profile) return [];
    return computeSlots({
      availability, bookings, date: selectedDate,
      duration: profile.meeting_duration,
      bufferMinutes: profile.buffer_minutes,
      minNoticeHours: profile.min_notice_hours,
    });
  }, [selectedDate, availability, bookings, profile]);

  const availableDays = useMemo(() => {
    if (!profile) return new Set();
    const set   = new Set();
    const today = new Date(); today.setHours(0,0,0,0);
    const limit = new Date(); limit.setDate(limit.getDate() + (profile.advance_days ?? 30));
    const d = new Date(calMonth.year, calMonth.month, 1);
    while (d.getMonth() === calMonth.month) {
      const copy = new Date(d);
      if (copy >= today && copy <= limit) {
        const s = computeSlots({
          availability, bookings, date: copy,
          duration: profile.meeting_duration,
          bufferMinutes: profile.buffer_minutes,
          minNoticeHours: profile.min_notice_hours,
        });
        if (s.length > 0) set.add(isoDate(copy));
      }
      d.setDate(d.getDate() + 1);
    }
    return set;
  }, [calMonth, availability, bookings, profile]);

  const isFormValid = form.name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot || !profile || !isFormValid) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/booking/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: profile.user_id,
          guest_name: form.name,
          guest_email: form.email,
          guest_notes: form.notes,
          scheduled_at: selectedSlot.toISOString(),
          duration_minutes: profile.meeting_duration,
          host_name: profile.display_name,
          host_email: null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao agendar");
      setBooking(data.booking);
      setStep("success");
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const downloadICS = () => {
    const ics = generateICS({
      title: `Reunião com ${profile.display_name}`,
      start: selectedSlot,
      durationMinutes: profile.meeting_duration,
      meetingUrl: booking?.meeting_url,
    });
    const blob = new Blob([ics], { type: "text/calendar" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "reuniao.ics"; a.click();
    URL.revokeObjectURL(url);
  };

  const resetFlow = () => {
    setStep("calendar"); setSelectedDate(null); setSelectedSlot(null);
    setForm({ name: "", email: "", notes: "" }); setTouched({}); setBooking(null);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[#4F8EF7] border-t-transparent animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center px-4">
      <div className="text-center space-y-3">
        <p className="text-5xl">🔍</p>
        <h1 className="text-xl font-semibold text-[#1C1C1E]">Página não encontrada</h1>
        <p className="text-sm text-[#8E8E93]">O link <strong>/{slug}</strong> não existe.</p>
      </div>
    </div>
  );

  const firstDay   = new Date(calMonth.year, calMonth.month, 1).getDay();
  const daysInMonth = new Date(calMonth.year, calMonth.month + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);
  const limit = new Date(); limit.setDate(limit.getDate() + (profile.advance_days ?? 30));
  const stepIndex = ["calendar", "form", "success"].indexOf(step);

  return (
    <div className="min-h-screen bg-[#F2F2F7]">

      {/* ── Cabeçalho do perfil ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E5E5EA]">
        <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#4F8EF7] to-[#3A6FD8] text-white text-2xl font-bold flex items-center justify-center shadow-md">
            {profile.display_name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="text-center space-y-0.5">
            <h1 className="text-lg font-bold text-[#1C1C1E]">{profile.display_name}</h1>
            {profile.title && <p className="text-sm text-[#8E8E93]">{profile.title}</p>}
            {profile.bio   && <p className="text-sm text-[#3C3C43] max-w-sm mx-auto pt-1">{profile.bio}</p>}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Chip icon={<ClockIcon color="#4F8EF7" />}>{profile.meeting_duration} min</Chip>
            <Chip icon={<MeetIcon />}>Google Meet</Chip>
            <Chip icon={<GlobeIcon />}>{userTz}</Chip>
          </div>
        </div>
      </div>

      {/* ── Indicador de progresso ──────────────────────────────────────── */}
      {step !== "success" && (
        <div className="max-w-3xl mx-auto px-4 pt-5 pb-1 flex items-center justify-center gap-3">
          {PROGRESS.map((s, i) => {
            const isCurrent = s.id === step;
            const isDone    = stepIndex > i;
            return (
              <div key={s.id} className="flex items-center gap-3">
                {i > 0 && (
                  <div className={["h-px w-10 transition-colors", isDone ? "bg-[#4F8EF7]" : "bg-[#E5E5EA]"].join(" ")} />
                )}
                <div className="flex items-center gap-1.5">
                  <div className={[
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
                    isCurrent ? "bg-[#4F8EF7] text-white" :
                    isDone    ? "bg-[#34C759] text-white" :
                                "bg-[#E5E5EA] text-[#8E8E93]",
                  ].join(" ")}>
                    {isDone ? "✓" : i + 1}
                  </div>
                  <span className={[
                    "text-xs font-semibold transition-colors",
                    isCurrent ? "text-[#4F8EF7]" :
                    isDone    ? "text-[#34C759]" : "text-[#C7C7CC]",
                  ].join(" ")}>
                    {s.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Conteúdo principal ──────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 py-5 pb-12">

        {/* ─ Sucesso ─ */}
        {step === "success" && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-br from-[#34C759]/10 to-[#30D158]/5 p-8 flex flex-col items-center gap-3 text-center">
              <div className="w-16 h-16 rounded-full bg-[#34C759] flex items-center justify-center shadow-md">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#1C1C1E]">Reunião confirmada!</h2>
                <p className="text-sm text-[#8E8E93] mt-0.5">Convite enviado para {form.email}</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-[#F2F2F7] rounded-xl p-4 space-y-3">
                <DetailRow icon={<CalIcon color="#4F8EF7" />}>
                  <p className="text-sm font-semibold text-[#1C1C1E] capitalize">{formatDate(selectedSlot)}</p>
                  <p className="text-xs text-[#8E8E93]">{formatTime(selectedSlot)} · {profile.meeting_duration} minutos</p>
                </DetailRow>
                <DetailRow icon={<PersonIcon />}>
                  <p className="text-sm font-semibold text-[#1C1C1E]">{form.name}</p>
                  <p className="text-xs text-[#8E8E93]">{form.email}</p>
                </DetailRow>
              </div>

              <div className="flex flex-col gap-2">
                {booking?.meeting_url && (
                  <a
                    href={booking.meeting_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 bg-[#4F8EF7] text-white text-sm font-semibold py-3 rounded-xl hover:bg-[#4484E8] transition-colors shadow-sm"
                  >
                    <MeetIcon white /> Entrar na reunião
                  </a>
                )}
                <button
                  onClick={downloadICS}
                  className="flex items-center justify-center gap-2 bg-white border border-[#E5E5EA] text-[#1C1C1E] text-sm font-medium py-3 rounded-xl hover:bg-[#F2F2F7] transition-colors"
                >
                  <DownloadIcon /> Adicionar ao calendário (.ics)
                </button>
                <button
                  onClick={resetFlow}
                  className="text-sm text-[#8E8E93] py-2 hover:text-[#4F8EF7] transition-colors"
                >
                  Agendar outra reunião
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─ Formulário ─ */}
        {step === "form" && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E5EA] flex items-center gap-3">
              <button
                onClick={() => setStep("calendar")}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8E8E93] hover:bg-[#F2F2F7] transition-colors shrink-0"
              >
                <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
                  <path d="M6 1L1 7l5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M1.5 7H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1C1C1E] capitalize truncate">{formatDate(selectedSlot)}</p>
                <p className="text-xs text-[#8E8E93]">{formatTime(selectedSlot)} · {profile.meeting_duration} min · Google Meet</p>
              </div>
              <span className="bg-[#4F8EF7]/10 text-[#4F8EF7] text-xs font-bold px-2.5 py-1 rounded-lg shrink-0">
                {profile.meeting_duration}min
              </span>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <FormField
                label="Nome completo"
                error={touched.name && !form.name.trim() ? "Campo obrigatório" : null}
                valid={touched.name && form.name.trim().length > 0}
              >
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onBlur={() => setTouched(t => ({ ...t, name: true }))}
                  placeholder="Seu nome"
                  className={inputCls(touched.name, form.name.trim().length > 0)}
                />
              </FormField>

              <FormField
                label="Email"
                error={touched.email && form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? "Email inválido" : null}
                valid={touched.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)}
              >
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  onBlur={() => setTouched(t => ({ ...t, email: true }))}
                  placeholder="seu@email.com"
                  className={inputCls(touched.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))}
                />
              </FormField>

              <FormField label={<>Mensagem <span className="text-[#8E8E93] font-normal">(opcional)</span></>}>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Assunto da reunião, dúvidas..."
                  rows={3}
                  className="w-full border-2 border-[#E5E5EA] rounded-xl px-4 py-2.5 text-sm text-[#1C1C1E] outline-none focus:border-[#4F8EF7] focus:ring-2 focus:ring-[#4F8EF7]/10 transition-all bg-white resize-none"
                />
              </FormField>

              <button
                type="submit"
                disabled={submitting || !isFormValid}
                className={[
                  "w-full text-sm font-semibold py-3 rounded-xl transition-all",
                  isFormValid && !submitting
                    ? "bg-[#4F8EF7] text-white hover:bg-[#4484E8] shadow-sm"
                    : "bg-[#E5E5EA] text-[#C7C7CC] cursor-not-allowed",
                ].join(" ")}
              >
                {submitting ? "Confirmando..." : "Confirmar agendamento"}
              </button>
            </form>
          </div>
        )}

        {/* ─ Calendário + Slots (dois painéis) ─ */}
        {step === "calendar" && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="md:grid md:grid-cols-[1fr_1px_1fr]">

              {/* Painel esquerdo: calendário */}
              <div className="p-5 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setCalMonth(({ year, month }) =>
                      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
                    )}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8E8E93] hover:bg-[#F2F2F7] transition-colors"
                  >
                    <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <span className="text-sm font-semibold text-[#1C1C1E]">
                    {MONTHS_PT[calMonth.month]} {calMonth.year}
                  </span>
                  <button
                    onClick={() => setCalMonth(({ year, month }) =>
                      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
                    )}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8E8E93] hover:bg-[#F2F2F7] transition-colors"
                  >
                    <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {DAYS_SHORT.map((d, i) => (
                    <div key={i} className="text-center text-[11px] font-semibold text-[#C7C7CC] pb-1">{d}</div>
                  ))}
                  {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day  = i + 1;
                    const date = new Date(calMonth.year, calMonth.month, day);
                    date.setHours(0,0,0,0);
                    const iso        = isoDate(date);
                    const isAvail    = availableDays.has(iso);
                    const isToday    = iso === isoDate(today);
                    const isPast     = date < today || date > limit;
                    const isSelected = selectedDate && isoDate(selectedDate) === iso;

                    return (
                      <button
                        key={day}
                        disabled={!isAvail || isPast}
                        onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                        className={[
                          "aspect-square rounded-xl text-sm font-medium transition-all",
                          isSelected
                            ? "bg-[#4F8EF7] text-white shadow-sm"
                            : isAvail && !isPast
                            ? "bg-[#4F8EF7]/10 text-[#4F8EF7] hover:bg-[#4F8EF7]/20 cursor-pointer"
                            : "text-[#D1D1D6] cursor-default",
                          isToday && !isSelected ? "ring-2 ring-[#4F8EF7] ring-offset-1" : "",
                        ].join(" ")}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Divisor */}
              <div className="hidden md:block bg-[#F2F2F7]" />

              {/* Painel direito: slots */}
              <div className="border-t border-[#F2F2F7] md:border-t-0 p-5 md:p-6 flex flex-col">
                {!selectedDate ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-[200px] text-center py-8">
                    <div className="w-12 h-12 rounded-2xl bg-[#F2F2F7] flex items-center justify-center">
                      <CalIcon color="#C7C7CC" size={20} />
                    </div>
                    <p className="text-sm text-[#8E8E93]">Selecione uma data<br/>no calendário</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-widest capitalize">
                      {formatDate(selectedDate)}
                    </p>

                    {slots.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 gap-2">
                        <span className="text-3xl">😕</span>
                        <p className="text-sm text-[#8E8E93] text-center">Sem horários disponíveis<br/>neste dia</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {slots.map((slot) => {
                          const key   = slot.toISOString();
                          const isSel = selectedSlot?.toISOString() === key;
                          return (
                            <button
                              key={key}
                              onClick={() => setSelectedSlot(isSel ? null : slot)}
                              className={[
                                "py-3 rounded-xl text-sm font-semibold border-2 transition-all",
                                isSel
                                  ? "bg-[#4F8EF7] text-white border-[#4F8EF7] shadow-sm"
                                  : "bg-white text-[#1C1C1E] border-[#E5E5EA] hover:border-[#4F8EF7] hover:text-[#4F8EF7]",
                              ].join(" ")}
                            >
                              {formatTime(slot)}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Mini-resumo + botão continuar */}
                    {selectedSlot && (
                      <div className="mt-1 rounded-xl border border-[#4F8EF7]/25 bg-[#4F8EF7]/[0.06] p-3.5 space-y-3">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#4F8EF7]/15 flex items-center justify-center shrink-0">
                            <CalIcon color="#4F8EF7" size={14} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#1C1C1E] capitalize leading-snug">
                              {formatDate(selectedSlot)}
                            </p>
                            <p className="text-xs text-[#8E8E93]">
                              {formatTime(selectedSlot)} · {profile.meeting_duration} min · Google Meet
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setStep("form")}
                          className="w-full bg-[#4F8EF7] text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-[#4484E8] transition-colors"
                        >
                          Continuar →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-[11px] text-[#C7C7CC] mt-6">Powered by LCTarefas</p>
      </div>
    </div>
  );
}

// ── Helpers de estilo ────────────────────────────────────────────────────────

function inputCls(isTouched, isValid) {
  const base = "w-full border-2 rounded-xl px-4 py-2.5 text-sm text-[#1C1C1E] outline-none transition-all bg-white";
  if (!isTouched) return `${base} border-[#E5E5EA] focus:border-[#4F8EF7] focus:ring-2 focus:ring-[#4F8EF7]/10`;
  if (isValid)    return `${base} border-[#34C759] focus:border-[#34C759] focus:ring-2 focus:ring-[#34C759]/10`;
  return `${base} border-[#FF3B30] focus:border-[#FF3B30] focus:ring-2 focus:ring-[#FF3B30]/10`;
}

function FormField({ label, children, error, valid }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-[#3C3C43]">{label}</label>
      {children}
      {error && <p className="text-xs text-[#FF3B30]">{error}</p>}
      {valid && !error && (
        <p className="text-xs text-[#34C759] flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          OK
        </p>
      )}
    </div>
  );
}

function DetailRow({ icon, children }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-[#4F8EF7]/10 flex items-center justify-center shrink-0">{icon}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Chip({ icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-[#F2F2F7] rounded-full px-3 py-1 text-xs font-medium text-[#3C3C43]">
      {icon}{children}
    </span>
  );
}

// ── Ícones inline ────────────────────────────────────────────────────────────

function ClockIcon({ color = "#8E8E93" }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/>
      <path d="M12 6v6l4 2" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function MeetIcon({ white } = {}) {
  const c = white ? "white" : "#4F8EF7";
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M15 10l5 5-5 5M4 4v7a4 4 0 004 4h12" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#8E8E93" strokeWidth="1.8"/>
      <path d="M12 2C9 6 9 18 12 22M12 2c3 4 3 16 0 20M2 12h20" stroke="#8E8E93" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function CalIcon({ color = "#4F8EF7", size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth="2"/>
      <path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="#4F8EF7" strokeWidth="2"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#4F8EF7" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 4v12m0 0l-4-4m4 4l4-4" stroke="#3C3C43" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 20h16" stroke="#3C3C43" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
