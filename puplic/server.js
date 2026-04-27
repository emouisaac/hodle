const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const MARKET_CACHE_TTL_MS = 60 * 1000;
const MARKET_FEED_URL = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h';
const FALLBACK_MARKET_DATA = [
  { rank: 1, symbol: 'BTC', name: 'Bitcoin', price: null, change24h: null },
  { rank: 2, symbol: 'ETH', name: 'Ethereum', price: null, change24h: null },
  { rank: 3, symbol: 'USDT', name: 'Tether', price: null, change24h: null },
  { rank: 4, symbol: 'XRP', name: 'XRP', price: null, change24h: null },
  { rank: 5, symbol: 'BNB', name: 'BNB', price: null, change24h: null },
  { rank: 6, symbol: 'SOL', name: 'Solana', price: null, change24h: null },
  { rank: 7, symbol: 'USDC', name: 'USDC', price: null, change24h: null },
  { rank: 8, symbol: 'DOGE', name: 'Dogecoin', price: null, change24h: null },
  { rank: 9, symbol: 'ADA', name: 'Cardano', price: null, change24h: null },
  { rank: 10, symbol: 'TRX', name: 'TRON', price: null, change24h: null },
  { rank: 11, symbol: 'AVAX', name: 'Avalanche', price: null, change24h: null },
  { rank: 12, symbol: 'TON', name: 'Toncoin', price: null, change24h: null },
  { rank: 13, symbol: 'LINK', name: 'Chainlink', price: null, change24h: null },
  { rank: 14, symbol: 'SHIB', name: 'Shiba Inu', price: null, change24h: null },
  { rank: 15, symbol: 'DOT', name: 'Polkadot', price: null, change24h: null },
  { rank: 16, symbol: 'BCH', name: 'Bitcoin Cash', price: null, change24h: null },
  { rank: 17, symbol: 'NEAR', name: 'NEAR Protocol', price: null, change24h: null },
  { rank: 18, symbol: 'LTC', name: 'Litecoin', price: null, change24h: null },
  { rank: 19, symbol: 'ICP', name: 'Internet Computer', price: null, change24h: null },
  { rank: 20, symbol: 'UNI', name: 'Uniswap', price: null, change24h: null }
];

let marketCache = {
  expiresAt: 0,
  data: null,
  updatedAt: null
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'HodleMarketTicker/1.0'
        }
      },
      (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          response.resume();
          reject(new Error(`Upstream request failed with status ${response.statusCode}`));
          return;
        }

        let raw = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          raw += chunk;
        });
        response.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (error) {
            reject(new Error('Failed to parse upstream market data'));
          }
        });
      }
    );

    request.setTimeout(10000, () => {
      request.destroy(new Error('Upstream request timed out'));
    });
    request.on('error', reject);
  });
}

function normalizeMarketData(entries) {
  return (Array.isArray(entries) ? entries : [])
    .slice(0, 20)
    .map((entry, index) => ({
      rank: Number.isFinite(entry.market_cap_rank) ? entry.market_cap_rank : index + 1,
      symbol: String(entry.symbol || '').toUpperCase(),
      name: String(entry.name || 'Unknown'),
      price: Number.isFinite(entry.current_price) ? entry.current_price : null,
      change24h: Number.isFinite(entry.price_change_percentage_24h) ? entry.price_change_percentage_24h : null
    }))
    .filter((entry) => entry.symbol);
}

async function getMarketTicker() {
  const now = Date.now();
  if (marketCache.data && now < marketCache.expiresAt) {
    return {
      data: marketCache.data,
      source: 'live',
      updatedAt: marketCache.updatedAt
    };
  }

  try {
    const upstreamData = await fetchJson(MARKET_FEED_URL);
    const normalized = normalizeMarketData(upstreamData);
    if (!normalized.length) {
      throw new Error('Market feed returned no coins');
    }

    marketCache = {
      data: normalized,
      updatedAt: new Date().toISOString(),
      expiresAt: now + MARKET_CACHE_TTL_MS
    };

    return {
      data: normalized,
      source: 'live',
      updatedAt: marketCache.updatedAt
    };
  } catch (error) {
    return {
      data: marketCache.data || FALLBACK_MARKET_DATA,
      source: marketCache.data ? 'cached' : 'fallback',
      updatedAt: marketCache.updatedAt,
      error: error.message
    };
  }
}

async function handleCryptoTicker(res) {
  try {
    const marketTicker = await getMarketTicker();
    sendJson(res, 200, marketTicker);
  } catch (error) {
    sendJson(res, 500, {
      data: FALLBACK_MARKET_DATA,
      source: 'fallback',
      error: error.message
    });
  }
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.css':
      return 'text/css';
    case '.js':
      return 'text/javascript';
    case '.json':
      return 'application/json';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'text/html';
  }
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (requestUrl.pathname === '/api/crypto-ticker') {
    handleCryptoTicker(res);
    return;
  }

  const relativePath = requestUrl.pathname === '/' ? 'index.html' : decodeURIComponent(requestUrl.pathname.replace(/^\/+/, ''));
  let filePath = path.join(__dirname, relativePath);

  fs.access(filePath, fs.constants.F_OK, (accessError) => {
    if (accessError) {
      filePath = path.join(__dirname, 'index.html');
    }

    fs.readFile(filePath, (readError, data) => {
      if (readError) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('File not found');
        return;
      }

      res.writeHead(200, { 'Content-Type': `${getContentType(filePath)}; charset=utf-8` });
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
