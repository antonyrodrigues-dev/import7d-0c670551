import { DEFAULT_ATTENDANT, type Attendant } from "@/config/attendants";
import { formatBRL } from "@/data/products";
import { DELIVERY_LABEL, PAYMENT_LABEL } from "@/lib/checkout";
import type { Order } from "@/lib/order";
import { formatPickupSlot } from "@/lib/pickup";

function formatDateBR(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Gera a mensagem de reserva a partir do objeto `Order` — nunca a partir de
 * campos de formulário. Isso garante que toda saída (WhatsApp, painel,
 * futura persistência) enxergue o pedido exatamente da mesma forma.
 */
export function buildReservaMessage(order: Order): string {
  const { cliente, itens, entrega, pagamento, totais } = order;
  const parcelamento = pagamento.parcelamento;

  const L: string[] = [];
  L.push("*7D IMPORTS*", `Pedido nº ${order.numero}`, `Data: ${formatDateBR(order.criadoEm)}`, "");

  L.push("*Cliente*", `Nome: ${cliente.nome}`, `Telefone: ${cliente.telefone}`);
  if (cliente.cpf) L.push(`CPF: ${cliente.cpf}`);
  L.push("");

  L.push("*Peças*");
  itens.forEach((it, i) => {
    L.push(
      `${i + 1}. ${it.name} — Tamanho ${it.size} — ${it.quantity}x — ${formatBRL(it.price * it.quantity)}`,
    );
  });
  L.push("");

  L.push("*Entrega*", DELIVERY_LABEL[entrega.metodo]);
  if (entrega.metodo === "entrega" && entrega.endereco) {
    const a = entrega.endereco;
    L.push(
      `${a.rua}, ${a.numero}${a.complemento ? " · " + a.complemento : ""}`,
      `${a.bairro} · ${a.cidade}`,
      `CEP ${a.cep}`,
      `Frete: ${entrega.frete.cost != null ? formatBRL(entrega.frete.cost) : entrega.frete.label}`,
    );
  }
  if (entrega.metodo === "retirada" && entrega.retirada) {
    L.push(`Horário: ${formatPickupSlot(entrega.retirada.date, entrega.retirada.time)}`);
  }
  L.push("");

  L.push("*Forma de pagamento*", PAYMENT_LABEL[pagamento.metodo], "");
  L.push("*Parcelamento*");
  if (parcelamento && parcelamento.count > 1) {
    L.push(`${parcelamento.count}x de ${formatBRL(parcelamento.perInstallment)}`);
  } else {
    L.push("À vista");
  }
  L.push("");

  if (cliente.observacoes) {
    L.push("*Observações*", cliente.observacoes, "");
  }

  L.push(`Subtotal: ${formatBRL(totais.subtotal)}`);
  if (entrega.frete.cost != null) L.push(`Frete: ${formatBRL(totais.frete)}`);
  L.push(`*Valor total: ${formatBRL(totais.total)}*`);
  if (parcelamento && parcelamento.count > 1) {
    L.push(
      `Valor por parcela: ${parcelamento.count}x de ${formatBRL(parcelamento.perInstallment)}`,
    );
  }

  return L.join("\n");
}

export function buildWhatsAppUrl(
  order: Order,
  attendant: Attendant = DEFAULT_ATTENDANT,
): string {
  const msg = buildReservaMessage(order);
  return `https://wa.me/${attendant.phone}?text=${encodeURIComponent(msg)}`;
}
