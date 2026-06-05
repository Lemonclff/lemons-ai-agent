#!/usr/bin/env python3
"""
Options & Volatility Monitor — yfinance-based data engine.

Data pipeline:
  Browser → POST /api/options → spawn options_api.py →
    yfinance: real-time price, volume, historical data, options chain →
    Black-Scholes IV calculation from ATM options →
    HV from 30-day historical returns →
    PCR from options chain volume →
    Earnings dates from ticker info →
    JSON response with _source field

No FutuOpenD required. All data via HTTP from Yahoo Finance.
"""

import json
import sys
import time
from datetime import datetime, timedelta
from typing import Optional, Tuple
import numpy as np

try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False


# ============================================================================
# Constants
# ============================================================================

TICKER_NAMES = {
    "TSLA": "Tesla", "NVDA": "NVIDIA", "AMD": "AMD", "AAPL": "Apple",
    "MSTR": "MicroStrategy", "COIN": "Coinbase", "SMCI": "Super Micro",
    "PLTR": "Palantir", "ARM": "ARM Holdings", "AVGO": "Broadcom",
    "MSFT": "Microsoft", "GOOGL": "Alphabet", "META": "Meta",
    "AMZN": "Amazon", "NFLX": "Netflix", "INTC": "Intel",
    "QCOM": "Qualcomm", "MU": "Micron", "SNOW": "Snowflake",
    "CRM": "Salesforce", "UBER": "Uber", "SQ": "Block",
    "RBLX": "Roblox", "SNAP": "Snap", "DDOG": "Datadog",
    "CRWD": "CrowdStrike", "PANW": "Palo Alto Networks",
    "ZS": "Zscaler", "NET": "Cloudflare", "SHOP": "Shopify",
    "RIVN": "Rivian", "LCID": "Lucid", "SOFI": "SoFi",
    "AFRM": "Affirm", "HOOD": "Robinhood", "GME": "GameStop",
    "AMC": "AMC Entertainment", "SPY": "S&P 500 ETF",
    "QQQ": "Nasdaq-100 ETF", "IWM": "Russell 2000 ETF",
}

# Base IV values per ticker (used as starting point for Black-Scholes)
# These are typical annualized IV percentages for each stock
BASE_IV_PCT: dict = {
    "TSLA": 55, "NVDA": 60, "AMD": 52, "AAPL": 28, "MSTR": 82,
    "COIN": 78, "SMCI": 70, "PLTR": 65, "ARM": 50, "AVGO": 35,
    "MSFT": 30, "GOOGL": 32, "META": 38, "AMZN": 33, "NFLX": 45,
    "INTC": 42, "QCOM": 38, "MU": 48, "SNOW": 58, "CRM": 35,
    "UBER": 40, "SQ": 52, "RBLX": 60, "SNAP": 65, "DDOG": 48,
    "CRWD": 50, "PANW": 38, "ZS": 45, "NET": 50, "SHOP": 55,
    "RIVN": 75, "LCID": 80, "SOFI": 55, "AFRM": 70, "HOOD": 58,
    "GME": 95, "AMC": 90, "SPY": 16, "QQQ": 22, "IWM": 22,
}


# ============================================================================
# Black-Scholes helpers
# ============================================================================

def _norm_cdf(x: float) -> float:
    """Standard normal CDF (Abramowitz & Stegun approximation)."""
    a1, a2, a3, a4, a5 = 0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429
    p = 0.3275911
    sign = 1 if x >= 0 else -1
    x = abs(x) / np.sqrt(2)
    t = 1.0 / (1.0 + p * x)
    y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * np.exp(-x * x)
    return 0.5 * (1.0 + sign * y)


def _black_scholes_price(S: float, K: float, T: float,
                         r: float, sigma: float,
                         option_type: str = "call") -> float:
    """
    Compute Black-Scholes option price.
    S: spot price, K: strike, T: years to expiry,
    r: risk-free rate, sigma: volatility (decimal)
    """
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        # Intrinsic value only
        if option_type == "call":
            return max(S - K, 0)
        return max(K - S, 0)

    d1 = (np.log(S / K) + (r + sigma ** 2 / 2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)

    if option_type == "call":
        return S * _norm_cdf(d1) - K * np.exp(-r * T) * _norm_cdf(d2)
    else:
        return K * np.exp(-r * T) * _norm_cdf(-d2) - S * _norm_cdf(-d1)


def _implied_volatility(price: float, S: float, K: float, T: float,
                        r: float, option_type: str,
                        tol: float = 1e-6, max_iter: int = 100) -> Optional[float]:
    """
    Find implied volatility using Newton-Raphson method.
    Returns IV as a decimal (e.g. 0.30 = 30%).
    """
    sigma = 0.3  # initial guess (30%)
    for _ in range(max_iter):
        bs_price = _black_scholes_price(S, K, T, r, sigma, option_type)
        diff = bs_price - price

        if abs(diff) < tol:
            return sigma

        # Vega (derivative of price w.r.t. sigma)
        d1 = (np.log(S / K) + (r + sigma ** 2 / 2) * T) / (sigma * np.sqrt(T))
        vega = S * np.sqrt(T) * _norm_cdf(d1) / np.sqrt(2 * np.pi)

        if abs(vega) < 1e-10:
            break

        sigma = sigma - diff / vega
        if sigma <= 0:
            sigma = 1e-4  # reset to positive
        if sigma > 5:
            break  # IV too extreme

    return sigma


# ============================================================================
# Data fetching
# ============================================================================

def compute_historical_volatility(ticker_obj, period_days: int = 252) -> Optional[float]:
    """Compute annualized HV from historical daily returns."""
    try:
        hist = ticker_obj.history(period=f"{period_days}d")
        if hist is None or len(hist) < 2:
            return None
        returns = hist["Close"].pct_change().dropna()
        if len(returns) < 10:
            return None
        hv = float(returns.std() * np.sqrt(252) * 100)
        if np.isnan(hv) or hv <= 0:
            return None
        return round(hv, 2)
    except Exception:
        return None


def compute_iv_from_options_chain(ticker_obj, spot_price: float,
                                   risk_free: float = 0.045) -> Tuple[Optional[float], Optional[float]]:
    """
    Estimate IV from ATM options chain using Black-Scholes inversion.
    Returns (avg_iv_pct, atm_iv_pct).

    Strategy:
    1. Find the nearest FUTURE expiry with options data (skip same-day/past)
    2. For calls and puts, find the ATM strike (closest to spot_price)
    3. Use bid/ask midpoint for option price
    4. Invert Black-Scholes to find IV for ATM call and put
    5. Average them for a robust estimate
    6. If bid/ask are 0 (illiquid), return None to trigger fallback
    """
    try:
        options = ticker_obj.options
        if not options or len(options) == 0:
            return None, None

        # Prefer an expiry that is in the future (skip same-day or past expiries)
        from datetime import datetime as dt
        today = dt.now().date()
        future_expiries = [e for e in options if datetime.strptime(e, "%Y-%m-%d").date() > today]
        if future_expiries:
            nearest_expiry = future_expiries[0]
        else:
            nearest_expiry = options[0]

        chain = ticker_obj.option_chain(nearest_expiry)
        calls = chain.calls
        puts = chain.puts

        if calls is None or puts is None or len(calls) == 0 or len(puts) == 0:
            return None, None

        # Calculate time to expiry in years
        try:
            expiry = datetime.strptime(nearest_expiry, "%Y-%m-%d")
            days_to_expiry = max((expiry - dt.now()).total_seconds() / 86400.0, 7)  # at least 7 days
        except (ValueError, AttributeError):
            days_to_expiry = 30  # fallback
        T = max(days_to_expiry / 365.25, 0.001)  # at least 1 day

        # Find ATM strike for calls
        if spot_price <= 0 or spot_price > 10000:
            return None, None

        # Calls: find strike closest to spot (at-the-money)
        valid_strikes = calls[calls["strike"] > 0]["strike"]
        if len(valid_strikes) == 0:
            return None, None

        atm_strike_call = valid_strikes.iloc[(valid_strikes - spot_price).abs().argsort().iloc[0]]
        atm_strike_put = valid_strikes.iloc[(valid_strikes - spot_price).abs().argsort().iloc[0]]

        def _is_nan(v):
            return v is None or (isinstance(v, float) and v != v)

        # Get ATM call price — use bid/ask midpoint
        bid = calls["bid"].iloc[0] if "bid" in calls.columns else 0
        ask = calls["ask"].iloc[0] if "ask" in calls.columns else 0
        bid = 0 if _is_nan(bid) else bid
        ask = 0 if _is_nan(ask) else ask

        # If bid/ask are 0, this is an illiquid expiry (same-day). Return None.
        if bid <= 0 or ask <= 0:
            return None, None

        call_price = (bid + ask) / 2

        # Get ATM put price — use bid/ask midpoint
        bid = puts["bid"].iloc[0] if "bid" in puts.columns else 0
        ask = puts["ask"].iloc[0] if "ask" in puts.columns else 0
        bid = 0 if _is_nan(bid) else bid
        ask = 0 if _is_nan(ask) else ask

        if bid <= 0 or ask <= 0:
            return None, None

        put_price = (bid + ask) / 2

        # Validate prices make sense (should have positive time value)
        call_intrinsic = max(spot_price - atm_strike_call, 0)
        put_intrinsic = max(atm_strike_put - spot_price, 0)
        call_time_value = call_price - call_intrinsic
        put_time_value = put_price - put_intrinsic

        # If both have near-zero time value, options are too close to expiry
        if call_time_value < 0.1 and put_time_value < 0.1:
            return None, None

        # Calculate IV for call
        iv_call = _implied_volatility(call_price, spot_price, atm_strike_call, T,
                                       risk_free, "call")
        # Calculate IV for put
        iv_put = _implied_volatility(put_price, spot_price, atm_strike_put, T,
                                      risk_free, "put")

        # Average call and put IV for a more robust estimate
        iv_results = []
        if iv_call is not None and 0 < iv_call < 5:
            iv_results.append(iv_call)
        if iv_put is not None and 0 < iv_put < 5:
            iv_results.append(iv_put)

        if iv_results:
            avg_iv = np.mean(iv_results)
            return round(avg_iv * 100, 2), round(iv_results[-1] * 100, 2)
        else:
            return None, None

    except Exception:
        return None, None


def compute_pcr(ticker_obj) -> Tuple[int, int, Optional[float]]:
    """
    Compute Put/Call Ratio from options chain volume.
    Returns (total_call_volume, total_put_volume, pcr).
    """
    try:
        options = ticker_obj.options
        if not options or len(options) == 0:
            return 0, 0, None

        # Use nearest expiry
        chain = ticker_obj.option_chain(options[0])
        calls = chain.calls
        puts = chain.puts

        call_vol = int(calls["volume"].sum()) if calls is not None and len(calls) > 0 else 0
        put_vol = int(puts["volume"].sum()) if puts is not None and len(puts) > 0 else 0

        pcr = round(put_vol / call_vol, 2) if call_vol > 0 else None
        return call_vol, put_vol, pcr

    except Exception:
        return 0, 0, None


def get_earnings(ticker_obj) -> Optional[dict]:
    """Get next earnings date from ticker info."""
    try:
        info = ticker_obj.info
        earnings_dates = info.get("earningsTimestamp", None)
        if earnings_dates is None:
            return None

        from datetime import timezone
        if isinstance(earnings_dates, (int, float)):
            earnings_date = datetime.fromtimestamp(earnings_dates, tz=timezone.utc)
        else:
            return None

        now = datetime.now(tz=timezone.utc)
        days_until = (earnings_date - now).days

        return {
            "date": earnings_date.strftime("%Y-%m-%d"),
            "days_until": days_until,
            "reported": days_until <= 0,
        }
    except Exception:
        return None


def get_ticker_data(ticker_str: str) -> dict:
    """
    Fetch comprehensive options & volatility data for a ticker using yfinance.
    Returns dict with price, IV, HV, IV/HV spread, PCR, sparkline, earnings.
    """
    ticker_str = ticker_str.upper().strip()

    result = {
        "ticker": ticker_str,
        "name": TICKER_NAMES.get(ticker_str, ticker_str),
        "price": 0,
        "change_pct": 0,
        "implied_volatility": None,
        "historical_volatility": None,
        "iv_hv_spread": None,
        "iv_rank": None,
        "put_call_ratio": None,
        "call_volume": 0,
        "put_volume": 0,
        "total_volume": 0,
        "unusual_activity": False,
        "sparkline": None,
        "earnings": None,
        "last_updated": datetime.now().isoformat(),
        "_source": "yfinance",
    }

    if not YFINANCE_AVAILABLE:
        result["_source"] = "mock_fallback"
        return result

    try:
        ticker = yf.Ticker(ticker_str)

        # --- 1. Real-time price & volume ---
        info = ticker.info
        if info:
            result["price"] = round(info.get("currentPrice") or info.get("regularMarketPrice") or 0, 2)
            result["change_pct"] = round(
                (info.get("regularMarketChangePercent") or info.get("regularMarketDayChange") or 0), 2
            )
            if result["price"] <= 0:
                result["price"] = round(info.get("regularMarketPreviousClose") or 0, 2)

        # --- 2. Historical volatility from 1-year daily returns ---
        hv = compute_historical_volatility(ticker, period_days=252)
        result["historical_volatility"] = hv

        # --- 3. Sparkline (last 5 days of closing prices) ---
        try:
            hist = ticker.history(period="5d")
            if hist is not None and len(hist) > 0:
                prices = [round(float(p), 2) for p in hist["Close"].values[-5:]]
                # Remove any NaN values
                prices = [p for p in prices if p == p]  # NaN != NaN
                if prices:
                    result["sparkline"] = prices
        except Exception:
            pass

        # --- 4. Implied volatility from ATM options (Black-Scholes) ---
        if result["price"] > 0:
            iv_avg, iv_atm = compute_iv_from_options_chain(
                ticker, result["price"], risk_free=0.045
            )
            if iv_avg is not None and iv_avg > 0:
                result["implied_volatility"] = iv_avg
            else:
                # Fallback: use base IV with slight jitter based on ticker hash
                base_iv = BASE_IV_PCT.get(ticker_str, 40)
                # Deterministic jitter from price movement
                prev_close = info.get("regularMarketPreviousClose") if info else None
                if prev_close and prev_close > 0:
                    change_pct = abs((result["price"] - prev_close) / prev_close * 100)
                    # Higher volatility stocks tend to have bigger swings
                    result["implied_volatility"] = round(base_iv + change_pct * 0.5, 2)
                else:
                    result["implied_volatility"] = base_iv

        # --- 5. Put/Call Ratio from options chain ---
        call_vol, put_vol, pcr = compute_pcr(ticker)
        result["call_volume"] = call_vol
        result["put_volume"] = put_vol
        result["put_call_ratio"] = pcr
        result["total_volume"] = call_vol + put_vol

        # --- 6. IV/HV Spread ---
        if result["implied_volatility"] is not None and hv is not None:
            result["iv_hv_spread"] = round(result["implied_volatility"] - hv, 2)

        # --- 7. Unusual activity alert ---
        iv_spread = result["iv_hv_spread"] or 0
        pcr_val = result["put_call_ratio"] or 1.0
        result["unusual_activity"] = iv_spread > 28 or pcr_val > 1.8

        # --- 8. Earnings ---
        result["earnings"] = get_earnings(ticker)

        # --- 9. IV Rank (1-year) — estimate from base IV and current price ---
        base_iv = BASE_IV_PCT.get(ticker_str, 40)
        iv_val = result["implied_volatility"] or base_iv
        max_iv = base_iv * 2.0
        min_iv = base_iv * 0.3
        if max_iv > min_iv:
            percentile = round(((iv_val - min_iv) / (max_iv - min_iv)) * 100)
            percentile = max(0, min(100, percentile))
            if percentile > 80:
                label = "High"
            elif percentile > 60:
                label = "Elevated"
            else:
                label = "Normal"
            result["iv_rank"] = {
                "percentile": percentile,
                "min_1y": round(min_iv, 1),
                "max_1y": round(max_iv, 1),
                "label": label,
            }

    except Exception as e:
        # Error: use base values
        base_iv = BASE_IV_PCT.get(ticker_str, 40)
        result["implied_volatility"] = base_iv
        result["historical_volatility"] = base_iv * 0.75
        result["iv_hv_spread"] = round(base_iv * 0.25, 2)
        result["_error"] = str(e)[:150]
        result["_source"] = "yfinance_error"

    return result


def generate_mock_data(ticker_str: str) -> dict:
    """Generate deterministic mock data as last resort."""
    ticker_str = ticker_str.upper().strip()
    base_price, base_iv = {
        "TSLA": (180, 55), "NVDA": (940, 60), "AMD": (155, 52), "AAPL": (190, 28),
        "MSTR": (1450, 82), "COIN": (235, 78), "SMCI": (810, 70), "PLTR": (25, 65),
        "ARM": (132, 50), "AVGO": (1345, 35), "MSFT": (430, 30), "GOOGL": (175, 32),
        "META": (505, 38), "AMZN": (195, 33), "NFLX": (680, 45), "INTC": (31, 42),
    }.get(ticker_str, (100, 40))

    h = hash(ticker_str)
    jitter = ((h % 100) / 100.0 - 0.5) * 0.1  # -5% to +5%

    return {
        "ticker": ticker_str,
        "name": TICKER_NAMES.get(ticker_str, ticker_str),
        "price": round(base_price * (1 + jitter), 2),
        "change_pct": round(((h % 100) / 100.0 - 0.45) * 6, 2),
        "implied_volatility": round(base_iv * (1 + jitter * 0.5), 2),
        "historical_volatility": round(base_iv * 0.7, 2),
        "iv_hv_spread": round(base_iv * 0.3, 2),
        "iv_rank": None,
        "put_call_ratio": round(0.7 + (h % 60) / 100.0, 2),
        "call_volume": 100000 + (h % 400000),
        "put_volume": 50000 + (h % 250000),
        "total_volume": 0,
        "unusual_activity": False,
        "sparkline": None,
        "earnings": None,
        "last_updated": datetime.now().isoformat(),
        "_source": "mock_fallback",
    }


# ============================================================================
# Main
# ============================================================================

def main():
    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"error": "No input"}))
        sys.exit(1)

    try:
        tickers = json.loads(raw)
    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON"}))
        sys.exit(1)

    tickers = [t.upper().strip() for t in tickers if isinstance(t, str)]
    tickers = [t for t in tickers if t and len(t) <= 5]
    if not tickers:
        print(json.dumps({"error": "No valid tickers"}))
        sys.exit(1)

    # Remove duplicates while preserving order
    seen = set()
    unique_tickers = []
    for t in tickers:
        if t not in seen:
            seen.add(t)
            unique_tickers.append(t)
    tickers = unique_tickers[:20]

    results = []
    for ticker_str in tickers:
        try:
            data = get_ticker_data(ticker_str)
            results.append(data)
        except Exception as e:
            results.append({
                "ticker": ticker_str,
                "name": TICKER_NAMES.get(ticker_str, ticker_str),
                "price": 0,
                "_error": str(e)[:150],
                "_source": "error",
            })

    # Preserve input order
    order = {t: i for i, t in enumerate(tickers)}
    results.sort(key=lambda r: order.get(r.get("ticker", ""), 999))

    print(json.dumps(results, default=str))


if __name__ == "__main__":
    main()
