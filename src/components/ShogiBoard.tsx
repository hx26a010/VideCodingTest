import React from 'react';
import { Player, Piece, Board } from '../types';
import ShogiPieceView from './ShogiPieceView';
import { inBounds } from '../shogiRules';

interface ShogiBoardProps {
  board: Board;
  turn: Player;
  selectedPiece: {
    source: 'board' | 'hand';
    row?: number;
    col?: number;
    piece: Piece;
  } | null;
  validTargets: { row: number; col: number }[];
  lastMove: { from: { row: number; col: number } | null; to: { row: number; col: number } } | null;
  kingInCheck: Player | null;
  onCellClick: (row: number, col: number) => void;
  gameStatus: string;
}

export default function ShogiBoard({
  board,
  turn,
  selectedPiece,
  validTargets,
  lastMove,
  kingInCheck,
  onCellClick,
  gameStatus,
}: ShogiBoardProps) {
  // Translate a target key for lookup
  const isTarget = (r: number, c: number) => {
    return validTargets.some((t) => t.row === r && t.col === c);
  };

  const isLastMoveSrc = (r: number, c: number) => {
    return lastMove?.from && lastMove.from.row === r && lastMove.from.col === c;
  };

  const isLastMoveDest = (r: number, c: number) => {
    return lastMove?.to && lastMove.to.row === r && lastMove.to.col === c;
  };

  const isKingChecked = (r: number, c: number) => {
    const p = board[r][c];
    if (p && p.type === 'GYOKU') {
      return kingInCheck === p.owner;
    }
    return false;
  };

  // Traditional files (9, 8, 7, 6, 5, 4, 3, 2, 1) - from right to left
  const arabicFiles = ['９', '８', '７', '６', '５', '４', '３', '２', '１'];
  // Traditional ranks (一, 二, 三, 四, 五, 六, 七, 八, 九) - from top to bottom
  const kanjiRanks = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

  // Traditional Goban "Star points" (星) in Shogi are located at intersections (3,3), (3,6), (6,3), (6,6)
  // counting from index 1. In 0-based, these are rows 2,5 and cols 2,5. Let's make small dots.
  const isStarPoint = (r: number, c: number) => {
    return (r === 2 || r === 5) && (c === 2 || c === 5);
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-white/5 border border-white/10 rounded-3xl shadow-2xl relative z-10">
      
      {/* Arabic File Headers (9 to 1, right-to-left) */}
      <div className="flex w-full max-w-[480px] pl-[34px] pr-2.5 mb-2 text-center font-serif text-[10px] sm:text-xs text-slate-300 font-bold justify-around select-none">
        {arabicFiles.map((num, idx) => (
          <div key={idx} className="w-10 sm:w-12">
            {num}
          </div>
        ))}
      </div>

      <div className="flex items-stretch justify-center w-full max-w-[530px]">
        {/* Main Board Grid Grid container */}
        <div className="relative p-2.5 bg-[#d8a364] border-4 border-[#9a672a] rounded shadow-[0_0_50px_rgba(0,0,0,0.5)] flex-1 flex flex-col justify-between max-w-[480px]">
          {/* Subtle wooden line texture layer using CSS background */}
          <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(rgba(0,0,0,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.8)_1px,transparent_1px)] bg-[size:11.11%_11.11%] pointer-events-none rounded" />
          
          <div className="grid grid-rows-9 gap-[1px]">
            {board.map((rowArr, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-9 gap-[1px]">
                {rowArr.map((piece, colIndex) => {
                  const target = isTarget(rowIndex, colIndex);
                  const lastSrc = isLastMoveSrc(rowIndex, colIndex);
                  const lastDest = isLastMoveDest(rowIndex, colIndex);
                  const inCheck = isKingChecked(rowIndex, colIndex);
                  const isSelected =
                    selectedPiece?.source === 'board' &&
                    selectedPiece.row === rowIndex &&
                    selectedPiece.col === colIndex;

                  // Cells styling:
                  // Elegant authentic warm wood cell base.
                  let cellBg = 'bg-[#fcdfa8]/95 hover:bg-[#ffeec4]';
                  if (isSelected) {
                    cellBg = 'bg-blue-100/95 ring-2 ring-inset ring-blue-500 z-10';
                  } else if (lastDest) {
                    cellBg = 'bg-blue-100/90 ring-1 ring-inset ring-blue-400';
                  } else if (lastSrc) {
                    cellBg = 'bg-orange-200/40';
                  } else if (inCheck) {
                    cellBg = 'bg-red-250 animate-pulse ring-2 ring-red-600 z-10';
                  }

                  return (
                    <div
                      key={colIndex}
                      id={`cell-${rowIndex}-${colIndex}`}
                      onClick={() => onCellClick(rowIndex, colIndex)}
                      className={`relative aspect-[5/6] w-full flex items-center justify-center transition-all duration-150 cursor-pointer ${cellBg} border border-amber-950/15`}
                    >
                      {/* Star Point (小星) intersections dot */}
                      {isStarPoint(rowIndex, colIndex) && (
                        <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-amber-950/50 rounded-full translate-x-1/2 translate-y-1/2 z-10 pointer-events-none" />
                      )}

                      {/* Display piece */}
                      {piece && (
                        <ShogiPieceView
                          piece={piece}
                          isSelected={isSelected}
                          isInteractable={gameStatus === 'PLAYING'}
                          onClick={() => onCellClick(rowIndex, colIndex)}
                        />
                      )}

                      {/* Valid move target / capture target highlight overlays */}
                      {target && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 animate-fade-in">
                          {piece ? (
                            // Capture target: glowing red retro corners
                            <div className="absolute inset-0.5 border-2 border-dashed border-red-500 rounded bg-red-500/15" />
                          ) : (
                            // Simple hollow guide circle for empty cells
                            <div className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 rounded-full border-2 border-emerald-500 bg-emerald-500/25 shadow-sm" />
                          )}
                        </div>
                      )}

                      {/* Cell coordinates overlay for helper guide */}
                      <span className="absolute bottom-0.5 right-1 text-[7px] text-amber-950/25 font-mono scale-90 select-none">
                        {(9 - colIndex) + kanjiRanks[rowIndex]}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Kanji Rank Headers (一 to 九 on the right) */}
        <div className="flex flex-col justify-around py-3.5 pl-2 select-none text-slate-300 font-serif font-bold text-[10px] sm:text-xs">
          {kanjiRanks.map((kan, idx) => (
            <div key={idx} className="h-10 sm:h-12 flex items-center justify-center w-6">
              {kan}
            </div>
          ))}
        </div>
      </div>

      {/* Guide labels */}
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400 items-center justify-center">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span>移動元の駒 (Last Selected / Moved)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full border border-emerald-500 bg-emerald-500/20" />
          <span>移動可能なマス (Valid Target)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-red-500/20 border border-red-500" />
          <span>捕獲可能な相手の駒 (Capture)</span>
        </div>
      </div>
    </div>
  );
}
