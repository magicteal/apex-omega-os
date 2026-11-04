"""
APEX-OMEGA OS — TTM Volatility Squeeze + EMA-100 Slope + RVOL + ROC5 Engine
Mathematical Rules (V2):
- Bollinger Bands (20, 2.0 sigma) inside Keltner Channels (20, 1.5x ATR) within last 10 bars
- EMA-100 slope alignment (> 0.001 for Long, < -0.001 for Short)
- RVOL > 1.75 (20-period volume ratio)
- ROC5 > 0.012 (+1.2% for Long, < -0.012 for Short)
"""
from dataclasses import dataclass, asdict
from typing import List, Dict, Any
import math
import numpy as np


@dataclass
class SqueezeSignal:
    symbol: str
    price: float
    atr_14: float
    bb_upper: float
    bb_lower: float
    kc_upper: float
    kc_lower: float
    compression_ratio: float
    squeeze_on: bool
    squeeze_bars_last_10: int
    ema_100: float
    ema_100_slope: float
    rvol: float
    roc5: float
    regime: str        # "LONG_IGNITION", "SHORT_IGNITION", "COILING", "NEUTRAL"
    signal_valid: bool

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class SqueezeEngine:
    def __init__(
        self,
        bb_period: int = 20,
        bb_std: float = 2.0,
        kc_period: int = 20,
        kc_atr_mult: float = 1.5,
        ema_period: int = 100,
        rvol_threshold: float = 1.75,
        roc5_threshold: float = 0.012,
        slope_threshold: float = 0.001,
    ):
        self.bb_period = bb_period
        self.bb_std = bb_std
        self.kc_period = kc_period
        self.kc_atr_mult = kc_atr_mult
        self.ema_period = ema_period
        self.rvol_threshold = rvol_threshold
        self.roc5_threshold = roc5_threshold
        self.slope_threshold = slope_threshold

    @staticmethod
    def _ema(values: np.ndarray, span: int) -> np.ndarray:
        alpha = 2.0 / (span + 1.0)
        ema = np.zeros_like(values, dtype=float)
        ema[0] = values[0]
        for i in range(1, len(values)):
            ema[i] = alpha * values[i] + (1.0 - alpha) * ema[i - 1]
        return ema

    @staticmethod
    def _atr(high: np.ndarray, low: np.ndarray, close: np.ndarray, period: int = 14) -> np.ndarray:
        tr = np.zeros_like(close, dtype=float)
        tr[0] = high[0] - low[0]
        for i in range(1, len(close)):
            hl = high[i] - low[i]
            hc = abs(high[i] - close[i - 1])
            lc = abs(low[i] - close[i - 1])
            tr[i] = max(hl, hc, lc)
        return SqueezeEngine._ema(tr, period)

    def evaluate_ohlcv(self, symbol: str, ohlcv: List[List[float]]) -> SqueezeSignal:
        """
        ohlcv: list of [timestamp, open, high, low, close, volume], length >= 110
        """
        arr = np.array(ohlcv, dtype=float)
        high = arr[:, 2]
        low = arr[:, 3]
        close = arr[:, 4]
        volume = arr[:, 5]

        atr_series = self._atr(high, low, close, period=20)
        atr_14_series = self._atr(high, low, close, period=14)
        ema_100_series = self._ema(close, self.ema_period)

        # Rolling 20-bar BB & KC over the last 10 bars to check TTM Squeeze condition
        squeeze_count = 0
        n = len(close)
        current_bb_u = current_bb_l = current_kc_u = current_kc_l = 0.0
        current_comp = 1.0
        squeeze_now = False

        for offset in range(9, -1, -1):
            idx = n - 1 - offset
            win = close[max(0, idx - self.bb_period + 1) : idx + 1]
            sma = float(np.mean(win))
            std = float(np.std(win))
            bb_u = sma + self.bb_std * std
            bb_l = sma - self.bb_std * std

            kc_mid = float(self._ema(close[: idx + 1], self.kc_period)[-1])
            kc_atr = float(atr_series[idx])
            kc_u = kc_mid + self.kc_atr_mult * kc_atr
            kc_l = kc_mid - self.kc_atr_mult * kc_atr

            in_squeeze = (bb_u < kc_u) and (bb_l > kc_l)
            if in_squeeze:
                squeeze_count += 1
            if offset == 0:
                current_bb_u, current_bb_l = bb_u, bb_l
                current_kc_u, current_kc_l = kc_u, kc_l
                kc_width = max(kc_u - kc_l, 1e-9)
                current_comp = round((bb_u - bb_l) / kc_width, 4)
                squeeze_now = in_squeeze

        # EMA-100 normalized 5-bar slope
        ema_now = float(ema_100_series[-1])
        ema_prev = float(ema_100_series[-6]) if len(ema_100_series) >= 6 else float(ema_100_series[0])
        ema_slope = (ema_now - ema_prev) / max(ema_prev, 1e-9)

        # Relative Volume (20-bar average prior to current bar)
        vol_mean = float(np.mean(volume[-21:-1])) if len(volume) >= 21 else float(np.mean(volume))
        rvol = float(volume[-1]) / max(vol_mean, 1e-9)

        # 5-bar Rate of Change (ROC5)
        close_5 = float(close[-6]) if len(close) >= 6 else float(close[0])
        roc5 = (float(close[-1]) - close_5) / max(close_5, 1e-9)

        had_recent_squeeze = squeeze_count >= 1
        long_aligned = (
            had_recent_squeeze
            and ema_slope > self.slope_threshold
            and rvol > self.rvol_threshold
            and roc5 > self.roc5_threshold
        )
        short_aligned = (
            had_recent_squeeze
            and ema_slope < -self.slope_threshold
            and rvol > self.rvol_threshold
            and roc5 < -self.roc5_threshold
        )

        if long_aligned:
            regime = "LONG_IGNITION"
        elif short_aligned:
            regime = "SHORT_IGNITION"
        elif squeeze_now or had_recent_squeeze:
            regime = "COILING"
        else:
            regime = "NEUTRAL"

        return SqueezeSignal(
            symbol=symbol,
            price=round(float(close[-1]), 4),
            atr_14=round(float(atr_14_series[-1]), 4),
            bb_upper=round(current_bb_u, 4),
            bb_lower=round(current_bb_l, 4),
            kc_upper=round(current_kc_u, 4),
            kc_lower=round(current_kc_l, 4),
            compression_ratio=current_comp,
            squeeze_on=bool(squeeze_now),
            squeeze_bars_last_10=int(squeeze_count),
            ema_100=round(ema_now, 4),
            ema_100_slope=round(ema_slope, 6),
            rvol=round(rvol, 2),
            roc5=round(roc5, 5),
            regime=regime,
            signal_valid=bool(long_aligned or short_aligned),
        )
