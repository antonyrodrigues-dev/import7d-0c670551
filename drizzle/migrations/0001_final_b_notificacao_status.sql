-- FINAL-B — Fonte única de notificação: mudança de status operacional passa a
-- gerar notificação persistente no banco (antes só existia no cliente).
CREATE OR REPLACE FUNCTION public.notificar_pedido_evento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_titulo text; v_msg text; v_sev text := 'info'; v_key text;
BEGIN
  v_key := NEW.tipo || ':' || NEW.pedido_id::text || ':' || COALESCE(NEW.detalhe->>'estado', NEW.detalhe->>'para', '');
  CASE NEW.tipo
    WHEN 'pedido.criado' THEN v_titulo := 'Novo pedido'; v_msg := 'Pedido ' || NEW.numero_pedido || ' registrado.';
    WHEN 'pedido.whatsapp_declarado' THEN v_titulo := 'Cliente declarou envio'; v_msg := 'Pedido ' || NEW.numero_pedido || ' confirmado pelo cliente no WhatsApp.';
    WHEN 'atendimento.assumido' THEN v_titulo := 'Atendimento assumido'; v_msg := 'Pedido ' || NEW.numero_pedido || ' assumido por ' || COALESCE(NEW.detalhe->>'responsavel','equipe') || '.';
    WHEN 'atendimento.transferido' THEN v_titulo := 'Atendimento transferido'; v_msg := 'Pedido ' || NEW.numero_pedido || ' transferido para ' || COALESCE(NEW.detalhe->>'para','equipe') || '.';
    WHEN 'atendimento.devolvido_fila' THEN v_titulo := 'Pedido devolvido à fila'; v_msg := 'Pedido ' || NEW.numero_pedido || ' voltou para a fila.'; v_sev := 'alerta';
    WHEN 'pedido.status' THEN
      v_titulo := 'Pedido atualizado';
      v_msg := 'Pedido ' || NEW.numero_pedido || ' — status ' || COALESCE(NEW.detalhe->>'para','atualizado') || '.';
      v_sev := CASE NEW.detalhe->>'para' WHEN 'cancelado' THEN 'alerta' ELSE 'info' END;
    WHEN 'pagamento.estado' THEN
      v_titulo := 'Pagamento ' || COALESCE(NEW.detalhe->>'estado','atualizado');
      v_msg := 'Pedido ' || NEW.numero_pedido || ' — pagamento ' || COALESCE(NEW.detalhe->>'estado','atualizado') || '.';
      v_sev := CASE NEW.detalhe->>'estado' WHEN 'confirmado' THEN 'sucesso' WHEN 'recusado' THEN 'critico' ELSE 'info' END;
    WHEN 'pedido.devolvido' THEN v_titulo := 'Devolução aprovada'; v_msg := 'Pedido ' || NEW.numero_pedido || ' teve devolução registrada.'; v_sev := 'alerta';
    WHEN 'pedido.cancelado' THEN v_titulo := 'Pedido cancelado'; v_msg := 'Pedido ' || NEW.numero_pedido || ' foi cancelado.'; v_sev := 'alerta';
    ELSE RETURN NEW;
  END CASE;

  PERFORM public.emitir_notificacao(NEW.tipo, v_titulo, v_msg, v_key, v_sev, 'pedido', NEW.pedido_id, NEW.detalhe);
  RETURN NEW;
END;
$function$;
