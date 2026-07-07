## Objetivo

Registrar o **Blueprint Oficial do MVP v1.0** como fonte única da verdade em `mem://`, para que toda decisão futura (sprints, refactors, painel admin) obedeça automaticamente às regras — sem alterar código nesta etapa.

## O que será criado

1. **`mem://index.md`** — índice do projeto com uma seção **Core** contendo as regras universais (aplicadas a cada ação) e referências aos arquivos detalhados.

2. **`mem://blueprint/visao.md`** (feature) — Visão do produto, objetivos do MVP e arquitetura de módulos (Cliente × Admin).

3. **`mem://blueprint/arquitetura.md`** (feature) — Fonte única da verdade, estado global compartilhado, fluxos de atualização automática (produto → catálogo → estoque → dashboard → financeiro).

4. **`mem://blueprint/principios.md`** (preference) — Princípios de código: separação interface/lógica/dados, responsabilidade única, tipagem forte, sem duplicação de estado/componentes/lógica.

5. **`mem://blueprint/identidade-visual.md`** (constraint) — Itens **imutáveis**: Hero, vídeo, tipografia, estrutura, animações, microinterações, UX, Design System, cores, identidade editorial. Painel admin edita apenas conteúdo operacional.

6. **`mem://blueprint/regras-absolutas.md`** (constraint) — Regras que nunca podem ser quebradas: estoque/preço negativo, pedido vazio/sem cliente, apagar histórico de pedidos/estoque/logs, estados duplicados, inconsistência entre módulos, quebra de layout.

7. **`mem://blueprint/qualidade.md`** (preference) — Metas de desempenho (60 FPS, lazy loading, code splitting, memoização), responsividade (Desktop/Notebook/Tablet/Mobile sem overflow ou quebra) e segurança (nenhum secret no front).

### Core do índice (sempre em contexto)

Resumos curtos, aplicados em toda ação:
- Duas áreas independentes: Cliente (pública) × Admin (gestão). Nunca vazar dado admin no cliente.
- Fonte única da verdade; nada duplicado (estado, componentes, lógica).
- Identidade visual aprovada é imutável (Hero, vídeo, tipografia, cores, animações, DS).
- Painel admin altera apenas conteúdo operacional (produtos, preços, fotos, contatos, horários).
- Nunca: estoque/preço negativo, pedido vazio ou sem cliente, apagar histórico ou logs, quebrar layout responsivo.
- Segurança: zero secrets/keys/tokens no front.
- Performance: 60 FPS, lazy loading, code splitting, baixo re-render.

## O que NÃO será feito agora

- Nenhuma alteração de código, rota, componente ou schema.
- Nenhuma auditoria/refactor da área do cliente.
- Nenhum início de sprint do painel admin (fica para a próxima aprovação sua).

## Próximo passo sugerido (após esta aprovação)

Escolher entre: (a) auditar o código atual contra o Blueprint e listar divergências, ou (b) iniciar o planejamento do painel admin já ancorado nestas memórias.
