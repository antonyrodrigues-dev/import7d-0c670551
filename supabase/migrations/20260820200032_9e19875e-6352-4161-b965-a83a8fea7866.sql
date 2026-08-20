ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_frete_status_check;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_frete_status_check
  CHECK (frete_status = ANY (ARRAY['pendente'::text, 'definido'::text, 'nao_aplica'::text]));