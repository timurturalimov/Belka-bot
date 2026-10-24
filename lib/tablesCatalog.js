// Каталог платных столов и цены (в Telegram Stars). Цены должны совпадать с index.html.
export const PAID_TABLE_IDS = [
  'blue-marble', 'green-marble', 'purple-wood', 'courtyard', 'gazebo',
  'train', 'carpet', 'astana', 'beach', 'yurt'
];
export const PRICE_ONE = 50;
export const PRICE_ALL = 300;

export const TABLE_TITLES = {
  'blue-marble': 'Синий мрамор', 'green-marble': 'Зелёный мрамор', 'purple-wood': 'Фиолетовое сукно',
  courtyard: 'Двор', gazebo: 'Беседка', train: 'Поезд', carpet: 'Ковёр',
  astana: 'Астана', beach: 'Пляж', yurt: 'Юрта'
};

export const FIREBASE_DB_URL = (process.env.FIREBASE_DB_URL
  || 'https://belka-game-4a0fd-default-rtdb.europe-west1.firebasedatabase.app').replace(/\/$/, '');

/** 'all' или id стола из каталога. */
export function isValidTableId(id) {
  return id === 'all' || PAID_TABLE_IDS.includes(id);
}

export function priceFor(id) {
  return id === 'all' ? PRICE_ALL : PRICE_ONE;
}
