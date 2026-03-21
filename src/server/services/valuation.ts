import type { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';
import type {
  HoldingDto,
  LeaderboardEntryDto,
  PortfolioDto,
  StockDto,
} from '../../shared/contracts.js';
import { decimalOf, moneyNumber, roundMoney } from '../lib/money.js';

type UserWithPortfolio = Awaited<ReturnType<typeof loadUserPortfolio>>;

const toHoldingDto = (
  holding: UserWithPortfolio['holdings'][number],
  priceMap: Record<string, number>,
): HoldingDto => {
  const marketPrice = decimalOf(priceMap[holding.stock.ticker] ?? holding.stock.currentPrice.toString());
  const quantity = decimalOf(holding.quantity);
  const avgBuyPrice = holding.avgBuyPrice ? decimalOf(holding.avgBuyPrice.toString()) : null;
  const marketValue = roundMoney(quantity.mul(marketPrice));
  const costBasis = avgBuyPrice ? roundMoney(quantity.mul(avgBuyPrice)) : new Decimal(0);
  const unrealizedPnl = marketValue.sub(costBasis);

  return {
    stockId: holding.stockId,
    ticker: holding.stock.ticker,
    companyName: holding.stock.companyName,
    quantity: holding.quantity,
    avgBuyPrice: avgBuyPrice ? moneyNumber(avgBuyPrice) : null,
    marketPrice: moneyNumber(marketPrice),
    marketValue: moneyNumber(marketValue),
    unrealizedPnl: moneyNumber(unrealizedPnl),
  };
};

export const loadUserPortfolio = (prisma: PrismaClient, userId: number) =>
  prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      holdings: {
        where: { quantity: { gt: 0 } },
        orderBy: { stock: { ticker: 'asc' } },
        include: { stock: true },
      },
      _count: {
        select: { trades: true },
      },
    },
  });

export const buildPortfolio = async (
  prisma: PrismaClient,
  userId: number,
  priceMap: Record<string, number>,
): Promise<PortfolioDto> => {
  const user = await loadUserPortfolio(prisma, userId);
  const holdings = user.holdings.map((holding) => toHoldingDto(holding, priceMap));
  const holdingsValue = holdings.reduce((total, holding) => total + holding.marketValue, 0);

  return {
    cashBalance: moneyNumber(user.cashBalance.toString()),
    totalValue: moneyNumber(decimalOf(user.cashBalance.toString()).add(holdingsValue)),
    holdings,
    tradeCount: user._count.trades,
  };
};

export const buildLeaderboard = async (
  prisma: PrismaClient,
  priceMap: Record<string, number>,
): Promise<LeaderboardEntryDto[]> => {
  const users = await prisma.user.findMany({
    where: { isActive: true, role: 'PARTICIPANT' },
    orderBy: { displayName: 'asc' },
    include: {
      holdings: {
        where: { quantity: { gt: 0 } },
        include: { stock: true },
      },
      _count: {
        select: { trades: true },
      },
    },
  });

  const ranked = users
    .map((user) => {
      const holdingsTotal = user.holdings.reduce((sum, holding) => {
        const price = decimalOf(priceMap[holding.stock.ticker] ?? holding.stock.currentPrice.toString());
        return sum.add(price.mul(holding.quantity));
      }, new Decimal(0));

      const portfolioValue = roundMoney(decimalOf(user.cashBalance.toString()).add(holdingsTotal));

      return {
        userId: user.id,
        displayName: user.displayName,
        portfolioValue: moneyNumber(portfolioValue),
        cashBalance: moneyNumber(user.cashBalance.toString()),
        tradeCount: user._count.trades,
        rank: 0,
      };
    })
    .sort((left, right) => {
      if (right.portfolioValue !== left.portfolioValue) {
        return right.portfolioValue - left.portfolioValue;
      }
      if (right.tradeCount !== left.tradeCount) {
        return right.tradeCount - left.tradeCount;
      }
      return left.displayName.localeCompare(right.displayName);
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

  return ranked;
};

export const toStockDto = (stock: {
  id: number;
  ticker: string;
  companyName: string;
  sector: string;
  currentPrice: { toString(): string };
  basePrice: { toString(): string };
  availableSupply: number;
  volatilityPct: { toString(): string };
  isTradeable: boolean;
}): StockDto => ({
  id: stock.id,
  ticker: stock.ticker,
  companyName: stock.companyName,
  sector: stock.sector,
  currentPrice: moneyNumber(stock.currentPrice.toString()),
  basePrice: moneyNumber(stock.basePrice.toString()),
  availableSupply: stock.availableSupply,
  volatilityPct: moneyNumber(stock.volatilityPct.toString()),
  isTradeable: stock.isTradeable,
});
