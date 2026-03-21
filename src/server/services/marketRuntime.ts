import {
  AdminEventType,
  PrismaClient,
  RoundStatus,
  type MarketState,
  type NewsEvent,
} from '@prisma/client';
import type { Server as SocketServer } from 'socket.io';
import type {
  AdminBootstrapDto,
  AuthUserDto,
  LeaderboardEntryDto,
  MarketSnapshotDto,
  MarketStateDto,
  NewsEventDto,
  ParticipantBootstrapDto,
  PublicDisplaySnapshotDto,
  StockDto,
} from '../../shared/contracts.js';
import { toInputJson } from '../lib/json.js';
import { moneyNumber } from '../lib/money.js';
import { buildLeaderboard, buildPortfolio, toStockDto } from './valuation.js';

interface RuntimeCache {
  stocks: StockDto[];
  prices: Record<string, number>;
  marketState: MarketStateDto;
  recentNews: NewsEventDto[];
  leaderboard: LeaderboardEntryDto[];
  leaderboardComputedAt: number;
}

const NEWS_LIMIT = 20;
const LEADERBOARD_CACHE_MS = 30_000;

export class MarketRuntime {
  private cache: RuntimeCache = {
    stocks: [],
    prices: {},
    marketState: {
      currentRoundId: null,
      currentRoundName: null,
      roundStatus: 'PENDING',
      tradingHalted: false,
      leaderboardVisible: false,
      lastTickAt: null,
      eventVersion: 1,
    },
    recentNews: [],
    leaderboard: [],
    leaderboardComputedAt: 0,
  };

  private mutationQueue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly io: SocketServer,
  ) {}

  async initialize(): Promise<void> {
    await this.ensureMarketState();
    await this.refreshState();
    await this.refreshLeaderboard(true);
    this.broadcastState();
  }

  async ensureMarketState(): Promise<MarketState> {
    const existing = await this.prisma.marketState.findUnique({ where: { id: 1 } });
    if (existing) return existing;

    return this.prisma.marketState.create({
      data: {
        id: 1,
        roundStatus: RoundStatus.PENDING,
        leaderboardVisible: false,
        tradingHalted: false,
        eventVersion: 1,
      },
    });
  }

  async refreshState(): Promise<void> {
    const [stocks, marketState, recentNews] = await Promise.all([
      this.prisma.stock.findMany({
        orderBy: [{ sector: 'asc' }, { ticker: 'asc' }],
      }),
      this.prisma.marketState.findUniqueOrThrow({
        where: { id: 1 },
        include: { currentRound: true },
      }),
      this.prisma.newsEvent.findMany({
        orderBy: { triggeredAt: 'desc' },
        take: NEWS_LIMIT,
      }),
    ]);

    this.cache.stocks = stocks.map(toStockDto);
    this.cache.prices = stocks.reduce<Record<string, number>>((accumulator, stock) => {
      accumulator[stock.ticker] = moneyNumber(stock.currentPrice.toString());
      return accumulator;
    }, {});
    this.cache.marketState = this.toMarketStateDto(marketState);
    this.cache.recentNews = recentNews.reverse().map(this.toNewsDto);
  }

  async refreshLeaderboard(force = false): Promise<void> {
    const now = Date.now();
    if (!force && now - this.cache.leaderboardComputedAt < LEADERBOARD_CACHE_MS) {
      return;
    }

    this.cache.leaderboard = await buildLeaderboard(this.prisma, this.cache.prices);
    this.cache.leaderboardComputedAt = now;
  }

  async refreshLeaderboardIfStale(): Promise<void> {
    await this.refreshLeaderboard(false);
  }

  getPriceMap(): Record<string, number> {
    return { ...this.cache.prices };
  }

  getStocks(): StockDto[] {
    return this.cache.stocks.map((stock) => ({ ...stock }));
  }

  getMarketState(): MarketStateDto {
    return { ...this.cache.marketState };
  }

  getRecentNews(): NewsEventDto[] {
    return this.cache.recentNews.map((item) => ({ ...item }));
  }

  getLeaderboard(includeHidden = false): LeaderboardEntryDto[] {
    if (!includeHidden && !this.cache.marketState.leaderboardVisible) {
      return [];
    }
    return this.cache.leaderboard.map((entry) => ({ ...entry }));
  }

  getSnapshot(includeHiddenLeaderboard = false): MarketSnapshotDto {
    return {
      prices: this.getPriceMap(),
      stocks: this.getStocks(),
      marketState: this.getMarketState(),
      leaderboard: this.getLeaderboard(includeHiddenLeaderboard),
      recentNews: this.getRecentNews(),
    };
  }

  getPublicSnapshot(): PublicDisplaySnapshotDto {
    return {
      marketState: this.getMarketState(),
      leaderboard: this.getLeaderboard(false).slice(0, 10),
      recentNews: this.getRecentNews().slice(-5),
      prices: this.getPriceMap(),
    };
  }

  async buildParticipantBootstrap(user: AuthUserDto): Promise<ParticipantBootstrapDto> {
    const portfolio = await buildPortfolio(this.prisma, user.userId, this.cache.prices);
    return {
      user,
      portfolio,
      ...this.getSnapshot(false),
    };
  }

  async buildAdminBootstrap(user: AuthUserDto): Promise<AdminBootstrapDto> {
    await this.refreshLeaderboard(true);
    return {
      user,
      participants: this.getLeaderboard(true),
      ...this.getSnapshot(true),
    };
  }

  async queueMarketMutation<T>(
    task: () => Promise<T>,
    options?: { forceLeaderboardRefresh?: boolean },
  ): Promise<T> {
    const runTask = async (): Promise<T> => {
      const result = await task();
      await this.refreshState();
      await this.refreshLeaderboard(options?.forceLeaderboardRefresh ?? false);
      this.broadcastState();
      return result;
    };

    const queued = this.mutationQueue.then(runTask, runTask);
    this.mutationQueue = queued.catch(() => undefined);
    return queued;
  }

  async recordAdminEvent(
    type: AdminEventType,
    actorId: number | null,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.adminEvent.create({
      data: {
        type,
        actorId: actorId ?? undefined,
        payload: toInputJson(payload),
      },
    });
  }

  async emitPortfolioUpdate(userId: number): Promise<void> {
    const portfolio = await buildPortfolio(this.prisma, userId, this.cache.prices);
    this.io.to(`user:${userId}`).emit('portfolio_update', portfolio);
    await this.refreshLeaderboardIfStale();
  }

  broadcastState(): void {
    this.io.to('market').emit('state_sync', this.getSnapshot(false));
    this.io.to('admin').emit('admin_state_sync', this.getSnapshot(true));
    this.io.to('display').emit('display_state_sync', this.getPublicSnapshot());
  }

  private toMarketStateDto(marketState: MarketState & { currentRound: { id: number; name: string } | null }): MarketStateDto {
    return {
      currentRoundId: marketState.currentRoundId,
      currentRoundName: marketState.currentRound?.name ?? null,
      roundStatus: marketState.roundStatus,
      tradingHalted: marketState.tradingHalted,
      leaderboardVisible: marketState.leaderboardVisible,
      lastTickAt: marketState.lastTickAt ? marketState.lastTickAt.toISOString() : null,
      eventVersion: marketState.eventVersion,
    };
  }

  private toNewsDto = (newsEvent: NewsEvent): NewsEventDto => ({
    id: newsEvent.id,
    headline: newsEvent.headline,
    detail: newsEvent.detail,
    triggeredAt: newsEvent.triggeredAt.toISOString(),
  });
}
