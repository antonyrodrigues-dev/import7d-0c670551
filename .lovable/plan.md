# Fechamento dos bloqueadores da auditoria pós P1–P5

Confirmei por amostragem que os achados são reais no código atual (gate E2E com só 2 specs, Realtime sem `produtos`/`produto_variacoes`, busca abrindo `#acervo`). Vou fechar na ordem dos bloqueadores e só depois os Medium.

## Onda 1 — Dinheiro (FIN-01, FIN-02)

- `transicionar_pedido` passa a **rejeitar** `pagamento_confirmado` para qualquer papel; some do conjunto de transições operacionais e da máquina de status na interface.
- Confirmar pagamento vira caminho único: `registrar_pagamento` confirma, lança receita no ledger e sincroniza o status operacional do pedido na mesma transação.
- Pedido pago não pode ser cancelado sem estorno: novo comando administrativo que faz, em uma transação, estorno no ledger + devolução de estoque + status + histórico. Sem estorno, o cancelamento é recusado com mensagem clara.
- No detalhe do pedido, os botões "Avançar para..." deixam de oferecer confirmação de pagamento; confirmar/estornar ficam apenas no painel financeiro (Admin Master).

## Onda 2 — Catálogo e estoque (INV-01 a INV-04, STORAGE-01)

- Bucket `produtos` criado por migration (privado, limites de tamanho e MIME), junto com as políticas já existentes — reproduzível a partir do repositório.
- Gerenciador de fotos real na tela de Estoque: envio de arquivos, foto principal, galeria, reordenação, rotação e remoção. Fim do campo "Imagens (URLs)".
- Tempo real de estoque: `produtos` e `produto_variacoes` entram na assinatura de mudanças, com atualização entre abas e dispositivos.
- Salvar produto + variações vira uma operação atômica no banco (uma chamada, tudo ou nada). Restaurar não reativa venda automaticamente; exclusão definitiva só para rascunho sem histórico.
- A tela de Estoque passa a ler e editar os campos do gate moderno: situação de preço, situação de publicação, quantidade conferida e origem/evidência do tamanho.

## Onda 3 — Configurações, cliente e vitrine (CFG-01, PUB-01, PUB-02, CUST-01, DASH-01)

- Tabela de configurações públicas no banco (WhatsApp, redes, endereço, horários, retirada, parcelamento, PIX, dados legais), com escrita Admin Master e leitura pública. Salvar só confirma depois de gravar; nada mais em armazenamento local.
- Site e WhatsApp passam a ler o número/atendente dessas configurações — fim do valor fixo no código.
- Mensagem de WhatsApp: com frete pendente mostra "Subtotal" e "Total a confirmar", nunca um total fechado incorreto.
- Novo fluxo "Consultar tamanho/preço/disponibilidade": mensagem própria, sem criar pedido, reserva ou lançamento; substitui o botão desabilitado "Em conferência".
- Clientes agregados no servidor por telefone normalizado, considerando apenas pedidos válidos (sem cancelado/não pago) e descontando devoluções; última compra pela data do evento correto.
- Painel inicial: sem carrinho público, faturamento derivado do ledger e oculto para quem não tem permissão financeira; "Tempo médio" com valor real.

## Onda 4 — Sessão, operação e detalhes (AUTH-01/02/03, CAT-01/02/03, OPS-01/02, NOTIF-01, SEARCH-01, FIN-PERF-01, FIN-DATA-01/02)

- Ouvinte central de sessão (entrada, saída, atualização de usuário) com limpeza e revalidação; cliente de navegador passa a **recusar** chave secreta.
- Invariante "sempre resta um Admin Master ativo" garantida no banco com trava, não por checagens separadas.
- Visibilidade pública explícita separada de "comprável": rascunho novo não entra no preview; `security_barrier` restaurado na view pública.
- Ficha do produto distingue "sob consulta" de "esgotado".
- SLA de atendimento passa a contar da atribuição; "Abrir pedido" abre o pedido exato por link direto.
- Uma única fonte de notificações (banco + tempo real + leitura por usuário); a fonte local legada é removida.
- Busca abre a peça exata em vez de rolar para a seção.
- Financeiro com cache por período e dados anteriores preservados na troca; ranking de produtos passa a usar líquido; carga histórica do ledger reconciliada por evento de pagamento em vez da data de atualização.

## Onda 5 — QA e dependências (QA-01, DEP-01)

- Portão oficial roda **todos** os testes de ponta a ponta, mais novos testes administrativos: painel inicial, pedidos, atendimento, financeiro, estoque/upload, clientes, funcionários, configurações, sessão e notificações.
- Atualização do TanStack para a versão corrigida da advisory.
- Relatório final por item da auditoria: causa → alteração → teste → resultado.

## Notas técnicas

- Tudo que muda regra de negócio vai por migration versionada; a camada de aplicação mantém Adapter → Service → Store → Hook → UI, sem cálculo financeiro no cliente.
- Cada onda termina com typecheck, lint, testes unitários, gate de banco e gate E2E.
- Ao final entrego "pronto para homologação externa" ou a lista de bloqueadores restantes — não declaro produção sem staging.
