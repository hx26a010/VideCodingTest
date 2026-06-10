import { Player, Piece, PieceType, Board, Move } from './types';
import { getLegalMoves, getLegalDrops, simulateMoveAndCheckIfSelfChecked, canPromote, mustPromote } from './shogiRules';

// Dynamic values for pieces in Shogi
const PIECE_VALUES: Record<PieceType, number> = {
  FU: 100,
  KYO: 450,
  KEI: 550,
  GIN: 700,
  KIN: 800,
  KAKU: 1100,
  HI: 1300,
  GYOKU: 500000,
};

const PROMOTED_VALUES: Record<PieceType, number> = {
  FU: 600,     // と
  KYO: 650,    // 成香
  KEI: 650,    // 成桂
  GIN: 700,    // 成銀
  KIN: 800,    // Gold cannot promote, but let's give default
  KAKU: 1300,  // 馬 (Horse)
  HI: 1550,    // 竜 (Dragon)
  GYOKU: 500000,
};

// Evaluate the board from the Sente perspective (Sente: +, Gote: -)
export function evaluateBoard(
  board: Board,
  captured: { [Player.SENTE]: Piece[]; [Player.GOTE]: Piece[] }
): number {
  let score = 0;

  // 1. Board Piece values
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece) {
        const val = piece.promoted ? PROMOTED_VALUES[piece.type] : PIECE_VALUES[piece.type];
        const mult = piece.owner === Player.SENTE ? 1 : -1;

        // Position weight: Pawns are better closer to promotion
        let posBonus = 0;
        if (piece.type === 'FU' && !piece.promoted) {
          posBonus = piece.owner === Player.SENTE ? (8 - r) * 10 : r * 10;
        }

        score += (val + posBonus) * mult;
      }
    }
  }

  // 2. Captured pieces in Hands (extremely valuable)
  const handMultiplier = 1.1; // Captured pieces are worth slightly more because they're versatile
  for (const piece of captured[Player.SENTE]) {
    score += PIECE_VALUES[piece.type] * handMultiplier;
  }
  for (const piece of captured[Player.GOTE]) {
    score -= PIECE_VALUES[piece.type] * handMultiplier;
  }

  return score;
}

interface SimulatedMoveDescriptor {
  from: { row: number; col: number } | null; // null for drop
  to: { row: number; col: number };
  piece: Piece;
  capturedIndex?: number; // active index in hand
  promote: boolean;
}

// Generates all possible legal actions (Board moves + Drops) currently available for a given player
function getPlayerLegalActions(
  board: Board,
  capturedList: Piece[],
  player: Player
): SimulatedMoveDescriptor[] {
  const actions: SimulatedMoveDescriptor[] = [];

  // A. Piece board moves
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece && piece.owner === player) {
        const legalCoords = getLegalMoves(board, r, c, player);
        for (const coord of legalCoords) {
          const promoChance = canPromote(piece, r, coord.row);
          const chargePromo = mustPromote(piece, coord.row);

          if (chargePromo) {
            // Must promote
            actions.push({
              from: { row: r, col: c },
              to: coord,
              piece,
              promote: true,
            });
          } else if (promoChance) {
            // Can choose to promote or not
            actions.push({
              from: { row: r, col: c },
              to: coord,
              piece,
              promote: true,
            });
            actions.push({
              from: { row: r, col: c },
              to: coord,
              piece,
              promote: false,
            });
          } else {
            actions.push({
              from: { row: r, col: c },
              to: coord,
              piece,
              promote: false,
            });
          }
        }
      }
    }
  }

  // B. Hand drops
  // To optimize, unique list of types in hand
  const seenTypesInHand = new Set<string>();
  capturedList.forEach((piece, index) => {
    if (seenTypesInHand.has(piece.type)) return;
    seenTypesInHand.add(piece.type);

    const legalDrops = getLegalDrops(board, piece, player);
    for (const coord of legalDrops) {
      actions.push({
        from: null,
        to: coord,
        piece,
        capturedIndex: index,
        promote: false,
      });
    }
  });

  return actions;
}

// Simulate an action and return the calculated score
function simulateAndEvaluate(
  board: Board,
  captured: { [Player.SENTE]: Piece[]; [Player.GOTE]: Piece[] },
  action: SimulatedMoveDescriptor,
  player: Player
): number {
  // Shallow copy board
  const simBoard = board.map(row => [...row]);
  const simCaptured = {
    [Player.SENTE]: [...captured[Player.SENTE]],
    [Player.GOTE]: [...captured[Player.GOTE]],
  };

  const opponent = player === Player.SENTE ? Player.GOTE : Player.SENTE;

  if (action.from === null) {
    // Drop piece
    const index = action.capturedIndex ?? 0;
    // Remove from player's captured hand
    const droppedPiece = simCaptured[player].splice(index, 1)[0];

    // Place on board
    simBoard[action.to.row][action.to.col] = {
      ...droppedPiece,
      owner: player,
      promoted: false, // Drop is always unpromoted
    };
  } else {
    // Board movement
    const target = simBoard[action.to.row][action.to.col];
    const sourcePiece = simBoard[action.from.row][action.from.col];

    if (sourcePiece) {
      // Handle Capture
      if (target) {
        // Demote captured piece if it was promoted
        const cleanCaptured: Piece = {
          ...target,
          owner: player, // change ownership
          promoted: false,
        };
        simCaptured[player].push(cleanCaptured);
      }

      // Move source
      simBoard[action.to.row][action.to.col] = {
        ...sourcePiece,
        promoted: action.promote ? true : sourcePiece.promoted,
      };
      simBoard[action.from.row][action.from.col] = null;
    }
  }

  return evaluateBoard(simBoard, simCaptured);
}

// Compute the absolute best AI move (running for Player.GOTE by default)
export function getBestAIMove(
  board: Board,
  captured: { [Player.SENTE]: Piece[]; [Player.GOTE]: Piece[] },
  player: Player,
  difficulty: 'EASY' | 'MEDIUM'
): { action: SimulatedMoveDescriptor; evaluation: number } | null {
  const actions = getPlayerLegalActions(board, captured[player], player);
  if (actions.length === 0) return null;

  // Evaluate all actions
  const ratedActions = actions.map(act => {
    const score = simulateAndEvaluate(board, captured, act, player);
    return {
      action: act,
      score,
    };
  });

  // Sort: Gote wants to minimize score (since Sente is positive), Sente wants to maximize
  const isGote = player === Player.GOTE;
  ratedActions.sort((a, b) => (isGote ? a.score - b.score : b.score - a.score));

  if (difficulty === 'EASY') {
    // Easy mode: 50% chance to pick some randomized top-ranked move instead of absolute best
    if (Math.random() > 0.4 && ratedActions.length > 1) {
      const topCount = Math.min(ratedActions.length, 4); // choose from top 4 moves
      const randomIndex = Math.floor(Math.random() * topCount);
      return {
        action: ratedActions[randomIndex].action,
        evaluation: ratedActions[randomIndex].score,
      };
    }
  }

  // Medium mode (or Easy's default best): strict optimal move
  return {
    action: ratedActions[0].action,
    evaluation: ratedActions[0].score,
  };
}
