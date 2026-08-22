import { DEFAULT_ATTENDANT, type Attendant } from "@/config/attendants";
import { formatBRL } from "@/features/catalog";
import { DELIVERY_LABEL, PAYMENT_LABEL } from "@/lib/checkout";
import type { Order } from "@/lib/order";
import { formatPickupSlot } from "@/lib/pickup";
import { hasPendencias, itemPriceLabel, itemSizeLabel } from "@/lib/reserva-format";

function formatDateBR(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Junta linhas descartando entradas vazias/undefined e evitando linhas duplicadas em branco. */
function joinLines(lines: (string | false | null | undefined)[]): string {
  const cleaned = lines.filter((l): l is string => typeof l === "string" && l.length > 0);
  const out: string[] = [];
  for (const l of cleaned) {
    if (l === "" && out[out.length - 1] === "") continue;
    out.push(l);
  }
  // remove blank lines at start/end
  while (out[0] === "") out.shift();
  while (out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

/**
 * Gera a mensagem de reserva a partir do objeto `Order` — nunca a partir de
 * campos de formulário. Layout profissional, sem linhas vazias, sem campos
 * `undefined` e sem informações duplicadas.
 */
export function buildReservaMessage(order: Order): string {
  const { cliente, itens, entrega, pagamento, totais } = order;
  const parcelamento = pagamento.parcelamento;

  const enderecoLinha = (() => {
    if (entrega.metodo !== "entrega" || !entrega.endereco) return null;
    const a = entrega.endereco;
    return [
      `${a.rua}, ${a.numero}${a.complemento ? " · " + a.complemento : ""}`,
      `${a.bairro} · ${a.cidade}`,
      `CEP ${a.cep}`,
    ];
  })();

  const freteTexto =
    entrega.metodo === "entrega"
      ? entrega.frete.cost != null
        ? formatBRL(entrega.frete.cost)
        : entrega.frete.label
      : null;

  const pagamentoLinhas: string[] = [PAYMENT_LABEL[pagamento.metodo]];
  if (parcelamento && parcelamento.count > 1) {
    pagamentoLinhas.push(`${parcelamento.count}x de ${formatBRL(parcelamento.perInstallment)}`);
  } else {
    pagamentoLinhas.push("À vista");
  }

  return joinLines([
    "*7D IMPORTS*",
    `Pedido ${order.numero}`,
    `Data: ${formatDateBR(order.criadoEm)}`,
    "",
    "*Cliente*",
    cliente.nome,
    cliente.telefone,
    cliente.cpf ? `CPF ${cliente.cpf}` : null,
    "",
    "*Entrega*",
    DELIVERY_LABEL[entrega.metodo],
    ...(enderecoLinha ?? []),
    entrega.metodo === "retirada" && entrega.retirada
      ? `Horário: ${formatPickupSlot(entrega.retirada.date, entrega.retirada.time)}`
      : null,
    "",
    "*Peças*",
    ...itens.map(
      (it, i) =>
        `${i + 1}. ${it.name} — Tam ${itemSizeLabel(it)} — ${it.quantity}× — ${itemPriceLabel(it)}`,
    ),
    "",
    "*Pagamento*",
    ...pagamentoLinhas,
    "",
    cliente.observacoes ? "*Observações*" : null,
    cliente.observacoes || null,
    cliente.observacoes ? "" : null,
    `Subtotal ${formatBRL(totais.subtotal)}`,
    freteTexto ? `Frete ${freteTexto}` : null,
    `*Total ${formatBRL(totais.total)}*`,
    hasPendencias(itens)
      ? "Há peças sob consulta: tamanho e/ou valor serão confirmados pela equipe antes de qualquer cobrança."
      : null,
    "",
    "Obrigado pela preferência.",
    "7D Imports.",
  ]);
}

/**
 * Link de WhatsApp do pedido.
 *
 * FONTE ÚNICA: o número oficial vem SEMPRE das Configurações da loja (banco).
 * Não existe fallback hardcoded — sem número configurado, não há link.
 */
export function buildWhatsAppUrl(order: Order, phone: string): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) {
    throw new Error(
      "Número de WhatsApp da loja não configurado. Ajuste em Configurações antes de enviar pedidos.",
    );
  }
  const msg = buildReservaMessage(order);
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}
