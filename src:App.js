import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceDot } from 'recharts';
import axios from 'axios';

// Real API configuration
const API_BASE = 'http://localhost:8000';

const api = {
  getCurrentPrice: async () => {
    try {
      const response = await axios.get(`${API_BASE}/price`);
      return response.data;
    } catch (error) {
      console.error('Error fetching current price:', error);
      // Fallback mock data
      return { price: 45000 + Math.random() * 5000, timestamp: new Date().toISOString() };
    }
  },
  
  getHistoricalData: async (days = 365) => {
    try {
      const response = await axios.get(`${API_BASE}/historical?days=${days}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching historical data:', error);
      // Fallback mock data
      const data = [];
      const basePrice = 40000;
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (days - i));
        const price = basePrice + Math.random() * 20000 + Math.sin(i * 0.1) * 5000;
        data.push({
          date: date.toISOString(),
          price: price,
          ma_50: i > 50 ? price * (0.95 + Math.random() * 0.1) : null,
          ma_200: i > 200 ? price * (0.9 + Math.random() * 0.2) : null,
          rsi: 30 + Math.random() * 40,
          bb_upper: price * 1.1,
          bb_middle: price,
          bb_lower: price * 0.9
        });
      }
      return { data };
    }
  },
  
  simulateBuy: async (amount, date) => {
    try {
      const response = await axios.post(`${API_BASE}/buy`, {
        amount_usd: amount,
        date: date
      });
      return response.data;
    } catch (error) {
      console.error('Error simulating buy:', error);
      // Fallback mock data
      const currentPrice = 45000 + Math.random() * 5000;
      return {
        amount_usd: amount,
        price_per_btc: currentPrice,
        date: date || new Date().toISOString(),
        btc_purchased: amount / currentPrice
      };
    }
  },
  
  getPortfolio: async () => {
    try {
      const response = await axios.get(`${API_BASE}/portfolio`);
      return response.data;
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      // Fallback mock data
      return {
        investments: [],
        total_usd_invested: 0,
        total_btc_owned: 0,
        current_value: 0,
        unrealized_gain_loss: 0,
        unrealized_gain_loss_percent: 0,
        average_cost_basis: 0,
        current_btc_price: 45000
      };
    }
  },
  
  getProjections: async () => {
    try {
      const response = await axios.get(`${API_BASE}/project`);
      return response.data;
    } catch (error) {
      console.error('Error fetching projections:', error);
      // Fallback mock data
      return {
        current_price: 45000,
        historical_cagr: 0.85,
        projections: {
          '30_days': {
            cagr_model: 48000,
            monte_carlo: { mean: 47000, median: 46500, percentile_10: 40000, percentile_90: 55000 },
            log_normal: 46800
          },
          '90_days': {
            cagr_model: 52000,
            monte_carlo: { mean: 50000, median: 49000, percentile_10: 35000, percentile_90: 70000 },
            log_normal: 51200
          },
          '365_days': {
            cagr_model: 85000,
            monte_carlo: { mean: 75000, median: 70000, percentile_10: 30000, percentile_90: 150000 },
            log_normal: 78000
          }
        }
      };
    }
  },

  getStatus: async () => {
    try {
      const response = await axios.get(`${API_BASE}/status`);
      return response.data;
    } catch (error) {
      console.error('Error fetching API status:', error);
      return { status: 'offline', real_time_data: false };
    }
  }
};

const BitcoinInvestmentSimulator = () => {
  // State management
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange24h, setPriceChange24h] = useState(0);
  const [historicalData, setHistoricalData] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [projections, setProjections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState({ status: 'unknown', real_time_data: false });
  
  // UI state
  const [activeTab, setActiveTab] = useState('portfolio');
  const [buyAmount, setBuyAmount] = useState('');
  const [buyDate, setBuyDate] = useState('');
  const [selectedIndicators, setSelectedIndicators] = useState({
    ma_crossover: false,
    rsi: false,
    bollinger: false
  });

  // Load data on component mount
  useEffect(() => {
    loadAllData();
    checkApiStatus();
    // Set up real-time price updates
    const priceInterval = setInterval(updatePrice, 15000); // Update every 15 seconds
    const statusInterval = setInterval(checkApiStatus, 60000); // Check status every minute
    
    return () => {
      clearInterval(priceInterval);
      clearInterval(statusInterval);
    };
  }, []);

  const checkApiStatus = async () => {
    try {
      const status = await api.getStatus();
      setApiStatus(status);
    } catch (error) {
      setApiStatus({ status: 'offline', real_time_data: false });
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [priceData, histData, portfolioData, projData] = await Promise.all([
        api.getCurrentPrice(),
        api.getHistoricalData(365),
        api.getPortfolio(),
        api.getProjections()
      ]);
      
      setCurrentPrice(priceData.price);
      setPriceChange24h(priceData.change_24h || 0);
      setHistoricalData(histData.data);
      setPortfolio(portfolioData);
      setProjections(projData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const updatePrice = async () => {
    try {
      const priceData = await api.getCurrentPrice();
      setCurrentPrice(priceData.price);
      setPriceChange24h(priceData.change_24h || 0);
    } catch (error) {
      console.error('Error updating price:', error);
    }
  };

  const handleBuy = async (e) => {
    e.preventDefault();
    if (!buyAmount || isNaN(buyAmount) || parseFloat(buyAmount) <= 0) return;
    
    try {
      await api.simulateBuy(parseFloat(buyAmount), buyDate);
      setBuyAmount('');
      setBuyDate('');
      // Refresh portfolio data
      const portfolioData = await api.getPortfolio();
      setPortfolio(portfolioData);
    } catch (error) {
      console.error('Error simulating buy:', error);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatBTC = (value) => {
    return `₿${value.toFixed(8)}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Prepare chart data with investment overlays
  const chartData = historicalData.map(item => ({
    ...item,
    date: new Date(item.date).getTime(),
    displayDate: formatDate(item.date)
  }));

  const investmentPoints = portfolio?.investments.map(inv => ({
    date: new Date(inv.date).getTime(),
    price: inv.price_per_btc,
    amount: inv.amount_usd
  })) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading Bitcoin Investment Simulator...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 p-6 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-orange-400 mb-2">₿ Bitcoin Investment Simulator</h1>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-2xl font-mono">
                Current Price: <span className="text-green-400">{formatCurrency(currentPrice)}</span>
                {priceChange24h !== 0 && (
                  <span className={`text-sm ml-2 ${priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(2)}% (24h)
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${apiStatus.real_time_data ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></div>
                <span className="text-sm text-gray-400">
                  {apiStatus.real_time_data ? 'Live Data' : 'Mock Data'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">
                API Status: <span className={`${apiStatus.status === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                  {apiStatus.status}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Source: {apiStatus.real_time_data ? 'CoinGecko API' : 'Fallback Data'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-gray-800 border-t border-gray-700">
        <div className="max-w-7xl mx-auto">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'portfolio', label: 'Portfolio' },
              { id: 'chart', label: 'Price Chart' },
              { id: 'buy', label: 'Simulate Buy' },
              { id: 'forecast', label: 'Forecasting' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-2 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-orange-400 text-orange-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Portfolio Tab */}
        {activeTab === 'portfolio' && portfolio && (
          <div className="space-y-6">
            {/* Portfolio Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Total Invested</h3>
                <p className="text-2xl font-bold">{formatCurrency(portfolio.total_usd_invested)}</p>
              </div>
              <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Current Value</h3>
                <p className="text-2xl font-bold text-green-400">{formatCurrency(portfolio.current_value)}</p>
              </div>
              <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Unrealized P&L</h3>
                <p className={`text-2xl font-bold ${portfolio.unrealized_gain_loss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(portfolio.unrealized_gain_loss)} ({portfolio.unrealized_gain_loss_percent.toFixed(2)}%)
                </p>
              </div>
              <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Total BTC</h3>
                <p className="text-2xl font-bold text-orange-400">{formatBTC(portfolio.total_btc_owned)}</p>
              </div>
            </div>

            {/* Investment History */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4">Investment History</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4">Date</th>
                      <th className="text-left py-3 px-4">Amount (USD)</th>
                      <th className="text-left py-3 px-4">BTC Price</th>
                      <th className="text-left py-3 px-4">BTC Purchased</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.investments.map((inv, idx) => (
                      <tr key={idx} className="border-b border-gray-700">
                        <td className="py-3 px-4">{formatDate(inv.date)}</td>
                        <td className="py-3 px-4">{formatCurrency(inv.amount_usd)}</td>
                        <td className="py-3 px-4">{formatCurrency(inv.price_per_btc)}</td>
                        <td className="py-3 px-4 text-orange-400">{formatBTC(inv.btc_purchased)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Chart Tab */}
        {activeTab === 'chart' && (
          <div className="space-y-6">
            {/* Technical Indicators Toggle */}
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-lg font-bold mb-4">Technical Indicators</h3>
              <div className="flex flex-wrap gap-4">
                {Object.entries(selectedIndicators).map(([key, value]) => (
                  <label key={key} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => setSelectedIndicators(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="form-checkbox h-4 w-4"
                    />
                    <span className="capitalize">
                      {key.replace('_', ' ').replace('ma crossover', '50/200 MA Crossover')}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price Chart */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-4">Bitcoin Price Chart</h3>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="displayDate"
                      stroke="#9CA3AF"
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      stroke="#9CA3AF"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: 'white'
                      }}
                      formatter={(value, name) => [formatCurrency(value), name]}
                    />
                    <Legend />
                    
                    {/* Main price line */}
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#F59E0B" 
                      strokeWidth={2}
                      dot={false}
                      name="BTC Price"
                    />
                    
                    {/* Technical Indicators */}
                    {selectedIndicators.ma_crossover && (
                      <React.Fragment>
                        <Line type="monotone" dataKey="ma_50" stroke="#10B981" strokeWidth={1} dot={false} name="MA 50" />
                        <Line type="monotone" dataKey="ma_200" stroke="#EF4444" strokeWidth={1} dot={false} name="MA 200" />
                      </React.Fragment>
                    )}
                    
                    {selectedIndicators.bollinger && (
                      <React.Fragment>
                        <Line type="monotone" dataKey="bb_upper" stroke="#8B5CF6" strokeWidth={1} dot={false} name="BB Upper" strokeDasharray="5 5" />
                        <Line type="monotone" dataKey="bb_lower" stroke="#8B5CF6" strokeWidth={1} dot={false} name="BB Lower" strokeDasharray="5 5" />
                      </React.Fragment>
                    )}
                    
                    {/* Investment points */}
                    {investmentPoints.map((point, idx) => (
                      <ReferenceDot
                        key={idx}
                        x={point.date}
                        y={point.price}
                        r={6}
                        fill="#06B6D4"
                        stroke="#0891B2"
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* RSI Chart */}
            {selectedIndicators.rsi && (
              <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-4">RSI (Relative Strength Index)</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="displayDate" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                      <Line type="monotone" dataKey="rsi" stroke="#F59E0B" strokeWidth={2} dot={false} name="RSI" />
                      <Line type="monotone" dataKey={() => 70} stroke="#EF4444" strokeDasharray="5 5" dot={false} name="Overbought" />
                      <Line type="monotone" dataKey={() => 30} stroke="#10B981" strokeDasharray="5 5" dot={false} name="Oversold" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Buy Tab */}
        {activeTab === 'buy' && (
          <div className="max-w-2xl">
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-6">Simulate Bitcoin Purchase</h3>
              <form onSubmit={handleBuy} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Investment Amount (USD)
                  </label>
                  <input
                    type="number"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                    placeholder="Enter amount to invest"
                    min="1"
                    step="0.01"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Date (Optional - defaults to current date)
                  </label>
                  <input
                    type="date"
                    value={buyDate}
                    onChange={(e) => setBuyDate(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                  />
                </div>

                {buyAmount && (
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Purchase Preview</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Investment Amount:</span>
                        <span>{formatCurrency(parseFloat(buyAmount) || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Current BTC Price:</span>
                        <span>{formatCurrency(currentPrice)}</span>
                      </div>
                      <div className="flex justify-between font-medium text-orange-400">
                        <span>BTC to Purchase:</span>
                        <span>{formatBTC((parseFloat(buyAmount) || 0) / currentPrice)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  Simulate Purchase
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Forecast Tab */}
        {activeTab === 'forecast' && projections && (
          <div className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-4">Price Forecasting Models</h3>
              <p className="text-gray-400 mb-6">
                Historical CAGR: <span className="text-green-400 font-medium">
                  {(projections.historical_cagr * 100).toFixed(1)}%
                </span>
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {Object.entries(projections.projections).map(([timeframe, data]) => (
                  <div key={timeframe} className="bg-gray-700 p-6 rounded-lg">
                    <h4 className="text-lg font-bold mb-4 text-orange-400">
                      {timeframe.replace('_', ' ').toUpperCase()}
                    </h4>
                    
                    <div className="space-y-4">
                      {/* CAGR Model */}
                      <div>
                        <h5 className="font-medium text-gray-300 mb-2">Historical CAGR Model</h5>
                        <p className="text-xl font-bold text-green-400">
                          {formatCurrency(data.cagr_model)}
                        </p>
                        <p className="text-sm text-gray-400">
                          {(((data.cagr_model - currentPrice) / currentPrice) * 100).toFixed(1)}% from current
                        </p>
                      </div>

                      {/* Monte Carlo */}
                      <div>
                        <h5 className="font-medium text-gray-300 mb-2">Monte Carlo Simulation</h5>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Mean:</span>
                            <span className="font-medium">{formatCurrency(data.monte_carlo.mean)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Median:</span>
                            <span className="font-medium">{formatCurrency(data.monte_carlo.median)}</span>
                          </div>
                          <div className="flex justify-between text-red-400">
                            <span>10th %ile:</span>
                            <span className="font-medium">{formatCurrency(data.monte_carlo.percentile_10)}</span>
                          </div>
                          <div className="flex justify-between text-green-400">
                            <span>90th %ile:</span>
                            <span className="font-medium">{formatCurrency(data.monte_carlo.percentile_90)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Log-Normal */}
                      <div>
                        <h5 className="font-medium text-gray-300 mb-2">Log-Normal Model</h5>
                        <p className="text-lg font-bold text-blue-400">
                          {formatCurrency(data.log_normal)}
                        </p>
                        <p className="text-sm text-gray-400">
                          {(((data.log_normal - currentPrice) / currentPrice) * 100).toFixed(1)}% from current
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Portfolio Projection */}
            {portfolio && portfolio.total_btc_owned > 0 && (
              <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-4">Your Portfolio Projections</h3>
                <p className="text-gray-400 mb-4">
                  Based on your current holdings of {formatBTC(portfolio.total_btc_owned)}
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {Object.entries(projections.projections).map(([timeframe, data]) => (
                    <div key={timeframe} className="bg-gray-700 p-4 rounded-lg">
                      <h4 className="font-medium text-orange-400 mb-3">
                        {timeframe.replace('_', ' ').toUpperCase()}
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>CAGR Model:</span>
                          <span className="font-medium text-green-400">
                            {formatCurrency(data.cagr_model * portfolio.total_btc_owned)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>MC Median:</span>
                          <span className="font-medium">
                            {formatCurrency(data.monte_carlo.median * portfolio.total_btc_owned)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Potential Gain:</span>
                          <span className={`font-medium ${
                            (data.monte_carlo.median * portfolio.total_btc_owned - portfolio.current_value) > 0 
                              ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {formatCurrency(
                              data.monte_carlo.median * portfolio.total_btc_owned - portfolio.current_value
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <div className="bg-yellow-900 border border-yellow-600 p-4 rounded-lg">
              <h4 className="font-bold text-yellow-400 mb-2">⚠️ Disclaimer</h4>
              <p className="text-yellow-200 text-sm">
                These projections are for educational purposes only and should not be considered financial advice. 
                Cryptocurrency investments are highly volatile and speculative. Past performance does not guarantee 
                future results. Always do your own research and consider consulting with a financial advisor.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-6 text-center text-gray-400">
        <p>Bitcoin Investment Simulator - Educational Tool Only</p>
          <p className="text-sm mt-2">
            Real-time data powered by CoinGecko API • Built with React & FastAPI
          </p>
        </div>
      </footer>
    </div>
  );
};

export default BitcoinInvestmentSimulator;