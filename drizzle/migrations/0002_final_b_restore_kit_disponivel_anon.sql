-- FINAL-B — a view pública `catalogo_publico` depende de kit_disponivel para
-- calcular saldo de kits; anon precisa de EXECUTE (função somente leitura).
GRANT EXECUTE ON FUNCTION public.kit_disponivel(uuid, text) TO anon;
