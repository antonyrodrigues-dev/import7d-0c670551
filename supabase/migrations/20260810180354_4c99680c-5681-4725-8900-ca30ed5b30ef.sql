-- 1) ACL explícito e idempotente do checkout público
REVOKE ALL ON FUNCTION public.criar_pedido(jsonb,jsonb,jsonb,jsonb,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_pedido(jsonb,jsonb,jsonb,jsonb,text,text,text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.cancelar_pedido_checkout(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_pedido_checkout(uuid,text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.confirmar_whatsapp_checkout(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirmar_whatsapp_checkout(uuid,text) TO anon, authenticated, service_role;

-- 2) Expiração global de reservas: somente serviço interno
REVOKE ALL ON FUNCTION public.expirar_reservas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expirar_reservas() TO service_role;
REVOKE ALL ON FUNCTION public.job_expirar_reservas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_expirar_reservas() TO service_role;

-- 3) Numeração de pedidos: uso interno (chamada pelas RPCs SECURITY DEFINER)
REVOKE ALL ON FUNCTION public.gerar_numero_pedido() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_numero_pedido() TO service_role;

-- 4) Condições de devolução: 6 valores oficiais
ALTER TABLE public.pedido_devolucao_itens
  DROP CONSTRAINT IF EXISTS pedido_devolucao_itens_condicao_check;
ALTER TABLE public.pedido_devolucao_itens
  ADD CONSTRAINT pedido_devolucao_itens_condicao_check
  CHECK (condicao IN ('vendavel','usada','avariada','defeituosa','divergencia','outra'));