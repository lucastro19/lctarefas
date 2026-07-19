import { create } from "zustand";
import { supabase } from "../lib/supabase";

export const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,

  init: async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    set({ session: data.session, user, loading: false });
    if (user) get().loadProfile();

    supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      set({ session, user: u });
      if (u) get().loadProfile();
      else set({ profile: null });
    });
  },

  loadProfile: async () => {
    const { user } = get();
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (data) set({ profile: data });
  },

  updateProfile: async (fields) => {
    const { user } = get();
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select()
      .single();
    if (data) set({ profile: data });
  },

  signInWithGoogle: async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        scopes: "https://www.googleapis.com/auth/calendar.events",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  },

  // Re-autentica para obter o token do Google Calendar (usuários que logaram antes do scope)
  connectGoogleCalendar: async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        scopes: "https://www.googleapis.com/auth/calendar.events",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  },

  getGoogleToken: () => {
    const { session } = get();
    return session?.provider_token ?? null;
  },

  signInWithEmail: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  signUpWithEmail: async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    return data;
  },

  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, profile: null });
  },
}));
