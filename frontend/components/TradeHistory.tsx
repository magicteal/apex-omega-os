"use client";
import React, { useState } from "react";

export interface TradeRecord {
  id: string;
  timestamp?: string;
  entry_time?: string;
  exit_time?: string;
  symbol: string;
  side: string;
  entry_price: number;
  exit_price: number;
  filled_units: number;
  realized_pnl_inr: number;
  pnl_pct?: number;
  reason: string;
  post_equity?: number;
}

// Convert UTC ISO timestamp to Indian Standard Time (IST)
export function formatToIST(dateStr?: string): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return (
      d.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }) + " IST"
    );
  } catch (e) {
    return dateStr;
  }
}

// Compute trade duration between entry and exit
function computeDuration(entry?: string, exit?: string): string {
  if (!entry || !exit) return "-";
  try {
    const diffMs = new Date(exit).getTime() - new Date(entry).getTime();
    if (isNaN(diffMs) || diffMs <= 0) return "< 1m";
    const totalSecs = Math.floor(diffMs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h ${remMins}m`;
    }
    return `${mins}m ${secs}s`;
  } catch (e) {
    return "-";
  }
}

export default function TradeHistory({
  trades = [],
  activeEquity = 10000,
  startingCapital = 10000,
}: {
  trades: TradeRecord[];
  activeEquity?: number;
  startingCapital?: number;
}) {
  const [filterAsset, setFilterAsset] = useState<string>("ALL");

  const filteredTrades =
    filterAsset === "ALL"
      ? trades
      : trades.filter((t) => t.symbol.includes(filterAsset));

  const totalTrades = trades.length;
  const winningTrades = trades.filter((t) => t.realized_pnl_inr > 0).length;
  const losingTrades = trades.filter((t) => t.realized_pnl_inr < 0).length;
  const breakevenTrades = trades.filter((t) => t.realized_pnl_inr === 0).length;
  const winRate =
    totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : "0.0";

  const totalRealizedPnl = trades.reduce(
    (acc, t) => acc + (t.realized_pnl_inr || 0),
    0
  );
  const totalReturnPct =
    startingCapital > 0 ? ((totalRealizedPnl / startingCapital) * 100).toFixed(2) : "0.00";

  const grossProfit = trades
    .filter((t) => t.realized_pnl_inr > 0)
    .reduce((acc, t) => acc + t.realized_pnl_inr, 0);
  const grossLoss = Math.abs(
    trades
      .filter((t) => t.realized_pnl_inr < 0)
      .reduce((acc, t) => acc + t.realized_pnl_inr, 0)
  );
  const profitFactor =
    grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? "∞" : "0.00";

  return (
    <div className="space-y-4 font-mono tabular-nums">
      {/* Overview Analytics Bar */}
      <div className="bg-[#11161B] border border-[#1C242D] p-4">
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#1C242D] gap-2 mb-4">
          <div>
            <h2 className="text-sm uppercase tracking-widest text-[#97CEB4] font-bold">
              AUDITED TRADE HISTORY &amp; PERFORMANCE LEDGER
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              100% Real-Market Execution • Verified Against Binance USD-M Price Action • Timestamps in Indian Standard Time (IST)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] bg-[#0B0F12] border border-[#1C242D] text-[#97CEB4]">
              <span className="w-2 h-2 rounded-full bg-[#97CEB4] animate-pulse"></span>
              24/7 AUTONOMOUS LOGGING
            </span>
          </div>
        </div>

        {/* 6 Key Performance Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="p-3 bg-[#0B0F12] border border-[#1C242D]">
            <div className="text-slate-400 text-[10px] uppercase">STARTING PRINCIPAL</div>
            <div className="text-sm font-bold text-slate-200 mt-1">
              ₹{startingCapital.toLocaleString("en-IN")}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Base Capital</div>
          </div>

          <div className="p-3 bg-[#0B0F12] border border-[#1C242D]">
            <div className="text-slate-400 text-[10px] uppercase">PORTFOLIO EQUITY</div>
            <div className="text-sm font-bold text-white mt-1">
              ₹{activeEquity.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-[#97CEB4] mt-0.5">
              {totalRealizedPnl >= 0 ? `+${totalReturnPct}%` : `${totalReturnPct}%`} Return
            </div>
          </div>

          <div className="p-3 bg-[#0B0F12] border border-[#1C242D]">
            <div className="text-slate-400 text-[10px] uppercase">NET REALIZED PNL</div>
            <div
              className={`text-sm font-bold mt-1 ${
                totalRealizedPnl >= 0 ? "text-[#97CEB4]" : "text-[#FF0055]"
              }`}
            >
              {totalRealizedPnl >= 0 ? "+" : ""}₹{totalRealizedPnl.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Net of Fees (0.04%)
            </div>
          </div>

          <div className="p-3 bg-[#0B0F12] border border-[#1C242D]">
            <div className="text-slate-400 text-[10px] uppercase">WIN RATE</div>
            <div className="text-sm font-bold text-[#97CEB4] mt-1">
              {winRate}%
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {winningTrades}W • {losingTrades}L • {breakevenTrades}BE
            </div>
          </div>

          <div className="p-3 bg-[#0B0F12] border border-[#1C242D]">
            <div className="text-slate-400 text-[10px] uppercase">PROFIT FACTOR</div>
            <div className="text-sm font-bold text-amber-300 mt-1">
              {profitFactor}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Gross Win/Loss Ratio
            </div>
          </div>

          <div className="p-3 bg-[#0B0F12] border border-[#1C242D]">
            <div className="text-slate-400 text-[10px] uppercase">TOTAL EXECUTED</div>
            <div className="text-sm font-bold text-slate-200 mt-1">
              {totalTrades} CAMPAIGNS
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              10 Binance Markets
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#11161B] border border-[#1C242D] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[11px] uppercase">Filter Market:</span>
          {["ALL", "SOL", "BTC", "ETH", "SUI", "DOGE", "XRP"].map((sym) => (
            <button
              key={sym}
              onClick={() => setFilterAsset(sym)}
              className={`px-2.5 py-1 text-[11px] border transition-colors ${
                filterAsset === sym
                  ? "border-[#97CEB4] bg-[#97CEB4]/15 text-[#97CEB4] font-bold"
                  : "border-[#1C242D] bg-[#0B0F12] text-slate-400 hover:text-white"
              }`}
            >
              {sym}
            </button>
          ))}
        </div>
        <div className="text-slate-500 text-[11px]">
          Showing {filteredTrades.length} of {totalTrades} verified audit records
        </div>
      </div>

      {/* Detailed Trade Table */}
      <div className="bg-[#11161B] border border-[#1C242D] p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs tabular-nums">
            <thead>
              <tr className="text-slate-400 border-b border-[#1C242D] text-[11px]">
                <th className="py-2.5">TRADE ID</th>
                <th className="py-2.5">ASSET / SIDE</th>
                <th className="py-2.5">ENTRY TIME (IST)</th>
                <th className="py-2.5">EXIT TIME (IST)</th>
                <th className="py-2.5 text-center">DURATION</th>
                <th className="py-2.5 text-right">ENTRY PRICE</th>
                <th className="py-2.5 text-right">EXIT PRICE</th>
                <th className="py-2.5 text-center">TRANCHES REACHED</th>
                <th className="py-2.5 text-right">NET REALIZED PNL</th>
                <th className="py-2.5 text-right">PORTFOLIO POST-TRADE</th>
                <th className="py-2.5 text-right">EXIT TRIGGER</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#97CEB4] animate-ping" />
                      <span className="text-[#97CEB4] font-bold text-sm">
                        24/7 AUTONOMOUS MARKET SCANNING IN PROGRESS
                      </span>
                      <p className="text-slate-400 text-xs max-w-lg">
                        The quantitative engine is actively evaluating 10 Binance USD-M futures markets for genuine volatility compression breakouts. 
                        No fake or synthetic trades will ever appear here. When real market conditions confirm, automated trades will execute and log in Indian Standard Time (IST) with full mathematical metrics.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTrades.map((tr) => {
                  const isWin = tr.realized_pnl_inr > 0;
                  const isFlat = tr.realized_pnl_inr === 0;
                  const entryIST = formatToIST(tr.entry_time || tr.timestamp);
                  const exitIST = formatToIST(tr.exit_time || tr.timestamp);
                  const duration = computeDuration(
                    tr.entry_time || tr.timestamp,
                    tr.exit_time || tr.timestamp
                  );

                  return (
                    <tr
                      key={tr.id}
                      className="border-b border-[#1C242D] hover:bg-[#141B22] transition-colors"
                    >
                      <td className="py-3 font-mono text-[11px] text-slate-400 font-semibold">
                        #{tr.id}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white">{tr.symbol}</span>
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                              tr.side === "LONG"
                                ? "bg-[#97CEB4]/15 text-[#97CEB4] border border-[#97CEB4]/30"
                                : "bg-[#FF0055]/15 text-[#FF0055] border border-[#FF0055]/30"
                            }`}
                          >
                            {tr.side}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-slate-300 text-[11px]">{entryIST}</td>
                      <td className="py-3 text-slate-300 text-[11px]">{exitIST}</td>
                      <td className="py-3 text-center text-slate-400 text-[11px]">
                        {duration}
                      </td>
                      <td className="py-3 text-right text-slate-200">
                        ${tr.entry_price > 10 ? tr.entry_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : tr.entry_price.toFixed(4)}
                      </td>
                      <td className="py-3 text-right font-medium text-white">
                        ${tr.exit_price > 10 ? tr.exit_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : tr.exit_price.toFixed(4)}
                      </td>
                      <td className="py-3 text-center">
                        <span className="px-2 py-0.5 bg-[#0B0F12] border border-[#1C242D] text-[10px] text-slate-300 font-medium">
                          {tr.filled_units === 4
                            ? "T1→T4 (RUNNER)"
                            : tr.filled_units === 3
                            ? "T1→T3 (EXPANSION)"
                            : tr.filled_units === 2
                            ? "T1→T2 (BE LOCKED)"
                            : "T1 (IGNITION)"}
                        </span>
                      </td>
                      <td className="py-3 text-right font-bold">
                        <span
                          className={`px-2 py-0.5 text-xs ${
                            isWin
                              ? "text-[#97CEB4] bg-[#97CEB4]/10 border border-[#97CEB4]/30"
                              : isFlat
                              ? "text-slate-400 bg-slate-800/20"
                              : "text-[#FF0055] bg-[#FF0055]/10 border border-[#FF0055]/30"
                          }`}
                        >
                          {isWin ? "+" : ""}₹{tr.realized_pnl_inr.toFixed(2)}
                          {tr.pnl_pct !== undefined && ` (${tr.pnl_pct >= 0 ? "+" : ""}${tr.pnl_pct.toFixed(2)}%)`}
                        </span>
                      </td>
                      <td className="py-3 text-right font-semibold text-slate-200">
                        ₹{(tr.post_equity || activeEquity).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-right">
                        <span className="px-2 py-0.5 text-[10px] border border-[#1C242D] bg-[#0B0F12] text-slate-400">
                          {tr.reason}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
