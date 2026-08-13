/**
 * 7D IMPORTS — Tabela densa responsiva compartilhada.
 *
 * Fonte única de layout para listas operacionais (Pedidos, Atendimentos):
 * tabela densa no desktop, cards empilhados no mobile. Nenhuma tela cria sua
 * própria grade — todas reutilizam este componente para não duplicar HTML.
 */

import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  /** Alinhamento do conteúdo da coluna. */
  align?: "left" | "right" | "center";
  /** Largura opcional (ex.: "1%" para colunas de ação que não devem esticar). */
  width?: string;
  /**
   * Conteúdo que não pode ser cortado (selos, botões). Sem truncate, o
   * elemento respira dentro da célula em vez de ser fatiado.
   */
  noTruncate?: boolean;
  cell: (row: T) => ReactNode;
}

export function ResponsiveDataTable<T>({
  columns,
  rows,
  keyFor,
  renderCard,
  onRowClick,
  ariaLabel,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  keyFor: (row: T) => string;
  renderCard: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  ariaLabel: string;
}) {
  return (
    <>
      {/* Desktop: tabela densa, sem overflow horizontal (colunas truncam). */}
      <div className="hidden overflow-hidden border border-[color:var(--border)] md:block">
        <table className="w-full table-fixed border-collapse text-sm" aria-label={ariaLabel}>
          <thead>
            <tr className="border-b border-[color:var(--border)] bg-[color:var(--cream-deep)]/40">
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={c.width ? { width: c.width } : undefined}
                  className={`px-3 py-2 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)] ${
                    c.align === "right"
                      ? "text-right"
                      : c.align === "center"
                        ? "text-center"
                        : "text-left"
                  }`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={keyFor(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-[color:var(--border)] last:border-0 ${
                  onRowClick ? "cursor-pointer hover:bg-[color:var(--cream-deep)]/30" : ""
                }`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`min-w-0 px-3 py-3 align-middle text-[color:var(--forest-deep)] ${
                      c.noTruncate ? "whitespace-nowrap" : "truncate"
                    } ${
                      c.align === "right"
                        ? "text-right"
                        : c.align === "center"
                          ? "text-center"
                          : "text-left"
                    }`}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards empilhados. */}
      <ul className="flex flex-col gap-3 md:hidden" aria-label={ariaLabel}>
        {rows.map((row) => (
          <li key={keyFor(row)}>{renderCard(row)}</li>
        ))}
      </ul>
    </>
  );
}
