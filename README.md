# 7d imports

7D TECHNICAL EXCELLENCE SYSTEM v1.0

PRINCÍPIO TÉCNICO CENTRAL

A aplicação não deve ser construída apenas para funcionar hoje.

Ela deve nascer preparada para crescer sem reestruturações profundas.

Toda decisão técnica deve priorizar:

Estabilidade

Segurança

Escalabilidade

Performance

SEO

Acessibilidade

Conversão

Estética

Nunca inverter essa ordem.

SEO SYSTEM

Toda página deve nascer otimizada para mecanismos de busca.

Implementar obrigatoriamente:

Sitemap

sitemap.xml automático

Atualização automática ao adicionar páginas

URLs indexáveis

Estrutura limpa

Robots

robots.txt configurado

Bloquear apenas páginas administrativas

Permitir indexação das páginas públicas

Meta Tags

Toda página deve possuir:

title único

meta description única

canonical URL

keywords contextuais

Nunca reutilizar metadados genéricos.

Open Graph

Implementar:

og:title

og:description

og:image

og:url

og:type

Compatível com:

WhatsApp

Facebook

Instagram

LinkedIn

Structured Data

Implementar Schema.org:

Organization

Website

LocalBusiness (quando aplicável)

BreadcrumbList

Product (quando existir catálogo)

URLs

Sempre amigáveis.

Exemplos:

/acervo

/manifesto

/produto/nome-da-peca

Nunca:

?id=123

?page=1

&item=abc

ACCESSIBILITY SYSTEM

Meta mínima:

WCAG AA

Obrigatório:

Navegação

100% funcional via teclado

Tab order lógica

Sem armadilhas de foco

Focus States

Todo elemento clicável deve possuir:

foco visível

contraste adequado

navegação clara

Nunca remover outline sem substituição acessível.

Screen Readers

Todo conteúdo relevante deve possuir:

labels

aria-labels

aria-expanded

aria-hidden quando necessário

Imagens

Todas devem possuir:

alt descritivo

Nunca utilizar alt vazio em conteúdo importante.

Contraste

Todo texto deve atingir WCAG AA.

Nenhum texto pode perder legibilidade sobre:

vídeo

imagem

textura

overlay

ANIMATION ENGINE

Todas as animações devem utilizar aceleração por GPU.

Animar apenas:

transform

opacity

Nunca animar:

width

height

top

left

margin

Evitar:

Layout Shift

Reflow excessivo

Jank visual

Meta:

60 FPS constante.

PERFORMANCE ENGINE

Meta obrigatória:

Performance > 95

Accessibility > 95

Best Practices > 95

SEO > 95

Hero Video

Obrigatório:

poster .webp

máximo 50kb

primeiro frame otimizado

O vídeo nunca pode bloquear:

FCP

LCP

Implementar:

preload="metadata"

loading inteligente

Arquivos:

mp4 otimizado

webm otimizado

Sem áudio.

Imagens

Obrigatório:

WebP

Lazy Loading

Responsive Images

Width e Height definidos

Evitar CLS.

Código

Obrigatório:

Code Splitting

Dynamic Imports

Tree Shaking

Componentes reutilizáveis

Nunca importar bibliotecas sem necessidade.

STATE MANAGEMENT SYSTEM

O estado global da aplicação deve ser centralizado.

Utilizar:

Zustand (preferencial)
ou

React Context API

Gerenciar:

Reserva

Catálogo

Preferências

UI State

Toda alteração deve refletir imediatamente na interface.

Sem recarregamento.

Sem hacks.

WHATSAPP ENGINE

Toda reserva deve gerar:

Resumo formatado automaticamente.

Exemplo:

━━━━━━━━━━━━━━

7D IMPORTS

Produto:
Tamanho:
Quantidade:

━━━━━━━━━━━━━━

Solicito atendimento.

━━━━━━━━━━━━━━

Utilizar URL Encode.

Nunca hardcode números.

Todos os atendentes devem vir de:

config/attendants.ts

ou

variáveis centralizadas.

RESPONSIVE SYSTEM

Ordem de desenvolvimento:

Mobile

Tablet

Desktop

Nunca o contrário.

Obrigatório validar:

320px

375px

390px

768px

1024px

1440px

Nenhuma quebra visual.

Nenhum scroll horizontal.

BROWSER COMPATIBILITY

Garantir funcionamento em:

Chrome

Edge

Firefox

Safari

Safari iOS

Android Chrome

Não utilizar APIs experimentais sem fallback.

COMPONENT VALIDATION SYSTEM

Antes de criar qualquer componente responder:

Qual objetivo de negócio?

Qual objetivo de UX?

Qual objetivo de conversão?

Qual objetivo técnico?

Se não responder aos quatro:

não implementar.

EXPANSION SYSTEM

Toda arquitetura deve prever:

Área Administrativa

Analytics

CRM

Estoque

ERP

Fidelização

Marketplace futuro

Integrações futuras

Não implementar essas áreas agora.

Apenas preparar arquitetura compatível.

DOCUMENTATION SYSTEM

Toda funcionalidade criada deve possuir:

descrição

responsabilidade

dependências

fluxo

Arquitetura legível.

Código autoexplicativo.

FINAL VALIDATION CHECKLIST

Antes de concluir qualquer página executar:

✓ Segurança

✓ Performance

✓ Escalabilidade

✓ Conversão

✓ Responsividade

✓ UX

✓ LGPD

✓ SEO

✓ Acessibilidade

✓ Compatibilidade

✓ Consistência Visual

✓ Consistência de Motion

✓ Consistência de Marca

Somente após aprovação de todos os itens a implementação pode ser considerada concluída.

REGRA FINAL

Nunca criar código apenas para concluir uma tarefa.

Criar código preparado para evolução futura.

Nunca escolher a solução mais rápida.

Escolher a solução mais robusta, sustentável e compatível com a visão premium da 7D Imports.
7D EXPERIENCE SYSTEM v1.0

PRINCÍPIO ABSOLUTO

O usuário não deve sentir que entrou em uma loja virtual.

O usuário deve sentir que entrou em um acervo privado de peças selecionadas.

Toda interação deve transmitir:

Exclusividade

Precisão

Sofisticação

Controle

Curadoria

Nunca transmitir:

Marketplace

Promoção

Varejo popular

Loja genérica

Template IA

ESTRUTURA COMPLETA DAS PÁGINAS

HOME

Ordem obrigatória:

Hero Cinemático

Manifesto

Coleção em Destaque

Acervo Completo

Diferenciais

Atendimento

Rodapé

Nenhuma seção adicional deve ser criada sem justificativa.

HERO SECTION

Altura:

100vh

Ocupação:

100% da viewport.

VÍDEO

Posicionamento:

Background absoluto.

Cobrir toda a tela.

object-fit: cover.

Qualidade:

1080p mínimo

60 FPS preferencial

Sem filtros artificiais

Sem LUT exagerada

Sem granulação falsa

O vídeo deve parecer editorial.

Não publicitário.

Movimento:

Extremamente lento.

Quase imperceptível.

O usuário deve sentir vida.

Não perceber animação.

Overlay:

Muito sutil.

Máximo 8%.

Apenas para garantir contraste.

Nunca escurecer excessivamente o vídeo.

LOGO

Posicionamento:

Centralizada visualmente.

Preferência:

7D IMPORTS completo.

Não apenas 7D.

A marca precisa ser reconhecida.

Animação inicial:

Fade:

0 → 100%

Duração:

1200ms

Sem bounce.

Sem scale.

HEADLINE

Estrutura:

7D IMPORTS

ACESSO A PEÇAS SELECIONADAS

Subheadline:

Curadoria premium.
Atendimento personalizado.
Entrega para todo o Brasil.

Alinhamento:

Centro.

Animação:

Slide Up:

20px → 0px

Opacity:

0 → 1

Duração:

800ms

Delay:

200ms após logo.

CTA HERO

Texto:

EXPLORAR ACERVO

Estilo:

Transparente.

Borda fina.

Verde escuro.

Tracking amplo.

Hover:

Linha cresce.

Texto desloca 2px.

Scale máximo:

1.02

Active:

0.98

Nunca:

Glow.

Gradiente.

Bounce.

Pulsação.

HEADER

Estado inicial:

Transparente.

Após scroll:

Fundo creme sólido.

Blur extremamente leve.

Máximo:

6px.

Altura:

72px desktop.

64px mobile.

Elementos:

Centro:

Logo.

Direita:

Busca
Reserva
Menu

Animações:

Fade suave.

Sem deslocamentos bruscos.

BUSCA

Abertura:

Drawer lateral.

Não modal central.

Transição:

Deslizar pela direita.

400ms.

Campo:

Largura ampla.

Busca instantânea.

Resultados:

Imagem
Nome
Preço

Sem:

Popups.

Sem overlays agressivos.

CATÁLOGO

Objetivo:

Galeria editorial.

Não marketplace.

Grid:

Desktop:

3 colunas.

Tablet:

2 colunas.

Mobile:

1 coluna.

Imagens:

Dominam a tela.

80% do foco visual.

Hover Desktop:

Zoom:

1.03

Movimento:

translateY(-4px)

Mobile:

Scale:

0.98

Retorno suave.

PRODUCT SHEET

Abrir:

Bottom Sheet.

Altura:

80vh

Animação:

Spring controlado.

Sem bounce.

Conteúdo:

Imagem principal.

Galeria.

Nome.

Descrição.

Tamanhos.

Quantidade.

Preço.

Botão Reservar.

RESERVA

Nunca chamar:

Carrinho.

Nome:

RESERVA

ou

SUA SELEÇÃO

Fluxo:

Produto

↓

Adicionar

↓

Reserva

↓

WhatsApp

Antes do WhatsApp:

Mostrar resumo editorial.

MANIFESTO

Objetivo:

Construir valor.

Não vender.

Primeira frase:

NÃO VENDEMOS ROUPAS.

CURAMOS PRESENÇA.

Animação:

Palavra por palavra.

Muito lenta.

Muito elegante.

Imagem:

Editorial.

Parcialmente sobreposta.

Parallax:

Máximo 5%.

TEXTURAS

Permitido:

Linho

Papel premium

Grão cinematográfico

Tecido

Proibido:

Circuitos

Tech

Futurismo

Cyberpunk

Opacidade máxima:

3%

SCROLL EXPERIENCE

Objetivo:

Sensação de revista digital.

Ao descer:

Elementos revelam.

Nunca surgem abruptamente.

Animações:

Opacity

Transform

Somente.

Nunca:

Height.

Width.

Top.

Left.

TRANSIÇÕES DE TELA

Tempo:

600–900ms.

Estilo:

Editorial.

Sensação:

Folhear revista.

Não aplicativo.

FOOTER

4 Colunas:

Marca

Acervo

Suporte

Legal

Detalhes:

Dourado fosco.

Links:

Underline animado.

MOBILE EXPERIENCE

Todo elemento deve funcionar sem hover.

Toda ação deve funcionar por toque.

Nenhum conteúdo pode depender de mouse.

PERFORMANCE

Meta obrigatória:

Performance > 95

SEO > 95

Accessibility > 95

Best Practices > 95

60 FPS em toda navegação.

Evitar:

Layout Shift.

CLS.

Jank.

Reflows excessivos.

REGRA FINAL

Sempre que existir conflito entre:

Estética
ou
Performance

Escolher Performance.

Sempre que existir conflito entre:

Quantidade de elementos
ou
Elegância

Escolher Elegância.

Sempre que existir conflito entre:

Efeito visual
ou
Experiência premium

Escolher Experiência Premium.

7D EXPERIENCE SYSTEM v1.0

PRINCÍPIO ABSOLUTO

O usuário não deve sentir que entrou em uma loja virtual.

O usuário deve sentir que entrou em um acervo privado de peças selecionadas.

Toda interação deve transmitir:

Exclusividade

Precisão

Sofisticação

Controle

Curadoria

Nunca transmitir:

Marketplace

Promoção

Varejo popular

Loja genérica

Template IA

ESTRUTURA COMPLETA DAS PÁGINAS

HOME

Ordem obrigatória:

Hero Cinemático

Manifesto

Coleção em Destaque

Acervo Completo

Diferenciais

Atendimento

Rodapé

Nenhuma seção adicional deve ser criada sem justificativa.

HERO SECTION

Altura:

100vh

Ocupação:

100% da viewport.

VÍDEO

Posicionamento:

Background absoluto.

Cobrir toda a tela.

object-fit: cover.

Qualidade:

1080p mínimo

60 FPS preferencial

Sem filtros artificiais

Sem LUT exagerada

Sem granulação falsa

O vídeo deve parecer editorial.

Não publicitário.

Movimento:

Extremamente lento.

Quase imperceptível.

O usuário deve sentir vida.

Não perceber animação.

Overlay:

Muito sutil.

Máximo 8%.

Apenas para garantir contraste.

Nunca escurecer excessivamente o vídeo.

LOGO

Posicionamento:

Centralizada visualmente.

Preferência:

7D IMPORTS completo.

Não apenas 7D.

A marca precisa ser reconhecida.

Animação inicial:

Fade:

0 → 100%

Duração:

1200ms

Sem bounce.

Sem scale.

HEADLINE

Estrutura:

7D IMPORTS

ACESSO A PEÇAS SELECIONADAS

Subheadline:

Curadoria premium.
Atendimento personalizado.
Entrega para todo o Brasil.

Alinhamento:

Centro.

Animação:

Slide Up:

20px → 0px

Opacity:

0 → 1

Duração:

800ms

Delay:

200ms após logo.

CTA HERO

Texto:

EXPLORAR ACERVO

Estilo:

Transparente.

Borda fina.

Verde escuro.

Tracking amplo.

Hover:

Linha cresce.

Texto desloca 2px.

Scale máximo:

1.02

Active:

0.98

Nunca:

Glow.

Gradiente.

Bounce.

Pulsação.

HEADER

Estado inicial:

Transparente.

Após scroll:

Fundo creme sólido.

Blur extremamente leve.

Máximo:

6px.

Altura:

72px desktop.

64px mobile.

Elementos:

Centro:

Logo.

Direita:

Busca
Reserva
Menu

Animações:

Fade suave.

Sem deslocamentos bruscos.

BUSCA

Abertura:

Drawer lateral.

Não modal central.

Transição:

Deslizar pela direita.

400ms.

Campo:

Largura ampla.

Busca instantânea.

Resultados:

Imagem
Nome
Preço

Sem:

Popups.

Sem overlays agressivos.

CATÁLOGO

Objetivo:

Galeria editorial.

Não marketplace.

Grid:

Desktop:

3 colunas.

Tablet:

2 colunas.

Mobile:

1 coluna.

Imagens:

Dominam a tela.

80% do foco visual.

Hover Desktop:

Zoom:

1.03

Movimento:

translateY(-4px)

Mobile:

Scale:

0.98

Retorno suave.

PRODUCT SHEET

Abrir:

Bottom Sheet.

Altura:

80vh

Animação:

Spring controlado.

Sem bounce.

Conteúdo:

Imagem principal.

Galeria.

Nome.

Descrição.

Tamanhos.

Quantidade.

Preço.

Botão Reservar.

RESERVA

Nunca chamar:

Carrinho.

Nome:

RESERVA

ou

SUA SELEÇÃO

Fluxo:

Produto

↓

Adicionar

↓

Reserva

↓

WhatsApp

Antes do WhatsApp:

Mostrar resumo editorial.

MANIFESTO

Objetivo:

Construir valor.

Não vender.

Primeira frase:

NÃO VENDEMOS ROUPAS.

CURAMOS PRESENÇA.

Animação:

Palavra por palavra.

Muito lenta.

Muito elegante.

Imagem:

Editorial.

Parcialmente sobreposta.

Parallax:

Máximo 5%.

TEXTURAS

Permitido:

Linho

Papel premium

Grão cinematográfico

Tecido

Proibido:

Circuitos

Tech

Futurismo

Cyberpunk

Opacidade máxima:

3%

SCROLL EXPERIENCE

Objetivo:

Sensação de revista digital.

Ao descer:

Elementos revelam.

Nunca surgem abruptamente.

Animações:

Opacity

Transform

Somente.

Nunca:

Height.

Width.

Top.

Left.

TRANSIÇÕES DE TELA

Tempo:

600–900ms.

Estilo:

Editorial.

Sensação:

Folhear revista.

Não aplicativo.

FOOTER

4 Colunas:

Marca

Acervo

Suporte

Legal

Detalhes:

Dourado fosco.

Links:

Underline animado.

MOBILE EXPERIENCE

Todo elemento deve funcionar sem hover.

Toda ação deve funcionar por toque.

Nenhum conteúdo pode depender de mouse.

PERFORMANCE

Meta obrigatória:

Performance > 95

SEO > 95

Accessibility > 95

Best Practices > 95

60 FPS em toda navegação.

Evitar:

Layout Shift.

CLS.

Jank.

Reflows excessivos.

REGRA FINAL

Sempre que existir conflito entre:

Estética
ou
Performance

Escolher Performance.

Sempre que existir conflito entre:

Quantidade de elementos
ou
Elegância

Escolher Elegância.

Sempre que existir conflito entre:

Efeito visual
ou
Experiência premium

Escolher Experiência Premium.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://import7d.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/742a8d89-b85d-4176-8381-749db0e780fd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
