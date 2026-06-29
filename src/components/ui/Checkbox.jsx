export function Checkbox({ checked, onChange, deadline }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={[
        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200",
        checked
          ? "bg-success border-success"
          : deadline
          ? "border-danger hover:border-danger/70"
          : "border-[#8E8E93] hover:border-success dark:border-white/35 dark:hover:border-success",
      ].join(" ")}
      aria-label={checked ? "Desmarcar" : "Concluir"}
    >
      {checked && (
        <svg
          key="check"
          className="w-3 h-3 text-white animate-check-pop"
          fill="none"
          viewBox="0 0 12 12"
        >
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
