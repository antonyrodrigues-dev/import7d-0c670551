import type { AdminDataSource } from "./types";
import { lovableCloudDataSource } from "./lovableCloud";

/**
 * DataSource ativo do painel. Trocar a origem consiste em atribuir outra
 * implementação de `AdminDataSource` — nenhum serviço ou store precisa
 * ser modificado.
 */
export const adminDataSource: AdminDataSource = lovableCloudDataSource;

export type { AdminDataSource, AdminIdentity } from "./types";