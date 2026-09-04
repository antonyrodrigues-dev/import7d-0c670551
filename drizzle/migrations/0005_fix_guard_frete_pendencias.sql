-- BLOQUEADOR CRÍTICO: o guard tratava `itens` e `valor_total` como imutáveis
-- inclusive dentro das RPCs protegidas, o que impedia definir_frete_pedido e
-- resolver_pendencias_pedido de recalcular o total oficial. Resultado: pedido
-- de ENTREGA nunca conseguia frete definido e, por consequência, nunca podia
-- ter pagamento confirmado.
--
-- A imutabilidade continua absoluta para escrita direta (fora de RPC).
CREATE OR REPLACE FUNCTION public.pedidos_guard_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rpc boolean := COALESCE(current_setting('app.rpc_ctx', true), '') = 'on';
BEGIN
  IF NOT v_rpc THEN
    IF NEW.itens IS DISTINCT FROM OLD.itens THEN
      RAISE EXCEPTION 'Itens do pedido são imutáveis após criação.';
    END IF;
    IF NEW.valor_total IS DISTINCT FROM OLD.valor_total THEN
      RAISE EXCEPTION 'Valor total do pedido é imutável após criação.';
    END IF;
  END IF;

  IF NEW.numero_pedido IS DISTINCT FROM OLD.numero_pedido THEN
    RAISE EXCEPTION 'Número do pedido é imutável.';
  END IF;
  IF NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key THEN
    RAISE EXCEPTION 'Chave de idempotência é imutável.';
  END IF;
  IF NEW.criado_em IS DISTINCT FROM OLD.criado_em THEN
    RAISE EXCEPTION 'Data de criação é imutável.';
  END IF;

  IF NOT v_rpc THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.consumo_aplicado IS DISTINCT FROM OLD.consumo_aplicado
       OR NEW.atendente_nome IS DISTINCT FROM OLD.atendente_nome
       OR NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id
       OR NEW.atribuido_em IS DISTINCT FROM OLD.atribuido_em
       OR NEW.pagamento_estado IS DISTINCT FROM OLD.pagamento_estado
       OR NEW.valor_devolvido IS DISTINCT FROM OLD.valor_devolvido
       OR NEW.canal IS DISTINCT FROM OLD.canal
       OR NEW.frete_status IS DISTINCT FROM OLD.frete_status
       OR NEW.whatsapp_declarado_enviado_em IS DISTINCT FROM OLD.whatsapp_declarado_enviado_em
       OR NEW.whatsapp_confirmacao_origem IS DISTINCT FROM OLD.whatsapp_confirmacao_origem THEN
      RAISE EXCEPTION 'Alteração direta em pedidos não é permitida. Use as operações protegidas.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pedido_transicoes WHERE de = OLD.status AND para = NEW.status
    ) THEN
      RAISE EXCEPTION 'Transição de status inválida: % → %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END $function$;
