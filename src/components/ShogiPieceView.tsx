import React from 'react';
import { Player, Piece } from '../types';

interface ShogiPieceViewProps {
  piece: Piece;
  isSelected?: boolean;
  isInteractable?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const PIECE_LABELS: Record<string, string> = {
  FU: '歩',
  KYO: '香',
  KEI: '桂',
  GIN: '銀',
  KIN: '金',
  KAKU: '角',
  HI: '飛',
  GYOKU: '玉',
};

export const PROMOTED_LABELS: Record<string, string> = {
  FU: 'と',
  KYO: '杏',
  KEI: '圭',
  GIN: '全',
  KIN: '金', // does not promote
  KAKU: '馬',
  HI: '竜',
  GYOKU: '玉', // does not promote
};

export const PIECE_ENGLISH: Record<string, string> = {
  FU: 'Pawn',
  KYO: 'Lance',
  KEI: 'Knight',
  GIN: 'Silver',
  KIN: 'Gold',
  KAKU: 'Bishop',
  HI: 'Rook',
  GYOKU: 'King',
};

export default function ShogiPieceView({
  piece,
  isSelected = false,
  isInteractable = true,
  onClick,
  size = 'md',
}: ShogiPieceViewProps) {
  const isSente = piece.owner === Player.SENTE;
  
  // Choose correct kanji label
  const label = piece.promoted
    ? PROMOTED_LABELS[piece.type]
    : isSente
      ? PIECE_LABELS[piece.type]
      : piece.type === 'GYOKU'
        ? '王' // Gote is etiquette-wise usually OU (王)
        : PIECE_LABELS[piece.type];

  // Sente points up, Gote points down. Use authentic pentagon clip-paths
  const clipPathStyle = isSente
    ? 'polygon(50% 0%, 100% 28%, 100% 100%, 0% 100%, 0% 28%)'
    : 'polygon(50% 100%, 100% 72%, 100% 0%, 0% 0%, 0% 72%)';

  // Sizing factors
  const sizeClasses = {
    sm: 'w-10 h-11 text-lg',
    md: 'w-11 h-12 sm:w-12 sm:h-14 text-xl sm:text-2xl',
    lg: 'w-14 h-16 text-3xl',
  };

  // Sente pushes Sente labels up, Gote flips Gote labels down for physical feel, or we keep it readable
  // Standard digital Shogi displays usually orient Gote pieces upside down to represent direction.
  // Traditional orientation makes Gote point down and labels face toward Gote (upside down for Sente).
  // Let's add a neat option or default to authentic flip (rotated 180deg) for Gote! It's super immersive.
  const rotationClass = isSente ? '' : 'rotate-180';

  // Stylings
  // Promoted pieces get traditional cinnabar red coloration. Unpromoted pieces are standard dynamic ink black.
  const colorClass = piece.promoted
    ? 'text-red-650 font-bold drop-shadow-[0_1px_1px_rgba(255,255,255,0.7)]'
    : 'text-stone-900 font-medium';

  // Beautiful box-shadow & border simulating wooden carved pieces
  const woodThemeClass = isSelected
    ? 'bg-amber-100 ring-2 ring-emerald-500 scale-105 shadow-lg border-emerald-400'
    : 'bg-radial from-amber-50 to-amber-200 hover:from-amber-100 border-amber-300 shadow-sm hover:shadow-md';

  return (
    <div
      onClick={(e) => {
        if (isInteractable && onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      className={`relative cursor-pointer transition-all duration-200 select-none flex flex-col items-center justify-center border ${sizeClasses[size]} ${woodThemeClass} ${rotationClass}`}
      style={{
        clipPath: clipPathStyle,
        borderRadius: '2px',
        WebkitClipPath: clipPathStyle,
      }}
      title={`${PIECE_ENGLISH[piece.type]} (${isSente ? 'Sente / ▲' : 'Gote / △'})${piece.promoted ? ' - Promoted' : ''}`}
    >
      {/* Visual alignment adjustment since pentagonal apex takes top space for Sente and bottom for Gote */}
      <div
        className={`flex flex-col items-center justify-center w-full h-full leading-none ${colorClass} ${
          isSente ? 'pt-2' : 'pb-2'
        }`}
      >
        <span className="font-serif tracking-tighter select-none">{label}</span>
        {/* Subtle helper english text for beginners so anyone can play Shogi easily! Let's make it super elegant */}
        <span className="text-[7px] sm:text-[8px] opacity-40 uppercase font-mono tracking-widest mt-0.5">
          {piece.type === 'GYOKU' ? 'K' : piece.type.substring(0, 2)}
          {piece.promoted && '+'}
        </span>
      </div>
    </div>
  );
}
