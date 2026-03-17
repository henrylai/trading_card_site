/**
 * PokéMarket92 — Monorepo Server
 * Express.js server that:
 *   1. Serves the static frontend from /public
 *   2. Provides /api/ebay and /api/instagram endpoints
 *
 * Deploy to Railway — run: node server.js
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const cheerio = require('cheerio');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests, please slow down.' }
}));

// Serve static frontend files from /public
app.use(express.static(path.join(__dirname, 'public')));

// ─── In-Memory Cache ──────────────────────────────────────────────────────────
const cache = new Map();

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data, ttlMs) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// ─── Category Detection ───────────────────────────────────────────────────────
const CATEGORIES = {
  pokemon: ['pokemon', 'pikachu', 'charizard', 'mewtwo', 'eevee', 'snorlax', 'gengar', 'bulbasaur', 'squirtle', 'blastoise', 'venusaur', 'gyarados', 'umbreon', 'espeon', 'vaporeon', 'mew', 'lugia', 'ho-oh', 'rayquaza', 'groudon', 'kyogre', 'pokémon', 'ptcg', 'tcg card'],
  yugioh:  ['yugioh', 'yu-gi-oh', 'yu gi oh', 'exodia', 'blue-eyes', 'blue eyes', 'dark magician', 'red-eyes', 'red eyes', 'duel monster', 'yugi', 'kaiba', 'synchro', 'xyz', 'fusion', 'konami', 'ygo'],
};

function detectCategory(title) {
  const lower = title.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(kw => lower.includes(kw))) return cat;
  }
  return 'other';
}

// ─── eBay Route ───────────────────────────────────────────────────────────────
app.get('/api/ebay', async (req, res) => {
  const cacheKey = 'ebay_listings';
  const cached = getCached(cacheKey);
  if (cached) return res.json({ source: 'cache', items: cached });

  try {
    // eBay search page for this seller (returns HTML from datacenter IPs)
    const url = 'https://www.ebay.com/sch/i.html?_ssn=ig_pokemarket92&_sop=10&_ipg=60';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });
    clearTimeout(timer);

    if (!response.ok) throw new Error(`eBay responded with ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);
    const items = [];

    $('.s-item').not('.s-item--placeholder').each((_, el) => {
      const $el = $(el);

      // Title — strip "New Listing" prefix eBay injects
      const title = $el.find('.s-item__title').first().text()
        .replace(/^New Listing\s*/i, '').trim();
      if (!title || title === 'Shop on eBay') return;

      // Direct item link (strip tracking query string)
      let link = $el.find('a.s-item__link').first().attr('href') || '';
      if (link.includes('?')) link = link.split('?')[0];
      if (!link) return;

      // Price (take first price, drop "to $X" range suffix)
      const price = ($el.find('.s-item__price').first().text().trim()
        .match(/\$[\d,]+\.?\d*/)?.[0]) || null;

      // Image — prefer largest eBay size available
      let image = $el.find('img.s-item__image-img').first().attr('src')
        || $el.find('img').first().attr('src') || null;
      if (image && (image.includes('/gif/') || image.length < 15)) image = null;
      if (image) image = image.replace(/s-l\d+/, 's-l500');

      // Condition
      const condition = $el.find('.SECONDARY_INFO').first().text().trim() || null;

      items.push({ title, link, image, price, condition, category: detectCategory(title) });
    });

    console.log(`eBay HTML scrape: found ${items.length} items`);
    if (items.length === 0) throw new Error('No items parsed from HTML — selector may have changed. HTML start: ' + html.substring(0, 500));

    setCache(cacheKey, items, 10 * 60 * 1000);
    res.json({ source: 'live', items });
  } catch (err) {
    console.error('eBay fetch error:', err.message);
    res.json({ source: 'error', items: [], debug: err.message });
  }
});

// ─── Instagram Route (RapidAPI) ───────────────────────────────────────────────
app.get('/api/instagram', async (req, res) => {
  const username = (req.query.user || '').replace(/[^a-zA-Z0-9_.]/g, '');
  if (!username) return res.status(400).json({ error: 'Missing ?user= parameter' });

  const cacheKey = `instagram_${username}`;
  const cached = getCached(cacheKey);
  // Cache for 60 mins to protect the RapidAPI 500-request tier limit
  if (cached) return res.json({ source: 'cache', posts: cached });

  try {
    const response = await fetch('https://instagram120.p.rapidapi.com/api/instagram/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': 'instagram120.p.rapidapi.com',
        'x-rapidapi-key': '703e89400dmsh576089637cb3e9cp1b4899jsn300f962e0955'
      },
      body: JSON.stringify({ username: username })
    });

    if (!response.ok) throw new Error(`RapidAPI responded with ${response.status}`);
    const data = await response.json();

    if (!data.result || !data.result.edges) {
      throw new Error('RapidAPI returned invalid format');
    }

    const posts = data.result.edges.slice(0, 12).map(e => {
      const node = e.node;
      return {
        id: node.id,
        caption: node.caption?.text || '',
        permalink: 'https://instagram.com/p/' + node.code + '/',
        imageUrl: node.image_versions2?.candidates?.[0]?.url || ''
      };
    }).filter(p => p.imageUrl); // Ensure valid image

    if (posts.length === 0) throw new Error('No valid posts extracted');

    setCache(cacheKey, posts, 60 * 60 * 1000); // 1-hour cache expiration
    res.json({ source: 'live', posts });

  } catch (err) {
    console.error(`Instagram fetch error (${username}):`, err.message);
    res.json({ source: 'unavailable', posts: [], profileUrl: `https://www.instagram.com/${username}/` });
  }
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// ─── SPA Fallback ─────────────────────────────────────────────────────────────
// Serve index.html for any non-API route (enables direct deep links)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});


// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 PokéMarket92 running on http://localhost:${PORT}`);
});
