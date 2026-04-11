export enum AssetMarket {
  CRYPTO = 'CRYPTO',
  STOCK_AR = 'STOCK_AR',
  BOND = 'BOND',
  FX = 'FX',
  STAKING = 'STAKING',
}

export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
  STAKE = 'STAKE',
  UNSTAKE = 'UNSTAKE',
  REWARD = 'REWARD',
  TRANSFER = 'TRANSFER',
  FEE = 'FEE',
}

export enum ImportSource {
  BINANCE = 'BINANCE',
  IOL = 'IOL',
  MANUAL = 'MANUAL',
}

export enum ImportStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
