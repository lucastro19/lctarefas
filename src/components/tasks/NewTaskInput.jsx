import { useState } from "react";
import { useTaskStore } from "../../store/taskStore";

export function NewTaskInput({ defaultFields = {} }) {
  const [value, setValue] = useState("");
  const [active, setActive] = useState(false);
  const { createTask } = useTaskStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const title = value.trim();
    if (!title) return;
    await createTask({ title, ...defaultFields });
    setValue("");
  };

  if (!active) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setActive(true); }}
        className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-main hover:bg-card rounded-card w-full transition-all dark:text-white/40 dark:hover:text-white/80"
      >
        <span className="w-5 h-5 rounded-full border-2 border-[#AEAEB2] dark:border-white/30 flex items-center justify-center text-[#AEAEB2] dark:text-white/30 text-xs font-bold leading-none">
          +
        </span>
        Nova tarefa
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      onClick={(e) => e.stopPropagation()}
      className="bg-card border border-primary rounded-card shadow-sm px-4 py-3"
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => { if (!value.trim()) setActive(false); }}
        placeholder="Nova tarefa…"
        className="w-full text-sm text-text-main outline-none bg-transparent placeholder:text-text-secondary dark:placeholder:text-white/30"
        onKeyDown={(e) => e.key === "Escape" && setActive(false)}
      />
      <div className="flex items-center justify-end gap-2 mt-2">
        <button
          type="button"
          onClick={() => setActive(false)}
          className="text-xs text-[#8E8E93] hover:text-text-main px-2 py-1 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!value.trim()}
          className="text-xs bg-primary text-white px-3 py-1 rounded-lg disabled:opacity-40 hover:bg-primary/90 transition-colors"
        >
          Adicionar
        </button>
      </div>
    </form>
  );
}
