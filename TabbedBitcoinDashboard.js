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
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Unified Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        {/* Top Bar with Price */}
        <div className="px-6 py-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <h1 className="text-2xl font-bold text-yellow-500 flex items-center">
                <span className="text-3xl mr-3">₿</span>
                Bitcoin Professional Suite
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
                    {(currentPrice.change_24h || 0).toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
            
            <button
              onClick={fetchCurrentPrice}
              disabled={isLoading}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
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
                  className={`flex items-center px-6 py-4 text-sm font-medium transition-colors relative ${
                    activeTab === tab.id
                      ? 'text-white bg-gray-700'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-750'
                  }`}
                >
                  <IconComponent className="w-4 h-4 mr-2" />
                  <div className="text-left">
                    <div className="font-semibold">{tab.name}</div>
                    <div className="text-xs opacity-75">{tab.description}</div>
                  </div>
                  
                  {/* Active tab indicator */}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500"></div>
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
      <div className="bg-gray-800 border-t border-gray-700 px-6 py-2 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center space-x-4">
          <span>Active Tab: {tabs.find(t => t.id === activeTab)?.name}</span>
          <span>•</span>
          <span>API Status: Connected</span>
          <span>•</span>
          <span>Last Update: {new Date().toLocaleTimeString()}</span>
        </div>
        <div className="flex items-center space-x-4">
          <div className={`flex items-center space-x-1 ${isLoading ? 'text-yellow-400' : 'text-green-400'}`}>
            <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></div>
            <span>{isLoading ? 'Updating...' : 'Live'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TabbedBitcoinDashboard;