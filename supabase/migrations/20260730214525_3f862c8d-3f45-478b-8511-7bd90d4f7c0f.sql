-- Bloqueio de mutações diretas fora das RPCs protegidas (gate item 9).
REVOKE INSERT, UPDATE, DELETE ON public.produtos FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.produto_variacoes FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.produto_movimentacoes FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon;

-- Trilhas de auditoria: somente leitura para papéis de aplicação.
REVOKE INSERT, UPDATE, DELETE ON public.pedido_eventos FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.pedido_status_historico FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.pedido_transicoes FROM anon, authenticated;

-- Estoque nunca é escrito direto pelo cliente autenticado: passa por RPC.
REVOKE INSERT, UPDATE, DELETE ON public.produto_variacoes FROM authenticated;

GRANT ALL ON public.produtos TO service_role;
GRANT ALL ON public.produto_variacoes TO service_role;
GRANT ALL ON public.produto_movimentacoes TO service_role;
GRANT ALL ON public.pedido_eventos TO service_role;
GRANT ALL ON public.pedido_status_historico TO service_role;
GRANT ALL ON public.pedido_transicoes TO service_role;