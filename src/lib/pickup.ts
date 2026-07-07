/**
 * 7D IMPORTS — Configuração de horários de retirada em loja.
 *
 * A estrutura já está desacoplada da interface, pronta para virar um
 * registro editável pelo painel administrativo. Enquanto isso, expomos
 * `DEFAULT_PICKUP_HOURS` com o horário comercial oficial da loja e as
 * funções de derivação (`getUpcomingPickupSlots`, `isValidPickupSlot`).
 */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = domingo

export interface PickupDayConfig {
  weekday: Weekday;
  /** Horários no formato "HH:mm", ordenados. */
  slots: string[];
}

export interface PickupHoursConfig {
  days: PickupDayConfig[];
  /** Antecedência mínima em horas para reservar retirada. */
  minLeadHours: number;
  /** Quantos dias corridos exibir na seleção. */
  horizonDays: number;
}

// Padrão: seg–sex 09/10/11/14/15/16/17h · sáb 10/11/14/15h.
const WEEKDAY_SLOTS: string[] = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];
const SATURDAY_SLOTS: string[] = ["10:00", "11:00", "14:00", "15:00"];

export const DEFAULT_PICKUP_HOURS: PickupHoursConfig = {
  days: [
    { weekday: 1, slots: WEEKDAY_SLOTS },
    { weekday: 2, slots: WEEKDAY_SLOTS },
    { weekday: 3, slots: WEEKDAY_SLOTS },
    { weekday: 4, slots: WEEKDAY_SLOTS },
    { weekday: 5, slots: WEEKDAY_SLOTS },
    { weekday: 6, slots: SATURDAY_SLOTS },
  ],
  minLeadHours: 2,
  horizonDays: 7,
};

export interface PickupDay {
  /** Data em ISO local YYYY-MM-DD. */
  date: string;
  /** Label legível: "Qua · 09/07". */
  label: string;
  slots: string[];
}

const WEEKDAY_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDayLabel(d: Date): string {
  return `${WEEKDAY_LABEL[d.getDay()]} · ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

function parseSlot(dateISO: string, slot: string): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = slot.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}

export function getUpcomingPickupSlots(
  now: Date = new Date(),
  config: PickupHoursConfig = DEFAULT_PICKUP_HOURS,
): PickupDay[] {
  const cutoff = now.getTime() + config.minLeadHours * 60 * 60 * 1000;
  const out: PickupDay[] = [];
  for (let i = 0; i < config.horizonDays; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const dayCfg = config.days.find((x) => x.weekday === (d.getDay() as Weekday));
    if (!dayCfg) continue;
    const dateISO = formatISODate(d);
    const slots = dayCfg.slots.filter((s) => parseSlot(dateISO, s).getTime() >= cutoff);
    if (slots.length === 0) continue;
    out.push({ date: dateISO, label: formatDayLabel(d), slots });
  }
  return out;
}

export function isValidPickupSlot(
  date: string,
  time: string,
  now: Date = new Date(),
  config: PickupHoursConfig = DEFAULT_PICKUP_HOURS,
): boolean {
  return getUpcomingPickupSlots(now, config).some(
    (d) => d.date === date && d.slots.includes(time),
  );
}

export function formatPickupSlot(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return `${WEEKDAY_LABEL[dt.getDay()]} · ${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)} às ${time}`;
}