REVOKE UPDATE, DELETE, INSERT ON public.pedidos FROM anon;
REVOKE UPDATE, DELETE, INSERT ON public.pedidos FROM authenticated;
GRANT SELECT ON public.pedidos TO authenticated;
GRANT ALL ON public.pedidos TO service_role;