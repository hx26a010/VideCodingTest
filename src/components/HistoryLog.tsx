import React, { useEffect, useRef } from 'react';
import { Player, Move } from '../types';
import { PIECE_LABELS, PROMOTED_LABELS } from './ShogiPieceView';

interface HistoryLogProps {
  history: Move[];
}

export function convertToShogiNotation(move: Move, prevMove: Move | null): string {
  const playerPrefix = move.piece.owner === Player.SENTE ? '▲' : '△';

  // Traditional files are numbered 9 to 1 from right to left (col 0 represents file 9, col 8 represents 1)
  const traditionalFile = 9 - move.to.col;
  
  // Traditional ranks are represented in Kanji (一 to 九)
  const kanjiRanks = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const traditionalRank = kanjiRanks[move.to.row];

  // Identical coordinates with prior move -> "同" (Dou)
  const isDou =
    prevMove !== null &&
    prevMove.to.row === move.to.row &&
    prevMove.to.col === move.to.col;

  const targetCoordStr = isDou 
    ? '同' 
    : `${traditionalFile}${traditionalRank}`;

  // Find standard kanji representation
  const pieceLabel = move.promotedBefore
    ? PROMOTED_LABELS[move.piece.type]
    : PIECE_LABELS[move.piece.type];

  let actionSuffix = '';
  if (move.drop) {
    actionSuffix = '打';
  } else if (!move.promotedBefore && move.promotedAfter) {
    actionSuffix = '成';
  } else if (!move.promotedAfter && (move.from !== null && (move.from.row <= 2 || move.to.row <= 2 || (move.piece.owner === Player.GOTE && (move.from.row >= 6 || move.to.row >= 6))))) {
    // Moved in/out/within promotion zone but didn't promote
    actionSuffix = '不成';
  }

  return `${playerPrefix}${targetCoordStr} ${pieceLabel}${actionSuffix}`;
}

export default function HistoryLog({ history }: HistoryLogProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when history updates
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [history]);

  return (
    <div className="flex flex-col h-full bg-white/5 backdrop-blur-md rounded-3xl p-4 border border-white/10 shadow-2xl relative z-10">
      {/* Title */}
      <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider pb-2 border-b border-white/10 flex items-center justify-between">
        <span>棋譜記録 (Move Log)</span>
        <span className="text-[10px] bg-white/10 border border-white/10 px-2.5 py-0.5 rounded text-blue-400 font-mono font-bold">
          {history.length} 盤手
        </span>
      </h3>

      {/* Grid view of logs */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto mt-2 space-y-1 pr-1 font-mono text-xs max-h-[160px] sm:max-h-[300px]"
      >
        {history.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs italic">
            対局を開始してください。
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {history.map((move, index) => {
              const prevMove = index > 0 ? history[index - 1] : null;
              const notation = convertToShogiNotation(move, prevMove);
              const isEven = index % 2 === 1;

              return (
                <div
                  key={index}
                  className={`py-1 px-2 rounded-lg flex items-center gap-1.5 transition-colors ${
                    isEven ? 'bg-white/5' : 'bg-transparent'
                  } hover:bg-white/10`}
                >
                  <span className="text-[10px] text-slate-500 w-5 font-mono text-right">
                    {index + 1}.
                  </span>
                  <span
                    className={`font-semibold ${
                      move.piece.owner === Player.SENTE ? 'text-blue-400' : 'text-slate-300'
                    }`}
                  >
                    {notation}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
