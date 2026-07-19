import { create } from "zustand";
import { supabase } from "../lib/supabase";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

export { DAYS };

export const useBookingStore = create((set, get) => ({
  profile: null,
  availability: [],
  bookings: [],
  loading: false,

  fetchProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("booking_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    set({ profile: data });
  },

  saveProfile: async (fields) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Não autenticado" };
    const payload = { ...fields, user_id: user.id, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from("booking_profiles")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single();
    if (!error) set({ profile: data });
    return { data, error };
  },

  fetchAvailability: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("availability")
      .select("*")
      .eq("user_id", user.id)
      .order("day_of_week");
    set({ availability: data ?? [] });
  },

  saveAvailability: async (rows) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Deleta tudo e reinserere (upsert com constraint user_id+day_of_week)
    const payload = rows.map((r) => ({ ...r, user_id: user.id }));
    await supabase.from("availability").delete().eq("user_id", user.id);
    if (payload.length > 0) {
      await supabase.from("availability").insert(payload);
    }
    set({ availability: payload });
  },

  fetchBookings: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "confirmed")
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at");
    set({ bookings: data ?? [] });
  },

  cancelBooking: async (id) => {
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    set((s) => ({ bookings: s.bookings.filter((b) => b.id !== id) }));
  },

  // ─── Funções públicas (sem auth) ─────────────────────────────────────────

  // Busca perfil por slug (página pública)
  fetchPublicProfile: async (slug) => {
    const { data, error } = await supabase
      .from("booking_profiles")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    return { data, error };
  },

  // Busca disponibilidade + reservas para calcular slots (página pública)
  fetchPublicSlots: async (userId, fromDate, toDate) => {
    const [{ data: avail }, { data: existing }] = await Promise.all([
      supabase.from("availability").select("*").eq("user_id", userId).eq("is_active", true),
      supabase.from("bookings")
        .select("scheduled_at, duration_minutes")
        .eq("user_id", userId)
        .eq("status", "confirmed")
        .gte("scheduled_at", fromDate)
        .lte("scheduled_at", toDate),
    ]);
    return { availability: avail ?? [], bookings: existing ?? [] };
  },
}));

// ─── Utilitário: calcula slots disponíveis para um dia específico ──────────

export function computeSlots({ availability, bookings, date, duration, bufferMinutes, minNoticeHours }) {
  const dayOfWeek = date.getDay();
  const rule = availability.find((a) => a.day_of_week === dayOfWeek && a.is_active);
  if (!rule) return [];

  const [sh, sm] = rule.start_time.split(":").map(Number);
  const [eh, em] = rule.end_time.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  const now = new Date();
  const minNoticeMs = (minNoticeHours ?? 2) * 60 * 60 * 1000;

  const slots = [];
  for (let t = startMin; t + duration <= endMin; t += 30) {
    const slotDate = new Date(date);
    slotDate.setHours(Math.floor(t / 60), t % 60, 0, 0);

    // Antecedência mínima
    if (slotDate.getTime() - now.getTime() < minNoticeMs) continue;

    // Verifica conflito com reservas existentes
    const slotEnd = slotDate.getTime() + duration * 60000;
    const blocked = bookings.some((b) => {
      const bStart = new Date(b.scheduled_at).getTime();
      const bEnd = bStart + (b.duration_minutes + bufferMinutes) * 60000;
      return slotDate.getTime() < bEnd && slotEnd > bStart;
    });

    if (!blocked) {
      slots.push(slotDate);
    }
  }
  return slots;
}
