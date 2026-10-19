# Damas Brasileiras 3D — Edição Sanctum

Conversão completa da experiência 3D em catedral gótica para o tradicional **Jogo de Damas Brasileiro** (tabuleiro 8×8 de 64 casas), substituindo o xadrez por 12 pedras operárias de cada lado, mecânica oficial de captura obrigatória com Lei da Maioria, damas voadoras que correm a diagonal e transformação visual no modelo da Rainha com detalhes dourados.

## User Review & Critical Decisions

> [!IMPORTANT]
> As seguintes decisões foram confirmadas e orientam a arquitetura da conversão para Damas Brasileiras:

- **Modelo Visual da Dama (Confirmado)**: As peças iniciais utilizam exclusivamente o modelo 3D dos operários/peões esculpidos em pedra. Ao alcançar a última fileira adversária ao final do turno, a peça se transforma no modelo 3D da **Rainha esculpida com brilho e acabamento dourado**.
- **Regras de Captura (Confirmado)**: Aplicação das **regras oficiais da Dama Brasileira** em tabuleiro 8×8 (64 casas, 12 pedras por jogador nas casas escuras), incluindo **captura obrigatória** (para frente e para trás), **capturas múltiplas em cadeia** e **Lei da Maioria** (obrigatoriedade de optar pelo lance que capture o maior número de pedras).
- **Modos de Disputa (Confirmado)**: Disponibilização de modo **Jogador contra IA** (com botão de jogada imediata e escolha de cor) e modo **2 Jogadores Local** no mesmo dispositivo.

---

## 1. Overview & Core Concept

- **O Que Faz**: Oferece uma partida completa de Damas Brasileiras em um cenário 3D imersivo sobre o altar de obsidiana da catedral gótica. As peças ganham vida com animações de caminhada, combate corpo a corpo ao saltar e estilhaçar pedras capturadas, e efeitos luminosos de coroação ao se tornarem Damas.
- **Público-Alvo**: Jogadores que apreciam o clássico jogo de damas brasileiro e buscam uma experiência visual cinematográfica em 3D, seja enfrentando o computador ou desafiando um amigo localmente.
- **Valor Principal**: Combina a fidelidade matemática das regras tradicionais brasileiras (pedra só anda para frente, mas come para frente e para trás; Dama corre toda a diagonal; captura máxima obrigatória) com a coreografia de câmera e física de destruição de pedra do motor 3D.

---

## 2. User Experience & Visual Design

- **Fluxo Principal de Jogo**:
  1. **Início da Partida**: O tabuleiro 8×8 (com casa escura no canto inferior esquerdo e casa clara no canto inferior direito de cada jogador) é preenchido com 12 pedras brancas nas três primeiras fileiras (linhas 5, 6 e 7) e 12 pedras pretas nas três fileiras opostas (linhas 0, 1 e 2), todas posicionadas nas casas escuras.
  2. **Seleção e Indicação de Captura Obrigatória**: Ao clicar em uma pedra no seu turno, o sistema destaca em azul os movimentos simples válidos ou em vermelho-dourado os destinos de captura. Caso haja captura obrigatória disponível no tabuleiro, o painel superior indica claramente que uma captura deve ser realizada e filtra apenas as peças que cumprem a **Lei da Maioria**.
  3. **Execução e Salto com Combate 3D**: Em movimentos simples, a pedra desliza suavemente na diagonal para a frente. Em capturas, a pedra avança até a peça inimiga, desfere o golpe que estilhaça o oponente em fragmentos de rocha e pousa na casa vazia seguinte após a peça comida (ou segue em cadeia caso haja múltiplas capturas).
  4. **Coroação em Dama**: Quando um operário encerra seu movimento na última linha do adversário, um clarão dourado ilumina a casa e a estátua é substituída pela **Rainha Coroada (Dama)** com ornamentos em ouro reluzente, passando a poder correr livremente pelas diagonais.
  5. **Encerramento e Vitória**: Quando um lado perde todas as 12 peças ou fica totalmente bloqueado sem movimentos legais, o banner de julgamento anuncia o vencedor com opção de revanche imediata.

- **Identidade Visual & Tema**:
  - *Direção Estética*: Chiaroscuro gótico litúrgico em pedra calcária, mármore claro, obsidiana escura e ouro forjado à luz de braseiros.
  - *Paleta de Cores*: Fundo atmosférico profundo (`#080a0f`), superfícies do HUD em tom escuro translúcido (`rgba(12, 15, 22, 0.82)`), acentos reais em ouro (`#d4af37` / `#f5d76e`), indicadores de movimento em azul celeste (`#4ea8de`) e anéis de captura em carmesim (`#e63946`).
  - *Tipografia & Hierarquia*: Títulos clássicos em destaque com numeração tabular (`tabular-nums`) para o placar de pedras restantes e capturadas, e textos de status concisos em português.
  - *Layout & HUD Desobstruído*: Barra superior enxuta contendo o título **Damas Brasileiras**, indicador de turno/captura obrigatória e botões de ação rápida (Alternar Modo IA / 2 Jogadores, Trocar Cor, Jogada da IA, Nova Partida e Câmeras).

---

## 3. Key Product Decisions & Trade-Offs

- **Decisão 1: Tabuleiro 8×8 de 64 Casas (Padrão Brasileiro)**
  - *Abordagem Escolhida*: Manter a geometria exata de 8×8 casas do altar (`BOARD_SQ_SIZE = 0.34m`) com posicionamento exclusivo nas 32 casas escuras (`(linha + coluna) % 2 === 1`).
  - *Por Quê*: A Dama Brasileira oficial utiliza exatamente o tabuleiro de 64 casas com 12 pedras de cada lado, diferenciando-se da dama internacional de 100 casas. Isso preserva a proporção perfeita das esculturas sobre o altar da catedral.
- **Decisão 2: Motor Recursivo de Captura em Cadeia e Lei da Maioria**
  - *Abordagem Escolhida*: Implementar um buscador em profundidade (DFS) que calcula todas as árvores de captura possíveis para cada peça no início do turno, determinando o número máximo global de capturas ($N_{\max}$) e permitindo apenas sequências que atinjam $N_{\max}$.
  - *Por Quê*: Garante fidelidade total à regra brasileira (onde tanto pedras comuns quanto Damas capturam para frente e para trás, sem poder saltar duas vezes sobre a mesma peça no mesmo turno, e a coroação só ocorre se o turno terminar na casa de coroação).
- **Decisão 3: Coreografia de Captura por Salto Diagonal**
  - *Abordagem Escolhida*: Adaptar a cinemática de duelo para que a peça atacante se aproxime da peça inimiga na casa intermediária, execute a animação de ataque com estilhaçamento de pedra e conclua o salto pousando na casa de destino vazia além da vítima.
  - *Por Quê*: Na dama, a peça não ocupa a casa da peça comida, mas sim salta por cima dela. Essa coreografia une o impacto visual do combate 3D com a posição final correta da regra de damas.

---

## 4. Technical Architecture & Data Strategy

### Diagrama de Arquitetura e Componentes

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Interface React & HUD (PT-BR)                    │
│  ┌─────────────────────────┐  ┌────────────────────┐  ┌──────────────┐  │
│  │ Status do Turno &       │  │ Controles de Jogo  │  │ Presets de   │  │
│  │ Alerta de Lei da Maioria│  │ (vs IA / 2P Local) │  │ Câmera 3D    │  │
│  └────────────┬────────────┘  └─────────┬──────────┘  └──────┬───────┘  │
└───────────────┼─────────────────────────┼────────────────────┼──────────┘
                │                         │                    │
                ▼                         ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  Motor de Regras — Damas Brasileiras (8x8)              │
│  ┌─────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Gerador de Movimentos   │  │ Avaliador Recursivo (DFS)            │  │
│  │ • Pedra: 1 casa frente  │  │ • Captura frente/trás (Pedra & Dama) │  │
│  │ • Dama: diagonal livre  │  │ • Filtro global da Lei da Maioria    │  │
│  └────────────┬────────────┘  └──────────────────┬───────────────────┘  │
│               └─────────────────┬────────────────┘                      │
│                                 ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Inteligência Artificial Tática (Minimax / Heurística de Damas)    │  │
│  │ • Prioriza coroação, controle central, proteção de bordas e damas │  │
│  └──────────────────────────────┬────────────────────────────────────┘  │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   Cena Three.js & Coreografia 3D                        │
│  ┌─────────────────────────┐  ┌────────────────────┐  ┌──────────────┐  │
│  │ Modelos GLB Carregados  │  │ Cinemática de Salto│  │ Coroação     │  │
│  │ • Peão -> Pedra comum   │  │ • Golpe na vítima  │  │ • Troca p/   │  │
│  │ • Rainha Ouro -> Dama   │  │ • Pouso pós-salto  │  │   Rainha Ouro│  │
│  └─────────────────────────┘  └────────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Modelo de Dados e Estado do Tabuleiro

- **Representação das Peças (`boardState[8][8]`)**:
  - `type`: `'pawn'` (Pedra comum / Operário) ou `'queen'` (Dama coroada). Os demais modelos do xadrez (`king`, `rook`, `bishop`, `knight`) são removidos do carregamento e do tabuleiro.
  - `color`: `'w'` (Brancas, iniciam nas linhas 5, 6 e 7) ou `'b'` (Pretas, iniciam nas linhas 0, 1 e 2).
  - `isKing` / `type === 'queen'`: Identifica se a peça já foi promovida a Dama, aplicando o material especial com realce dourado (`damaGoldMat`) e habilitando movimentação e captura de longo alcance nas diagonais.
- **Estrutura de Movimento e Captura**:
  - Cada movimento legal possui `{ fromR, fromC, toR, toC, capture: boolean, capturedSquare: { r, c } | null, chainMoves: Array, maxChainLength: number }`.
  - Durante uma captura múltipla (`activeChainPiece`), o turno permanece com o jogador atual e a seleção fica travada na peça que está executando a cadeia até que todos os saltos obrigatórios da sequência sejam concluídos.
  - Ao término do movimento (quando não há mais saltos encadeados), verifica-se se `piece.type === 'pawn'` atingiu `toR === 0` (Brancas) ou `toR === 7` (Pretas), promovendo-a instantaneamente a Dama (`'queen'`).
