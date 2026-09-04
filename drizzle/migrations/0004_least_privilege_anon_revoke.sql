-- Least privilege: o papel anônimo não deve ter privilégio algum em tabelas
-- operacionais/administrativas. A RLS já bloqueia as linhas, mas o GRANT
-- residual é privilégio desnecessário. Somente leitura pública permanece
-- onde existe política pública explícita (configuracoes_loja).
REVOKE ALL ON public.financeiro_lancamentos FROM anon;
REVOKE ALL ON public.checkout_bloqueios FROM anon;
REVOKE ALL ON public.pagamento_transicoes FROM anon;
REVOKE ALL ON public.produto_kit_itens FROM anon;
REVOKE ALL ON public.regras_preco_aplicacoes FROM anon;
REVOKE ALL ON public.regras_preco_categoria FROM anon;

-- configuracoes_loja: leitura pública é intencional; escrita nunca.
REVOKE ALL ON public.configuracoes_loja FROM anon;
GRANT SELECT ON public.configuracoes_loja TO anon;
