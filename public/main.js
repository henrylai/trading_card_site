/**
 * PokéMarket92 — public/main.js
 * Monorepo edition — API calls use same-origin relative paths (/api/...)
 */

'use strict';


// ─── THREE.JS HERO ────────────────────────────────────────────────────────────
function initHeroScene() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas || !window.THREE) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setClearColor(0x000000, 0);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 7.2);

  // ── Lights ──
  scene.add(new THREE.AmbientLight(0x100818, 1.2));
  const goldLight = new THREE.PointLight(0xe8c840, 3.5, 22);
  goldLight.position.set(5, 3, 5);
  scene.add(goldLight);
  const purpleLight = new THREE.PointLight(0x9b6dff, 3, 22);
  purpleLight.position.set(-5, -2, 4);
  scene.add(purpleLight);
  const blueLight = new THREE.PointLight(0x5b8cf7, 1.2, 20);
  blueLight.position.set(0, -4, 3);
  scene.add(blueLight);

  // ── Cards ──
  const PALETTE = [
    0xe8c840, 0x9b6dff, 0x5b8cf7, 0xe05555,
    0xe07830, 0x3ec97a, 0xd4a0ff, 0xe06090,
  ];
  const CARD_ASSETS = [
    'assets/cards/charizard.png',
    'assets/cards/blastoise.png',
    'assets/cards/venusaur.png',
    'assets/cards/pikachu.png',
    'assets/cards/blue-eyes.jpg',
    'assets/cards/dark-magician.jpg',
    'assets/cards/red-eyes.jpg',
    'assets/cards/exodia.jpg'
  ];
  const loader = new THREE.TextureLoader();

  // Generate a single premium card back texture for all cards
  const cb = document.createElement('canvas');
  cb.width = 256; cb.height = 360;
  const ctx2 = cb.getContext('2d');
  const g2 = ctx2.createLinearGradient(0, 0, 0, 360);
  g2.addColorStop(0, '#14103a'); g2.addColorStop(1, '#0a0a1e');
  ctx2.fillStyle = g2; ctx2.fillRect(0, 0, 256, 360);
  ctx2.strokeStyle = '#e8c840'; ctx2.lineWidth = 7; ctx2.strokeRect(10, 10, 236, 340);
  for (let r = 0; r < 10; r++) for (let cc = 0; cc < 7; cc++) {
    ctx2.fillStyle = 'rgba(232,200,64,0.07)';
    ctx2.fillRect(18 + cc * 32, 18 + r * 32, 22, 22);
  }
  ctx2.font = 'bold 72px serif'; ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
  ctx2.fillStyle = '#e8c840'; ctx2.globalAlpha = 0.35;
  ctx2.fillText('P', 128, 180); ctx2.globalAlpha = 1;
  const backTex = new THREE.CanvasTexture(cb);

  const cards = [];

  PALETTE.forEach((col, i) => {
    const faceTex = loader.load(CARD_ASSETS[i]);
    if (typeof THREE.sRGBEncoding !== 'undefined') faceTex.encoding = THREE.sRGBEncoding;

    const geo  = new THREE.BoxGeometry(1.75, 2.48, 0.025);
    const mats = [
      new THREE.MeshPhongMaterial({ color: 0x080818 }),
      new THREE.MeshPhongMaterial({ color: 0x080818 }),
      new THREE.MeshPhongMaterial({ color: 0x080818 }),
      new THREE.MeshPhongMaterial({ color: 0x080818 }),
      new THREE.MeshPhongMaterial({ map: faceTex, shininess: 120, specular: 0x222222 }),
      new THREE.MeshPhongMaterial({ map: backTex, shininess: 60 }),
    ];
    const mesh = new THREE.Mesh(geo, mats);
    const angle  = (i / PALETTE.length) * Math.PI * 2;
    const radius = 3.9;
    mesh.position.set(
      Math.cos(angle) * radius * 1.5,
      Math.sin(angle) * radius * 0.7,
      (i % 3) * -0.8
    );
    mesh.rotation.set(Math.sin(angle) * 0.14, Math.cos(angle) * 0.4, (Math.random() - 0.5) * 0.28);
    mesh.userData = {
      phase: (i / PALETTE.length) * Math.PI * 2,
      baseX: mesh.position.x,
      baseY: mesh.position.y,
      baseZ: mesh.position.z,
      baseRotZ: mesh.rotation.z,
    };
    scene.add(mesh);
    cards.push(mesh);
  });

  // ── Particles ──
  const N = 500;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 28;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 18;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 8 - 5;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
    color: 0xe8c840, size: 0.038, transparent: true, opacity: 0.35, sizeAttenuation: true,
  }));
  scene.add(particles);

  // ── Raycasting ──
  const raycaster = new THREE.Raycaster();
  const mouse     = new THREE.Vector2(-9999, -9999);
  const heroEl = document.getElementById('hero');
  heroEl.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  });
  heroEl.addEventListener('mouseleave', () => mouse.set(-9999, -9999));
  heroEl.addEventListener('touchstart', e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.touches[0].clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((e.touches[0].clientY - r.top) / r.height) * 2 + 1;
  }, { passive: true });

  // ── Resize ──
  window.addEventListener('resize', () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  // ── Animate ──
  const clock = new THREE.Clock();
  (function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    raycaster.setFromCamera(mouse, camera);
    const hits = new Set(raycaster.intersectObjects(cards).map(x => x.object.uuid));

    cards.forEach(card => {
      const u = card.userData;
      const s = 0.38;
      card.position.x = u.baseX + Math.sin(t * s + u.phase) * 0.14;
      card.position.y = u.baseY + Math.cos(t * s * 0.8 + u.phase) * 0.22;
      card.rotation.z = u.baseRotZ + Math.sin(t * s * 0.6 + u.phase) * 0.055;
      if (hits.has(card.uuid)) {
        card.position.z += (u.baseZ + 0.75 - card.position.z) * 0.12;
        card.rotation.y += (0 - card.rotation.y) * 0.1;
        card.rotation.x += (0 - card.rotation.x) * 0.1;
      } else {
        card.position.z += (u.baseZ - card.position.z) * 0.07;
        card.rotation.y += (Math.cos(u.phase) * 0.38 - card.rotation.y) * 0.05;
        card.rotation.y += 0.003;
      }
    });

    particles.rotation.y = t * 0.018;
    particles.rotation.x = Math.sin(t * 0.009) * 0.04;
    goldLight.intensity   = 3 + Math.sin(t * 1.4) * 0.5;
    purpleLight.intensity = 2.8 + Math.cos(t * 1.1) * 0.5;

    renderer.render(scene, camera);
  })();
}

const CAT_EMOJI = { pokemon: '⚡', yugioh: '🃏', other: '🃏' };
const CAT_LABEL = { pokemon: 'Pokémon', yugioh: 'Yu-Gi-Oh', other: 'Collectible' };

let allProducts = [];
let currentFilter = 'all';
let showCount = 8;

// ─── CARD HTML ────────────────────────────────────────────────────────────────
function createCardHTML(card, idx) {
  const featured = card.featured || parsePrice(card.price) >= 100;
  const emoji    = CAT_EMOJI[card.category] || '✨';
  const label    = CAT_LABEL[card.category] || 'Collectible';
  const price    = typeof card.price === 'number' ? `$${card.price.toFixed(2)}` : (card.price || 'View listing');
  const delay    = (idx % 12) * 45;
  const imageUrl = card.image || '';
  
  // High-quality category placeholders
  let placeholder = '';
  if (card.category === 'pokemon') placeholder = 'assets/cards/pokemon-back.png';
  else if (card.category === 'yugioh') placeholder = 'assets/cards/yugioh-back.png';

  return `
    <div class="card-item fade-in" data-category="${card.category}" style="animation-delay:${delay}ms">
      <div class="card-image-wrap">
        ${imageUrl 
          ? `<img src="${esc(imageUrl)}" alt="${esc(card.title)}" class="card-img" loading="lazy" onerror="${placeholder ? `this.src='${placeholder}';this.nextElementSibling.style.display='none'` : `this.style.display='none';this.nextElementSibling.style.display='flex'`}">` 
          : (placeholder ? `<img src="${placeholder}" class="card-img" alt="Card back">` : '')}
        
        <div class="card-placeholder" style="${imageUrl ? 'display:none' : 'display:flex'}">
          ${(card.category === 'other' || !placeholder) ? `<span class="placeholder-emoji">${emoji}</span>` : ''}
        </div>
        
        <div class="card-badge-wrap">
          ${featured ? '<span class="featured-badge">⭐ Featured</span>' : ''}
          <span class="cat-badge">${label}</span>
        </div>
      </div>
      <div class="card-body">
        <h3 class="card-title" title="${esc(card.title)}">${esc(card.title)}</h3>
        <div class="card-price">${price}</div>
        <a href="${esc(card.url || card.link)}" target="_blank" rel="noopener" class="card-btn">View on eBay ↗</a>
      </div>
    </div>`;
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function parsePrice(p) { return typeof p === 'number' ? p : parseFloat(String(p).replace(/[^0-9.]/g,'')) || 0; }

// ─── FETCH EBAY ───────────────────────────────────────────────────────────────
async function fetchEbayProducts() {
  const grid = document.getElementById('card-grid');
  const loading = document.getElementById('listings-loading');
  const error = document.getElementById('listings-error');
  if (!grid) return;

  try {
    const res = await fetch('/api/ebay');
    const data = await res.json();
    
    if (data.source === 'error') throw new Error('API failure');
    
    allProducts = data.items || [];
    if (data.source === 'fallback') error.style.display = 'block';

    renderListings();
    updateHeroStats();
  } catch (e) {
    console.error('eBay fetch error:', e);
    loading.style.display = 'none';
    error.style.display = 'block';
  }
}

function renderListings() {
  const grid = document.getElementById('card-grid');
  const loading = document.getElementById('listings-loading');
  const empty = document.getElementById('listings-empty');
  const showMoreWrap = document.getElementById('show-more-wrap');
  
  if (!grid) return;
  loading.style.display = 'none';
  
  let products = [...allProducts];

  // 1. Filter
  if (currentFilter !== 'all') {
    products = products.filter(p => p.category === currentFilter);
  }

  // 2. Sort
  const sort = document.getElementById('sortSelect')?.value || 'newest';
  if (sort === 'price-asc') products.sort((a,b) => parsePrice(a.price) - parsePrice(b.price));
  else if (sort === 'price-desc') products.sort((a,b) => parsePrice(b.price) - parsePrice(a.price));

  if (products.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    if (showMoreWrap) showMoreWrap.style.display = 'none';
  } else {
    empty.style.display = 'none';
    
    // Pagination
    const visibleProducts = products.slice(0, showCount);
    grid.innerHTML = visibleProducts.map((p, i) => createCardHTML(p, i)).join('');
    
    if (showMoreWrap) {
      showMoreWrap.style.display = (products.length > showCount) ? 'block' : 'none';
    }
  }
  
  observeElements();
}

function handleShowMore() {
  showCount += 8;
  renderListings();
}

function updateHeroStats() {
  const el = document.getElementById('statTotal');
  if (el) el.innerText = allProducts.length || '—';
}

function initFilters() {
  document.querySelectorAll('.filter-bar .pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('.filter-bar .pill.active')?.classList.remove('active');
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      showCount = 8; // Reset on filter
      renderListings();
    });
  });

  document.getElementById('sortSelect')?.addEventListener('change', () => {
    showCount = 8; // Reset on sort
    renderListings();
  });

  document.getElementById('btn-show-more')?.addEventListener('click', handleShowMore);
}

// ─── FETCH Instagram ──────────────────────────────────────────────────────────
async function fetchInstagram(username, gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  try {
    const res  = await fetch(`/api/instagram?user=${username}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.posts?.length) throw new Error('no posts');
    grid.innerHTML = data.posts.map(p => `
      <a class="ig-post" href="${esc(p.permalink)}" target="_blank" rel="noopener">
        <img src="${esc(p.imageUrl)}" alt="Instagram post" loading="lazy" onerror="this.parentElement.style.display='none'" />
        <div class="ig-post-overlay">${p.caption ? esc(p.caption.slice(0, 80)) + (p.caption.length > 80 ? '…' : '') : 'View post ↗'}</div>
      </a>`).join('');
  } catch (e) {
    console.warn(`Instagram (${username}):`, e.message);
    grid.innerHTML = `
      <div class="ig-fallback">
        <p>📸 Latest cards on Instagram</p><br/>
        <a href="https://www.instagram.com/${username}/" target="_blank" rel="noopener" class="btn-secondary" style="display:inline-flex;font-size:0.82rem;padding:9px 18px">@${username} ↗</a>
      </div>`;
  }
  observeElements();
}



// ─── NAVBAR ───────────────────────────────────────────────────────────────────
function initNavbar() {
  const nav = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 55);
  }, { passive: true });
  document.getElementById('hamburger')?.addEventListener('click', () => {
    document.getElementById('mobileMenu').classList.toggle('open');
  });
}

// ─── SCROLL ANIMATIONS ────────────────────────────────────────────────────────
let observer;
function observeElements() {
  if (!observer) {
    observer = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
    }, { threshold: 0.1 });
  }
  document.querySelectorAll('.fade-in:not(.visible)').forEach(el => observer.observe(el));
}

// ─── SMOOTH SCROLL ────────────────────────────────────────────────────────────
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const t = document.querySelector(a.getAttribute('href'));
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
    });
  });
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initSmoothScroll();
  initHeroScene();
  observeElements();
  fetchEbayProducts();
  initFilters();
  fetchInstagram('pokemarket92',   'ig-grid-pokemon');
  fetchInstagram('yugiohmaster92', 'ig-grid-yugioh');
});
