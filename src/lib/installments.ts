/**
 * 7D IMPORTS — Configuração central de parcelamento (Cartão de Crédito).
 *
 * Toda regra financeira de parcelamento vive aqui: número máximo de
 * parcelas, acréscimo por parcela e cálculo das opções. Componentes de UI e
 * a mensagem do WhatsApp consomem apenas as funções expostas — nenhum valor
 * fixo pode ser espalhado pelo restante do código.
 *
 * Preparado para virar um registro configurável pelo painel administrativo:
 * substituir `DEFAULT_INSTALLMENTS_CONFIG` por um fetch quando existir.
 */

export interface InstallmentConfig {
  /** Quantidade máxima de parcelas oferecidas ao cliente. */
  maxInstallments: number;
  /**
   * Acréscimo aplicado ao total por parcela, em fração (0.02 = 2%).
   * Índice 0 = 1x (à vista), índice 1 = 2x, e assim por diante.
   * Se um índice não existir, assume 0.
   */
  surchargePerInstallment: number[];
}

export const DEFAULT_INSTALLMENTS_CONFIG: InstallmentConfig = {
  maxInstallments: 3,
  // Sem acréscimo por padrão — administrador ajustará posteriormente.
  surchargePerInstallment: [0, 0, 0],
};

export interface InstallmentOption {
  /** Número de parcelas (1..maxInstallments). */
  count: number;
  /** Valor total já com acréscimo aplicado. */
  total: number;
  /** Valor de cada parcela. */
  perInstallment: number;
  /** Acréscimo utilizado (fração). */
  surcharge: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function getInstallmentOptions(
  baseTotal: number,
  config: InstallmentConfig = DEFAULT_INSTALLMENTS_CONFIG,
): InstallmentOption[] {
  const max = Math.max(1, Math.floor(config.maxInstallments));
  const options: InstallmentOption[] = [];
  for (let i = 1; i <= max; i++) {
    const surcharge = config.surchargePerInstallment[i - 1] ?? 0;
    // Arredondamento em duas etapas garante que
    // perInstallment * count === total (sem drift de centavos ao exibir).
    const rawTotal = baseTotal * (1 + surcharge);
    const perInstallment = round2(rawTotal / i);
    const total = round2(perInstallment * i);
    options.push({ count: i, total, perInstallment, surcharge });
  }
  return options;
}

export function getInstallmentOption(
  baseTotal: number,
  count: number,
  config: InstallmentConfig = DEFAULT_INSTALLMENTS_CONFIG,
): InstallmentOption {
  const options = getInstallmentOptions(baseTotal, config);
  return options.find((o) => o.count === count) ?? options[0];
}