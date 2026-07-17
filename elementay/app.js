'use strict';

/* =====================================================================
   DADOS — catálogo, ONGs parceiras e regras de doação
   ===================================================================== */

// Percentual do lucro doado e margem estimada (ilustrativos nesta versão).
const DONATION_SHARE = 0.7;
const PROFIT_MARGIN = 0.3;

const PRODUCTS = [
  { id: 'fogo-1',  el: 'fogo',  name: 'Jaqueta Brasa',      desc: 'Edição numerada · couro vegetal',       price: 689 },
  { id: 'fogo-2',  el: 'fogo',  name: 'Vestido Fúria',      desc: 'Fenda assimétrica · seda flamejada',    price: 549 },
  { id: 'fogo-3',  el: 'fogo',  name: 'Camisa Fagulha',     desc: 'Bordado artesanal · botão de lava',     price: 329 },
  { id: 'agua-1',  el: 'agua',  name: 'Biquíni Maré',       desc: 'Tecido reciclado do oceano · UV50+',    price: 219 },
  { id: 'agua-2',  el: 'agua',  name: 'Sunga Corrente',     desc: 'Secagem rápida · cós anatômico',        price: 149 },
  { id: 'agua-3',  el: 'agua',  name: 'Saída Brisa-do-Mar', desc: 'Linho leve · trama aberta',             price: 189 },
  { id: 'terra-1', el: 'terra', name: 'Legging Rocha',      desc: 'Compressão gradual · bolso lateral',    price: 249 },
  { id: 'terra-2', el: 'terra', name: 'Top Cordilheira',    desc: 'Alta sustentação · malha respirável',   price: 179 },
  { id: 'terra-3', el: 'terra', name: 'Shorts Trilha Viva', desc: 'Ripstop flexível · cadarço interno',    price: 199 },
  { id: 'ar-1',    el: 'ar',    name: 'Moletom Nuvem',      desc: 'Algodão penteado · interior felpado',   price: 259 },
  { id: 'ar-2',    el: 'ar',    name: 'Camiseta Pluma',     desc: 'Oversized · modal ultramacio',          price: 129 },
  { id: 'ar-3',    el: 'ar',    name: 'Calça Horizonte',    desc: 'Cós elástico · caimento fluido',        price: 219 },
];

// Instituições parceiras (exemplos ilustrativos — em homologação).
const NGO_ICO = {
  livro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h13"/><path d="M8 7h7"/></svg>',
  onda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 10c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3"/><path d="M2 16c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3"/></svg>',
  casa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/></svg>',
  broto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21v-8"/><path d="M12 13C12 9 9 7 4 7c0 5 3 7 8 6z"/><path d="M12 13c0-4 3-6 8-6 0 5-3 7-8 6z"/></svg>',
};
const NGOS = [
  { id: 'semear', ico: NGO_ICO.livro, name: 'Instituto Semear Futuro', desc: 'Educação e reforço escolar para crianças em situação de vulnerabilidade.' },
  { id: 'mar',    ico: NGO_ICO.onda,  name: 'Mar Sem Plástico',        desc: 'Limpeza de praias e proteção da vida marinha no litoral brasileiro.' },
  { id: 'abrigo', ico: NGO_ICO.casa,  name: 'Casa Abrigo Esperança',   desc: 'Acolhimento e recomeço para famílias em situação de rua.' },
  { id: 'raizes', ico: NGO_ICO.broto, name: 'Raízes Vivas',            desc: 'Reflorestamento e agrofloresta com comunidades rurais.' },
];

const EL_META = {
  fogo:  { label: 'Fogo',  c1: '#2a0c05', c2: '#8a1e12', c3: '#e2543e', glow: '#ffb37a' },
  agua:  { label: 'Água',  c1: '#07222b', c2: '#0c3945', c3: '#3ba3b8', glow: '#a8e6e6' },
  terra: { label: 'Terra', c1: '#1c180d', c2: '#2e2a1c', c3: '#a07a4f', glow: '#cdb98f' },
  ar:    { label: 'Ar',    c1: '#cfdae3', c2: '#b9c6d2', c3: '#8fa5b5', glow: '#ffffff' },
};

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const donationOf = (subtotal) => subtotal * PROFIT_MARGIN * DONATION_SHARE;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* =====================================================================
   ARTE DOS PRODUTOS — miniaturas SVG generativas por elemento
   ===================================================================== */

let uid = 0;
function swatchSVG(el, seed) {
  const m = EL_META[el];
  const g = `g${uid++}`;
  const r = (n) => { // pseudo-aleatório estável por produto
    const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  let art = '';
  if (el === 'fogo') {
    art = `<path d="M0 300 C${80 + r(1) * 60} ${170 + r(2) * 60} ${140 + r(3) * 40} 250 ${200 + r(4) * 60} ${110 + r(5) * 50}
             C${260 + r(6) * 40} ${40 + r(7) * 60} 320 ${150 + r(8) * 60} 400 ${50 + r(9) * 70} L400 300 Z" fill="${m.glow}" opacity=".2"/>
           <path d="M0 300 C120 ${210 + r(10) * 50} 180 260 ${250 + r(11) * 40} ${150 + r(12) * 50} C310 ${90 + r(13) * 40} 360 200 400 ${130 + r(14) * 40} L400 300 Z" fill="${m.c3}" opacity=".3"/>`;
  } else if (el === 'agua') {
    const y1 = 170 + r(1) * 50, y2 = y1 + 34;
    art = `<path d="M0 ${y1} Q50 ${y1 - 22} 100 ${y1} T200 ${y1} T300 ${y1} T400 ${y1} V300 H0 Z" fill="${m.c2}" opacity=".5"/>
           <path d="M0 ${y2} Q50 ${y2 - 22} 100 ${y2} T200 ${y2} T300 ${y2} T400 ${y2} V300 H0 Z" fill="${m.c1}" opacity=".55"/>
           <circle cx="${60 + r(3) * 260}" cy="${60 + r(4) * 80}" r="${16 + r(5) * 26}" fill="${m.glow}" opacity=".16"/>`;
  } else if (el === 'terra') {
    art = `<path d="M0 300 L${70 + r(1) * 60} ${120 + r(2) * 50} L${160 + r(3) * 40} ${220 + r(4) * 40} L${240 + r(5) * 40} ${90 + r(6) * 40} L${330 + r(7) * 30} ${200 + r(8) * 40} L400 ${130 + r(9) * 40} V300 Z" fill="${m.c1}" opacity=".6"/>
           <circle cx="${280 + r(10) * 80}" cy="${190 + r(11) * 60}" r="${18 + r(12) * 30}" fill="${m.c2}" opacity=".5"/>`;
  } else {
    art = `<ellipse cx="${90 + r(1) * 60}" cy="${90 + r(2) * 40}" rx="${56 + r(3) * 30}" ry="${20 + r(4) * 10}" fill="#fff" opacity=".8"/>
           <ellipse cx="${240 + r(5) * 80}" cy="${170 + r(6) * 60}" rx="${60 + r(7) * 30}" ry="${22 + r(8) * 10}" fill="#fff" opacity=".7"/>
           <path d="M${30 + r(9) * 40} ${230 + r(10) * 30} h${140 + r(11) * 60} a12 12 0 1 0 -12 -16" stroke="${m.c3}" stroke-width="1.4" fill="none" opacity=".5"/>`;
  }
  return `<svg viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="${g}" x1="0" y1="${el === 'ar' ? 0 : 1}" x2="1" y2="${el === 'ar' ? 1 : 0}">
      <stop offset="0" stop-color="${m.c1}"/><stop offset=".55" stop-color="${m.c2}"/><stop offset="1" stop-color="${m.c3}"/>
    </linearGradient></defs>
    <rect width="400" height="300" fill="url(#${g})"/>${art}</svg>`;
}

/* =====================================================================
   RENDER — catálogo e lista pública de ONGs
   ===================================================================== */

function renderCatalog() {
  document.querySelectorAll('.cards[data-element]').forEach((grid) => {
    const el = grid.dataset.element;
    grid.innerHTML = PRODUCTS.filter((p) => p.el === el).map((p, i) => `
      <article class="card reveal ${i ? `d${i}` : ''}">
        <div class="swatch">${swatchSVG(el, p.id.length + i * 7 + el.length)}</div>
        <div class="card-body">
          <h4>${p.name}</h4>
          <p>${p.desc}</p>
          <div class="card-foot">
            <span class="price">${BRL(p.price)}</span>
            <button class="add-btn" data-add="${p.id}">Adicionar</button>
          </div>
        </div>
      </article>`).join('');
  });
}

function renderNgoSection() {
  document.getElementById('ong-list').innerHTML = NGOS.map((n) => `
    <div class="cause">
      <span class="ico" aria-hidden="true">${n.ico}</span>
      <div><h4>${n.name}</h4><p>${n.desc}</p></div>
    </div>`).join('');
}

/* =====================================================================
   CARRINHO — estado em localStorage
   ===================================================================== */

const CART_KEY = 'elementay_cart';
const ORDERS_KEY = 'elementay_orders';

function loadCart() {
  // Blindado contra localStorage adulterado: precisa ser objeto simples,
  // com ids conhecidos e quantidades numéricas positivas.
  try {
    const v = JSON.parse(localStorage.getItem(CART_KEY));
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const clean = {};
    for (const [id, q] of Object.entries(v)) {
      const n = Math.floor(Number(q));
      if (n > 0 && PRODUCTS.some((p) => p.id === id)) clean[id] = n;
    }
    return clean;
  } catch {
    return {};
  }
}
let cart = loadCart();
const saveCart = () => localStorage.setItem(CART_KEY, JSON.stringify(cart));
const cartEntries = () => Object.entries(cart)
  .map(([id, qty]) => ({ product: PRODUCTS.find((p) => p.id === id), qty }))
  .filter((e) => e.product && e.qty > 0);
const cartSubtotal = () => cartEntries().reduce((s, e) => s + e.product.price * e.qty, 0);
const cartCount = () => cartEntries().reduce((s, e) => s + e.qty, 0);

function addToCart(id) {
  cart[id] = (cart[id] || 0) + 1;
  saveCart();
  renderCart();
  const p = PRODUCTS.find((x) => x.id === id);
  toast(`${p.name} adicionado ao carrinho ✦`);
}

function setQty(id, qty) {
  if (qty <= 0) delete cart[id]; else cart[id] = qty;
  saveCart();
  renderCart();
}

function renderCart() {
  const count = cartCount();
  const badge = document.getElementById('cart-count');
  badge.hidden = count === 0;
  badge.textContent = count;

  const box = document.getElementById('drawer-items');
  const entries = cartEntries();
  if (!entries.length) {
    box.innerHTML = '<p class="cart-empty">Seu carrinho está vazio.<br/>Escolha um elemento e comece por ele.</p>';
  } else {
    box.innerHTML = entries.map(({ product: p, qty }) => `
      <div class="cart-item">
        <div class="cart-thumb" style="overflow:hidden;border-radius:.6rem">${swatchSVG(p.el, p.id.length + 3)}</div>
        <div>
          <h5>${p.name}</h5>
          <span class="el-tag">${EL_META[p.el].label}</span>
          <div class="qty">
            <button data-qty="${p.id}:-1" aria-label="Diminuir quantidade">−</button>
            <span>${qty}</span>
            <button data-qty="${p.id}:1" aria-label="Aumentar quantidade">+</button>
          </div>
        </div>
        <div>
          <div class="cart-item-price">${BRL(p.price * qty)}</div>
          <button class="cart-remove" data-remove="${p.id}">remover</button>
        </div>
      </div>`).join('');
  }

  const subtotal = cartSubtotal();
  document.getElementById('drawer-subtotal').textContent = BRL(subtotal);
  document.getElementById('drawer-donation').textContent = subtotal
    ? `✦ ≈ ${BRL(donationOf(subtotal))} irão para a instituição que você escolher no checkout`
    : '';
  document.getElementById('checkout-open').disabled = !subtotal;
}

/* =====================================================================
   DRAWER + CHECKOUT
   ===================================================================== */

const overlay = document.getElementById('overlay');
const drawer = document.getElementById('drawer');
const checkout = document.getElementById('checkout');
let selectedNgo = null;
let buyer = null;
let drawerTimer = null;
let lastFocus = null;

function openDrawer() {
  clearTimeout(drawerTimer);
  lastFocus = document.activeElement;
  overlay.hidden = false; drawer.hidden = false;
  requestAnimationFrame(() => drawer.classList.add('open'));
  document.body.style.overflow = 'hidden';
  document.getElementById('cart-close').focus();
}
function closeDrawer(restoreFocus = true) {
  drawer.classList.remove('open');
  overlay.hidden = true; // imediato: overlay invisível não pode engolir toques
  clearTimeout(drawerTimer);
  drawerTimer = setTimeout(() => { drawer.hidden = true; }, 450);
  document.body.style.overflow = '';
  if (restoreFocus && lastFocus?.focus) lastFocus.focus();
}
function openCheckout() {
  closeDrawer(false);
  checkout.hidden = false;
  document.body.style.overflow = 'hidden';
  goToStep(1);
  renderNgoGrid();
  document.getElementById('checkout-close').focus();
}
function closeCheckout() {
  checkout.hidden = true;
  document.body.style.overflow = '';
  if (lastFocus?.focus) lastFocus.focus();
}

// Mantém o Tab circulando dentro do drawer/modal aberto
function trapFocus(container, e) {
  const focusables = [...container.querySelectorAll('button, [href], input, select, textarea')]
    .filter((el) => !el.disabled && el.offsetParent !== null);
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
  else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
}
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  if (!checkout.hidden) trapFocus(checkout.querySelector('.modal-card'), e);
  else if (!drawer.hidden && drawer.classList.contains('open')) trapFocus(drawer, e);
});

function renderNgoGrid() {
  document.getElementById('ong-grid').innerHTML = NGOS.map((n) => `
    <button type="button" class="ong-card ${selectedNgo === n.id ? 'sel' : ''}"
      data-ngo="${n.id}" aria-pressed="${selectedNgo === n.id}">
      <span class="ong-ico" aria-hidden="true">${n.ico}</span>
      <h4>${n.name}</h4>
      <p>${n.desc}</p>
    </button>`).join('');
  document.getElementById('to-step-2').disabled = !selectedNgo;
}

function goToStep(n) {
  document.querySelectorAll('.step').forEach((s) => s.classList.toggle('on', +s.dataset.step <= Math.min(n, 3)));
  [1, 2, 3, 4].forEach((i) => { document.getElementById(`pane-${i}`).hidden = i !== n; });
}

function recapHTML() {
  const ngo = NGOS.find((n) => n.id === selectedNgo);
  const subtotal = cartSubtotal();
  const items = cartEntries().map(({ product: p, qty }) =>
    `<div class="row"><span class="muted">${qty}× ${p.name}</span><span>${BRL(p.price * qty)}</span></div>`).join('');
  return `${items}
    <div class="row total"><span>Total</span><span>${BRL(subtotal)}</span></div>
    <div class="row donate"><span>✦ Doação estimada para ${ngo.name}</span><span>${BRL(donationOf(subtotal))}</span></div>
    <div class="row"><span class="muted" style="font-size:.72rem">Estimativa: ${Math.round(DONATION_SHARE * 100)}% do lucro (margem ilustrativa de ${Math.round(PROFIT_MARGIN * 100)}%). Demonstração — sem pagamento real.</span></div>`;
}

function confirmOrder() {
  const ngo = NGOS.find((n) => n.id === selectedNgo);
  const subtotal = cartSubtotal();
  const order = {
    id: `ELM-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    buyer,
    ngo: { id: ngo.id, name: ngo.name },
    items: cartEntries().map(({ product: p, qty }) => ({ id: p.id, name: p.name, price: p.price, qty })),
    subtotal,
    estimatedDonation: +donationOf(subtotal).toFixed(2),
  };
  const orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
  orders.push(order);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));

  document.getElementById('success-recap').innerHTML = `
    <div class="row"><span class="muted">Pedido</span><span>${order.id}</span></div>
    <div class="row"><span class="muted">Comprador</span><span>${esc(buyer.nome)}</span></div>
    <div class="row total"><span>Total</span><span>${BRL(subtotal)}</span></div>
    <div class="row donate"><span>✦ Doação para ${ngo.name}</span><span>${BRL(order.estimatedDonation)}</span></div>`;
  cart = {};
  saveCart();
  renderCart();
  goToStep(4);
  document.querySelectorAll('.step').forEach((s) => s.classList.add('on'));
}

/* =====================================================================
   TOAST
   ===================================================================== */

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => { t.hidden = true; }, 400);
  }, 2200);
}

/* =====================================================================
   EVENTOS
   ===================================================================== */

document.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  if (add) return addToCart(add.dataset.add);
  const qty = e.target.closest('[data-qty]');
  if (qty) {
    const [id, delta] = qty.dataset.qty.split(':');
    return setQty(id, (cart[id] || 0) + +delta);
  }
  const rm = e.target.closest('[data-remove]');
  if (rm) return setQty(rm.dataset.remove, 0);
  const ngoBtn = e.target.closest('[data-ngo]');
  if (ngoBtn) {
    selectedNgo = ngoBtn.dataset.ngo;
    renderNgoGrid();
  }
});

document.getElementById('cart-open').addEventListener('click', openDrawer);
document.getElementById('cart-close').addEventListener('click', closeDrawer);
overlay.addEventListener('click', closeDrawer);
document.getElementById('checkout-open').addEventListener('click', openCheckout);
document.getElementById('checkout-close').addEventListener('click', closeCheckout);
document.getElementById('to-step-2').addEventListener('click', () => goToStep(2));
document.getElementById('back-to-1').addEventListener('click', () => goToStep(1));
document.getElementById('back-to-2').addEventListener('click', () => goToStep(2));
document.getElementById('checkout-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  buyer = { nome: data.get('nome'), email: data.get('email') };
  document.getElementById('recap').innerHTML = recapHTML();
  goToStep(3);
});
document.getElementById('confirm-order').addEventListener('click', confirmOrder);
document.getElementById('success-close').addEventListener('click', closeCheckout);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!checkout.hidden) closeCheckout();
  else if (!drawer.hidden) closeDrawer();
});
document.getElementById('join-form').addEventListener('submit', (e) => {
  e.preventDefault();
  e.target.querySelector('button').textContent = 'Recebido ✦';
});

/* =====================================================================
   NAVBAR + REVEAL
   ===================================================================== */

const nav = document.getElementById('nav');
addEventListener('scroll', () => nav.classList.toggle('solid', scrollY > 40), { passive: true });

const io = new IntersectionObserver((entries) => {
  for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
}, { threshold: 0.15 });
const observeReveals = () => document.querySelectorAll('.reveal:not(.in)').forEach((el) => io.observe(el));

/* =====================================================================
   EFEITOS DE CANVAS — hero + um efeito por elemento
   Cada canvas só anima enquanto está visível na tela.
   ===================================================================== */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

function makeFx(canvas, setup, draw) {
  const cx = canvas.getContext('2d');
  let W, H, state, running = false, raf;
  const resize = () => {
    W = canvas.width = canvas.offsetWidth * devicePixelRatio;
    H = canvas.height = canvas.offsetHeight * devicePixelRatio;
    state = setup(W, H);
  };
  const loop = () => {
    if (!running) return;
    draw(cx, W, H, state);
    raf = requestAnimationFrame(loop);
  };
  resize();
  addEventListener('resize', resize);
  if (REDUCED) { draw(cx, W, H, state); return; } // um frame estático
  new IntersectionObserver(([en]) => {
    running = en.isIntersecting;
    if (running) loop(); else cancelAnimationFrame(raf);
  }).observe(canvas);
}

const rnd = (a, b) => a + Math.random() * (b - a);
const dpr = () => devicePixelRatio;

/* HERO — partículas dos quatro elementos */
makeFx(document.getElementById('veil'),
  (W, H) => Array.from({ length: Math.min(90, Math.floor(W / 22)) }, () => ({
    x: rnd(0, W), y: rnd(0, H), r: rnd(0.6, 2.6) * dpr(),
    vx: rnd(-0.09, 0.09) * dpr(), vy: rnd(-0.36, -0.06) * dpr(),
    c: ['#e2543e', '#3ba3b8', '#a07a4f', '#b9c6d2'][Math.floor(rnd(0, 4))],
    o: rnd(0.15, 0.65), tw: rnd(0, Math.PI * 2),
  })),
  (cx, W, H, ps) => {
    cx.clearRect(0, 0, W, H);
    for (const p of ps) {
      p.x += p.vx; p.y += p.vy; p.tw += 0.02;
      if (p.y < -10) { p.y = H + 10; p.x = rnd(0, W); }
      if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
      cx.globalAlpha = p.o * (0.65 + 0.35 * Math.sin(p.tw));
      cx.fillStyle = p.c;
      cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, Math.PI * 2); cx.fill();
    }
  });

/* FOGO — brasas subindo com rastro de calor */
function fxFogo(canvas) {
  makeFx(canvas,
    (W, H) => Array.from({ length: Math.min(70, Math.floor(W / 30)) }, () => ({
      x: rnd(0, W), y: rnd(0, H),
      r: rnd(0.7, 2.4) * dpr(), vy: rnd(0.25, 0.9) * dpr(),
      sway: rnd(0.2, 1.2), ph: rnd(0, Math.PI * 2), o: rnd(0.25, 0.85),
    })),
    (cx, W, H, ps) => {
      cx.clearRect(0, 0, W, H);
      for (const p of ps) {
        p.y -= p.vy; p.ph += 0.03;
        p.x += Math.sin(p.ph) * p.sway * dpr() * 0.4;
        if (p.y < -12) { p.y = H + 12; p.x = rnd(0, W); }
        const flick = 0.55 + 0.45 * Math.sin(p.ph * 3);
        cx.globalAlpha = p.o * flick;
        const grad = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        grad.addColorStop(0, '#ffb37a'); grad.addColorStop(0.4, '#e2543e'); grad.addColorStop(1, 'transparent');
        cx.fillStyle = grad;
        cx.beginPath(); cx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2); cx.fill();
      }
    });
}

/* ÁGUA — ondas senoidais sobrepostas + bolhas subindo */
function fxAgua(canvas) {
  makeFx(canvas,
    (W, H) => ({
      t: 0,
      bubbles: Array.from({ length: Math.min(34, Math.floor(W / 60)) }, () => ({
        x: rnd(0, W), y: rnd(0, H), r: rnd(1, 3.4) * dpr(), vy: rnd(0.2, 0.6) * dpr(), o: rnd(0.1, 0.4),
      })),
    }),
    (cx, W, H, s) => {
      cx.clearRect(0, 0, W, H);
      s.t += 0.008;
      const layers = [
        { amp: 14, yBase: 0.82, color: 'rgba(59,163,184,.10)', speed: 1 },
        { amp: 20, yBase: 0.88, color: 'rgba(168,230,230,.07)', speed: 1.6 },
        { amp: 26, yBase: 0.94, color: 'rgba(12,57,69,.35)', speed: 0.7 },
      ];
      for (const l of layers) {
        cx.beginPath();
        cx.moveTo(0, H);
        for (let x = 0; x <= W; x += 8 * dpr()) {
          const y = H * l.yBase + Math.sin(x / (90 * dpr()) + s.t * l.speed * 6) * l.amp * dpr();
          cx.lineTo(x, y);
        }
        cx.lineTo(W, H); cx.closePath();
        cx.fillStyle = l.color; cx.globalAlpha = 1; cx.fill();
      }
      for (const b of s.bubbles) {
        b.y -= b.vy;
        if (b.y < -8) { b.y = H + 8; b.x = rnd(0, W); }
        cx.globalAlpha = b.o;
        cx.strokeStyle = '#a8e6e6'; cx.lineWidth = dpr() * 0.8;
        cx.beginPath(); cx.arc(b.x, b.y, b.r, 0, Math.PI * 2); cx.stroke();
      }
    });
}

/* TERRA — poeira dourada em deriva + silhueta de montanhas em parallax */
function fxTerra(canvas) {
  makeFx(canvas,
    (W, H) => ({
      t: 0,
      dust: Array.from({ length: Math.min(60, Math.floor(W / 34)) }, () => ({
        x: rnd(0, W), y: rnd(0, H), r: rnd(0.5, 1.8) * dpr(),
        vx: rnd(0.08, 0.4) * dpr(), vy: rnd(-0.06, 0.06) * dpr(), o: rnd(0.12, 0.5), ph: rnd(0, Math.PI * 2),
      })),
      ridge: Array.from({ length: 9 }, (_, i) => ({ x: i / 8, y: rnd(0.55, 0.8) })),
    }),
    (cx, W, H, s) => {
      cx.clearRect(0, 0, W, H);
      s.t += 0.004;
      cx.beginPath();
      cx.moveTo(0, H);
      for (const p of s.ridge) cx.lineTo(p.x * W, p.y * H + Math.sin(s.t + p.x * 9) * 4 * dpr());
      cx.lineTo(W, H); cx.closePath();
      cx.fillStyle = 'rgba(46,42,28,.5)'; cx.fill();
      for (const d of s.dust) {
        d.x += d.vx; d.y += d.vy + Math.sin(d.ph += 0.01) * 0.08 * dpr();
        if (d.x > W + 8) { d.x = -8; d.y = rnd(0, H); }
        cx.globalAlpha = d.o * (0.6 + 0.4 * Math.sin(d.ph * 2));
        cx.fillStyle = '#cdb98f';
        cx.beginPath(); cx.arc(d.x, d.y, d.r, 0, Math.PI * 2); cx.fill();
      }
    });
}

/* AR — nuvens suaves em deriva + fios de brisa */
function fxAr(canvas) {
  makeFx(canvas,
    (W, H) => ({
      t: 0,
      clouds: Array.from({ length: Math.min(14, Math.floor(W / 140)) }, () => ({
        x: rnd(0, W), y: rnd(0, H * 0.85), rx: rnd(50, 130) * dpr(), ry: rnd(14, 34) * dpr(),
        vx: rnd(0.06, 0.24) * dpr(), o: rnd(0.18, 0.5),
      })),
    }),
    (cx, W, H, s) => {
      cx.clearRect(0, 0, W, H);
      s.t += 0.006;
      for (const c of s.clouds) {
        c.x += c.vx;
        if (c.x - c.rx > W) c.x = -c.rx;
        cx.globalAlpha = c.o;
        const grad = cx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.rx);
        grad.addColorStop(0, 'rgba(255,255,255,.9)'); grad.addColorStop(1, 'transparent');
        cx.fillStyle = grad;
        cx.save(); cx.translate(c.x, c.y); cx.scale(1, c.ry / c.rx);
        cx.beginPath(); cx.arc(0, 0, c.rx, 0, Math.PI * 2); cx.fill(); cx.restore();
      }
      cx.globalAlpha = 0.25; cx.strokeStyle = '#5d707f'; cx.lineWidth = dpr();
      for (let i = 0; i < 3; i++) {
        cx.beginPath();
        const y0 = H * (0.25 + i * 0.22);
        for (let x = 0; x <= W; x += 12 * dpr()) {
          cx.lineTo(x, y0 + Math.sin(x / (140 * dpr()) + s.t * (2 + i)) * 10 * dpr());
        }
        cx.stroke();
      }
    });
}

/* =====================================================================
   BOOT
   ===================================================================== */

renderCatalog();
renderNgoSection();
renderCart();
observeReveals();

const FX = { fogo: fxFogo, agua: fxAgua, terra: fxTerra, ar: fxAr };
document.querySelectorAll('canvas.fx').forEach((c) => FX[c.dataset.fx]?.(c));
