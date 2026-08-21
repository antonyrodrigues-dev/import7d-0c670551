export { useCatalog } from "./hooks/useCatalog";
export { useCatalogStore } from "./stores/catalog";
export { findBySlug, featuredOf, categoriesOf } from "./services/catalog.service";
export { formatBRL, priceLabel, SOB_CONSULTA } from "./types";
export {
  productPublicState,
  buildConsultaMessage,
  buildConsultaUrl,
} from "./services/consulta.service";
export type { PublicState, PublicStatus } from "./services/consulta.service";
export type { PublicProduct } from "./types";
