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
const fs = require('fs');
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

// ─── eBay Route (RapidAPI) ──────────────────────────────────────────────────
app.get('/api/ebay', async (req, res) => {
  const cacheKey = 'ebay_listings';
  const cached = getCached(cacheKey);
  
  if (cached && cached.length > 0) {
    console.log('Serving eBay from cache');
    return res.json({ source: 'cache', items: cached });
  }

  console.log('Fetching live eBay data...');
  try {
    const response = await fetch('https://ebay41.p.rapidapi.com/sellers/ig_pokemarket92/products?sort=best_match&page=1&limit=60', {
      headers: {
        'x-rapidapi-host': 'ebay41.p.rapidapi.com',
        'x-rapidapi-key': '703e89400dmsh576089637cb3e9cp1b4899jsn300f962e0955'
      }
    });

    if (!response.ok) throw new Error(`RapidAPI responded with ${response.status}`);
    const json = await response.json();

    if (!json.success || !json.data || !json.data.items) {
      console.warn('API success: false or missing items');
      throw new Error('RapidAPI returned failure or invalid format');
    }

    const items = json.data.items.map(item => ({
      ...item,
      category: detectCategory(item.title)
    }));

    console.log(`Successfully fetched ${items.length} items from API`);
    setCache(cacheKey, items, 24 * 60 * 60 * 1000); // 24-hour cache
    res.json({ source: 'live', items });

  } catch (err) {
    console.error('eBay fetch error:', err.message);
    try {
      const fallbackPath = path.join(__dirname, 'data', 'ebay_fallback.json');
      if (fs.existsSync(fallbackPath)) {
        console.log('Loading eBay fallback data...');
        const fallbackRaw = fs.readFileSync(fallbackPath, 'utf8');
        const fallbackData = JSON.parse(fallbackRaw);
        const items = fallbackData.data.items.map(item => ({
          ...item,
          category: detectCategory(item.title)
        }));
        console.log(`Loaded ${items.length} items from fallback`);
        return res.json({ source: 'fallback', items });
      } else {
        console.error('Fallback file not found at:', fallbackPath);
      }
    } catch (fallbackErr) {
      console.error('eBay fallback error:', fallbackErr.message);
    }
    res.json({ source: 'error', items: [] });
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
    try {
      const fallbackPath = path.join(__dirname, 'data', 'fallback_ig.json');
      if (fs.existsSync(fallbackPath)) {
        const fallbackData = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
        if (fallbackData[username]) {
          return res.json({ source: 'fallback', posts: fallbackData[username] });
        }
      }
    } catch (fallbackErr) {
      console.error(`Fallback read error for ${username}:`, fallbackErr.message);
    }
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
