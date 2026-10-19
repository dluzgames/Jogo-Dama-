import { useEffect, useRef, useState } from 'react';
import { initWizardChess } from './wizardChessEngine.js';

export default function App() {
  const initializedRef = useRef(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    initWizardChess();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileSheetOpen(false);
      }
    };
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setMobileSheetOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleRestoreUI = () => {
    const win = window as unknown as { wizardChess?: { toggleUI?: (force?: boolean) => void } };
    if (win.wizardChess?.toggleUI) {
      win.wizardChess.toggleUI(false);
    } else {
      document.body.classList.remove('cinematic-ui-hidden');
      const btnHide = document.getElementById('btn-hide-ui');
      if (btnHide) btnHide.textContent = 'Ocultar UI [H]';
    }
  };

  return (
    <>
      <div id="loading-overlay">
        <div className="loader-title">Damas Brasileiras 3D</div>
        <div className="loader-bar-wrap">
          <div className="loader-bar" id="loader-bar"></div>
        </div>
        <div id="loader-text">Preparando o Tabuleiro 8×8 e as 24 Pedras Esculpidas...</div>
      </div>

      <div id="canvas-container"></div>

      <button
        type="button"
        className="hud-btn mobile-only-restore-ui"
        id="btn-mobile-show-ui"
        onClick={handleRestoreUI}
        title="Mostrar Controles da Interface"
      >
        Mostrar UI
      </button>

      <div id="hud-top">
        <div className="hud-group" id="hud-left">
          <div className="brand-pill">
            <span className="brand-title">Damas Brasileiras</span>
          </div>
          <div className="status-pill" id="status-pill">
            <span className="turn-dot" id="turn-dot"></span>
            <span id="turn-text">Vez das Brancas</span>
            <span className="mode-badge" id="mode-badge">Contra IA (Brancas)</span>
          </div>
        </div>

        <button
          type="button"
          className={`hud-btn mobile-controls-trigger ${mobileSheetOpen ? 'active' : ''}`}
          id="btn-mobile-controls"
          aria-expanded={mobileSheetOpen}
          aria-controls="hud-right"
          onClick={() => setMobileSheetOpen((prev) => !prev)}
        >
          {mobileSheetOpen ? 'Fechar' : 'Controles'}
        </button>

        <div
          className={`mobile-sheet-backdrop ${mobileSheetOpen ? 'open' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setMobileSheetOpen(false);
          }}
          aria-hidden="true"
        ></div>

        <div
          className={`hud-group ${mobileSheetOpen ? 'mobile-sheet-open' : ''}`}
          id="hud-right"
        >
          <div
            className="mobile-sheet-handle-wrap"
            onClick={(e) => {
              e.stopPropagation();
              setMobileSheetOpen(false);
            }}
            aria-hidden="true"
          >
            <div className="mobile-sheet-handle"></div>
          </div>

          <div className="mobile-sheet-header">
            <span className="mobile-sheet-title">Controles da Partida</span>
            <button
              type="button"
              className="mobile-sheet-close"
              id="btn-mobile-sheet-close"
              onClick={(e) => {
                e.stopPropagation();
                setMobileSheetOpen(false);
              }}
              aria-label="Fechar Controles"
            >
              Fechar ✕
            </button>
          </div>

          <div className="mobile-sheet-section-label">Ações do Jogo</div>

          <button
            className="hud-btn"
            id="btn-mode-toggle"
            title="Alternar entre Jogador contra IA e 2 Jogadores Local"
            onClick={() => setMobileSheetOpen(false)}
          >
            Modo: 2 Jogadores
          </button>
          <button
            className="hud-btn"
            id="btn-side-toggle"
            title="Alternar entre Jogar com as Brancas ou com as Pretas"
            onClick={() => setMobileSheetOpen(false)}
          >
            Jogar de Pretas
          </button>
          <button
            className="hud-btn"
            id="btn-ai-move"
            title="Fazer a Inteligência Artificial executar a próxima jogada agora"
            onClick={() => setMobileSheetOpen(false)}
          >
            Jogada da IA
          </button>
          <button
            className="hud-btn"
            id="btn-reset"
            title="Iniciar uma nova partida de Damas Brasileiras no altar"
            onClick={() => setMobileSheetOpen(false)}
          >
            Nova Partida
          </button>

          <div className="hud-divider" aria-hidden="true"></div>
          <div className="mobile-sheet-section-label">
            <span>Ângulos de Câmera</span>
            <span className="mobile-sheet-section-sub">Toque novamente para inverter o lado</span>
          </div>

          <button
            className="hud-btn active"
            id="btn-cam-player"
            title="Câmera do Jogador (Clique novamente para inverter visão Brancas / Pretas)"
          >
            Câmera Jogador
          </button>
          <button
            className="hud-btn"
            id="btn-cam-top"
            title="Visão Superior do Tabuleiro 8×8 (Clique novamente para girar)"
          >
            Visão Topo
          </button>
          <button
            className="hud-btn"
            id="btn-cam-side"
            title="Visão Lateral do Tabuleiro (Clique novamente para alternar Leste / Oeste)"
          >
            Lateral
          </button>
          <button
            className="hud-btn"
            id="btn-cam-wide"
            title="Visão Panorâmica da Catedral (Clique novamente para alternar Norte / Sul)"
          >
            Catedral
          </button>

          <div className="hud-divider" aria-hidden="true"></div>
          <div className="mobile-sheet-section-label">Tela, Áudio e Histórico</div>

          <button
            className={`hud-btn ${historyOpen ? 'active' : ''}`}
            id="btn-history-toggle"
            title="Mostrar ou recolher o painel lateral de histórico e pedras assopradas"
            onClick={() => {
              setHistoryOpen((prev) => !prev);
              setMobileSheetOpen(false);
            }}
          >
            Histórico
          </button>

          <button
            className="hud-btn active"
            id="btn-sound-toggle"
            title="Ativar ou silenciar os efeitos sonoros 3D de pedra, captura e coroação (Atalho: M)"
            onClick={() => setMobileSheetOpen(false)}
          >
            Som: Ligado [M]
          </button>

          <button
            className="hud-btn"
            id="btn-hide-ui"
            title="Ocultar ou mostrar os controles na tela (Atalho: H)"
            onClick={() => setMobileSheetOpen(false)}
          >
            Ocultar UI [H]
          </button>

          <div className="mobile-sheet-hint">
            <strong>Toque:</strong> Toque na Pedra para Mover &nbsp;•&nbsp; 1 Dedo: Girar &nbsp;•&nbsp; 2 Dedos: Mover &nbsp;•&nbsp; Pinça: Zoom
          </div>
        </div>
      </div>

      <aside
        id="history-sidebar"
        className={`history-sidebar ${historyOpen ? 'open' : 'collapsed'}`}
        aria-label="Painel de Histórico de Jogadas e Pedras Assopradas"
      >
        <div className="history-sidebar-header">
          <div className="history-sidebar-title-wrap">
            <span className="history-sidebar-icon">📜</span>
            <span className="history-sidebar-title">Histórico &amp; Capturas</span>
          </div>
          <button
            type="button"
            className="history-collapse-btn"
            id="btn-history-collapse"
            onClick={() => setHistoryOpen((prev) => !prev)}
            title={historyOpen ? 'Recolher painel lateral' : 'Expandir painel lateral'}
          >
            {historyOpen ? '▾' : '◂'}
          </button>
        </div>

        <div className="history-sidebar-body">
          {/* Placar de Peças Capturadas por Jogador */}
          <div className="history-captures-grid" id="history-captures-grid">
            <div className="capture-score-card white-card">
              <div className="capture-card-top">
                <span className="capture-dot white"></span>
                <span className="capture-card-label">Brancas</span>
              </div>
              <div className="capture-card-value" id="hist-cap-white-count">
                0 <small>/ 12</small>
              </div>
              <div className="capture-card-sub">Pedras comidas</div>
              <div className="capture-mini-stones" id="hist-cap-white-stones"></div>
            </div>

            <div className="capture-score-card black-card">
              <div className="capture-card-top">
                <span className="capture-dot black"></span>
                <span className="capture-card-label">Pretas</span>
              </div>
              <div className="capture-card-value" id="hist-cap-black-count">
                0 <small>/ 12</small>
              </div>
              <div className="capture-card-sub">Pedras comidas</div>
              <div className="capture-mini-stones" id="hist-cap-black-stones"></div>
            </div>
          </div>

          {/* Lista Separada e Destacada de Pedras Assopradas */}
          <div className="assopradas-panel" id="assopradas-panel">
            <div className="assopradas-header">
              <span className="assopradas-title">💨 Pedras Assopradas</span>
              <span className="assopradas-badge" id="assopradas-count-badge">
                0
              </span>
            </div>
            <div className="assopradas-list" id="assopradas-list">
              <div className="history-empty-msg">
                Nenhuma pedra assoprada ainda. Deixar de comer elimina a pedra!
              </div>
            </div>
          </div>

          {/* Lista Cronológica de Jogadas */}
          <div className="moves-log-panel" id="moves-log-panel">
            <div className="moves-log-header">
              <span className="moves-log-title">Lances da Partida</span>
              <span className="moves-log-badge" id="moves-count-badge">
                0
              </span>
            </div>
            <div className="moves-log-list" id="moves-history-list">
              <div className="history-empty-msg">
                Clique em uma pedra para iniciar a partida.
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div id="hud-bottom">
        <div className="hint-pill" id="controls-hint">
          <strong>Regras &amp; Controles:</strong> Pedra anda p/ frente e come p/ frente e p/ trás &nbsp;•&nbsp; Dama corre a diagonal &nbsp;•&nbsp; <strong>Regra do Assopro:</strong> Não comer elimina a pedra! &nbsp;•&nbsp; M: Som
        </div>
        <div className="captured-pill" id="captured-tray"></div>
      </div>

      <div id="checkmate-overlay" role="status" aria-live="polite">
        <div className="checkmate-banner">
          <div className="checkmate-ornament">✦ &nbsp; Damas Brasileiras • Veredito do Altar &nbsp; ✦</div>
          <div className="checkmate-crown" id="checkmate-crown">♕</div>
          <div className="checkmate-title" id="checkmate-title">Vitória</div>
          <div className="checkmate-rule"></div>
          <div className="checkmate-subtitle" id="checkmate-subtitle">
            As Brancas Venceram • Todas as Pedras Adversárias Foram Dominadas
          </div>
          <div className="checkmate-actions">
            <button className="checkmate-btn" id="btn-checkmate-replay">
              Rever Final
            </button>
            <button className="checkmate-btn" id="btn-checkmate-newgame">
              Nova Partida
            </button>
            <button className="checkmate-btn secondary" id="btn-checkmate-dismiss">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
