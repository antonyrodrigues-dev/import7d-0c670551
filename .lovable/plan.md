# Onda 2 — Consolidação Final do MVP (Gate de Qualidade de Engenharia)

O plano deixa de ser sequência de implementação e passa a funcionar como **gate de qualidade**. Nenhum bloco fecha enquanto existir bug, regressão, inconsistência, problema de UX, segurança, performance ou acessibilidade. Só permanece pendente o que estiver **explicitamente planejado para Sprint 8+**.

---

## Critério Absoluto de Aprovação (aplicado a cada bloco)

Um bloco só é considerado concluído quando **nenhuma** das situações abaixo existir:

- Bug funcional
- Fluxo quebrado
- Integração inconsistente
- Dados divergentes entre módulos
- Responsividade incorreta
- Problema de UX (padding, alinhamento, tipografia, hierarquia visual, estados, loading, animações, feedback visual, skeletons, transições)
- Vulnerabilidade de segurança
- Erro de performance perceptível
- Erro de acessibilidade crítico
- Código que gere regressão conhecida

---

## Bloco 1 — Banco de Dados + Auditoria DB

**Migração (aguarda aprovação)**
- `pedidos`: `UPDATE` status legados → canônicos; `CHECK (status IN 8 estados)`; policy anon insert `status='novo'`; `CHECK (valor_total > 0)`; `UNIQUE(numero_pedido)`.
- `produtos`: `CHECK (preco > 0)`, `UNIQUE(sku)`, `UNIQUE(slug)`.
- `produto_variacoes`: `CHECK (quantidade >= 0)`, `UNIQUE(produto_id, tamanho)`.
- Índices: `pedidos(status)`, `pedidos(criado_em)`, `produto_variacoes(produto_id)`, `produto_movimentacoes(produto_id, criado_em)`.

**Auditoria DB:** `supabase--linter` limpo, `supabase--slow_queries` top-10 revisadas, FKs íntegras, tabelas órfãs inventariadas.

---

## Bloco 2 — Máquina de Estados (Pedidos)

`primaryNextStatus`/`sideTransitions`; adapter→store; guard de concorrência; idempotência persistida; `audit.record` + `logger` + `emit` em toda transição; CTA primário sólido / laterais outline.

---

## Bloco 3 — Integração + Auditoria de Integridade dos Dados

- Cada transição validada em Estoque, Dashboard, Notificações e Logs.
- `restoreConsumption` obrigatório no `cancelado` após consumo.
- **Auditoria de Integridade (nova):**
  - Alterar produto → refletir em pedido em aberto.
  - Ajustar estoque manual → refletir em dashboard e listagem.
  - Cancelar pedido → restaurar estoque exatamente.
  - Criar cliente via reserva → aparecer em Clientes.
  - Nenhuma métrica derivada de fonte duplicada.

---

## Bloco 4 — Configurações Runtime + Auditoria Financeira

- Todo `AdminSettings` consumido em runtime: horários, WhatsApp, PIX, frete, parcelamento, textos legais, SEO.
- **Auditoria Financeira (nova):**
  - Subtotal × frete × parcelamento no Checkout.
  - `installments.ts` respeitando `parcelamentoMax` e `parcelaMinima`.
  - Dashboard financeiro (faturamento, ticket médio) reconciliando com soma real de pedidos finalizados.
  - Sem centavos perdidos por arredondamento.
  - Relatórios (se existentes) coerentes com o dashboard.

---

## Bloco 5 — Funcionários & Permissões

`ROLE_PERMISSIONS` como fonte única; `can(...)` auditado por rota; self-demote de admin bloqueado; server fn revalida `has_role(admin)`.

---

## Bloco 6 — Cliente / Checkout / Reserva

Máscaras, `numero_pedido` idêntico entre reserva/admin/WhatsApp, settings em runtime, validação de horários e janelas de retirada.

---

## Bloco 7 — Auditoria Integral

### 7.1 Funcional (Admin + Cliente)
Cada tela, cada botão, cada campo, cada fluxo — com evidência registrada.

### 7.2 Segurança
Sem secrets no front, inventário de storage, XSS, CSRF (bearer em mutations), CORS, RLS, uploads. Rate limit registrado como Sprint 8+ se ausente.

### 7.3 Visual / UX
Padding, alinhamento, tipografia, hierarquia visual, grid, contraste WCAG AA via tokens, estados (hover/focus-visible/loading/empty/error/success), skeletons, transições, animações, microinterações e feedback visual — verificados nas telas afetadas.

### 7.4 Responsividade
Playwright em 4 viewports base (1440 / 1280 / 820 / 390) + landscape/portrait, 7 rotas admin + 6 rotas cliente. Zero overflow, zero sobreposição, zero corte de texto.

### 7.5 Performance
60 FPS no scroll, CLS <0.1, LCP em `/`, bundle size registrado, network sem waterfall crítico.

### 7.6 Acessibilidade
Foco visível, roles semânticos, alt text, aria-label em ícones, ordem de tabulação lógica, contraste AA.

### 7.7 Auditoria de Código (nova)
`rg` por: código morto, componentes/hooks/serviços/tipos não utilizados, imports órfãos, imports circulares, `try/catch` vazios, promises sem await, listeners sem cleanup, `console.*` residual, `TODO`/`FIXME`. Remoções aplicadas ou explicitamente justificadas.

---

## Bloco 8 — Matriz Final de Cobertura do MVP (entregável obrigatório)

Ao fim da Onda 2, gero esta tabela preenchida com evidência real:

| Módulo | Status | Cobertura | Bugs encontrados | Bugs corrigidos | Pendências reais | Pronto p/ produção |
|---|---|---|---|---|---|---|
| Login/Auth | | | | | | |
| Dashboard | | | | | | |
| Estoque | | | | | | |
| Pedidos | | | | | | |
| Clientes | | | | | | |
| Funcionários | | | | | | |
| Configurações | | | | | | |
| Checkout | | | | | | |
| Reserva | | | | | | |
| WhatsApp | | | | | | |
| Landing/Cliente | | | | | | |
| Segurança | | | | | | |
| Banco | | | | | | |
| Performance | | | | | | |
| Integridade dos dados | | | | | | |
| Financeiro | | | | | | |
| Código (dead code) | | | | | | |

### Entregáveis do relatório final
1. Matriz preenchida.
2. Checklist item a item do 7.1–7.7 com evidência (arquivo, rota, screenshot ou log).
3. Bugs corrigidos, por bloco.
4. Bugs conhecidos **não bloqueantes** com justificativa (não podem ser correções pendentes).
5. Pendências — **apenas features Sprint 8+**.
6. % de conclusão do MVP.
7. **Decisão técnica final: PRONTO ou NÃO PRONTO para Sprint 8.**

---

## Regra por bloco

`tsgo --noEmit` limpo + `bun run build` sem warnings críticos + evidência prática registrada + nota de regressão zero.

## Fora do escopo (registrado)

Trigger DB de auto-consumo · refatorar arquivos grandes · React.memo/lazy agressivo · enum PG de status · rate limiting real · features novas (favoritos, cupons, push) → Sprint 8/9/10.

## Ordem de execução

**1 (migração, aguarda aprovação) → 2 → 3 → 4 → 5 → 6 → 7 → 8 (matriz final + decisão PRONTO/NÃO PRONTO).**

Confirma este plano final com o gate absoluto, as três auditorias adicionais (Integridade, Financeira, Código) e a Matriz Final de Cobertura para eu iniciar pelo **Bloco 1 (migração)**?
