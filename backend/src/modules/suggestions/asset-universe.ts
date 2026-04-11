import { AssetMarket } from '../../shared/enums';

export const CRYPTO_UNIVERSE: string[] = [
  'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'BNB', 'MATIC', 'DOT', 'AVAX', 'LINK',
  'UNI', 'ATOM', 'LTC', 'BCH', 'XLM', 'NEAR', 'APT', 'ARB', 'OP', 'INJ',
];

export const STOCKS_AR_UNIVERSE: string[] = [
  'GGAL', 'YPFD', 'BMA', 'PAMP', 'TXAR', 'ALUA', 'BYMA', 'SUPV', 'TECO2',
  'LOMA', 'MIRG', 'HARG', 'COME', 'BBAR', 'CRES', 'VIST', 'IRSA', 'PBDA',
];

export const CEDEARS_UNIVERSE: string[] = [
  'AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA', 'META', 'AMZN', 'BABA', 'DISN', 'KO',
];

export const BONDS_UNIVERSE: string[] = [
  'AL30', 'GD30', 'AY24', 'GD35', 'AL35', 'GD41', 'GD46',
];

export const FX_UNIVERSE: string[] = ['MEP', 'CCL'];

export const ALL_UNIVERSE: Array<{ symbol: string; market: AssetMarket }> = [
  ...CRYPTO_UNIVERSE.map((symbol) => ({ symbol, market: AssetMarket.CRYPTO })),
  ...STOCKS_AR_UNIVERSE.map((symbol) => ({ symbol, market: AssetMarket.STOCK_AR })),
  ...CEDEARS_UNIVERSE.map((symbol) => ({ symbol, market: AssetMarket.STOCK_AR })),
  ...BONDS_UNIVERSE.map((symbol) => ({ symbol, market: AssetMarket.BOND })),
  ...FX_UNIVERSE.map((symbol) => ({ symbol, market: AssetMarket.FX })),
];

export const ASSET_NAMES: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  SOL: 'Solana',
  XRP: 'XRP',
  ADA: 'Cardano',
  BNB: 'BNB',
  MATIC: 'Polygon',
  DOT: 'Polkadot',
  AVAX: 'Avalanche',
  LINK: 'Chainlink',
  UNI: 'Uniswap',
  ATOM: 'Cosmos',
  LTC: 'Litecoin',
  BCH: 'Bitcoin Cash',
  XLM: 'Stellar',
  NEAR: 'NEAR Protocol',
  APT: 'Aptos',
  ARB: 'Arbitrum',
  OP: 'Optimism',
  INJ: 'Injective',
  GGAL: 'Grupo Financiero Galicia',
  YPFD: 'YPF',
  BMA: 'Banco Macro',
  PAMP: 'Pampa Energia',
  TXAR: 'Ternium Argentina',
  ALUA: 'Aluar',
  BYMA: 'Bolsas y Mercados Argentinos',
  SUPV: 'Grupo Supervielle',
  TECO2: 'Telecom Argentina',
  LOMA: 'Loma Negra',
  MIRG: 'Mirgor',
  HARG: 'Holcim Argentina',
  COME: 'Sociedad Comercial del Plata',
  BBAR: 'BBVA Argentina',
  CRES: 'Cresud',
  VIST: 'Vista Energy',
  IRSA: 'IRSA',
  PBDA: 'Petrobras Argentina',
  AAPL: 'Apple',
  GOOGL: 'Alphabet',
  MSFT: 'Microsoft',
  TSLA: 'Tesla',
  NVDA: 'NVIDIA',
  META: 'Meta',
  AMZN: 'Amazon',
  BABA: 'Alibaba',
  DISN: 'Disney',
  KO: 'Coca-Cola',
  AL30: 'Bonar AL30',
  GD30: 'Global GD30',
  AY24: 'Bonar AY24',
  GD35: 'Global GD35',
  AL35: 'Bonar AL35',
  GD41: 'Global GD41',
  GD46: 'Global GD46',
  MEP: 'Dolar MEP',
  CCL: 'Contado con Liquidacion',
};
