/**
 * Server functions do módulo Funcionários.
 *
 * Todas as operações verificam duas coisas dentro do handler:
 *   1. Sessão autenticada (via `requireSupabaseAuth`).
 *   2. O caller possui a role `admin` (`has_role`).
 *
 * Nenhuma dessas funções expõe o Auth Admin API para o cliente — a
 * abordagem escolhida no Sprint 7 é adicionar/remover roles de usuários
 * JÁ CADASTRADOS em auth.users (pelo próprio fluxo de login/registro).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const emailSchema = z.string().trim().toLowerCase().email().max(255);
const roleSchema = z.enum(["admin", "vendedor"]);
const uuidSchema = z.string().uuid();

/** UI role → DB app_role (o banco chama "atendente" o que a UI chama "vendedor"). */
function toDbRole(r: "admin" | "vendedor"): "admin" | "atendente" {
  return r === "admin" ? "admin" : "atendente";
}

async function ensureAdmin(context: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas Administrador Master pode executar esta ação.");
}

/** Adiciona ou promove um funcionário a partir do email de um usuário JÁ cadastrado. */
export const addEmployeeByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: emailSchema,
        role: roleSchema,
        nome: z.string().trim().max(120).optional(),
        telefone: z.string().trim().max(30).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Localiza o usuário no Auth pelo email (Auth Admin API).
    // listUsers pagina; para bases pequenas do MVP percorremos até encontrar.
    let userId: string | null = null;
    for (let page = 1; page <= 20 && !userId; page += 1) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      const match = list.users.find((u) => u.email?.toLowerCase() === data.email);
      if (match) userId = match.id;
      if (list.users.length < 200) break;
    }
    if (!userId) {
      throw new Error(
        "Nenhum usuário cadastrado com este email. Peça para a pessoa criar conta primeiro.",
      );
    }

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: toDbRole(data.role) }, { onConflict: "user_id,role" });
    if (roleErr) throw new Error(roleErr.message);

    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          nome: data.nome ?? "",
          telefone: data.telefone ?? "",
          status: "ativo",
        },
        { onConflict: "user_id" },
      );
    if (profErr) throw new Error(profErr.message);

    return { userId };
  });

export const updateEmployeeProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: uuidSchema,
        nome: z.string().trim().max(120),
        telefone: z.string().trim().max(30),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase
      .from("profiles")
      .update({ nome: data.nome, telefone: data.telefone })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const changeEmployeeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: uuidSchema, role: roleSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Estratégia: manter uma única role por usuário. Remove as demais e insere a nova.
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .neq("role", toDbRole(data.role));
    if (delErr) throw new Error(delErr.message);
    const { error: upErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.userId, role: toDbRole(data.role) }, { onConflict: "user_id,role" });
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

export const setEmployeeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: uuidSchema, status: z.enum(["ativo", "inativo"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    // Impede que o admin se desative sozinho.
    if (data.status === "inativo" && data.userId === context.userId) {
      throw new Error("Você não pode desativar o próprio acesso.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .upsert({ user_id: data.userId, status: data.status }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: uuidSchema }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("Você não pode remover o próprio acesso.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Preserva o usuário no Auth — remove apenas o vínculo com o painel.
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (rErr) throw new Error(rErr.message);
    // Marca o profile como inativo para trilha de auditoria.
    await supabaseAdmin
      .from("profiles")
      .update({ status: "inativo" })
      .eq("user_id", data.userId);
    return { ok: true };
  });