import { Player, Piece, PieceType, Board, Move } from './types';

// Create a unique peace helper
let pieceIdCounter = 0;
export function createPiece(type: PieceType, owner: Player, promoted = false): Piece {
  pieceIdCounter++;
  return {
    id: `${type.toLowerCase()}_${pieceIdCounter}`,
    type,
    promoted,
    owner,
  };
}

// Set up the standard Shogi board
export function createInitialBoard(): Board {
  const board: Board = Array(9)
    .fill(null)
    .map(() => Array(9).fill(null));

  // --- Gote Side (Rear at row 0, Bishop/Rook at row 1, Pawns at row 2) ---
  const goteBackRow: PieceType[] = ['KYO', 'KEI', 'GIN', 'KIN', 'GYOKU', 'KIN', 'GIN', 'KEI', 'KYO'];
  for (let col = 0; col < 9; col++) {
    board[0][col] = createPiece(goteBackRow[col], Player.GOTE);
  }
  board[1][1] = createPiece('HI', Player.GOTE);       // Rook on col 1
  board[1][7] = createPiece('KAKU', Player.GOTE);     // Bishop on col 7
  for (let col = 0; col < 9; col++) {
    board[2][col] = createPiece('FU', Player.GOTE);
  }

  // --- Sente Side (Rear at row 8, Bishop/Rook at row 7, Pawns at row 6) ---
  const senteBackRow: PieceType[] = ['KYO', 'KEI', 'GIN', 'KIN', 'GYOKU', 'KIN', 'GIN', 'KEI', 'KYO'];
  for (let col = 0; col < 9; col++) {
    board[8][col] = createPiece(senteBackRow[col], Player.SENTE);
  }
  board[7][1] = createPiece('KAKU', Player.SENTE);     // Bishop on col 1
  board[7][7] = createPiece('HI', Player.SENTE);       // Rook on col 7
  for (let col = 0; col < 9; col++) {
    board[6][col] = createPiece('FU', Player.SENTE);
  }

  return board;
}

// Helpers for board boundaries
export function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < 9 && col >= 0 && col < 9;
}

// Check if a piece can move to a specific coordinates (unvalidated for Check)
export function getRawMoves(board: Board, row: number, col: number): { row: number; col: number }[] {
  const piece = board[row][col];
  if (!piece) return [];

  const moves: { row: number; col: number }[] = [];
  const dir = piece.owner === Player.SENTE ? -1 : 1; // Sente moves up (-row), Gote moves down (+row)

  const addMove = (r: number, c: number) => {
    if (!inBounds(r, c)) return false;
    const dest = board[r][c];
    if (!dest) {
      moves.push({ row: r, col: c });
      return true; // continue sliding
    } else {
      if (dest.owner !== piece.owner) {
        moves.push({ row: r, col: c }); // capture
      }
      return false; // block slide
    }
  };

  const addSlide = (dRow: number, dCol: number) => {
    let r = row + dRow;
    let c = col + dCol;
    while (inBounds(r, c)) {
      const ongoing = addMove(r, c);
      if (!ongoing) break;
      r += dRow;
      c += dCol;
    }
  };

  // If promoted, most pieces move like Gold General (KIN)
  // Promoted Silver (成銀), Knight (成桂), Lance (成香), Pawn (と)
  const behavesAsGold =
    piece.type === 'KIN' ||
    (piece.promoted && (piece.type === 'FU' || piece.type === 'KYO' || piece.type === 'KEI' || piece.type === 'GIN'));

  if (behavesAsGold) {
    // Gold General Core movements:
    // 1 step forward, backward, left, right, and forward diagonals.
    // Sente forward is -1, Gote forward is +1
    const goldOffsets = [
      { r: dir, c: 0 },   // Straight Forward
      { r: dir, c: -1 },  // Forward-Left Diagonal
      { r: dir, c: 1 },   // Forward-Right Diagonal
      { r: 0, c: -1 },    // Left
      { r: 0, c: 1 },     // Right
      { r: -dir, c: 0 },  // Straight Backward
    ];
    for (const offset of goldOffsets) {
      addMove(row + offset.r, col + offset.c);
    }
    return moves;
  }

  switch (piece.type) {
    case 'FU': // Pawn
      addMove(row + dir, col);
      break;

    case 'KYO': // Lance (slides forward only)
      addSlide(dir, 0);
      break;

    case 'KEI': // Knight (moves L-shape forwards, can jump!)
      // Sente jumps: (row-2, col-1), (row-2, col+1)
      // Gote jumps: (row+2, col-1), (row+2, col+1)
      const kRow = row + dir * 2;
      const kCols = [col - 1, col + 1];
      for (const kc of kCols) {
        if (inBounds(kRow, kc)) {
          const dest = board[kRow][kc];
          if (!dest || dest.owner !== piece.owner) {
            moves.push({ row: kRow, col: kc });
          }
        }
      }
      break;

    case 'GIN': // Silver General
      // moves 1 step diagonally (4 directions) plus 1 step forward (1 direction)
      const silverOffsets = [
        { r: dir, c: 0 },   // Forward
        { r: dir, c: -1 },  // Forward Left Diagonal
        { r: dir, c: 1 },   // Forward Right Diagonal
        { r: -dir, c: -1 }, // Backward Left Diagonal
        { r: -dir, c: 1 },  // Backward Right Diagonal
      ];
      for (const o of silverOffsets) {
        addMove(row + o.r, col + o.c);
      }
      break;

    case 'KAKU': // Bishop
      addSlide(1, 1);
      addSlide(1, -1);
      addSlide(-1, 1);
      addSlide(-1, -1);
      if (piece.promoted) {
        // Horse (馬): Bishop + 1 square orthogonal (up, down, left, right)
        addMove(row + 1, col);
        addMove(row - 1, col);
        addMove(row, col + 1);
        addMove(row, col - 1);
      }
      break;

    case 'HI': // Rook
      addSlide(1, 0);
      addSlide(-1, 0);
      addSlide(0, 1);
      addSlide(0, -1);
      if (piece.promoted) {
        // Dragon (竜): Rook + 1 square diagonal
        addMove(row + 1, col + 1);
        addMove(row + 1, col - 1);
        addMove(row - 1, col + 1);
        addMove(row - 1, col - 1);
      }
      break;

    case 'GYOKU': // King
      // moves 1 step in any of 8 directions
      const kingOffsets = [
        { r: 1, c: 0 }, { r: -1, c: 0 }, { r: 0, c: 1 }, { r: 0, c: -1 },
        { r: 1, c: 1 }, { r: 1, c: -1 }, { r: -1, c: 1 }, { r: -1, c: -1 }
      ];
      for (const o of kingOffsets) {
        addMove(row + o.r, col + o.c);
      }
      break;
  }

  return moves;
}

// Find King position
export function findKing(board: Board, player: Player): { row: number; col: number } | null {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'GYOKU' && piece.owner === player) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

// Check if King of player is in check
export function isKingInCheck(board: Board, player: Player): boolean {
  const kingPos = findKing(board, player);
  if (!kingPos) return false;

  // Scan all spaces and see if opponent can reach kingPos
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece && piece.owner !== player) {
        const rawMoves = getRawMoves(board, r, c);
        if (rawMoves.some(m => m.row === kingPos.row && m.col === kingPos.col)) {
          return true;
        }
      }
    }
  }
  return false;
}

// Simulates a move on a shallow copy board to test check condition
export function simulateMoveAndCheckIfSelfChecked(
  board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  player: Player
): boolean {
  // Create virtual board
  const simBoard: Board = board.map(row => [...row]);
  const p = simBoard[fromRow][fromCol];
  if (!p) return true; // Invalid source

  // Move
  simBoard[toRow][toCol] = p;
  simBoard[fromRow][fromCol] = null;

  return isKingInCheck(simBoard, player);
}

// Get final legal moves for a piece on the board, ensuring the move doesn't leave own King in check.
export function getLegalMoves(board: Board, row: number, col: number, player: Player): { row: number; col: number }[] {
  const piece = board[row][col];
  if (!piece || piece.owner !== player) return [];

  const rawMoves = getRawMoves(board, row, col);
  return rawMoves.filter(m => !simulateMoveAndCheckIfSelfChecked(board, row, col, m.row, m.col, player));
}

// Check if player has any unpromoted pawn on col (Nifu - 二歩 check)
export function colHasUnpromotedPawn(board: Board, col: number, player: Player): boolean {
  for (let r = 0; r < 9; r++) {
    const piece = board[r][col];
    if (piece && piece.type === 'FU' && !piece.promoted && piece.owner === player) {
      return true;
    }
  }
  return false;
}

// Get valid coordinates for dropping a piece from captured hand.
export function getLegalDrops(board: Board, piece: Piece, player: Player): { row: number; col: number }[] {
  const drops: { row: number; col: number }[] = [];

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      // Cell must be empty
      if (board[r][c] !== null) continue;

      // 1. Double Pawn check (二歩 - Nifu)
      if (piece.type === 'FU' && colHasUnpromotedPawn(board, c, player)) {
        continue;
      }

      // 2. Dead-end check (pieces with forward moves must be able to move further)
      // Sente moves UP (row 0 is end), Gote moves DOWN (row 8 is end)
      if (player === Player.SENTE) {
        if (piece.type === 'FU' && r === 0) continue;
        if (piece.type === 'KYO' && r === 0) continue;
        if (piece.type === 'KEI' && r <= 1) continue;
      } else {
        if (piece.type === 'FU' && r === 8) continue;
        if (piece.type === 'KYO' && r === 8) continue;
        if (piece.type === 'KEI' && r >= 7) continue;
      }

      // 3. Uchifuzume (打ち歩詰め) Check
      // Dropping a Pawn to immediately checkmate is illegal.
      // To guarantee perfect speed, we'll do standard validation. We'll simulate the drop and check if it targets the opponent's king.
      // If it's a pawn drop, and leads to checkmate, we block it.
      if (piece.type === 'FU') {
        const simBoard = board.map(row => [...row]);
        simBoard[r][c] = { ...piece, owner: player, promoted: false };
        const opponent = player === Player.SENTE ? Player.GOTE : Player.SENTE;

        // Is opponent's king put in check?
        if (isKingInCheck(simBoard, opponent)) {
          // Check if this check leaves opponent with ZERO legal moves (checkmate)
          if (hasNoLegalMoves(simBoard, opponent)) {
            continue; // Uchifuzume! Illegal.
          }
        }
      }

      // Check if this drop leaves own king in check (usually can't, but let's check safety)
      const simBoard = board.map(row => [...row]);
      simBoard[r][c] = { ...piece, owner: player, promoted: false };
      if (isKingInCheck(simBoard, player)) {
        continue; // Leaves own king in check (e.g. if king was already in check and this drop doesn't block it)
      }

      drops.push({ row: r, col: c });
    }
  }

  return drops;
}

// Determines if player has zero legal moves / drops available (Checkmate or Stalemate)
export function hasNoLegalMoves(board: Board, player: Player, capturedList: Piece[] = []): boolean {
  // 1. Check all piece moves on the board
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece && piece.owner === player) {
        const legalMoves = getLegalMoves(board, r, c, player);
        if (legalMoves.length > 0) return false;
      }
    }
  }

  // 2. Check all pocket drops
  // Group captured list by piece type to avoid redundant logic
  const pocketTypes = Array.from(new Set(capturedList.map(p => p.type)));
  for (const type of pocketTypes) {
    const pSample = capturedList.find(p => p.type === type);
    if (pSample) {
      const legalDrops = getLegalDrops(board, pSample, player);
      if (legalDrops.length > 0) return false;
    }
  }

  return true;
}

// Check if a move triggers option to promote
// Zone is last 3 rows (Sente 0,1,2; Gote 6,7,8)
export function canPromote(piece: Piece, fromRow: number | null, toRow: number): boolean {
  if (piece.promoted) return false;
  if (piece.type === 'GYOKU' || piece.type === 'KIN') return false;

  const isSente = piece.owner === Player.SENTE;
  if (isSente) {
    // Entering, moving within, or exiting the zone (row 0, 1, 2)
    const inZoneBefore = fromRow !== null && fromRow <= 2;
    const inZoneAfter = toRow <= 2;
    return inZoneBefore || inZoneAfter;
  } else {
    // Entering, moving within, or exiting the zone (row 6, 7, 8)
    const inZoneBefore = fromRow !== null && fromRow >= 6;
    const inZoneAfter = toRow >= 6;
    return inZoneBefore || inZoneAfter;
  }
}

// Force promotion if Pawn/Lance on rank 1 or Knight on rank 1,2 (Sente)
// For Gote, rank 9 (row 8) for Pawn/Lance, rank 8,9 (row 7,8) for Knight
export function mustPromote(piece: Piece, toRow: number): boolean {
  if (piece.promoted) return false;
  const isSente = piece.owner === Player.SENTE;
  if (isSente) {
    if ((piece.type === 'FU' || piece.type === 'KYO') && toRow === 0) return true;
    if (piece.type === 'KEI' && toRow <= 1) return true;
  } else {
    if ((piece.type === 'FU' || piece.type === 'KYO') && toRow === 8) return true;
    if (piece.type === 'KEI' && toRow >= 7) return true;
  }
  return false;
}
