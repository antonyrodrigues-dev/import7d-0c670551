import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — 7D IMPORTS" },
      { name: "description", content: "Termos e condições para uso do acervo e finalização de reservas na 7D IMPORTS." },
      { property: "og:title", content: "Termos de Uso — 7D IMPORTS" },
      { property: "og:url", content: "/termos" },
    ],
    links: [{ rel: "canonical", href: "/termos" }],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <main className="min-h-screen bg-[color:var(--cream)] px-6 py-24 text-[color:var(--forest-deep)] md:px-12">
      <article className="mx-auto max-w-[780px]">
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">Documento legal</p>
        <h1 className="mt-4 font-display text-4xl md:text-5xl">Termos de Uso</h1>
        <p className="mt-4 font-display italic text-lg text-[color:var(--muted-foreground)]">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>

        <section className="mt-12 space-y-8 text-base leading-relaxed">
          <div>
            <h2 className="font-display text-2xl">1. Reserva</h2>
            <p className="mt-3 text-[color:var(--muted-foreground)]">
              Toda peça do acervo é numerada e única. A reserva é confirmada apenas após contato e
              acordo via WhatsApp com nossa equipe.
            </p>
          </div>
          <div>
            <h2 className="font-display text-2xl">2. Pagamento e entrega</h2>
            <p className="mt-3 text-[color:var(--muted-foreground)]">
              Formas de pagamento e prazo de entrega são acordados individualmente. Enviamos para
              todo o Brasil com rastreamento.
            </p>
          </div>
          <div>
            <h2 className="font-display text-2xl">3. Trocas e devoluções</h2>
            <p className="mt-3 text-[color:var(--muted-foreground)]">
              Conforme o Código de Defesa do Consumidor, você tem até 7 dias corridos após o
              recebimento para arrepender-se da compra. A peça deve retornar sem uso e com etiqueta.
            </p>
          </div>
          <div>
            <h2 className="font-display text-2xl">4. Disputas</h2>
            <p className="mt-3 text-[color:var(--muted-foreground)]">
              Estes termos são regidos pela lei brasileira. Qualquer disputa será resolvida no foro
              do consumidor.
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