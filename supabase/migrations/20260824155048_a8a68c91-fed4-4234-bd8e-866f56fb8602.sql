REVOKE ALL ON FUNCTION public.equipe_autorizada() FROM public, anon;
REVOKE ALL ON FUNCTION public.normalizar_telefone(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.equipe_autorizada() TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalizar_telefone(text) TO authenticated;