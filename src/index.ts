import cron from 'node-cron';
import { createServer } from 'http';

// Environment variables (set these in your hosting platform)
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const CHAT_ID = process.env.CHAT_ID || '';
const PORT = process.env.PORT || 3000;

interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
}

interface TelegramResponse {
  ok: boolean;
  result?: {
    message_id: number;
    [key: string]: any;
  };
  error_code?: number;
  description?: string;
}

interface CoinGeckoResponse {
  [key: string]: {
    usd: number;
    usd_24h_change: number;
  };
}
const CRYPTO_TOKENS = {
  'COOKIE': 'cookie-dao', // Cookie DAO token
  'BTC': 'bitcoin',
  'KAITO': 'kaito-ai' // Kaito AI token
};

async function getCryptoPrices(): Promise<CryptoPrice[]> {
  try {
    const tokenIds = Object.values(CRYPTO_TOKENS).join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${tokenIds}&vs_currencies=usd&include_24hr_change=true`;
    
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
    
    return prices;
  } catch (error) {
    console.error('Error fetching crypto prices:', error);
    throw error;
  }
}

function formatTelegramMessage(prices: CryptoPrice[]): string {
  const date = new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane',
    dateStyle: 'full',
    timeStyle: 'short'
  });

  let message = `🚀 *Daily Crypto Price Report*\n`;
  message += `📅 ${date}\n\n`;

  prices.forEach(token => {
    const changeEmoji = token.price_change_percentage_24h >= 0 ? '📈' : '📉';
    const changeSymbol = token.price_change_percentage_24h >= 0 ? '+' : '';
    const price = token.current_price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    });
    
    message += `*${token.symbol}*\n`;
    message += `💰 ${price}\n`;
    message += `${changeEmoji} ${changeSymbol}${token.price_change_percentage_24h.toFixed(2)}% (24h)\n\n`;
  });

  message += `📊 _Data provided by CoinGecko API_\n`;
  message += `⏰ _Sent daily at 11:00 AM Brisbane time_`;

  return message;
}

async function sendTelegramMessage(message: string): Promise<void> {
  try {
    console.log('Sending Telegram message...');
    console.log('Bot token:', BOT_TOKEN ? 'Set' : 'Not set');
    console.log('Chat ID:', CHAT_ID ? 'Set' : 'Not set');
    
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    
    const payload = {
      chat_id: CHAT_ID,
      text: message,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData: TelegramResponse = await response.json() as TelegramResponse;
      throw new Error(`Telegram API error: ${JSON.stringify(errorData)}`);
    }

    const result: TelegramResponse = await response.json() as TelegramResponse;
    console.log('Telegram message sent successfully:', result.result?.message_id);
    
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    throw error;
  }
}

async function sendCryptoPriceUpdate(): Promise<void> {
  try {
    console.log('Starting crypto price update...');
    
    console.log('Fetching crypto prices...');
    const prices = await getCryptoPrices();
    
    if (prices.length === 0) {
      throw new Error('No price data retrieved');
    }

    console.log('Crypto prices fetched successfully:', prices.length, 'tokens');
    
    const message = formatTelegramMessage(prices);
    
    await sendTelegramMessage(message);
    
  } catch (error) {
    console.error('Error in crypto price update:', error);
    
    // Send error message to Telegram if possible
    if (BOT_TOKEN && CHAT_ID) {
      try {
        const errorMessage = `❌ *Crypto Price Update Failed*\n\n` +
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
          `Time: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })}`;
        
        await sendTelegramMessage(errorMessage);
      } catch (telegramError) {
        console.error('Failed to send error message to Telegram:', telegramError);
      }
    }
  }
}

// Test function to send message immediately
async function sendTestMessage(): Promise<void> {
  console.log('Sending test message...');
  await sendCryptoPriceUpdate();
}

// Schedule the job to run at 11:00 AM Brisbane time every day
// Using Brisbane timezone to handle DST automatically
const cronExpression = '0 11 * * *'; // 11:00 AM Brisbane time

console.log('Starting crypto price Telegram bot...');
console.log(`Scheduled to run daily at 11:00 AM Brisbane time`);

// Schedule the cron job
cron.schedule(cronExpression, () => {
  console.log('Running scheduled crypto price update...');
  sendCryptoPriceUpdate();
}, {
  scheduled: true,
  timezone: 'Australia/Brisbane' // This handles DST automatically
});

// Optional: Send a test message immediately when the app starts
// Uncomment the next line for testing
// sendTestMessage();

// Keep the application running
console.log('Crypto price Telegram bot is running...');
console.log('Press Ctrl+C to stop the application');

// Create a simple HTTP server to keep Railway happy
const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      uptime: process.uptime(),
      nextSchedule: '11:00 AM Brisbane time daily',
      botConfigured: !!BOT_TOKEN && !!CHAT_ID
    }));
  } else if (req.url === '/test') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Triggering test message...');
    sendTestMessage().catch(console.error);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head><title>Crypto Price Telegram Bot</title></head>
        <body>
          <h1>🚀 Crypto Price Telegram Bot</h1>
          <p>Bot is running and scheduled to send daily updates at 11:00 AM Brisbane time.</p>
          <p>Status: ${BOT_TOKEN && CHAT_ID ? '✅ Configured' : '❌ Missing configuration'}</p>
          <p>Uptime: ${Math.floor(process.uptime())} seconds</p>
          <hr>
          <p><a href="/health">Health Check</a> | <a href="/test">Send Test Message</a></p>
        </body>
      </html>
    `);
  }
});

server.listen(PORT, () => {
  console.log(`HTTP server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Test message: http://localhost:${PORT}/test`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

export { sendCryptoPriceUpdate, getCryptoPrices, sendTestMessage };