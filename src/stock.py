import pandas as pd
import numpy as np
import time
import gc
from datetime import datetime, timedelta

try:
    import akshare as ak
except ImportError:
    ak = None

# -------------------- 辅助函数 --------------------
def SMA(series, n, m):
    """通达信SMA加权移动平均：SMA = (M*X + (N-M)*前SMA)/N"""
    result = np.full(len(series), np.nan)
    arr = series.values
    if len(arr) < n:
        return pd.Series(result, index=series.index)
    # 第一个有效值用前n个简单平均
    result[n-1] = np.mean(arr[:n])
    for i in range(n, len(arr)):
        result[i] = (m * arr[i] + (n - m) * result[i-1]) / n
    return pd.Series(result, index=series.index)

def cross(series, threshold):
    """上穿阈值（常数）"""
    prev = series.shift(1)
    return (series > threshold) & (prev <= threshold)

def filter_signal(signal, n):
    """信号过滤：信号出现后n天内不再产生新信号"""
    filtered = signal.copy()
    last_true = -n-1
    for i in range(len(signal)):
        if signal.iloc[i]:
            if i - last_true > n:
                filtered.iloc[i] = True
                last_true = i
            else:
                filtered.iloc[i] = False
    return filtered

# -------------------- 指标计算 --------------------
def calculate_signals(df):
    """输入df需包含: open,high,low,close,volume，返回带buy_signal列的df"""
    df = df.copy()
    
    # 基础变量
    df['起爆点0'] = (df['close'] - df['close'].shift(1)) / df['close'].shift(1) * 100
    
    # 均线
    df['MA6'] = df['close'].rolling(6).mean()
    df['MA12'] = df['close'].rolling(12).mean()
    df['MA18'] = df['close'].rolling(18).mean()
    
    # YY条件
    df['YY1'] = (df['open'] < df['MA6']) & (df['close'] > df['MA6'])
    df['YY2'] = (df['open'] < df['MA12']) & (df['close'] > df['MA12'])
    df['YY3'] = (df['open'] < df['MA18']) & (df['close'] > df['MA18'])
    df['YY4'] = (df['close'] / df['open']) >= 1.02
    df['YY5'] = df['volume'] > df['volume'].rolling(10).max().shift(1)  # 放量突破前10日最大
    df['YY6'] = df['MA6'] >= df['MA6'].shift(1)
    df['YYY'] = df['YY1'] & df['YY2'] & df['YY3'] & df['YY4'] & df['YY5'] & df['YY6']
    
    # VAR0/VAR4 (60日周期)
    min_low_60 = df['low'].rolling(60).min()
    max_high_60 = df['high'].rolling(60).max()
    df['VAR0'] = (df['close'] - min_low_60) / (max_high_60 - min_low_60) * 100
    df['VAR3'] = SMA(df['VAR0'], 3, 1)
    df['VAR4'] = (max_high_60 - df['close']) / (max_high_60 - min_low_60) * 100
    df['VAR5'] = SMA(df['VAR4'], 3, 1)
    
    # 起爆点相关
    df['VAR02'] = df['low'].shift(1)
    up_move = np.maximum(df['low'] - df['VAR02'], 0)
    abs_move = np.abs(df['low'] - df['VAR02'])
    sma_up = SMA(up_move, 13, 1)
    sma_abs = SMA(abs_move, 13, 1)
    df['VAR03'] = sma_abs / sma_up * 100
    df['VAR03'] = df['VAR03'].replace([np.inf, -np.inf], np.nan)
    df['VAR04'] = (df['VAR03'] * 13).ewm(span=13, adjust=False).mean()
    df['VAR05'] = df['low'].rolling(34).min()
    df['VAR6'] = df['VAR04'].rolling(34).max()
    # VAR7默认1
    temp = (df['VAR4'] + df['VAR6'] * 2) / 2
    df['VAR8'] = np.where(df['low'] <= df['VAR05'], temp, 0)
    df['VAR8'] = df['VAR8'].ewm(span=3, adjust=False).mean() / 618
    df['AA'] = df['VAR8'] > df['VAR8'].shift(1)
    
    df['DJ'] = df['low'].rolling(100).min().shift(3)
    df['XG0'] = df['low'] == df['DJ']
    df['XGA'] = df['AA'] & df['XG0']
    xga = df['XGA'].fillna(False)
    df['XG1'] = xga & ~xga.shift(1).fillna(False)
    xg1 = df['XG1'].fillna(False)
    df['起爆点_raw'] = xg1 & ~xg1.shift(1).fillna(False)
    df['起爆点'] = filter_signal(df['起爆点_raw'], 5)
    
    # 启动点 XXG
    df['XXG'] = cross(df['起爆点0'], 20) | cross(df['起爆点0'], 18)
    
    # 启爆器 E
    df['AQ1'] = df['volume'].shift(1)
    df['AQ2'] = df['volume']
    df['AQ3'] = df['AQ2'] / df['AQ1']
    df['LNX'] = df['AQ3'] - df['AQ3'].shift(1)
    df['E1'] = df['close'].shift(1)
    df['E2'] = df['close']
    df['E3'] = (df['E2'] - df['E1']) / df['E1'] * 100
    df['QMX'] = df['E3'] - df['E3'].shift(1)
    df['E'] = cross(df['LNX'], 500) & cross(df['QMX'], 10)
    
    # 最终买入信号（NaN 视为 False，避免漏单）
    df['buy_signal'] = (df['起爆点'].fillna(False) | df['YYY'].fillna(False) |
                        df['XXG'].fillna(False) | df['E'].fillna(False))
    # 信号强度：4 个子条件中满足的个数（用于排序，0-4）
    df['signal_strength'] = (df['起爆点'].fillna(False).astype(int) + df['YYY'].fillna(False).astype(int) +
                             df['XXG'].fillna(False).astype(int) + df['E'].fillna(False).astype(int))
    return df

# -------------------- 数据获取（akshare）--------------------
MIN_BARS = 30   # 至少需要约一年日线用于指标计算
STOCK_SCAN_LIMIT = 300000    # 每次扫描的股票数量上限
TOP_N = 10
HOLD_DAYS = 2    # 推荐买入后建议持有天数（预测未来 HOLD_DAYS 日）
TRADE_DAYS_LOOKBACK = 200  # 约两年日线

def get_stock_list(limit=None):
    """获取 A 股代码列表，返回 [(code, name), ...]。若 limit 不为 None 则只取前 limit 只。"""
    if ak is None:
        raise RuntimeError("请安装 akshare: pip install akshare")
    df = ak.stock_info_a_code_name()
    # 代码统一为 6 位，去掉 .SH/.SZ 等后缀
    codes = [str(c).split(".")[0].zfill(6) for c in df["code"]]
    names = df["name"].astype(str).tolist()
    rows = list(zip(codes, names))
    if limit is not None:
        rows = rows[:limit]
    return rows

def fetch_daily_data(symbol, start_date=None, end_date=None):
    """
    获取单只股票日线。symbol 为 6 位代码（如 '000001'）。
    返回 DataFrame，列名: open, high, low, close, volume，索引为日期。
    数据不足或失败返回 None。
    """
    if ak is None:
        return None
    if end_date is None:
        end_date = datetime.now().strftime("%Y%m%d")
    if start_date is None:
        start_dt = datetime.now() - timedelta(days=TRADE_DAYS_LOOKBACK * 2)
        start_date = start_dt.strftime("%Y%m%d")
    try:
        df = ak.stock_zh_a_hist(symbol=symbol, period="daily", start_date=start_date, end_date=end_date, adjust="")
        if df is None or len(df) < MIN_BARS:
            return None
        # 列名映射：akshare 返回 日期、开盘、收盘、最高、最低、成交量
        df = df.rename(columns={
            "日期": "date",
            "开盘": "open",
            "收盘": "close",
            "最高": "high",
            "最低": "low",
            "成交量": "volume",
        })
        df = df[["date", "open", "high", "low", "close", "volume"]].copy()
        df["date"] = pd.to_datetime(df["date"])
        df = df.set_index("date").sort_index()
        df = df.astype({"open": float, "high": float, "low": float, "close": float, "volume": float})
        return df
    except Exception:
        return None

def run_single_predict(symbol, name, hold_days=5):
    """
    对单只股票拉取数据、计算信号，判断当前是否有买入信号及信号强度。
    返回 (symbol, name, current_buy_signal, signal_strength) 或 None。
    """
    df = fetch_daily_data(symbol)
    if df is None or len(df) < MIN_BARS:
        return None
    try:
        df = calculate_signals(df)
    except Exception:
        return None
    last = df.iloc[-1]
    current_buy_signal = bool(last["buy_signal"]) if pd.notna(last["buy_signal"]) else False
    signal_strength = int(last["signal_strength"]) if pd.notna(last["signal_strength"]) else 0
    return (symbol, name, current_buy_signal, signal_strength, hold_days)

def get_top10_recommendations(limit=STOCK_SCAN_LIMIT, hold_days=None):
    """
    仅做预测：获取当前出现买入信号、并建议持有未来 hold_days 天的前 10 只股票。
    按信号强度（满足子条件个数）排序。
    每只元素为 dict: code, name, hold_days, signal_strength。
    """
    if hold_days is None:
        hold_days = HOLD_DAYS
    stock_list = get_stock_list(limit=limit)
    results = []
    for i, (code, name) in enumerate(stock_list):
        if (i + 1) % 50 == 0:
            print(f"  预测扫描进度: {i + 1}/{len(stock_list)}")
            gc.collect()
        r = run_single_predict(code, name, hold_days=hold_days)
        if r is None:
            continue
        symbol, name, current_buy_signal, signal_strength, hd = r
        if not current_buy_signal:
            continue
        results.append({"code": symbol, "name": name, "hold_days": hd, "signal_strength": signal_strength})
        time.sleep(0.2)
        if (i + 1) % 100 == 0:
            time.sleep(1.5)
    if not results:
        return []
    results.sort(key=lambda x: x["signal_strength"], reverse=True)
    return results[:TOP_N]

def print_top10(top_list, hold_days=None):
    """打印前 10 推荐结果。"""
    if hold_days is None:
        hold_days = HOLD_DAYS
    if not top_list:
        print("暂无推荐结果（当前无符合买入信号的标的）。")
        return
    print(f"\n========== 当前建议买入 · 预测持有 {hold_days} 天 · 前 10 推荐（按信号强度）==========")
    for i, row in enumerate(top_list, 1):
        hd = row.get("hold_days", hold_days)
        ss = row.get("signal_strength", 0)
        print(f"  {i}. {row['code']} {row['name']} | 信号强度: {ss}/4 | 建议持有: {hd} 天")

def run_once():
    """执行一次：拉数据、预测、输出前 10。"""
    print(f"[{datetime.now().isoformat()}] 开始获取 A 股数据并预测...")
    top = get_top10_recommendations(limit=STOCK_SCAN_LIMIT)
    print_top10(top)
    print(f"[{datetime.now().isoformat()}] 本轮完成。")
    return top

def run_every_hour():
    """每隔一小时执行一次 run_once。"""
    try:
        import schedule
    except ImportError:
        print("请安装 schedule: pip install schedule")
        return
    run_once()
    schedule.every(1).hours.do(run_once)
    while True:
        schedule.run_pending()
        time.sleep(60)

# -------------------- 使用示例 --------------------
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--once":
        run_once()
    else:
        run_every_hour()