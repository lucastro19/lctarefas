import { create } from "zustand";
import { supabase } from "../lib/supabase";

const BUCKET = "qa-screenshots";

// Estado por step do roteiro de QA (Painel Admin > Roteiro de QA), substitui o localStorage do
// antigo artifact externo. RLS trava tudo em is_admin(), mesmo padrão de dev_ideas. Uma linha só
// existe depois que o usuário mexe no step (checkbox/nota/imagem) — antes disso o componente usa
// o default abaixo, igual o entry() preguiçoso que o artifact já tinha.
export const DEFAULT_NOTE = { id: null, done: false, notes: "", images: [], fixed: false, fixed_at: null, fixed_comment: null };

const rowKey = (sectionId, stepIndex) => `${sectionId}-${stepIndex}`;

function withPublicUrls(row) {
  const images = (row.images ?? []).map((img) => ({
    ...img,
    url: supabase.storage.from(BUCKET).getPublicUrl(img.path).data.publicUrl,
  }));
  return { ...row, images };
}

export const useQaNotesStore = create((set, get) => ({
  notesByKey: {},
  loading: false,

  fetchNotes: async (versionId) => {
    set({ loading: true });
    const { data, error } = await supabase.from("qa_notes").select("*").eq("version_id", versionId);
    if (error) { console.error("fetchNotes:", error.message); set({ loading: false }); return; }
    const map = {};
    (data ?? []).forEach((row) => { map[rowKey(row.section_id, row.step_index)] = withPublicUrls(row); });
    set({ notesByKey: map, loading: false });
  },

  getNote: (sectionId, stepIndex) => get().notesByKey[rowKey(sectionId, stepIndex)] ?? DEFAULT_NOTE,

  upsertNote: async (versionId, sectionId, stepIndex, meta, patch) => {
    const key = rowKey(sectionId, stepIndex);
    const current = get().notesByKey[key] ?? DEFAULT_NOTE;
    const next = { ...current, ...patch };
    set((s) => ({ notesByKey: { ...s.notesByKey, [key]: next } }));

    const { data, error } = await supabase
      .from("qa_notes")
      .upsert(
        {
          id: current.id ?? undefined,
          version_id: versionId,
          section_id: sectionId,
          step_index: stepIndex,
          group_label: meta.groupLabel,
          section_title: meta.sectionTitle,
          step_action: meta.stepAction,
          done: next.done,
          notes: next.notes,
          images: (next.images ?? []).map(({ path, uploaded_at }) => ({ path, uploaded_at })),
          fixed: next.fixed,
          fixed_at: next.fixed_at,
          fixed_comment: next.fixed_comment,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "version_id,section_id,step_index" }
      )
      .select()
      .single();
    if (error) { console.error("upsertNote:", error.message); return; }
    set((s) => ({ notesByKey: { ...s.notesByKey, [key]: withPublicUrls(data) } }));
  },

  setDone: (versionId, sectionId, stepIndex, meta, done) =>
    get().upsertNote(versionId, sectionId, stepIndex, meta, { done }),

  setNotes: (versionId, sectionId, stepIndex, meta, notes) =>
    get().upsertNote(versionId, sectionId, stepIndex, meta, { notes }),

  addImage: async (versionId, sectionId, stepIndex, meta, file) => {
    const ext = (file.type?.split("/")[1] ?? "png").replace(/[^a-z0-9]/gi, "") || "png";
    const path = `${versionId}/${sectionId}-${stepIndex}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
    if (uploadError) { console.error("addImage upload:", uploadError.message); return; }

    const current = get().getNote(sectionId, stepIndex);
    const images = [...(current.images ?? []), { path, uploaded_at: new Date().toISOString() }];
    await get().upsertNote(versionId, sectionId, stepIndex, meta, { images });
  },

  removeImage: async (versionId, sectionId, stepIndex, meta, path) => {
    const current = get().getNote(sectionId, stepIndex);
    const images = (current.images ?? []).filter((img) => img.path !== path);
    await get().upsertNote(versionId, sectionId, stepIndex, meta, { images });
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) console.error("removeImage:", error.message);
  },

  markFixed: (versionId, sectionId, stepIndex, meta, comment) =>
    get().upsertNote(versionId, sectionId, stepIndex, meta, {
      fixed: true,
      fixed_at: new Date().toISOString(),
      fixed_comment: comment,
    }),

  unmarkFixed: (versionId, sectionId, stepIndex, meta) =>
    get().upsertNote(versionId, sectionId, stepIndex, meta, { fixed: false, fixed_at: null, fixed_comment: null }),

  resetVersion: async (versionId) => {
    const allPaths = Object.values(get().notesByKey).flatMap((r) => (r.images ?? []).map((img) => img.path));
    if (allPaths.length) {
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove(allPaths);
      if (rmErr) console.error("resetVersion remove images:", rmErr.message);
    }
    const { error } = await supabase.from("qa_notes").delete().eq("version_id", versionId);
    if (error) { console.error("resetVersion:", error.message); return; }
    set({ notesByKey: {} });
  },
}));
