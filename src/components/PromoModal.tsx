import React from 'react';
import { Piece } from '../types';
import ShogiPieceView from './ShogiPieceView';

interface PromoModalProps {
  isOpen: boolean;
  piece: Piece;
  onDecide: (promote: boolean) => void;
}

export default function PromoModal({ isOpen, piece, onDecide }: PromoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md transition-opacity">
      <div className="bg-slate-900/80 backdrop-blur-lg border border-white/15 rounded-3xl max-w-sm w-full p-6 shadow-2xl mx-4 transform transition-all animate-fade-in">
        <h3 className="text-lg font-bold text-white text-center font-serif border-b border-white/10 pb-3">
          駒の成選択 (Promotion Option)
        </h3>
        
        <p className="text-xs text-slate-300 my-4 text-center">
          この移動で駒を「成（プロモート）」させることができます。
        </p>

        {/* Comparison row */}
        <div className="flex items-center justify-around my-6">
          <button
            onClick={() => onDecide(false)}
            className="flex flex-col items-center gap-2 group p-4 border border-transparent hover:border-white/10 hover:bg-white/5 rounded-2xl transition-all cursor-pointer"
          >
            <ShogiPieceView piece={{ ...piece, promoted: false }} isInteractable={false} size="lg" />
            <span className="text-xs font-semibold text-slate-400 group-hover:text-white mt-2">
              成らず (No Promote)
            </span>
          </button>

          <div className="w-[1px] h-16 bg-white/10" />

          <button
            onClick={() => onDecide(true)}
            className="flex flex-col items-center gap-2 group p-4 border border-transparent hover:border-red-500/20 hover:bg-red-500/10 rounded-2xl transition-all cursor-pointer"
          >
            <ShogiPieceView piece={{ ...piece, promoted: true }} isInteractable={false} size="lg" />
            <span className="text-xs font-bold text-red-400 group-hover:text-red-300 mt-2">
              成る (Promote)
            </span>
          </button>
        </div>

        <div className="text-center text-[10px] text-slate-500">
          ※一度成った駒は、持ち駒になるまで元に戻せません。
        </div>
      </div>
    </div>
  );
}
