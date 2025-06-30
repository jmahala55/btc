import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Area, AreaChart, ComposedChart, ReferenceLine, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Activity, BarChart3, DollarSign, AlertTriangle, Target, Zap, Eye, Settings, RefreshCw, Calendar, Calculator, PieChart, AreaChart as AreaChartIcon } from 'lucide-react';

const BitcoinTerminalDashboard = ({ currentPrice: sharedCurrentPrice, onPriceUpdate }) => {
  // State management
  const [currentPrice, setCurrentPrice] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1y');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [chartType, setChartType] = useState('line');
  const [scaleType, setScaleType] = useState('linear');
  const [showVolume, setShowVolume] = useState(true);
  const [portfolio, setPortfolio] = useState(null);
  const [apiStatus, setApiStatus] = useState('connecting');
  const [activeIndicators, setActiveIndicators] = useState({
    rsi: true,
    macd: true,
    bb: true,
    ma: true,
    stoch: false,
    cci: false,
    adx: false
  });

  // Available timeframes with better labels
  const timeframes = [
    { value: '1d', label: '1D', description: '1 Day' },
    { value: '1w', label: '1W', description: '1 Week' },
    { value: '1m', label: '1M', description: '1 Month' },
    { value: '3m', label: '3M', description: '3 Months' },
    { value: '6m', label: '6M', description: '6 Months' },
    { value: '1y', label: '1Y', description: '1 Year' },
    { value: '2y', label: '2Y', description: '2 Years' },
    { value: '3y', label: '3Y', description: '3 Years' },
    { value: '5y', label: '5Y', description: '5 Years' },
    { value: 'max', label: 'MAX', description: 'All Available' }
  ];

  // API Base URL - change this to match your FastAPI server
  const API_BASE = 'http://127.0.0.1:8000';

  // Fetch current price with better error handling and no aggressive retries
  const fetchCurrentPrice = useCallback(async () => {
    // Don't fetch if we already have recent data (less than 2 minutes old)
    if (currentPrice && lastUpdate && (new Date() - lastUpdate) < 120000) {
      console.log('📊 Using recent price data, skipping fetch');
      return;
    }

    try {
      console.log('🔄 Fetching current price...');
      const response = await fetch(`${API_BASE}/price`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Current price data:', data);
      setCurrentPrice(data);
      setLastUpdate(new Date());
      setApiStatus('connected');
    } catch (error) {
      console.error('❌ Error fetching current price:', error);
      setApiStatus('error');
      // Don't clear existing price data on error - keep showing last known price
    }
  }, [currentPrice, lastUpdate]);

  // Fetch historical data with better error handling and caching
  const fetchHistoricalData = useCallback(async (timeframe) => {
    console.log(`🔄 Fetching fresh data for ${timeframe}...`);
    
    // Clear existing data first to force refresh
    setHistoricalData([]);
    setIsLoading(true);

    setIsLoading(true);
    try {
      console.log(`🔄 Fetching historical data for ${timeframe}...`);
      const response = await fetch(`${API_BASE}/historical/${timeframe}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`✅ Historical data received:`, {
        timeframe: data.timeframe,
        dataPoints: data.data_points,
        interval: data.interval,
        dateRange: data.date_range,
        source: data.source
      });
      
      // Validate that we received data
      if (!data.data || data.data.length === 0) {
        throw new Error('No historical data received');
      }
      
      // Enhanced data processing with additional calculations
      const enhancedData = data.data.map((item, index) => {
        const prevItem = data.data[index - 1];
        
        // Simulate OHLC data based on price
        const priceVariation = item.price * 0.01; // 1% variation
        const high = item.price + (Math.random() * priceVariation);
        const low = item.price - (Math.random() * priceVariation);
        const open = prevItem ? prevItem.price + ((Math.random() - 0.5) * priceVariation) : item.price;
        
        // Simulate volume with realistic patterns
        const baseVolume = 500000000; // 500M base volume
        const volumeVariation = Math.random() * 1000000000; // Up to 1B variation
        const volume = baseVolume + volumeVariation;
        
        return {
        ...item,
        timestamp: new Date(item.date).getTime(),
        displayDate: new Date(item.date).toLocaleDateString(),
          high: Math.max(high, item.price, open),
          low: Math.min(low, item.price, open),
          open: open,
          close: item.price,
          volume: volume,
          change: prevItem ? ((item.price - prevItem.price) / prevItem.price) * 100 : 0,
          // Enhanced technical indicators
          sma_20: index >= 19 ? data.data.slice(index - 19, index + 1).reduce((sum, d) => sum + d.price, 0) / 20 : null,
          ema_12: index >= 11 ? calculateEMA(data.data.slice(0, index + 1).map(d => d.price), 12)[index] : null,
          ema_26: index >= 25 ? calculateEMA(data.data.slice(0, index + 1).map(d => d.price), 26)[index] : null,
        };
      }).filter(item => item.price !== null && item.price !== undefined);

      console.log(`📊 Enhanced data processed: ${enhancedData.length} records`);
      setHistoricalData(enhancedData);
      setApiStatus('connected');
    } catch (error) {
      console.error('❌ Error fetching historical data:', error);
      setApiStatus('error');
      
      // Show a user-friendly error message but don't clear existing data
      if (historicalData.length === 0) {
        // Only show error state if we have no data at all
        console.log('📝 No existing data, showing error state');
      } else {
        console.log('📊 Keeping existing historical data due to error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [historicalData.length, selectedTimeframe, lastUpdate]);

  // Fetch portfolio data with better error handling
  const fetchPortfolio = useCallback(async () => {
    try {
      console.log('🔄 Fetching portfolio data...');
      const response = await fetch(`${API_BASE}/portfolio`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Portfolio data:', data);
        setPortfolio(data);
      } else {
        console.warn('⚠️ Portfolio endpoint returned:', response.status);
      }
    } catch (error) {
      console.error('❌ Error fetching portfolio:', error);
      // Don't clear existing portfolio data on error
    }
  }, []);

  // Helper function to calculate EMA
  const calculateEMA = (prices, period) => {
    const multiplier = 2 / (period + 1);
    const ema = [prices[0]];
    
    for (let i = 1; i < prices.length; i++) {
      ema[i] = (prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
    }
    
    return ema;
  };

  // Calculate MACD
  const macdData = useMemo(() => {
    if (!historicalData.length) return [];
    
    return historicalData.map((item, index) => {
      const ema12 = item.ema_12;
      const ema26 = item.ema_26;
      
      if (ema12 && ema26) {
        const macdLine = ema12 - ema26;
        // Calculate signal line (9-period EMA of MACD)
        const macdValues = historicalData.slice(Math.max(0, index - 8), index + 1)
          .map(d => d.ema_12 && d.ema_26 ? d.ema_12 - d.ema_26 : 0)
          .filter(v => v !== 0);
        
        const signalLine = macdValues.length >= 9 ? 
          calculateEMA(macdValues, 9)[macdValues.length - 1] : macdLine;
        
        return {
          ...item,
          macd: macdLine,
          signal: signalLine,
          histogram: macdLine - signalLine
        };
      }
      
      return { ...item, macd: null, signal: null, histogram: null };
    });
  }, [historicalData]);

  // Calculate additional technical indicators
  const technicalData = useMemo(() => {
    if (!historicalData.length) return [];

    return historicalData.map((item, index) => {
      const period = Math.min(14, index + 1);
      const prices = historicalData.slice(Math.max(0, index - period + 1), index + 1);
      
      // Calculate additional indicators
      const gains = [];
      const losses = [];
      for (let i = 1; i < prices.length; i++) {
        const change = prices[i].price - prices[i-1].price;
        if (change > 0) gains.push(change);
        else losses.push(Math.abs(change));
      }
      
      const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
      const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
      
      // Enhanced RSI
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const enhancedRSI = 100 - (100 / (1 + rs));
      
      // Stochastic Oscillator
      const highs = prices.map(p => p.high || p.price);
      const lows = prices.map(p => p.low || p.price);
      const high14 = Math.max(...highs);
      const low14 = Math.min(...lows);
      const stochK = low14 === high14 ? 50 : ((item.price - low14) / (high14 - low14)) * 100;
      
      // Williams %R
      const williamsR = low14 === high14 ? -50 : (((high14 - item.price) / (high14 - low14)) * -100);
      
      // CCI (Commodity Channel Index)
      const typicalPrice = (item.price + (item.high || item.price) + (item.low || item.price)) / 3;
      const sma = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
      const meanDeviation = prices.reduce((sum, p) => sum + Math.abs(p.price - sma), 0) / prices.length;
      const cci = meanDeviation === 0 ? 0 : (typicalPrice - sma) / (0.015 * meanDeviation);
      
      return {
        ...item,
        enhancedRSI,
        stochK,
        stochD: index >= 3 ? (
          historicalData.slice(Math.max(0, index - 2), index + 1)
            .reduce((sum, _, i) => {
              const dataIndex = Math.max(0, index - 2) + i;
              const dataItem = historicalData[dataIndex];
              if (dataItem) {
                const itemPeriod = Math.min(14, dataIndex + 1);
                const itemPrices = historicalData.slice(Math.max(0, dataIndex - itemPeriod + 1), dataIndex + 1);
                const itemHighs = itemPrices.map(p => p.high || p.price);
                const itemLows = itemPrices.map(p => p.low || p.price);
                const itemHigh14 = Math.max(...itemHighs);
                const itemLow14 = Math.min(...itemLows);
                const itemStochK = itemLow14 === itemHigh14 ? 50 : ((dataItem.price - itemLow14) / (itemHigh14 - itemLow14)) * 100;
                return sum + itemStochK;
              }
              return sum;
            }, 0) / 3
        ) : stochK,
        williamsR,
        cci,
        momentum: index >= 10 ? ((item.price - historicalData[index - 10].price) / historicalData[index - 10].price) * 100 : 0
      };
    });
  }, [historicalData]);

  // Portfolio analytics calculations
  const portfolioAnalytics = useMemo(() => {
    if (!technicalData.length) return {};

    const returns = [];
    for (let i = 1; i < technicalData.length; i++) {
      returns.push((technicalData[i].price - technicalData[i-1].price) / technicalData[i-1].price);
    }

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(252); // Annualized

    // VaR calculations
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const var1 = sortedReturns[Math.floor(returns.length * 0.01)] || 0;
    const var5 = sortedReturns[Math.floor(returns.length * 0.05)] || 0;
    const var10 = sortedReturns[Math.floor(returns.length * 0.10)] || 0;

    // Expected Shortfall (CVaR)
    const var5Index = Math.floor(returns.length * 0.05);
    const cvar5 = var5Index > 0 ? sortedReturns.slice(0, var5Index).reduce((sum, r) => sum + r, 0) / var5Index : 0;

    // Maximum Drawdown
    let peak = technicalData[0].price;
    let maxDrawdown = 0;
    for (const data of technicalData) {
      if (data.price > peak) peak = data.price;
      const drawdown = (peak - data.price) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // Sharpe Ratio (assuming 2% risk-free rate)
    const riskFreeRate = 0.02;
    const excessReturn = (mean * 252) - riskFreeRate;
    const sharpeRatio = volatility === 0 ? 0 : excessReturn / volatility;

    // Sortino Ratio
    const downside = returns.filter(r => r < mean);
    const downsideDeviation = downside.length > 0 ? Math.sqrt(downside.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / downside.length) * Math.sqrt(252) : 0;
    const sortinoRatio = downsideDeviation === 0 ? 0 : excessReturn / downsideDeviation;

    return {
      volatility: volatility * 100,
      var1: var1 * 100,
      var5: var5 * 100,
      var10: var10 * 100,
      cvar5: cvar5 * 100,
      maxDrawdown: maxDrawdown * 100,
      sharpeRatio,
      sortinoRatio,
      calmarRatio: maxDrawdown === 0 ? 0 : (mean * 252 * 100) / (maxDrawdown * 100)
    };
  }, [technicalData]);

  // Market depth simulation
  const marketDepth = useMemo(() => {
    if (!currentPrice) return { bids: [], asks: [] };

    const basePrice = currentPrice.price;
    const bids = [];
    const asks = [];

    for (let i = 0; i < 20; i++) {
      const bidPrice = basePrice * (1 - (i + 1) * 0.001);
      const askPrice = basePrice * (1 + (i + 1) * 0.001);
      const bidSize = Math.random() * 50 + 10;
      const askSize = Math.random() * 50 + 10;

      bids.push({ price: bidPrice, size: bidSize, total: bidSize });
      asks.push({ price: askPrice, size: askSize, total: askSize });
    }

    // Calculate cumulative totals
    let bidTotal = 0;
    let askTotal = 0;
    
    bids.forEach(bid => {
      bidTotal += bid.size;
      bid.total = bidTotal;
    });

    asks.forEach(ask => {
      askTotal += ask.size;
      ask.total = askTotal;
    });

    return { bids: bids.reverse(), asks };
  }, [currentPrice]);

  // Initialize data ONCE when component mounts
  useEffect(() => {
    console.log('🚀 Initializing dashboard...');
    
    const initializeDashboard = async () => {
      // Only initialize if we don't already have data
      if (!currentPrice) {
        await fetchCurrentPrice();
      }
      
      if (historicalData.length === 0) {
        await fetchHistoricalData(selectedTimeframe);
      }
      
      if (!portfolio) {
        await fetchPortfolio();
      }
    };

    initializeDashboard();

    // Set up price update interval (every 5 minutes instead of 30 seconds)
    const priceInterval = setInterval(() => {
      console.log('⏰ Scheduled price update...');
      fetchCurrentPrice();
    }, 300000); // 5 minutes = 300,000ms

    return () => clearInterval(priceInterval);
  }, []); // Empty dependency array - only run once on mount

  // Handle timeframe changes separately
  useEffect(() => {
    if (selectedTimeframe) {
      console.log(`🔄 Timeframe changed to: ${selectedTimeframe}`);
      fetchHistoricalData(selectedTimeframe);
    }
  }, [selectedTimeframe]); // Only run when timeframe changes

  // Handle timeframe change without excessive API calls
  const handleTimeframeChange = (timeframe) => {
    if (timeframe === selectedTimeframe) {
      console.log(`📊 Already on ${timeframe}, but forcing refresh...`);
    }
    
    console.log(`🔄 Changing timeframe from ${selectedTimeframe} to: ${timeframe}`);
    
    // Clear data immediately and update timeframe
    setHistoricalData([]);
    setSelectedTimeframe(timeframe);
    
    // Force immediate fetch
    fetchHistoricalData(timeframe);
  };

  // Custom formatter for price
  const formatPrice = (value) => {
    if (typeof value !== 'number') return '--';
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // Custom formatter for dates
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    if (selectedTimeframe === '1d' || selectedTimeframe === '1w') {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString();
  };

  // Enhanced Chart Component with better scaling
  const EnhancedChart = ({ data }) => {
    if (!data || data.length === 0) {
      return (
        <div className="flex items-center justify-center h-80 text-gray-400">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No data available</p>
            <p className="text-sm">Try selecting a different timeframe</p>
          </div>
        </div>
      );
    }

    // Filter out any invalid data points
    const validData = data.filter(item => 
      item.price && 
      !isNaN(item.price) && 
      item.price > 0 &&
      item.timestamp &&
      !isNaN(item.timestamp)
    );

    if (validData.length === 0) {
      return (
        <div className="flex items-center justify-center h-80 text-gray-400">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Invalid data received</p>
            <p className="text-sm">Please try refreshing or selecting a different timeframe</p>
          </div>
        </div>
      );
    }

    // Calculate proper Y-axis domain
    const prices = validData.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const padding = (maxPrice - minPrice) * 0.05; // 5% padding
    const yAxisMin = Math.max(0, minPrice - padding);
    const yAxisMax = maxPrice + padding;

    console.log('Chart data:', {
      dataPoints: validData.length,
      priceRange: `${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()}`,
      timeRange: `${new Date(validData[0].timestamp).toLocaleDateString()} - ${new Date(validData[validData.length - 1].timestamp).toLocaleDateString()}`
    });

    return (
      <ResponsiveContainer width="100%" height={450}>
        <ComposedChart data={validData} margin={{ top: 20, right: 30, left: 60, bottom: 80 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333333" opacity={0.5} />
        <XAxis 
  dataKey="timestamp" 
  type="number"
  domain={['dataMin', 'dataMax']}
  tickFormatter={formatDate}
  stroke="#9CA3AF"
  fontSize={11}
  angle={-45}
  textAnchor="end"
  height={80}
  interval="preserveStartEnd"
  tickCount={selectedTimeframe === '1d' ? 24 : selectedTimeframe === '1w' ? 7 : 8}
/>
          <YAxis 
            domain={[yAxisMin, yAxisMax]}
            scale={scaleType === 'log' ? 'log' : 'linear'}
            stroke="#9CA3AF"
            tickFormatter={formatPrice}
            fontSize={11}
            width={80}
          />
          <Tooltip 
            labelFormatter={(value) => formatDate(value)}
            formatter={(value, name) => [
              typeof value === 'number' ? 
                (name.includes('Price') || name.includes('MA') || name.includes('BB') ? 
                  formatPrice(value) : 
                  value.toFixed(2)
                ) : value,
              name
            ]}
            contentStyle={{ 
              backgroundColor: '#1F2937', 
              border: '1px solid #374151', 
              borderRadius: '8px',
              fontSize: '12px'
            }}
          />
          <Legend 
            wrapperStyle={{ fontSize: '12px' }}
            iconSize={12}
          />
          
          {/* Price Line */}
          <Line 
            type="monotone" 
            dataKey="price" 
            stroke="#F59E0B" 
            strokeWidth={3}
            dot={false}
            name="BTC Price"
            connectNulls={false}
          />
          
          {/* Bollinger Bands */}
          {activeIndicators.bb && (
            <>
              <Line 
                type="monotone" 
                dataKey="bb_upper" 
                stroke="#6366F1" 
                strokeWidth={1} 
                dot={false} 
                strokeDasharray="5 5" 
                name="BB Upper"
                connectNulls={false}
              />
              <Line 
                type="monotone" 
                dataKey="bb_lower" 
                stroke="#6366F1" 
                strokeWidth={1} 
                dot={false} 
                strokeDasharray="5 5" 
                name="BB Lower"
                connectNulls={false}
              />
            </>
          )}
          
          {/* Moving Averages */}
          {activeIndicators.ma && (
            <>
              <Line 
                type="monotone" 
                dataKey="ma_short" 
                stroke="#10B981" 
                strokeWidth={2} 
                dot={false} 
                name="MA Short"
                connectNulls={false}
              />
              <Line 
                type="monotone" 
                dataKey="ma_long" 
                stroke="#EF4444" 
                strokeWidth={2} 
                dot={false} 
                name="MA Long"
                connectNulls={false}
              />
            </>
          )}
          
          {/* Volume Bars */}
          {showVolume && (
            <Bar 
              dataKey="volume" 
              fill="#374151" 
              opacity={0.3} 
              yAxisId="volume" 
              name="Volume"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <h1 className="text-2xl font-bold text-yellow-500 flex items-center">
              <span className="text-3xl mr-2">₿</span>
              Bitcoin Terminal
            </h1>
            {currentPrice && (
              <div className="flex items-center space-x-4">
                <span className="text-3xl font-mono">
                  {formatPrice(currentPrice.price)}
                </span>
                <span className={`flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                  (currentPrice.change_24h || 0) >= 0 ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                }`}>
                  {(currentPrice.change_24h || 0) >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                  {currentPrice.change_24h?.toFixed(2) || '0.00'}%
                </span>
              </div>
            )}
          </div>
          
          {/* Timeframe Controls */}
          <div className="flex items-center space-x-2">
            <div className="flex bg-gray-700 rounded-lg p-1">
              {timeframes.map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => handleTimeframeChange(tf.value)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    selectedTimeframe === tf.value
                      ? 'bg-yellow-600 text-white'
                      : 'hover:bg-gray-600 text-gray-300'
                  }`}
                  title={tf.description}
                >
                  {tf.label}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => {
                console.log('🔄 Manual refresh requested');
                fetchHistoricalData(selectedTimeframe);
              }}
              disabled={isLoading}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Dashboard - Quad Panel Layout */}
      <div className="grid grid-cols-2 grid-rows-2 h-[calc(100vh-88px)] gap-1 p-1">
        
        {/* Top-Left: Primary Price Chart */}
        <div className="terminal-panel overflow-hidden" style={{background: '#000000', border: '1px solid #222222'}}>
          <div className="bg-gray-750 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold flex items-center">
              <BarChart3 className="w-4 h-4 mr-2 text-yellow-500" />
              Price Chart ({timeframes.find(tf => tf.value === selectedTimeframe)?.description})
            </h2>
            <div className="flex items-center space-x-2">
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
              >
                <option value="line">Line</option>
                <option value="area">Area</option>
                <option value="candlestick">Candlestick</option>
              </select>
              <select
                value={scaleType}
                onChange={(e) => setScaleType(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
              >
                <option value="linear">Linear</option>
                <option value="log">Logarithmic</option>
              </select>
              <button
                onClick={() => setShowVolume(!showVolume)}
                className={`px-2 py-1 rounded text-xs ${showVolume ? 'bg-blue-600' : 'bg-gray-600'}`}
              >
                Volume
              </button>
            </div>
          </div>
          <div className="p-4">
            <EnhancedChart data={technicalData} />
            
            {/* Debug Information */}
            {technicalData.length > 0 && (
              <div className="mt-2 text-xs text-gray-500 border-t border-gray-700 pt-2">
                <div className="grid grid-cols-3 gap-4">
                  <div>Data Points: {technicalData.length}</div>
                  <div>Price Range: {formatPrice(Math.min(...technicalData.map(d => d.price)))} - {formatPrice(Math.max(...technicalData.map(d => d.price)))}</div>
                  <div>Latest: {formatPrice(technicalData[technicalData.length - 1]?.price)}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top-Right: Technical Indicators Panel */}
        <div className="terminal-panel overflow-hidden" style={{background: '#000000', border: '1px solid #222222'}}>
          <div className="bg-gray-750 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold flex items-center">
              <Activity className="w-4 h-4 mr-2 text-green-500" />
              Technical Indicators
            </h2>
          </div>
          <div className="p-4 space-y-6 overflow-y-auto max-h-96">
            
            {/* RSI Chart - Larger and more visible */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">RSI (14)</span>
                <span className="text-lg font-mono">
                  {technicalData.length > 0 ? technicalData[technicalData.length - 1]?.enhancedRSI?.toFixed(1) || '--' : '--'}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={technicalData.slice(-100)} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#374151" opacity={0.3} />
                  <XAxis dataKey="timestamp" hide />
                  <YAxis domain={[0, 100]} stroke="#9CA3AF" fontSize={10} />
                  <Tooltip 
                    formatter={(value) => [value?.toFixed(1), 'RSI']}
                    labelFormatter={(value) => formatDate(value)}
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', fontSize: '11px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="enhancedRSI" 
                    stroke="#F59E0B" 
                    strokeWidth={2} 
                    dot={false}
                  />
                  <ReferenceLine y={70} stroke="#EF4444" strokeDasharray="3 3" strokeWidth={1} />
                  <ReferenceLine y={30} stroke="#10B981" strokeDasharray="3 3" strokeWidth={1} />
                  <ReferenceLine y={50} stroke="#6B7280" strokeDasharray="1 1" strokeWidth={1} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* MACD Chart - Larger and more visible */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">MACD</span>
                <div className="text-right text-xs">
                  <div>Signal: {macdData.length > 0 ? macdData[macdData.length - 1]?.signal?.toFixed(2) || '--' : '--'}</div>
                  <div>Histogram: {macdData.length > 0 ? macdData[macdData.length - 1]?.histogram?.toFixed(2) || '--' : '--'}</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <ComposedChart data={macdData.slice(-100)} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#374151" opacity={0.3} />
                  <XAxis dataKey="timestamp" hide />
                  <YAxis stroke="#9CA3AF" fontSize={10} />
                  <Tooltip 
                    formatter={(value, name) => [value?.toFixed(3), name]}
                    labelFormatter={(value) => formatDate(value)}
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', fontSize: '11px' }}
                  />
                  <Line type="monotone" dataKey="macd" stroke="#3B82F6" strokeWidth={2} dot={false} name="MACD" />
                  <Line type="monotone" dataKey="signal" stroke="#EF4444" strokeWidth={2} dot={false} name="Signal" />
                  <Bar dataKey="histogram" fill="#10B981" opacity={0.6} name="Histogram" />
                  <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="1 1" strokeWidth={1} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Stochastic - Larger and more visible */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Stochastic</span>
                <div className="text-right">
                  <div className="text-sm font-mono">
                    %K: {technicalData.length > 0 ? technicalData[technicalData.length - 1]?.stochK?.toFixed(1) || '--' : '--'}
                  </div>
                  <div className="text-xs text-gray-400">
                    %D: {technicalData.length > 0 ? technicalData[technicalData.length - 1]?.stochD?.toFixed(1) || '--' : '--'}
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={technicalData.slice(-100)} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#374151" opacity={0.3} />
                  <XAxis dataKey="timestamp" hide />
                  <YAxis domain={[0, 100]} stroke="#9CA3AF" fontSize={10} />
                  <Tooltip 
                    formatter={(value, name) => [value?.toFixed(1), name]}
                    labelFormatter={(value) => formatDate(value)}
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', fontSize: '11px' }}
                  />
                  <Line type="monotone" dataKey="stochK" stroke="#8B5CF6" strokeWidth={2} dot={false} name="%K" />
                  <Line type="monotone" dataKey="stochD" stroke="#EC4899" strokeWidth={2} dot={false} name="%D" />
                  <ReferenceLine y={80} stroke="#EF4444" strokeDasharray="3 3" strokeWidth={1} />
                  <ReferenceLine y={20} stroke="#10B981" strokeDasharray="3 3" strokeWidth={1} />
                  <ReferenceLine y={50} stroke="#6B7280" strokeDasharray="1 1" strokeWidth={1} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Williams %R */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Williams %R</span>
                <span className="text-lg font-mono">
                  {technicalData.length > 0 ? technicalData[technicalData.length - 1]?.williamsR?.toFixed(1) || '--' : '--'}
                </span>
              </div>
            </div>

            {/* CCI */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">CCI (20)</span>
                <span className="text-lg font-mono">
                  {technicalData.length > 0 ? technicalData[technicalData.length - 1]?.cci?.toFixed(1) || '--' : '--'}
                </span>
              </div>
            </div>

            {/* Momentum */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Momentum (10)</span>
                <span className={`text-lg font-mono ${
                  technicalData.length > 0 && (technicalData[technicalData.length - 1]?.momentum || 0) > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {technicalData.length > 0 ? `${technicalData[technicalData.length - 1]?.momentum?.toFixed(2) || '0.00'}%` : '--'}
                </span>
              </div>
            </div>

            {/* Volume Analysis */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Volume Trend</span>
                <span className="text-lg font-mono">
                  {technicalData.length > 0 ? ((technicalData[technicalData.length - 1]?.volume || 0) / 1000000000).toFixed(1) + 'B' : '--'}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={40}>
                <BarChart data={technicalData.slice(-20)}>
                  <XAxis dataKey="timestamp" hide />
                  <YAxis hide />
                  <Bar dataKey="volume" fill="#6366F1" opacity={0.6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bottom-Left: Market Depth & Microstructure */}
        <div className="terminal-panel overflow-hidden" style={{background: '#000000', border: '1px solid #222222'}}>
          <div className="bg-gray-750 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold flex items-center">
              <Eye className="w-4 h-4 mr-2 text-blue-500" />
              Market Depth & Portfolio
            </h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 gap-4 h-80">
              
              {/* Portfolio Summary */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-center text-blue-400">Portfolio Summary</h3>
                <div className="grid grid-cols-2 gap-4">
                <div className="metric-card p-3">
                    <div className="text-xs text-gray-400">Total Invested</div>
                    <div className="text-lg font-mono text-white">
                      ${portfolio?.total_usd_invested?.toLocaleString() || '0'}
                    </div>
                  </div>
                  <div className="metric-card p-3">
                    <div className="text-xs text-gray-400">Current Value</div>
                    <div className="text-lg font-mono text-white">
                      ${portfolio?.current_value?.toLocaleString() || '0'}
                    </div>
                  </div>
                  <div className="metric-card p-3">
                    <div className="text-xs text-gray-400">P&L</div>
                    <div className={`text-lg font-mono ${
                      (portfolio?.unrealized_gain_loss || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      ${portfolio?.unrealized_gain_loss?.toLocaleString() || '0'}
                    </div>
                  </div>
                  <div className="metric-card p-3">
                    <div className="text-xs text-gray-400">BTC Holdings</div>
                    <div className="text-lg font-mono text-yellow-400">
                      ₿{portfolio?.total_btc_owned?.toFixed(8) || '0.00000000'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Market Statistics */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-center text-green-400">Market Statistics</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">24h High:</span>
                    <span className="font-mono">{currentPrice ? formatPrice(Math.max(...(technicalData.slice(-24).map(d => d.high || d.price) || [currentPrice.price]))) : '--'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">24h Low:</span>
                    <span className="font-mono">{currentPrice ? formatPrice(Math.min(...(technicalData.slice(-24).map(d => d.low || d.price) || [currentPrice.price]))) : '--'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">24h Volume:</span>
                    <span className="font-mono">{technicalData.length > 0 ? ((technicalData.slice(-24).reduce((sum, d) => sum + (d.volume || 0), 0) / 1000000000).toFixed(1) + 'B') : '--'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Market Cap:</span>
                    <span className="font-mono">{currentPrice ? ((currentPrice.price * 19700000) / 1000000000).toFixed(0) + 'B' : '--'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Period Range:</span>
                    <span className="font-mono text-xs">
                      {technicalData.length > 0 ? 
                        `${formatPrice(Math.min(...technicalData.map(d => d.price)))} - ${formatPrice(Math.max(...technicalData.map(d => d.price)))}` : 
                        '--'
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Data Points:</span>
                    <span className="font-mono">{technicalData.length}</span>
                  </div>
                </div>
              </div>

              {/* Volume Profile Chart */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-center text-purple-400">Volume Profile</h3>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart
                    layout="horizontal"
                    data={technicalData.slice(-20).map(d => ({
                      price: formatPrice(d.price),
                      volume: (d.volume || 0) / 1000000000
                    }))}
                    margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" stroke="#9CA3AF" fontSize={10} />
                    <YAxis dataKey="price" type="category" stroke="#9CA3AF" fontSize={8} />
                    <Bar dataKey="volume" fill="#6366F1" opacity={0.6} />
                    <Tooltip 
                      formatter={(value) => [`${value.toFixed(2)}B`, 'Volume']}
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', fontSize: '11px' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom-Right: Risk & Portfolio Analytics */}
        <div className="terminal-panel overflow-hidden" style={{background: '#000000', border: '1px solid #222222'}}>
          <div className="bg-gray-750 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2 text-red-500" />
              Risk Analytics
            </h2>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto max-h-96">
            
            {/* Value at Risk */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-yellow-400">Value at Risk (VaR)</h3>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="text-center">
                  <div className="text-red-400 font-mono text-lg">{portfolioAnalytics.var1?.toFixed(2) || '--'}%</div>
                  <div className="text-gray-400">1% VaR</div>
                </div>
                <div className="text-center">
                  <div className="text-orange-400 font-mono text-lg">{portfolioAnalytics.var5?.toFixed(2) || '--'}%</div>
                  <div className="text-gray-400">5% VaR</div>
                </div>
                <div className="text-center">
                  <div className="text-yellow-400 font-mono text-lg">{portfolioAnalytics.var10?.toFixed(2) || '--'}%</div>
                  <div className="text-gray-400">10% VaR</div>
                </div>
              </div>
            </div>

            {/* Expected Shortfall */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-red-400">Expected Shortfall (CVaR)</h3>
              <div className="text-center">
                <div className="text-red-400 font-mono text-xl">{portfolioAnalytics.cvar5?.toFixed(2) || '--'}%</div>
                <div className="text-gray-400 text-xs">5% CVaR</div>
              </div>
            </div>

            {/* Risk-Adjusted Returns */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-blue-400">Risk-Adjusted Returns</h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-gray-400">Sharpe Ratio</div>
                  <div className={`font-mono text-lg ${(portfolioAnalytics.sharpeRatio || 0) > 1 ? 'text-green-400' : (portfolioAnalytics.sharpeRatio || 0) > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {portfolioAnalytics.sharpeRatio?.toFixed(2) || '--'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">Sortino Ratio</div>
                  <div className={`font-mono text-lg ${(portfolioAnalytics.sortinoRatio || 0) > 1 ? 'text-green-400' : (portfolioAnalytics.sortinoRatio || 0) > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {portfolioAnalytics.sortinoRatio?.toFixed(2) || '--'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">Calmar Ratio</div>
                  <div className={`font-mono text-lg ${(portfolioAnalytics.calmarRatio || 0) > 1 ? 'text-green-400' : (portfolioAnalytics.calmarRatio || 0) > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {portfolioAnalytics.calmarRatio?.toFixed(2) || '--'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">Max Drawdown</div>
                  <div className="text-red-400 font-mono text-lg">
                    {portfolioAnalytics.maxDrawdown?.toFixed(2) || '--'}%
                  </div>
                </div>
              </div>
            </div>

            {/* Volatility Analysis */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-purple-400">Volatility Analysis</h3>
              <div className="text-center">
                <div className="text-purple-400 font-mono text-xl">{portfolioAnalytics.volatility?.toFixed(1) || '--'}%</div>
                <div className="text-gray-400 text-xs">Annualized Volatility</div>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="h-2 rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-300"
                  style={{ width: `${Math.min((portfolioAnalytics.volatility || 0) / 200 * 100, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>Low</span>
                <span>Medium</span>
                <span>High</span>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-green-400">Performance Summary</h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Current Price:</span>
                  <span className="font-mono">{currentPrice ? formatPrice(currentPrice.price) : '--'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">24h Change:</span>
                  <span className={`font-mono ${(currentPrice?.change_24h || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {currentPrice?.change_24h?.toFixed(2) || '0.00'}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Period Return:</span>
                  <span className={`font-mono ${technicalData.length > 1 ? 
                    ((technicalData[technicalData.length - 1]?.price - technicalData[0]?.price) / technicalData[0]?.price * 100 >= 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-400'
                  }`}>
                    {technicalData.length > 1 ? 
                      `${(((technicalData[technicalData.length - 1]?.price - technicalData[0]?.price) / technicalData[0]?.price) * 100).toFixed(2)}%` : 
                      '--'
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Risk Gauge */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-orange-400">Risk Level</h3>
              <div className="relative">
                <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"></div>
                </div>
                <div 
                  className="absolute top-0 w-1 h-4 bg-white shadow-lg transition-all duration-300"
                  style={{ 
                    left: `${Math.min(Math.max((portfolioAnalytics.volatility || 0) / 150 * 100, 0), 100)}%`,
                    transform: 'translateX(-50%)'
                  }}
                ></div>
              </div>
              <div className="text-center text-xs text-gray-400">
                Risk Level: {
                  (portfolioAnalytics.volatility || 0) < 50 ? 'Low' :
                  (portfolioAnalytics.volatility || 0) < 100 ? 'Medium' : 'High'
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Status Bar */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center space-x-4">
          <span>Last Update: {lastUpdate?.toLocaleTimeString() || '--'}</span>
          <span>•</span>
          <span>Data Points: {technicalData.length}</span>
          <span>•</span>
          <span>Timeframe: {timeframes.find(tf => tf.value === selectedTimeframe)?.description || selectedTimeframe}</span>
          <span>•</span>
          <span>API: {API_BASE}</span>
        </div>
        <div className="flex items-center space-x-4">
          <div className={`flex items-center space-x-1 ${
            apiStatus === 'connected' ? 'text-green-400' : 
            apiStatus === 'connecting' ? 'text-yellow-400' : 'text-red-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              apiStatus === 'connected' ? 'bg-green-400' : 
              apiStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
            }`}></div>
            <span>{apiStatus === 'connected' ? 'Live' : apiStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}</span>
          </div>
          <span>•</span>
          <span>{isLoading ? 'Loading...' : 'Ready'}</span>
        </div>
      </div>


    </div>
  );
};

export default BitcoinTerminalDashboard;