-- ── Fase 1.2 · Least privilege para o papel anônimo ────────────────────────
REVOKE ALL ON public.pedidos FROM anon;
REVOKE ALL ON public.pedido_eventos FROM anon;
REVOKE ALL ON public.pedido_pagamentos FROM anon;
REVOKE ALL ON public.pedido_devolucoes FROM anon;
REVOKE ALL ON public.pedido_devolucao_itens FROM anon;
REVOKE ALL ON public.pedido_status_historico FROM anon;
REVOKE ALL ON public.pedido_atendimentos FROM anon;
REVOKE ALL ON public.pedido_transicoes FROM anon;
REVOKE ALL ON public.reservas_estoque FROM anon;
REVOKE ALL ON public.produto_movimentacoes FROM anon;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.notificacoes FROM anon;
REVOKE ALL ON public.notificacao_leituras FROM anon;
REVOKE ALL ON public.job_execucoes FROM anon;
REVOKE ALL ON public.parametros_operacionais FROM anon;

-- Sobra apenas a vitrine curada.
GRANT SELECT ON public.catalogo_publico TO anon;

-- ── RPCs administrativas: fora do alcance do papel anônimo ─────────────────
REVOKE ALL ON FUNCTION public.ajustar_estoque(uuid, text, text, integer, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.transicionar_pedido(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.registrar_devolucao(uuid, jsonb, text, numeric, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.pedido_snapshot(public.pedidos) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.validar_checkout_key(text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.reserva_minutos() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notificar_pedido_evento() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notificar_pedido_novo() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.pedidos_guard_update() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.pedidos_log_status_create() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.pedidos_log_status_update() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.update_atualizado_em() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;

-- Checkout público permanece acessível (fluxo do cliente no site).
GRANT EXECUTE ON FUNCTION public.criar_pedido(jsonb, jsonb, jsonb, jsonb, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_pedido_checkout(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_whatsapp_checkout(uuid, text) TO anon, authenticated;

-- ── Correção real: equipe não conseguia ATUALIZAR variações via Data API ───
GRANT UPDATE ON public.produto_variacoes TO authenticated;

-- ── Políticas anônimas obsoletas (vitrine já é servida pela view) ──────────
DROP POLICY IF EXISTS "Public can view active products" ON public.produtos;
DROP POLICY IF EXISTS "Public can view variations of active products" ON public.produto_variacoes;
