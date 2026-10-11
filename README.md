# ELE(S) NÃO!

Bata nele até ele sumir. Uma peça interativa no navegador, quase um jogo:
levante as mãos na frente da câmera e bata — tapa de mão aberta, soco de punho
fechado. Cada golpe faz barulho, solta estrelinhas brancas e encolhe a cabeça;
o soco encolhe mais. As palavras atrás se movem com as mãos e com os golpes,
menos que a cabeça. Quando ela some, estrelas vermelhas de cinco pontas
irregulares (desenhadas a partir de duas estrelas da Nath) aparecem uma a uma
até encher a tela e não param de se esticar e se rearranjar, em volta de uma
estrela com o 13; a mão para de seguir a câmera e faz o L, e toca "Lula lá"
em loop. (O estilo anterior, uma estrela só com as suas
repetições vibrando atrás, continua em `?estrela=eco` no fim do link.) Um dedo deixa tudo lento, cinco aceleram. Bater palma não faz nada.

O som (só saída, nada de microfone) liga e desliga no ícone do canto inferior
esquerdo, ou com M. Os créditos abrem no canto inferior direito.

\* Isso não é um incentivo à violência, apenas uma forma de extravasar a raiva
que estamos sentindo nesse momento.

| | |
|---|---|
| Tapa (mão aberta) | tira 7 de 100 |
| Soco (punho fechado) | tira 13 de 100 |
| Depois da estrela | **DE NOVO** (ou R / Enter) recomeça; sozinho, recomeça em 20 s |

Os valores ficam no topo de `src/main.ts`.

Câmera e gravação: no canto inferior esquerdo, o ícone de câmera (ou C) mostra
a sua imagem no canto superior direito, e o REC (ou G) grava o jogo, com a
câmera e o som, num vídeo salvo no seu aparelho (MP4 onde o navegador permite,
senão WebM); nada é enviado. `?camera` no fim do link já abre com a câmera
ligada e com a abertura para os stories.

**Abrir:** https://nathaliacuryde-88.github.io/eles-nao/

A câmera fica só no navegador de quem abre: o rastreio das mãos
([MediaPipe](https://developers.google.com/mediapipe)) roda ali mesmo, nada é
gravado nem enviado.

Por Nathalia Cury ([@nathcury](https://www.instagram.com/nathcury/)), a partir de duas camadas do n4thVJ fixadas como no set
"mische intro": **Slap** embaixo, **Big Type** por cima a 75% em *Difference*.

## Créditos

| | |
|---|---|
| [Jair Bolsonaro](https://sketchfab.com/3d-models/jair-bolsonaro-6ac0a141bab743c5bab4c520f104a475) por [lexferreira89](https://sketchfab.com/lexferreira89) | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) — a cabeça, deformada e balançada ao vivo |
| [Strichpunkt Sans](https://fonts.google.com/specimen/Strichpunkt+Sans) por [Strichpunkt](https://github.com/strichpunkt-design/Strichpunkt_Sans) | SIL Open Font License 1.1 |
| "Lula lá" (jingle) | trecho de 0:23,5 a 0:39, em loop na vitória (`src/app/assets/lula-la-loop.wav`) |
| [three.js](https://threejs.org/) | MIT |
| [MediaPipe Tasks Vision](https://developers.google.com/mediapipe) | Apache-2.0, carregado do jsDelivr |

## Desenvolvimento

```
npm install
npm run dev      # http://localhost:5173
npm run build    # gera docs/, que o GitHub Pages publica
```

## Por que cada golpe

A cada tapa ou soco aparece uma razão (lista em `REASONS`, no topo de `src/main.ts`). Fontes:

- Vorcaro: [Agência Câmara](https://www.camara.leg.br/noticias/1272121-repasse-de-recursos-de-vorcaro-a-flavio-bolsonaro-reforca-pressao-por-cpi-do-banco-master), [Intercept](https://www.intercept.com.br/2026/05/13/audio-flavio-negociou-vorcaro-milhoes/), [Revista Fórum](https://revistaforum.com.br/politica/fake-news-flavio-bolsonaro-banco-mmaster/)
- Rachadinha e loja de chocolate: [Poder360](https://www.poder360.com.br/poder-justica/gilmar-nega-pedido-para-reabrir-acao-contra-flavio-por-rachadinha/), [Acessa](https://www.acessa.com/politica/2026/03/313993-caso-da-rachadinha-de-flavio-bolsonaro-foi-encerrado-com-perguntas-nao-respondidas.html)
- Mansão e BRB: [Diário de Pernambuco](https://www.diariodepernambuco.com.br/politica/2026/10/11725606-pf-apura-condicoes-de-financiamento-do-brb-a-flavio-bolsonaro-para-mansao-de-rs-6-milhoes.html), [Jornal de Brasília](https://jornaldebrasilia.com.br/noticias/politica-e-poder/flavio-bolsonaro-disse-ganhar-r-57-mil-metade-com-chocolates-ao-fazer-emprestimo-por-mansao/)
- Adriano da Nóbrega: [Poder360](https://www.poder360.com.br/governo/bolsonaro-diz-que-adriano-da-nobrega-era-1-heroi-quando-foi-homenageado/), [Bem Paraná](https://www.bemparana.com.br/noticia/ex-policial-militar-estava-preso-quando-filho-de-presidente-o-homenageou)
- Terras raras e Trump: [JB](https://www.jb.com.br/brasil/politica/2026/09/1060892-rumores-de-eventual-financiamento-por-rede-de-investidores-trumpistas-aumenta-pressao-sobre-campanha-de-flavio-bolsonaro.html), [O Hoje](https://ohoje.com/2026/04/06/flavio-se-diz-bolsonaro-2-0-e-pede-que-trump-interfira-em-territorios-brasileiros/), [SBT News](https://sbtnews.sbt.com.br/noticia/politica/flavio-exalta-reuniao-com-trump-inedito-na-historia-do-brasil)
- Anistia e candidatura: [Diário de Pernambuco](https://www.diariodepernambuco.com.br/politica/2025/12/11702315-flavio-define-anistia-como-prioridade-apos-ser-escolhido-para-disputa-a-presidencia.html), [Mais Goiás](https://www.maisgoias.com.br/brasil/nao-reeleger-lula-e-o-que-vai-salvar-meu-pai-da-prisao-diz-flavio-bolsonaro/), [Al Jazeera](https://www.aljazeera.com/news/2025/12/6/flavio-bolsonaro-enters-brazils-2026-presidential-race-with-fathers-nod)
- Eduardo, tarifaço e sanções: [Sul21](https://sul21.com.br/noticias/politica/2025/08/pf-indicia-bolsonaro-e-eduardo-em-inquerito-sobre-sancoes-dos-eua/), [O Cafezinho](https://www.ocafezinho.com/2025/09/23/pgr-denuncia-eduardo-bolsonaro-por-coacao-a-justica/amp/)
