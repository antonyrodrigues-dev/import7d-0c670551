/**
 * 7D IMPORTS — Analytics
 * Camada mínima e agnóstica. Encaminha eventos para window.dataLayer
 * (GTM / GA4) quando disponível e faz fallback silencioso em dev.
 * Estender aqui para integrar Plausible, Umami, Meta Pixel etc.
 */

export type AnalyticsEvent =
  | { name: "reserve_add"; slug: string; size: string; quantity: number; price: number }
  | { name: "reserve_open"; count: number }
  | { name: "reserve_qty_change"; slug: string; size: string; from: number; to: number }
  | { name: "reserve_remove"; slug: string; size: string }
  | { name: "checkout_step"; step: number }
  | { name: "checkout_whatsapp"; total: number; items: number };

interface WithDataLayer {
  dataLayer?: Array<Record<string, unknown>>;
}

export function track(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as WithDataLayer;
  try {
    (w.dataLayer ||= []).push({ event: event.name, ...event });
  } catch {
    /* noop */
  }
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", event);
  }
}