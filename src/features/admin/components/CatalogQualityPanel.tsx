/**
 * Dashboard de qualidade do catálogo.
 * Somente apresentação: os números vêm do gate canônico do banco.
 */
import type { CatalogQualityFilter, CatalogQualitySummary } from "../types";

const CARDS: { key: CatalogQualityFilter; label: string; field: keyof CatalogQualitySummary }[] = [
  { key: "todos", label: "Cadastrados", field: "total" },
  { key: "ativosValidos", label: "Ativos válidos", field: "ativosValidos" },
  { key: "preview", label: "Em conferência", field: "preview" },
  { key: "rascunhos", label: "Rascunhos", field: "rascunhos" },
  { key: "semPreco", label: "Sem preço", field: "semPreco" },
  { key: "semTamanho", label: "Sem tamanho", field: "semTamanho" },
  { key: "semFoto", label: "Sem foto", field: "semFoto" },
  { key: "semQuantidadeConferida", label: "Qtd. não conferida", field: "semQuantidadeConferida" },
  { key: "todos", label: "Duplicidades", field: "duplicidades" },
  { key: "vendidos", label: "Vendidos", field: "vendidos" },
  { key: "reservados", label: "Reservados", field: "reservados" },
  { key: "quarentena", label: "Quarentena", field: "quarentena" },
];

export function CatalogQualityPanel({
  summary,
  active,
  onSelect,
}: {
  summary: CatalogQualitySummary | null;
  active: CatalogQualityFilter;
  onSelect: (f: CatalogQualityFilter) => void;
}) {
  return (
    <section
      aria-label="Qualidade do catálogo"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
    >
      {CARDS.map((c) => {
        const isActive = active === c.key && c.key !== "todos";
        return (
          <button
            key={c.label}
            type="button"
            onClick={() => onSelect(c.key)}
            aria-pressed={isActive}
            className={`min-w-0 border px-3 py-3 text-left transition-colors ${
              isActive
                ? "border-[color:var(--forest-deep)] bg-[color:var(--forest-deep)] text-[color:var(--cream)]"
                : "border-[color:var(--border)] bg-white hover:border-[color:var(--forest-deep)]"
            }`}
          >
            <span className="block text-xl tabular-nums font-display">
              {summary ? (summary[c.field] ?? 0) : "—"}
            </span>
            <span className="block text-[10px] tracking-luxe uppercase opacity-75">{c.label}</span>
          </button>
        );
      })}
    </section>
  );
}

export const SITUATION_LABEL: Record<string, string> = {
  ACTIVE_VALID: "Ativo e vendável",
  ACTIVE_INVALID: "Ativo inválido",
  PREVIEW_READY: "Em conferência",
  INACTIVE_READY: "Pronto para publicar",
  INACTIVE_PRICE_PENDING: "Preço pendente",
  INACTIVE_SIZE_PENDING: "Tamanho pendente",
  INACTIVE_PHOTO_PENDING: "Foto pendente",
  INACTIVE_PHYSICAL_CHECK: "Conferência física pendente",
  ARQUIVADO: "Arquivado",
};
