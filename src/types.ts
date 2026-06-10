export enum Player {
  SENTE = 'SENTE', // 先手 (Black/First - moves up)
  GOTE = 'GOTE',   // 後手 (White/Second - moves down)
}

export type PieceType = 'FU' | 'KYO' | 'KEI' | 'GIN' | 'KIN' | 'KAKU' | 'HI' | 'GYOKU';

export interface Piece {
  id: string; // Unique ID for key tracking
  type: PieceType;
  promoted: boolean;
  owner: Player;
}

export type Board = (Piece | null)[][]; // 9x9 board

export interface Move {
  from: { row: number; col: number } | null; // null if drop
  to: { row: number; col: number };
  piece: Piece;
  promotedBefore: boolean;
  promotedAfter: boolean;
  capturedPiece: Piece | null;
  drop: boolean;
}

export type GameStatus = 'PLAYING' | 'CHECK' | 'CHECKMATE' | 'SENTE_WIN' | 'GOTE_WIN' | 'DRAW';

export interface GameState {
  board: Board;
  captured: {
    [Player.SENTE]: Piece[];
    [Player.GOTE]: Piece[];
  };
  turn: Player;
  selectedPiece: {
    source: 'board' | 'hand';
    row?: number;
    col?: number;
    piece: Piece;
  } | null;
  history: Move[];
  status: GameStatus;
  vsAI: boolean;
  aiDifficulty: 'EASY' | 'MEDIUM';
}
