export function Badge({ count }) {
  if (!count) return null;
  return (
    <span className="ml-auto text-[11px] font-semibold tabular-nums rounded-full px-1.5 min-w-[20px] text-center leading-5
                     bg-[#8E8E93]/30 text-[#3C3C43]
                     dark:bg-white/12 dark:text-white/65">
      {count > 99 ? "99+" : count}
    </span>
  );
}
