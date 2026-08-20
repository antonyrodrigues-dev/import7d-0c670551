/**
 * Adapter — Configurações da loja (persistência oficial no banco).
 * A tabela `configuracoes_loja` guarda UM registro (`default`) legível por
 * qualquer visitante (vitrine/checkout) e gravável apenas pelo Admin Master,
 * via rotina auditada `salvar_configuracoes_loja`.
 */
import { supabase } from "@/integrations/supabase/client";

/** Lê o JSON bruto salvo. Retorna `null` quando ainda não há configuração. */
export async function fetchStoreSettingsRaw(): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("configuracoes_loja")
    .select("dados")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw error;
  const dados = data?.dados;
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return null;
  return dados as Record<string, unknown>;
}

/** Grava o JSON de configurações. O banco recusa quem não é Admin Master. */
export async function saveStoreSettingsRaw(dados: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.rpc("salvar_configuracoes_loja", {
    p_dados: dados as unknown as never,
  });
  if (error) throw error;
}
