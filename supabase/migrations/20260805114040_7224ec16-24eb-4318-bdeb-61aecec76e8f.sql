ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS produtos_preco_check;
ALTER TABLE public.produtos ADD CONSTRAINT produtos_preco_check CHECK (preco >= 0);

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS preco_cartao numeric,
  ADD COLUMN IF NOT EXISTS parcelamento text,
  ADD COLUMN IF NOT EXISTS preco_status text NOT NULL DEFAULT 'confirmado',
  ADD COLUMN IF NOT EXISTS status_publicacao text NOT NULL DEFAULT 'publicado',
  ADD COLUMN IF NOT EXISTS observacoes_internas text,
  ADD COLUMN IF NOT EXISTS quantidade_conferida boolean NOT NULL DEFAULT true;

ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS produtos_preco_status_check;
ALTER TABLE public.produtos ADD CONSTRAINT produtos_preco_status_check
  CHECK (preco_status IN ('confirmado','a_confirmar'));

ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS produtos_status_publicacao_check;
ALTER TABLE public.produtos ADD CONSTRAINT produtos_status_publicacao_check
  CHECK (status_publicacao IN ('rascunho','revisao_pendente','pronto_conferencia','ativo_demonstracao','publicado'));

ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS produtos_preco_confirmado_check;
ALTER TABLE public.produtos ADD CONSTRAINT produtos_preco_confirmado_check
  CHECK (preco_status = 'a_confirmar' OR preco > 0);

ALTER TABLE public.produto_variacoes
  ADD COLUMN IF NOT EXISTS origem_tamanho text NOT NULL DEFAULT 'confirmado_etiqueta';

ALTER TABLE public.produto_variacoes DROP CONSTRAINT IF EXISTS produto_variacoes_origem_tamanho_check;
ALTER TABLE public.produto_variacoes ADD CONSTRAINT produto_variacoes_origem_tamanho_check
  CHECK (origem_tamanho IN ('confirmado_etiqueta','confirmado_medicao','estimativa_interna','a_confirmar'));