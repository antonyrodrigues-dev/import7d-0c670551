import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Trash2,
  ExternalLink,
  ArrowLeft,
  ArrowRight,
  Check,
  Store,
  Truck,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useReserva } from "@/store/reserva";
import { useCheckout, type CheckoutStep, type PendingOrder } from "@/store/checkout";
import { formatBRL } from "@/features/catalog";
import { buildReservaMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { buildOrder, type OrderPickup } from "@/lib/order";
import {
  getUpcomingPickupSlots,
  formatPickupSlot,
  resolvePickupConfigFromSettings,
  type PickupDay,
} from "@/lib/pickup";
import { useSettingsStore } from "@/features/admin/stores/settings";
import { validateStep, validateOrder } from "@/lib/validation";
import { track } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import {
  calculateFreight,
  DELIVERY_LABEL,
  formatCEP,
  formatCPF,
  formatPhone,
  lookupCEP,
  PAYMENT_LABEL,
  type Address,
  type Customer,
  type DeliveryMethod,
  type Freight,
  type PaymentMethod,
} from "@/lib/checkout";
import {
  getInstallmentOption,
  getInstallmentOptions,
  resolveInstallmentsConfig,
  type InstallmentConfig,
} from "@/lib/installments";

type Step = CheckoutStep;

type CheckoutFlowState =
  | "idle"
  | "creating"
  | "created_pending_whatsapp"
  | "reopening_whatsapp"
  | "confirming_sent"
  | "cancelling"
  | "completed"
  | "error";

const STEPS: { key: Step; label: string }[] = [
  { key: 0, label: "Reserva" },
  { key: 1, label: "Entrega" },
  { key: 2, label: "Dados" },
  { key: 3, label: "Pagamento" },
  { key: 4, label: "Revisão" },
];

export function ReservaDrawer() {
  const { open, items, setOpen, removeItem, updateQty, clear } = useReserva();
  const {
    step,
    delivery,
    address,
    customer,
    payment,
    installments,
    pickup,
    setStep,
    setDelivery,
    setAddress,
    setCustomer,
    setPayment,
    setInstallments,
    setPickup,
    idempotencyKey,
    pendingOrder,
    ensureIdempotencyKey,
    clearIdempotencyKey,
    setPendingOrder,
    reset: resetCheckout,
  } = useCheckout();

  const subtotal = items.reduce((a, i) => a + i.price * i.quantity, 0);

  const [freight, setFreight] = useState<Freight>({ cost: null, label: "A combinar" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [flowState, setFlowState] = useState<CheckoutFlowState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{ numero: string } | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const submittingRef = useRef(false);
  const actionRef = useRef(false);

  const baseTotal = subtotal + (freight.cost ?? 0);
  const adminSettings = useSettingsStore((s) => s.settings);
  const installmentsConfig = useMemo(
    () =>
      resolveInstallmentsConfig(
        adminSettings.parcelamentoMax,
        adminSettings.parcelaMinima,
        baseTotal,
      ),
    [adminSettings.parcelamentoMax, adminSettings.parcelaMinima, baseTotal],
  );

  // Se a configuração cortar o máximo abaixo do parcelamento selecionado, ajusta.
  useEffect(() => {
    if (payment === "credito" && installments > installmentsConfig.maxInstallments) {
      setInstallments(installmentsConfig.maxInstallments);
    }
  }, [payment, installments, installmentsConfig.maxInstallments, setInstallments]);

  const installmentInfo = useMemo(
    () =>
      payment === "credito"
        ? getInstallmentOption(baseTotal, installments, installmentsConfig)
        : null,
    [payment, baseTotal, installments, installmentsConfig],
  );
  const total = installmentInfo ? installmentInfo.total : baseTotal;

  // body scroll lock + esc
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  // reset transient state when closed
  useEffect(() => {
    if (!open) {
      setErrors({});
      setCancelConfirmOpen(false);
    }
  }, [open]);

  // if cart empties, snap back to step 0
  useEffect(() => {
    if (items.length === 0 && !pendingOrder) {
      setStep(0);
    }
  }, [items.length, pendingOrder, setStep]);

  useEffect(() => {
    if (pendingOrder && (flowState === "idle" || flowState === "completed")) {
      setFlowState("created_pending_whatsapp");
      setCompletedOrder(null);
      setErrorMessage(null);
      setCancelConfirmOpen(false);
    }
  }, [flowState, pendingOrder]);

  // recompute freight when address/delivery change
  useEffect(() => {
    let cancelled = false;
    if (delivery !== "entrega") {
      setFreight({ cost: null, label: "Retirada na loja" });
      return;
    }
    const r = validateStep(1, { items, delivery, address, pickup, customer, payment, installments });
    if (!r.ok) {
      setFreight({ cost: null, label: "Preencha o endereço" });
      return;
    }
    calculateFreight(address).then((f) => {
      if (!cancelled) setFreight(f);
    });
    return () => {
      cancelled = true;
    };
  }, [delivery, address, items, pickup, customer, payment, installments]);

  const snapshot = { items, delivery, address, pickup, customer, payment, installments };

  const runStepValidation = (): boolean => {
    const r = validateStep(step, snapshot);
    setErrors(r.errors);
    return r.ok;
  };

  const goNext = () => {
    if (!runStepValidation()) {
      toast.error("Preencha os campos obrigatórios para continuar.");
      return;
    }
    const next = Math.min(4, (step as number) + 1) as Step;
    setStep(next);
    track({ name: "checkout_step", step: next });
  };
  const goBack = () => setStep(Math.max(0, (step as number) - 1) as Step);

  const isBusy =
    flowState === "creating" ||
    flowState === "reopening_whatsapp" ||
    flowState === "confirming_sent" ||
    flowState === "cancelling";

  const currentPendingSummary = useMemo(() => {
    if (!pendingOrder) return null;
    return (
      pendingOrder.summary ?? {
        itens: items,
        subtotalOficial: subtotal,
        entrega: delivery,
        endereco: delivery === "entrega" ? address : undefined,
        retirada: delivery === "retirada" ? pickup : null,
        freteLabel: delivery === "entrega" ? "A combinar" : "Retirada na loja",
        pagamento: payment,
        parcelas: payment === "credito" ? installments : 1,
      }
    );
  }, [address, delivery, installments, items, payment, pendingOrder, pickup, subtotal]);

  const openWhatsApp = (url: string): boolean => {
    if (typeof window === "undefined") return false;
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    return Boolean(opened);
  };

  /**
   * Sprint 4 · Onda 1
   *
   * Fluxo corrigido:
   *  1. Bloqueia clique duplo (ref + submitting) e gera/recupera `idempotencyKey`.
   *  2. AGUARDA a RPC `criar_pedido` — sem `void` e sem race.
   *  3. Só monta a URL do WhatsApp com o `numero_pedido` OFICIAL do servidor.
   *  4. Persiste `pendingOrder` (id/número/URL) e mostra CTA "Já enviei/Reenviar".
   *  5. Em qualquer falha: mantém carrinho, checkout, campos e chave —
   *     nada é limpo até ação explícita "Já enviei" ou "Cancelar solicitação".
   */
  const finalizar = async () => {
    if (items.length === 0 || submittingRef.current) return;
    setFlowState("creating");
    setErrorMessage(null);
    // Validação única antes de gerar o pedido.
    const check = validateOrder(snapshot);
    if (!check.ok) {
      setErrors(check.errors);
      toast.error("Revise as etapas do pedido antes de finalizar.");
      // Navegar para a primeira etapa incompleta.
      const missing = check.missing[0];
      if (missing === "items") setStep(0);
      else if (missing === "address" || missing === "pickup") setStep(1);
      else if (missing === "customer") setStep(2);
      else if (missing === "payment" || missing === "installments") setStep(3);
      return;
    }
    submittingRef.current = true;
    // Objeto local (usado só para mensagem/telemetria). O backend é a fonte
    // canônica: preços, total e numero_pedido virão de lá.
    const localOrder = buildOrder({
      items,
      customer,
      delivery,
      address: delivery === "entrega" ? address : undefined,
      freight,
      pickup: delivery === "retirada" ? pickup ?? undefined : undefined,
      payment,
      installments,
    });

    // Uma chave por tentativa — persistida. Repetir o clique reutiliza a mesma
    // e o servidor devolve o pedido já criado (idempotência real).
    const key = ensureIdempotencyKey();

    try {
      const itensPayload = localOrder.itens.map((it) => ({
        slug: it.slug,
        name: it.name,
        size: it.size,
        quantity: it.quantity,
        image: it.image,
      }));
      const entregaPayload = {
        metodo: localOrder.entrega.metodo,
        endereco: localOrder.entrega.endereco ?? null,
        retirada: localOrder.entrega.retirada ?? null,
        // Frete é sempre "pendente" no MVP; servidor ignora custo enviado pelo cliente.
      };
      const pagamentoPayload = {
        metodo: localOrder.pagamento.metodo,
        parcelas: localOrder.pagamento.parcelas,
      };

      const { data, error } = await supabase.rpc("criar_pedido", {
        p_itens: itensPayload as never,
        p_cliente: localOrder.cliente as never,
        p_entrega: entregaPayload as never,
        p_pagamento: pagamentoPayload as never,
        p_observacoes: localOrder.cliente.observacoes || undefined,
        p_canal: "whatsapp",
        p_idempotency_key: key,
      });

      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : null;
      if (!row?.numero_pedido || !row?.id) {
        throw new Error("Resposta inválida do servidor.");
      }

      // Monta a mensagem/URL SOMENTE após confirmação do banco, com o número oficial.
      const officialOrder = {
        ...localOrder,
        numero: row.numero_pedido as string,
        totais: {
          ...localOrder.totais,
          total: Number(row.valor_total) || localOrder.totais.total,
        },
      };
      const preview = buildReservaMessage(officialOrder);
      if (!preview || preview.length < 20) throw new Error("Mensagem inválida.");
      const url = buildWhatsAppUrl(officialOrder);
      const officialSubtotal = Number(row.valor_total) || officialOrder.totais.subtotal;

      setPendingOrder({
        id: row.id as string,
        numero: row.numero_pedido as string,
        url,
        criadoEm: officialOrder.criadoEm,
        idempotencyKey: key,
        summary: {
          itens: officialOrder.itens.map((item) => ({ ...item })),
          subtotalOficial: officialSubtotal,
          entrega: officialOrder.entrega.metodo,
          endereco: officialOrder.entrega.endereco,
          retirada: officialOrder.entrega.retirada ?? null,
          freteLabel:
            officialOrder.entrega.metodo === "entrega"
              ? officialOrder.entrega.frete.cost != null
                ? formatBRL(officialOrder.entrega.frete.cost)
                : "A combinar"
              : "Retirada na loja",
          pagamento: officialOrder.pagamento.metodo,
          parcelas: officialOrder.pagamento.parcelas,
        },
      });
      setFlowState("created_pending_whatsapp");
      setCancelConfirmOpen(false);

      track({
        name: "checkout_whatsapp",
        total: officialOrder.totais.total,
        items: officialOrder.itens.reduce((a, i) => a + i.quantity, 0),
      });

      // Tenta abrir automaticamente; abrir o WhatsApp NÃO é prova de envio —
      // o CTA "Já enviei" continua sendo obrigatório na próxima interação.
      const opened = openWhatsApp(url);
      if (!opened) {
        toast.error("O WhatsApp não abriu automaticamente", {
          description: "O pedido foi criado. Use Reenviar mensagem para abrir novamente.",
        });
      }
      toast.success(`Pedido ${row.numero_pedido} criado`, {
        description: "Envie a mensagem no WhatsApp para concluir a solicitação.",
      });
    } catch (err) {
      // Falha: mantém carrinho, checkout, campos e a chave — para a próxima
      // tentativa reutilizar a mesma e não duplicar o pedido no servidor.
      const msg = (err as Error)?.message ?? "Falha ao registrar pedido.";
      setFlowState("error");
      setErrorMessage(msg);
      toast.error("Não foi possível registrar o pedido", {
        description: `${msg} Tente novamente.`,
      });
    } finally {
      submittingRef.current = false;
    }
  };

  /** CTAs do estado pós-criação (pedido registrado, aguardando envio). */
  const marcarEnviado = async () => {
    if (!pendingOrder || actionRef.current) return;
    actionRef.current = true;
    setFlowState("confirming_sent");
    setErrorMessage(null);
    const numero = pendingOrder.numero;
    await Promise.resolve();
    setPendingOrder(null);
    clearIdempotencyKey();
    clear();
    resetCheckout();
    setCompletedOrder({ numero });
    setFlowState("completed");
    actionRef.current = false;
    toast.success(`Pedido ${numero} sinalizado como enviado`, {
      description: "Confirmação registrada a partir da sua declaração.",
    });
  };
  const reenviarWhats = async () => {
    if (!pendingOrder || actionRef.current) return;
    actionRef.current = true;
    setFlowState("reopening_whatsapp");
    setErrorMessage(null);
    await Promise.resolve();
    const opened = openWhatsApp(pendingOrder.url);
    if (!opened) {
      setErrorMessage("O navegador bloqueou a abertura do WhatsApp. Tente novamente pelo botão.");
      toast.error("WhatsApp bloqueado pelo navegador", {
        description: "O pedido continua salvo e pode ser reenviado.",
      });
    } else {
      toast.success(`Mensagem do pedido ${pendingOrder.numero} reaberta`);
    }
    setFlowState("created_pending_whatsapp");
    actionRef.current = false;
  };
  const revisarDados = () => {
    if (!pendingOrder) return;
    setCancelConfirmOpen(false);
    setErrorMessage(
      `Pedido ${pendingOrder.numero} já foi criado. Para alterar peças ou dados, cancele esta solicitação e inicie uma nova.`,
    );
    toast.message(`Resumo do pedido ${pendingOrder.numero}`, {
      description: "Alterações silenciosas não são aplicadas em pedido já criado.",
    });
  };
  const cancelarSolicitacao = async () => {
    if (!pendingOrder || actionRef.current) return;
    const key = pendingOrder.idempotencyKey ?? idempotencyKey;
    if (!key) {
      const msg = "Chave da solicitação ausente. O pedido foi preservado para suporte.";
      setFlowState("error");
      setErrorMessage(msg);
      toast.error("Cancelamento não executado", { description: msg });
      return;
    }
    actionRef.current = true;
    setFlowState("cancelling");
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.rpc("cancelar_pedido_checkout", {
        p_pedido_id: pendingOrder.id,
        p_idempotency_key: key,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : null;
      if (!row || row.status !== "cancelado") {
        throw new Error("Cancelamento não confirmado pelo servidor.");
      }
      const numero = pendingOrder.numero;
      setPendingOrder(null);
      clearIdempotencyKey();
      clear();
      resetCheckout();
      setCompletedOrder({ numero });
      setFlowState("completed");
      setCancelConfirmOpen(false);
      toast.success(`Solicitação ${numero} cancelada`);
    } catch (err) {
      const msg = (err as Error)?.message ?? "Falha ao cancelar solicitação.";
      setFlowState("error");
      setErrorMessage(msg);
      toast.error("Não foi possível cancelar", {
        description: `${msg} O pedido foi preservado para tentar novamente.`,
      });
    } finally {
      actionRef.current = false;
    }
  };

  const currentIndex = useMemo(() => STEPS.findIndex((s) => s.key === step), [step]);
  const drawerTitle = pendingOrder
    ? "Pedido criado"
    : flowState === "completed"
      ? "Solicitação concluída"
      : STEPS[currentIndex].label;
  const drawerEyebrow = pendingOrder
    ? "Aguardando WhatsApp"
    : flowState === "completed"
      ? "Fluxo finalizado"
      : `Etapa ${currentIndex + 1} de ${STEPS.length}`;
  const footerLabel = pendingOrder ? "Total oficial" : step === 4 ? "Total" : "Subtotal";
  const footerAmount = pendingOrder
    ? (currentPendingSummary?.subtotalOficial ?? subtotal)
    : step === 4
      ? total
      : subtotal;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-[color:var(--forest-deep)]/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Sua reserva"
            data-testid="reserva-drawer"
            className="fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-md flex-col bg-[color:var(--cream)] text-[color:var(--ink)] shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[color:var(--border)] px-6 py-5">
              <div className="min-w-0">
                <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                  {drawerEyebrow}
                </p>
                <h2 className="mt-1 truncate font-display text-2xl text-[color:var(--forest-deep)]">
                  {drawerTitle}
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar reserva"
                className="flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--forest-deep)]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Stepper */}
            <div className="flex items-center gap-1 border-b border-[color:var(--border)] px-6 py-3">
              {STEPS.map((s, i) => (
                <div
                  key={s.key}
                  aria-hidden="true"
                  className={`h-[2px] flex-1 rounded-full transition-colors ${
                    i <= currentIndex ? "bg-[color:var(--gold)]" : "bg-[color:var(--border)]"
                  }`}
                />
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {pendingOrder && currentPendingSummary ? (
                <PendingOrderPanel
                  pendingOrder={pendingOrder}
                  summary={currentPendingSummary}
                  state={flowState}
                  errorMessage={errorMessage}
                  cancelConfirmOpen={cancelConfirmOpen}
                  onCancelOpen={() => setCancelConfirmOpen(true)}
                  onCancelClose={() => setCancelConfirmOpen(false)}
                  onConfirmCancel={cancelarSolicitacao}
                  onReview={revisarDados}
                  isBusy={isBusy}
                />
              ) : flowState === "completed" && completedOrder ? (
                <CompletedOrderPanel numero={completedOrder.numero} />
              ) : items.length === 0 ? (
                <p className="mt-8 text-center font-display text-lg italic text-[color:var(--muted-foreground)]">
                  Sua reserva aguarda a primeira peça.
                </p>
              ) : step === 0 ? (
                <ul className="flex flex-col gap-6">
                  {items.map((i) => (
                    <li
                      key={`${i.slug}-${i.size}`}
                      className="grid grid-cols-[88px_minmax(0,1fr)_auto] gap-4"
                    >
                      <img
                        src={i.image}
                        alt={i.name}
                        width={176}
                        height={224}
                        loading="lazy"
                        className="aspect-[3/4] h-full w-full object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-display text-base text-[color:var(--forest-deep)]">
                          {i.name}
                        </p>
                        <p className="mt-1 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                          Tam. {i.size}
                        </p>
                        <div className="mt-2 inline-flex items-center border border-[color:var(--border)]">
                          <button
                            aria-label="Diminuir"
                            onClick={() => {
                              const to = Math.max(1, i.quantity - 1);
                              updateQty(i.slug, i.size, to);
                              track({
                                name: "reserve_qty_change",
                                slug: i.slug,
                                size: i.size,
                                from: i.quantity,
                                to,
                              });
                            }}
                            data-testid={`qty-dec-${i.slug}-${i.size}`}
                            className="flex h-8 w-8 items-center justify-center"
                          >
                            −
                          </button>
                          <span
                            data-testid={`qty-${i.slug}-${i.size}`}
                            className="min-w-6 text-center text-sm tabular-nums"
                          >
                            {i.quantity}
                          </span>
                          <button
                            aria-label="Aumentar"
                            onClick={() => {
                              const to = i.quantity + 1;
                              updateQty(i.slug, i.size, to);
                              track({
                                name: "reserve_qty_change",
                                slug: i.slug,
                                size: i.size,
                                from: i.quantity,
                                to,
                              });
                            }}
                            data-testid={`qty-inc-${i.slug}-${i.size}`}
                            className="flex h-8 w-8 items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-between">
                        <span className="font-display tabular-nums text-[color:var(--forest-deep)]">
                          {formatBRL(i.price * i.quantity)}
                        </span>
                        <button
                          aria-label={`Remover ${i.name}`}
                          onClick={() => {
                            removeItem(i.slug, i.size);
                            track({ name: "reserve_remove", slug: i.slug, size: i.size });
                          }}
                          data-testid={`qty-remove-${i.slug}-${i.size}`}
                          className="flex h-9 w-9 items-center justify-center text-[color:var(--muted-foreground)] hover:text-[color:var(--forest-deep)]"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : step === 1 ? (
                <StepEntrega
                  delivery={delivery}
                  setDelivery={setDelivery}
                  address={address}
                  setAddress={setAddress}
                  pickup={pickup}
                  setPickup={setPickup}
                  errors={errors}
                  cepLoading={cepLoading}
                  setCepLoading={setCepLoading}
                />
              ) : step === 2 ? (
                <StepCliente customer={customer} setCustomer={setCustomer} errors={errors} />
              ) : step === 3 ? (
                <StepPagamento
                  payment={payment}
                  setPayment={setPayment}
                  installments={installments}
                  setInstallments={setInstallments}
                  baseTotal={baseTotal}
                  config={installmentsConfig}
                />
              ) : (
                <StepRevisao
                  items={items}
                  delivery={delivery}
                  address={address}
                  pickup={pickup}
                  customer={customer}
                  payment={payment}
                  installments={installments}
                  freight={freight}
                  subtotal={subtotal}
                  baseTotal={baseTotal}
                  total={total}
                  config={installmentsConfig}
                />
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-[color:var(--border)] p-6">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                  {footerLabel}
                </span>
                <span className="font-display text-2xl tabular-nums text-[color:var(--forest-deep)]">
                  {formatBRL(footerAmount)}
                </span>
              </div>

              {pendingOrder ? (
                <div className="mt-5 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={reenviarWhats}
                    disabled={isBusy}
                    aria-busy={flowState === "reopening_whatsapp"}
                    className="inline-flex h-14 w-full items-center justify-center gap-2 bg-[color:var(--forest-deep)] text-[11px] tracking-luxe uppercase text-[color:var(--cream)] transition-colors hover:bg-[color:var(--forest)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {flowState === "reopening_whatsapp" ? "Abrindo…" : "Reenviar WhatsApp"}
                    {flowState === "reopening_whatsapp" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={marcarEnviado}
                    disabled={isBusy}
                    aria-busy={flowState === "confirming_sent"}
                    className="inline-flex h-14 w-full items-center justify-center gap-2 border border-[color:var(--forest-deep)] text-[11px] tracking-luxe uppercase text-[color:var(--forest-deep)] transition-colors hover:bg-[color:var(--forest-deep)] hover:text-[color:var(--cream)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {flowState === "confirming_sent" ? "Confirmando…" : "Já enviei"}
                    {flowState === "confirming_sent" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCancelConfirmOpen(true)}
                    disabled={isBusy}
                    className="inline-flex h-12 w-full items-center justify-center text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)] underline-offset-4 hover:text-[color:var(--forest-deep)] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar solicitação
                  </button>
                </div>
              ) : flowState === "completed" ? (
                <button
                  type="button"
                  onClick={() => {
                    setFlowState("idle");
                    setCompletedOrder(null);
                    setStep(0);
                    setOpen(false);
                  }}
                  className="mt-5 inline-flex h-14 w-full items-center justify-center bg-[color:var(--forest-deep)] text-[11px] tracking-luxe uppercase text-[color:var(--cream)] transition-colors hover:bg-[color:var(--forest)]"
                >
                  Concluir
                </button>
              ) : (
                <div className="mt-5 flex items-center gap-3">
                  {step > 0 && (
                    <button
                      type="button"
                      onClick={goBack}
                      disabled={isBusy}
                      className="inline-flex h-14 shrink-0 items-center justify-center gap-2 border border-[color:var(--forest-deep)] px-5 text-[11px] tracking-luxe uppercase text-[color:var(--forest-deep)] transition-colors hover:bg-[color:var(--forest-deep)] hover:text-[color:var(--cream)] disabled:opacity-50"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                      Voltar
                    </button>
                  )}
                  {step < 4 ? (
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={items.length === 0}
                      className={`inline-flex h-14 w-full items-center justify-center gap-2 text-[11px] tracking-luxe uppercase transition-colors ${
                        items.length === 0
                          ? "bg-[color:var(--cream-deep)] text-[color:var(--muted-foreground)] cursor-not-allowed"
                          : "bg-[color:var(--forest-deep)] text-[color:var(--cream)] hover:bg-[color:var(--forest)]"
                      }`}
                    >
                      Continuar
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={finalizar}
                      disabled={items.length === 0 || isBusy}
                      aria-busy={flowState === "creating"}
                      className={`inline-flex h-14 w-full items-center justify-center gap-2 text-[11px] tracking-luxe uppercase transition-colors ${
                        items.length === 0 || isBusy
                          ? "bg-[color:var(--cream-deep)] text-[color:var(--muted-foreground)] cursor-not-allowed"
                          : "bg-[color:var(--forest-deep)] text-[color:var(--cream)] hover:bg-[color:var(--forest)]"
                      }`}
                    >
                      {flowState === "creating" ? "Preparando…" : "Finalizar via WhatsApp"}
                      {flowState === "creating" ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  )}
                </div>
              )}

              <p className="mt-3 text-center text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                Atendimento privado · seg–sáb
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

type PendingSummary = NonNullable<PendingOrder["summary"]>;

function PendingOrderPanel({
  pendingOrder,
  summary,
  state,
  errorMessage,
  cancelConfirmOpen,
  onCancelOpen,
  onCancelClose,
  onConfirmCancel,
  onReview,
  isBusy,
}: {
  pendingOrder: PendingOrder;
  summary: PendingSummary;
  state: CheckoutFlowState;
  errorMessage: string | null;
  cancelConfirmOpen: boolean;
  onCancelOpen: () => void;
  onCancelClose: () => void;
  onConfirmCancel: () => void;
  onReview: () => void;
  isBusy: boolean;
}) {
  return (
    <div className="flex flex-col gap-6" data-testid="pending-order-panel">
      <section className="border border-[color:var(--forest-deep)]/10 bg-[color:var(--forest-deep)]/5 p-5 text-center">
        <Check className="mx-auto h-8 w-8 text-[color:var(--gold)]" aria-hidden="true" />
        <h3 className="mt-3 font-display text-2xl text-[color:var(--forest-deep)]">
          Pedido {pendingOrder.numero}
        </h3>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
          Criado e aguardando envio pelo WhatsApp.
        </p>
      </section>

      {errorMessage && (
        <div className="flex gap-3 border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 p-4 text-sm text-[color:var(--forest-deep)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{errorMessage}</p>
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            Resumo oficial
          </h4>
          <button
            type="button"
            onClick={onReview}
            className="text-[10px] tracking-luxe uppercase text-[color:var(--forest-deep)] underline-offset-4 hover:underline"
          >
            Revisar dados
          </button>
        </div>
        <ul className="flex flex-col gap-3">
          {summary.itens.map((item) => (
            <li key={`${item.slug}-${item.size}`} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate font-display text-base text-[color:var(--forest-deep)]">
                  {item.name}
                </p>
                <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                  Tam. {item.size} · {item.quantity}×
                </p>
              </div>
              <span className="shrink-0 font-display tabular-nums text-[color:var(--forest-deep)]">
                {formatBRL(item.price * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 text-sm text-[color:var(--forest-deep)]">
        <div className="flex items-start gap-3">
          {summary.entrega === "retirada" ? (
            <Store className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <Truck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <div>
            <p>{DELIVERY_LABEL[summary.entrega]}</p>
            <p className="text-[color:var(--muted-foreground)]">
              {summary.entrega === "retirada" && summary.retirada
                ? formatPickupSlot(summary.retirada.date, summary.retirada.time)
                : summary.endereco
                  ? `${summary.endereco.rua}, ${summary.endereco.numero} · ${summary.endereco.bairro}`
                  : summary.freteLabel}
            </p>
          </div>
        </div>
        <p>
          {PAYMENT_LABEL[summary.pagamento]}
          {summary.parcelas > 1 ? ` · ${summary.parcelas}x` : " · à vista"}
        </p>
      </section>

      {cancelConfirmOpen ? (
        <section className="border border-[color:var(--gold)]/40 p-4">
          <p className="text-sm text-[color:var(--forest-deep)]">
            Cancelar esta solicitação marca o pedido como cancelado e libera uma nova tentativa.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={onCancelClose}
              disabled={isBusy}
              className="h-11 flex-1 border border-[color:var(--border)] text-[10px] tracking-luxe uppercase text-[color:var(--forest-deep)] disabled:opacity-60"
            >
              Manter
            </button>
            <button
              type="button"
              onClick={onConfirmCancel}
              disabled={isBusy}
              aria-busy={state === "cancelling"}
              className="h-11 flex-1 bg-[color:var(--forest-deep)] text-[10px] tracking-luxe uppercase text-[color:var(--cream)] disabled:opacity-60"
            >
              {state === "cancelling" ? "Cancelando…" : "Confirmar"}
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={onCancelOpen}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        >
          Abrir confirmação de cancelamento
        </button>
      )}
    </div>
  );
}

function CompletedOrderPanel({ numero }: { numero: string }) {
  return (
    <div className="mt-8 text-center" data-testid="checkout-completed-panel">
      <Check className="mx-auto h-9 w-9 text-[color:var(--gold)]" aria-hidden="true" />
      <h3 className="mt-4 font-display text-2xl text-[color:var(--forest-deep)]">
        Solicitação {numero} concluída
      </h3>
      <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
        O carrinho foi limpo e o checkout está pronto para uma nova reserva.
      </p>
    </div>
  );
}

// ============================================================================
// STEP COMPONENTS
// ============================================================================

function Field({
  label,
  htmlFor,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]"
      >
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-[11px] text-[color:var(--destructive)]">{error}</p>}
    </div>
  );
}

const inputCls =
  "h-11 w-full border border-[color:var(--border)] bg-transparent px-3 font-sans text-sm text-[color:var(--forest-deep)] placeholder:text-[color:var(--muted-foreground)]/60 focus:border-[color:var(--forest-deep)] focus:outline-none";

function StepEntrega({
  delivery,
  setDelivery,
  address,
  setAddress,
  pickup,
  setPickup,
  errors,
  cepLoading,
  setCepLoading,
}: {
  delivery: DeliveryMethod;
  setDelivery: (d: DeliveryMethod) => void;
  address: Address;
  setAddress: (a: Address) => void;
  pickup: OrderPickup | null;
  setPickup: (p: OrderPickup | null) => void;
  errors: Record<string, string>;
  cepLoading: boolean;
  setCepLoading: (v: boolean) => void;
}) {
  const onCepBlur = async () => {
    if (address.cep.replace(/\D/g, "").length !== 8) return;
    setCepLoading(true);
    const res = await lookupCEP(address.cep);
    setCepLoading(false);
    if (res) {
      setAddress({
        ...address,
        rua: address.rua || res.rua || "",
        bairro: address.bairro || res.bairro || "",
        cidade: address.cidade || res.cidade || "",
      });
    }
  };

  const adminSettings = useSettingsStore((s) => s.settings);
  const pickupDays: PickupDay[] = useMemo(
    () => getUpcomingPickupSlots(new Date(), resolvePickupConfigFromSettings(adminSettings)),
    [adminSettings],
  );
  const selectedDay = pickup ? pickupDays.find((d) => d.date === pickup.date) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        {(["retirada", "entrega"] as const).map((d) => {
          const selected = delivery === d;
          const Icon = d === "retirada" ? Store : Truck;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDelivery(d)}
              className={`flex flex-col items-start gap-2 border p-4 text-left transition-colors ${
                selected
                  ? "border-[color:var(--forest-deep)] bg-[color:var(--forest-deep)] text-[color:var(--cream)]"
                  : "border-[color:var(--border)] text-[color:var(--forest-deep)] hover:border-[color:var(--forest-deep)]"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="text-[11px] tracking-luxe uppercase">{DELIVERY_LABEL[d]}</span>
            </button>
          );
        })}
      </div>

      {delivery === "entrega" ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="CEP" htmlFor="cep" error={errors.cep} className="col-span-2 sm:col-span-1">
            <input
              id="cep"
              inputMode="numeric"
              autoComplete="postal-code"
              value={address.cep}
              onChange={(e) => setAddress({ ...address, cep: formatCEP(e.target.value) })}
              onBlur={onCepBlur}
              placeholder="00000-000"
              className={inputCls}
            />
            {cepLoading && (
              <p className="mt-1 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                Buscando…
              </p>
            )}
          </Field>
          <Field label="Rua" htmlFor="rua" error={errors.rua} className="col-span-2">
            <input
              id="rua"
              autoComplete="address-line1"
              value={address.rua}
              onChange={(e) => setAddress({ ...address, rua: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Número" htmlFor="numero" error={errors.numero}>
            <input
              id="numero"
              inputMode="numeric"
              value={address.numero}
              onChange={(e) => setAddress({ ...address, numero: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Complemento" htmlFor="comp" error={errors.complemento}>
            <input
              id="comp"
              value={address.complemento ?? ""}
              onChange={(e) => setAddress({ ...address, complemento: e.target.value })}
              placeholder="Apto, bloco…"
              className={inputCls}
            />
          </Field>
          <Field
            label="Bairro"
            htmlFor="bairro"
            error={errors.bairro}
            className="col-span-2 sm:col-span-1"
          >
            <input
              id="bairro"
              value={address.bairro}
              onChange={(e) => setAddress({ ...address, bairro: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field
            label="Cidade"
            htmlFor="cidade"
            error={errors.cidade}
            className="col-span-2 sm:col-span-1"
          >
            <input
              id="cidade"
              autoComplete="address-level2"
              value={address.cidade}
              onChange={(e) => setAddress({ ...address, cidade: e.target.value })}
              className={inputCls}
            />
          </Field>
          <p className="col-span-2 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            Frete: a combinar no atendimento.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="border border-[color:var(--border)] p-4 text-sm text-[color:var(--forest-deep)]">
            <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
              Retirada
            </p>
            <p className="mt-2 font-display text-lg">Rua Luiz Veronesi, 464</p>
            <p className="text-[color:var(--muted-foreground)]">
              Cinquentenário · Caxias do Sul · RS
            </p>
          </div>

          <div>
            <p className="mb-2 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
              Dia da retirada
            </p>
            {pickupDays.length === 0 ? (
              <p className="text-[11px] text-[color:var(--muted-foreground)]">
                Sem horários disponíveis nos próximos dias.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Dia da retirada">
                {pickupDays.map((d) => {
                  const active = pickup?.date === d.date;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      data-testid={`pickup-day-${d.date}`}
                      onClick={() =>
                        setPickup({
                          date: d.date,
                          time: pickup?.date === d.date && pickup.time ? pickup.time : d.slots[0],
                        })
                      }
                      className={`border px-3 py-2 text-[11px] tracking-luxe uppercase transition-colors ${
                        active
                          ? "border-[color:var(--forest-deep)] bg-[color:var(--forest-deep)] text-[color:var(--cream)]"
                          : "border-[color:var(--border)] text-[color:var(--forest-deep)] hover:border-[color:var(--forest-deep)]"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedDay && (
            <div>
              <p className="mb-2 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                Horário
              </p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Horário da retirada">
                {selectedDay.slots.map((s) => {
                  const active = pickup?.time === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      data-testid={`pickup-slot-${s}`}
                      onClick={() => setPickup({ date: selectedDay.date, time: s })}
                      className={`border px-3 py-2 font-sans text-sm tabular-nums transition-colors ${
                        active
                          ? "border-[color:var(--forest-deep)] bg-[color:var(--forest-deep)] text-[color:var(--cream)]"
                          : "border-[color:var(--border)] text-[color:var(--forest-deep)] hover:border-[color:var(--forest-deep)]"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {errors.pickup && (
            <p className="text-[11px] text-[color:var(--destructive)]">{errors.pickup}</p>
          )}
        </div>
      )}
    </div>
  );
}

function StepCliente({
  customer,
  setCustomer,
  errors,
}: {
  customer: Customer;
  setCustomer: (c: Customer) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Nome completo" htmlFor="nome" error={errors.nome} className="col-span-2">
        <input
          id="nome"
          autoComplete="name"
          value={customer.nome}
          onChange={(e) => setCustomer({ ...customer, nome: e.target.value })}
          className={inputCls}
        />
      </Field>
      <Field
        label="Telefone"
        htmlFor="tel"
        error={errors.telefone}
        className="col-span-2 sm:col-span-1"
      >
        <input
          id="tel"
          inputMode="tel"
          autoComplete="tel"
          value={customer.telefone}
          onChange={(e) => setCustomer({ ...customer, telefone: formatPhone(e.target.value) })}
          placeholder="(54) 90000-0000"
          className={inputCls}
        />
      </Field>
      <Field
        label="CPF (opcional)"
        htmlFor="cpf"
        error={errors.cpf}
        className="col-span-2 sm:col-span-1"
      >
        <input
          id="cpf"
          inputMode="numeric"
          value={customer.cpf ?? ""}
          onChange={(e) => setCustomer({ ...customer, cpf: formatCPF(e.target.value) })}
          placeholder="000.000.000-00"
          className={inputCls}
        />
      </Field>
      <Field
        label="Observações (opcional)"
        htmlFor="obs"
        error={errors.observacoes}
        className="col-span-2"
      >
        <textarea
          id="obs"
          rows={3}
          value={customer.observacoes ?? ""}
          onChange={(e) => setCustomer({ ...customer, observacoes: e.target.value })}
          className="w-full border border-[color:var(--border)] bg-transparent p-3 font-sans text-sm text-[color:var(--forest-deep)] placeholder:text-[color:var(--muted-foreground)]/60 focus:border-[color:var(--forest-deep)] focus:outline-none"
          placeholder="Preferências, presente, medidas…"
        />
      </Field>
    </div>
  );
}

function StepPagamento({
  payment,
  setPayment,
  installments,
  setInstallments,
  baseTotal,
  config,
}: {
  payment: PaymentMethod;
  setPayment: (p: PaymentMethod) => void;
  installments: number;
  setInstallments: (n: number) => void;
  baseTotal: number;
  config: InstallmentConfig;
}) {
  const options: PaymentMethod[] = ["pix", "debito", "credito", "dinheiro"];
  const installmentOptions = getInstallmentOptions(baseTotal, config);
  return (
    <div className="grid grid-cols-1 gap-3">
      {options.map((p) => {
        const selected = payment === p;
        return (
          <div key={p} className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setPayment(p)}
            className={`flex items-center justify-between border p-4 text-left transition-colors ${
              selected
                ? "border-[color:var(--forest-deep)] bg-[color:var(--forest-deep)] text-[color:var(--cream)]"
                : "border-[color:var(--border)] text-[color:var(--forest-deep)] hover:border-[color:var(--forest-deep)]"
            }`}
          >
            <span className="font-display text-lg">{PAYMENT_LABEL[p]}</span>
            {selected && <Check className="h-4 w-4" aria-hidden="true" />}
          </button>
          {p === "credito" && selected && (
            <div
              role="radiogroup"
              aria-label="Parcelamento"
              className="flex flex-col gap-2 border border-[color:var(--border)] p-3"
            >
              <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                Parcelamento (até {config.maxInstallments}x)
              </p>
              {installmentOptions.map((opt) => {
                const active = installments === opt.count;
                return (
                  <button
                    key={opt.count}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setInstallments(opt.count)}
                    className={`flex items-center justify-between border px-3 py-2 text-left transition-colors ${
                      active
                        ? "border-[color:var(--forest-deep)] bg-[color:var(--forest-deep)]/5"
                        : "border-[color:var(--border)] hover:border-[color:var(--forest-deep)]"
                    }`}
                  >
                    <span className="font-sans text-sm tabular-nums text-[color:var(--forest-deep)]">
                      {opt.count}x de {formatBRL(opt.perInstallment)}
                    </span>
                    <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)] tabular-nums">
                      Total {formatBRL(opt.total)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          </div>
        );
      })}
      <p className="mt-2 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
        Confirmação final e link de pagamento pelo WhatsApp.
      </p>
    </div>
  );
}

function StepRevisao({
  items,
  delivery,
  address,
  pickup,
  customer,
  payment,
  installments,
  freight,
  subtotal,
  baseTotal,
  total,
  config,
}: {
  items: { slug: string; name: string; size: string; quantity: number; price: number }[];
  delivery: DeliveryMethod;
  address: Address;
  pickup: OrderPickup | null;
  customer: Customer;
  payment: PaymentMethod;
  installments: number;
  freight: Freight;
  subtotal: number;
  baseTotal: number;
  total: number;
  config: InstallmentConfig;
}) {
  const installmentInfo =
    payment === "credito" ? getInstallmentOption(baseTotal, installments, config) : null;
  return (
    <div className="flex flex-col gap-6 text-sm text-[color:var(--forest-deep)]">
      <section>
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          Peças
        </p>
        <ul className="mt-2 flex flex-col gap-1">
          {items.map((i) => (
            <li key={`${i.slug}-${i.size}`} className="flex items-baseline justify-between gap-3">
              <span className="truncate">
                {i.quantity}× {i.name}{" "}
                <span className="text-[color:var(--muted-foreground)]">· Tam {i.size}</span>
              </span>
              <span className="tabular-nums">{formatBRL(i.price * i.quantity)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          Cliente
        </p>
        <p className="mt-2">{customer.nome}</p>
        <p className="text-[color:var(--muted-foreground)]">{customer.telefone}</p>
        {customer.cpf && <p className="text-[color:var(--muted-foreground)]">CPF {customer.cpf}</p>}
      </section>

      <section>
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          Entrega
        </p>
        <p className="mt-2">{DELIVERY_LABEL[delivery]}</p>
        {delivery === "entrega" && (
          <p className="text-[color:var(--muted-foreground)]">
            {address.rua}, {address.numero}
            {address.complemento ? ` · ${address.complemento}` : ""} — {address.bairro},{" "}
            {address.cidade} · CEP {address.cep}
          </p>
        )}
        {delivery === "retirada" && pickup && (
          <p className="text-[color:var(--muted-foreground)]">
            Horário: {formatPickupSlot(pickup.date, pickup.time)}
          </p>
        )}
      </section>

      <section>
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          Forma de pagamento
        </p>
        <p className="mt-2">{PAYMENT_LABEL[payment]}</p>
        <p className="mt-3 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          Parcelamento
        </p>
        <p className="mt-2 tabular-nums">
          {installmentInfo && installmentInfo.count > 1
            ? `${installmentInfo.count}x de ${formatBRL(installmentInfo.perInstallment)}`
            : "À vista"}
        </p>
      </section>

      {customer.observacoes && (
        <section>
          <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            Observações
          </p>
          <p className="mt-2 whitespace-pre-wrap">{customer.observacoes}</p>
        </section>
      )}

      <section className="border-t border-[color:var(--border)] pt-4">
        <div className="flex justify-between text-[color:var(--muted-foreground)]">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatBRL(subtotal)}</span>
        </div>
        <div className="mt-1 flex justify-between text-[color:var(--muted-foreground)]">
          <span>Frete</span>
          <span className="tabular-nums">
            {freight.cost != null ? formatBRL(freight.cost) : freight.label}
          </span>
        </div>
        {installmentInfo && installmentInfo.surcharge > 0 && (
          <div className="mt-1 flex justify-between text-[color:var(--muted-foreground)]">
            <span>Acréscimo cartão</span>
            <span className="tabular-nums">
              {formatBRL(installmentInfo.total - baseTotal)}
            </span>
          </div>
        )}
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-[10px] tracking-luxe uppercase">Valor total</span>
          <span className="font-display text-xl tabular-nums">{formatBRL(total)}</span>
        </div>
        {installmentInfo && installmentInfo.count > 1 && (
          <div className="mt-1 flex items-baseline justify-between text-[color:var(--muted-foreground)]">
            <span className="text-[10px] tracking-luxe uppercase">Valor por parcela</span>
            <span className="tabular-nums">
              {installmentInfo.count}x de {formatBRL(installmentInfo.perInstallment)}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
