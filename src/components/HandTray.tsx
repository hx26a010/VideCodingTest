import React from 'react';
import { Player, Piece, PieceType } from '../types';
import ShogiPieceView from './ShogiPieceView';

interface HandTrayProps {
  player: Player;
  isActiveTurn: boolean;
  capturedPieces: Piece[];
  selectedPiece: { source: 'board' | 'hand'; piece: Piece } | null;
  onSelectPiece: (piece: Piece, index: number) => void;
  gameStatus: string;
}

export default function HandTray({
  player,
  isActiveTurn,
  capturedPieces,
  selectedPiece,
  onSelectPiece,
  gameStatus,
}: HandTrayProps) {
  const isSente = player === Player.SENTE;

  // Group captured pieces by type
  // Sente wants to see their captured pieces cleanly.
  // We can group them so it's clean, but we must keep track of their index of capture.
  const grouped = capturedPieces.reduce<
    Record<PieceType, { pieces: Piece[]; indices: number[] }>
  >((acc, piece, index) => {
    if (!acc[piece.type]) {
      acc[piece.type] = { pieces: [], indices: [] };
    }
    acc[piece.type].pieces.push(piece);
    acc[piece.type].indices.push(index);
    return acc;
  }, {} as Record<PieceType, { pieces: Piece[]; indices: number[] }>);

  const pieceTypesOrder: PieceType[] = ['HI', 'KAKU', 'KIN', 'GIN', 'KEI', 'KYO', 'FU'];

  return (
    <div
      className={`p-4 rounded-3xl border flex flex-col justify-between h-full shadow-2xl transition-all duration-350 backdrop-blur-md ${
        isActiveTurn && gameStatus === 'PLAYING'
          ? 'bg-white/10 border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20'
          : 'bg-white/5 border-white/10'
      }`}
    >
      {/* Tray Header */}
      <div className="flex items-center justify-between border-b pb-2 border-white/10">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isSente ? 'bg-blue-400 animate-pulse' : 'bg-slate-400'
            }`}
          />
          <span className="font-bold text-xs text-slate-200 tracking-wide">
            {isSente ? '先手 ▲ 持ち駒 (Sente)' : '後手 △ 持ち駒 (Gote)'}
          </span>
        </div>
        <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-slate-300 font-mono font-medium">
          計 {capturedPieces.length}
        </span>
      </div>

      {/* Grid of pieces */}
      <div className="flex-1 mt-3 grid grid-cols-4 sm:grid-cols-7 gap-2.5 items-center justify-items-center min-h-[50px]">
        {capturedPieces.length === 0 ? (
          <div className="col-span-full text-center py-4 text-slate-500 text-xs italic select-none">
            駒はありません (No pieces in hand)
          </div>
        ) : (
          pieceTypesOrder.map((type) => {
            const group = grouped[type];
            if (!group || group.pieces.length === 0) return null;

            const displayPiece = group.pieces[0];
            const firstIndex = group.indices[0];

            const isThisSelected =
              selectedPiece?.source === 'hand' &&
              selectedPiece.piece.id === displayPiece.id;

            return (
              <div key={type} className="relative group">
                <ShogiPieceView
                  piece={{ ...displayPiece, owner: player }} // override owner temporarily to face correctly in owner's hand
                  isSelected={isThisSelected}
                  isInteractable={isActiveTurn && gameStatus !== 'CHECKMATE'}
                  onClick={() => onSelectPiece(displayPiece, firstIndex)}
                  size="sm"
                />

                {/* Badge for multiple pieces */}
                {group.pieces.length > 1 && (
                  <span className="absolute -bottom-1 -right-1 py-0.5 px-1.5 bg-blue-600 text-white rounded-full font-sans text-[9px] font-bold border border-slate-900 flex items-center justify-center shadow-lg">
                    {group.pieces.length}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
