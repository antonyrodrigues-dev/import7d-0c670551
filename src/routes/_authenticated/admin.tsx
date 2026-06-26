import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/data/products";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Pedidos — 7D IMPORTS" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

interface ItemPedido {
  slug: string;
  name: string;
  price: number;
  size: string;
  quantity: number;
  image?: string;
}

interface Pedido {
  id: string;
  numero_pedido: string;
  itens: ItemPedido[];
  valor_total: number;
  status: string;
  criado_em: string;
  atendente_nome: string | null;
}

const STATUSES = ["pendente", "confirmado", "cancelado"] as const;

function AdminPage() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("todos");
  const [forbidden, setForbidden] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pedidos")
      .select("id, numero_pedido, itens, valor_total, status, criado_em, atendente_nome")
      .order("criado_em", { ascending: false });
    if (error) {
      console.error(error);
      setForbidden(true);
    } else {
      setPedidos((data ?? []) as unknown as Pedido[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const atualizarStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("pedidos").update({ status }).eq("id", id);
    if (!error) {
      setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    }
  };

  const sair = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const visiveis = pedidos.filter((p) => filter === "todos" || p.status === filter);

  return (
    <main className="min-h-screen bg-[color:var(--cream)] px-6 py-16 text-[color:var(--forest-deep)] md:px-12">
      <div className="mx-auto max-w-[1280px]">
        <header className="flex flex-wrap items-end justify-between gap-6 border-b border-[color:var(--border)] pb-8">
          <div>
            <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">Painel</p>
            <h1 className="mt-3 font-display text-4xl md:text-5xl">Pedidos</h1>
          </div>
          <button
            onClick={sair}
            className="inline-flex h-11 items-center border border-[color:var(--forest-deep)] px-6 text-[11px] tracking-luxe uppercase transition-colors hover:bg-[color:var(--forest-deep)] hover:text-[color:var(--cream)]"
          >
            Sair
          </button>
        </header>

        {forbidden ? (
          <p className="mt-16 font-display italic text-lg text-[color:var(--muted-foreground)]">
            Sua conta não tem permissão para visualizar pedidos. Solicite ao administrador o papel
            de <span className="font-sans not-italic tracking-luxe uppercase text-[11px]">atendente</span>.
          </p>
        ) : (
          <>
            <nav className="mt-8 flex flex-wrap gap-2" aria-label="Filtro de status">
              {(["todos", ...STATUSES] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`h-10 border px-4 text-[11px] tracking-luxe uppercase transition-colors ${
                    filter === s
                      ? "border-[color:var(--forest-deep)] bg-[color:var(--forest-deep)] text-[color:var(--cream)]"
                      : "border-[color:var(--border)] text-[color:var(--forest-deep)] hover:border-[color:var(--forest-deep)]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </nav>

            {loading ? (
              <p className="mt-16 font-display italic text-lg text-[color:var(--muted-foreground)]">
                Carregando…
              </p>
            ) : visiveis.length === 0 ? (
              <p className="mt-16 font-display italic text-lg text-[color:var(--muted-foreground)]">
                Nenhum pedido neste filtro.
              </p>
            ) : (
              <ul className="mt-10 flex flex-col gap-6">
                {visiveis.map((p) => (
                  <li key={p.id} className="border border-[color:var(--border)] bg-[color:var(--cream)] p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-display text-2xl tabular-nums">{p.numero_pedido}</p>
                        <p className="mt-1 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                          {new Date(p.criado_em).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-2xl tabular-nums">{formatBRL(Number(p.valor_total))}</p>
                        <select
                          aria-label="Status do pedido"
                          value={p.status}
                          onChange={(e) => atualizarStatus(p.id, e.target.value)}
                          className="mt-2 h-10 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-[11px] tracking-luxe uppercase text-[color:var(--forest-deep)]"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <ul className="mt-5 divide-y divide-[color:var(--border)] border-t border-[color:var(--border)]">
                      {(Array.isArray(p.itens) ? p.itens : []).map((it, idx) => (
                        <li key={`${p.id}-${idx}`} className="flex items-center justify-between py-3 text-sm">
                          <span>{it.name} <span className="text-[color:var(--muted-foreground)]">· Tam. {it.size} · {it.quantity}x</span></span>
                          <span className="tabular-nums">{formatBRL(it.price * it.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}