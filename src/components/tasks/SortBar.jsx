import { useState } from "react";

const OPTIONS = [
  { id: "default", label: "Padrão" },
  { id: "date",    label: "Data" },
  { id: "title",   label: "Título" },
  { id: "urgent",  label: "Urgentes" },
];

export function useSortedTasks(tasks) {
  const [sort, setSort] = useState("default");

  const sorted = [...tasks].sort((a, b) => {
    if (sort === "date") {
      const da = a.scheduled_date ?? "9999";
      const db = b.scheduled_date ?? "9999";
      return da.localeCompare(db);
    }
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "urgent") return (b.is_urgent ? 1 : 0) - (a.is_urgent ? 1 : 0);
    return (a.position ?? 0) - (b.position ?? 0);
  });

  return { sorted, sort, setSort };
}

export function SortBar({ sort, setSort }) {
  return (
    <div className="flex items-center gap-1 flex-wrap mb-4">
      <span className="text-xs text-text-secondary mr-1">Ordenar:</span>
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          onClick={() => setSort(o.id)}
          className={[
            "text-xs px-2.5 py-1 rounded-full border transition-colors",
            sort === o.id
              ? "border-primary bg-primary/10 text-primary font-medium"
              : "border-border text-text-secondary hover:border-primary/40",
          ].join(" ")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
