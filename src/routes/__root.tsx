import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { NetworkStatusWatcher } from "@/components/site/NetworkStatusWatcher";
import { supabase } from "@/integrations/supabase/client";
import { resetAdminSession } from "@/features/admin/lib/session";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[color:var(--cream)] px-6 text-[color:var(--forest-deep)]">
      <div className="max-w-md text-center">
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">Erro 404</p>
        <h1 className="mt-4 font-display text-5xl md:text-6xl">Página não encontrada</h1>
        <p className="mt-4 font-display italic text-lg text-[color:var(--muted-foreground)]">
          O endereço acessado não pertence ao acervo.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center border border-[color:var(--forest-deep)] px-8 py-4 text-[11px] tracking-luxe uppercase transition-colors duration-[350ms] hover:bg-[color:var(--forest-deep)] hover:text-[color:var(--cream)]"
          >
            Voltar ao acervo
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[color:var(--cream)] px-6 text-[color:var(--forest-deep)]">
      <div className="max-w-md text-center">
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">
          Algo interrompeu
        </p>
        <h1 className="mt-4 font-display text-4xl md:text-5xl">Esta página não carregou</h1>
        <p className="mt-4 font-display italic text-lg text-[color:var(--muted-foreground)]">
          Tente novamente em instantes ou retorne ao acervo.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center bg-[color:var(--forest-deep)] px-8 py-4 text-[11px] tracking-luxe uppercase text-[color:var(--cream)] transition-colors hover:bg-[color:var(--forest)]"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center border border-[color:var(--forest-deep)] px-8 py-4 text-[11px] tracking-luxe uppercase transition-colors hover:bg-[color:var(--forest-deep)] hover:text-[color:var(--cream)]"
          >
            Voltar ao acervo
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "7D IMPORTS" },
      { name: "description", content: "Acervo privado de peças selecionadas." },
      { name: "author", content: "7D IMPORTS" },
      { name: "theme-color", content: "#0f2823" },
      { property: "og:site_name", content: "7D IMPORTS" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "7D IMPORTS" },
      { name: "twitter:title", content: "7D IMPORTS" },
      { property: "og:description", content: "Acervo privado de peças selecionadas." },
      { name: "twitter:description", content: "Acervo privado de peças selecionadas." },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/ed82d8dc-96f6-4a91-9aa4-b91972e73cdd",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/ed82d8dc-96f6-4a91-9aa4-b91972e73cdd",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Assinante ÚNICO de mudanças de identidade. Nenhuma outra tela pode
 * assinar auth: aqui garantimos que sair da conta derruba Realtime, zera
 * stores e limpa o cache antes de qualquer refetch.
 */
function useAuthLifecycle(queryClient: QueryClient) {
  const router = useRouter();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (event === "SIGNED_OUT") {
        resetAdminSession(queryClient);
        void router.invalidate();
        return;
      }
      void router.invalidate();
      void queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient, router]);
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useAuthLifecycle(queryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <NetworkStatusWatcher />
      <Toaster />
    </QueryClientProvider>
  );
}
