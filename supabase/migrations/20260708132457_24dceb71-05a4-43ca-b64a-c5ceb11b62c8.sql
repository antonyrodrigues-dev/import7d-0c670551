-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABELA produtos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  marca TEXT NOT NULL,
  categoria TEXT NOT NULL,
  colecao TEXT,
  cor TEXT,
  descricao TEXT,
  imagens JSONB NOT NULL DEFAULT '[]'::jsonb,
  preco NUMERIC(10, 2) NOT NULL CHECK (preco >= 0),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  destaque BOOLEAN NOT NULL DEFAULT FALSE,
  arquivado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.produtos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos TO authenticated;
GRANT ALL ON public.produtos TO service_role;

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active products"
  ON public.produtos FOR SELECT
  TO anon
  USING (ativo = TRUE AND arquivado_em IS NULL);

CREATE POLICY "Staff can view all products"
  ON public.produtos FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'atendente'::app_role)
  );

CREATE POLICY "Staff can insert products"
  ON public.produtos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'atendente'::app_role)
  );

CREATE POLICY "Staff can update products"
  ON public.produtos FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'atendente'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'atendente'::app_role)
  );

CREATE POLICY "Only admin can delete products"
  ON public.produtos FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABELA produto_variacoes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.produto_variacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  tamanho TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (produto_id, tamanho)
);

CREATE INDEX idx_produto_variacoes_produto ON public.produto_variacoes(produto_id);

GRANT SELECT ON public.produto_variacoes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_variacoes TO authenticated;
GRANT ALL ON public.produto_variacoes TO service_role;

ALTER TABLE public.produto_variacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view variations of active products"
  ON public.produto_variacoes FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.produtos p
      WHERE p.id = produto_id AND p.ativo = TRUE AND p.arquivado_em IS NULL
    )
  );

CREATE POLICY "Staff can view all variations"
  ON public.produto_variacoes FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'atendente'::app_role)
  );

CREATE POLICY "Staff can insert variations"
  ON public.produto_variacoes FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'atendente'::app_role)
  );

CREATE POLICY "Staff can update variations"
  ON public.produto_variacoes FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'atendente'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'atendente'::app_role)
  );

CREATE POLICY "Only admin can delete variations"
  ON public.produto_variacoes FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TABELA produto_movimentacoes (auditoria de estoque)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.produto_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  tamanho TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste', 'reposicao', 'consumo_pedido')),
  quantidade INTEGER NOT NULL CHECK (quantidade <> 0),
  origem TEXT,
  pedido_id UUID,
  por_usuario UUID REFERENCES auth.users(id),
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_produto_movimentacoes_produto ON public.produto_movimentacoes(produto_id);
CREATE INDEX idx_produto_movimentacoes_pedido ON public.produto_movimentacoes(pedido_id);

GRANT SELECT, INSERT ON public.produto_movimentacoes TO authenticated;
GRANT ALL ON public.produto_movimentacoes TO service_role;

ALTER TABLE public.produto_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view stock movements"
  ON public.produto_movimentacoes FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'atendente'::app_role)
  );

CREATE POLICY "Staff can insert own stock movements"
  ON public.produto_movimentacoes FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'atendente'::app_role)
    )
    AND por_usuario = auth.uid()
  );

CREATE POLICY "Only admin can delete movements"
  ON public.produto_movimentacoes FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Trigger atualizado_em para produtos e variações
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_produtos_atualizado_em
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_atualizado_em();

CREATE TRIGGER trg_produto_variacoes_atualizado_em
  BEFORE UPDATE ON public.produto_variacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_atualizado_em();