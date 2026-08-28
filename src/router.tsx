import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { guardClientEnv } from "./lib/env-guard";

export const getRouter = () => {
  // Falha cedo se o build recebeu chave secreta no lugar da publicável.
  guardClientEnv();
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
