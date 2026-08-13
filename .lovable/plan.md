# Fechamento corretivo pós-auditoria

## Primeiro: o snapshot auditado está desatualizado

Confirmei no código atual do projeto que várias conclusões da auditoria se referem a um export antigo. Já existem hoje:

- Anti-abuso de checkout (`checkout_guard_antiabuso`, `checkout_bloqueios`)
- Ledger financeiro imutável (`financeiro_lancamentos`) e `pagamento_transicoes`
- Kits atômicos (`produto_kit_itens`, `kit_disponivel`, explosão em pedido/reserva)
- Gate de publicação (`avaliar_publicacao`, `diagnostico_catalogo`, `catalogo_preview`)
- Motor de regras de preço, sino de notificações em tempo real, telas de Pedidos e Atendimentos redesenhadas
- Vitrine "visível vs. comprável" com "Sob consulta"

Portanto os itens marcados como RELEASE GAP (kit, antiabuso, ledger, NotificationBell, catálogo) não são pendências. Os demais achados eu confirmei um a um e são reais.

## O que ainda está aberto (confirmado no código atual)

**P1 — Segurança e integridade**
- Vendedor ainda consegue gravar produto/variação/estoque pelo backend; passa a ser exclusivo do Admin Master.
- Defaults inseguros no catálogo (preço confirmado, publicado, quantidade conferida, tamanho de etiqueta) viram defaults de rascunho.
- Cliente do backend aceita chave secreta como chave de navegador; passa a recusar.
- `.env` não ignorado pelo Git; adicionar regra e `.env.example`.
- Checkout não exige publicação nem quantidade conferida.
- Políticas de armazenamento de imagens não versionadas.
- Portaria de acesso valida só "existe usuário"; passa a exigir perfil ativo e papel, com listener central de sessão.
- Invariante "sempre resta 1 Admin Master ativo" em todos os comandos de equipe.

**P2 — Dinheiro**
- Devolução parcial marcando o pedido inteiro como devolvido e zerando a venda no financeiro.
- Duas autoridades de confirmação de pagamento; unificar em um comando idempotente.
- Receita posicionada por data de atualização; passar a usar o ledger por evento.
- Frete: nunca 0 para pendente (null + status), operação de definir frete oficial no servidor, total oficial recalculado, retirada = 0 explícito.

**P3 — Operação e catálogo**
- Upload real de fotos (galeria, principal, remoção, reordenação, rotação, enquadramento) com bucket e políticas.
- Estoque em tempo real entre abas e atualização imediata de selos/contadores após salvar.
- Salvamento de produto + variações atômico; restaurar não reativa venda; exclusão dura só sem histórico; rascunho nasce inativo e sem preço.
- Consultar preço/tamanho via WhatsApp sem criar pedido, reserva ou lançamento.
- Configurações persistidas no backend e consumidas pelo site (WhatsApp, redes, endereço, horários, retirada, parcelamento).
- Clientes agregados no servidor por telefone normalizado e líquido válido.

**P4 — UX e performance**
- Financeiro com cache por período e medição real antes de otimizar.
- Painel inicial sem carrinho público nem placeholder.
- Busca abrindo a peça exata.
- Fila usando o relógio certo depois de assumir; tempo real direcionado.
- Estados distintos de carregando, vazio, erro, offline e sem permissão.

**P5 — QA**
- Todas as suítes no portão oficial e cobertura administrativa.

## Como pretendo executar

Em 5 ondas, cada uma terminando com verificação (typecheck, lint, testes, gate de banco) e um relatório curto de causa → alteração → teste → resultado:

1. **Onda P1** — segurança, defaults, portaria de acesso, políticas de armazenamento.
2. **Onda P2** — frete, pagamento canônico, devolução parcial, financeiro por evento.
3. **Onda P3** — upload de fotos, tempo real do estoque, consulta por WhatsApp, configurações no backend, clientes no servidor.
4. **Onda P4** — desempenho e acertos de tela.
5. **Onda P5** — testes oficiais e relatório final.

Não vou declarar produção: ao final entrego "implementação corretiva concluída — pronta para homologação externa" ou a lista de bloqueadores restantes.

## Detalhes técnicos

- Mudanças de banco por migration versionada (defaults, grants/RLS Admin-only em `produtos`/`produto_variacoes`, `ajustar_estoque` restrita, gate completo em `criar_pedido`, `definir_frete_pedido`, `confirmar_pagamento` canônico, devolução parcial com `devolucao_parcial`, `metricas_financeiras` lendo `financeiro_lancamentos`, tabela `configuracoes_publicas`, agregação `listar_clientes`, políticas de `storage.objects`).
- Camada de aplicação mantém Adapter → Service → Store → Hook → UI; nada de cálculo financeiro no cliente.
- Upload via bucket `produtos` privado com leitura pública controlada e transformação de imagem no cliente antes do envio.
