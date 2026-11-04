"use client";
import React, { useEffect, useState } from "react";
import ScannerMatrix from "../components/ScannerMatrix";
import PyramidLadder from "../components/PyramidLadder";
import VaultLedger from "../components/VaultLedger";
import TradeHistory from "../components/TradeHistory";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const BACKEND_WS =
  process.env.NEXT_PUBLIC_BACKEND_WS_URL ||
  (BACKEND_HTTP.startsWith("https://")
    ? BACKEND_HTTP.replace("https://", "wss://")
    : BACKEND_HTTP.replace("http://", "ws://"));

export default function CommandCenterPage() {
  const [telemetry, setTelemetry] = useState<any>(null);
  const [selectedSymbol, setSelectedSymbol] = useState("SOL/USDT:USDT");
  const [mcResult, setMcResult] = useState<any>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: any = null;

    const connect = () => {
      try {
        ws = new WebSocket(`${BACKEND_WS}/ws/telemetry`);
        ws.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data);
            setTelemetry(data);
          } catch (e) {}
        };
        ws.onclose = () => {
          timer = setTimeout(connect, 2000);
        };
      } catch (err) {
        timer = setTimeout(connect, 2500);
      }
    };

    connect();

    // Fallback polling every 5s if WebSocket is closed
    const pollInterval = setInterval(async () => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        try {
          const res = await fetch(`${BACKEND_HTTP}/api/state`);
          if (res.ok) {
            const data = await res.json();
            setTelemetry(data);
          }
        } catch (e) {}
      }
    }, 5000);

    return () => {
      if (ws) ws.close();
      if (timer) clearTimeout(timer);
      clearInterval(pollInterval);
    };
  }, []);

  // Debug Synthetic Breakout (+1.2 ATR spike to test pyramid scale-in steps)
  const triggerBreakoutTick = async () => {
    const res = await fetch(`${BACKEND_HTTP}/api/simulate-tick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: selectedSymbol, atr_step: 1.2 }),
    });
    const data = await res.json();
    if (data.telemetry) setTelemetry(data.telemetry);
  };

  const triggerKillSwitch = async () => {
    const res = await fetch(`${BACKEND_HTTP}/api/kill-switch`, { method: "POST" });
    const data = await res.json();
    if (data.telemetry) setTelemetry(data.telemetry);
  };

  const toggleMode = async () => {
    const nextMode = telemetry?.mode === "PAPER" ? "LIVE" : "PAPER";
    await fetch(`${BACKEND_HTTP}/api/mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: nextMode }),
    });
  };

  const runMonteCarlo = async () => {
    const res = await fetch(`${BACKEND_HTTP}/api/monte-carlo`, { method: "POST" });
    setMcResult(await res.json());
  };

  const hasActivePosition = telemetry?.pyramid?.active;
  const activeSymbol = telemetry?.pyramid?.symbol;

  return (
    <main className="min-h-screen bg-[#0B0F12] text-slate-200 p-4 space-y-4 font-sans">
      {/* Top Header */}
      <header className="bg-[#11161B] border border-[#1C242D] p-4 flex flex-wrap items-center justify-between gap-4 font-mono tabular-nums">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-sm font-bold tracking-widest text-[#97CEB4]">
              APEX-OMEGA OS // AUTONOMOUS QUANTITATIVE ENGINE
            </h1>
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-[#0B0F12] border border-[#1C242D] text-[#97CEB4] text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#97CEB4] animate-ping" />
              {telemetry?.live_feed_status || "BINANCE 1.5s STREAM ACTIVE"}
            </span>
            <span className="px-2 py-0.5 bg-[#17212B] border border-[#97CEB4]/30 text-[#97CEB4] text-[10px] font-semibold">
              {hasActivePosition ? `🔥 CAMPAIGN IN PROGRESS: ${activeSymbol}` : "🟢 24/7 SCANNING: WAITING FOR COMPRESSION BREAKOUT"}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Active Capital: <strong className="text-white">₹{(telemetry?.active_equity ?? 10000).toLocaleString("en-IN")}</strong> | Vault: <strong className="text-[#97CEB4]">₹{(telemetry?.vault_balance || 0).toLocaleString("en-IN")}</strong> | Kelly Floor: <strong className="text-slate-300">₹{(telemetry?.kelly?.protected_floor ?? 7500).toLocaleString("en-IN")}</strong> | Selected: <strong className="text-white">{selectedSymbol}</strong>
          </p>
        </div>

        {/* System Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Debug Testing Button */}
          <button
            onClick={triggerBreakoutTick}
            className="px-3 py-1.5 text-xs font-semibold bg-[#17212B] hover:bg-[#202C39] border border-[#97CEB4]/40 text-[#97CEB4] transition-all"
            title="Algorithmic test: Injects a +1.2 ATR price tick to verify pyramid scale-in steps"
          >
            🧪 Test Breakout Tick (+1.2 ATR)
          </button>

          {/* Mode Switch */}
          <button
            onClick={toggleMode}
            className="px-3 py-1.5 text-xs font-bold border border-[#1C242D] bg-[#0B0F12] text-slate-300 hover:text-white"
          >
            MODE: {telemetry?.mode || "PAPER"}
          </button>

          {/* Kill Switch */}
          <button
            onClick={triggerKillSwitch}
            className="px-3 py-1.5 text-xs font-bold bg-[#FF0055] hover:bg-[#e0004c] text-white transition-all"
            title="Emergency Stop: Immediately close active campaign"
          >
            EMERGENCY FLATTEN
          </button>
        </div>
      </header>

      {/* Autonomous System Banner */}
      <div className="bg-[#11161B]/80 border border-[#1C242D] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-300">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#97CEB4] shrink-0"></span>
          <span><strong>AUTONOMOUS PROTOCOL:</strong> Zero manual intervention required. The engine automatically monitors 10 Binance USD-M markets in real time. When all 4 breakout criteria confirm, Tranche 1 auto-ignites with mathematical Kelly sizing.</span>
        </div>
        <div className="text-slate-400 text-[11px] shrink-0">
          Sizing: ₹2,000 / trade (20% Notional, 2% Risk Cap)
        </div>
      </div>

      {/* 01 // 10-Asset Live Squeeze Matrix */}
      <ScannerMatrix
        assets={telemetry?.scanner || []}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={setSelectedSymbol}
      />

      {/* 02 // 4-Unit Anti-Martingale Pyramid Ladder */}
      <PyramidLadder pyramid={telemetry?.pyramid} />

      {/* 03 // Cold Vault Siphon Ledger & Monte Carlo Engine */}
      <VaultLedger
        activeEquity={telemetry?.active_equity ?? 10000}
        vaultBalance={telemetry?.vault_balance || 0}
        nextMilestone={telemetry?.next_siphon_milestone || 20000}
        siphonHistory={telemetry?.siphon_history || []}
        onRunMonteCarlo={runMonteCarlo}
        monteCarloResult={mcResult}
      />

      {/* 04 // Real Market Execution & Trade History Ledger */}
      <TradeHistory
        trades={telemetry?.trade_history || []}
        totalTrades={telemetry?.total_trades}
        winRatePct={telemetry?.win_rate_pct}
        totalRealizedPnl={telemetry?.total_realized_pnl}
      />
    </main>
  );
}
