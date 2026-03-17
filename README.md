# PokéMarket92 — Trading Card Reseller Website

A fully **zero-maintenance**, auto-updating trading card showcase for Pokémon, Yu-Gi-Oh, WWE, and Dragon Ball Z.

- **Frontend**: Static HTML/CSS/JS with Three.js hero animations → deploy free on Vercel / GitHub Pages
- **Backend**: Express.js API on Railway → auto-fetches eBay listings + Instagram posts on every page load

---

## 🏗️ Project Structure

```
trading_card_reseller/
├── frontend/          ← Deploy this to Vercel / GitHub Pages
│   ├── index.html
│   ├── style.css
│   ├── main.js
│   └── assets/
│       ├── logo.png
│       └── card_back.png
├── backend/           ← Deploy this to Railway
│   ├── server.js
│   ├── package.json
│   └── .env.example
└── README.md
```

---

## 🚀 Deploy — Backend (Railway)

> The backend fetches eBay listings and Instagram posts so the frontend never needs manual updates.

### Step 1 — Push backend to GitHub

```bash
cd backend
git init
git add .
git commit -m "Initial PokéMarket92 API backend"
gh repo create pokemarket92-api --public --push --source .
```

### Step 2 — Connect to Railway

1. Go to [railway.app](https://railway.app) and sign up / log in
2. Click **New Project → Deploy from GitHub Repo**
3. Select `pokemarket92-api`
4. Railway auto-detects Node.js and deploys — no config needed
5. Set the start command to: `node server.js`
6. In **Settings → Environment**, add:
   ```
   FRONTEND_URL = https://your-frontend.vercel.app
   ```
7. Copy your Railway project URL (e.g. `https://pokemarket92-api.up.railway.app`)

> **Cost**: Railway Hobby plan is **~$5/month** (always-on, handles this traffic easily).

---

## 🌐 Deploy — Frontend (Vercel)

### Step 1 — Update API URL in `main.js`

Open `frontend/main.js` and find line ~18:
```js
: 'https://pokemarket92-api.up.railway.app'; // ← Replace with your Railway URL
```
Replace with your actual Railway backend URL.

### Step 2 — Deploy to Vercel (Recommended — Free)

```bash
cd frontend
npx vercel
# Follow prompts: deploy as static site, no framework
```

Or connect via [vercel.com](https://vercel.com):
1. **New Project → Import Git Repository** → select your frontend repo
2. Set **Root Directory** to `frontend/`
3. Framework preset: **Other** (static)
4. Deploy — done! ✅

### Option B — GitHub Pages (Free)

```bash
cd frontend
git init
git add .
git commit -m "Initial frontend"
gh repo create pokemarket92-site --public --push --source .
# Then: Settings → Pages → Source: main branch / root → Save
```

---

## 🔧 Local Development

```bash
# Terminal 1 — Start backend
cd backend
npm install
node server.js
# API now running at http://localhost:3001

# Terminal 2 — Serve frontend
cd frontend
npx serve .
# Frontend now at http://localhost:3000
```

---

## ✅ How Auto-Updating Works

| Source | Method | Cache TTL |
|--------|--------|-----------|
| eBay listings | RSS feed parsed server-side | 10 min |
| Instagram @pokemarket92 | Instagram internal web API | 15 min |
| Instagram @yugiohmaster92 | Instagram internal web API | 15 min |

Every time a visitor loads the site, the frontend calls your Railway backend (`/api/ebay`, `/api/instagram`). The backend fetches fresh data from eBay and Instagram (or serves cached data if freshly fetched). **No manual updates ever needed.**

---

## 📱 Features

- **Three.js Hero**: 8 floating 3D trading cards with particle field, hover flip & glow
- **Live eBay Grid**: Auto-fetched, auto-categorized, filterable by type
- **Instagram Feed**: Live post thumbnails for both accounts
- **Filter + Sort**: By category (Pokémon/Yu-Gi-Oh/WWE/DBZ) and price
- **Featured Badges**: Auto-highlighted for cards over $50
- **Dark/Light Mode**: Auto-detects system preference + manual toggle
- **Mobile Responsive**: Works great on all screen sizes
- **Scroll Animations**: Smooth fade-in as cards enter viewport

---

## 🛠️ Customization

| What | Where |
|------|-------|
| Store name | `index.html` `<title>` and `.logo-text` |
| eBay seller ID | `backend/server.js` → `ig_pokemarket92` in RSS URL |
| Instagram accounts | `frontend/main.js` → `fetchInstagram()` calls |
| Railway URL | `frontend/main.js` → `API_BASE` constant |
| Colors & theme | `frontend/style.css` → `:root` variables |
