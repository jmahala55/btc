from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
import asyncio
import aiohttp
import time

app = FastAPI(title="Bitcoin Investment Simulator API - Multiple Data Sources")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage (in production, use a database)
portfolio_data = {
    "investments": [],
    "total_usd_invested": 0.0,
    "total_btc_owned": 0.0
}

# Enhanced cache system for different data types
price_cache = {"price": None, "timestamp": 0}
historical_cache = {}  # Will store multiple timeframes

class Investment(BaseModel):
    amount_usd: float
    price_per_btc: float
    date: str
    btc_purchased: float

class BuyRequest(BaseModel):
    amount_usd: float
    date: Optional[str] = None

class TimeframeRequest(BaseModel):
    timeframe: str  # "1d", "1w", "1m", "3m", "6m", "1y", "2y", "5y", "max"

# Timeframe configuration - Optimized for rate limits
TIMEFRAME_CONFIG = {
    "1d": {"days": 1, "interval": "hourly", "cache_minutes": 5},
    "1w": {"days": 7, "interval": "hourly", "cache_minutes": 10},
    "1m": {"days": 30, "interval": "daily", "cache_minutes": 30},
    "3m": {"days": 90, "interval": "daily", "cache_minutes": 60},
    "6m": {"days": 180, "interval": "daily", "cache_minutes": 120},
    "1y": {"days": 365, "interval": "daily", "cache_minutes": 240},
    "2y": {"days": 730, "interval": "weekly", "cache_minutes": 480},
    "3y": {"days": 1095, "interval": "weekly", "cache_minutes": 720},
    "5y": {"days": 1825, "interval": "weekly", "cache_minutes": 1440},
    "max": {"days": 1825, "interval": "weekly", "cache_minutes": 1440}  # Reduced to avoid rate limits
}

# Rate limiting state
last_api_call = 0
min_interval_between_calls = 6  # 6 seconds = 10 calls per minute (safe buffer)

def wait_for_rate_limit():
    """Ensure we don't exceed rate limits"""
    global last_api_call
    current_time = time.time()
    time_since_last_call = current_time - last_api_call
    
    if time_since_last_call < min_interval_between_calls:
        wait_time = min_interval_between_calls - time_since_last_call
        print(f"⏳ Rate limiting: waiting {wait_time:.1f} seconds...")
        time.sleep(wait_time)
    
    last_api_call = time.time()

async def get_current_btc_price():
    """Get LIVE BTC price using simple requests - more reliable"""
    current_time = time.time()
    
    # Use cache ONLY if price is less than 30 seconds old
    if price_cache["price"] and (current_time - price_cache["timestamp"]) < 30:
        return price_cache["price"]
    
    print("🔄 Fetching fresh Bitcoin price...")
    wait_for_rate_limit()
    
    # Method 1: Use requests (often more reliable than aiohttp)
    try:
        print("📡 Trying CoinGecko API with requests...")
        response = requests.get(
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true",
            headers={
                "accept": "application/json",
                "User-Agent": "Bitcoin-Investment-Simulator/1.0"
            },
            timeout=10
        )
        
        print(f"📊 Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"📦 Raw data: {data}")
            
            if "bitcoin" in data and "usd" in data["bitcoin"]:
                price = float(data["bitcoin"]["usd"])
                change_24h = float(data["bitcoin"].get("usd_24h_change", 0))
                
                print(f"✅ SUCCESS! Bitcoin price: ${price:,.2f} ({change_24h:+.2f}%)")
                
                # Updated realistic price range for 2025
                if 80000 <= price <= 150000:  # Realistic range for 2025
                    result = {
                        "price": price,
                        "change_24h": change_24h
                    }
                    
                    # Update cache
                    price_cache["price"] = result
                    price_cache["timestamp"] = current_time
                    
                    return result
                else:
                    print(f"⚠️  Price outside expected range: ${price:,.2f}")
            else:
                print(f"❌ Unexpected response format: {data}")
        elif response.status_code == 429:
            print("🚫 Rate limited by CoinGecko")
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Requests error: {str(e)}")
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
    
    # Method 2: Try CoinDesk as backup
    try:
        print("📡 Trying CoinDesk API as backup...")
        response = requests.get(
            "https://api.coindesk.com/v1/bpi/currentprice.json",
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            if "bpi" in data and "USD" in data["bpi"]:
                price_str = data["bpi"]["USD"]["rate"].replace(",", "").replace("$", "")
                price = float(price_str)
                
                print(f"✅ CoinDesk price: ${price:,.2f}")
                
                if 80000 <= price <= 150000:  # Updated range
                    result = {
                        "price": price,
                        "change_24h": 0
                    }
                    
                    price_cache["price"] = result
                    price_cache["timestamp"] = current_time
                    
                    return result
                    
    except Exception as e:
        print(f"❌ CoinDesk failed: {str(e)}")
    
    # Method 3: Try Binance
    try:
        print("📡 Trying Binance API...")
        response = requests.get(
            "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            if "price" in data:
                price = float(data["price"])
                
                print(f"✅ Binance price: ${price:,.2f}")
                
                if 80000 <= price <= 150000:  # Updated range
                    result = {
                        "price": price,
                        "change_24h": 0
                    }
                    
                    price_cache["price"] = result
                    price_cache["timestamp"] = current_time
                    
                    return result
                    
    except Exception as e:
        print(f"❌ Binance failed: {str(e)}")
    
    print("💥 ALL APIs FAILED!")
    raise HTTPException(
        status_code=503, 
        detail="All Bitcoin price APIs are currently unavailable. This might be due to rate limiting or network issues. Please try again in a few minutes."
    )

async def get_historical_btc_data_by_timeframe(timeframe: str):
    """Get historical BTC data with multiple fallback sources"""
    
    if timeframe not in TIMEFRAME_CONFIG:
        raise HTTPException(status_code=400, detail=f"Invalid timeframe. Choose from: {list(TIMEFRAME_CONFIG.keys())}")
    
    config = TIMEFRAME_CONFIG[timeframe]
    current_time = time.time()
    cache_key = timeframe
    
    # Check cache first
    if (cache_key in historical_cache and 
        historical_cache[cache_key]["data"] is not None and 
        (current_time - historical_cache[cache_key]["timestamp"]) < (config["cache_minutes"] * 60)):
        print(f"📊 Using cached data for {timeframe}")
        return historical_cache[cache_key]["data"], config["interval"]
    
    print(f"🔄 Fetching fresh historical data for {timeframe} ({config['days']} days, {config['interval']} interval)...")
    
    # Try Method 1: CoinGecko with rate limiting
    try:
        print("📡 Trying CoinGecko API with rate limiting...")
        wait_for_rate_limit()
        
        url = f"https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days={config['days']}&interval={config['interval']}"
        
        response = requests.get(
            url,
            headers={
                "accept": "application/json",
                "User-Agent": "Bitcoin-Investment-Simulator/1.0"
            },
            timeout=30
        )
        
        print(f"📊 CoinGecko response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"📦 Got {len(data.get('prices', []))} price points from CoinGecko")
            
            if "prices" in data and len(data["prices"]) > 0:
                df = process_historical_data(data["prices"], "CoinGecko")
                if not df.empty:
                    historical_cache[cache_key] = {"data": df, "timestamp": current_time}
                    return df, config["interval"]
        elif response.status_code == 429:
            print("🚫 CoinGecko rate limited, trying alternatives...")
        else:
            print(f"❌ CoinGecko HTTP Error: {response.status_code}")
            
    except Exception as e:
        print(f"❌ CoinGecko error: {str(e)}")
    
    # Try Method 2: CoinCap (alternative free API)
    try:
        print("📡 Trying CoinCap API as alternative...")
        
        # CoinCap uses different timeframe format
        interval_map = {
            "hourly": "h1",
            "daily": "d1", 
            "weekly": "d7"
        }
        
        coincap_interval = interval_map.get(config["interval"], "d1")
        
        # Calculate start and end timestamps
        end_time = datetime.now()
        start_time = end_time - timedelta(days=config["days"])
        
        url = f"https://api.coincap.io/v2/assets/bitcoin/history?interval={coincap_interval}&start={int(start_time.timestamp() * 1000)}&end={int(end_time.timestamp() * 1000)}"
        
        response = requests.get(url, timeout=30)
        print(f"📊 CoinCap response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if "data" in data and len(data["data"]) > 0:
                print(f"📦 Got {len(data['data'])} price points from CoinCap")
                
                # Convert CoinCap format to our format
                prices = []
                for item in data["data"]:
                    date = datetime.fromtimestamp(int(item["time"]) / 1000)
                    price = float(item["priceUsd"])
                    prices.append([int(item["time"]), price])
                
                df = process_historical_data(prices, "CoinCap")
                if not df.empty:
                    historical_cache[cache_key] = {"data": df, "timestamp": current_time}
                    return df, config["interval"]
                    
    except Exception as e:
        print(f"❌ CoinCap error: {str(e)}")
    
    # Try Method 3: Binance historical data
    try:
        print("📡 Trying Binance historical data...")
        
        # Binance kline intervals
        interval_map = {
            "hourly": "1h",
            "daily": "1d",
            "weekly": "1w"
        }
        
        binance_interval = interval_map.get(config["interval"], "1d")
        
        # Binance limits results, so we need to calculate how many we can get
        limit = min(1000, config["days"] * 24 if config["interval"] == "hourly" else config["days"])
        
        url = f"https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval={binance_interval}&limit={limit}"
        
        response = requests.get(url, timeout=30)
        print(f"📊 Binance response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if len(data) > 0:
                print(f"📦 Got {len(data)} price points from Binance")
                
                # Convert Binance format to our format
                prices = []
                for item in data:
                    timestamp = int(item[0])  # Open time
                    price = float(item[4])    # Close price
                    prices.append([timestamp, price])
                
                df = process_historical_data(prices, "Binance")
                if not df.empty:
                    historical_cache[cache_key] = {"data": df, "timestamp": current_time}
                    return df, config["interval"]
                    
    except Exception as e:
        print(f"❌ Binance error: {str(e)}")
    
    # Method 4: Use a smaller dataset if larger one fails
    if config["days"] > 365:
        print(f"🔄 Large dataset failed, trying smaller timeframe...")
        try:
            smaller_config = TIMEFRAME_CONFIG["1y"]  # Fall back to 1 year
            url = f"https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days={smaller_config['days']}&interval={smaller_config['interval']}"
            
            wait_for_rate_limit()
            response = requests.get(url, headers={"User-Agent": "Bitcoin-Investment-Simulator/1.0"}, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if "prices" in data and len(data["prices"]) > 0:
                    print(f"📦 Got {len(data['prices'])} price points from fallback 1y data")
                    df = process_historical_data(data["prices"], "CoinGecko (1y fallback)")
                    if not df.empty:
                        historical_cache[cache_key] = {"data": df, "timestamp": current_time}
                        return df, smaller_config["interval"]
        except Exception as e:
            print(f"❌ Fallback 1y data failed: {str(e)}")
    
    # All methods failed
    print(f"💥 ALL historical data sources failed for {timeframe}")
    raise HTTPException(
        status_code=503, 
        detail=f"Unable to fetch historical Bitcoin data for {timeframe}. All data sources failed. This may be due to rate limiting or API issues. Please try a shorter timeframe or wait a few minutes."
    )

def process_historical_data(prices_data, source_name):
    """Process historical price data from any source"""
    try:
        prices = []
        for price_point in prices_data:
            date = datetime.fromtimestamp(price_point[0] / 1000)
            price = price_point[1]
            
            # Validation: Only accept realistic Bitcoin prices
            if 0.01 <= price <= 150000:  # From early Bitcoin to reasonable 2025 max
                prices.append({"date": date, "price": price})
            else:
                print(f"⚠️ Filtered out unrealistic price: ${price:,.2f} on {date}")
        
        if len(prices) == 0:
            print(f"❌ No valid price data after filtering from {source_name}")
            return pd.DataFrame()
        
        df = pd.DataFrame(prices)
        df = df.sort_values('date').reset_index(drop=True)
        
        print(f"✅ Successfully processed REAL historical data from {source_name}: {len(df)} records")
        print(f"📈 Price range: ${df['price'].min():,.0f} - ${df['price'].max():,.0f}")
        print(f"📅 Date range: {df['date'].min().date()} to {df['date'].max().date()}")
        
        # Final validation
        max_price = df['price'].max()
        min_price = df['price'].min()
        
        if max_price > 150000:
            print(f"❌ Data validation failed: Max price {max_price:,.0f} too high")
            return pd.DataFrame()
        
        return df
        
    except Exception as e:
        print(f"❌ Error processing historical data from {source_name}: {str(e)}")
        return pd.DataFrame()

def calculate_technical_indicators(df: pd.DataFrame):
    """Calculate technical indicators with better handling for different timeframes"""
    if df.empty:
        return df
        
    df = df.copy()
    df = df.sort_values('date').reset_index(drop=True)
    
    # Adjust technical indicator periods based on data length
    data_length = len(df)
    
    # Moving Averages - adjust periods based on available data
    ma_short_period = min(20, max(5, data_length // 10))
    ma_long_period = min(50, max(10, data_length // 5))
    
    df['ma_short'] = df['price'].rolling(window=ma_short_period).mean()
    df['ma_long'] = df['price'].rolling(window=ma_long_period).mean()
    
    # RSI - adjust period
    rsi_period = min(14, max(5, data_length // 20))
    delta = df['price'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=rsi_period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=rsi_period).mean()
    rs = gain / loss
    df['rsi'] = 100 - (100 / (1 + rs))
    
    # Bollinger Bands
    bb_period = min(20, max(5, data_length // 15))
    df['bb_middle'] = df['price'].rolling(window=bb_period).mean()
    bb_std = df['price'].rolling(window=bb_period).std()
    df['bb_upper'] = df['bb_middle'] + (bb_std * 2)
    df['bb_lower'] = df['bb_middle'] - (bb_std * 2)
    
    return df

def monte_carlo_simulation(current_price: float, days: int = 365, simulations: int = 1000):
    """Run Monte Carlo simulation for BTC price forecasting"""
    # Use realistic Bitcoin volatility parameters
    daily_volatility = 0.04  # 4% daily volatility (Bitcoin typical)
    daily_return = 0.0003    # Small positive drift (about 11% annual)
    
    results = []
    for _ in range(simulations):
        prices = [current_price]
        for day in range(days):
            random_return = np.random.normal(daily_return, daily_volatility)
            next_price = prices[-1] * (1 + random_return)
            prices.append(max(next_price, current_price * 0.1))  # Prevent negative prices
        results.append(prices[-1])
    
    return {
        "mean": float(np.mean(results)),
        "median": float(np.median(results)),
        "percentile_10": float(np.percentile(results, 10)),
        "percentile_90": float(np.percentile(results, 90)),
        "std": float(np.std(results))
    }

@app.get("/")
async def root():
    """API Health Check"""
    return {"message": "Bitcoin Investment Simulator API - Multiple Data Sources", "status": "active"}

@app.get("/price")
async def get_price():
    """Get LIVE BTC price - NO fallbacks"""
    price_data = await get_current_btc_price()
    return {
        "price": price_data["price"],
        "change_24h": price_data["change_24h"],
        "timestamp": datetime.now().isoformat(),
        "source": "Live Market Data",
        "cache_age_seconds": time.time() - price_cache["timestamp"] if price_cache["price"] else 0
    }

@app.get("/historical/{timeframe}")
async def get_historical_by_timeframe(timeframe: str):
    """Get historical BTC data by timeframe - Multiple sources with fallbacks"""
    
    if timeframe not in TIMEFRAME_CONFIG:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid timeframe '{timeframe}'. Available: {', '.join(TIMEFRAME_CONFIG.keys())}"
        )
    
    df, interval = await get_historical_btc_data_by_timeframe(timeframe)
    df_with_indicators = calculate_technical_indicators(df)
    
    # Convert to JSON-serializable format
    data = []
    for _, row in df_with_indicators.iterrows():
        data.append({
            "date": row["date"].isoformat(),
            "price": float(row["price"]) if not pd.isna(row["price"]) else None,
            "ma_short": float(row["ma_short"]) if not pd.isna(row["ma_short"]) else None,
            "ma_long": float(row["ma_long"]) if not pd.isna(row["ma_long"]) else None,
            "rsi": float(row["rsi"]) if not pd.isna(row["rsi"]) else None,
            "bb_upper": float(row["bb_upper"]) if not pd.isna(row["bb_upper"]) else None,
            "bb_middle": float(row["bb_middle"]) if not pd.isna(row["bb_middle"]) else None,
            "bb_lower": float(row["bb_lower"]) if not pd.isna(row["bb_lower"]) else None,
        })
    
    config = TIMEFRAME_CONFIG[timeframe]
    
    return {
        "data": data,
        "timeframe": timeframe,
        "days": config["days"],
        "interval": interval,
        "data_points": len(data),
        "date_range": {
            "start": df['date'].min().isoformat() if not df.empty else None,
            "end": df['date'].max().isoformat() if not df.empty else None
        },
        "source": "Multiple Sources (CoinGecko/CoinCap/Binance)",
        "cache_info": {
            "cache_duration_minutes": config["cache_minutes"],
            "cached": timeframe in historical_cache
        },
        "data_validation": {
            "min_price": float(df['price'].min()) if not df.empty else None,
            "max_price": float(df['price'].max()) if not df.empty else None,
            "realistic": True
        }
    }

@app.get("/historical")
async def get_historical_legacy(days: int = 30):
    """Legacy endpoint - Get historical BTC data by days (for backward compatibility)"""
    # Map days to appropriate timeframe
    if days <= 1:
        timeframe = "1d"
    elif days <= 7:
        timeframe = "1w" 
    elif days <= 30:
        timeframe = "1m"
    elif days <= 90:
        timeframe = "3m"
    elif days <= 180:
        timeframe = "6m"
    elif days <= 365:
        timeframe = "1y"
    elif days <= 730:
        timeframe = "2y"
    elif days <= 1825:
        timeframe = "5y"
    else:
        timeframe = "max"
    
    return await get_historical_by_timeframe(timeframe)

@app.get("/timeframes")
async def get_available_timeframes():
    """Get all available timeframes and their configurations"""
    return {
        "timeframes": {
            timeframe: {
                "days": config["days"],
                "interval": config["interval"],
                "cache_minutes": config["cache_minutes"],
                "description": f"{timeframe.upper()} - {config['days']} days with {config['interval']} data points"
            }
            for timeframe, config in TIMEFRAME_CONFIG.items()
        },
        "usage": {
            "get_data": "/historical/{timeframe}",
            "example": "/historical/1y",
            "available_timeframes": list(TIMEFRAME_CONFIG.keys())
        },
        "data_policy": "REAL DATA ONLY from multiple sources with fallbacks",
        "rate_limiting": "Built-in rate limiting to respect API limits"
    }

# ... (rest of the endpoints remain the same as previous version)

@app.post("/buy")
async def simulate_buy(buy_request: BuyRequest):
    """Simulate a BTC purchase using LIVE price"""
    price_data = await get_current_btc_price()
    current_price = price_data["price"]
    
    price_per_btc = current_price
    date = buy_request.date or datetime.now().isoformat()
    
    btc_purchased = buy_request.amount_usd / price_per_btc
    
    investment = {
        "amount_usd": buy_request.amount_usd,
        "price_per_btc": price_per_btc,
        "date": date,
        "btc_purchased": btc_purchased
    }
    
    portfolio_data["investments"].append(investment)
    portfolio_data["total_usd_invested"] += buy_request.amount_usd
    portfolio_data["total_btc_owned"] += btc_purchased
    
    return {
        **investment,
        "message": "Investment simulated successfully using LIVE price",
        "portfolio_summary": {
            "total_investments": len(portfolio_data["investments"]),
            "total_usd_invested": portfolio_data["total_usd_invested"],
            "total_btc_owned": portfolio_data["total_btc_owned"]
        }
    }

@app.get("/portfolio")
async def get_portfolio():
    """Get current portfolio status with real-time valuation"""
    price_data = await get_current_btc_price()
    current_price = price_data["price"]
    
    if not portfolio_data["investments"]:
        return {
            "investments": [],
            "total_usd_invested": 0.0,
            "total_btc_owned": 0.0,
            "current_value": 0.0,
            "unrealized_gain_loss": 0.0,
            "unrealized_gain_loss_percent": 0.0,
            "average_cost_basis": 0.0,
            "current_btc_price": current_price,
            "price_change_24h": price_data["change_24h"]
        }
    
    current_value = portfolio_data["total_btc_owned"] * current_price
    unrealized_gain_loss = current_value - portfolio_data["total_usd_invested"]
    unrealized_gain_loss_percent = (unrealized_gain_loss / portfolio_data["total_usd_invested"] * 100) if portfolio_data["total_usd_invested"] > 0 else 0
    average_cost_basis = portfolio_data["total_usd_invested"] / portfolio_data["total_btc_owned"] if portfolio_data["total_btc_owned"] > 0 else 0
    
    return {
        "investments": portfolio_data["investments"],
        "total_usd_invested": portfolio_data["total_usd_invested"],
        "total_btc_owned": portfolio_data["total_btc_owned"],
        "current_value": current_value,
        "unrealized_gain_loss": unrealized_gain_loss,
        "unrealized_gain_loss_percent": unrealized_gain_loss_percent,
        "average_cost_basis": average_cost_basis,
        "current_btc_price": current_price,
        "price_change_24h": price_data["change_24h"],
        "last_updated": datetime.now().isoformat()
    }

@app.get("/project")
async def get_projections():
    """Get BTC price projections using real historical data"""
    price_data = await get_current_btc_price()
    current_price = price_data["price"]
    
    try:
        df, _ = await get_historical_btc_data_by_timeframe("1y")
    except:
        # If 1y fails, try shorter timeframe
        try:
            df, _ = await get_historical_btc_data_by_timeframe("6m")
        except:
            df, _ = await get_historical_btc_data_by_timeframe("1m")
    
    # Calculate historical CAGR
    if len(df) > 1:
        start_price = df.iloc[0]["price"]
        end_price = df.iloc[-1]["price"]
        years = len(df) / 365.25
        cagr = (end_price / start_price) ** (1 / years) - 1
    else:
        cagr = 0.5  # Default 50% CAGR if insufficient data
    
    # Future projections
    timeframes = [30, 90, 365]
    projections = {}
    
    for days in timeframes:
        # CAGR model
        years_ahead = days / 365.25
        cagr_projection = current_price * ((1 + cagr) ** years_ahead)
        
        # Monte Carlo simulation
        mc_results = monte_carlo_simulation(current_price, days, 1000)
        
        # Log-normal model with realistic parameters
        log_normal_mean = current_price * np.exp(0.1 * years_ahead)  # 10% annual drift
        log_normal_vol = 0.8 * np.sqrt(years_ahead)  # 80% annual volatility
        log_normal_projection = current_price * np.exp(np.random.normal(0.1 * years_ahead, log_normal_vol))
        
        projections[f"{days}_days"] = {
            "cagr_model": float(cagr_projection),
            "monte_carlo": mc_results,
            "log_normal": float(log_normal_projection)
        }
    
    return {
        "current_price": current_price,
        "historical_cagr": float(cagr),
        "data_period_days": len(df),
        "projections": projections,
        "disclaimer": "Projections based on REAL data for educational purposes only",
        "last_updated": datetime.now().isoformat()
    }

@app.delete("/portfolio/reset")
async def reset_portfolio():
    """Reset portfolio (for testing)"""
    global portfolio_data
    portfolio_data = {
        "investments": [],
        "total_usd_invested": 0.0,
        "total_btc_owned": 0.0
    }
    return {
        "message": "Portfolio reset successfully", 
        "timestamp": datetime.now().isoformat()
    }

@app.get("/status")
async def get_status():
    """Get API status and data sources"""
    try:
        # Test API connectivity
        price_data = await get_current_btc_price()
        
        return {
            "status": "online",
            "real_time_data": True,
            "api_source": "Multiple Live Sources with Fallbacks",
            "current_btc_price": price_data["price"],
            "last_price_update": datetime.now().isoformat(),
            "portfolio_investments": len(portfolio_data["investments"]),
            "available_timeframes": list(TIMEFRAME_CONFIG.keys()),
            "data_policy": "REAL DATA ONLY with multiple source fallbacks",
            "rate_limiting": {
                "enabled": True,
                "min_interval_seconds": min_interval_between_calls,
                "last_call": last_api_call
            },
            "cache_status": {
                "price_cached": price_cache["price"] is not None,
                "price_cache_age_seconds": time.time() - price_cache["timestamp"] if price_cache["price"] else 0,
                "historical_cached_timeframes": list(historical_cache.keys())
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "real_time_data": False,
            "error": str(e),
            "message": "All live Bitcoin APIs are currently unavailable"
        }

@app.delete("/cache/clear")
async def clear_cache():
    """Clear all cached data (for testing/debugging)"""
    global price_cache, historical_cache
    
    old_cache_info = {
        "price_cache_age": time.time() - price_cache["timestamp"] if price_cache["price"] else 0,
        "historical_timeframes_cached": list(historical_cache.keys())
    }
    
    price_cache = {"price": None, "timestamp": 0}
    historical_cache = {}
    
    return {
        "message": "All caches cleared successfully",
        "old_cache_info": old_cache_info,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/test/{timeframe}")
async def test_historical_endpoint(timeframe: str):
    """Test endpoint to debug historical data fetching"""
    try:
        print(f"🧪 Testing historical data for {timeframe}")
        df, interval = await get_historical_btc_data_by_timeframe(timeframe)
        
        return {
            "success": True,
            "timeframe": timeframe,
            "interval": interval,
            "data_points": len(df),
            "date_range": {
                "start": df['date'].min().isoformat() if not df.empty else None,
                "end": df['date'].max().isoformat() if not df.empty else None
            },
            "price_range": {
                "min": float(df['price'].min()) if not df.empty else None,
                "max": float(df['price'].max()) if not df.empty else None
            },
            "sample_data": df.head(3).to_dict('records') if not df.empty else []
        }
    except Exception as e:
        return {
            "success": False,
            "timeframe": timeframe,
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)