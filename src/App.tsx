import React, { useState, useEffect } from 'react';
import { Player, Piece, Board, Move, GameStatus } from './types';
import {
  createInitialBoard,
  getLegalMoves,
  getLegalDrops,
  canPromote,
  mustPromote,
  isKingInCheck,
  hasNoLegalMoves,
} from './shogiRules';
import { getBestAIMove } from './shogiAI';
import ShogiBoard from './components/ShogiBoard';
import HandTray from './components/HandTray';
import PromoModal from './components/PromoModal';
import HistoryLog from './components/HistoryLog';
import { Trophy, RotateCcw, Volume2, User, Cpu, Info, Undo2, Award, Zap } from 'lucide-react';

// Generates an interactive woody clack chime using the browser Web Audio API
function playClackSound() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Quick burst to mimic wooden block impact
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'triangle';
    // Traditional Shogi wood clicking has a resonant wood drop sound around 400Hz decaying rapidly
    osc.frequency.setValueAtTime(380, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.07);
    
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.07);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch (e) {
    // Fail silently e.g. due to audio context restrictions before user interaction
  }
}

export default function App() {
  // Game state parameters
  const [board, setBoard] = useState<Board>(() => createInitialBoard());
  const [captured, setCaptured] = useState<{ [Player.SENTE]: Piece[]; [Player.GOTE]: Piece[] }>({
    [Player.SENTE]: [],
    [Player.GOTE]: [],
  });
  const [turn, setTurn] = useState<Player>(Player.SENTE);
  const [selected, setSelected] = useState<{
    source: 'board' | 'hand';
    row?: number;
    col?: number;
    handIndex?: number;
    piece: Piece;
  } | null>(null);

  const [validTargets, setValidTargets] = useState<{ row: number; col: number }[]>([]);
  const [history, setHistory] = useState<Move[]>([]);
  const [status, setStatus] = useState<GameStatus>('PLAYING');
  const [lastMove, setLastMove] = useState<{
    from: { row: number; col: number } | null;
    to: { row: number; col: number };
  } | null>(null);

  // Configuration settings
  const [vsAI, setVsAI] = useState<boolean>(true);
  const [aiDifficulty, setAiDifficulty] = useState<'EASY' | 'MEDIUM'>('MEDIUM');
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [showHelperMessages, setShowHelperMessages] = useState<boolean>(true);

  // Promotion handling
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: { row: number; col: number };
    to: { row: number; col: number };
    piece: Piece;
    capturedPiece: Piece | null;
  } | null>(null);

  // Capture king warnings
  const [kingInCheck, setKingInCheck] = useState<Player | null>(null);

  // Monitor Checks and Checkmates on state change
  useEffect(() => {
    const senteChecked = isKingInCheck(board, Player.SENTE);
    const goteChecked = isKingInCheck(board, Player.GOTE);

    if (senteChecked) {
      setKingInCheck(Player.SENTE);
      // Check if Sente is completely checkmated
      if (hasNoLegalMoves(board, Player.SENTE, captured[Player.SENTE])) {
        setStatus('CHECKMATE');
      } else {
        setStatus('CHECK');
      }
    } else if (goteChecked) {
      setKingInCheck(Player.GOTE);
      // Check if Gote is completely checkmated
      if (hasNoLegalMoves(board, Player.GOTE, captured[Player.GOTE])) {
        setStatus('CHECKMATE');
      } else {
        setStatus('CHECK');
      }
    } else {
      setKingInCheck(null);
      // Check for draw / blocking stale or general plays
      setStatus('PLAYING');
    }
  }, [board, turn, captured]);

  // Trigger AI Turn after Turn changes to GOTE
  useEffect(() => {
    if (vsAI && turn === Player.GOTE && status !== 'CHECKMATE') {
      setIsAiThinking(true);
      const thinkTimer = setTimeout(() => {
        executeAIMove();
      }, 750); // Fluid thinking delay
      return () => clearTimeout(thinkTimer);
    }
  }, [turn, vsAI, status]);

  // Core move action
  const handleMovePiece = (
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number,
    shouldPromotePiece: boolean
  ) => {
    const activePiece = board[fromRow][fromCol];
    if (!activePiece) return;

    const targetCell = board[toRow][toCol];
    const originalPromotedState = activePiece.promoted;

    // 1. Resolve Capturing
    const nextCaptured = {
      [Player.SENTE]: [...captured[Player.SENTE]],
      [Player.GOTE]: [...captured[Player.GOTE]],
    };

    if (targetCell) {
      // Demote captured piece and yield to capturing player hand
      const newlyCapturedPiece: Piece = {
        ...targetCell,
        owner: turn,
        promoted: false, // captured pieces must be dropped unpromoted
      };
      nextCaptured[turn].push(newlyCapturedPiece);
    }

    // 2. Perform Movement on Board layout
    const nextBoard = board.map((rowArr) => [...rowArr]);
    nextBoard[fromRow][fromCol] = null;
    nextBoard[toRow][toCol] = {
      ...activePiece,
      promoted: shouldPromotePiece ? true : activePiece.promoted,
    };

    // 3. Register move object
    const currentMove: Move = {
      from: { row: fromRow, col: fromCol },
      to: { row: toRow, col: toCol },
      piece: activePiece,
      promotedBefore: originalPromotedState,
      promotedAfter: shouldPromotePiece ? true : originalPromotedState,
      capturedPiece: targetCell,
      drop: false,
    };

    setBoard(nextBoard);
    setCaptured(nextCaptured);
    setHistory((prev) => [...prev, currentMove]);
    setLastMove({ from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } });

    // Toggle turn
    setTurn(turn === Player.SENTE ? Player.GOTE : Player.SENTE);
    setSelected(null);
    setValidTargets([]);
    playClackSound();
  };

  // Drop action
  const handleDropPiece = (targetRow: number, targetCol: number, piece: Piece, pocketIndex: number) => {
    // Place piece
    const nextBoard = board.map((rowArr) => [...rowArr]);
    nextBoard[targetRow][targetCol] = {
      ...piece,
      owner: turn,
      promoted: false, // always drop demoted unpromoted
    };

    // Remove from player's hand
    const nextCaptured = {
      [Player.SENTE]: [...captured[Player.SENTE]],
      [Player.GOTE]: [...captured[Player.GOTE]],
    };
    nextCaptured[turn].splice(pocketIndex, 1);

    const currentMove: Move = {
      from: null,
      to: { row: targetRow, col: targetCol },
      piece,
      promotedBefore: false,
      promotedAfter: false,
      capturedPiece: null,
      drop: true,
    };

    setBoard(nextBoard);
    setCaptured(nextCaptured);
    setHistory((prev) => [...prev, currentMove]);
    setLastMove({ from: null, to: { row: targetRow, col: targetCol } });

    // Toggle turn
    setTurn(turn === Player.SENTE ? Player.GOTE : Player.SENTE);
    setSelected(null);
    setValidTargets([]);
    playClackSound();
  };

  // AI execution routine
  const executeAIMove = () => {
    const decision = getBestAIMove(board, captured, Player.GOTE, aiDifficulty);
    if (!decision) {
      // AI cannot find any moves -> Resigns or has no legal actions
      setStatus('CHECKMATE');
      setIsAiThinking(false);
      return;
    }

    const { action } = decision;

    if (action.from === null) {
      // AI drops piece
      handleDropPiece(action.to.row, action.to.col, action.piece, action.capturedIndex ?? 0);
    } else {
      // AI board move
      // Resolve captured piece
      const targetCell = board[action.to.row][action.to.col];
      const nextCaptured = {
        [Player.SENTE]: [...captured[Player.SENTE]],
        [Player.GOTE]: [...captured[Player.GOTE]],
      };

      if (targetCell) {
        const newlyCapturedPiece: Piece = {
          ...targetCell,
          owner: Player.GOTE,
          promoted: false,
        };
        nextCaptured[Player.GOTE].push(newlyCapturedPiece);
      }

      const nextBoard = board.map((rowArr) => [...rowArr]);
      nextBoard[action.from.row][action.from.col] = null;
      nextBoard[action.to.row][action.to.col] = {
        ...action.piece,
        promoted: action.promote ? true : action.piece.promoted,
      };

      const aiMoveRecord: Move = {
        from: action.from,
        to: action.to,
        piece: action.piece,
        promotedBefore: action.piece.promoted,
        promotedAfter: action.promote || action.piece.promoted,
        capturedPiece: targetCell,
        drop: false,
      };

      setBoard(nextBoard);
      setCaptured(nextCaptured);
      setHistory((prev) => [...prev, aiMoveRecord]);
      setLastMove({ from: action.from, to: action.to });
      setTurn(Player.SENTE);
      playClackSound();
    }

    setIsAiThinking(false);
  };

  // Unified click handler for the Shogi grid cells
  const handleCellClick = (row: number, col: number) => {
    if (isAiThinking || status === 'CHECKMATE') return;

    // Check if cell is an active legal target coordinate
    const isCoordinateValidTarget = validTargets.some((t) => t.row === row && t.col === col);

    if (isCoordinateValidTarget && selected) {
      if (selected.source === 'hand') {
        // Dropping a pocket piece
        handleDropPiece(row, col, selected.piece, selected.handIndex ?? 0);
      } else if (selected.source === 'board' && selected.row !== undefined && selected.col !== undefined) {
        // Normal board movement
        const fromRow = selected.row;
        const fromCol = selected.col;
        const currentPiece = board[fromRow][fromCol];

        if (currentPiece) {
          const targetCell = board[row][col];
          const triggerPromoteOption = canPromote(currentPiece, fromRow, row);
          const obligatePromotion = mustPromote(currentPiece, row);

          if (obligatePromotion) {
            // Must promote (e.g. Pawn hitting rank 1)
            handleMovePiece(fromRow, fromCol, row, col, true);
          } else if (triggerPromoteOption) {
            // Can choose to promote or stay normal
            setPendingPromotion({
              from: { row: fromRow, col: fromCol },
              to: { row, col },
              piece: currentPiece,
              capturedPiece: targetCell,
            });
          } else {
            // Move clean
            handleMovePiece(fromRow, fromCol, row, col, false);
          }
        }
      }
      return;
    }

    // Otherwise, handle regular piece selection (only on active player's turn unless AI is pondering)
    const clickedPiece = board[row][col];
    if (clickedPiece && clickedPiece.owner === turn) {
      // Cannot control AI's moves when in vsAI Mode
      if (vsAI && turn === Player.GOTE) return;

      setSelected({
        source: 'board',
        row,
        col,
        piece: clickedPiece,
      });

      // Compute legal targets under checked restraints
      const moves = getLegalMoves(board, row, col, turn);
      setValidTargets(moves);
    } else {
      // Clicked on empty or opponent piece, clear selection
      setSelected(null);
      setValidTargets([]);
    }
  };

  // Captured hand selection
  const handleSelectCaptured = (piece: Piece, index: number) => {
    if (isAiThinking || status === 'CHECKMATE' || piece.owner !== turn) return;
    if (vsAI && turn === Player.GOTE) return;

    setSelected({
      source: 'hand',
      handIndex: index,
      piece,
    });

    const drops = getLegalDrops(board, piece, turn);
    setValidTargets(drops);
  };

  // Handle promotion modal choice
  const handlePromotionResolution = (promote: boolean) => {
    if (pendingPromotion) {
      const { from, to } = pendingPromotion;
      handleMovePiece(from.row, from.col, to.row, to.col, promote);
      setPendingPromotion(null);
    }
  };

  // Undo system (rolls back one full round)
  const handleUndo = () => {
    if (history.length === 0 || isAiThinking) return;

    let targetHistoryLength = history.length - 1;
    // In vsAI mode, we undo BOTH Gote (AI) and Sente (Player) in one go
    if (vsAI && targetHistoryLength >= 1) {
      targetHistoryLength = history.length - 2;
    }

    // Re-instantiate board starting from beginning state
    const restoredBoard = createInitialBoard();
    const restoredCaptured = {
      [Player.SENTE]: [] as Piece[],
      [Player.GOTE]: [] as Piece[],
    };

    for (let i = 0; i < targetHistoryLength; i++) {
      const step = history[i];
      const activeSide = step.piece.owner;

      if (step.drop) {
        // Re-simulate drop
        restoredBoard[step.to.row][step.to.col] = {
          ...step.piece,
          owner: activeSide,
          promoted: false,
        };

        // Remove from hand
        const idx = restoredCaptured[activeSide].findIndex((p) => p.type === step.piece.type);
        if (idx !== -1) restoredCaptured[activeSide].splice(idx, 1);
      } else if (step.from) {
        // Re-simulate standard move
        if (step.capturedPiece) {
          // Remove from opponent, restore as captured object to active side
          const restoredCapturedPiece = {
            ...step.capturedPiece,
            owner: activeSide,
            promoted: false,
          };
          restoredCaptured[activeSide].push(restoredCapturedPiece);
        }

        restoredBoard[step.from.row][step.from.col] = null;
        restoredBoard[step.to.row][step.to.col] = {
          ...step.piece,
          promoted: step.promotedAfter,
        };
      }
    }

    setBoard(restoredBoard);
    setCaptured(restoredCaptured);
    setHistory(history.slice(0, targetHistoryLength));

    // Determine whose turn it should be
    if (vsAI) {
      setTurn(Player.SENTE); // Player stays Sente
    } else {
      const priorTurn = targetHistoryLength % 2 === 0 ? Player.SENTE : Player.GOTE;
      setTurn(priorTurn);
    }

    // Reset selection indicators
    setSelected(null);
    setValidTargets([]);
    setLastMove(
      targetHistoryLength > 0
        ? {
            from: history[targetHistoryLength - 1].from,
            to: history[targetHistoryLength - 1].to,
          }
        : null
    );
    playClackSound();
  };

  // Full board reset
  const handleResetGame = () => {
    if (window.confirm('対局をリセットして新しく開始しますか？')) {
      setBoard(createInitialBoard());
      setCaptured({
        [Player.SENTE]: [],
        [Player.GOTE]: [],
      });
      setTurn(Player.SENTE);
      setSelected(null);
      setValidTargets([]);
      setHistory([]);
      setLastMove(null);
      setStatus('PLAYING');
      setPendingPromotion(null);
      playClackSound();
    }
  };

  // Ethical resignation (投了)
  const handleResign = () => {
    const winnerName = turn === Player.SENTE ? '後手 (White)' : '先手 (Black)';
    if (window.confirm('投了しますか？（現在の対局に敗北します）')) {
      setStatus(turn === Player.SENTE ? 'GOTE_WIN' : 'SENTE_WIN');
      playClackSound();
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 py-6 px-4 font-sans select-none pb-12 relative overflow-x-hidden">
      {/* Dynamic Frosted Blue & Slate Radial Luminescence Overlays */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,#1e293b_0%,transparent_50%),radial-gradient(circle_at_80%_70%,#0f172a_0%,transparent_50%)] opacity-70 pointer-events-none" />

      {/* Promotion Choice Prompt */}
      {pendingPromotion && (
        <PromoModal
          isOpen={!!pendingPromotion}
          piece={pendingPromotion.piece}
          onDecide={handlePromotionResolution}
        />
      )}

      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* Visual Title Header */}
        <header className="relative z-10 flex flex-col sm:flex-row items-center justify-between border-b pb-4 border-white/10">
          <div className="flex items-center gap-3">
            <div className="bg-white/5 border border-white/10 text-blue-400 rounded-xl p-2.5 shadow-lg flex items-center justify-center">
              <Award className="w-6 h-6 shrink-0" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black italic tracking-tight text-white font-serif">
                将棋 <span className="text-xs font-normal not-italic opacity-50 tracking-widest ml-1 sm:ml-2 uppercase">The Royal Game</span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5 font-sans">
                伝統のルールに基づいた最高峰のブラウザ将棋。
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-4 sm:mt-0 items-center bg-white/5 backdrop-blur-md rounded-xl p-1.5 border border-white/10 shadow-lg">
            <button
              onClick={() => setVsAI(true)}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-bold transition-all cursor-pointer ${
                vsAI
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/15 border border-blue-500/30'
                  : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              AI対局
            </button>
            <button
              onClick={() => {
                setVsAI(false);
                if (turn === Player.GOTE && isAiThinking) {
                  setIsAiThinking(false);
                }
              }}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-bold transition-all cursor-pointer ${
                !vsAI
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/15 border border-blue-500/30'
                  : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              ローカル2人対局
            </button>
          </div>
        </header>

        {/* Global Announcement Alert on Check/Checkmate */}
        {status !== 'PLAYING' && (
          <div
            className={`relative z-10 p-4 rounded-xl border backdrop-blur-md flex items-center justify-between shadow-2xl animate-pulse ${
              status === 'CHECKMATE'
                ? 'bg-red-500/10 border-red-500/20 text-red-200'
                : status === 'CHECK'
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-200'
                  : 'bg-blue-500/10 border-blue-500/20 text-blue-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="p-1 rounded-full bg-white/10 border border-white/10">
                <Trophy className="w-5 h-5" />
              </span>
              <span className="font-serif font-bold text-sm sm:text-base">
                {status === 'CHECKMATE'
                  ? '詰み (Checkmate) です！ 対局終了。'
                  : status === 'CHECK'
                    ? '王手 (Check) がかかっています！'
                    : status === 'SENTE_WIN'
                      ? '先手 (▲ Sente) の勝利です！ おめでとうございます。'
                      : '後手 (△ Gote) の勝利です！'}
              </span>
            </div>
            <button
              onClick={() => {
                setBoard(createInitialBoard());
                setCaptured({ [Player.SENTE]: [], [Player.GOTE]: [] });
                setTurn(Player.SENTE);
                setHistory([]);
                setStatus('PLAYING');
              }}
              className="text-xs font-bold underline text-blue-400 hover:text-blue-300 cursor-pointer"
            >
              新しい対局を開始
            </button>
          </div>
        )}

        {/* Game Area Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT: Gote Tray & Board (Main focus element) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            
            {/* GOTE TRAY (Pocket hand on top) */}
            <div className="w-full">
              <HandTray
                player={Player.GOTE}
                isActiveTurn={turn === Player.GOTE}
                capturedPieces={captured[Player.GOTE]}
                selectedPiece={selected}
                onSelectPiece={handleSelectCaptured}
                gameStatus={status}
              />
            </div>

            {/* MAIN SHOGI INTERACTIVE Goban */}
            <div className="relative mx-auto w-full flex items-center justify-center z-10">
              {isAiThinking && (
                <div className="absolute inset-0 z-30 bg-slate-950/20 backdrop-blur-md flex items-center justify-center rounded-2xl">
                  <div className="bg-white/10 backdrop-blur-lg text-white font-serif px-6 py-3.5 rounded-2xl shadow-2xl text-center flex items-center gap-3 border border-white/10 animate-pulse">
                    <Zap className="w-4 h-4 animate-spin text-blue-400" />
                    <span className="font-sans font-bold text-sm tracking-wide">AIが思考しています...</span>
                  </div>
                </div>
              )}
              <ShogiBoard
                board={board}
                turn={turn}
                selectedPiece={selected}
                validTargets={validTargets}
                lastMove={lastMove}
                kingInCheck={kingInCheck}
                onCellClick={handleCellClick}
                gameStatus={status}
              />
            </div>

            {/* SENTE TRAY (Pocket hand at bottom) */}
            <div className="w-full">
              <HandTray
                player={Player.SENTE}
                isActiveTurn={turn === Player.SENTE}
                capturedPieces={captured[Player.SENTE]}
                selectedPiece={selected}
                onSelectPiece={handleSelectCaptured}
                gameStatus={status}
              />
            </div>
          </div>

          {/* RIGHT: Status Dashboard & Log Controls */}
          <div className="lg:col-span-4 flex flex-col gap-5">
            
            {/* Control Panel Card */}
            <div className="relative z-10 backdrop-blur-lg bg-white/5 border border-white/10 p-5 rounded-3xl shadow-2xl space-y-4">
              <h2 className="text-sm font-bold text-slate-200 border-b pb-2 border-white/10 flex items-center justify-between">
                <span>対局情報 (Dashboard)</span>
                {vsAI && (
                  <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    AI 対戦モード
                  </span>
                )}
              </h2>

              {/* Player Status info */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className={`p-3 rounded-xl border transition-all duration-300 ${
                    turn === Player.SENTE
                      ? 'bg-blue-600/15 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.15)] text-blue-100 ring-1 ring-blue-500/20'
                      : 'bg-white/5 border-white/5 text-slate-400'
                  }`}
                >
                  <div className="text-[10px] opacity-60 uppercase tracking-wider font-semibold">
                    先手 (Sente)
                  </div>
                  <div className="font-serif text-sm font-bold mt-1 flex items-center justify-between">
                    <span>▲ あなた</span>
                    {turn === Player.SENTE && <span className="text-blue-400 block text-xs animate-pulse">● 手番</span>}
                  </div>
                </div>

                <div
                  className={`p-3 rounded-xl border transition-all duration-300 ${
                    turn === Player.GOTE
                      ? 'bg-slate-400/15 border-slate-400/30 text-slate-200 shadow-[0_0_15px_rgba(200,200,200,0.1)] ring-1 ring-slate-400/20'
                      : 'bg-white/5 border-white/5 text-slate-400'
                  }`}
                >
                  <div className="text-[10px] opacity-60 uppercase tracking-wider font-semibold">
                    後手 (Gote)
                  </div>
                  <div className="font-serif text-sm font-bold mt-1 flex items-center justify-between">
                    <span>△ {vsAI ? `AI（${aiDifficulty === 'EASY' ? '初級' : '中級'}）` : '対戦者'}</span>
                    {turn === Player.GOTE && <span className="text-slate-300 block text-xs animate-pulse">● {isAiThinking ? '思考中' : '手番'}</span>}
                  </div>
                </div>
              </div>

              {/* Settings selectors if AI mode is active */}
              {vsAI && (
                <div className="p-3 bg-white/5 border border-white/5 rounded-2xl space-y-2">
                  <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-blue-400" />
                    <span>AI 難易度設定 (Difficulty)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pt-1.5">
                    <button
                      onClick={() => setAiDifficulty('EASY')}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        aiDifficulty === 'EASY'
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                      }`}
                    >
                      初級 (Easy)
                    </button>
                    <button
                      onClick={() => setAiDifficulty('MEDIUM')}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        aiDifficulty === 'MEDIUM'
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                      }`}
                    >
                      中級 (Medium)
                    </button>
                  </div>
                </div>
              )}

              {/* Action trigger deck */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
                <button
                  onClick={handleUndo}
                  disabled={history.length === 0 || isAiThinking}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 py-3 rounded-xl text-[10px] sm:text-xs uppercase font-bold tracking-wider transition-colors duration-200 text-slate-200 disabled:opacity-30 disabled:hover:bg-white/5 flex flex-col items-center justify-center gap-1 cursor-pointer"
                  title="待った"
                >
                  <Undo2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>待った (Undo)</span>
                </button>

                <button
                  onClick={handleResetGame}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 py-3 rounded-xl text-[10px] sm:text-xs uppercase font-bold tracking-wider transition-colors duration-200 text-slate-200 flex flex-col items-center justify-center gap-1 cursor-pointer"
                  title="リセット"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>リセット</span>
                </button>

                <button
                  onClick={handleResign}
                  disabled={status === 'CHECKMATE' || history.length === 0}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 py-3 rounded-xl text-[10px] sm:text-xs uppercase font-bold tracking-wider transition-colors duration-200 text-slate-200 disabled:opacity-30 disabled:hover:bg-white/5 flex flex-col items-center justify-center gap-1 cursor-pointer"
                  title="降伏"
                >
                  <Trophy className="w-3.5 h-3.5 text-red-400" />
                  <span>投了 (Resign)</span>
                </button>
              </div>
            </div>

            {/* Interactive Move Log Ledger */}
            <div className="flex-1">
              <HistoryLog history={history} />
            </div>

            {/* Beginner Quick Info Manual card */}
            <div className="relative z-10 backdrop-blur-lg bg-white/5 border border-white/10 p-4 rounded-3xl flex items-start gap-3">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-200">将棋の遊び方</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  盤面の自分の駒をクリックすると、移動可能なマスがハイライトされます。
                  持ち駒をクリックして、盤面の空きマスにドロップすることもできます。
                  相手の陣地（上3段、または下3段）に入ると、攻撃をさらに強力にするために「成る」ことができます。
                </p>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
