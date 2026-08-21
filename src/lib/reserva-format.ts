/**
 * Rótulos da reserva — fonte única de apresentação de linhas pendentes.
 *
 * Uma peça pode entrar na reserva sem preço e/ou sem tamanho confirmados.
 * A UI NUNCA imprime `R$ 0,00`, tamanho vazio, `NaN` ou `undefined`: o que
 * ainda não é oficial aparece como "Sob consulta" / "A definir".
 */
import { formatBRL, SOB_CONSULTA } from "@/features/catalog";

export interface ReservaLineLike {
  size: string;
  price: number;
  quantity: number;
  precoPendente?: boolean;
  tamanhoPendente?: boolean;
}

export const A_DEFINIR = "A definir";

export const itemSizeLabel = (i: ReservaLineLike): string =>
  i.tamanhoPendente || !i.size ? A_DEFINIR : i.size;

export const itemPriceLabel = (i: ReservaLineLike): string =>
  i.precoPendente || !(i.price > 0) ? SOB_CONSULTA : formatBRL(i.price * i.quantity);

export const hasPrecoPendente = (items: ReservaLineLike[]): boolean =>
  items.some((i) => i.precoPendente || !(i.price > 0));

export const hasTamanhoPendente = (items: ReservaLineLike[]): boolean =>
  items.some((i) => i.tamanhoPendente || !i.size);

export const hasPendencias = (items: ReservaLineLike[]): boolean =>
  hasPrecoPendente(items) || hasTamanhoPendente(items);

/** Total exibido: some apenas o que é oficial e sinaliza pendência. */
export const totalLabel = (total: number, items: ReservaLineLike[]): string =>
  hasPrecoPendente(items) ? `${formatBRL(total)} + sob consulta` : formatBRL(total);
