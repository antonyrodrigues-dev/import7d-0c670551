import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Hero } from "@/components/site/Hero";
import { Manifesto } from "@/components/site/Manifesto";
import { FeaturedSection, CatalogSection, DiferenciaisSection, AtendimentoSection } from "@/components/site/Sections";
import { Footer } from "@/components/site/Footer";
import { ReservaDrawer } from "@/components/site/ReservaDrawer";
import { SearchDrawer } from "@/components/site/SearchDrawer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "7D IMPORTS — Acervo privado de peças selecionadas" },
      { name: "description", content: "Curadoria premium de moda. Atendimento personalizado e entrega para todo o Brasil. Reserve via WhatsApp." },
      { name: "keywords", content: "moda premium, curadoria, peças selecionadas, importados, 7D Imports, reserva personalizada" },
      { property: "og:title", content: "7D IMPORTS — Acervo privado" },
      { property: "og:description", content: "Curadoria premium. Atendimento personalizado. Entrega para todo o Brasil." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: "/" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "7D IMPORTS",
          description: "Acervo privado de peças selecionadas",
          slogan: "Acesso a peças selecionadas",
        }),
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Manifesto />
        <FeaturedSection />
        <CatalogSection />
        <DiferenciaisSection />
        <AtendimentoSection />
      </main>
      <Footer />
      <ReservaDrawer />
      <SearchDrawer />
      <div className="grain-overlay" aria-hidden="true" />
    </>
  );
}
