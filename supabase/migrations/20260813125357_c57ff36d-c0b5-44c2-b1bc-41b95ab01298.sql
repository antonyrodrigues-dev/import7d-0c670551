REVOKE ALL ON FUNCTION public.registrar_devolucao(uuid, jsonb, text, numeric, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_devolucao(uuid, jsonb, text, numeric, text, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.notificar_pedido_evento() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notificar_pedido_novo() FROM PUBLIC;
