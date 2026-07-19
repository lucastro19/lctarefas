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

const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAYS_SHORT = ["D","S","T","Q","Q","S","S"];

export function BookPage() {
  const { slug } = useParams();
  const { fetchPublicProfile, fetchPublicSlots } = useBookingStore();

  const [profile, setProfile] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [step, setStep] = useState("calendar"); // calendar | form | success

  const [form, setForm] = useState({ name: "", email: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await fetchPublicProfile(slug);
      if (error || !data) { setNotFound(true); setLoading(false); return; }
      setProfile(data);

      const from = new Date();
      const to = new Date(); to.setDate(to.getDate() + (data.advance_days ?? 30));
      const { availability: av, bookings: bk } = await fetchPublicSlots(data.user_id, from.toISOString(), to.toISOString());
      setAvailability(av);
      setBookings(bk);
      setLoading(false);
    })();
  }, [slug]);

  // Slots para o dia selecionado
  const slots = useMemo(() => {
    if (!selectedDate || !profile) return [];
    return computeSlots({
      availability,
      bookings,
      date: selectedDate,
      duration: profile.meeting_duration,
      bufferMinutes: profile.buffer_minutes,
      minNoticeHours: profile.min_notice_hours,
    });
  }, [selectedDate, availability, bookings, profile]);

  // Dias com disponibilidade no mês atual
  const availableDays = useMemo(() => {
    if (!profile) return new Set();
    const set = new Set();
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot || !profile) return;
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
        <p className="text-sm text-[#8E8E93]">O link de agendamento <strong>{slug}</strong> não existe.</p>
      </div>
    </div>
  );

  // ── Calendário ────────────────────────────────────────────────────────────
  const firstDay = new Date(calMonth.year, calMonth.month, 1).getDay();
  const daysInMonth = new Date(calMonth.year, calMonth.month + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);
  const limit = new Date(); limit.setDate(limit.getDate() + (profile.advance_days ?? 30));

  const prevMonth = () => setCalMonth(({ year, month }) =>
    month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
  );
  const nextMonth = () => setCalMonth(({ year, month }) =>
    month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
  );

  return (
    <div className="min-h-screen bg-[#F2F2F7] py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header do perfil */}
        <div className="text-center space-y-1">
          <div className="w-16 h-16 rounded-full bg-[#4F8EF7] text-white text-2xl font-bold flex items-center justify-center mx-auto">
            {profile.display_name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <h1 className="text-xl font-bold text-[#1C1C1E] mt-3">{profile.display_name}</h1>
          {profile.title && <p className="text-sm text-[#8E8E93]">{profile.title}</p>}
          {profile.bio && <p className="text-sm text-[#3C3C43] max-w-sm mx-auto">{profile.bio}</p>}
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1.5 bg-white border border-[#E5E5EA] rounded-full px-3 py-1 text-xs text-[#3C3C43]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#4F8EF7" strokeWidth="2"/><path d="M12 6v6l4 2" stroke="#4F8EF7" strokeWidth="2" strokeLinecap="round"/></svg>
              {profile.meeting_duration} min
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white border border-[#E5E5EA] rounded-full px-3 py-1 text-xs text-[#3C3C43]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M15 10l5 5-5 5M4 4v7a4 4 0 004 4h12" stroke="#4F8EF7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Google Meet
            </span>
          </div>
        </div>

        {step === "success" ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#34C759]/15 flex items-center justify-center mx-auto">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h2 className="text-lg font-bold text-[#1C1C1E]">Reunião confirmada!</h2>
            <p className="text-sm text-[#8E8E93]">
              {formatDate(selectedSlot)} às {formatTime(selectedSlot)}
            </p>
            {booking?.meeting_url && (
              <a
                href={booking.meeting_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-[#4F8EF7] text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-[#4F8EF7]/90 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 10l5 5-5 5M4 4v7a4 4 0 004 4h12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Entrar na reunião
              </a>
            )}
            <p className="text-xs text-[#8E8E93]">Um convite foi enviado para {form.email}</p>
          </div>
        ) : step === "form" ? (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-[#E5E5EA]">
              <button onClick={() => setStep("calendar")} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8E8E93] hover:bg-[#F2F2F7]">
                <svg width="16" height="14" viewBox="0 0 16 14" fill="none"><path d="M6 1L1 7l5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M1.5 7H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
              <div>
                <p className="text-sm font-semibold text-[#1C1C1E]">{formatDate(selectedSlot)}</p>
                <p className="text-xs text-[#8E8E93]">{formatTime(selectedSlot)} · {profile.meeting_duration} min · Google Meet</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#3C3C43] mb-1.5">Nome</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Seu nome"
                  className="w-full border border-[#E5E5EA] rounded-xl px-4 py-2.5 text-sm text-[#1C1C1E] outline-none focus:border-[#4F8EF7] focus:ring-2 focus:ring-[#4F8EF7]/20 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3C3C43] mb-1.5">Email</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="seu@email.com"
                  className="w-full border border-[#E5E5EA] rounded-xl px-4 py-2.5 text-sm text-[#1C1C1E] outline-none focus:border-[#4F8EF7] focus:ring-2 focus:ring-[#4F8EF7]/20 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3C3C43] mb-1.5">Mensagem <span className="text-[#8E8E93] font-normal">(opcional)</span></label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Assunto da reunião, dúvidas..."
                  rows={3}
                  className="w-full border border-[#E5E5EA] rounded-xl px-4 py-2.5 text-sm text-[#1C1C1E] outline-none focus:border-[#4F8EF7] focus:ring-2 focus:ring-[#4F8EF7]/20 bg-white resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#4F8EF7] text-white text-sm font-semibold py-3 rounded-xl hover:bg-[#4F8EF7]/90 transition-colors disabled:opacity-50"
              >
                {submitting ? "Confirmando..." : "Confirmar agendamento"}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
            {/* Navegação do calendário */}
            <div className="flex items-center justify-between">
              <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8E8E93] hover:bg-[#F2F2F7]">
                <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <span className="text-sm font-semibold text-[#1C1C1E]">{MONTHS_PT[calMonth.month]} {calMonth.year}</span>
              <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8E8E93] hover:bg-[#F2F2F7]">
                <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>

            {/* Grade do calendário */}
            <div className="grid grid-cols-7 gap-1">
              {DAYS_SHORT.map((d, i) => (
                <div key={i} className="text-center text-[11px] font-medium text-[#8E8E93] py-1">{d}</div>
              ))}
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const date = new Date(calMonth.year, calMonth.month, day);
                date.setHours(0,0,0,0);
                const iso = isoDate(date);
                const isAvail = availableDays.has(iso);
                const isToday = iso === isoDate(today);
                const isPast = date < today || date > limit;
                const isSelected = selectedDate && isoDate(selectedDate) === iso;

                return (
                  <button
                    key={day}
                    disabled={!isAvail || isPast}
                    onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                    className={[
                      "aspect-square rounded-xl text-sm font-medium transition-all",
                      isSelected ? "bg-[#4F8EF7] text-white" :
                      isAvail && !isPast ? "bg-[#4F8EF7]/10 text-[#4F8EF7] hover:bg-[#4F8EF7]/20" :
                      "text-[#C7C7CC] cursor-default",
                      isToday && !isSelected ? "ring-1 ring-[#4F8EF7]" : "",
                    ].join(" ")}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Slots de horário */}
            {selectedDate && (
              <div className="border-t border-[#E5E5EA] pt-4 space-y-3">
                <p className="text-xs font-medium text-[#8E8E93] uppercase tracking-wide">
                  {formatDate(selectedDate)}
                </p>
                {slots.length === 0 ? (
                  <p className="text-sm text-[#8E8E93] text-center py-4">Sem horários disponíveis neste dia</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((slot) => {
                      const key = slot.toISOString();
                      const isSel = selectedSlot?.toISOString() === key;
                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedSlot(slot)}
                          className={[
                            "py-2.5 rounded-xl text-sm font-medium border transition-all",
                            isSel
                              ? "bg-[#4F8EF7] text-white border-[#4F8EF7]"
                              : "bg-white text-[#1C1C1E] border-[#E5E5EA] hover:border-[#4F8EF7] hover:text-[#4F8EF7]",
                          ].join(" ")}
                        >
                          {formatTime(slot)}
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedSlot && (
                  <button
                    onClick={() => setStep("form")}
                    className="w-full bg-[#4F8EF7] text-white text-sm font-semibold py-3 rounded-xl hover:bg-[#4F8EF7]/90 transition-colors mt-2"
                  >
                    Continuar com {formatTime(selectedSlot)}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-[11px] text-[#C7C7CC]">Powered by LCTarefas</p>
      </div>
    </div>
  );
}
