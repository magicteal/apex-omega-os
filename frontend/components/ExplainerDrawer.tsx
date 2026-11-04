'use client';

import React from 'react';
import { X, ShieldCheck, Zap, Layers, Vault, ArrowRight, HelpCircle, CheckCircle2, TrendingUp, Lock } from 'lucide-react';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartDemo?: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose, onStartDemo }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface border border-border rounded-xl max-w-3xl w-full p-6 md:p-8 shadow-2xl relative text-text font-sans max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-text-dim hover:text-text hover:bg-border/50 rounded-full transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title & Badge */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-accent/15 border border-accent/40 flex items-center justify-center">
            <HelpCircle className="w-6 h-6 text-accent" />
          </div>
          <div>
            <span className="text-[11px] font-mono font-bold tracking-wider text-accent uppercase">
              Beginner Friendly Guide
            </span>
            <h2 className="text-xl font-bold tracking-tight text-white">
              How APEX-OMEGA OS Protects &amp; Grows Your Money
            </h2>
          </div>
        </div>

        <p className="text-sm text-text-dim leading-relaxed mb-6">
          Trading can feel complicated with math formulas and strange terms. But underneath, this robot follows{' '}
          <strong className="text-white">three simple, battle-tested golden rules</strong> designed so you can never lose your original investment.
        </p>

        {/* 3 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Pillar 1: Spring */}
          <div className="bg-background border border-border rounded-lg p-4 flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded bg-warning/15 border border-warning/30 flex items-center justify-center mb-3">
                <Zap className="w-4 h-4 text-warning" />
              </div>
              <h3 className="font-bold text-sm text-white mb-1">1. The Compressed Spring</h3>
              <p className="text-xs text-text-dim leading-relaxed">
                Like compressing a metal coil, when price moves sideways and volatility drops tightly (the <em>TTM Squeeze</em>), energy builds up. The moment it explodes with high trading volume, the bot buys.
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-border/60 text-[11px] font-mono text-warning">
              Benefit: You only enter when a big move is already starting.
            </div>
          </div>

          {/* Pillar 2: 4-Step Staircase */}
          <div className="bg-background border border-border rounded-lg p-4 flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded bg-accent/15 border border-accent/30 flex items-center justify-center mb-3">
                <Layers className="w-4 h-4 text-accent" />
              </div>
              <h3 className="font-bold text-sm text-white mb-1">2. Zero-Risk Staircase</h3>
              <p className="text-xs text-text-dim leading-relaxed">
                Instead of risking everything at once, the bot starts with a tiny 1-unit trade. As soon as price climbs (+1.2 ATR), it adds unit 2 and <strong>instantly moves your stop-loss above your entry price</strong>!
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-border/60 text-[11px] font-mono text-accent">
              Benefit: After Step 2, you have ZERO risk of losing money.
            </div>
          </div>

          {/* Pillar 3: Cold Vault */}
          <div className="bg-background border border-border rounded-lg p-4 flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded bg-border-focus border border-accent/20 flex items-center justify-center mb-3">
                <Vault className="w-4 h-4 text-accent" />
              </div>
              <h3 className="font-bold text-sm text-white mb-1">3. The Cold Vault Safe</h3>
              <p className="text-xs text-text-dim leading-relaxed">
                You start with ₹10,000. When your account doubles to ₹20,000, your entire original ₹10,000 principal is moved into a <strong>Cold Vault</strong>. It is never risked in trades again.
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-border/60 text-[11px] font-mono text-white">
              Benefit: You play solely with house profits.
            </div>
          </div>
        </div>

        {/* Visual Staircase Walkthrough */}
        <div className="bg-background border border-border rounded-lg p-5 mb-8">
          <h3 className="font-bold text-sm text-white mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent" />
            <span>The 4-Step Trade Lifecycle (Watch how stops protect you)</span>
          </h3>

          <div className="space-y-3 font-mono text-xs">
            {/* Step 1 */}
            <div className="p-3 bg-surface border border-border rounded flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center text-xs">
                  T1
                </span>
                <div>
                  <span className="font-bold text-white">Step 1: Signal Ignition (Starter Position)</span>
                  <p className="text-[11px] text-text-dim font-sans">
                    The bot buys 1 unit. Risk is strictly capped at 6.5% of your active cash.
                  </p>
                </div>
              </div>
              <span className="text-[11px] text-warning font-mono">Small Starter Risk</span>
            </div>

            {/* Step 2 */}
            <div className="p-3 bg-accent-dim/40 border border-accent/40 rounded flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-accent text-background font-bold flex items-center justify-center text-xs">
                  T2
                </span>
                <div>
                  <span className="font-bold text-accent flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    Step 2: Scale-In &amp; Lock Breakeven (+0.2% Fee Floor)
                  </span>
                  <p className="text-[11px] text-text-dim font-sans">
                    Price gained +1.2 ATR! Unit 2 is added. <strong>Stop loss jumps above entry price.</strong> Even if the entire market flash crashes now, you leave with a tiny profit!
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-accent font-mono bg-accent/20 px-2 py-0.5 rounded">
                ZERO RISK LOCKED
              </span>
            </div>

            {/* Step 3 */}
            <div className="p-3 bg-surface border border-border rounded flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center text-xs">
                  T3
                </span>
                <div>
                  <span className="font-bold text-white">Step 3: Profit Escalation</span>
                  <p className="text-[11px] text-text-dim font-sans">
                    Price reached +2.4 ATR. Unit 3 is added using only paper profits. The trailing stop moves up again.
                  </p>
                </div>
              </div>
              <span className="text-[11px] text-accent font-mono">Banked Profits</span>
            </div>

            {/* Step 4 */}
            <div className="p-3 bg-surface border border-border rounded flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center text-xs">
                  T4
                </span>
                <div>
                  <span className="font-bold text-white">Step 4: The Big Wave Runner</span>
                  <p className="text-[11px] text-text-dim font-sans">
                    Maximum position size reached. A dynamic 2.2 ATR Chandelier stop shadows the price, locking in maximum reward until the trend eventually turns around.
                  </p>
                </div>
              </div>
              <span className="text-[11px] text-accent font-mono">Max Multiplier</span>
            </div>
          </div>
        </div>

        {/* Quick Glossary */}
        <div className="mb-8">
          <h3 className="font-bold text-sm text-white mb-3">Quick Cheat-Sheet of Terms</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 bg-background border border-border rounded">
              <span className="font-bold text-accent font-mono block mb-0.5">Active Equity</span>
              <span className="text-text-dim">The money actively working in the market.</span>
            </div>
            <div className="p-2.5 bg-background border border-border rounded">
              <span className="font-bold text-accent font-mono block mb-0.5">Cold Vault</span>
              <span className="text-text-dim">Your bank safe. Money stored here is permanently protected from market drawdowns.</span>
            </div>
            <div className="p-2.5 bg-background border border-border rounded">
              <span className="font-bold text-accent font-mono block mb-0.5">75% High-Water Mark (HWM)</span>
              <span className="text-text-dim">The emergency brake floor. If active cash dips below 75% of your peak profits, trade size automatically drops by 85% to preserve capital.</span>
            </div>
            <div className="p-2.5 bg-background border border-border rounded">
              <span className="font-bold text-accent font-mono block mb-0.5">RVOL (Relative Volume)</span>
              <span className="text-text-dim">How loud the crowd is. &gt; 1.75 means nearly double the normal amount of traders are rushing in.</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border">
          <span className="text-xs text-text-dim">
            Ready to see it in action?
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                onClose();
                if (onStartDemo) onStartDemo();
              }}
              className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-background font-bold text-xs rounded font-mono flex items-center gap-2 shadow-glow-accent transition-all"
            >
              <Zap className="w-4 h-4" />
              <span>Try Live Simulation Spike (+1.2 ATR)</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-background border border-border hover:border-text-dim text-text font-mono text-xs rounded transition-all"
            >
              Got it, Close Guide
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
