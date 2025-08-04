import { createServer } from 'http';
import { URL } from 'url';

const PORT = process.env.PORT || 3000;
const COOKIE_HOLDINGS = 190000; // Your COOKIE token holdings

interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
}

interface CoinGeckoResponse {
  [key: string]: {
    usd: number;
    usd_24h_change: number;
    aud?: number;
  };
}

interface ExchangeRateResponse {
  rates: {
    AUD: number;
  };
}

// Crypto token mappings (CoinGecko IDs)
const CRYPTO_TOKENS = {
  'COOKIE': 'cookie',
  'BTC': 'bitcoin',
  'KAITO': 'kaito'
};

async function getExchangeRate(): Promise<number> {
  try {
    // Using a free exchange rate API
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status}`);
    }
    const data: ExchangeRateResponse = await response.json() as ExchangeRateResponse;
    return data.rates.AUD;
  } catch (error) {
    console.error('Error fetching exchange rate, using fallback:', error);
    return 1.55; // Fallback AUD/USD rate
  }
}

async function getCryptoPrices(): Promise<{ prices: CryptoPrice[], usdToAud: number }> {
  try {
    const tokenIds = Object.values(CRYPTO_TOKENS).join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${tokenIds}&vs_currencies=usd&include_24hr_change=true`;
    
    console.log('Fetching crypto prices...');
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: CoinGeckoResponse = await response.json() as CoinGeckoResponse;
    
    const prices: CryptoPrice[] = [];
    
    for (const [symbol, coinGeckoId] of Object.entries(CRYPTO_TOKENS)) {
      const priceData = data[coinGeckoId];
      if (priceData) {
        prices.push({
          id: coinGeckoId,
          symbol: symbol,
          name: symbol,
          current_price: priceData.usd,
          price_change_percentage_24h: priceData.usd_24h_change || 0
        });
      }
    }
    
    console.log(`Fetched ${prices.length} crypto prices successfully`);
    return prices;
  } catch (error) {
    console.error('Error fetching crypto prices:', error);
    throw error;
  }
}

function generateHTML(prices: CryptoPrice[], usdToAud: number, error?: string): string {
  const now = new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane',
    dateStyle: 'full',
    timeStyle: 'medium'
  });

  // Calculate portfolio value for COOKIE tokens
  const cookiePrice = prices.find(p => p.symbol === 'COOKIE');
  const portfolioValueUSD = cookiePrice ? cookiePrice.current_price * COOKIE_HOLDINGS : 0;
  const portfolioValueAUD = portfolioValueUSD * usdToAud;
  const portfolioChange24h = cookiePrice ? cookiePrice.price_change_percentage_24h : 0;
  const portfolioChangeUSD = portfolioValueUSD * (portfolioChange24h / 100);
  const portfolioChangeAUD = portfolioChangeUSD * usdToAud;

  const portfolioCard = cookiePrice ? `
    <div class="portfolio-section">
      <h2 class="portfolio-title">💰 Your COOKIE Portfolio</h2>
      <div class="portfolio-card">
        <div class="portfolio-holdings">
          <span class="holdings-label">Holdings:</span>
          <span class="holdings-amount">${COOKIE_HOLDINGS.toLocaleString()} COOKIE</span>
        </div>
        
        <div class="portfolio-values">
          <div class="portfolio-value">
            <div class="currency-label">USD Value</div>
            <div class="value-amount usd">${portfolioValueUSD.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}</div>
            <div class="value-change ${portfolioChange24h >= 0 ? 'positive' : 'negative'}">
              ${portfolioChange24h >= 0 ? '+' : ''}${Math.abs(portfolioChangeUSD).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })} (24h)
            </div>
          </div>
          
          <div class="portfolio-value">
            <div class="currency-label">AUD Value</div>
            <div class="value-amount aud">${portfolioValueAUD.toLocaleString('en-AU', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })} AUD</div>
            <div class="value-change ${portfolioChange24h >= 0 ? 'positive' : 'negative'}">
              ${portfolioChange24h >= 0 ? '+' : ''}${Math.abs(portfolioChangeAUD).toLocaleString('en-AU', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })} AUD (24h)
            </div>
          </div>
        </div>
        
        <div class="exchange-rate">
          Exchange Rate: 1 USD = ${usdToAud.toFixed(4)} AUD
        </div>
      </div>
    </div>
  ` : '';

  const priceCards = prices.map(token => {
    const changeClass = token.price_change_percentage_24h >= 0 ? 'positive' : 'negative';
    const changeSymbol = token.price_change_percentage_24h >= 0 ? '▲' : '▼';
    const changeColor = token.price_change_percentage_24h >= 0 ? '#10b981' : '#ef4444';
    
    return `
      <div class="price-card">
        <div class="token-symbol">${token.symbol}</div>
        <div class="token-price">${token.current_price.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 8
        })}</div>
        <div class="token-change" style="color: ${changeColor}">
          ${changeSymbol} ${token.price_change_percentage_24h.toFixed(2)}% (24h)
        </div>
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🚀 Crypto Price Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            color: #333;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            color: white;
        }
        
        .header h1 {
            font-size: 3rem;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .header .subtitle {
            font-size: 1.2rem;
            opacity: 0.9;
            margin-bottom: 20px;
        }
        
        .last-updated {
            background: rgba(255,255,255,0.2);
            padding: 10px 20px;
            border-radius: 25px;
            display: inline-block;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.3);
        }
        
        .price-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            margin-bottom: 40px;
        }
        
        .price-card {
            background: rgba(255,255,255,0.95);
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            text-align: center;
        }
        
        .price-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 30px 60px rgba(0,0,0,0.2);
        }
        
        .token-symbol {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 15px;
            color: #4f46e5;
        }
        
        .token-price {
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 15px;
            color: #1f2937;
        }
        
        .token-change {
            font-size: 1.2rem;
            font-weight: 600;
        }
        
        .controls {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .refresh-btn {
            background: linear-gradient(45deg, #10b981, #059669);
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 1.1rem;
            border-radius: 25px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
        }
        
        .refresh-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
        }
        
        .auto-refresh {
            margin-top: 15px;
            color: white;
            opacity: 0.8;
        }
        
        .error {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #dc2626;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            text-align: center;
        }
        
        .footer {
            text-align: center;
            color: white;
            opacity: 0.7;
            margin-top: 40px;
        }
        
        .portfolio-section {
            margin-bottom: 50px;
        }
        
        .portfolio-title {
            text-align: center;
            color: white;
            font-size: 2.5rem;
            margin-bottom: 30px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .portfolio-card {
            background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.85));
            border-radius: 25px;
            padding: 40px;
            box-shadow: 0 25px 50px rgba(0,0,0,0.15);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            max-width: 800px;
            margin: 0 auto;
        }
        
        .portfolio-holdings {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid rgba(79, 70, 229, 0.2);
        }
        
        .holdings-label {
            font-size: 1.2rem;
            color: #6b7280;
            display: block;
            margin-bottom: 10px;
        }
        
        .holdings-amount {
            font-size: 2rem;
            font-weight: bold;
            color: #4f46e5;
        }
        
        .portfolio-values {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 25px;
        }
        
        .portfolio-value {
            text-align: center;
            padding: 20px;
            background: rgba(79, 70, 229, 0.05);
            border-radius: 15px;
            border: 1px solid rgba(79, 70, 229, 0.1);
        }
        
        .currency-label {
            font-size: 1rem;
            color: #6b7280;
            margin-bottom: 10px;
            font-weight: 600;
        }
        
        .value-amount {
            font-size: 2.2rem;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .value-amount.usd {
            color: #059669;
        }
        
        .value-amount.aud {
            color: #dc2626;
        }
        
        .value-change {
            font-size: 1rem;
            font-weight: 600;
        }
        
        .positive {
            color: #10b981;
        }
        
        .negative {
            color: #ef4444;
        }
        
        .exchange-rate {
            text-align: center;
            color: #6b7280;
            font-size: 0.9rem;
            font-style: italic;
        }
        
        @media (max-width: 768px) {
            .header h1 {
                font-size: 2rem;
            }
            
            .price-grid {
                grid-template-columns: 1fr;
                gap: 20px;
            }
            
            .token-price {
                font-size: 2rem;
            }
            
            .portfolio-title {
                font-size: 2rem;
            }
            
            .portfolio-values {
                grid-template-columns: 1fr;
                gap: 20px;
            }
            
            .value-amount {
                font-size: 1.8rem;
            }
        }
        
        .loading {
            text-align: center;
            color: white;
            font-size: 1.2rem;
            margin: 20px 0;
        }
        
        .spinner {
            border: 4px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top: 4px solid white;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Crypto Price Dashboard</h1>
            <div class="subtitle">Live prices for COOKIE, BTC & KAITO</div>
            <div class="last-updated">
                📅 Last updated: ${now}
            </div>
        </div>
        
        ${error ? `<div class="error">❌ Error: ${error}</div>` : ''}
        
        ${portfolioCard}
        
        <div class="controls">
            <button class="refresh-btn" onclick="refreshPrices()">
                🔄 Refresh Prices
            </button>
            <div class="auto-refresh">
                🔄 Auto-refreshes every 5 minutes
            </div>
        </div>
        
        <div class="price-grid">
            ${priceCards || '<div class="loading"><div class="spinner"></div>Loading prices...</div>'}
        </div>
        
        <div class="footer">
            <p>📊 Data provided by CoinGecko API</p>
            <p>🌏 Times shown in Brisbane timezone</p>
        </div>
    </div>
    
    <script>
        // Auto-refresh every 5 minutes
        setInterval(() => {
            location.reload();
        }, 5 * 60 * 1000);
        
        function refreshPrices() {
            location.reload();
        }
        
        // Add some loading animation when refreshing
        function showLoading() {
            document.querySelector('.price-grid').innerHTML = 
                '<div class="loading"><div class="spinner"></div>Refreshing prices...</div>';
        }
    </script>
</body>
</html>
  `;
}

// Create HTTP server
const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (url.pathname === '/api/prices') {
    // API endpoint for prices
    try {
      const { prices, usdToAud } = await getCryptoPrices();
      const cookiePrice = prices.find(p => p.symbol === 'COOKIE');
      const portfolioValueUSD = cookiePrice ? cookiePrice.current_price * COOKIE_HOLDINGS : 0;
      const portfolioValueAUD = portfolioValueUSD * usdToAud;
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: prices,
        portfolio: {
          holdings: COOKIE_HOLDINGS,
          valueUSD: portfolioValueUSD,
          valueAUD: portfolioValueAUD,
          change24h: cookiePrice?.price_change_percentage_24h || 0
        },
        exchangeRate: {
          usdToAud: usdToAud
        },
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  } else {
    // Main dashboard page
    try {
      const { prices, usdToAud } = await getCryptoPrices();
      const html = generateHTML(prices, usdToAud);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (error) {
      const html = generateHTML([], 1.55, error instanceof Error ? error.message : 'Failed to fetch prices');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    }
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Crypto Price Dashboard running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔌 API: http://localhost:${PORT}/api/prices`);
});

console.log('Starting Crypto Price Dashboard...');

export { getCryptoPrices };