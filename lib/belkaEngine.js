// lib/dealState.js
import {
  createDeck, shuffle, deal,
  assignSeatSuits, getTrumpSuit, findJackOfClubsSeat,
  getLegalMoves, resolveTrick, trickPoints
} from './belkaEngine.js';

// dealerSeat: место раздающего (0-3) для ЭТОЙ раздачи
// dealNumber: 0 для первой раздачи матча, дальше +1 каждую раздачу
// seatSuits: результат assignSeatSuits — null для самой первой раздачи матча
export function startDeal(dealerSeat, dealNumber, seatSuits) {
  const hands = deal(shuffle(createDeck()));
  const jackOfClubsHolderSeat = findJackOfClubsSeat(hands);

  // Сразу после 1-й раздачи фиксируем личные масти на весь матч
  let resolvedSeatSuits = seatSuits;
  if (dealNumber === 0) {
    resolvedSeatSuits = assignSeatSuits(jackOfClubsHolderSeat);
  }

  const trumpSuit = getTrumpSuit(dealNumber, resolvedSeatSuits, jackOfClubsHolderSeat);

  return {
    dealNumber,
    dealerSeat,
    seatSuits: resolvedSeatSuits,
    trumpSuit,
    hands,                                   // [ [cards], [cards], [cards], [cards] ]
    currentTurn: (dealerSeat + 1) % 4,        // ход слева от раздающего
    currentTrick: [],                        // [{seat, card}]
    playedLeadSuits: new Set(),              // масти, которыми уже заходили в этой раздаче
    teamTricks: { 0: 0, 1: 0 },
    teamScores: { 0: 0, 1: 0 }
  };
}

// Возвращает { ok: true } или { ok: false, error }
export function playCard(state, seat, card) {
  if (seat !== state.currentTurn) {
    return { ok: false, error: 'not_your_turn' };
  }

  const hand = state.hands[seat];
  const cardIndex = hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
  if (cardIndex === -1) {
    return { ok: false, error: 'card_not_in_hand' };
  }

  const ledCard = state.currentTrick.length > 0 ? state.currentTrick[0].card : null;
  const legalMoves = getLegalMoves(hand, ledCard, state.trumpSuit, state.playedLeadSuits);
  const isLegal = legalMoves.some(c => c.suit === card.suit && c.rank === card.rank);
  if (!isLegal) {
    return { ok: false, error: 'illegal_move' };
  }

  // Если это первая карта в трике — фиксируем масть хода для правила про туз
  if (state.currentTrick.length === 0) {
    state.playedLeadSuits.add(card.suit);
  }

  hand.splice(cardIndex, 1);
  state.currentTrick.push({ seat, card });

  if (state.currentTrick.length < 4) {
    state.currentTurn = (seat + 1) % 4;
    return { ok: true, trickComplete: false };
  }

  // Трик собран — определяем победителя
  const plays = state.currentTrick.map(p => ({ playerIndex: p.seat, card: p.card }));
  const winnerSeat = resolveTrick(plays, state.trumpSuit);
  const points = trickPoints(plays);
  const winningTeam = winnerSeat % 2; // места 0,2 — команда 0; места 1,3 — команда 1

  state.teamTricks[winningTeam] += 1;
  state.teamScores[winningTeam] += points;

  state.currentTrick = [];
  state.currentTurn = winnerSeat; // ход у забравшего взятку

  return {
    ok: true,
    trickComplete: true,
    winnerSeat,
    winningTeam,
    points
  };
}

export function isDealFinished(state) {
  return state.hands.every(hand => hand.length === 0);
}
