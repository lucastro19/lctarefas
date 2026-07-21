/*
  Cobrança de tarefas delegadas.
  WhatsApp via deep-link wa.me — sem API, sem custo, abre o app já com a mensagem pronta.
*/

const DEFAULT_DDI = "55"; // Brasil

// Telefones são salvos só com dígitos. Se vier sem DDI, assume Brasil.
export function toWaNumber(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.length <= 11 ? DEFAULT_DDI + digits : digits;
}

export function canNudgeByWhatsApp(collaborator) {
  return !!toWaNumber(collaborator?.phone);
}

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

const firstName = (name) => String(name ?? "").trim().split(/\s+/)[0];

export function nudgeMessage(collaborator, task) {
  const oi = firstName(collaborator?.name);
  const prazo = fmtDate(task?.deadline);
  const linhas = [
    `Oi${oi ? " " + oi : ""}, tudo bem?`,
    "",
    `Passando pra saber como está: "${task?.title ?? ""}".`,
  ];
  if (prazo) linhas.push(`Combinamos a entrega para ${prazo}.`);
  if (task?.delegation_note) linhas.push("", `O combinado: ${task.delegation_note}`);
  return linhas.join("\n");
}

// Mensagem para cobrar várias tarefas de uma vez (usada na pauta de 1:1)
export function nudgeMessageMany(collaborator, tasks) {
  const oi = firstName(collaborator?.name);
  const itens = tasks.map((t) => {
    const prazo = fmtDate(t.deadline);
    return `• ${t.title}${prazo ? ` (até ${prazo})` : ""}`;
  });
  return [
    `Oi${oi ? " " + oi : ""}, tudo bem?`,
    "",
    tasks.length === 1
      ? "Como está esta pendência?"
      : `Como estão estas ${tasks.length} pendências?`,
    "",
    ...itens,
  ].join("\n");
}

export function whatsappUrl(collaborator, message) {
  const num = toWaNumber(collaborator?.phone);
  if (!num) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

// Abre o WhatsApp numa nova aba. Retorna false quando o contato não tem telefone.
export function openWhatsApp(collaborator, message) {
  const url = whatsappUrl(collaborator, message);
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
