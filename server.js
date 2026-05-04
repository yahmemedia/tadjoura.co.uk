const express = require('express');
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

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

const rootDir = path.resolve(__dirname);

function safePathJoin(root, unsafePath) {
  const candidate = path.resolve(root, unsafePath);
  if (!candidate.toLowerCase().startsWith(root.toLowerCase())) return null;
  return candidate;
}

async function fileExists(filePath) {
  try {
    const stat = await fs.promises.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function sendHtmlFallback(res, title, bodyHtml) {
  res
    .status(200)
    .type('html')
    .send(
      `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${bodyHtml}</body></html>`
    );
}

app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (!req.path.toLowerCase().endsWith('.html')) return next();

  const urlObj = new URL(req.originalUrl, `http://${req.headers.host || 'localhost'}`);
  const withoutExt = req.path.slice(0, -'.html'.length);
  const destPath = withoutExt === '/index' ? '/' : withoutExt || '/';
  return res.redirect(301, destPath + urlObj.search);
});

app.use((req, res, next) => {
  const blockedExact = new Set(['/server.js', '/package.json', '/package-lock.json']);
  if (blockedExact.has(req.path)) return res.status(404).type('text').send('Not Found');
  if (req.path.startsWith('/.')) return res.status(404).type('text').send('Not Found');
  return next();
});

app.post('/api/checkout', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({
      error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in .env.local.'
    });
  }

  const items = Array.isArray(req.body) ? req.body : req.body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: 'Expected an array of items (or { items: [...] })'
    });
  }

  const lineItems = [];
  for (const item of items) {
    const priceId = item?.priceId || item?.price;
    const quantity = Number(item?.quantity);

    if (typeof priceId !== 'string' || !priceId.trim()) {
      return res.status(400).json({ error: 'Each item requires a priceId' });
    }

    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
      return res.status(400).json({ error: 'Each item requires quantity 1-99' });
    }

    lineItems.push({ price: priceId, quantity: Math.floor(quantity) });
  }

  const origin = `${req.protocol}://${req.get('host')}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${origin}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart`
    });

    return res.status(200).json({ url: session.url });
  } catch {
    return res.status(500).json({ error: 'Failed to create Checkout Session' });
  }
});

app.get('/order-success', async (req, res) => {
  const filePath = safePathJoin(rootDir, 'order-success.html');
  if (filePath && (await fileExists(filePath))) return res.sendFile(filePath);
  return sendHtmlFallback(res, 'Order Success', '<h1>Order success</h1>');
});

app.get('/cart', async (req, res) => {
  const filePath = safePathJoin(rootDir, 'cart.html');
  if (filePath && (await fileExists(filePath))) return res.sendFile(filePath);
  return res.redirect(302, '/springcollection');
});

app.get('/', async (req, res) => {
  const filePath = safePathJoin(rootDir, 'index.html');
  if (filePath && (await fileExists(filePath))) return res.sendFile(filePath);
  return res.status(404).type('text').send('Not Found');
});

app.use(express.static(rootDir, { dotfiles: 'deny', index: false, maxAge: 0 }));

app.get('*', async (req, res) => {
  if (path.extname(req.path)) return res.status(404).type('text').send('Not Found');

  const slug = req.path.replace(/^\/+/, '');
  if (!slug) return res.status(404).type('text').send('Not Found');

  const filePath = safePathJoin(rootDir, `${slug}.html`);
  if (filePath && (await fileExists(filePath))) return res.sendFile(filePath);

  return res.status(404).type('text').send('Not Found');
});

const port = Number(process.env.PORT) || 4242;
if (require.main === module) {
  app.listen(port, () => {
    process.stdout.write(`Server running at http://localhost:${port}\n`);
  });
}

module.exports = app;
