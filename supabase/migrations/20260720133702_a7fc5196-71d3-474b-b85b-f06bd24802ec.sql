
-- 1. Pedidos: unificar status legados e travar o conjunto canônico
UPDATE public.pedidos SET status = 'novo' WHERE status = 'pendente';

ALTER TABLE public.pedidos ALTER COLUMN status SET DEFAULT 'novo';

ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_status_check
  CHECK (status IN (
    'novo',
    'pagamento_confirmado',
    'separado',
    'reservado',
    'aguardando_retirada',
    'enviado',
    'finalizado',
    'cancelado'
  ));

ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_valor_total_check
  CHECK (valor_total > 0);

-- Atualiza a policy de anon insert para o status canônico "novo"
DROP POLICY IF EXISTS "Anon can insert pending orders" ON public.pedidos;
CREATE POLICY "Anon can insert new orders"
  ON public.pedidos
  FOR INSERT
  TO anon
  WITH CHECK (status = 'novo');

-- 2. Produtos: preço estritamente positivo
ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS produtos_preco_check;
ALTER TABLE public.produtos
  ADD CONSTRAINT produtos_preco_check
  CHECK (preco > 0);

-- 3. Índices adicionais de performance
CREATE INDEX IF NOT EXISTS idx_pedidos_criado_em ON public.pedidos (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_produto_movimentacoes_produto_criado
  ON public.produto_movimentacoes (produto_id, criado_em DESC);
