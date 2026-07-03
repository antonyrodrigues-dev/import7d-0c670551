import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — 7D IMPORTS" },
      {
        name: "description",
        content: "Como a 7D IMPORTS coleta, usa e protege seus dados pessoais.",
      },
      { property: "og:title", content: "Política de Privacidade — 7D IMPORTS" },
      { property: "og:url", content: "/privacidade" },
    ],
    links: [{ rel: "canonical", href: "/privacidade" }],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <main className="min-h-dvh bg-[color:var(--cream)] px-6 py-24 text-[color:var(--forest-deep)] md:px-12">
      <article className="mx-auto max-w-[780px]">
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">
          Documento legal
        </p>
        <h1 className="mt-4 font-display text-4xl md:text-5xl">Política de Privacidade</h1>
        <p className="mt-4 font-display italic text-lg text-[color:var(--muted-foreground)]">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>

        <section className="mt-12 space-y-8 text-base leading-relaxed">
          <div>
            <h2 className="font-display text-2xl">1. Quais dados coletamos</h2>
            <p className="mt-3 text-[color:var(--muted-foreground)]">
              Coletamos seu nome, telefone, CPF e endereço apenas no momento em que você finaliza
              uma reserva e nos envia esses dados pelo WhatsApp. Também armazenamos os itens
              reservados, o valor total e a data da reserva.
            </p>
          </div>
          <div>
            <h2 className="font-display text-2xl">2. Como usamos</h2>
            <p className="mt-3 text-[color:var(--muted-foreground)]">
              Os dados são usados exclusivamente para concretizar a venda, emitir nota fiscal e
              realizar a entrega. Não vendemos, alugamos nem compartilhamos seus dados com terceiros
              para fins de marketing.
            </p>
          </div>
          <div>
            <h2 className="font-display text-2xl">3. Seus direitos (LGPD)</h2>
            <p className="mt-3 text-[color:var(--muted-foreground)]">
              Você pode solicitar acesso, correção, portabilidade ou exclusão dos seus dados a
              qualquer momento, escrevendo para o nosso atendimento via WhatsApp.
            </p>
          </div>
          <div>
            <h2 className="font-display text-2xl">4. Retenção</h2>
            <p className="mt-3 text-[color:var(--muted-foreground)]">
              Os dados de pedidos são mantidos pelo prazo legal aplicável (até 5 anos para fins
              fiscais) e descartados em seguida.
            </p>
          </div>
        </section>

        <div className="mt-16">
          <Link
            to="/"
            className="inline-flex items-center border border-[color:var(--forest-deep)] px-8 py-4 text-[11px] tracking-luxe uppercase transition-colors hover:bg-[color:var(--forest-deep)] hover:text-[color:var(--cream)]"
          >
            Voltar ao acervo
          </Link>
        </div>
      </article>
    </main>
  );
}
