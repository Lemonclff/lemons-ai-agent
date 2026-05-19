-- ============================================================================
-- Lemon's AI Agent — Database Schema
-- PostgreSQL DDL for Options Volatility & Macro Economic Event Tracking
-- ============================================================================
-- Usage:
--   psql -U your_user -d your_db -f schema.sql
-- ============================================================================

-- 1. 期權與波動率監控表 (Options & Volatility Log)
--    記錄每日 IV/HV、Put/Call Ratio、成交量 — 支援歷史回測
CREATE TABLE options_volatility_log (
    id              SERIAL PRIMARY KEY,
    ticker          VARCHAR(10) NOT NULL,
    trade_date      DATE NOT NULL,
    implied_volatility   DECIMAL(10, 4),   -- 隱含波動率 (IV)
    historical_volatility DECIMAL(10, 4),   -- 歷史波動率 (HV, 20-day)
    put_call_ratio       DECIMAL(10, 4),   -- 看跌/看漲比例 (PCR)
    call_volume          BIGINT,           -- Call 總成交量
    put_volume           BIGINT,           -- Put 總成交量
    total_options_volume BIGINT,           -- 總成交量
    iv_hv_spread         DECIMAL(10, 4),   -- IV - HV 差值 (擴張為正, 收斂為負)
    unusual_activity_flag BOOLEAN DEFAULT FALSE,  -- UOA 異常大單警示
    ai_risk_alert        TEXT,             -- LLM 生成的風險提示
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_options_ticker_date UNIQUE (ticker, trade_date)
);

-- Indexes for time-series & ticker-based queries
CREATE INDEX idx_opt_ticker_date   ON options_volatility_log (ticker, trade_date DESC);
CREATE INDEX idx_opt_trade_date    ON options_volatility_log (trade_date DESC);
CREATE INDEX idx_opt_iv_hv_spread  ON options_volatility_log (iv_hv_spread)
    WHERE unusual_activity_flag = TRUE;  -- partial index for anomaly queries
CREATE INDEX idx_opt_pcr           ON options_volatility_log (ticker, put_call_ratio DESC);


-- 2. 宏觀經濟與 AI 解讀矩陣表 (Macro Economic Events)
--    記錄關鍵經濟指標的預期/實際/前值 + LLM 生成的板塊流向分析
CREATE TABLE macro_economic_events (
    id              SERIAL PRIMARY KEY,
    event_name      VARCHAR(100) NOT NULL,   -- e.g. 'US Core CPI YoY', 'Non-Farm Payrolls'
    event_time      TIMESTAMP WITH TIME ZONE NOT NULL,
    expected_value  DECIMAL(10, 4),
    actual_value    DECIMAL(10, 4),
    previous_value  DECIMAL(10, 4),
    deviation       DECIMAL(10, 4),          -- actual - expected (surprise magnitude)
    surprise_flag   VARCHAR(20),             -- 'BEAT', 'MISS', 'INLINE'
    ai_impact_tech       TEXT,               -- LLM: 對科技板塊的影響
    ai_impact_financial  TEXT,               -- LLM: 對金融板塊的影響
    ai_impact_broad      TEXT,               -- LLM: 對大盤指數的影響
    ai_impact_summary    TEXT,               -- LLM: 綜合資金流向總結
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_macro_event_time UNIQUE (event_name, event_time)
);

-- Indexes for calendar view & historical comparison
CREATE INDEX idx_macro_event_time ON macro_economic_events (event_time DESC);
CREATE INDEX idx_macro_event_name ON macro_economic_events (event_name);
CREATE INDEX idx_macro_surprise    ON macro_economic_events (surprise_flag, event_time DESC);
CREATE INDEX idx_macro_deviation   ON macro_economic_events (ABS(deviation) DESC NULLS LAST);


-- 3. 輔助表：追蹤標的清單 (Tracked Tickers)
--    管理需要監控的高波動科技股清單
CREATE TABLE tracked_tickers (
    id          SERIAL PRIMARY KEY,
    ticker      VARCHAR(10) NOT NULL UNIQUE,
    name        VARCHAR(100),
    sector      VARCHAR(50),
    is_active   BOOLEAN DEFAULT TRUE,
    added_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed data: 高波動科技股
INSERT INTO tracked_tickers (ticker, name, sector) VALUES
    ('TSLA',  'Tesla Inc.',              'Consumer Discretionary'),
    ('NVDA',  'NVIDIA Corporation',       'Technology'),
    ('AMD',   'Advanced Micro Devices',   'Technology'),
    ('AAPL',  'Apple Inc.',               'Technology'),
    ('MSTR',  'MicroStrategy Inc.',       'Technology'),
    ('COIN',  'Coinbase Global Inc.',     'Financials'),
    ('SMCI',  'Super Micro Computer Inc.','Technology'),
    ('PLTR',  'Palantir Technologies',    'Technology'),
    ('ARM',   'ARM Holdings',             'Technology'),
    ('AVGO',  'Broadcom Inc.',            'Technology')
ON CONFLICT (ticker) DO NOTHING;
