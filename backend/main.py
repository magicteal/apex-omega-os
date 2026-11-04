"""
APEX-OMEGA OS — FastAPI Quantitative Command Center Daemon
- High-frequency 1.5s live market price ticker streamer (CCXT Binance)
- Async 15m candle scanner across Universe (TTM Squeeze + EMA-100 + RVOL + ROC5)
- WebSocket /ws/telemetry streaming live prices & execution metrics every 1.5s
- Persistent Trade Execution History Ledger
- REST endpoints:
  - POST /api/mode           (Switch PAPER vs LIVE)
  - POST /api/start-campaign (Start real-market autonomous paper campaign)
  - POST /api/kill-switch    (Instant market flatten & log trade)
  - POST /api/monte-carlo    (1,000 bootstrap permutations)
  - POST /api/simulate-tick  (Inject +1.2 ATR synthetic breakout spike for testing)
  - GET  /api/state          (Current snapshot)
"""
import asyncio
import json
import os
import random
from datetime import datetime, timezone
import sys
from pathlib import Path
from typing import Dict, Any, List

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from core.squeeze_engine import SqueezeEngine
from core.kelly_ratchet import KellyRatchet
from core.vault_siphon import VaultSiphonProtocol
from execution.broker_router import PyramidBrokerRouter

try:
    import ccxt.async_support as ccxt_async
except ImportError:
    ccxt_async = None

UNIVERSE = [
    "SOL/USDT:USDT",
    "BTC/USDT:USDT",
    "ETH/USDT:USDT",
    "SUI/USDT:USDT",
    "DOGE/USDT:USDT",
    "XRP/USDT:USDT",
    "BNB/USDT:USDT",
    "AVAX/USDT:USDT",
    "LINK/USDT:USDT",
    "1000PEPE/USDT:USDT",
]

STATE_PATH = Path(__file__).parent / "bot_state.json"

app = FastAPI(title="APEX-OMEGA OS Backend", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
@app.get("/health")
async def health_check() -> Dict[str, Any]:
    return {
        "status": "healthy",
        "service": "APEX-OMEGA OS Backend",
        "utc_time": datetime.now(timezone.utc).isoformat()
    }



class ModeRequest(BaseModel):
    mode: str


class SimulateTickRequest(BaseModel):
    symbol: str = "SOL/USDT:USDT"
    atr_step: float = 1.2


class StartCampaignRequest(BaseModel):
    symbol: str = "SOL/USDT:USDT"
    side: str = "LONG"


class ApexOmegaDaemon:
    def __init__(self):
        self.squeeze_engine = SqueezeEngine()
        self.kelly_ratchet = KellyRatchet()
        self.vault_siphon = VaultSiphonProtocol()
        self.state = self._load_state()
        self.router = PyramidBrokerRouter(mode=self.state.get("mode", "PAPER"))
        self.scanner_cache: Dict[str, Dict[str, Any]] = {}
        self.clients: List[WebSocket] = []
        self.last_event = None
        self._seed_synthetic_universe()

    def _load_state(self) -> Dict[str, Any]:
        if STATE_PATH.exists():
            try:
                data = json.loads(STATE_PATH.read_text(encoding="utf-8"))
                if "trade_history" not in data or not isinstance(data["trade_history"], list):
                    data["trade_history"] = []
                return data
            except Exception:
                pass
        return {
            "mode": "PAPER",
            "active_equity": 10000.0,
            "peak_equity": 10000.0,
            "vault_balance": 0.0,
            "principal_siphoned": False,
            "next_siphon_milestone": 20000.0,
            "historical_trade_returns_pct": [0.042, -0.011, 0.068, 0.031, -0.009, 0.084],
            "siphon_history": [],
            "equity_curve": [],
            "trade_history": [],
        }

    def save_state(self) -> None:
        try:
            STATE_PATH.write_text(json.dumps(self.state, indent=2), encoding="utf-8")
        except Exception:
            pass

    def record_closed_trade(self, summary: Dict[str, Any]) -> None:
        if not summary or not summary.get("flattened"):
            return
        now_iso = datetime.now(timezone.utc).isoformat()
        now_ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        entry_p = float(summary.get("entry_price", summary.get("exit_price", 0.0)))
        exit_p = float(summary.get("exit_price", 0.0))
        pnl_inr = float(summary.get("realized_pnl_inr", 0.0))
        side = summary.get("side", "LONG")
        
        pnl_pct = 0.0
        if entry_p > 0:
            if side == "LONG":
                pnl_pct = round(((exit_p - entry_p) / entry_p) * 100, 2)
            else:
                pnl_pct = round(((entry_p - exit_p) / entry_p) * 100, 2)

        trade_id = summary.get("id") or f"TRD-{int(datetime.now(timezone.utc).timestamp())}"
        trade_entry = {
            "id": trade_id,
            "timestamp": now_ts,
            "entry_time": summary.get("entry_time") or now_iso,
            "exit_time": summary.get("exit_time") or now_iso,
            "symbol": summary.get("symbol", "SOL/USDT:USDT"),
            "side": side,
            "entry_price": round(entry_p, 4),
            "exit_price": round(exit_p, 4),
            "filled_units": int(summary.get("filled_units", 1)),
            "realized_pnl_inr": round(pnl_inr, 2),
            "pnl_pct": pnl_pct,
            "reason": summary.get("reason", "CLOSED"),
            "post_equity": round(self.state["active_equity"], 2),
        }
        self.last_event = {
            "type": "EXIT",
            "id": trade_id,
            "symbol": trade_entry["symbol"],
            "side": trade_entry["side"],
            "entry_price": trade_entry["entry_price"],
            "exit_price": trade_entry["exit_price"],
            "filled_units": trade_entry["filled_units"],
            "realized_pnl_inr": trade_entry["realized_pnl_inr"],
            "pnl_pct": trade_entry["pnl_pct"],
            "reason": trade_entry["reason"],
            "timestamp": now_iso,
        }
        
        if "trade_history" not in self.state:
            self.state["trade_history"] = []
        self.state["trade_history"].insert(0, trade_entry)
        if len(self.state["trade_history"]) > 100:
            self.state["trade_history"] = self.state["trade_history"][:100]

        now_label = datetime.now(timezone.utc).strftime("%H:%M:%S")
        self.state.setdefault("equity_curve", []).append({
            "ts": now_label,
            "active": self.state["active_equity"],
            "total": round(self.state["active_equity"] + self.state.get("vault_balance", 0.0), 2)
        })
        self.save_state()

    def _seed_synthetic_universe(self) -> None:
        defaults = [
            ("SOL/USDT:USDT", 93.55, 0.30, 0.78, True, 6, 0.0024, 2.34, 0.0185, "COILING", False),
            ("BTC/USDT:USDT", 77800.00, 195.00, 0.89, True, 4, 0.0014, 1.82, 0.0132, "COILING", False),
            ("ETH/USDT:USDT", 2288.50, 7.80, 0.94, True, 3, 0.0007, 1.41, 0.0068, "COILING", False),
            ("SUI/USDT:USDT", 0.8960, 0.0050, 0.81, True, 5, 0.0029, 2.61, 0.0241, "COILING", False),
            ("DOGE/USDT:USDT", 0.0752, 0.0003, 1.18, False, 0, -0.0016, 1.92, -0.0154, "NEUTRAL", False),
            ("XRP/USDT:USDT", 1.2790, 0.0120, 0.83, True, 5, 0.0021, 2.48, 0.0194, "COILING", False),
            ("BNB/USDT:USDT", 699.80, 4.20, 0.91, True, 3, 0.0009, 1.52, 0.0082, "COILING", False),
            ("AVAX/USDT:USDT", 8.520, 0.085, 0.79, True, 6, 0.0026, 2.19, 0.0168, "COILING", False),
            ("LINK/USDT:USDT", 11.080, 0.110, 0.86, True, 4, 0.0018, 1.96, 0.0145, "COILING", False),
            ("1000PEPE/USDT:USDT", 0.00484, 0.00005, 0.76, True, 7, 0.0033, 2.84, 0.0275, "COILING", False),
        ]
        for sym, price, atr, comp, sq, sq_bars, slope, rvol, roc5, regime, valid in defaults:
            self.scanner_cache[sym] = {
                "symbol": sym,
                "price": price,
                "atr_14": atr,
                "bb_upper": round(price + 1.8 * atr, 4),
                "bb_lower": round(price - 1.8 * atr, 4),
                "kc_upper": round(price + 2.1 * atr, 4),
                "kc_lower": round(price - 2.1 * atr, 4),
                "compression_ratio": comp,
                "squeeze_on": sq,
                "squeeze_bars_last_10": sq_bars,
                "ema_100": round(price * 0.985, 4),
                "ema_100_slope": slope,
                "rvol": rvol,
                "roc5": roc5,
                "regime": regime,
                "signal_valid": valid,
            }

    async def scan_universe_once(self) -> None:
        if ccxt_async is not None:
            exchange = ccxt_async.binanceusdm({"enableRateLimit": True, "timeout": 4000})
            try:
                for symbol in UNIVERSE:
                    try:
                        ohlcv = await exchange.fetch_ohlcv(symbol, timeframe="15m", limit=120)
                        if ohlcv and len(ohlcv) >= 100:
                            sig = self.squeeze_engine.evaluate_ohlcv(symbol, ohlcv)
                            self.scanner_cache[symbol] = sig.to_dict()
                    except Exception:
                        pass
            except Exception:
                pass
            finally:
                await exchange.close()

    def build_telemetry_payload(self) -> Dict[str, Any]:
        unrealized = (
            self.router.active_campaign["total_unrealized_pnl_inr"]
            if self.router.active_campaign
            else 0.0
        )
        live_active_equity = round(self.state["active_equity"] + unrealized, 2)
        kelly = self.kelly_ratchet.compute_allocation(
            live_active_equity, self.state["peak_equity"]
        )
        self.state["peak_equity"] = kelly.peak_equity

        siphon_res = self.vault_siphon.evaluate_and_siphon(
            active_equity=live_active_equity,
            vault_balance=self.state["vault_balance"],
            principal_siphoned=self.state["principal_siphoned"],
            next_milestone=self.state["next_siphon_milestone"],
            history=self.state.get("siphon_history", []),
        )
        if siphon_res["triggered"]:
            siphoned_delta = live_active_equity - siphon_res["active_equity"]
            self.state["active_equity"] = round(self.state["active_equity"] - siphoned_delta, 2)
            self.state["vault_balance"] = siphon_res["vault_balance"]
            self.state["principal_siphoned"] = siphon_res["principal_siphoned"]
            self.state["next_siphon_milestone"] = siphon_res["next_milestone"]
            self.state["siphon_history"] = siphon_res["siphon_history"]
            live_active_equity = siphon_res["active_equity"]
            self.save_state()

        total_net_worth = round(live_active_equity + self.state["vault_balance"], 2)
        history = self.state.get("trade_history", [])
        total_realized_pnl = round(sum(t.get("realized_pnl_inr", 0) for t in history), 2)
        winning_trades = sum(1 for t in history if t.get("realized_pnl_inr", 0) > 0)
        win_rate = round((winning_trades / max(len(history), 1)) * 100, 1) if history else 0.0

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "mode": self.router.mode,
            "live_feed_status": "ONLINE (Binance 1s Stream)",
            "active_equity": live_active_equity,
            "vault_balance": round(self.state["vault_balance"], 2),
            "total_net_worth": total_net_worth,
            "principal_siphoned": self.state["principal_siphoned"],
            "next_siphon_milestone": self.state["next_siphon_milestone"],
            "kelly": kelly.to_dict(),
            "scanner": list(self.scanner_cache.values()),
            "pyramid": self.router.active_campaign,
            "trade_history": history[:30],
            "total_trades": len(history),
            "winning_trades": winning_trades,
            "win_rate_pct": win_rate,
            "total_realized_pnl": total_realized_pnl,
            "siphon_history": self.state.get("siphon_history", []),
            "equity_curve": self.state.get("equity_curve", [])[-30:],
            "last_event": self.last_event,
        }


daemon = ApexOmegaDaemon()


@app.on_event("startup")
async def startup_daemon() -> None:
    async def loop():
        exchange = None
        if ccxt_async is not None:
            exchange = ccxt_async.binanceusdm({"enableRateLimit": True, "timeout": 3000})

        cycle_count = 0
        while True:
            try:
                # 1. Real-time Live Ticker Updates from Binance (every 1.5s)
                if exchange is not None:
                    try:
                        tickers = await exchange.fetch_tickers(UNIVERSE)
                        for sym, tk in tickers.items():
                            if sym in daemon.scanner_cache and tk.get("last"):
                                daemon.scanner_cache[sym]["price"] = round(tk["last"], 4 if tk["last"] < 10 else 2)
                    except Exception:
                        pass

                # 2. Periodic 15m Squeeze Indicator recalculation (every ~18s)
                cycle_count += 1
                if cycle_count % 12 == 0 or cycle_count == 1:
                    await daemon.scan_universe_once()

                # 3. Autonomous Real-Market Campaign Execution
                if daemon.router.active_campaign:
                    active_sym = daemon.router.active_campaign["symbol"]
                    if active_sym in daemon.scanner_cache:
                        live_p = daemon.scanner_cache[active_sym]["price"]
                        tick_res = await daemon.router.on_price_tick(live_p)
                        if tick_res.get("status") == "STOPPED_OUT":
                            closed = tick_res.get("flatten_summary", {})
                            if closed.get("flattened"):
                                daemon.state["active_equity"] = round(
                                    daemon.state["active_equity"] + closed.get("realized_pnl_inr", 0.0), 2
                                )
                                daemon.record_closed_trade(closed)
                else:
                    # Auto-ignite if a valid Squeeze Breakout triggers in live market
                    for sym, asset in daemon.scanner_cache.items():
                        if asset.get("signal_valid"):
                            kelly = daemon.kelly_ratchet.compute_allocation(
                                daemon.state["active_equity"], daemon.state["peak_equity"]
                            )
                            camp = await daemon.router.initialize_campaign(
                                symbol=sym,
                                side="LONG" if "LONG" in asset.get("regime", "LONG") else "SHORT",
                                entry_price=asset["price"],
                                atr=asset.get("atr_14", asset["price"] * 0.015),
                                total_notional_inr=kelly.notional_cap_inr,
                            )
                            daemon.last_event = {
                                "type": "ENTRY",
                                "id": camp.get("id"),
                                "symbol": sym,
                                "side": camp.get("side", "LONG"),
                                "entry_price": asset["price"],
                                "effective_stop": camp.get("effective_stop"),
                                "notional_inr": kelly.notional_cap_inr * 0.20,
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            }
                            break

                # 4. Stream Telemetry over WebSocket
                payload = daemon.build_telemetry_payload()
                dead = []
                for ws in daemon.clients:
                    try:
                        await ws.send_json(payload)
                    except Exception:
                        dead.append(ws)
                for ws in dead:
                    daemon.clients.remove(ws)

            except Exception:
                pass

            await asyncio.sleep(1.5)

    asyncio.create_task(loop())


@app.websocket("/ws/telemetry")
async def websocket_telemetry(ws: WebSocket) -> None:
    await ws.accept()
    daemon.clients.append(ws)
    try:
        await ws.send_json(daemon.build_telemetry_payload())
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        if ws in daemon.clients:
            daemon.clients.remove(ws)


@app.get("/api/state")
async def get_state() -> Dict[str, Any]:
    return daemon.build_telemetry_payload()


@app.post("/api/reset")
async def reset_portfolio() -> Dict[str, Any]:
    if daemon.router.active_campaign:
        await daemon.router.flatten_all(reason="RESET")
    daemon.last_event = None
    daemon.state = {
        "mode": "PAPER",
        "active_equity": 10000.0,
        "peak_equity": 10000.0,
        "vault_balance": 0.0,
        "principal_siphoned": False,
        "next_siphon_milestone": 20000.0,
        "historical_trade_returns_pct": [0.035, -0.012, 0.052, 0.028, -0.010, 0.065],
        "siphon_history": [],
        "equity_curve": [{"ts": "00:00", "active": 10000.0, "total": 10000.0}],
        "trade_history": [],
    }
    daemon.save_state()
    return {"status": "RESET_COMPLETE", "telemetry": daemon.build_telemetry_payload()}


@app.post("/api/mode")
async def switch_mode(req: ModeRequest) -> Dict[str, Any]:
    new_mode = daemon.router.set_mode(req.mode)
    daemon.state["mode"] = new_mode
    daemon.save_state()
    return {"status": "OK", "mode": new_mode}


@app.post("/api/kill-switch")
async def trigger_kill_switch() -> Dict[str, Any]:
    summary = await daemon.router.flatten_all(reason="MANUAL_KILL_SWITCH")
    if summary.get("flattened"):
        daemon.state["active_equity"] = round(
            daemon.state["active_equity"] + summary["realized_pnl_inr"], 2
        )
        daemon.record_closed_trade(summary)
    return {"status": "FLATTENED", "summary": summary, "telemetry": daemon.build_telemetry_payload()}


@app.post("/api/start-campaign")
async def start_real_campaign(req: StartCampaignRequest) -> Dict[str, Any]:
    """Starts an immediate paper campaign on the real live market price."""
    if daemon.router.active_campaign:
        # Flatten existing first
        summary = await daemon.router.flatten_all(reason="ROTATED_CAMPAIGN")
        if summary.get("flattened"):
            daemon.state["active_equity"] = round(
                daemon.state["active_equity"] + summary["realized_pnl_inr"], 2
            )
            daemon.record_closed_trade(summary)

    asset = daemon.scanner_cache.get(req.symbol) or daemon.scanner_cache.get("SOL/USDT:USDT")
    kelly = daemon.kelly_ratchet.compute_allocation(
        daemon.state["active_equity"], daemon.state["peak_equity"]
    )
    camp = await daemon.router.initialize_campaign(
        symbol=asset["symbol"],
        side=req.side,
        entry_price=asset["price"],
        atr=asset.get("atr_14", asset["price"] * 0.015),
        total_notional_inr=kelly.notional_cap_inr,
    )
    return {"status": "CAMPAIGN_STARTED", "campaign": camp, "telemetry": daemon.build_telemetry_payload()}


@app.post("/api/simulate-tick")
async def simulate_breakout_tick(req: SimulateTickRequest) -> Dict[str, Any]:
    asset = daemon.scanner_cache.get(req.symbol) or daemon.scanner_cache.get("SOL/USDT:USDT")
    kelly = daemon.kelly_ratchet.compute_allocation(
        daemon.state["active_equity"], daemon.state["peak_equity"]
    )
    if not daemon.router.active_campaign:
        camp = await daemon.router.initialize_campaign(
            symbol=asset["symbol"],
            side="LONG",
            entry_price=asset["price"],
            atr=asset.get("atr_14", asset["price"] * 0.015),
            total_notional_inr=kelly.notional_cap_inr,
        )
        return {"status": "IGNITED_T1", "campaign": camp, "telemetry": daemon.build_telemetry_payload()}

    camp = daemon.router.active_campaign
    new_price = round(camp["current_price"] + req.atr_step * camp["atr_at_entry"], 4)
    asset["price"] = new_price
    tick_res = await daemon.router.on_price_tick(new_price)
    if tick_res.get("status") == "STOPPED_OUT":
        closed = tick_res.get("flatten_summary", {})
        if closed.get("flattened"):
            daemon.state["active_equity"] = round(
                daemon.state["active_equity"] + closed.get("realized_pnl_inr", 0.0), 2
            )
            daemon.record_closed_trade(closed)

    now_label = datetime.now(timezone.utc).strftime("%H:%M:%S")
    telemetry = daemon.build_telemetry_payload()
    daemon.state.setdefault("equity_curve", []).append(
        {
            "ts": now_label,
            "active": telemetry["active_equity"],
            "total": telemetry["total_net_worth"],
        }
    )
    daemon.save_state()
    return {"status": tick_res["status"], "tick": tick_res, "telemetry": daemon.build_telemetry_payload()}


@app.post("/api/monte-carlo")
async def run_monte_carlo(iterations: int = 1000, horizon_trades: int = 40) -> Dict[str, Any]:
    import time as _time
    t0 = _time.perf_counter()
    returns = daemon.state.get("historical_trade_returns_pct", [0.04, -0.01, 0.06, 0.03, -0.01])
    start_eq = daemon.state["active_equity"]
    terminal_equities = []
    max_drawdowns = []

    for _ in range(iterations):
        eq = start_eq
        peak = eq
        mdd = 0.0
        for _ in range(horizon_trades):
            r = random.choice(returns)
            eq *= (1.0 + r)
            if eq > peak:
                peak = eq
            dd = (peak - eq) / max(peak, 1e-9)
            if dd > mdd:
                mdd = dd
        terminal_equities.append(eq)
        max_drawdowns.append(mdd)

    terminal_equities.sort()
    max_drawdowns.sort()
    n = len(terminal_equities)
    elapsed_ms = round((_time.perf_counter() - t0) * 1000.0, 2)
    return {
        "execution_time_ms": elapsed_ms,
        "iterations": iterations,
        "horizon_trades": horizon_trades,
        "start_equity_inr": round(start_eq, 2),
        "p5_tail_equity_inr": round(terminal_equities[int(0.05 * n)], 2),
        "p50_median_equity_inr": round(terminal_equities[int(0.50 * n)], 2),
        "p95_upside_equity_inr": round(terminal_equities[int(0.95 * n)], 2),
        "median_max_drawdown_pct": round(max_drawdowns[int(0.50 * n)] * 100.0, 2),
        "p95_worst_drawdown_pct": round(max_drawdowns[int(0.95 * n)] * 100.0, 2),
    }
