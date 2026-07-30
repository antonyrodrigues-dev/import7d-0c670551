# Catálogo Real e Estoque Inteligente

Fonte: planilha `7D_IMPORTS_CATALOGO_E_ESTOQUE_INTELIGENTE.xlsx` (52 produtos propostos, 81 mídias: 69 imagens + 12 vídeos) e os três pacotes de mídia.

Nada é publicado automaticamente: todo produto entra como **rascunho**.

## Escopo em 4 ondas

### Onda A — Fundação de dados (banco)
Migração que evolui `produtos` / `produto_variacoes` e cria as tabelas novas:

- `produtos`: `modelo_estoque` (peca_unica | multi_variante | kit), `marca_visual`, `marca_confirmada`, `preco_pix`, `preco_cartao`, `parcelas`, `preco_confirmado`, `status` (rascunho | ativo | reservado | esgotado | arquivado), `data_entrada`, `observacoes_internas`, `criado_por`, `atualizado_por`.
- `produto_variacoes`: `sku`, `cor`, `tamanho_origem` (etiqueta | medicao | estimativa | desconhecido), `quantidade_reservada`, `disponivel` (gerada), `estoque_minimo`, `ativo`.
- `produto_midias`: tipo (imagem/vídeo), url, ordem, principal, legenda, alt, `compartilhada` (mídia editorial com vários produtos).
- `produto_kit_componentes`: kit → componente + quantidade.
- `produto_historico`: preço, tamanho e quantidade (append-only, sem update/delete).
- `produto_movimentacoes`: passa a exigir `saldo_anterior`, `saldo_posterior`, `motivo`, tipos ampliados (entrada, saida, reserva, liberacao_reserva, venda, cancelamento, devolucao, correcao_inventario, perda, avaria).

RPCs protegidas: `registrar_movimentacao`, `publicar_produto` (gate), `importar_catalogo` (transacional). RLS: escrita de produto/preço/mídia/saldo só para Admin Master; vendedor com leitura + operações de pedido. Catálogo público passa a exigir `status = 'ativo'` **e** tamanho confirmado.

### Onda B — Camadas de domínio (Adapter → Service → Store → Hook)
- Tipos novos (`StockModel`, `SizeSource`, `ProductStatus`, `Movement`, `PublishGate`).
- `publishGate.ts`: função pura que lista exatamente os campos faltantes.
- `inventory.service` reescrito sobre `registrar_movimentacao` (sem edição silenciosa de saldo).
- `alerts.service`: os 8 alertas, com supressão do falso "estoque baixo" em peça única.
- `indicators` no dashboard/financeiro: peças únicas disponíveis/reservadas/vendidas, esgotados, catálogo incompleto, valor estimado, mais vendidos, faturamento por produto/marca/categoria/tamanho/funcionário — sempre só pedidos finalizados.

### Onda C — Admin (UI)
- Estoque: modelo de estoque, variações com SKU próprio, gate de publicação com lista de pendências, filtros (sem preço, sem tamanho confirmado, sem foto individual, sem descrição, sem quantidade, pronto para publicação).
- Gerenciador de mídias: principal, galeria, vídeo, reordenar, legenda, alt, preview, substituir, excluir, fallback; bloqueia mídia compartilhada como foto principal.
- Movimentações: formulário com tipo + motivo obrigatório; histórico imutável.
- Kits: componentes vinculados e indisponibilidade automática.
- Importador em duas etapas: pré-visualização com validações + confirmação transacional e relatório (importados, ignorados, duplicados, incompletos, erros).

### Onda D — Carga real + testes
- Upload das 81 mídias para o storage, agrupadas por peça conforme `Mapeamento_Midias` (uma galeria por produto, sem duplicar produto por imagem).
- Importação dos 52 produtos como rascunho, com preços da aba `Regras_de_Preco` (polo 180, camiseta 105, calça moletom 100, kit Tommy 995 Pix / 1.050 em 3x); Tommy avulso não recebe 995; moletons/jaquetas/puffers/suéteres sem preço ficam rascunho.
- Marcações especiais: BOSS só em foto editorial → "Precisa de foto individual"; jaquetas de criativo → "Confirmar existência física, marca, tamanho, preço e foto individual".
- Testes (Vitest + gate SQL) para os 12 cenários pedidos, incluindo peça única não vendida duas vezes, kit baixando componentes, vendedor sem alterar quantidade, importação rejeitando SKU duplicado e ranking ignorando cancelados.
- Relatório final: typecheck, lint, build, testes e itens pendentes.

## Notas técnicas
- Estoque público passa a ler `disponivel = quantidade - reservada`, nunca a quantidade física.
- Toda escrita de saldo passa por RPC `SECURITY DEFINER` com `FOR UPDATE`; grants diretos de UPDATE em estoque permanecem revogados.
- A importação roda como uma única transação no banco; falha parcial não grava nada.
