CREATE TYPE "UserRole" AS ENUM ('PARTICIPANT', 'ADMIN');
CREATE TYPE "RoundStatus" AS ENUM ('PENDING', 'ACTIVE', 'ENDED');
CREATE TYPE "TradeSide" AS ENUM ('BUY', 'SELL');
CREATE TYPE "AdminEventType" AS ENUM (
  'ROUND_STARTED',
  'ROUND_ENDED',
  'NEWS_BROADCAST',
  'SHOCK',
  'BROADCAST',
  'HALT',
  'RESUME',
  'LEADERBOARD_REVEALED',
  'LEADERBOARD_HIDDEN',
  'USERS_IMPORTED',
  'TRADE_REVERSED',
  'PASSWORD_RESET',
  'MANUAL_CORRECTION'
);

CREATE TABLE "User" (
  "id" SERIAL NOT NULL,
  "username" VARCHAR(50) NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "display_name" VARCHAR(100) NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'PARTICIPANT',
  "cash_balance" DECIMAL(14,2) NOT NULL DEFAULT 500000,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Stock" (
  "id" SERIAL NOT NULL,
  "ticker" VARCHAR(8) NOT NULL,
  "company_name" VARCHAR(100) NOT NULL,
  "sector" VARCHAR(50) NOT NULL,
  "current_price" DECIMAL(12,2) NOT NULL,
  "base_price" DECIMAL(12,2) NOT NULL,
  "available_supply" INTEGER NOT NULL,
  "volatility_pct" DECIMAL(5,2) NOT NULL DEFAULT 5,
  "is_tradeable" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Stock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Holding" (
  "user_id" INTEGER NOT NULL,
  "stock_id" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "avg_buy_price" DECIMAL(12,2),
  CONSTRAINT "Holding_pkey" PRIMARY KEY ("user_id", "stock_id")
);

CREATE TABLE "Trade" (
  "id" SERIAL NOT NULL,
  "request_id" VARCHAR(64) NOT NULL,
  "user_id" INTEGER NOT NULL,
  "stock_id" INTEGER NOT NULL,
  "side" "TradeSide" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Round" (
  "id" SERIAL NOT NULL,
  "number" INTEGER NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "status" "RoundStatus" NOT NULL DEFAULT 'PENDING',
  "started_at" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NewsEvent" (
  "id" SERIAL NOT NULL,
  "round_id" INTEGER,
  "stock_id" INTEGER,
  "headline" VARCHAR(255) NOT NULL,
  "detail" TEXT,
  "payload" JSONB,
  "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NewsEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketState" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "current_round_id" INTEGER,
  "round_status" "RoundStatus" NOT NULL DEFAULT 'PENDING',
  "trading_halted" BOOLEAN NOT NULL DEFAULT false,
  "leaderboard_visible" BOOLEAN NOT NULL DEFAULT false,
  "last_tick_at" TIMESTAMP(3),
  "event_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminEvent" (
  "id" SERIAL NOT NULL,
  "type" "AdminEventType" NOT NULL,
  "payload" JSONB NOT NULL,
  "actor_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "Stock_ticker_key" ON "Stock"("ticker");
CREATE UNIQUE INDEX "Trade_request_id_key" ON "Trade"("request_id");
CREATE UNIQUE INDEX "MarketState_current_round_id_key" ON "MarketState"("current_round_id");

ALTER TABLE "Holding"
  ADD CONSTRAINT "Holding_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Holding"
  ADD CONSTRAINT "Holding_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Trade"
  ADD CONSTRAINT "Trade_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Trade"
  ADD CONSTRAINT "Trade_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NewsEvent"
  ADD CONSTRAINT "NewsEvent_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NewsEvent"
  ADD CONSTRAINT "NewsEvent_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "Stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketState"
  ADD CONSTRAINT "MarketState_current_round_id_fkey" FOREIGN KEY ("current_round_id") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdminEvent"
  ADD CONSTRAINT "AdminEvent_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
