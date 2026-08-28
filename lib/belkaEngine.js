// lib/belkaEngine.js

export const CONFIG = {
  totalEyesToWin: 12,
  spasThreshold: 31,
  zeroTricksGivesAllEyes: true,
  tieScore: 60,
  tieReplayEyes: 4,
  eyeTable: {
    trumpWinner_spas: 1,
    trumpWinner_noSpas: 2,
    trumpLoser_spas: 2,
    trumpLoser_noSpas: 3
  },
  trumpRotation: ['C', 'S', 'H', 'D'], // трефы, пики, черви, бубны
  jackOrder: ['C', 'S', 'H', 'D'],     // старшинство валетов
  cardPoints: { A: 11, '10': 10, K: 4, Q: 3, J: 2, '9': 0, '8': 0, '7': 0, '6': 0 }
};

const SUITS = ['C', 'S', 'H', 'D'];
const RANKS = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_ORDER = { '6':0,'7':1,'8':2,'9':3,'10':4,'J':5,'Q':6,'K':7,'A':8 };

export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, points: CONFIG.cardPoints[rank] || 0 });
    }
  }
  return deck;
}

export function shuffle(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// Раздаёт по 8 карт каждому из 4 игроков (32 карты), 4 карты остаются в колоде
export function deal(deck) {
  const hands = [[], [], [], []];
  for (let i = 0; i < 32; i++) {
    hands[i % 4].push(deck[i]);
  }
  return hands;
}

export function getTrumpSuit(dealNumber) {
  return CONFIG.trumpRotation[dealNumber % CONFIG.trumpRotation.length];
}

function isJack(card) {
  return card.rank === 'J';
}

// Сила карты для сравнения внутри взятки
function cardStrength(card, trumpSuit) {
  if (isJack(card)) {
    const idx = CONFIG.jackOrder.indexOf(card.suit);
    return 1000 - idx; // валет треф — самый сильный
  }
  if (card.suit === trumpSuit) {
    return 500 + RANK_ORDER[card.rank];
  }
  return RANK_ORDER[card.rank];
}

// К какой "группе" относится карта для правила "ходи в масть".
// Валеты считаются козырной группой, а не своей исходной мастью.
function effectiveGroup(card, trumpSuit) {
  if (isJack(card)) return 'TRUMP_GROUP';
  if (card.suit === trumpSuit) return 'TRUMP_GROUP';
  return card.suit;
}

// Какие карты можно сходить, учитывая карту, с которой зашли
export function getLegalMoves(hand, ledCard, trumpSuit) {
  if (!ledCard) return hand;
  const ledGroup = effectiveGroup(ledCard, trumpSuit);
  const matching = hand.filter(c => effectiveGroup(c, trumpSuit) === ledGroup);
  return matching.length > 0 ? matching : hand;
}

// plays = [{playerIndex, card}], возвращает индекс победителя взятки
export function resolveTrick(plays, trumpSuit) {
  const ledCard = plays[0].card;
  const ledGroup = effectiveGroup(ledCard, trumpSuit);

  let best = null;
  for (const play of plays) {
    const group = effectiveGroup(play.card, trumpSuit);
    if (group !== 'TRUMP_GROUP' && group !== ledGroup) continue;
    const strength = cardStrength(play.card, trumpSuit);
    if (!best || strength > best.strength) {
      best = { playerIndex: play.playerIndex, strength };
    }
  }
  return best.playerIndex;
}

export function trickPoints(plays) {
  return plays.reduce((sum, p) => sum + p.card.points, 0);
}

// winningTeam: 0 или 1. teamScores/teamTricks — объекты {0: n, 1: n}
export function calculateEyes(winningTeam, teamScores, teamTricks, hadTrump) {
  const losingTeam = winningTeam === 0 ? 1 : 0;

  if (CONFIG.zeroTricksGivesAllEyes && teamTricks[losingTeam] === 0) {
    return { eyes: CONFIG.totalEyesToWin, reason: 'zero_tricks', winner: winningTeam };
  }

  if (teamScores[0] === CONFIG.tieScore && teamScores[1] === CONFIG.tieScore) {
    return { eyes: 0, reason: 'tie_replay', replayEyes: CONFIG.tieReplayEyes };
  }

  const hasSpas = teamScores[losingTeam] >= CONFIG.spasThreshold;
  let eyes;
  if (hadTrump) {
    eyes = hasSpas ? CONFIG.eyeTable.trumpWinner_spas : CONFIG.eyeTable.trumpWinner_noSpas;
  } else {
    eyes = hasSpas ? CONFIG.eyeTable.trumpLoser_spas : CONFIG.eyeTable.trumpLoser_noSpas;
  }
  return { eyes, reason: 'normal', winner: winningTeam };
}
