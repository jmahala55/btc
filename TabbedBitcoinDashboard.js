import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Brain, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

// Import your existing components
import BitcoinTerminalDashboard from './BitcoinTerminalDashboard';
import BitcoinForecastingDashboard from './BitcoinForecastingDashboard';

const TabbedBitcoinDashboard = () => {
  const [activeTab, setActiveTab] = useState('terminal');
  const [currentPrice, setCurrentPrice] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // API Base URL
  const API_BASE = 'http://127.0.0.1:8000';

  // Shared price fetching for both tabs
  const fetchCurrentPrice = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/price`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setCurrentPrice(data);
    } catch (error) {
      console.error('Error fetching price:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize price data
  useEffect(() => {
    fetchCurrentPrice();
    
    // Update price every 5 minutes
    const interval = setInterval(fetchCurrentPrice, 300000);
    return () => clearInterval(interval);
  }, [fetchCurrentPrice]);

  // Tab configuration
  const tabs = [
    {
      id: 'terminal',
      name: 'Trading Terminal',
      icon: BarChart3,
      description: 'Real-time charts and technical analysis'
    },
    {
      id: 'forecasting',
      name: 'AI Forecasting',
      icon: Brain,
      description: 'Multi-model price predictions'
    }
  ];

  const formatPrice = (value) => {
    if (typeof value !== 'number') return '--';
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="min-h-screen" style={{background: '#000000', color: 'var(--text-primary)'}}>
      {/* Unified Header */}
      <div className="terminal-header" style={{background: '#000000', borderBottom: '1px solid #222222'}}>
        {/* Top Bar with Price */}
        <div className="px-6 py-4" style={{borderBottom: '1px solid var(--border-primary)'}}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
            <h1 className="text-3xl font-light flex items-center tracking-wide" style={{
  color: '#ffffff',
  fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
  letterSpacing: '0.02em'
}}>
  <span className="text-4xl mr-4" style={{
    background: 'linear-gradient(135deg, #f7931a, #ff6b35)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  }}>⚛</span>
  <span style={{fontWeight: 300}}>MAHALA</span>
  <span style={{
    fontWeight: 600,
    marginLeft: '8px',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  }}>QUANTUM</span>
</h1>
              {currentPrice && (
                <div className="flex items-center space-x-4">
                  <span className="text-3xl price-display">
                    {formatPrice(currentPrice.price)}
                  </span>
                  <span className={`flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
  (currentPrice.change_24h || 0) >= 0 ? 'price-change-positive' : 'price-change-negative'
}`}>
                    {(currentPrice.change_24h || 0) >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                    {(currentPrice.change_24h || 0).toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
            
            <button
              onClick={fetchCurrentPrice}
              disabled={isLoading}
              className="btn-secondary p-2 rounded-lg disabled:opacity-50"
              title="Refresh Price"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6">
          <div className="flex space-x-1">
            {tabs.map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-6 py-4 text-sm font-medium relative ${
                    activeTab === tab.id
                      ? 'text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  style={{
                    background: activeTab === tab.id ? 'var(--bg-quaternary)' : 'transparent',
                    transition: 'var(--transition-fast)'
                  }}
                >
                  <IconComponent className="w-4 h-4 mr-2" />
                  <div className="text-left">
                    <div className="font-semibold">{tab.name}</div>
                    <div className="text-xs opacity-75">{tab.description}</div>
                  </div>
                  
                  {/* Active tab indicator */}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{background: 'var(--color-bitcoin)'}}></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1">
        {activeTab === 'terminal' && (
          <BitcoinTerminalDashboard 
            currentPrice={currentPrice} 
            onPriceUpdate={setCurrentPrice}
          />
        )}

        {activeTab === 'forecasting' && (
          <BitcoinForecastingDashboard 
            currentPrice={currentPrice}
            onPriceUpdate={setCurrentPrice}
          />
        )}
      </div>

      {/* Status Bar */}
      <div className="px-6 py-2 flex items-center justify-between text-xs" style={{
  background: 'var(--bg-secondary)', 
  borderTop: '1px solid var(--border-primary)',
  color: 'var(--text-muted)'
}}>
        <div className="flex items-center space-x-4">
          <span>Active Tab: {tabs.find(t => t.id === activeTab)?.name}</span>
          <span>•</span>
          <span>API Status: Connected</span>
          <span>•</span>
          <span>Last Update: {new Date().toLocaleTimeString()}</span>
        </div>
        <div className="flex items-center space-x-4">
        <div className={`flex items-center space-x-1 ${isLoading ? 'status-loading' : 'status-connected'}`}>
        <div className={`w-2 h-2 rounded-full ${isLoading ? 'animate-pulse' : ''}`} style={{
  background: isLoading ? 'var(--color-warning)' : 'var(--color-success)'
}}></div>
            <span>{isLoading ? 'Updating...' : 'Live'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TabbedBitcoinDashboard;