/**
 * PokéMarket92 — API Backend
 * Express.js server that auto-fetches eBay listings and Instagram posts.
 * Deploy to Railway (Hobby plan) for always-on zero-maintenance operation.
 */

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const cheerio = require('cheerio');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: FRONTEND_URL === '*' ? true : [FRONTEND_URL, 'http://localhost:3000', 'http://localhost:5000'],
  methods: ['GET'],
}));

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests, please slow down.' }
}));

app.use(express.json());

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
  pokemon: ['pokemon', 'pikachu', 'charizard', 'mewtwo', 'eevee', 'snorlax', 'gengar', 'bulbasaur', 'squirtle', 'blastoise', 'venusaur', 'gyarados', 'umbreon', 'espeon', 'vaporeon', 'mew', 'lugia', 'ho-oh', 'rayquaza', 'groudon', 'kyogre'],
  yugioh: ['yugioh', 'yu-gi-oh', 'yu gi oh', 'exodia', 'blue-eyes', 'blue eyes', 'dark magician', 'red-eyes', 'red eyes', 'duel monster', 'yugi', 'kaiba', 'synchro', 'xyz', 'fusion'],
  wwe: ['wwe', 'wrestling', 'wrestler', 'raw', 'smackdown', 'john cena', 'undertaker', 'the rock', 'stone cold', 'hulk hogan', 'roman reigns', 'wwe card'],
  dbz: ['dragon ball', 'dragonball', 'dbz', 'goku', 'vegeta', 'gohan', 'piccolo', 'frieza', 'cell', 'buu', 'saiyan', 'super saiyan', 'kamehameha'],
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
    const rssUrl = 'https://www.ebay.com/sch/i.html?_ssn=ig_pokemarket92&_rss=1&_sop=10';
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      timeout: 10000,
    });

    if (!response.ok) throw new Error(`eBay RSS responded with ${response.status}`);

    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });

    const items = [];
    $('item').each((_, el) => {
      const $el = cheerio.load(el, { xmlMode: true });
      const title = $el('title').text().trim();
      const link = $el('link').text().trim();
      const description = $el('description').text();
      const pubDate = $el('pubDate').text().trim();

      // Extract price from title or description
      const priceMatch = (title + ' ' + description).match(/\$[\d,]+\.?\d*/);
      const price = priceMatch ? priceMatch[0] : null;

      // Extract image from description HTML
      const $desc = cheerio.load(description);
      const image = $desc('img').first().attr('src') || null;

      if (title && link) {
        items.push({
          title,
          link,
          image,
          price,
          pubDate,
          category: detectCategory(title),
        });
      }
    });

    if (items.length === 0) throw new Error('No items parsed from RSS feed');

    setCache(cacheKey, items, 10 * 60 * 1000); // 10 minute cache
    res.json({ source: 'live', items });
  } catch (err) {
    console.error('eBay fetch error:', err.message);

    // Return fallback demo cards so the site never looks empty
    const fallback = getFallbackCards();
    res.json({ source: 'fallback', items: fallback });
  }
});

// ─── Instagram Route ──────────────────────────────────────────────────────────
app.get('/api/instagram', async (req, res) => {
  const username = (req.query.user || '').replace(/[^a-zA-Z0-9_.]/g, '');
  if (!username) return res.status(400).json({ error: 'Missing ?user= parameter' });

  const cacheKey = `instagram_${username}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json({ source: 'cache', posts: cached });

  try {
    // Instagram's internal web profile API — same endpoint used by the web client
    const igUrl = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
    const response = await fetch(igUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 9; GM1903 Build/PKQ1.190110.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/75.0.3770.143 Mobile Safari/537.36 Instagram 101.0.0.15.120',
        'x-ig-app-id': '936619743392459',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.instagram.com/',
        'Origin': 'https://www.instagram.com',
        'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 10000,
    });

    if (!response.ok) throw new Error(`Instagram API responded with ${response.status}`);

    const data = await response.json();
    const edges = data?.data?.user?.edge_owner_to_timeline_media?.edges || [];

    const posts = edges.slice(0, 12).map(({ node }) => ({
      id: node.id,
      imageUrl: node.display_url || node.thumbnail_src,
      caption: node.edge_media_to_caption?.edges?.[0]?.node?.text || '',
      permalink: `https://www.instagram.com/p/${node.shortcode}/`,
      timestamp: new Date(node.taken_at_timestamp * 1000).toISOString(),
      isVideo: node.is_video,
    }));

    if (posts.length === 0) throw new Error('No posts returned');

    setCache(cacheKey, posts, 15 * 60 * 1000); // 15 minute cache
    res.json({ source: 'live', posts });
  } catch (err) {
    console.error(`Instagram fetch error for ${username}:`, err.message);

    // Return graceful empty state — frontend will show CTA to visit profile
    res.json({ source: 'unavailable', posts: [], profileUrl: `https://www.instagram.com/${username}/` });
  }
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.get('/', (_, res) => res.json({
  name: 'PokéMarket92 API',
  version: '1.0.0',
  endpoints: ['/api/ebay', '/api/instagram?user=<username>', '/health']
}));

// ─── Fallback Demo Cards ──────────────────────────────────────────────────────
function getFallbackCards() {
  return [
    {
      title: 'Charizard VMAX Rainbow Rare - Sword & Shield Champion\'s Path',
      link: 'https://www.ebay.com/usr/ig_pokemarket92',
      image: 'https://images.pokemontcg.io/swshp/SWSH050_hires.png',
      price: '$89.99',
      category: 'pokemon',
      pubDate: new Date().toISOString(),
      featured: true,
    },
    {
      title: 'Pikachu V Full Art - Vivid Voltage Holo',
      link: 'https://www.ebay.com/usr/ig_pokemarket92',
      image: 'https://images.pokemontcg.io/swsh4/43_hires.png',
      price: '$24.99',
      category: 'pokemon',
      pubDate: new Date().toISOString(),
    },
    {
      title: 'Blue-Eyes White Dragon - Legend of Blue Eyes - LP',
      link: 'https://www.ebay.com/usr/ig_pokemarket92',
      image: null,
      price: '$45.00',
      category: 'yugioh',
      pubDate: new Date().toISOString(),
      featured: true,
    },
    {
      title: 'Dark Magician Girl Secret Rare - MFC-000',
      link: 'https://www.ebay.com/usr/ig_pokemarket92',
      image: null,
      price: '$35.00',
      category: 'yugioh',
      pubDate: new Date().toISOString(),
    },
    {
      title: 'John Cena 2004 Topps Heritage Rookie WWE Card',
      link: 'https://www.ebay.com/usr/ig_pokemarket92',
      image: null,
      price: '$12.50',
      category: 'wwe',
      pubDate: new Date().toISOString(),
    },
    {
      title: 'Goku Super Saiyan Dragon Ball Z Score Card 2000',
      link: 'https://www.ebay.com/usr/ig_pokemarket92',
      image: null,
      price: '$18.00',
      category: 'dbz',
      pubDate: new Date().toISOString(),
    },
    {
      title: 'Mewtwo GX Rainbow Rare - Hidden Fates',
      link: 'https://www.ebay.com/usr/ig_pokemarket92',
      image: 'https://images.pokemontcg.io/sm11a/73_hires.png',
      price: '$65.00',
      category: 'pokemon',
      pubDate: new Date().toISOString(),
      featured: true,
    },
    {
      title: 'Exodia the Forbidden One LOB-124 - 1st Edition Near Mint',
      link: 'https://www.ebay.com/usr/ig_pokemarket92',
      image: null,
      price: '$120.00',
      category: 'yugioh',
      pubDate: new Date().toISOString(),
      featured: true,
    },
  ];
}

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 PokéMarket92 API running on port ${PORT}`);
  console.log(`   eBay:      GET /api/ebay`);
  console.log(`   Instagram: GET /api/instagram?user=pokemarket92`);
  console.log(`   Health:    GET /health`);
});
