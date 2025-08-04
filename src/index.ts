import cron from 'node-cron';

// Environment variables (set these in your hosting platform)
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const CHAT_ID = process.env.CHAT_ID || '';

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
  };
}

// Crypto token mappings (CoinGecko IDs)
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
      const errorData = await response.json();
      throw new Error(`Telegram API error: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
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

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

export { sendCryptoPriceUpdate, getCryptoPrices, sendTestMessage };