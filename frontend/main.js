/**
 * PokéMarket92 — main.js
 * - Three.js hero scene: floating 3D card stack + particle field
 * - eBay live listings fetch from API backend
 * - Instagram posts fetch from API backend
 * - Filter, sort, scroll animations, navbar, theme toggle
 */

'use strict';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// 🔧 ONLY THING TO UPDATE AFTER DEPLOY:
// Set this to your Railway backend URL, e.g. 'https://pokemarket92-api.up.railway.app'
// While testing locally, leave as empty string to use localhost:3001
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001'
  : 'https://pokemarket92-api.up.railway.app'; // ← Replace with your Railway URL after deploy

// ─── STATE ────────────────────────────────────────────────────────────────────
let allCards = [];
let activeFilter = 'all';
let activeSort = 'newest';

// ─── CATEGORY EMOJI MAP ───────────────────────────────────────────────────────
const CAT_EMOJI = {
  pokemon: '⚡',
  yugioh:  '🃏',
  wwe:     '🏆',
  dbz:     '🔥',
  other:   '✨',
};
const CAT_LABEL = {
  pokemon: 'Pokémon',
  yugioh:  'Yu-Gi-Oh',
  wwe:     'WWE',
  dbz:     'Dragon Ball Z',
  other:   'Collectible',
};

// ─── THREE.JS HERO SCENE ──────────────────────────────────────────────────────
function initHeroScene() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas || !window.THREE) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 8);

  // ── Lights ──
  const ambientLight = new THREE.AmbientLight(0x101020, 1);
  scene.add(ambientLight);

  const goldLight = new THREE.PointLight(0xffd700, 3, 20);
  goldLight.position.set(5, 3, 5);
  scene.add(goldLight);

  const purpleLight = new THREE.PointLight(0xa855f7, 3, 20);
  purpleLight.position.set(-5, -2, 4);
  scene.add(purpleLight);

  const blueLight = new THREE.PointLight(0x3b82f6, 1.5, 20);
  blueLight.position.set(0, -4, 3);
  scene.add(blueLight);

  // ── Card Planes ──
  const cardTextures = [
    { color: 0xfbbf24, emissive: 0xfbbf24 }, // gold Pokémon
    { color: 0xa855f7, emissive: 0xa855f7 }, // purple YGO
    { color: 0x3b82f6, emissive: 0x3b82f6 }, // blue
    { color: 0xf43f5e, emissive: 0xf43f5e }, // red WWE
    { color: 0xf97316, emissive: 0xf97316 }, // orange DBZ
    { color: 0x22c55e, emissive: 0x22c55e }, // green
    { color: 0xffd700, emissive: 0xffd700 }, // pure gold
    { color: 0xec4899, emissive: 0xec4899 }, // pink
  ];

  const cards = [];
  const CARD_W = 1.4;
  const CARD_H = 2.0;

  const cardBackTex = loadTexture('assets/card_back.png');

  cardTextures.forEach((col, i) => {
    const geo = new THREE.BoxGeometry(CARD_W, CARD_H, 0.025);

    // Front face — gradient-simulated with color
    const frontMat = new THREE.MeshPhongMaterial({
      color: 0x101025,
      emissive: col.emissive,
      emissiveIntensity: 0.08,
      shininess: 120,
      specular: new THREE.Color(col.color),
    });
    // Add stripe to differentiate cards
    const canvas2d = document.createElement('canvas');
    canvas2d.width = 256; canvas2d.height = 360;
    const ctx = canvas2d.getContext('2d');
    // Background
    const grad = ctx.createLinearGradient(0, 0, 256, 360);
    grad.addColorStop(0, '#0d0d2b');
    grad.addColorStop(1, '#1a1040');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 360);
    // Glow border
    ctx.strokeStyle = `#${col.color.toString(16).padStart(6, '0')}`;
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 12, 232, 336);
    // Inner glow
    ctx.strokeStyle = `rgba(255,255,255,0.1)`;
    ctx.lineWidth = 2;
    ctx.strokeRect(22, 22, 212, 316);
    // Holographic shimmer lines
    for (let y = 0; y < 360; y += 16) {
      ctx.fillStyle = `rgba(255,255,255,${Math.sin(y * 0.08) * 0.015 + 0.01})`;
      ctx.fillRect(0, y, 256, 4);
    }
    // Category icon
    ctx.font = 'bold 64px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `#${col.color.toString(16).padStart(6, '0')}`;
    ctx.globalAlpha = 0.5;
    const icons = ['⚡','🃏','🏆','🔥','✨','🌟','💎','🎴'];
    ctx.fillText(icons[i % icons.length], 128, 180);
    ctx.globalAlpha = 1;

    const frontTexture = new THREE.CanvasTexture(canvas2d);
    const mats = [
      new THREE.MeshPhongMaterial({ color: 0x0d0d20, shininess: 60 }),
      new THREE.MeshPhongMaterial({ color: 0x0d0d20, shininess: 60 }),
      new THREE.MeshPhongMaterial({ color: 0x0d0d20, shininess: 60 }),
      new THREE.MeshPhongMaterial({ color: 0x0d0d20, shininess: 60 }),
      new THREE.MeshPhongMaterial({ map: frontTexture, shininess: 200, specular: 0xffffff }),
      new THREE.MeshPhongMaterial({ map: cardBackTex, color: 0x8888ff, shininess: 80 }),
    ];

    const mesh = new THREE.Mesh(geo, mats);

    // Spread cards in a fan/arc
    const spread = 8;
    const angle = (i / cardTextures.length) * Math.PI * 2;
    const radius = 3.2;
    mesh.position.x = Math.cos(angle) * radius * 1.4;
    mesh.position.y = Math.sin(angle) * radius * 0.6;
    mesh.position.z = (i % 3) * -0.5;
    mesh.rotation.y = Math.cos(angle) * 0.4;
    mesh.rotation.x = Math.sin(angle) * 0.15;
    mesh.rotation.z = (Math.random() - 0.5) * 0.3;

    // Store initial state for animation
    mesh.userData = {
      index: i,
      phase: (i / cardTextures.length) * Math.PI * 2,
      baseX: mesh.position.x,
      baseY: mesh.position.y,
      baseZ: mesh.position.z,
      baseRotZ: mesh.rotation.z,
      hovered: false,
      flipProgress: 0,
    };

    scene.add(mesh);
    cards.push(mesh);
  });

  // ── Particle Field ──
  const PARTICLE_COUNT = 600;
  const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
  const particleSizes = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particlePositions[i * 3]     = (Math.random() - 0.5) * 30;
    particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 20;
    particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 10 - 5;
    particleSizes[i] = Math.random() * 2.5 + 0.5;
  }

  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  particleGeo.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));

  const particleMat = new THREE.PointsMaterial({
    color: 0xffd700,
    size: 0.04,
    transparent: true,
    opacity: 0.4,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // ── Raycasting for hover ──
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const heroEl = document.getElementById('hero');

  heroEl.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  });

  // ── Resize handler ──
  function onResize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);

  // ── Animate ──
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // Raycasting
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(cards);
    const hitSet = new Set(intersects.map(i => i.object.uuid));

    cards.forEach(card => {
      const u = card.userData;
      const phase = u.phase;
      const speed = 0.4;

      // Float animation
      card.position.x = u.baseX + Math.sin(t * speed + phase) * 0.15;
      card.position.y = u.baseY + Math.cos(t * speed * 0.8 + phase) * 0.25;
      card.rotation.z = u.baseRotZ + Math.sin(t * speed * 0.6 + phase) * 0.06;

      // Hover state
      const isHovered = hitSet.has(card.uuid);
      if (isHovered && !u.hovered) {
        u.hovered = true;
      } else if (!isHovered && u.hovered) {
        u.hovered = false;
      }

      // Hover glow effect
      if (isHovered) {
        card.position.z = u.baseZ + 0.8;
        card.rotation.y += (Math.PI - card.rotation.y) * 0.1; // flip toward camera
      } else {
        card.position.z += (u.baseZ - card.position.z) * 0.08;
        const targetRotY = Math.cos(phase) * 0.4;
        card.rotation.y += (targetRotY - card.rotation.y) * 0.05;
      }

      // Slow Y spin
      if (!isHovered) {
        card.rotation.y += 0.003;
      }
    });

    // Particle drift
    particles.rotation.y = t * 0.02;
    particles.rotation.x = Math.sin(t * 0.01) * 0.05;

    // Light pulse
    goldLight.intensity = 2.5 + Math.sin(t * 1.5) * 0.5;
    purpleLight.intensity = 2.5 + Math.cos(t * 1.2) * 0.5;

    renderer.render(scene, camera);
  }

  animate();
}

function loadTexture(url) {
  const loader = new THREE.TextureLoader();
  const placeholder = new THREE.Texture();
  // Create a simple canvas fallback immediately
  const c = document.createElement('canvas');
  c.width = 256; c.height = 360;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 360);
  g.addColorStop(0, '#1a0a3a');
  g.addColorStop(1, '#0a1a3a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 360);
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 236, 340);
  ctx.font = 'bold 80px serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.globalAlpha = 0.5;
  ctx.fillText('P', 128, 200);
  const fallbackTex = new THREE.CanvasTexture(c);

  loader.load(url, (tex) => {
    Object.assign(placeholder, tex);
    placeholder.needsUpdate = true;
  }, undefined, () => {});

  return fallbackTex;
}

// ─── CARD RENDERING ───────────────────────────────────────────────────────────
function createCardHTML(card, index) {
  const isFeatured = card.featured || (card.price && parseFloat(card.price.replace(/[^0-9.]/g, '')) >= 50);
  const catLabel = CAT_LABEL[card.category] || 'Collectible';
  const catEmoji = CAT_EMOJI[card.category] || '✨';
  const price = card.price || 'View on eBay';
  const delay = (index % 12) * 50;

  return `
    <div class="card-item fade-in" data-category="${card.category}" style="animation-delay:${delay}ms">
      <div class="card-image-wrap">
        ${card.image
          ? `<img src="${escHtml(card.image)}" alt="${escHtml(card.title)}" loading="lazy" onerror="this.style.display='none'; this.nextSibling.style.display='flex'" />`
          : ''}
        <div class="card-placeholder" style="${card.image ? 'display:none' : ''}">${catEmoji}</div>
        <div class="card-badge-wrap">
          <span class="cat-badge">${catLabel}</span>
          ${isFeatured ? '<span class="featured-badge">⭐ Featured</span>' : ''}
        </div>
      </div>
      <div class="card-body">
        <div class="card-title" title="${escHtml(card.title)}">${escHtml(card.title)}</div>
        <div class="card-meta">
          <div class="card-price">${escHtml(price)}</div>
        </div>
        <div class="card-actions">
          <a href="${escHtml(card.link)}" target="_blank" rel="noopener" class="card-btn">
            View on eBay ↗
          </a>
        </div>
      </div>
    </div>
  `;
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── RENDER CARDS ─────────────────────────────────────────────────────────────
function renderCards() {
  const grid = document.getElementById('card-grid');
  const emptyState = document.getElementById('listings-empty');
  if (!grid) return;

  let filtered = allCards.filter(c => activeFilter === 'all' || c.category === activeFilter);

  // Sort
  if (activeSort === 'price-asc') {
    filtered.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
  } else if (activeSort === 'price-desc') {
    filtered.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
  } else if (activeSort === 'featured') {
    filtered.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';
    grid.innerHTML = filtered.map((c, i) => createCardHTML(c, i)).join('');
    // Trigger scroll observer on new cards
    observeElements();
  }

  // Update stat
  const statEl = document.getElementById('statTotal');
  if (statEl && allCards.length > 0) statEl.textContent = allCards.length;
}

function parsePrice(p) {
  if (!p) return 0;
  return parseFloat(p.replace(/[^0-9.]/g, '')) || 0;
}

// ─── FETCH eBay ───────────────────────────────────────────────────────────────
async function fetchEbay() {
  const loading  = document.getElementById('listings-loading');
  const errorEl  = document.getElementById('listings-error');

  loading.style.display = 'block';
  errorEl.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/api/ebay`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allCards = data.items || [];
    if (data.source === 'fallback') {
      errorEl.style.display = 'block';
    }
  } catch (err) {
    console.warn('eBay fetch failed, using demo cards:', err.message);
    allCards = getDemoCards();
    errorEl.style.display = 'block';
  } finally {
    loading.style.display = 'none';
    renderCards();
  }
}

// ─── FETCH Instagram ──────────────────────────────────────────────────────────
async function fetchInstagram(username, gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  try {
    const res = await fetch(`${API_BASE}/api/instagram?user=${username}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data.posts || data.posts.length === 0) throw new Error('no posts');

    grid.innerHTML = data.posts.map(post => `
      <a class="ig-post" href="${escHtml(post.permalink)}" target="_blank" rel="noopener">
        <img src="${escHtml(post.imageUrl)}" alt="Instagram post" loading="lazy" onerror="this.parentElement.style.display='none'" />
        <div class="ig-post-overlay">${post.caption ? escHtml(post.caption.slice(0, 80)) + (post.caption.length > 80 ? '…' : '') : 'View post ↗'}</div>
      </a>
    `).join('');

  } catch (err) {
    console.warn(`Instagram fetch failed for ${username}:`, err.message);
    grid.innerHTML = `
      <div class="ig-fallback">
        <p>📸 Follow us on Instagram for the latest picks!</p>
        <br/>
        <a href="https://www.instagram.com/${username}/" target="_blank" rel="noopener" class="btn-secondary" style="display:inline-flex; font-size:0.85rem; padding:10px 20px;">
          @${username} ↗
        </a>
      </div>
    `;
  }

  observeElements();
}

// ─── FRONTEND FALLBACK CARDS ──────────────────────────────────────────────────
function getDemoCards() {
  return [
    { title: "Charizard VMAX Rainbow Rare — Sword & Shield Champion's Path", price: '$89.99', category: 'pokemon', link: 'https://www.ebay.com/usr/ig_pokemarket92', image: 'https://images.pokemontcg.io/swshp/SWSH050_hires.png', featured: true },
    { title: 'Pikachu V Full Art — Vivid Voltage', price: '$24.99', category: 'pokemon', link: 'https://www.ebay.com/usr/ig_pokemarket92', image: 'https://images.pokemontcg.io/swsh4/43_hires.png' },
    { title: 'Mewtwo GX Rainbow Rare — Hidden Fates', price: '$65.00', category: 'pokemon', link: 'https://www.ebay.com/usr/ig_pokemarket92', image: 'https://images.pokemontcg.io/sm11a/73_hires.png', featured: true },
    { title: 'Blue-Eyes White Dragon — Legend of Blue Eyes LP', price: '$45.00', category: 'yugioh', link: 'https://www.ebay.com/usr/ig_pokemarket92', image: null, featured: true },
    { title: 'Dark Magician Girl Secret Rare — MFC-000', price: '$35.00', category: 'yugioh', link: 'https://www.ebay.com/usr/ig_pokemarket92', image: null },
    { title: 'Exodia the Forbidden One LOB-124 — 1st Ed NM', price: '$120.00', category: 'yugioh', link: 'https://www.ebay.com/usr/ig_pokemarket92', image: null, featured: true },
    { title: 'John Cena 2004 Topps Heritage Rookie WWE Card', price: '$12.50', category: 'wwe', link: 'https://www.ebay.com/usr/ig_pokemarket92', image: null },
    { title: 'The Rock 1998 Comic Images WWF Card #32', price: '$9.99', category: 'wwe', link: 'https://www.ebay.com/usr/ig_pokemarket92', image: null },
    { title: 'Goku Super Saiyan Dragon Ball Z Score Card 2000', price: '$18.00', category: 'dbz', link: 'https://www.ebay.com/usr/ig_pokemarket92', image: null },
    { title: 'Vegeta Ultra Rare Panini Dragon Ball Super Card', price: '$22.00', category: 'dbz', link: 'https://www.ebay.com/usr/ig_pokemarket92', image: null },
    { title: 'Umbreon VMAX Alternate Full Art — Evolving Skies', price: '$75.00', category: 'pokemon', link: 'https://www.ebay.com/usr/ig_pokemarket92', image: null, featured: true },
    { title: 'Rayquaza VMAX Alternate Art — Evolving Skies', price: '$95.00', category: 'pokemon', link: 'https://www.ebay.com/usr/ig_pokemarket92', image: null, featured: true },
  ];
}

// ─── FILTER PILLS ─────────────────────────────────────────────────────────────
function initFilters() {
  document.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeFilter = pill.dataset.filter;
      renderCards();
    });
  });

  const sortSel = document.getElementById('sortSelect');
  if (sortSel) {
    sortSel.addEventListener('change', () => {
      activeSort = sortSel.value;
      renderCards();
    });
  }
}

// ─── NAVBAR ───────────────────────────────────────────────────────────────────
function initNavbar() {
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }, { passive: true });

  hamburger?.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
  });

  // Close mobile menu when clicking a link
  mobileMenu?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => mobileMenu.classList.remove('open'));
  });
}

// ─── DARK/LIGHT THEME ─────────────────────────────────────────────────────────
function initThemeToggle() {
  const btn = document.getElementById('themeToggle');
  const preferred = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  let current = localStorage.getItem('theme') || preferred;
  applyTheme(current);

  btn?.addEventListener('click', () => {
    current = current === 'dark' ? 'light' : 'dark';
    applyTheme(current);
    localStorage.setItem('theme', current);
  });
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ─── SCROLL ANIMATIONS ────────────────────────────────────────────────────────
let observer;

function observeElements() {
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
  }
  document.querySelectorAll('.fade-in:not(.visible)').forEach(el => observer.observe(el));
}

// ─── SMOOTH SCROLL ────────────────────────────────────────────────────────────
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initThemeToggle();
  initFilters();
  initSmoothScroll();
  initHeroScene();
  observeElements();

  // Fetch all live data
  fetchEbay();
  fetchInstagram('pokemarket92', 'ig-grid-pokemon');
  fetchInstagram('yugiohmaster92', 'ig-grid-yugioh');
});
