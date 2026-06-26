
-- Fix search_path em gerar_numero_pedido
CREATE OR REPLACE FUNCTION public.gerar_numero_pedido()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT '7D-' || lpad(nextval('public.pedidos_numero_seq')::text, 4, '0')
$$;

-- Restringir execute das SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.gerar_numero_pedido() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gerar_numero_pedido() TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
