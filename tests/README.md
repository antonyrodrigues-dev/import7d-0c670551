# Testes — 7D IMPORTS

## E2E (Playwright / Python)

Cobre a jornada de Reserva em Desktop (1440×900), Tablet (820×1180) e Mobile
(390×844): adicionar produto, atualizar quantidades, remover item e
abrir/fechar o drawer via botão e tecla ESC.

```bash
bun run dev            # em outro terminal
python tests/e2e/reserva.spec.py
```

Requer `playwright` (Python) + Chromium instalados.

## Lighthouse CI

Configuração em `lighthouserc.json` com budgets:

- Performance ≥ 0.9, A11y ≥ 0.95, SEO ≥ 0.95
- CLS ≤ 0.1, LCP ≤ 2.5s, TBT ≤ 200ms, INP ≤ 200ms
- Imagens ≤ 800KB, JS ≤ 350KB, Mídia (vídeo hero) ≤ 3.5MB

```bash
bun run build && bun run preview &
npx @lhci/cli autorun --config=./lighthouserc.json
```

## Analytics

Eventos disparados via `src/lib/analytics.ts`, enviados para
`window.dataLayer` (GTM/GA4) quando presente. Em dev, log no console:

- `reserve_add` — clique em "Adicionar à Reserva" (ProductSheet)
- `reserve_open` — abertura do drawer pelo header
- `reserve_qty_change` — +/– de quantidade
- `reserve_remove` — remoção de item
- `checkout_step` — avanço entre etapas
- `checkout_whatsapp` — geração do link final