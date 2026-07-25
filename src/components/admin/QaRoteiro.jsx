import { useEffect, useMemo, useState } from "react";
import { QA_VERSIONS } from "../../data/qaRoteiro";
import { useQaNotesStore, DEFAULT_NOTE } from "../../store/qaNotesStore";

const pct = (done, total) => (total === 0 ? 0 : Math.round((done / total) * 100));

// Um step do roteiro: checkbox (done) + ação/esperado + nota (aceita colar imagem) + marcar
// corrigido. Cada instância assina só a própria chave em notesByKey — mudar uma nota não
// re-renderiza os outros 109 steps.
function StepRow({ versionId, group, section, step, stepIndex }) {
  const meta = { groupLabel: group.label, sectionTitle: section.title, stepAction: step.a };
  const note = useQaNotesStore((s) => s.notesByKey[`${section.id}-${stepIndex}`]) ?? DEFAULT_NOTE;
  const setDone = useQaNotesStore((s) => s.setDone);
  const setNotes = useQaNotesStore((s) => s.setNotes);
  const addImage = useQaNotesStore((s) => s.addImage);
  const removeImage = useQaNotesStore((s) => s.removeImage);
  const markFixed = useQaNotesStore((s) => s.markFixed);
  const unmarkFixed = useQaNotesStore((s) => s.unmarkFixed);

  const [notesLocal, setNotesLocal] = useState(note.notes);
  const [showFixedForm, setShowFixedForm] = useState(false);
  const [fixedComment, setFixedComment] = useState("");

  useEffect(() => { setNotesLocal(note.notes); }, [note.notes]);

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) addImage(versionId, section.id, stepIndex, meta, file);
      }
    }
  };

  const canMarkFixed = note.done && note.notes.trim().length > 0 && !note.fixed;

  return (
    <li className="pt-3 first:pt-0">
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={note.done}
          onChange={(e) => setDone(versionId, section.id, stepIndex, meta, e.target.checked)}
          className="mt-1 w-4 h-4 accent-primary shrink-0 cursor-pointer"
        />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-text-main">{step.a}</p>
          {step.e && (
            <p className="text-[11px] text-success bg-success/10 rounded-lg px-2 py-1 mt-1 inline-block">{step.e}</p>
          )}

          <textarea
            value={notesLocal}
            onChange={(e) => setNotesLocal(e.target.value)}
            onBlur={() => { if (notesLocal !== note.notes) setNotes(versionId, section.id, stepIndex, meta, notesLocal); }}
            onPaste={handlePaste}
            placeholder="Nota — cole uma imagem aqui também (print, ideia de outro app)…"
            rows={2}
            className="w-full mt-2 bg-bg border border-border rounded-lg px-2 py-1.5 text-xs text-text-main outline-none focus:border-primary resize-none"
          />

          {note.images.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {note.images.map((img) => (
                <div key={img.path} className="relative group/img">
                  <a href={img.url} target="_blank" rel="noreferrer">
                    <img src={img.url} alt="" className="w-16 h-16 object-cover rounded-lg border border-border" />
                  </a>
                  <button
                    onClick={() => removeImage(versionId, section.id, stepIndex, meta, img.path)}
                    title="Remover imagem"
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-danger text-white text-[10px] leading-none flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {note.fixed ? (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-[10.5px] font-medium text-success bg-success/10 px-2 py-1 rounded-full">
                ✅ corrigido em {new Date(note.fixed_at).toLocaleDateString("pt-BR")}
                {note.fixed_comment ? ` — ${note.fixed_comment}` : ""}
              </span>
              <button
                onClick={() => unmarkFixed(versionId, section.id, stepIndex, meta)}
                className="text-[10.5px] text-text-secondary hover:underline"
              >
                desfazer
              </button>
            </div>
          ) : canMarkFixed ? (
            showFixedForm ? (
              <div className="mt-2 flex items-center gap-1.5">
                <input
                  value={fixedComment}
                  onChange={(e) => setFixedComment(e.target.value)}
                  placeholder="O que foi feito…"
                  autoFocus
                  className="flex-1 bg-bg border border-border rounded-lg px-2 py-1 text-[11px] text-text-main outline-none focus:border-primary"
                />
                <button
                  onClick={() => { markFixed(versionId, section.id, stepIndex, meta, fixedComment); setShowFixedForm(false); setFixedComment(""); }}
                  className="text-[10.5px] font-medium text-white bg-success px-2.5 py-1 rounded-lg"
                >
                  Salvar
                </button>
              </div>
            ) : (
              <button onClick={() => setShowFixedForm(true)} className="mt-2 text-[10.5px] text-primary hover:underline">
                🔧 marcar como corrigido
              </button>
            )
          ) : null}
        </div>
      </label>
    </li>
  );
}

// Roteiro de QA por versão (Painel Admin > Roteiro de QA) — sucessor do artifact externo.
// Progresso/notas/imagens vivem em qa_notes (Supabase), não mais em localStorage — dá pra eu
// consultar direto via SQL quando o Lucas mandar revisar, sem precisar que ele copie e cole.
export function QaRoteiro() {
  const [versionId, setVersionId] = useState(QA_VERSIONS[0].id);
  const version = useMemo(() => QA_VERSIONS.find((v) => v.id === versionId), [versionId]);
  const fetchNotes = useQaNotesStore((s) => s.fetchNotes);
  const resetVersionAction = useQaNotesStore((s) => s.resetVersion);
  const notesByKey = useQaNotesStore((s) => s.notesByKey);
  const [openGroups, setOpenGroups] = useState(() => new Set([version.groups[0]?.id]));

  useEffect(() => { fetchNotes(versionId); }, [versionId, fetchNotes]);

  const { doneCount, totalCount, notesCount } = useMemo(() => {
    let done = 0, total = 0, withNotes = 0;
    version.groups.forEach((g) => g.sections.forEach((s) => s.steps.forEach((_, i) => {
      total++;
      const n = notesByKey[`${s.id}-${i}`];
      if (n?.done) done++;
      if (n?.notes?.trim()) withNotes++;
    })));
    return { doneCount: done, totalCount: total, notesCount: withNotes };
  }, [version, notesByKey]);

  const toggleGroup = (id) => setOpenGroups((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const scrollToSection = (sectionId) => {
    document.getElementById(`qa-section-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleReset = () => {
    if (!confirm(`Reiniciar todo o progresso, notas e imagens de ${version.label}?`)) return;
    resetVersionAction(versionId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {QA_VERSIONS.map((v) => (
          <button
            key={v.id}
            onClick={() => setVersionId(v.id)}
            className={[
              "text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors",
              v.id === versionId
                ? "bg-primary border-primary text-white"
                : "bg-card border-border text-text-secondary hover:text-text-main",
            ].join(" ")}
          >
            {v.label} · {v.date}
          </button>
        ))}
      </div>
      <p className="text-xs text-text-secondary">{version.summary}</p>

      <div className="bg-card border border-border rounded-xl p-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-semibold text-text-main">Progresso geral</span>
          <span className="tabular-nums text-text-secondary">
            {doneCount}/{totalCount} · {pct(doneCount, totalCount)}% · {notesCount} nota{notesCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct(doneCount, totalCount)}%` }} />
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleReset} className="text-[11px] text-danger hover:underline">
          Reiniciar progresso desta versão
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">
        <nav className="lg:sticky lg:top-4 lg:self-start space-y-1">
          {version.groups.map((g) => {
            const sectionsTotal = g.sections.reduce((acc, s) => acc + s.steps.length, 0);
            const sectionsDone = g.sections.reduce(
              (acc, s) => acc + s.steps.reduce((a, _, i) => a + (notesByKey[`${s.id}-${i}`]?.done ? 1 : 0), 0),
              0
            );
            const open = openGroups.has(g.id);
            return (
              <div key={g.id}>
                <button
                  onClick={() => toggleGroup(g.id)}
                  className="w-full flex items-center gap-1.5 text-left px-2 py-1.5 rounded-lg hover:bg-card"
                >
                  <span className={["text-[9px] transition-transform shrink-0", open ? "rotate-90" : ""].join(" ")}>▸</span>
                  <span className="text-[11.5px] font-bold uppercase tracking-wide text-text-secondary flex-1">{g.label}</span>
                  <span className="text-[10px] tabular-nums text-text-secondary/70">{sectionsDone}/{sectionsTotal}</span>
                </button>
                {open && (
                  <ul className="pl-5 space-y-0.5">
                    {g.sections.map((s) => (
                      <li key={s.id}>
                        <button
                          onClick={() => scrollToSection(s.id)}
                          className="text-[12px] text-text-secondary hover:text-text-main text-left py-1"
                        >
                          {s.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        <div className="space-y-8 min-w-0">
          {version.groups.map((g) => (
            <div key={g.id}>
              <h3 className="text-xs font-bold uppercase tracking-wide text-text-secondary mb-2">{g.label}</h3>
              <div className="space-y-5">
                {g.sections.map((s) => (
                  <div key={s.id} id={`qa-section-${s.id}`} className="bg-card border border-border rounded-xl p-4 scroll-mt-4">
                    <h4 className="text-sm font-semibold text-text-main">{s.title}</h4>
                    <p className="text-[11.5px] text-text-secondary mb-1">{s.why}</p>
                    <ul className="divide-y divide-border/60">
                      {s.steps.map((step, i) => (
                        <StepRow key={i} versionId={versionId} group={g} section={s} step={step} stepIndex={i} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
