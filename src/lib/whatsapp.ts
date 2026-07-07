import { DEFAULT_ATTENDANT, type Attendant } from "@/config/attendants";
import type { ReservaItem } from "@/store/reserva";
import { formatBRL } from "@/data/products";
import {
  DELIVERY_LABEL,
  PAYMENT_LABEL,
  type Address,
  type Customer,
  type DeliveryMethod,
  type Freight,
  type PaymentMethod,
} from "@/lib/checkout";
import { getInstallmentOption } from "@/lib/installments";

export interface CheckoutSummary {
  numeroPedido: string;
  delivery: DeliveryMethod;
  address?: Address;
  freight: Freight;
  customer: Customer;
  payment: PaymentMethod;
  /** Quantidade de parcelas escolhida quando payment === "credito". */
  installments?: number;
}

export function buildReservaMessage(items: ReservaItem[], summary: CheckoutSummary): string {
  const subtotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const freightCost = summary.freight.cost ?? 0;
  const baseTotal = subtotal + freightCost;

  const installmentInfo =
    summary.payment === "credito"
      ? getInstallmentOption(baseTotal, summary.installments ?? 1)
      : null;
  const total = installmentInfo ? installmentInfo.total : baseTotal;

  const L: string[] = [];
  L.push("*7D IMPORTS*", `Pedido nº ${summary.numeroPedido}`, "");

  L.push("*Cliente*", `Nome: ${summary.customer.nome}`, `Telefone: ${summary.customer.telefone}`);
  if (summary.customer.cpf) L.push(`CPF: ${summary.customer.cpf}`);
  L.push("");

  L.push("*Peças*");
  items.forEach((it, i) => {
    L.push(
      `${i + 1}. ${it.name} — Tam ${it.size} — ${it.quantity}x — ${formatBRL(it.price * it.quantity)}`,
    );
  });
  L.push("");

  L.push("*Entrega*", DELIVERY_LABEL[summary.delivery]);
  if (summary.delivery === "entrega" && summary.address) {
    const a = summary.address;
    L.push(
      `${a.rua}, ${a.numero}${a.complemento ? " · " + a.complemento : ""}`,
      `${a.bairro} · ${a.cidade}`,
      `CEP ${a.cep}`,
      `Frete: ${summary.freight.cost != null ? formatBRL(summary.freight.cost) : summary.freight.label}`,
    );
  }
  L.push("");

  L.push("*Forma de pagamento*", PAYMENT_LABEL[summary.payment], "");
  L.push("*Parcelamento*");
  if (installmentInfo && installmentInfo.count > 1) {
    L.push(`${installmentInfo.count}x de ${formatBRL(installmentInfo.perInstallment)}`);
  } else {
    L.push("À vista");
  }
  L.push("");

  if (summary.customer.observacoes) {
    L.push("*Observações*", summary.customer.observacoes, "");
  }

  L.push(`Subtotal: ${formatBRL(subtotal)}`);
  if (summary.freight.cost != null) L.push(`Frete: ${formatBRL(summary.freight.cost)}`);
  L.push(`*Valor total: ${formatBRL(total)}*`);
  if (installmentInfo && installmentInfo.count > 1) {
    L.push(
      `Valor por parcela: ${installmentInfo.count}x de ${formatBRL(installmentInfo.perInstallment)}`,
    );
  }

  return L.join("\n");
}

export function buildWhatsAppUrl(
  items: ReservaItem[],
  summary: CheckoutSummary,
  attendant: Attendant = DEFAULT_ATTENDANT,
): string {
  const msg = buildReservaMessage(items, summary);
  return `https://wa.me/${attendant.phone}?text=${encodeURIComponent(msg)}`;
}
