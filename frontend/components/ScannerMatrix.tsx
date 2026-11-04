"use client";
import React from "react";

export interface AssetSignal {
  symbol: string;
  price: number;
  atr_14: number;
  compression_ratio: number;
  squeeze_on: boolean;
  squeeze_bars_last_10: number;
  ema_100_slope: number;
  rvol: number;
  roc5: number;
  regime: string;
  signal_valid: boolean;
}

export default function ScannerMatrix({
  assets,
  selectedSymbol,
  onSelectSymbol,
}: {
  assets: AssetSignal[];
  selectedSymbol: string;
  onSelectSymbol: (sym: string) => void;
}) {
  return (
    <div className="bg-[#11161B] border border-[#1C242D] p-4 font-mono tabular-nums">
      <div className="flex flex-wrap items-center justify-between mb-3 pb-2 border-b border-[#1C242D] gap-2">
        <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
          01 // 10-ASSET LIVE SQUEEZE MATRIX (15M CCXT BINANCE)
        </span>
        <span className="text-[11px] text-[#97CEB4]">
          CRITERIA: BB(20, 2.0σ) ⊂ KC(20, 1.5×ATR) | RVOL &gt; 1.75x | ROC5 &gt; 1.2% | EMA-100 &gt; 0
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-slate-400 border-b border-[#1C242D]">
              <th className="py-2">ASSET</th>
              <th className="py-2 text-right">PRICE</th>
              <th className="py-2 text-right">BB/KC RATIO</th>
              <th className="py-2 text-center">COIL (10B)</th>
              <th className="py-2 text-right">EMA-100 SLOPE</th>
              <th className="py-2">RVOL METER</th>
              <th className="py-2 text-right">ROC5</th>
              <th className="py-2 text-right">AUTONOMOUS STATUS</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => {
              const rvolPct = Math.min(100, Math.round((a.rvol / 3.0) * 100));
              const isSelected = a.symbol === selectedSymbol;
              return (
                <tr
                  key={a.symbol}
                  onClick={() => onSelectSymbol(a.symbol)}
                  className={`border-b border-[#1C242D] cursor-pointer transition-colors ${
                    isSelected ? "bg-[#17212B]" : "hover:bg-[#141B22]"
                  }`}
                >
                  <td className="py-2.5 font-bold text-white flex items-center gap-2">
                    {a.signal_valid && (
                      <span className="w-2 h-2 rounded-full bg-[#97CEB4] animate-ping" />
                    )}
                    {a.symbol}
                  </td>
                  <td className="py-2.5 text-right font-medium">
                    ${a.price < 1 ? a.price.toFixed(4) : a.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 text-right text-slate-300">
                    {a.compression_ratio.toFixed(2)}x
                  </td>
                  <td className="py-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 text-[10px] border ${
                        a.squeeze_on
                          ? "border-[#97CEB4] text-[#97CEB4] bg-[#97CEB4]/10"
                          : "border-[#1C242D] text-slate-400"
                      }`}
                    >
                      {a.squeeze_on ? `COILED (${a.squeeze_bars_last_10}/10)` : "RELEASED"}
                    </span>
                  </td>
                  <td
                    className={`py-2.5 text-right ${
                      a.ema_100_slope > 0.001
                        ? "text-[#97CEB4]"
                        : a.ema_100_slope < -0.001
                        ? "text-[#FF0055]"
                        : "text-slate-400"
                    }`}
                  >
                    {(a.ema_100_slope * 100).toFixed(3)}%
                  </td>
                  <td className="py-2.5 w-36">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-[#0B0F12] border border-[#1C242D]">
                        <div
                          className={`h-full ${
                            a.rvol >= 1.75 ? "bg-[#97CEB4]" : "bg-slate-600"
                          }`}
                          style={{ width: `${rvolPct}%` }}
                        />
                      </div>
                      <span className="text-[11px]">{a.rvol.toFixed(2)}x</span>
                    </div>
                  </td>
                  <td
                    className={`py-2.5 text-right ${
                      a.roc5 >= 0.012
                        ? "text-[#97CEB4]"
                        : a.roc5 <= -0.012
                        ? "text-[#FF0055]"
                        : "text-slate-400"
                    }`}
                  >
                    {(a.roc5 * 100).toFixed(2)}%
                  </td>
                  <td className="py-2.5 text-right">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold ${
                        a.signal_valid
                          ? "bg-[#97CEB4] text-[#0B0F12] animate-pulse"
                          : a.squeeze_on
                          ? "border border-[#97CEB4]/40 text-[#97CEB4]"
                          : "border border-[#1C242D] text-slate-400"
                      }`}
                    >
                      {a.signal_valid
                        ? "⚡ AUTO-IGNITING T1"
                        : a.squeeze_on
                        ? "⏳ COILING (WAITING)"
                        : "IDLE"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
