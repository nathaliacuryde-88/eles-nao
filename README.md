# ELE(S) NÃO!

Bata nele até ele sumir. Uma peça interativa no navegador, quase um jogo:
levante as mãos na frente da câmera e bata — tapa de mão aberta, soco de punho
fechado. Cada golpe faz barulho, solta estrelinhas brancas e encolhe a cabeça;
o soco encolhe mais. As palavras atrás se movem com as mãos e com os golpes,
menos que a cabeça. Quando ela some, estrelas vermelhas irregulares aparecem
uma a uma até encher a tela, em volta de uma estrela com o 13, e a mão para de
seguir a câmera e faz o L. (O estilo anterior, uma estrela só com as suas
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

**Abrir:** https://nathaliacuryde-88.github.io/eles-nao/

A câmera fica só no navegador de quem abre: o rastreio das mãos
([MediaPipe](https://developers.google.com/mediapipe)) roda ali mesmo, nada é
gravado nem enviado.

Por Nathalia Cury (@nathcury), a partir de duas camadas do n4thVJ fixadas como no set
"mische intro": **Slap** embaixo, **Big Type** por cima a 75% em *Difference*.

## Créditos

| | |
|---|---|
| [Jair Bolsonaro](https://sketchfab.com/3d-models/jair-bolsonaro-6ac0a141bab743c5bab4c520f104a475) por [lexferreira89](https://sketchfab.com/lexferreira89) | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) — a cabeça, deformada e balançada ao vivo |
| [Strichpunkt Sans](https://fonts.google.com/specimen/Strichpunkt+Sans) por [Strichpunkt](https://github.com/strichpunkt-design/Strichpunkt_Sans) | SIL Open Font License 1.1 |
| [three.js](https://threejs.org/) | MIT |
| [MediaPipe Tasks Vision](https://developers.google.com/mediapipe) | Apache-2.0, carregado do jsDelivr |

## Desenvolvimento

```
npm install
npm run dev      # http://localhost:5173
npm run build    # gera docs/, que o GitHub Pages publica
```
