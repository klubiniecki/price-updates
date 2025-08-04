import nodemailer from 'nodemailer';
import cron from 'node-cron';
import fetch from 'node-fetch';

// Environment variables (set these in your hosting platform)
const EMAIL_USER = process.env.EMAIL_USER || 'your-gmail@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'your-app-password';
const RECIPIENT_EMAIL = process.env.RECIPIENT_EMAIL || 'recipient@example.com';

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

// Create email transporter using Gmail
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS, // Use App Password, not regular password
  },
});

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
    
    const data: CoinGeckoResponse = await response.json();
    
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

function formatPriceEmail(prices: CryptoPrice[]): string {
  const date = new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane',
    dateStyle: 'full',
    timeStyle: 'short'
  });

  let emailBody = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        .price-container { margin: 20px 0; }
        .token { 
            background: #f8f9fa; 
            border-left: 4px solid #3498db; 
            padding: 15px; 
            margin: 10px 0; 
            border-radius: 5px; 
        }
        .price { font-size: 1.2em; font-weight: bold; color: #2c3e50; }
        .change { font-weight: bold; }
        .positive { color: #27ae60; }
        .negative { color: #e74c3c; }
        .footer { margin-top: 30px; font-size: 0.9em; color: #7f8c8d; }
    </style>
</head>
<body>
    <div class="header">
        <h2>🚀 Daily Crypto Price Report</h2>
        <p>Generated on: ${date}</p>
    </div>
    
    <div class="price-container">
`;

  prices.forEach(token => {
    const changeClass = token.price_change_percentage_24h >= 0 ? 'positive' : 'negative';
    const changeSymbol = token.price_change_percentage_24h >= 0 ? '▲' : '▼';
    
    emailBody += `
        <div class="token">
            <h3>${token.symbol}</h3>
            <div class="price">$${token.current_price.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 8
            })}</div>
            <div class="change ${changeClass}">
                ${changeSymbol} ${token.price_change_percentage_24h.toFixed(2)}% (24h)
            </div>
        </div>
    `;
  });

  emailBody += `
    </div>
    
    <div class="footer">
        <p>Data provided by CoinGecko API</p>
        <p>This is an automated message sent daily at 11:00 AM Brisbane time.</p>
    </div>
</body>
</html>
`;

  return emailBody;
}

async function sendPriceEmail(): Promise<void> {
  try {
    console.log('Fetching crypto prices...');
    const prices = await getCryptoPrices();
    
    if (prices.length === 0) {
      throw new Error('No price data retrieved');
    }

    const emailContent = formatPriceEmail(prices);
    
    const mailOptions = {
      from: EMAIL_USER,
      to: RECIPIENT_EMAIL,
      subject: `Daily Crypto Report - ${new Date().toLocaleDateString('en-AU')}`,
      html: emailContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    
  } catch (error) {
    console.error('Error sending email:', error);
    // In production, you might want to send this error to a monitoring service
  }
}

// Schedule the job to run at 11:00 AM Brisbane time every day
// Cron expression: minute hour day month dayOfWeek
// Brisbane is UTC+10 (AEST) or UTC+11 (AEDT during daylight saving)
// For simplicity, using UTC+10. You may want to handle DST separately.
const cronExpression = '0 1 * * *'; // 1:00 AM UTC = 11:00 AM Brisbane (UTC+10)

console.log('Starting crypto price email scheduler...');
console.log(`Scheduled to run daily at 11:00 AM Brisbane time`);

// Schedule the cron job
cron.schedule(cronExpression, () => {
  console.log('Running scheduled crypto price email...');
  sendPriceEmail();
}, {
  scheduled: true,
  timezone: 'Australia/Brisbane' // This handles DST automatically
});

// Optional: Send a test email immediately when the app starts
// Uncomment the next line for testing
// sendPriceEmail();

// Keep the application running
console.log('Crypto price emailer is running...');
console.log('Press Ctrl+C to stop the application');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

export { sendPriceEmail, getCryptoPrices };
