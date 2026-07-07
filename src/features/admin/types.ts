/**
 * 7D IMPORTS — Tipagem oficial do módulo administrativo.
 *
 * Barrel — a definição real vive em `./types/*.ts`, um arquivo por domínio.
 * Este arquivo existe apenas por retrocompatibilidade com imports antigos
 * (`@/features/admin/types`); novos módulos devem importar diretamente do
 * arquivo de domínio (ex.: `./types/order`).
 */
export * from "./types";