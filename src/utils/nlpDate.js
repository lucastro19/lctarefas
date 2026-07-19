import * as chrono from "chrono-node";

// Portuguese → English keyword map for chrono-node
const PT_EN = [
  ["depois de amanhã", "day after tomorrow"],
  ["semana que vem", "next week"],
  ["próxima semana", "next week"],
  ["próxima segunda", "next Monday"],
  ["próxima terça", "next Tuesday"],
  ["próxima quarta", "next Wednesday"],
  ["próxima quinta", "next Thursday"],
  ["próxima sexta", "next Friday"],
  ["próximo sábado", "next Saturday"],
  ["próximo domingo", "next Sunday"],
  ["amanhã", "tomorrow"],
  ["hoje", "today"],
  ["segunda-feira", "Monday"],
  ["terça-feira", "Tuesday"],
  ["quarta-feira", "Wednesday"],
  ["quinta-feira", "Thursday"],
  ["sexta-feira", "Friday"],
  ["segunda", "Monday"],
  ["terça", "Tuesday"],
  ["quarta", "Wednesday"],
  ["quinta", "Thursday"],
  ["sexta", "Friday"],
  ["sábado", "Saturday"],
  ["domingo", "Sunday"],
  // time patterns in Portuguese
  ["às (\\d+)h(\\d+)?", "at $1:$2"],
  ["(\\d+)h(\\d+)?", "$1:$2"],
];

export function parseNaturalDate(text) {
  if (!text) return null;
  let processed = text;
  let ptPhrase = null;

  for (const [pt] of PT_EN) {
    const re = new RegExp(`\\b${pt}\\b`, "i");
    if (re.test(processed)) {
      ptPhrase = processed.match(re)?.[0];
      break;
    }
  }

  // Replace Portuguese with English
  let translated = processed;
  for (const [pt, en] of PT_EN) {
    translated = translated.replace(new RegExp(`\\b${pt}\\b`, "gi"), en);
  }
  // Fix "at 14:undefined" → "at 14:00"
  translated = translated.replace(/(\d+):undefined/g, "$1:00");

  const refs = chrono.parse(translated, new Date(), { forwardDate: true });
  if (!refs.length) return null;

  const ref = refs[0];

  // Se só a hora foi reconhecida (sem data explícita), usa sempre hoje —
  // forwardDate colocaria amanhã quando a hora já passou, o que não é o esperado
  // quando o usuário digita "às 14h" sem mencionar um dia.
  const onlyTimeMentioned =
    ref.start.isCertain("hour") &&
    !ref.start.isCertain("day") &&
    !ref.start.isCertain("month");

  const date = onlyTimeMentioned ? (() => {
    const now = new Date();
    const d = ref.date();
    const local = new Date(now.getFullYear(), now.getMonth(), now.getDate(),
      d.getHours(), d.getMinutes(), 0);
    return local;
  })() : ref.date();

  const dateStr = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  const timeStr = ref.start.isCertain("hour")
    ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
    : null;

  // Remove the matched date phrase from the original title
  const phraseToRemove = ptPhrase || ref.text;
  const cleanTitle = text
    .replace(new RegExp(`\\s*\\b${phraseToRemove.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b\\s*`, "i"), " ")
    .trim()
    .replace(/\s+/g, " ");

  return { dateStr, timeStr, cleanTitle };
}

const localDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function formatDateHint(dateStr) {
  if (!dateStr) return "";
  const today = localDateStr();
  const tom = new Date(); tom.setDate(tom.getDate() + 1);
  const tomorrow = localDateStr(tom);
  if (dateStr === today) return "Hoje";
  if (dateStr === tomorrow) return "Amanhã";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
}
