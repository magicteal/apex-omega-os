"use client";
import React, { useEffect, useState, useRef } from "react";
import ScannerMatrix from "../components/ScannerMatrix";
import PyramidLadder from "../components/PyramidLadder";
import VaultLedger from "../components/VaultLedger";
import TradeHistory, { formatToIST } from "../components/TradeHistory";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const BACKEND_WS =
  process.env.NEXT_PUBLIC_BACKEND_WS_URL ||
  (BACKEND_HTTP.startsWith("https://")
    ? BACKEND_HTTP.replace("https://", "wss://")
    : BACKEND_HTTP.replace("http://", "ws://"));

// Web Audio synthesizer for crisp execution chimes
function playChime(isSuccess = true) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (isSuccess) {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2); // A5
    } else {
      osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.25); // A3
    }

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
}

export default function CommandCenterPage() {
  const [telemetry, setTelemetry] = useState<any>(null);
  const [selectedSymbol, setSelectedSymbol] = useState("SOL/USDT:USDT");
  const [activeTab, setActiveTab] = useState<"command" | "history">("command");
  const [mcResult, setMcResult] = useState<any>(null);
  const [activeToast, setActiveToast] = useState<any>(null);

  const lastProcessedEventId = useRef<string | null>(null);

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
            handleIncomingEvent(data?.last_event);
          } catch (e) {}
        };
        ws.onclose = () => {
          timer = setTimeout(connect, 2500);
        };
      } catch (err) {
        timer = setTimeout(connect, 3000);
      }
    };

    connect();

    // Secondary fallback polling (every 4s) to ensure seamless updates
    const pollInterval = setInterval(async () => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        try {
          const res = await fetch(`${BACKEND_HTTP}/api/state`);
          if (res.ok) {
            const data = await res.json();
            setTelemetry(data);
            handleIncomingEvent(data?.last_event);
          }
        } catch (e) {}
      }
    }, 4000);

    return () => {
      if (ws) ws.close();
      if (timer) clearTimeout(timer);
      clearInterval(pollInterval);
    };
  }, []);

  // Handle trade entry / exit pop-up alert
  const handleIncomingEvent = (event: any) => {
    if (!event || !event.timestamp) return;
    const eventKey = `${event.type}-${event.id || event.timestamp}`;
    if (lastProcessedEventId.current === eventKey) return;

    lastProcessedEventId.current = eventKey;
    setActiveToast(event);
    playChime(event.type === "ENTRY" || (event.realized_pnl_inr || 0) >= 0);

    // Auto-dismiss toast after 9 seconds
    setTimeout(() => {
      setActiveToast((prev: any) => (prev?.timestamp === event.timestamp ? null : prev));
    }, 9000);
  };

  const triggerKillSwitch = async () => {
    if (confirm("Are you sure you want to emergency flatten the active position at live market price?")) {
      const res = await fetch(`${BACKEND_HTTP}/api/kill-switch`, { method: "POST" });
      const data = await res.json();
      if (data.telemetry) setTelemetry(data.telemetry);
    }
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
    <main className="min-h-screen bg-[#0B0F12] text-slate-200 p-4 space-y-4 font-sans relative">
      {/* Real-Time Trade Pop-up Alert (Toast) */}
      {activeToast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 duration-300">
          <div
            className={`p-4 bg-[#11161B] border shadow-2xl rounded font-mono tabular-nums ${
              activeToast.type === "ENTRY"
                ? "border-[#97CEB4] shadow-[#97CEB4]/10"
                : (activeToast.realized_pnl_inr || 0) >= 0
                ? "border-[#97CEB4] shadow-[#97CEB4]/10"
                : "border-[#FF0055] shadow-[#FF0055]/10"
            }`}
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1C242D]">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    activeToast.type === "ENTRY"
                      ? "bg-[#97CEB4] animate-ping"
                      : (activeToast.realized_pnl_inr || 0) >= 0
                      ? "bg-[#97CEB4]"
                      : "bg-[#FF0055]"
                  }`}
                />
                <span className="text-xs font-bold text-white tracking-wider">
                  {activeToast.type === "ENTRY"
                    ? "⚡ NEW POSITION EXECUTED (REAL MARKET)"
                    : "🛑 TRADE CLOSED & AUDITED"}
                </span>
              </div>
              <button
                onClick={() => setActiveToast(null)}
                className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded border border-[#1C242D] hover:bg-[#1C242D]"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Asset &amp; Direction:</span>
                <span className="font-bold text-white">
                  {activeToast.symbol} ({activeToast.side})
                </span>
              </div>

              {activeToast.type === "ENTRY" ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Entry Fill Price:</span>
                    <span className="font-semibold text-white">
                      ${activeToast.entry_price}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Initial Allocation:</span>
                    <span className="text-[#97CEB4] font-semibold">
                      Tranche T1 (₹{Number(activeToast.notional_inr || 2000).toLocaleString("en-IN")})
                    </span>
                  </div>
                  {activeToast.effective_stop && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Initial Stop Loss:</span>
                      <span className="text-[#FF0055] font-semibold">
                        ${activeToast.effective_stop}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Exit Fill Price:</span>
                    <span className="font-semibold text-white">
                      ${activeToast.exit_price}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Units Scaled:</span>
                    <span className="text-slate-200">
                      T1→T{activeToast.filled_units || 1}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Net Realized PnL:</span>
                    <span
                      className={`font-bold ${
                        (activeToast.realized_pnl_inr || 0) >= 0
                          ? "text-[#97CEB4]"
                          : "text-[#FF0055]"
                      }`}
                    >
                      {(activeToast.realized_pnl_inr || 0) >= 0 ? "+" : ""}
                      ₹{(activeToast.realized_pnl_inr || 0).toFixed(2)}
                      {activeToast.pnl_pct !== undefined && ` (${activeToast.pnl_pct >= 0 ? "+" : ""}${activeToast.pnl_pct.toFixed(2)}%)`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Exit Trigger:</span>
                    <span className="text-slate-300">
                      {activeToast.reason}
                    </span>
                  </div>
                </>
              )}

              <div className="flex justify-between pt-1 border-t border-[#1C242D] text-[10px] text-slate-500">
                <span>Timestamp (IST):</span>
                <span>{formatToIST(activeToast.timestamp)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

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
              {hasActivePosition ? `🔥 POSITION ACTIVE: ${activeSymbol}` : "🟢 24/7 SCANNING: WAITING FOR BREAKOUT"}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Active Capital: <strong className="text-white">₹{(telemetry?.active_equity ?? 10000).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> | Vault: <strong className="text-[#97CEB4]">₹{(telemetry?.vault_balance || 0).toLocaleString("en-IN")}</strong> | Kelly Floor: <strong className="text-slate-300">₹{(telemetry?.kelly?.protected_floor ?? 7500).toLocaleString("en-IN")}</strong> | Target: <strong className="text-amber-300">₹20,000 (2x Siphon)</strong>
          </p>
        </div>

        {/* Tab Switcher & System Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Navigation Tabs */}
          <div className="flex items-center bg-[#0B0F12] border border-[#1C242D] p-0.5">
            <button
              onClick={() => setActiveTab("command")}
              className={`px-3 py-1.5 text-xs font-bold transition-all ${
                activeTab === "command"
                  ? "bg-[#97CEB4] text-[#0B0F12]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              📊 LIVE COMMAND CENTER
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-3 py-1.5 text-xs font-bold transition-all ${
                activeTab === "history"
                  ? "bg-[#97CEB4] text-[#0B0F12]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              📜 AUDITED TRADE HISTORY ({telemetry?.total_trades || telemetry?.trade_history?.length || 0})
            </button>
          </div>

          {/* Mode Switch */}
          <button
            onClick={toggleMode}
            className="px-3 py-1.5 text-xs font-bold border border-[#1C242D] bg-[#0B0F12] text-slate-300 hover:text-white"
          >
            MODE: {telemetry?.mode || "PAPER"}
          </button>

          {/* Emergency Kill Switch */}
          <button
            onClick={triggerKillSwitch}
            className="px-3 py-1.5 text-xs font-bold bg-[#FF0055] hover:bg-[#e0004c] text-white transition-all"
            title="Emergency Stop: Close active campaign at market price"
          >
            EMERGENCY FLATTEN
          </button>
        </div>
      </header>

      {/* Autonomous System Banner */}
      <div className="bg-[#11161B]/80 border border-[#1C242D] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-300">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#97CEB4] shrink-0"></span>
          <span><strong>100% REAL MARKET EXECUTION:</strong> Zero manual trading or artificial simulation. The engine autonomously evaluates 10 Binance USD-M futures markets 24/7. When compression conditions release with institutional volume and momentum, trades enter and scale automatically.</span>
        </div>
        <div className="text-slate-400 text-[11px] shrink-0">
          Allocation: 20% / Trade (₹2,000) • Max Risk: 2% (₹200)
        </div>
      </div>

      {/* TAB 1: Live Command Center */}
      {activeTab === "command" && (
        <div className="space-y-4">
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
        </div>
      )}

      {/* TAB 2: Audited Trade History (IST) */}
      {activeTab === "history" && (
        <TradeHistory
          trades={telemetry?.trade_history || []}
          activeEquity={telemetry?.active_equity ?? 10000}
          startingCapital={10000}
        />
      )}
    </main>
  );
}
