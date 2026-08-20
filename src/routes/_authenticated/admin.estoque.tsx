import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Boxes,
  Copy,
  MoreHorizontal,
  PackageSearch,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/features/catalog";
import { PageHeader, Skeleton } from "@/features/admin/components/PageHeader";
import { EmptyState } from "@/features/admin/components/AdminUI";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOW_STOCK_THRESHOLD } from "@/features/admin/constants";
import { useInventory, usePermissions } from "@/features/admin/hooks";
import { useCatalogQuality } from "@/features/admin/hooks/data/useCatalogQuality";
import { matchesQualityFilter } from "@/features/admin/services/catalogQuality.service";
import { CatalogQualityPanel } from "@/features/admin/components/CatalogQualityPanel";
import { KitCompositionDialog } from "@/features/admin/components/KitCompositionDialog";
import { PriceRuleDialog } from "@/features/admin/components/PriceRuleDialog";
import { SITUATION_LABEL } from "@/features/admin/lib/catalogLabels";
import type { InventoryItem, CatalogQualityFilter } from "@/features/admin/types";
import type { ProductWritePayload } from "@/features/admin/adapters/types";

export const Route = createFileRoute("/_authenticated/admin/estoque")({
  head: () => ({
    meta: [{ title: "Estoque — 7D IMPORTS" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: EstoquePage,
});

type StockLevel = "sem" | "baixo" | "normal";
function levelOf(i: InventoryItem): StockLevel {
  if (i.quantity <= 0) return "sem";
  if (i.quantity <= LOW_STOCK_THRESHOLD) return "baixo";
  return "normal";
}
const LEVEL_LABEL: Record<StockLevel, string> = {
  sem: "Sem estoque",
  baixo: "Estoque baixo",
  normal: "OK",
};
const LEVEL_CLASS: Record<StockLevel, string> = {
  sem: "text-[color:var(--destructive)]",
  baixo: "text-[color:var(--gold)]",
  normal: "text-[color:var(--forest-deep)]",
};

function EstoquePage() {
  const {
    items,
    state,
    query,
    filterBrand,
    filterCategory,
    filterStatus,
    setQuery,
    setFilterBrand,
    setFilterCategory,
    setFilterStatus,
    create,
    update,
    duplicate,
    archive,
    restore,
    remove,
    refresh,
  } = useInventory();
  const { can, isAdmin } = usePermissions();
  const { items: diagnostics, summary, refresh: refreshQuality } = useCatalogQuality();
  const [qualityFilter, setQualityFilter] = useState<CatalogQualityFilter>("todos");
  const diagBySku = useMemo(() => new Map(diagnostics.map((d) => [d.sku, d])), [diagnostics]);

  const [drawer, setDrawer] = useState<
    { mode: "create" } | { mode: "edit"; item: InventoryItem } | null
  >(null);
  const [confirm, setConfirm] = useState<{
    kind: "archive" | "restore" | "delete";
    item: InventoryItem;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [kitDialog, setKitDialog] = useState<InventoryItem | null>(null);
  const [priceRuleOpen, setPriceRuleOpen] = useState(false);

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      if (confirm.kind === "delete") await remove(confirm.item.id);
      else if (confirm.kind === "archive") await archive(confirm.item.id);
      else await restore(confirm.item.id);
      setConfirm(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  const brands = useMemo(() => Array.from(new Set(items.map((i) => i.brand))), [items]);
  const categories = useMemo(() => Array.from(new Set(items.map((i) => i.category))), [items]);

  const visiveis = items.filter((i) => {
    const q = query.trim().toLowerCase();
    if (q && !i.name.toLowerCase().includes(q) && !i.sku.toLowerCase().includes(q)) return false;
    if (filterBrand !== "todas" && i.brand !== filterBrand) return false;
    if (filterCategory !== "todas" && i.category !== filterCategory) return false;
    if (filterStatus === "ativos" && !i.active) return false;
    if (filterStatus === "inativos" && i.active) return false;
    if (filterStatus === "baixo" && !(i.active && i.quantity <= LOW_STOCK_THRESHOLD)) return false;
    if (qualityFilter !== "todos") {
      const d = diagBySku.get(i.sku);
      if (!d || !matchesQualityFilter(d, qualityFilter)) return false;
    }
    return true;
  });

  const canEdit = can("inventory:edit");

  return (
    <>
      <PageHeader
        eyebrow="Painel"
        title="Estoque"
        description="Cadastro, quantidade e destaque dos produtos."
        actions={
          canEdit && (
            <div className="flex flex-wrap gap-2">
              {isAdmin && (
                <Button variant="outline" onClick={() => setPriceRuleOpen(true)}>
                  Regra de preço
                </Button>
              )}
              <Button onClick={() => setDrawer({ mode: "create" })}>
                <Plus className="h-4 w-4 mr-1" /> Novo produto
              </Button>
            </div>
          )
        }
      />

      <CatalogQualityPanel
        summary={summary}
        active={qualityFilter}
        onSelect={(f) => setQualityFilter((cur) => (cur === f ? "todos" : f))}
      />

      {/* Filtros — quebram em qualquer breakpoint. */}
      <section
        aria-label="Filtros"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <input
          type="search"
          placeholder="Pesquisar por nome ou SKU"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 min-w-0 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm text-[color:var(--forest-deep)] focus:border-[color:var(--forest-deep)] focus:outline-none"
          aria-label="Pesquisar estoque"
        />
        <select
          value={filterBrand}
          onChange={(e) => setFilterBrand(e.target.value)}
          className="h-11 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm text-[color:var(--forest-deep)]"
          aria-label="Filtrar por marca"
        >
          <option value="todas">Todas as marcas</option>
          {brands.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="h-11 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm text-[color:var(--forest-deep)]"
          aria-label="Filtrar por categoria"
        >
          <option value="todas">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) =>
            setFilterStatus(e.target.value as "todos" | "ativos" | "inativos" | "baixo")
          }
          className="h-11 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm text-[color:var(--forest-deep)]"
          aria-label="Filtrar por status"
        >
          <option value="todos">Todos</option>
          <option value="ativos">Ativos</option>
          <option value="baixo">Estoque baixo</option>
          <option value="inativos">Inativos/Arquivados</option>
        </select>
      </section>

      {state === "loading" && items.length === 0 ? (
        <Skeleton className="h-64 w-full" />
      ) : visiveis.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="h-5 w-5" />}
          title={items.length === 0 ? "Nenhum produto cadastrado" : "Nenhum produto neste filtro"}
          description={
            items.length === 0
              ? "Cadastre o primeiro produto para começar a operar o estoque."
              : "Ajuste os filtros para localizar o produto desejado."
          }
          action={
            items.length === 0 && canEdit ? (
              <Button onClick={() => setDrawer({ mode: "create" })}>
                <Plus className="h-4 w-4 mr-1" /> Novo produto
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto border border-[color:var(--border)] bg-white">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-[color:var(--cream-deep)]/60 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 text-left">Produto</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Marca</th>
                <th className="px-4 py-3 text-left">Categoria</th>
                <th className="px-4 py-3 text-right">Qtd</th>
                <th className="px-4 py-3 text-right">Preço</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((i) => (
                <tr key={i.id} className="border-t border-[color:var(--border)] align-middle">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {i.image ? (
                        <img
                          src={i.image}
                          alt=""
                          width={40}
                          height={52}
                          loading="lazy"
                          className="aspect-[3/4] h-12 w-9 object-cover"
                        />
                      ) : (
                        <div className="aspect-[3/4] h-12 w-9 bg-[color:var(--cream-deep)]" />
                      )}
                      <div className="min-w-0">
                        <p className="font-display text-base text-[color:var(--forest-deep)]">
                          {i.name}
                        </p>
                        {i.color && i.color !== "—" && (
                          <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                            {i.color}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{i.sku}</td>
                  <td className="px-4 py-3">{i.brand}</td>
                  <td className="px-4 py-3">{i.category}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${LEVEL_CLASS[levelOf(i)]}`}>
                    <span>{i.quantity}</span>
                    <span className="ml-2 text-[10px] tracking-luxe uppercase">
                      {LEVEL_LABEL[levelOf(i)]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatBRL(i.price)}</td>
                  <td className="px-4 py-3">
                    {(() => {
                      const d = diagBySku.get(i.sku);
                      return (
                        <div className="min-w-0 max-w-[16rem]">
                          <span className="text-[10px] tracking-luxe uppercase">
                            {d ? SITUATION_LABEL[d.situation] : i.active ? "Ativo" : "Inativo"}
                            {i.featured ? " · Destaque" : ""}
                          </span>
                          {d && d.blockingReasons.length > 0 && (
                            <ul className="mt-1 space-y-0.5 text-[11px] text-[color:var(--muted-foreground)]">
                              {d.blockingReasons.map((r) => (
                                <li key={r}>· {r}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowActions
                      item={i}
                      canEdit={canEdit}
                      canDelete={isAdmin}
                      onEdit={() => setDrawer({ mode: "edit", item: i })}
                      onDuplicate={() => duplicate(i)}
                      onKit={i.stockModel === "kit" ? () => setKitDialog(i) : undefined}
                      onArchive={() => setConfirm({ kind: "archive", item: i })}
                      onRestore={() => setConfirm({ kind: "restore", item: i })}
                      onDelete={() => setConfirm({ kind: "delete", item: i })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {drawer && (
        <ProductFormDrawer
          initial={drawer.mode === "edit" ? drawer.item : undefined}
          onClose={() => setDrawer(null)}
          onSubmit={async (payload) => {
            if (drawer.mode === "edit") await update(drawer.item.id, payload);
            else await create(payload);
            setDrawer(null);
          }}
        />
      )}

      {kitDialog && (
        <KitCompositionDialog
          kit={kitDialog}
          items={items}
          canEdit={canEdit}
          onClose={() => setKitDialog(null)}
        />
      )}

      {isAdmin && priceRuleOpen && (
        <PriceRuleDialog
          open={priceRuleOpen}
          categories={categories}
          onClose={() => setPriceRuleOpen(false)}
          onApplied={() => {
            void refresh();
            void refreshQuality();
          }}
        />
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "delete"
                ? `Excluir "${confirm.item.name}" definitivamente?`
                : confirm?.kind === "archive"
                  ? `Arquivar "${confirm.item.name}"?`
                  : `Reativar "${confirm?.item.name}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "delete"
                ? "A exclusão remove o produto e todas as variações. Esta ação não pode ser desfeita."
                : confirm?.kind === "archive"
                  ? "O produto deixa de aparecer no catálogo público até ser reativado."
                  : "O produto volta a ser exibido no catálogo."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmBusy}
              onClick={runConfirm}
              className={confirm?.kind === "delete" ? "bg-red-600 hover:bg-red-700" : undefined}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Row Actions (dropdown)
// ─────────────────────────────────────────────────────────────────────────────

function RowActions({
  item,
  canEdit,
  canDelete,
  onEdit,
  onDuplicate,
  onKit,
  onArchive,
  onRestore,
  onDelete,
}: {
  item: InventoryItem;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  /** Só existe quando o produto é um kit. */
  onKit?: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Ações para ${item.name}`}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit} disabled={!canEdit}>
          <Pencil className="h-4 w-4 mr-2" /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate} disabled={!canEdit}>
          <Copy className="h-4 w-4 mr-2" /> Duplicar
        </DropdownMenuItem>
        {onKit && (
          <DropdownMenuItem onClick={onKit}>
            <Boxes className="h-4 w-4 mr-2" /> Composição do kit
          </DropdownMenuItem>
        )}
        {item.active ? (
          <DropdownMenuItem onClick={onArchive} disabled={!canEdit}>
            <Archive className="h-4 w-4 mr-2" /> Arquivar
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onRestore} disabled={!canEdit}>
            <ArchiveRestore className="h-4 w-4 mr-2" /> Reativar
          </DropdownMenuItem>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProductFormDrawer — cria e edita produto + variações
// ─────────────────────────────────────────────────────────────────────────────

const INPUT =
  "h-11 w-full border border-[color:var(--border)] bg-white px-3 text-sm text-[color:var(--forest-deep)] focus:border-[color:var(--forest-deep)] focus:outline-none disabled:opacity-60";
const LABEL =
  "flex flex-col gap-1.5 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]";

interface DraftVariation {
  tamanho: string;
  quantidade: number;
}

function emptyDraft(): ProductWritePayload {
  return {
    sku: "",
    slug: "",
    nome: "",
    marca: "",
    categoria: "",
    cor: "",
    colecao: "",
    descricao: "",
    imagens: [],
    preco: 0,
    ativo: true,
    destaque: false,
    variacoes: [],
  };
}

function draftFromItem(i: InventoryItem): ProductWritePayload {
  return {
    sku: i.sku,
    slug: i.slug,
    nome: i.name,
    marca: i.brand,
    categoria: i.category,
    cor: i.color === "—" ? "" : i.color,
    colecao: i.collection ?? "",
    descricao: i.description ?? "",
    imagens: [...i.images],
    preco: i.price,
    ativo: i.active,
    destaque: i.featured,
    variacoes: i.stockBySize.map((s) => ({ tamanho: s.size, quantidade: s.quantity })),
  };
}

function slugify(v: string): string {
  return v
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function ProductFormDrawer({
  initial,
  onClose,
  onSubmit,
}: {
  initial?: InventoryItem;
  onClose: () => void;
  onSubmit: (payload: ProductWritePayload) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ProductWritePayload>(
    initial ? draftFromItem(initial) : emptyDraft(),
  );
  const [imageInput, setImageInput] = useState("");
  const [sizeInput, setSizeInput] = useState("");
  const [saving, setSaving] = useState(false);

  const patch = (p: Partial<ProductWritePayload>) => setDraft((d) => ({ ...d, ...p }));

  const addImage = () => {
    const url = imageInput.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      toast.error("URL de imagem inválida.");
      return;
    }
    if (draft.imagens.includes(url)) return;
    patch({ imagens: [...draft.imagens, url] });
    setImageInput("");
  };

  const removeImage = (url: string) => patch({ imagens: draft.imagens.filter((i) => i !== url) });

  const addVariation = () => {
    const t = sizeInput.trim().toUpperCase();
    if (!t) return;
    if (draft.variacoes.some((v) => v.tamanho === t)) {
      toast.info("Este tamanho já existe.");
      return;
    }
    patch({ variacoes: [...draft.variacoes, { tamanho: t, quantidade: 0 }] });
    setSizeInput("");
  };

  const updateVariation = (index: number, changes: Partial<DraftVariation>) =>
    patch({
      variacoes: draft.variacoes.map((v, i) => (i === index ? { ...v, ...changes } : v)),
    });

  const removeVariation = (index: number) =>
    patch({ variacoes: draft.variacoes.filter((_, i) => i !== index) });

  const errors: Record<string, string> = {};
  if (!draft.nome.trim()) errors.nome = "Obrigatório.";
  if (!draft.sku.trim()) errors.sku = "Obrigatório.";
  if (!draft.slug.trim()) errors.slug = "Obrigatório.";
  if (!draft.marca.trim()) errors.marca = "Obrigatório.";
  if (!draft.categoria.trim()) errors.categoria = "Obrigatório.";
  if (draft.preco < 0) errors.preco = "Não pode ser negativo.";
  if (draft.variacoes.length === 0) errors.variacoes = "Adicione ao menos um tamanho.";
  const hasErrors = Object.keys(errors).length > 0;

  const submit = async () => {
    if (hasErrors) {
      toast.error("Corrija os campos destacados.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        ...draft,
        cor: draft.cor?.trim() || null,
        colecao: draft.colecao?.trim() || null,
        descricao: draft.descricao?.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={initial ? "Editar produto" : "Novo produto"}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full w-full max-w-2xl flex-col bg-[color:var(--cream)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[color:var(--border)] p-5">
          <div>
            <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">Estoque</p>
            <h2 className="mt-1 font-display text-2xl text-[color:var(--forest-deep)]">
              {initial ? "Editar produto" : "Novo produto"}
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className={`${LABEL} md:col-span-2`}>
              Nome
              <input
                className={INPUT}
                value={draft.nome}
                onChange={(e) => {
                  const nome = e.target.value;
                  patch({ nome, slug: draft.slug || slugify(nome) });
                }}
                maxLength={200}
              />
              {errors.nome && <span className="text-[11px] text-red-600">{errors.nome}</span>}
            </label>
            <label className={LABEL}>
              SKU
              <input
                className={INPUT}
                value={draft.sku}
                onChange={(e) => patch({ sku: e.target.value.toUpperCase() })}
                maxLength={40}
              />
              {errors.sku && <span className="text-[11px] text-red-600">{errors.sku}</span>}
            </label>
            <label className={LABEL}>
              Slug
              <input
                className={INPUT}
                value={draft.slug}
                onChange={(e) => patch({ slug: slugify(e.target.value) })}
                onBlur={() => patch({ slug: slugify(draft.slug) })}
                maxLength={80}
              />
              {errors.slug && <span className="text-[11px] text-red-600">{errors.slug}</span>}
            </label>
            <label className={LABEL}>
              Marca
              <input
                className={INPUT}
                value={draft.marca}
                onChange={(e) => patch({ marca: e.target.value })}
                maxLength={80}
              />
              {errors.marca && <span className="text-[11px] text-red-600">{errors.marca}</span>}
            </label>
            <label className={LABEL}>
              Categoria
              <input
                className={INPUT}
                value={draft.categoria}
                onChange={(e) => patch({ categoria: e.target.value })}
                maxLength={80}
              />
              {errors.categoria && (
                <span className="text-[11px] text-red-600">{errors.categoria}</span>
              )}
            </label>
            <label className={LABEL}>
              Coleção
              <input
                className={INPUT}
                value={draft.colecao ?? ""}
                onChange={(e) => patch({ colecao: e.target.value })}
                maxLength={80}
              />
            </label>
            <label className={LABEL}>
              Cor
              <input
                className={INPUT}
                value={draft.cor ?? ""}
                onChange={(e) => patch({ cor: e.target.value })}
                maxLength={40}
              />
            </label>
            <label className={LABEL}>
              Preço (R$)
              <input
                type="number"
                min={0}
                step={1}
                className={INPUT}
                value={draft.preco}
                onChange={(e) => patch({ preco: Math.max(0, Number(e.target.value) || 0) })}
              />
              {errors.preco && <span className="text-[11px] text-red-600">{errors.preco}</span>}
            </label>
            <label className={`${LABEL} md:col-span-2`}>
              Descrição
              <textarea
                rows={3}
                className={INPUT + " h-auto py-2"}
                value={draft.descricao ?? ""}
                onChange={(e) => patch({ descricao: e.target.value })}
                maxLength={2000}
              />
            </label>

            <fieldset className="md:col-span-2">
              <legend className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                Imagens
              </legend>
              <p className="text-[11px] text-[color:var(--muted-foreground)]">
                Envie a foto do arquivo (JPG, PNG, WEBP ou AVIF · até 5 MB) ou cole uma URL
                existente.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {draft.imagens.map((url) => (
                  <div key={url} className="relative">
                    <img
                      src={url}
                      alt=""
                      className="h-20 w-16 border border-[color:var(--border)] object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      className="absolute -top-2 -right-2 rounded-full bg-white p-0.5 shadow"
                      aria-label="Remover imagem"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  className={INPUT}
                  placeholder="https://…"
                  value={imageInput}
                  onChange={(e) => setImageInput(e.target.value)}
                />
                <Button type="button" variant="outline" onClick={addImage}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>
              {imageInput.trim().startsWith("http") && (
                <div className="mt-2 flex items-center gap-3 border border-dashed border-[color:var(--border)] p-2">
                  <img
                    src={imageInput.trim()}
                    alt="Prévia"
                    className="h-20 w-16 border border-[color:var(--border)] object-cover"
                    onError={(ev) => {
                      (ev.currentTarget as HTMLImageElement).style.opacity = "0.2";
                    }}
                  />
                  <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                    Prévia · confirme antes de adicionar
                  </span>
                </div>
              )}
            </fieldset>

            <fieldset className="md:col-span-2">
              <legend className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                Tamanhos e estoque
              </legend>
              <ul className="mt-2 flex flex-col gap-2">
                {draft.variacoes.map((v, idx) => (
                  <li key={v.tamanho} className="grid grid-cols-[80px_1fr_auto] items-center gap-2">
                    <span className="text-sm font-medium tabular-nums">{v.tamanho}</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className={INPUT}
                      value={v.quantidade}
                      onChange={(e) =>
                        updateVariation(idx, {
                          quantidade: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVariation(idx)}
                      aria-label={`Remover ${v.tamanho}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <input
                  className={INPUT + " max-w-[120px]"}
                  placeholder="Tamanho"
                  value={sizeInput}
                  onChange={(e) => setSizeInput(e.target.value)}
                  maxLength={10}
                />
                <Button type="button" variant="outline" onClick={addVariation}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar tamanho
                </Button>
              </div>
              {errors.variacoes && (
                <p className="mt-2 text-[11px] text-red-600">{errors.variacoes}</p>
              )}
            </fieldset>

            <label className="flex items-center gap-2 text-sm text-[color:var(--forest-deep)]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[color:var(--forest-deep)]"
                checked={draft.ativo}
                onChange={(e) => patch({ ativo: e.target.checked })}
              />
              Ativo (visível na loja)
            </label>
            <label className="flex items-center gap-2 text-sm text-[color:var(--forest-deep)]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[color:var(--forest-deep)]"
                checked={draft.destaque}
                onChange={(e) => patch({ destaque: e.target.checked })}
              />
              Destaque
            </label>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[color:var(--border)] p-5">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || hasErrors}>
            {saving ? "Salvando…" : initial ? "Salvar alterações" : "Criar produto"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
