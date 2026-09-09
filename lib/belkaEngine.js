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
  // Порядок "личных мастей" от игрока, у которого валет треф закрепился
  // после 1-й раздачи: он сам = трефы, слева = черви, напротив = пики, справа = бубны
  seatSuitOrder: ['C', 'H', 'S', 'D'],
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

// --- Определение козыря по раздачам (сит-based правило) ---

// Вызывается один раз, сразу после 1-й раздачи (где козырь всегда трефы).
// jackOfClubsSeat — место (0-3), у которого на руках оказался валет треф в 1-й раздаче.
// Возвращает мапу seatIndex -> "личная масть" этого места на весь матч.
export function assignSeatSuits(jackOfClubsSeat) {
  const seatSuits = {};
  for (let offset = 0; offset < 4; offset++) {
    const seat = (jackOfClubsSeat + offset) % 4;
    seatSuits[seat] = CONFIG.seatSuitOrder[offset];
  }
  return seatSuits;
}

// dealNumber: 0 для первой раздачи.
// seatSuits: результат assignSeatSuits (нужен для всех раздач, кроме первой).
// jackOfClubsHolderSeat: место, у которого лежит валет треф В ЭТОЙ раздаче.
export function getTrumpSuit(dealNumber, seatSuits, jackOfClubsHolderSeat) {
  if (dealNumber === 0) return 'C';
  return seatSuits[jackOfClubsHolderSeat];
}

// Хелпер: найти, у какого места лежит валет треф в конкретной раздаче
export function findJackOfClubsSeat(hands) {
  return hands.findIndex(hand => hand.some(c => c.suit === 'C' && c.rank === 'J'));
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

// Какие карты можно сходить, учитывая карту, с которой зашли.
// playedLeadSuits — Set мастей, которыми уже заходили (ходили первой картой)
// в текущей раздаче. Нужен для правила про запрет сброса туза неигранной масти.
export function getLegalMoves(hand, ledCard, trumpSuit, playedLeadSuits = new Set()) {
  if (!ledCard) return hand; // ходишь первым — можно любую карту, включая туз

  const ledGroup = effectiveGroup(ledCard, trumpSuit);
  const matching = hand.filter(c => effectiveGroup(c, trumpSuit) === ledGroup);
  if (matching.length > 0) return matching; // обязан ходить в масть/козырь

  // Своей масти (и козыря) нет — свободный ход, но с ограничением на туз.
  // Козырять можно всегда, ограничение касается только сброса.
  return hand.filter(c => {
    if (effectiveGroup(c, trumpSuit) === 'TRUMP_GROUP') return true;
    if (c.rank === 'A' && !playedLeadSuits.has(c.suit)) return false;
    return true;
  });
}

// plays = [{playerIndex, card}], возвращает инд
