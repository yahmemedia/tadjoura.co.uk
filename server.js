const http = require('http');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const stripeSecretKey =
  process.env.STRIPE_SECRET_KEY ||
  process.env.STRIPE_SECRET ||
  process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY ||
  process.env.STRIPE_SK;

const stripe = stripeSecretKey ? require('stripe')(stripeSecretKey) : null;

const port = Number(process.env.PORT) || 4242;

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf'
};

function sendJson(res, statusCode, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function tryServeFile(res, filePath) {
  return new Promise((resolve) => {
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) return resolve(false);

      const ext = path.extname(filePath).toLowerCase();
      const type = contentTypes[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': type,
        'Cache-Control': 'no-cache'
      });

      const stream = fs.createReadStream(filePath);
      stream.on('error', () => {
        if (!res.headersSent) res.writeHead(500);
        res.end('Internal Server Error');
      });
      stream.pipe(res);
      resolve(true);
    });
  });
}

const server = http.createServer(async (req, res) => {
  const method = req.method || 'GET';

  const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(urlObj.pathname);

  if (pathname === '/api/checkout') {
    if (method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    if (!stripe) {
      return sendJson(res, 500, {
        error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in .env.local.'
      });
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON body' });
    }

    const items = Array.isArray(body) ? body : body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return sendJson(res, 400, {
        error: 'Expected an array of items (or { items: [...] })'
      });
    }

    const lineItems = [];
    for (const item of items) {
      const priceId = item?.priceId || item?.price;
      const quantity = Number(item?.quantity);

      if (typeof priceId !== 'string' || !priceId.trim()) {
        return sendJson(res, 400, { error: 'Each item requires a priceId' });
      }

      if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
        return sendJson(res, 400, { error: 'Each item requires quantity 1-99' });
      }

      lineItems.push({ price: priceId, quantity: Math.floor(quantity) });
    }

    const origin = req.headers.origin || `${urlObj.protocol}//${urlObj.host}`;

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: lineItems,
        success_url: `${origin}/order-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/cart`
      });

      return sendJson(res, 200, { url: session.url });
    } catch (e) {
      return sendJson(res, 500, { error: 'Failed to create Checkout Session' });
    }
  }

  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405);
    return res.end('Method Not Allowed');
  }

  if (pathname === '/order-success') {
    const successFile = path.join(__dirname, 'order-success.html');
    if (await tryServeFile(res, successFile)) return;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<!doctype html><html><head><meta charset="utf-8"><title>Order Success</title></head><body><h1>Order success</h1></body></html>');
  }

  if (pathname === '/cart') {
    const cartFile = path.join(__dirname, 'cart.html');
    if (await tryServeFile(res, cartFile)) return;
    res.writeHead(302, { Location: '/springcollection.html' });
    return res.end();
  }

  if (pathname === '/' || pathname === '') {
    const candidateHomeFiles = ['tadjoura-index.html', 'temp-index.html', 'index.html'];
    for (const name of candidateHomeFiles) {
      const fp = path.join(__dirname, name);
      if (await tryServeFile(res, fp)) return;
    }
  }

  const resolvedRoot = path.resolve(__dirname);
  const resolvedTarget = path.resolve(__dirname, '.' + pathname);
  if (!resolvedTarget.toLowerCase().startsWith(resolvedRoot.toLowerCase())) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (await tryServeFile(res, resolvedTarget)) return;

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(port, () => {
  process.stdout.write(`Server running at http://localhost:${port}\n`);
});
