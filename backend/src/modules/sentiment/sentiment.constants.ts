import { AssetMarket } from '../../shared/enums';

export interface FeedDefinition {
  name: string;
  url: string;
  language: 'en' | 'es';
  source: 'COINDESK' | 'COINTELEGRAPH' | 'AMBITO' | 'CRONISTA';
}

export interface WatchlistSymbol {
  symbol: string;
  market: AssetMarket;
  keywords: string[];
}

export const RSS_FEEDS: FeedDefinition[] = [
  {
    name: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    language: 'en',
    source: 'COINDESK',
  },
  {
    name: 'CoinTelegraph',
    url: 'https://cointelegraph.com/rss',
    language: 'en',
    source: 'COINTELEGRAPH',
  },
  {
    name: 'Ambito',
    url: 'https://www.ambito.com/rss/pages/economia.xml',
    language: 'es',
    source: 'AMBITO',
  },
  {
    name: 'El Cronista',
    url: 'https://www.cronista.com/rss/economia/',
    language: 'es',
    source: 'CRONISTA',
  },
];

export const SUBREDDITS: Array<{ name: string; language: 'en' | 'es' }> = [
  { name: 'CryptoCurrency', language: 'en' },
  { name: 'Bitcoin', language: 'en' },
  { name: 'ethereum', language: 'en' },
  { name: 'merval', language: 'es' },
  { name: 'argentina', language: 'es' },
];

export const WATCHLIST_SYMBOLS: WatchlistSymbol[] = [
  { symbol: 'BTC', market: AssetMarket.CRYPTO, keywords: ['btc', 'bitcoin'] },
  { symbol: 'ETH', market: AssetMarket.CRYPTO, keywords: ['eth', 'ethereum'] },
  { symbol: 'SOL', market: AssetMarket.CRYPTO, keywords: ['sol', 'solana'] },
  { symbol: 'BNB', market: AssetMarket.CRYPTO, keywords: ['bnb', 'binance coin', 'binancecoin'] },
  { symbol: 'ADA', market: AssetMarket.CRYPTO, keywords: ['ada', 'cardano'] },
  { symbol: 'MATIC', market: AssetMarket.CRYPTO, keywords: ['matic', 'polygon'] },
  { symbol: 'DOT', market: AssetMarket.CRYPTO, keywords: ['dot', 'polkadot'] },
  { symbol: 'GGAL', market: AssetMarket.STOCK_AR, keywords: ['ggal', 'galicia', 'grupo financiero galicia'] },
  { symbol: 'YPFD', market: AssetMarket.STOCK_AR, keywords: ['ypfd', 'ypf'] },
  { symbol: 'BMA', market: AssetMarket.STOCK_AR, keywords: ['bma', 'macro', 'banco macro'] },
  { symbol: 'AL30', market: AssetMarket.BOND, keywords: ['al30'] },
  { symbol: 'GD30', market: AssetMarket.BOND, keywords: ['gd30'] },
];

export const RELEVANCE_ONLY_KEYWORDS = [
  'dolar',
  'dolar blue',
  'bcra',
  'cepo',
  'devaluacion',
  'merval',
];

export const ALL_RELEVANCE_KEYWORDS = Array.from(
  new Set([
    ...WATCHLIST_SYMBOLS.flatMap((item) => item.keywords),
    ...RELEVANCE_ONLY_KEYWORDS,
  ]),
);