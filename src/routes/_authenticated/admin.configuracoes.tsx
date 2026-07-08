import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { EmptyState } from "@/features/admin/components/AdminUI";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/features/admin/stores/settings";
import { usePermissions } from "@/features/admin/hooks/usePermissions";
import type { AdminSettings } from "@/features/admin/types";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  head: () => ({
    meta: [{ title: "Configurações — 7D IMPORTS" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: ConfiguracoesPage,
});

const FIELDS: { key: keyof AdminSettings; label: string; type?: "textarea" | "number" }[] = [
  { key: "whatsapp", label: "WhatsApp (E.164 sem +)" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "email", label: "E-mail" },
  { key: "telefone", label: "Telefone" },
  { key: "endereco", label: "Endereço" },
  { key: "cep", label: "CEP" },
  { key: "cidade", label: "Cidade" },
  { key: "horarioFuncionamento", label: "Horário de funcionamento" },
  { key: "horarioRetirada", label: "Horário de retirada", type: "textarea" },
  { key: "parcelamentoMax", label: "Parcelamento máximo (x)", type: "number" },
  { key: "logoUrl", label: "Logo (URL)" },
  { key: "videoHeroUrl", label: "Vídeo Hero (URL)" },
  { key: "bannerHeroUrl", label: "Banner Hero (URL)" },
  { key: "textoHero", label: "Texto Hero", type: "textarea" },
  { key: "textoManifesto", label: "Texto Manifesto", type: "textarea" },
];

function ConfiguracoesPage() {
  const { settings, dirty, patch, reset } = useSettingsStore();
  const { can } = usePermissions();

  if (!can("settings:view")) {
    return (
      <>
        <PageHeader eyebrow="Painel" title="Configurações" />
        <EmptyState
          icon={<Lock className="h-5 w-5" />}
          title="Acesso restrito"
          description="Somente Administradores Master podem visualizar as configurações da loja."
        />
      </>
    );
  }

  const canEdit = can("settings:edit");
  const save = () => {
    toast.success("Configurações salvas.");
  };

  return (
    <>
      <PageHeader
        eyebrow="Painel"
        title="Configurações"
        description="Conteúdo operacional editável. Identidade visual (Hero, tipografia, cores) permanece intocada por design."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset} disabled={!dirty}>
              Restaurar padrão
            </Button>
            <Button onClick={save} disabled={!dirty || !canEdit}>
              Salvar
            </Button>
          </div>
        }
      />

      <form
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {FIELDS.map((f) => (
          <label key={String(f.key)} className={f.type === "textarea" ? "md:col-span-2 flex flex-col gap-1" : "flex flex-col gap-1"}>
            <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
              {f.label}
            </span>
            {f.type === "textarea" ? (
              <textarea
                rows={3}
                disabled={!canEdit}
                value={String(settings[f.key] ?? "")}
                onChange={(e) => patch({ [f.key]: e.target.value } as Partial<AdminSettings>)}
                className="border border-[color:var(--border)] bg-[color:var(--cream)] p-3 text-sm text-[color:var(--forest-deep)] focus:border-[color:var(--forest-deep)] focus:outline-none disabled:opacity-60"
              />
            ) : (
              <input
                type={f.type === "number" ? "number" : "text"}
                disabled={!canEdit}
                value={String(settings[f.key] ?? "")}
                onChange={(e) =>
                  patch({
                    [f.key]: f.type === "number" ? Number(e.target.value) || 0 : e.target.value,
                  } as Partial<AdminSettings>)
                }
                className="h-11 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm text-[color:var(--forest-deep)] focus:border-[color:var(--forest-deep)] focus:outline-none disabled:opacity-60"
              />
            )}
          </label>
        ))}
      </form>
    </>
  );
}