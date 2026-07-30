import type { CatalogDataSource } from "./types";
import { lovableCloudCatalog } from "./lovableCloud";

/**
 * DataSource ativo do catálogo público. Trocar a origem consiste em atribuir
 * outra implementação — nenhum service, store ou UI precisa mudar.
 */
export const catalogDataSource: CatalogDataSource = lovableCloudCatalog;

export type { CatalogDataSource } from "./types";
