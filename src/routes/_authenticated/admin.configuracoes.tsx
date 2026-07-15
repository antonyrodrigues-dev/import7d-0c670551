import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Lock, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { EmptyState } from "@/features/admin/components/AdminUI";
import { Button } from "@/components/ui/button";
import { useAdminSettings } from "@/features/admin/hooks";
import { usePermissions } from "@/features/admin/hooks/usePermissions";
import type { AdminSettings, Weekday } from "@/features/admin/types";
import {
  digitsOnly,
  formatCEP,
  formatPhoneBR,
  isValidCEP,
  isValidEmail,
  isValidInstagram,
  isValidPhoneBR,
  sanitizeCEP,
  sanitizeFacebook,
  sanitizeInstagram,
  sanitizePhoneBR,
  capitalizeName,
} from "@/lib/masks";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — 7D IMPORTS" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ConfiguracoesPage,
});

const WEEKDAY_LABEL: Record<Weekday, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};

// ─────────────────────────────────────────────────────────────────────────────
// UI primitives — locais para manter consistência visual sem inflar shadcn.
// ─────────────────────────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-[color:var(--border)] bg-[color:var(--cream)]">
      <header className="border-b border-[color:var(--border)] p-5">
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">Configuração</p>
        <h2 className="mt-1 font-display text-xl text-[color:var(--forest-deep)]">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{description}</p>
        )}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
        {label}
      </span>
      {children}
      {error ? (
        <span className="text-[11px] text-red-600">{error}</span>
      ) : hint ? (
        <span className="text-[11px] text-[color:var(--muted-foreground)]">{hint}</span>
      ) : null}
    </label>
  );
}

const INPUT_CLASS =
  "h-11 border border-[color:var(--border)] bg-white px-3 text-sm text-[color:var(--forest-deep)] focus:border-[color:var(--forest-deep)] focus:outline-none disabled:opacity-60";

// ─────────────────────────────────────────────────────────────────────────────

function ConfiguracoesPage() {
  const { settings, dirty, patch, reset, commit } = useAdminSettings();
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

  // Validação por campo — reflete no botão Salvar e nas mensagens inline.
  const errors = useMemo(() => validate(settings), [settings]);
  const hasErrors = Object.values(errors).some(Boolean);

  const save = () => {
    if (hasErrors) {
      toast.error("Corrija os campos destacados antes de salvar.");
      return;
    }
    commit();
    toast.success("Configurações salvas.");
  };

  return (
    <>
      <PageHeader
        eyebrow="Painel"
        title="Configurações"
        description="Centro operacional da loja. Identidade visual (Hero, tipografia, cores) permanece intocada por design."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset} disabled={!dirty}>
              Restaurar padrão
            </Button>
            <Button onClick={save} disabled={!dirty || !canEdit || hasErrors}>
              Salvar
            </Button>
          </div>
        }
      />

      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <ContactSection settings={settings} errors={errors} patch={patch} disabled={!canEdit} />
        <AddressSection settings={settings} errors={errors} patch={patch} disabled={!canEdit} />
        <BusinessHoursSection settings={settings} patch={patch} disabled={!canEdit} />
        <PickupSlotsSection settings={settings} patch={patch} disabled={!canEdit} />
        <InstallmentsSection settings={settings} errors={errors} patch={patch} disabled={!canEdit} />
      </form>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Validação
// ─────────────────────────────────────────────────────────────────────────────

type Errors = Partial<Record<keyof AdminSettings, string>>;

function validate(s: AdminSettings): Errors {
  const e: Errors = {};
  if (s.whatsapp && !isValidPhoneBR(s.whatsapp))
    e.whatsapp = "Formato inválido. Use DDD + número (11 dígitos).";
  if (s.telefone && !isValidPhoneBR(s.telefone))
    e.telefone = "Formato inválido. Use DDD + número.";
  if (s.cep && !isValidCEP(s.cep)) e.cep = "CEP deve ter 8 dígitos.";
  if (s.email && !isValidEmail(s.email)) e.email = "E-mail inválido.";
  if (s.instagram && !isValidInstagram(s.instagram))
    e.instagram = "Handle inválido. Use @usuario ou a URL completa.";
  if (s.parcelamentoMax < 1 || s.parcelamentoMax > 12)
    e.parcelamentoMax = "Entre 1 e 12 parcelas.";
  if (s.parcelaMinima < 0) e.parcelaMinima = "Não pode ser negativo.";
  return e;
}

// ─────────────────────────────────────────────────────────────────────────────
// Seções
// ─────────────────────────────────────────────────────────────────────────────

interface SectionProps {
  settings: AdminSettings;
  errors: Errors;
  patch: (partial: Partial<AdminSettings>) => void;
  disabled: boolean;
}

function ContactSection({ settings, errors, patch, disabled }: SectionProps) {
  return (
    <Section title="Contato" description="Canais oficiais divulgados no site e usados no checkout.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="WhatsApp" hint="+55 (DDD) 9NNNN-NNNN" error={errors.whatsapp}>
          <input
            className={INPUT_CLASS}
            disabled={disabled}
            inputMode="tel"
            value={formatPhoneBR(settings.whatsapp)}
            onChange={(e) => patch({ whatsapp: sanitizePhoneBR(e.target.value) })}
            maxLength={20}
          />
        </Field>
        <Field label="Telefone" hint="Opcional" error={errors.telefone}>
          <input
            className={INPUT_CLASS}
            disabled={disabled}
            inputMode="tel"
            value={formatPhoneBR(settings.telefone)}
            onChange={(e) => patch({ telefone: sanitizePhoneBR(e.target.value) })}
            maxLength={20}
          />
        </Field>
        <Field label="E-mail" error={errors.email}>
          <input
            className={INPUT_CLASS}
            disabled={disabled}
            type="email"
            inputMode="email"
            value={settings.email}
            onChange={(e) => patch({ email: e.target.value.trim() })}
            maxLength={254}
          />
        </Field>
        <Field label="Instagram" hint="@usuario ou link completo" error={errors.instagram}>
          <input
            className={INPUT_CLASS}
            disabled={disabled}
            value={settings.instagram}
            onChange={(e) => patch({ instagram: e.target.value })}
            onBlur={(e) => patch({ instagram: sanitizeInstagram(e.target.value) })}
            maxLength={100}
          />
        </Field>
        <Field label="Facebook" hint="@pagina ou link completo" className="md:col-span-2">
          <input
            className={INPUT_CLASS}
            disabled={disabled}
            value={settings.facebook}
            onChange={(e) => patch({ facebook: e.target.value })}
            onBlur={(e) => patch({ facebook: sanitizeFacebook(e.target.value) })}
            maxLength={100}
          />
        </Field>
      </div>
    </Section>
  );
}

function AddressSection({ settings, errors, patch, disabled }: SectionProps) {
  return (
    <Section title="Endereço" description="Onde a loja funciona fisicamente.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_180px_1fr]">
        <Field label="Endereço" className="md:col-span-1">
          <input
            className={INPUT_CLASS}
            disabled={disabled}
            value={settings.endereco}
            onChange={(e) => patch({ endereco: e.target.value })}
            maxLength={200}
          />
        </Field>
        <Field label="CEP" hint="99999-999" error={errors.cep}>
          <input
            className={INPUT_CLASS}
            disabled={disabled}
            inputMode="numeric"
            value={formatCEP(settings.cep)}
            onChange={(e) => patch({ cep: sanitizeCEP(e.target.value) })}
            maxLength={9}
          />
        </Field>
        <Field label="Cidade">
          <input
            className={INPUT_CLASS}
            disabled={disabled}
            value={settings.cidade}
            onChange={(e) => patch({ cidade: e.target.value })}
            onBlur={(e) => patch({ cidade: capitalizeName(e.target.value) })}
            maxLength={80}
          />
        </Field>
      </div>
    </Section>
  );
}

function BusinessHoursSection({
  settings,
  patch,
  disabled,
}: {
  settings: AdminSettings;
  patch: SectionProps["patch"];
  disabled: boolean;
}) {
  const update = (weekday: Weekday, changes: Partial<AdminSettings["businessHours"][number]>) => {
    patch({
      businessHours: settings.businessHours.map((h) =>
        h.weekday === weekday ? { ...h, ...changes } : h,
      ),
    });
  };

  return (
    <Section
      title="Horário de funcionamento"
      description="Alimenta o Checkout — dias fechados são bloqueados automaticamente para retirada."
    >
      <ul className="flex flex-col divide-y divide-[color:var(--border)] border border-[color:var(--border)]">
        {settings.businessHours.map((h) => (
          <li
            key={h.weekday}
            className="grid grid-cols-[100px_1fr] items-center gap-3 p-3 sm:grid-cols-[140px_100px_1fr_1fr]"
          >
            <span className="text-sm font-medium text-[color:var(--forest-deep)]">
              {WEEKDAY_LABEL[h.weekday as Weekday]}
            </span>
            <label className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[color:var(--forest-deep)]"
                disabled={disabled}
                checked={h.open}
                onChange={(e) => update(h.weekday as Weekday, { open: e.target.checked })}
              />
              {h.open ? "Aberto" : "Fechado"}
            </label>
            <input
              type="time"
              className={INPUT_CLASS + " col-span-2 sm:col-span-1"}
              disabled={disabled || !h.open}
              value={h.from}
              onChange={(e) => update(h.weekday as Weekday, { from: e.target.value })}
            />
            <input
              type="time"
              className={INPUT_CLASS + " col-span-2 sm:col-span-1"}
              disabled={disabled || !h.open}
              value={h.to}
              onChange={(e) => update(h.weekday as Weekday, { to: e.target.value })}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function PickupSlotsSection({
  settings,
  patch,
  disabled,
}: {
  settings: AdminSettings;
  patch: SectionProps["patch"];
  disabled: boolean;
}) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const openWeekdays = new Set(settings.businessHours.filter((h) => h.open).map((h) => h.weekday));

  const addSlot = (weekday: Weekday) => {
    const raw = drafts[weekday] ?? "";
    if (!/^\d{2}:\d{2}$/.test(raw)) {
      toast.error("Informe o horário no formato HH:MM.");
      return;
    }
    const business = settings.businessHours.find((h) => h.weekday === weekday);
    if (business && business.open && (raw < business.from || raw > business.to)) {
      toast.error(
        `Horário fora do funcionamento (${business.from}–${business.to}).`,
      );
      return;
    }
    const day = settings.pickupSlots.find((d) => d.weekday === weekday);
    if (day?.slots.includes(raw)) {
      toast.info("Este horário já existe.");
      return;
    }
    patch({
      pickupSlots: settings.pickupSlots.map((d) =>
        d.weekday === weekday ? { ...d, slots: [...d.slots, raw].sort() } : d,
      ),
    });
    setDrafts((s) => ({ ...s, [weekday]: "" }));
  };

  const removeSlot = (weekday: Weekday, slot: string) => {
    patch({
      pickupSlots: settings.pickupSlots.map((d) =>
        d.weekday === weekday ? { ...d, slots: d.slots.filter((s) => s !== slot) } : d,
      ),
    });
  };

  return (
    <Section
      title="Horários de retirada"
      description="Janelas oferecidas ao cliente no Checkout. Só dias abertos aparecem."
    >
      <ul className="flex flex-col gap-3">
        {settings.pickupSlots.map((d) => {
          const isOpen = openWeekdays.has(d.weekday);
          return (
            <li
              key={d.weekday}
              className={`border border-[color:var(--border)] p-3 ${!isOpen ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-[color:var(--forest-deep)]">
                  {WEEKDAY_LABEL[d.weekday as Weekday]}
                </span>
                {!isOpen && (
                  <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                    Loja fechada
                  </span>
                )}
              </div>
              {isOpen && (
                <>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {d.slots.length === 0 && (
                      <span className="text-[11px] text-[color:var(--muted-foreground)]">
                        Nenhum horário cadastrado.
                      </span>
                    )}
                    {d.slots.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-2 border border-[color:var(--border)] bg-white px-2 py-1 text-xs tabular-nums"
                      >
                        {s}
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => removeSlot(d.weekday as Weekday, s)}
                          className="text-[color:var(--muted-foreground)] hover:text-red-600 disabled:opacity-40"
                          aria-label={`Remover ${s}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="time"
                      className={INPUT_CLASS + " max-w-[160px]"}
                      disabled={disabled}
                      value={drafts[d.weekday] ?? ""}
                      onChange={(e) =>
                        setDrafts((s) => ({ ...s, [d.weekday]: e.target.value }))
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => addSlot(d.weekday as Weekday)}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Adicionar
                    </Button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function InstallmentsSection({ settings, errors, patch, disabled }: SectionProps) {
  return (
    <Section title="Parcelamento" description="Regras aplicadas no Checkout.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Número máximo de parcelas" hint="1 a 12" error={errors.parcelamentoMax}>
          <input
            className={INPUT_CLASS}
            disabled={disabled}
            type="number"
            min={1}
            max={12}
            value={settings.parcelamentoMax}
            onChange={(e) =>
              patch({
                parcelamentoMax: Math.min(
                  12,
                  Math.max(1, Number(digitsOnly(e.target.value) || 1)),
                ),
              })
            }
          />
        </Field>
        <Field label="Valor mínimo por parcela (R$)" error={errors.parcelaMinima}>
          <input
            className={INPUT_CLASS}
            disabled={disabled}
            type="number"
            min={0}
            step={1}
            value={settings.parcelaMinima}
            onChange={(e) => patch({ parcelaMinima: Math.max(0, Number(e.target.value) || 0) })}
          />
        </Field>
      </div>
    </Section>
  );
}