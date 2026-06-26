import { DEFAULT_ATTENDANT, type Attendant } from "@/config/attendants";
import type { ReservaItem } from "@/store/reserva";
import { formatBRL } from "@/data/products";

const RULE = "━━━━━━━━━━━━━━";

export function buildReservaMessage(items: ReservaItem[], numeroPedido?: string): string {
  const total = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const lines: string[] = [];
  lines.push(RULE, "", "7D IMPORTS", "");
  if (numeroPedido) {
    lines.push(`Pedido nº ${numeroPedido}`, "");
  }
  items.forEach((item, idx) => {
    lines.push(
      `Peça ${idx + 1}: ${item.name}`,
      `Tamanho: ${item.size}`,
      `Quantidade: ${item.quantity}`,
      `Valor: ${formatBRL(item.price * item.quantity)}`,
      "",
    );
  });
  lines.push(`Total estimado: ${formatBRL(total)}`, "", RULE, "", "Solicito atendimento.", "", RULE);
  return lines.join("\n");
}

export function buildWhatsAppUrl(items: ReservaItem[], numeroPedido?: string, attendant: Attendant = DEFAULT_ATTENDANT): string {
  const msg = buildReservaMessage(items, numeroPedido);
  return `https://wa.me/${attendant.phone}?text=${encodeURIComponent(msg)}`;
}