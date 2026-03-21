export type UserRole = 'PARTICIPANT' | 'ADMIN';
export type RoundStatus = 'PENDING' | 'ACTIVE' | 'ENDED';
export type TradeSide = 'BUY' | 'SELL';

export interface SessionUser {
  userId: number;
  role: UserRole;
  displayName: string;
}

export interface MarketStateDto {
  currentRoundId: number | null;
  currentRoundName: string | null;
  roundStatus: RoundStatus;
  tradingHalted: boolean;
  leaderboardVisible: boolean;
  lastTickAt: string | null;
  eventVersion: number;
}

export interface StockDto {
  id: number;
  ticker: string;
  companyName: string;
  sector: string;
  currentPrice: number;
  basePrice: number;
  availableSupply: number;
  volatilityPct: number;
  isTradeable: boolean;
}

export interface HoldingDto {
  stockId: number;
  ticker: string;
  companyName: string;
  quantity: number;
  avgBuyPrice: number | null;
  marketPrice: number;
  marketValue: number;
  unrealizedPnl: number;
}

export interface PortfolioDto {
  cashBalance: number;
  totalValue: number;
  holdings: HoldingDto[];
  tradeCount: number;
}

export interface LeaderboardEntryDto {
  userId: number;
  displayName: string;
  portfolioValue: number;
  cashBalance: number;
  rank: number;
  tradeCount: number;
}

export interface NewsEventDto {
  id: number;
  headline: string;
  detail: string | null;
  triggeredAt: string;
}

export interface MarketSnapshotDto {
  prices: Record<string, number>;
  stocks: StockDto[];
  marketState: MarketStateDto;
  leaderboard: LeaderboardEntryDto[];
  recentNews: NewsEventDto[];
}

export interface AuthUserDto {
  userId: number;
  displayName: string;
  role: UserRole;
  cashBalance: number;
}

export interface TradeResponseDto {
  tradeId: number;
  requestId: string;
  side: TradeSide;
  quantity: number;
  executedPrice: number;
  cashBalance: number;
  holdingQuantity: number;
}

export interface ParticipantBootstrapDto extends MarketSnapshotDto {
  user: AuthUserDto;
  portfolio: PortfolioDto;
}

export interface AdminBootstrapDto extends MarketSnapshotDto {
  user: AuthUserDto;
  participants: LeaderboardEntryDto[];
}

export interface PublicDisplaySnapshotDto {
  marketState: MarketStateDto;
  leaderboard: LeaderboardEntryDto[];
  recentNews: NewsEventDto[];
  prices: Record<string, number>;
}
