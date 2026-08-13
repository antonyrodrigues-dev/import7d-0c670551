# Auditoria — 27 variações marcadas como `confirmado_etiqueta`

## Origem do dado
A coluna foi criada na migration `20260805114040` com
`DEFAULT 'confirmado_etiqueta'`. Todas as linhas existentes naquele momento
herdaram o valor **sem qualquer conferência física**. Não há registro de
usuário, data ou evidência para nenhuma delas.

Evidência real disponível: planilha oficial
`7D_IMPORTS_CATALOGO_E_ESTOQUE_INTELIGENTE.xlsx`, coluna *Fonte do tamanho* —
somente **3 SKUs** possuem `Etiqueta visível na imagem`.

## Classificação

| SKU | Título | Tamanho | Origem anterior | Evidência | Classificação | Decisão |
|---|---|---|---|---|---|---|
| 7D-TEE-EA7-001 | Camiseta EA7 Mini Patch — Preta | G | confirmado_etiqueta | Etiqueta legível na imagem (planilha) | IMAGE_CONFIRMED | mantido confirmado + evidência registrada |
| 7D-JKT-ZARA-001 | Jaqueta Bomber Zara — Verde-Escuro | GG | confirmado_etiqueta | Etiqueta legível na imagem (planilha) | IMAGE_CONFIRMED | mantido confirmado + evidência registrada |
| 7D-SWT-TH-003 | Suéter Tommy Hilfiger Minimal — Cinza | P | confirmado_etiqueta | Etiqueta legível na imagem (planilha) | IMAGE_CONFIRMED | mantido confirmado + evidência registrada |
| 7D-BMB-ONX (P/M/G/GG) | Bomber Ônix — demo | 4 | DEFAULT herdado | nenhuma | LEGACY_DEFAULT_SUSPECT | → `a_confirmar` |
| 7D-CAM-LN-MRF (P/M/G/GG) | Camisa Linho Marfim — demo | 4 | DEFAULT herdado | nenhuma | LEGACY_DEFAULT_SUSPECT | → `a_confirmar` |
| 7D-CAM-OXF-AZ (P/M/G/GG) | Camisa Oxford Azul — demo | 4 | DEFAULT herdado | nenhuma | LEGACY_DEFAULT_SUSPECT | → `a_confirmar` |
| 7D-JAQ-COURO-CN (P/M/G/GG) | Jaqueta Couro — demo | 4 | DEFAULT herdado | nenhuma | LEGACY_DEFAULT_SUSPECT | → `a_confirmar` |
| 7D-POLO-MRF (P/M/G/GG) | Polo Marfim — demo | 4 | DEFAULT herdado | nenhuma | LEGACY_DEFAULT_SUSPECT | → `a_confirmar` |
| 7D-POLO-OLV (P/M/G/GG) | Polo Oliva — demo | 4 | DEFAULT herdado | nenhuma | LEGACY_DEFAULT_SUSPECT | → `a_confirmar` |

Total: 3 mantidos (evidência de imagem) · 24 revertidos (todos pertencentes
aos 6 produtos de demonstração já arquivados).

Os 49 tamanhos restantes do catálogo real permanecem `estimativa_interna`
(Nível C): informação interna, nunca exibida como tamanho oficial e nunca
liberada para checkout.

## Trava aplicada
- `DEFAULT` da coluna passou a ser `a_confirmar`.
- Trigger `guard_origem_tamanho`: é impossível gravar
  `confirmado_etiqueta`/`confirmado_medicao` sem `origem_tamanho_evidencia`.
- Colunas novas: `origem_tamanho_evidencia`, `origem_tamanho_confirmado_em`,
  `origem_tamanho_confirmado_por`.
