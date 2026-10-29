'use strict';

/* =========================================================
   Estado
   ========================================================= */
const KEY = 'pickup.v1';
const GROUP_LABEL = { IR: 'Illustration Rare', OT: 'Other' };
const DAY_MS = 86400000;

const FONTS = {
  cormorant:  { name: 'Cormorant Garamond', css: "'Cormorant Garamond', Georgia, serif", scale: 1.14 },
  playfair:   { name: 'Playfair Display',   css: "'Playfair Display', Georgia, serif",   scale: 1 },
  cinzel:     { name: 'Cinzel',             css: "'Cinzel', Georgia, serif",             scale: .96 },
  montserrat: { name: 'Montserrat',         css: "'Montserrat', system-ui, sans-serif",  scale: .96 },
  system:     { name: 'San Francisco (sistema)', css: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif", scale: 1 },
};

const PRESETS = {
  claro:  { name: 'Claro',  bg: '#f6f5f2', text: '#1c1b19', btn: '#1c1b19', btnText: '#ffffff', panel: '#ffffff', bar: '#ffffff', cardBack: '#2b2a3a' },
  oscuro: { name: 'Oscuro', bg: '#0f0f10', text: '#f2f0ec', btn: '#f2f0ec', btnText: '#111111', panel: '#1c1c1e', bar: '#1c1c1e', cardBack: '#3a2f5c' },
  crema:  { name: 'Crema',  bg: '#f3ede2', text: '#3b2f25', btn: '#7a5c3e', btnText: '#fff8ee', panel: '#fffaf2', bar: '#fffaf2', cardBack: '#7a5c3e' },
  noche:  { name: 'Noche',  bg: '#0e1424', text: '#e8ecf5', btn: '#c9a45c', btnText: '#0e1424', panel: '#18213a', bar: '#18213a', cardBack: '#1f2d52' },
  bosque: { name: 'Bosque', bg: '#eef1ea', text: '#1f2a22', btn: '#2f5d46', btnText: '#f3f7f1', panel: '#ffffff', bar: '#ffffff', cardBack: '#2f5d46' },
  rosa:   { name: 'Rosa',   bg: '#f8eef0', text: '#3a2329', btn: '#b5485f', btnText: '#ffffff', panel: '#ffffff', bar: '#ffffff', cardBack: '#8c3448' },
};
const COLOR_FIELDS = [
  ['bg', 'Fondo'], ['text', 'Texto'], ['btn', 'Botones'], ['btnText', 'Texto de botones'],
  ['panel', 'Menús y listas'], ['bar', 'Barra inferior'], ['cardBack', 'Reverso de las cartas'],
];
const ALPHA_FIELDS = [['btn', 'Botones'], ['panel', 'Menús y listas'], ['bar', 'Barra inferior']];

const TYPES = [
  ['Planta', '#43a047'], ['Fuego', '#e53935'], ['Eléctrico', '#f5c518'], ['Agua', '#1e88e5'],
  ['Normal', '#cfcfc8'], ['Lucha', '#8d5a3b'], ['Dragón', '#c8952b'], ['Psíquico', '#8e44ad'],
  ['Acero', '#a7b1bc'], ['Siniestro', '#1f2f56'], ['Entrenador', '#161616'],
];
const DEFAULT_TYPE_COLORS = Object.fromEntries(TYPES);
const typeKey = t => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const TYPE_BY_KEY = Object.fromEntries(TYPES.map(([t]) => [typeKey(t), t]));
// "Planta / Fuego" -> ['Planta', 'Fuego']
function cardTypes(card) {
  return String(card.type || '').split('/').map(x => TYPE_BY_KEY[typeKey(x)] || x.trim()).filter(Boolean);
}

const DEFAULT_LOOK = {
  preset: 'auto',                 // auto | claves de PRESETS | custom
  colors: Object.assign({}, PRESETS.claro),
  transp: { btn: 0, panel: 0, bar: 25 },   // % de transparencia
  bgStyle: 'solid',
  groupColors: { IR: '#c9952e', OT: '#5e86b8' },
  typeColors: {},   // se rellena con DEFAULT_TYPE_COLORS
  fontTitle: 'cormorant',
  fontBody: 'system',
};
const DEFAULT_SETTINGS = {
  schedOn: false,
  freq: 'daily',
  weekdays: [1, 2, 3, 4, 5],
  every: 2,
  start: isoDate(new Date()),
  monthDay: 1,
  times: ['20:00'],
  notifOn: false,
  show: { num: true, set: true, dex: true, type: true },
  colorBy: 'group',        // group | type: color de todas las cartas
  calWeeks: 8,
  spinSecs: 4,
  backStyle: 'classic',   // classic | deco | tarot | holo | geo
  sortBy: 'custom',        // custom | set | name | num | dex | date
  sortDir: 'asc',
  filterSets: [],
  filterTypes: [],
  filterAvail: 'all',      // all | yes | no
  dexFrom: '',
  dexTo: '',
};

let state = load();

function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (!s || !Array.isArray(s.cards)) s = { cards: [], removed: [], history: [], plan: {}, lastHandled: Date.now() };
  s.removed = s.removed || [];
  s.history = s.history || [];
  s.plan = s.plan || {};
  s.settings = Object.assign({}, DEFAULT_SETTINGS, s.settings || {});
  s.settings.show = Object.assign({}, DEFAULT_SETTINGS.show, s.settings.show || {});
  const lk = s.look || {};
  s.look = Object.assign({}, DEFAULT_LOOK, lk);
  s.look.colors = Object.assign({}, DEFAULT_LOOK.colors, lk.colors || {});
  s.look.transp = Object.assign({}, DEFAULT_LOOK.transp, lk.transp || {});
  s.look.groupColors = Object.assign({}, DEFAULT_LOOK.groupColors, lk.groupColors || {});
  s.look.typeColors = Object.assign({}, DEFAULT_TYPE_COLORS, lk.typeColors || {});
  // color por carta: auto (según Ajustes) | group | type | custom
  s.cards.forEach(c => { if (!c.colorMode) c.colorMode = c.color ? 'custom' : 'auto'; });
  s.history.forEach((h, i) => { if (!h.hid) h.hid = 'h' + h.at + '-' + i; });
  const removed = new Set(s.removed);
  // Fichero base nuevo: actualiza los datos de cada carta (conserva tu orden y tus colores)
  if ((s.seedVersion || 1) < SEED_VERSION) {
    const seedById = new Map(SEED_CARDS.map(c => [c.id, c]));
    const seedNames = new Set(SEED_CARDS.map(c => c.name.toLowerCase()));
    s.cards = s.cards.filter(c => !(c.id.startsWith('u') && seedNames.has(c.name.toLowerCase())));
    s.cards.forEach(c => {
      const sc = seedById.get(c.id);
      if (sc) for (const k of ['name', 'num', 'date', 'set', 'dex', 'type', 'group']) c[k] = sc[k];
    });
  }
  s.seedVersion = SEED_VERSION;
  // Añade las cartas del fichero base que falten (salvo las que quitaste)
  const have = new Set(s.cards.map(c => c.id));
  for (const c of SEED_CARDS) if (!have.has(c.id) && !removed.has(c.id)) s.cards.push(Object.assign({ colorMode: 'auto' }, c));
  return s;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast('No se pudo guardar en este dispositivo'); }
}

/* =========================================================
   Utilidades
   ========================================================= */
function isoDate(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// Entero aleatorio uniforme en [0, n): todas las cartas con la misma probabilidad
function randInt(n) {
  if (window.crypto && crypto.getRandomValues) {
    const max = Math.floor(0x100000000 / n) * n;
    const buf = new Uint32Array(1);
    do { crypto.getRandomValues(buf); } while (buf[0] >= max);
    return buf[0] % n;
  }
  return Math.floor(Math.random() * n);
}
// Solo las cartas disponibles entran en el sorteo, todas con la misma probabilidad
function availableCards() { return state.cards.filter(c => !c.unavailable); }
function randomCard() { const pool = availableCards(); return pool.length ? pool[randInt(pool.length)] : null; }
function cardById(id) { return state.cards.find(c => c.id === id) || null; }
function splitName(name) {
  const m = String(name).match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  return m ? [m[1], m[2]] : [name, ''];
}
function details(card) {
  const sh = state.settings.show, out = [];
  if (sh.num && card.num) out.push(['Nº', card.num]);
  if (sh.set && card.set) out.push(['Expansión', card.set]);
  if (sh.type && card.type) out.push(['Tipo', cardTypes(card).join(' / ')]);
  if (sh.dex && card.dex) out.push(['Pokédex', card.dex === '-' ? '—' : '#' + card.dex]);
  return out;
}
const fmtTime = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });
const fmtDay = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
function fmtWhen(ts) {
  const d = new Date(ts);
  if (isoDate(d) === isoDate(new Date())) return 'hoy ' + fmtTime.format(d);
  if (isoDate(d) === isoDate(new Date(Date.now() - DAY_MS))) return 'ayer ' + fmtTime.format(d);
  return fmtDay.format(d) + ' · ' + fmtTime.format(d);
}
function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(x => x + x).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function isDark(hex) { const [R, G, B] = hexToRgb(hex); return (R * .299 + G * .587 + B * .114) < 128; }
const rgba = (hex, a) => `rgba(${hexToRgb(hex).join(',')},${a})`;
function shade(hex, amt) {   // amt > 0 aclara, < 0 oscurece
  const [r, g, b] = hexToRgb(hex);
  const f = v => Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt));
  return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

// Colores de una carta según su modo (o el de Ajustes si está en automático)
function cardColors(card, mode) {
  mode = mode || (card.colorMode && card.colorMode !== 'auto' ? card.colorMode : state.settings.colorBy);
  const groupC = state.look.groupColors[card.group] || '#999999';
  if (mode === 'custom' && card.color) return [card.color];
  if (mode === 'type') {
    const cs = cardTypes(card).map(t => state.look.typeColors[t]).filter(Boolean).slice(0, 2);
    if (cs.length) return cs;
  }
  return [groupC];
}
function cardGrad(color) { return `linear-gradient(135deg, ${shade(color, .5)}, ${color} 55%, ${shade(color, -.28)})`; }
function paint(colors) {
  if (colors.length < 2) return cardGrad(colors[0]);
  const [a, b] = colors;   // dos tipos: se degradan ambos colores
  return `linear-gradient(135deg, ${shade(a, .35)}, ${a} 30%, ${b} 70%, ${shade(b, -.22)})`;
}
function cardPaint(card, mode) { return paint(cardColors(card, mode)); }
function miniCard(card) { return `<span class="mini-card" style="background:${cardPaint(card)}"></span>`; }

/* =========================================================
   Apariencia
   ========================================================= */
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
function currentColors() {
  const lk = state.look;
  if (lk.preset === 'auto') return PRESETS[darkMQ.matches ? 'oscuro' : 'claro'];
  if (PRESETS[lk.preset]) return PRESETS[lk.preset];
  return lk.colors;
}
function applyLook() {
  const lk = state.look, c = currentColors(), r = document.documentElement.style;
  const a = k => 1 - (lk.transp[k] || 0) / 100;
  r.setProperty('--bg', c.bg);
  r.setProperty('--text', c.text);
  r.setProperty('--muted', rgba(c.text, .58));
  r.setProperty('--line', rgba(c.text, .1));
  r.setProperty('--btn', rgba(c.btn, a('btn')));
  r.setProperty('--btn-solid', c.btn);
  r.setProperty('--btn-text', c.btnText);
  r.setProperty('--panel', rgba(c.panel, a('panel')));
  r.setProperty('--panel-solid', c.panel);
  r.setProperty('--bar', rgba(c.bar, a('bar')));
  r.setProperty('--card-back', c.cardBack);
  r.setProperty('--card-back-2', shade(c.cardBack, .28));
  r.setProperty('--bg-image', lk.bgStyle === 'gradient'
    ? `radial-gradient(70% 45% at 10% 5%, ${rgba(c.btn, .28)}, transparent 70%), radial-gradient(60% 45% at 95% 60%, ${rgba(c.cardBack, .3)}, transparent 70%), radial-gradient(60% 40% at 20% 100%, ${rgba(shade(c.cardBack, .5), .3)}, transparent 70%)`
    : 'none');
  const ft = FONTS[lk.fontTitle] || FONTS.cormorant, fb = FONTS[lk.fontBody] || FONTS.system;
  r.setProperty('--font-title', ft.css);
  r.setProperty('--font-body', fb.css);
  r.setProperty('--body-size', (16 * fb.scale).toFixed(1) + 'px');
  $('#themeColor').setAttribute('content', c.bg);
  const dark = isDark(c.bg);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  for (const g of ['IR', 'OT']) {
    const gc = lk.groupColors[g], k = g.toLowerCase();
    r.setProperty(`--${k}`, shade(gc, dark ? .3 : -.18));
    r.setProperty(`--${k}-bg`, rgba(gc, dark ? .22 : .16));
  }
}
darkMQ.addEventListener?.('change', () => { if (state.look.preset === 'auto') { applyLook(); renderLookSettings(); } });

/* =========================================================
   Pantallas y barra inferior
   ========================================================= */
function showTab(tab) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.dataset.tab === tab));
  $$('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  window.scrollTo(0, 0);
  if (tab === 'settings') fillSettings();
  if (tab === 'collection') renderPool();
}
$('#tabbar').addEventListener('click', e => { const b = e.target.closest('button'); if (b) showTab(b.dataset.tab); });

/* =========================================================
   Cartas (visual)
   ========================================================= */
function backHTML() { return '<div class="face back"></div>'; }
function frontHTML(card) {
  const [n, code] = splitName(card.name);
  const meta = details(card).filter(([k]) => k !== 'Pokédex');
  const dex = state.settings.show.dex && card.dex && card.dex !== '-' ? '#' + card.dex : '';
  return `<div class="face front">
    <div class="band" style="background:${cardPaint(card)}">${dex ? `<span class="dex">${esc(dex)}</span>` : ''}</div>
    <div class="fbody">
      <p class="fname">${esc(n)}</p>
      ${code ? `<p class="fcode">${esc(code)}</p>` : ''}
      <span class="badge ${card.group}">${GROUP_LABEL[card.group]}</span>
      ${meta.length ? `<ul class="fmeta">${meta.map(([k, v]) => `<li><span>${esc(k)}</span><b>${esc(v)}</b></li>`).join('')}</ul>` : ''}
    </div></div>`;
}
const BACKS = [['classic', 'Clásico'], ['deco', 'Art déco'], ['tarot', 'Tarot'], ['holo', 'Holo'], ['geo', 'Geométrico'],
  ['types', 'Tipos'], ['elem', 'Elementos'], ['neon', 'Neón'], ['vint', 'Vintage'], ['retro', 'Retro']];
function pcard(card, style) {
  return `<div class="pcard b-${style || state.settings.backStyle}"><div class="inner">${backHTML()}${card ? frontHTML(card) : ''}</div></div>`;
}

/* =========================================================
   Pick Your Card
   ========================================================= */
const reel = $('#reel'), btnPick = $('#btnPick');
let spinning = false;

function showIdle() {
  reel.innerHTML = `<div class="deck">${pcard()}${pcard()}${pcard()}</div>`;
}
function cardWidth() { return parseFloat(getComputedStyle(reel.querySelector('.pcard') || reel).width) || 230; }

function showStatic(card, eyebrow) {
  $('#pickEyebrow').textContent = eyebrow;
  reel.innerHTML = `<div class="track done">${pcard(card)}</div>`;
  const track = reel.firstChild, el = track.firstChild;
  track.style.transform = `translateX(${(reel.clientWidth - cardWidth()) / 2}px)`;
  el.classList.add('chosen');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('flipped')));
}

function spin(card, eyebrow) {
  spinning = true;
  btnPick.disabled = true;
  $('#pickEyebrow').innerHTML = '&nbsp;';
  const secs = Math.min(10, Math.max(1, +state.settings.spinSecs || 4));
  const total = Math.round(10 + secs * 7) + randInt(5);   // nº de cartas que pasan
  const target = total - 4;                // la que se detiene en el centro
  let html = '';
  for (let i = 0; i < total; i++) html += pcard(i === target ? card : null);
  reel.innerHTML = `<div class="track">${html}</div>`;
  const track = reel.firstChild;
  const w = cardWidth(), gap = 16, step = w + gap, cw = reel.clientWidth;
  const startX = cw * .55;                                  // entran por la derecha
  const endX = cw / 2 - (target * step + w / 2);           // centrada
  const duration = secs * 1000;                            // 1–10 s (Ajustes)
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const anim = track.animate(
    [{ transform: `translateX(${startX}px)` }, { transform: `translateX(${endX}px)` }],
    { duration: reduce ? 600 : duration, easing: 'cubic-bezier(.12,.62,.1,1)', fill: 'forwards' });
  anim.finished.then(() => {
    track.style.transform = `translateX(${endX}px)`;
    anim.cancel();
    const el = track.children[target];
    track.classList.add('done');
    el.classList.add('chosen');
    setTimeout(() => {
      el.classList.add('flipped');
      $('#pickEyebrow').textContent = eyebrow;
      setTimeout(() => { spinning = false; btnPick.disabled = false; }, 700);
    }, 250);
  });
}

btnPick.addEventListener('click', () => {
  if (spinning) return;
  const card = randomCard();
  if (!card) return toast(state.cards.length ? 'No hay cartas disponibles' : 'Añade cartas a tu colección');
  addHistory(card, Date.now(), 'manual');
  save();
  spin(card, 'Your next card is…');
});

/* =========================================================
   Historial
   ========================================================= */
function addHistory(card, at, source) {
  state.history.unshift({ hid: 'h' + at + '-' + randInt(1e6), id: card.id, name: card.name, group: card.group, at, source });
  state.history = state.history.slice(0, 300);
}
const dlgHist = $('#dlgHistory'), histList = $('#histList');
let histSelecting = false;
const histSel = new Set();

function renderHistory() {
  const has = state.history.length > 0;
  histList.classList.toggle('selecting', histSelecting);
  histList.innerHTML = has ? state.history.map(h => {
    const card = cardById(h.id) || h;
    return `<li data-hid="${esc(h.hid)}" class="${histSel.has(h.hid) ? 'on' : ''}"><span class="sel"></span>${miniCard(card)}
      <div class="li-main"><div class="li-name">${esc(h.name)}</div>
      <div class="li-sub">${GROUP_LABEL[h.group]}${h.source === 'sched' ? ' · programada' : ''}</div></div>
      <span class="when">${fmtWhen(h.at)}</span></li>`;
  }).join('') : '<li class="empty-row">Aún no hay elecciones</li>';
  $('#btnSelHist').textContent = histSelecting ? 'Cancelar' : 'Seleccionar';
  $('#btnSelHist').hidden = !has;
  $('#histActions').hidden = !has || histSelecting;
  $('#histSelActions').hidden = !has || !histSelecting;
  $('#btnDelSel').textContent = `Eliminar (${histSel.size})`;
  $('#btnDelSel').disabled = !histSel.size;
  $('#btnSelAll').textContent = histSel.size === state.history.length ? 'Quitar selección' : 'Seleccionar todo';
  $('#histQty').max = state.history.length;
}
function removeHistory(pred) { state.history = state.history.filter(h => !pred(h)); save(); }

$('#btnHistory').addEventListener('click', () => { histSelecting = false; histSel.clear(); renderHistory(); dlgHist.showModal(); });
$('#btnCloseHist').addEventListener('click', () => dlgHist.close());
$('#btnSelHist').addEventListener('click', () => { histSelecting = !histSelecting; histSel.clear(); renderHistory(); });
histList.addEventListener('click', e => {
  if (!histSelecting) return;
  const li = e.target.closest('li[data-hid]'); if (!li) return;
  const id = li.dataset.hid;
  histSel.has(id) ? histSel.delete(id) : histSel.add(id);
  renderHistory();
});
$('#btnSelAll').addEventListener('click', () => {
  if (histSel.size === state.history.length) histSel.clear();
  else state.history.forEach(h => histSel.add(h.hid));
  renderHistory();
});
$('#btnDelSel').addEventListener('click', () => {
  const n = histSel.size; if (!n) return;
  if (!confirm(`¿Eliminar ${n} ${n === 1 ? 'elección' : 'elecciones'} del historial?`)) return;
  removeHistory(h => histSel.has(h.hid));
  histSel.clear(); histSelecting = false; renderHistory(); toast('Eliminadas');
});
$('#btnDelQty').addEventListener('click', () => {
  const total = state.history.length;
  const n = Math.min(total, Math.max(1, parseInt($('#histQty').value, 10) || 0));
  if (!n) return;
  const which = $('#histWhich').value;
  if (!confirm(`¿Eliminar las ${n} elecciones ${which === 'old' ? 'más antiguas' : 'más recientes'}?`)) return;
  // el historial está ordenado de más reciente a más antigua
  state.history = which === 'new' ? state.history.slice(n) : state.history.slice(0, total - n);
  save(); renderHistory(); toast(`${n} eliminadas`);
});
$('#btnClearHist').addEventListener('click', () => {
  if (!state.history.length || !confirm('¿Borrar todo el historial?')) return;
  state.history = []; save(); renderHistory();
});

/* =========================================================
   Programación
   ========================================================= */
function dayMatches(date) {
  const s = state.settings;
  switch (s.freq) {
    case 'daily': return true;
    case 'weekdays': return s.weekdays.includes(date.getDay());
    case 'every': {
      const st = new Date((s.start || isoDate(new Date())) + 'T00:00:00');
      const diff = Math.round((date - st) / DAY_MS);
      return diff >= 0 && diff % Math.max(1, s.every | 0) === 0;
    }
    case 'monthly': {
      const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      return date.getDate() === Math.min(Math.max(1, s.monthDay | 0), last);
    }
  }
  return false;
}
function slotsBetween(from, until, limit = 500) {
  const times = [...state.settings.times].sort(), out = [];
  if (!times.length) return out;
  const start = new Date(from); start.setHours(0, 0, 0, 0);
  for (let i = 0; i < 800; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (day.getTime() > until) break;
    if (!dayMatches(day)) continue;
    for (const t of times) {
      const [h, m] = t.split(':').map(Number);
      const ts = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).getTime();
      if (ts > from && ts <= until) { out.push(ts); if (out.length >= limit) return out; }
    }
  }
  return out;
}
function nextSlot() { return slotsBetween(Date.now(), Date.now() + 800 * DAY_MS, 1)[0] || null; }
function cardForSlot(ts) {
  const planned = state.plan[ts] && cardById(state.plan[ts]);
  return (planned && !planned.unavailable) ? planned : randomCard();
}

function checkSchedule() {
  const now = Date.now();
  if (!state.settings.schedOn) { state.lastHandled = now; save(); renderNext(); return; }
  const due = slotsBetween(state.lastHandled || now, now, 50);
  state.lastHandled = now;
  let last = null;
  for (const ts of due) {
    const card = cardForSlot(ts);
    if (!card) continue;
    addHistory(card, ts, 'sched');
    last = { card, ts };
  }
  if (last) {
    if (!spinning) {
      showTab('pick');
      showStatic(last.card, 'Pick programado · ' + fmtTime.format(new Date(last.ts)));
    }
    notify(last.card);
  }
  for (const k of Object.keys(state.plan)) if (+k <= now) delete state.plan[k];
  save();
  renderNext();
}
function renderNext() {
  let txt = '';
  if (state.settings.schedOn) {
    const n = nextSlot();
    txt = n ? 'Próximo pick: ' + fmtDay.format(new Date(n)) + ' · ' + fmtTime.format(new Date(n)) : 'Sin próximos picks programados';
  }
  $('#nextLine').textContent = txt;
  $('#nextLine2').textContent = txt;
}

/* =========================================================
   Notificaciones y Calendario
   ========================================================= */
function notifSupported() { return 'Notification' in window; }
function notifText(card) {
  return {
    title: `Pick up: ${card.name}`,
    body: [GROUP_LABEL[card.group]].concat(details(card).map(([k, v]) => `${k} ${v}`)).join(' · '),
  };
}
async function notify(card) {
  if (!state.settings.notifOn || !notifSupported() || Notification.permission !== 'granted') return;
  const { title, body } = notifText(card);
  const opts = { body, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'pickup-' + Date.now() };
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg) return reg.showNotification(title, opts);
    new Notification(title, opts);
  } catch (e) {}
}
function icsDate(ts) { return new Date(ts).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
function icsEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1'); }
async function exportCalendar() {
  const s = state.settings;
  if (!s.schedOn) return toast('Activa primero la elección automática');
  if (!s.times.length) return toast('Añade al menos una hora');
  if (!state.cards.length) return toast('La colección está vacía');
  const now = Date.now();
  const slots = slotsBetween(now, now + s.calWeeks * 7 * DAY_MS, 400);
  if (!slots.length) return toast('No hay picks en ese periodo');
  const appUrl = location.href.split('#')[0].split('?')[0];
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pick up//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Pick up'];
  for (const ts of slots) {
    const card = cardForSlot(ts);
    state.plan[ts] = card.id;
    const { title, body } = notifText(card);
    L.push('BEGIN:VEVENT', `UID:pickup-${ts}@pick-up`, `DTSTAMP:${icsDate(now)}`, `DTSTART:${icsDate(ts)}`,
      `DTEND:${icsDate(ts + 15 * 60000)}`, `SUMMARY:${icsEsc(title)}`, `DESCRIPTION:${icsEsc(body)}`, `URL:${appUrl}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(title)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
  }
  L.push('END:VCALENDAR');
  save();
  const file = new File([L.join('\r\n')], 'pick-up.ics', { type: 'text/calendar' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Pick up' }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a'); a.href = url; a.download = 'pick-up.ics';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast(`${slots.length} picks listos para el Calendario`);
}

/* =========================================================
   Colección
   ========================================================= */
const SORTS = [['custom', 'Mi orden'], ['set', 'Expansión'], ['name', 'Nombre'], ['num', 'Nº de carta'], ['dex', 'Nº Pokédex'], ['type', 'Tipo'], ['date', 'Fecha de salida']];
const typeOrder = c => { const t = cardTypes(c)[0]; const i = TYPES.findIndex(x => x[0] === t); return i < 0 ? 99 : i; };
const coll = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
function numKey(c) { const m = String(c.num || '').match(/\d+/); return m ? +m[0] : Infinity; }
function dexKey(c) { const n = parseInt(c.dex, 10); return isNaN(n) ? Infinity : n; }
const SORT_FN = {
  set:  (a, b) => coll.compare(a.set || '', b.set || '') || numKey(a) - numKey(b),
  name: (a, b) => coll.compare(a.name, b.name),
  num:  (a, b) => numKey(a) - numKey(b) || coll.compare(a.set || '', b.set || ''),
  dex:  (a, b) => dexKey(a) - dexKey(b) || coll.compare(a.name, b.name),
  type: (a, b) => typeOrder(a) - typeOrder(b) || coll.compare(a.type || '', b.type || '') || coll.compare(a.name, b.name),
  date: (a, b) => (a.date || '9999').localeCompare(b.date || '9999') || coll.compare(a.name, b.name),
};

let groupFilter = 'IR';
function visibleCards() {
  const s = state.settings, q = $('#search').value.trim().toLowerCase();
  const from = s.dexFrom === '' ? -Infinity : +s.dexFrom, to = s.dexTo === '' ? Infinity : +s.dexTo;
  const dexOn = s.dexFrom !== '' || s.dexTo !== '';
  let list = state.cards
    .filter(c => c.group === groupFilter)
    .filter(c => !s.filterSets.length || s.filterSets.includes(c.set))
    .filter(c => !s.filterTypes.length || cardTypes(c).some(t => s.filterTypes.includes(t)))
    .filter(c => s.filterAvail === 'all' || (s.filterAvail === 'no') === !!c.unavailable)
    .filter(c => !dexOn || (dexKey(c) >= from && dexKey(c) <= to))
    .filter(c => !q || [c.name, c.set, c.num, c.dex, c.type].join(' ').toLowerCase().includes(q));
  if (s.sortBy !== 'custom' && SORT_FN[s.sortBy]) {
    list = list.slice().sort(SORT_FN[s.sortBy]);
    if (s.sortDir === 'desc') list.reverse();
  }
  return list;
}
function filtersActive() {
  const s = state.settings;
  return s.sortBy !== 'custom' || s.filterSets.length || s.filterTypes.length || s.filterAvail !== 'all' || s.dexFrom !== '' || s.dexTo !== '';
}
function renderPool() {
  const s = state.settings;
  const nIR = state.cards.filter(c => c.group === 'IR').length;
  $('#nIR').textContent = nIR;
  $('#nOT').textContent = state.cards.length - nIR;
  const list = visibleCards();
  const custom = s.sortBy === 'custom';
  $('#poolList').innerHTML = list.length ? list.map(c => `
    <li data-id="${esc(c.id)}" class="${c.unavailable ? 'unavail' : ''}">${miniCard(c)}
      <div class="li-main"><div class="li-name">${esc(c.name)}</div>
      <div class="li-sub">${c.unavailable ? '<span class="na-tag">No disponible</span>' : ''}${esc([c.set, c.num && 'Nº ' + c.num, c.dex && c.dex !== '-' && '#' + c.dex, cardTypes(c).join('/')].filter(Boolean).join(' · '))}</div></div>
      ${custom ? '<span class="grip" aria-hidden="true">⋮⋮</span>' : ''}</li>`).join('')
    : '<li class="empty-row">Sin cartas</li>';
  const info = [];
  info.push(custom ? 'Mi orden · mantén pulsada una carta para moverla'
    : 'Por ' + SORTS.find(x => x[0] === s.sortBy)[1].toLowerCase() + (s.sortDir === 'desc' ? ' ↓' : ' ↑'));
  if (s.filterSets.length) info.push(s.filterSets.length === 1 ? s.filterSets[0] : `${s.filterSets.length} expansiones`);
  if (s.filterTypes.length) info.push(s.filterTypes.join(', '));
  if (s.filterAvail !== 'all') info.push(s.filterAvail === 'yes' ? 'disponibles' : 'no disponibles');
  if (s.dexFrom !== '' || s.dexTo !== '') info.push(`Pokédex ${s.dexFrom || '…'}–${s.dexTo || '…'}`);
  const na = state.cards.filter(c => c.group === groupFilter && c.unavailable).length;
  if (na && s.filterAvail === 'all') info.push(`${na} no ${na === 1 ? 'disponible' : 'disponibles'}`);
  if (s.filterSets.length || s.filterTypes.length || s.filterAvail !== 'all' || s.dexFrom !== '' || s.dexTo !== '' || $('#search').value.trim()) info.push(`${list.length} cartas`);
  $('#collInfo').textContent = info.join(' · ');
  $('#sortDot').hidden = !filtersActive();
  $('#setList').innerHTML = [...new Set(state.cards.map(c => c.set).filter(Boolean))].map(x => `<option value="${esc(x)}">`).join('');
}
$('#search').addEventListener('input', renderPool);
$('#groupFilter').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  groupFilter = b.dataset.g;
  $$('#groupFilter button').forEach(x => x.classList.toggle('on', x === b));
  renderPool();
});

/* ----- Ordenar y filtrar ----- */
const dlgSort = $('#dlgSort');
function renderSortDialog() {
  const s = state.settings;
  $('#sortRows').innerHTML = SORTS.map(([k, label]) =>
    `<div class="row opt ${s.sortBy === k ? 'on' : ''}" data-s="${k}"><span>${label}</span><span class="tick"></span></div>`).join('');
  $('#sortDir').classList.toggle('hidden', s.sortBy === 'custom');
  $$('#sortDir button').forEach(b => b.classList.toggle('on', b.dataset.d === s.sortDir));
  const sets = [...new Set(state.cards.filter(c => c.group === groupFilter).map(c => c.set).filter(Boolean))].sort(coll.compare);
  $('#setChips').innerHTML = `<button type="button" data-set="" class="${s.filterSets.length ? '' : 'on'}">Todas</button>` +
    sets.map(x => `<button type="button" data-set="${esc(x)}" class="${s.filterSets.includes(x) ? 'on' : ''}">${esc(x)}</button>`).join('');
  const types = [...new Set(state.cards.filter(c => c.group === groupFilter).flatMap(cardTypes))]
    .sort((a, b) => typeOrder({ type: a }) - typeOrder({ type: b }));
  $('#typeChips').innerHTML = `<button type="button" data-type="" class="${s.filterTypes.length ? '' : 'on'}">Todos</button>` +
    types.map(t => `<button type="button" data-type="${esc(t)}" class="${s.filterTypes.includes(t) ? 'on' : ''}"><i class="tdot" style="background:${state.look.typeColors[t] || '#999'}"></i>${esc(t)}</button>`).join('');
  $$('#availFilter button').forEach(b => b.classList.toggle('on', b.dataset.a === s.filterAvail));
  $('#dexFrom').value = s.dexFrom;
  $('#dexTo').value = s.dexTo;
}
function sortChanged() { save(); renderSortDialog(); renderPool(); }
$('#btnSort').addEventListener('click', () => { renderSortDialog(); dlgSort.showModal(); });
$('#btnSortDone').addEventListener('click', () => dlgSort.close());
$('#btnSortReset').addEventListener('click', () => {
  Object.assign(state.settings, { sortBy: 'custom', sortDir: 'asc', filterSets: [], filterTypes: [], filterAvail: 'all', dexFrom: '', dexTo: '' });
  sortChanged();
});
$('#sortRows').addEventListener('click', e => { const r = e.target.closest('[data-s]'); if (r) { state.settings.sortBy = r.dataset.s; sortChanged(); } });
$('#sortDir').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { state.settings.sortDir = b.dataset.d; sortChanged(); } });
$('#availFilter').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { state.settings.filterAvail = b.dataset.a; sortChanged(); } });
$('#typeChips').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const v = b.dataset.type, f = state.settings.filterTypes;
  state.settings.filterTypes = !v ? [] : f.includes(v) ? f.filter(x => x !== v) : [...f, v];
  sortChanged();
});
$('#setChips').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const v = b.dataset.set, f = state.settings.filterSets;
  state.settings.filterSets = !v ? [] : f.includes(v) ? f.filter(x => x !== v) : [...f, v];
  sortChanged();
});
for (const id of ['dexFrom', 'dexTo']) $('#' + id).addEventListener('input', e => {
  state.settings[id] = e.target.value === '' ? '' : String(Math.max(0, parseInt(e.target.value, 10) || 0));
  save(); renderPool();
});

/* ----- Reordenar manteniendo pulsado ----- */
const poolUl = $('#poolList');
let press = null, drag = null, suppressClick = false;

poolUl.addEventListener('contextmenu', e => e.preventDefault());
poolUl.addEventListener('pointerdown', e => {
  if (e.button !== 0 || drag) return;
  const li = e.target.closest('li[data-id]'); if (!li) return;
  press = { li, x: e.clientX, y: e.clientY, pid: e.pointerId, timer: setTimeout(() => startDrag(), 380) };
});
poolUl.addEventListener('pointermove', e => {
  if (drag) { drag.clientY = e.clientY; updateDrag(); return; }
  if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) cancelPress();
});
function pointerEnd() {
  if (drag) return endDrag();
  cancelPress();
  if (suppressClick) setTimeout(() => { suppressClick = false; }, 350);
}
window.addEventListener('pointerup', pointerEnd);
window.addEventListener('pointercancel', pointerEnd);
// Mientras se arrastra, que la pantalla no haga scroll con el dedo
document.addEventListener('touchmove', e => { if (drag) e.preventDefault(); }, { passive: false });

function cancelPress() { if (press) clearTimeout(press.timer); press = null; }

function startDrag() {
  const p = press; press = null;
  if (!p) return;
  suppressClick = true;
  if (state.settings.sortBy !== 'custom') {
    toast('Para mover cartas, elige «Mi orden» en Ordenar');
    return;
  }
  const items = Array.from(poolUl.querySelectorAll('li[data-id]'));
  const rects = items.map(li => { const r = li.getBoundingClientRect(); return { top: r.top + scrollY, h: r.height }; });
  const idx = items.indexOf(p.li);
  drag = { li: p.li, items, rects, idx, newIdx: idx, startY: p.y + scrollY, clientY: p.y };
  try { p.li.setPointerCapture(p.pid); } catch (e) {}
  poolUl.classList.add('dragging-on');
  p.li.classList.add('dragging');
  if (navigator.vibrate) navigator.vibrate(12);
  updateDrag();
  requestAnimationFrame(autoScroll);
}
function updateDrag() {
  const d = drag; if (!d) return;
  const dy = d.clientY + scrollY - d.startY;
  d.li.style.transform = `translateY(${dy}px) scale(1.03)`;
  const me = d.rects[d.idx], center = me.top + me.h / 2 + dy;
  let n = d.idx;
  for (let i = d.idx + 1; i < d.items.length; i++) if (center > d.rects[i].top + d.rects[i].h / 2) n = i;
  for (let i = d.idx - 1; i >= 0; i--) if (center < d.rects[i].top + d.rects[i].h / 2) n = i;
  d.newIdx = n;
  d.items.forEach((li, i) => {
    if (i === d.idx) return;
    li.style.transform = (i > d.idx && i <= n) ? `translateY(${-me.h}px)` : (i < d.idx && i >= n) ? `translateY(${me.h}px)` : '';
  });
}
function autoScroll() {
  if (!drag) return;
  const y = drag.clientY, top = 90, bottom = innerHeight - 150;
  const v = y < top ? -Math.ceil((top - y) / 6) : y > bottom ? Math.ceil((y - bottom) / 6) : 0;
  if (v) { scrollBy(0, v); updateDrag(); }
  requestAnimationFrame(autoScroll);
}
function endDrag() {
  const d = drag; drag = null;
  poolUl.classList.remove('dragging-on');
  d.items.forEach(li => { li.style.transform = ''; li.classList.remove('dragging'); });
  if (d.newIdx !== d.idx) {
    const movedId = d.li.dataset.id, targetId = d.items[d.newIdx].dataset.id;
    const moved = cardById(movedId);
    state.cards = state.cards.filter(c => c.id !== movedId);
    let at = state.cards.findIndex(c => c.id === targetId);
    if (d.newIdx > d.idx) at += 1;
    state.cards.splice(at, 0, moved);
    save();
    renderPool();
  }
  setTimeout(() => { suppressClick = false; }, 350);
}

/* ----- Añadir / editar ----- */
const dlgCard = $('#dlgCard'), formCard = $('#formCard');
let editingId = null, formGroup = 'IR', formColorMode = 'auto';
const COLOR_MODE_TXT = { auto: 'Sigue lo elegido en Ajustes', group: 'Color del grupo', type: 'Color de su tipo', custom: 'Color propio de esta carta' };
$('#cardType1').innerHTML = '<option value="">—</option>' + TYPES.map(([t]) => `<option>${t}</option>`).join('');
$('#cardType2').innerHTML = '<option value="">Ninguno</option>' + TYPES.map(([t]) => `<option>${t}</option>`).join('');
function formType() { return [$('#cardType1').value, $('#cardType2').value].filter(Boolean).filter((t, i, a) => a.indexOf(t) === i).join(' / '); }
function setFormGroup(g) { formGroup = g; $$('#cardGroup button').forEach(b => b.classList.toggle('on', b.dataset.g === g)); updateColorPreview(); }
function setColorMode(m) {
  formColorMode = m;
  $$('#cardColorMode button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  $('#cardColor').disabled = m !== 'custom';
  updateColorPreview();
}
function updateColorPreview() {
  const tmp = { group: formGroup, type: formType(), color: $('#cardColor').value, colorMode: formColorMode };
  $('#cardColorPreview').style.background = cardPaint(tmp);
  $('#cardColorTxt').textContent = COLOR_MODE_TXT[formColorMode] +
    (formColorMode === 'auto' ? ` (${state.settings.colorBy === 'type' ? 'tipo' : 'grupo'})` : '');
}
function openCard(card) {
  editingId = card ? card.id : null;
  formCard.reset();
  $('#cardDlgTitle').textContent = card ? 'Editar carta' : 'Nueva carta';
  $('#btnDeleteCard').hidden = !card;
  $('#cardAvail').checked = !(card && card.unavailable);
  syncAvailNote();
  if (card) for (const k of ['name', 'num', 'dex', 'set', 'date']) formCard.elements[k].value = card[k] || '';
  else formCard.elements.date.value = isoDate(new Date());
  const ts = card ? cardTypes(card) : [];
  $('#cardType1').value = TYPE_BY_KEY[typeKey(ts[0] || '')] || '';
  $('#cardType2').value = TYPE_BY_KEY[typeKey(ts[1] || '')] || '';
  $('#cardColor').value = card && card.color ? card.color : state.look.groupColors[card ? card.group : groupFilter];
  setColorMode(card ? (card.colorMode || 'auto') : 'auto');
  setFormGroup(card ? card.group : groupFilter);
  dlgCard.showModal();
}
function syncAvailNote() {
  const on = $('#cardAvail').checked;
  $('#availNote').textContent = on ? 'Puede salir al elegir una carta.' : 'Sigue en tu colección, pero no saldrá al elegir ni en los picks programados.';
  $('#availRow').classList.toggle('off', !on);
}
$('#cardAvail').addEventListener('change', syncAvailNote);
$('#btnAdd').addEventListener('click', () => openCard(null));
$('#btnCancelCard').addEventListener('click', () => dlgCard.close());
$('#cardGroup').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setFormGroup(b.dataset.g); });
$('#cardColorMode').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setColorMode(b.dataset.m); });
$('#cardColor').addEventListener('input', updateColorPreview);
$('#cardType1').addEventListener('change', updateColorPreview);
$('#cardType2').addEventListener('change', updateColorPreview);
poolUl.addEventListener('click', e => {
  if (suppressClick) return;
  const li = e.target.closest('li[data-id]'); if (li) openCard(cardById(li.dataset.id));
});
formCard.addEventListener('submit', e => {
  e.preventDefault();
  const f = formCard.elements, name = f.name.value.trim();
  if (!name) { f.name.focus(); return toast('Escribe el nombre y código'); }
  let dex = f.dex.value.trim();
  if (/^\d+$/.test(dex)) dex = dex.padStart(4, '0');
  const data = { name, group: formGroup, num: f.num.value.trim(), set: f.set.value.trim(), dex, date: f.date.value,
    type: formType(), colorMode: formColorMode, color: formColorMode === 'custom' ? $('#cardColor').value : '',
    unavailable: !$('#cardAvail').checked };
  if (editingId) {
    Object.assign(cardById(editingId), data);
    toast('Carta actualizada');
  } else {
    if (state.cards.some(c => c.name.toLowerCase() === name.toLowerCase()) && !confirm('Ya tienes una carta con ese nombre. ¿Añadirla igualmente?')) return;
    state.cards.push(Object.assign({ id: 'u' + Date.now().toString(36) }, data));
    toast('Añadida a la colección');
  }
  if (groupFilter !== formGroup) $(`#groupFilter [data-g="${formGroup}"]`).click();
  save(); renderPool(); dlgCard.close();
});
$('#btnDeleteCard').addEventListener('click', () => {
  const c = cardById(editingId); if (!c) return;
  if (!confirm(`¿Quitar ${c.name} de la colección?`)) return;
  state.cards = state.cards.filter(x => x.id !== c.id);
  if (!c.id.startsWith('u')) state.removed.push(c.id);
  save(); renderPool(); dlgCard.close(); toast('Quitada de la colección');
});

/* =========================================================
   Configuración
   ========================================================= */
function fillSettings() {
  const s = state.settings;
  $('#schedOn').checked = s.schedOn;
  $('#schedFreq').value = s.freq;
  $('#schedEvery').value = s.every;
  $('#schedStart').value = s.start;
  $('#schedMonthDay').value = s.monthDay;
  $('#notifOn').checked = s.notifOn && notifSupported() && Notification.permission === 'granted';
  $('#calWeeks').value = String(s.calWeeks);
  $('#spinSecs').value = s.spinSecs;
  renderBacks();
  $('#spinVal').textContent = fmtSecs(s.spinSecs);
  $$('[data-show]').forEach(cb => cb.checked = !!s.show[cb.dataset.show]);
  $$('#fWeekdays button').forEach(b => b.classList.toggle('on', s.weekdays.includes(+b.dataset.d)));
  renderTimes(); syncSchedUI(); renderNotifNote(); renderNext(); renderLookSettings();
}
function syncSchedUI() {
  const s = state.settings;
  $('#schedFields').classList.toggle('hidden', !s.schedOn);
  $('#fWeekdays').classList.toggle('hidden', s.freq !== 'weekdays');
  $('#fEvery1').classList.toggle('hidden', s.freq !== 'every');
  $('#fEvery2').classList.toggle('hidden', s.freq !== 'every');
  $('#fMonthly').classList.toggle('hidden', s.freq !== 'monthly');
}
function renderTimes() {
  const t = [...state.settings.times].sort();
  $('#timesList').innerHTML = t.length
    ? t.map(x => `<span class="chip">${x}<button type="button" data-t="${x}" aria-label="Quitar ${x}">×</button></span>`).join('')
    : '<span class="none">Sin horas</span>';
}
function renderNotifNote() {
  const n = $('#notifNote');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!notifSupported()) n.textContent = 'En iPhone, añade la app a la pantalla de inicio (Compartir → Añadir a pantalla de inicio) para poder activar las notificaciones.';
  else if (Notification.permission === 'denied') n.textContent = 'Las notificaciones están bloqueadas. Actívalas en Ajustes del iPhone → Notificaciones → Pick up.';
  else n.textContent = standalone
    ? 'Las notificaciones de la app saltan mientras está abierta o en segundo plano reciente.'
    : 'Abre la app desde la pantalla de inicio para recibir notificaciones.';
}
function schedChanged() { save(); renderNext(); }

$('#schedOn').addEventListener('change', e => { state.settings.schedOn = e.target.checked; state.lastHandled = Date.now(); syncSchedUI(); schedChanged(); });
$('#schedFreq').addEventListener('change', e => { state.settings.freq = e.target.value; syncSchedUI(); schedChanged(); });
$('#schedEvery').addEventListener('change', e => { state.settings.every = Math.max(1, +e.target.value || 1); schedChanged(); });
$('#schedStart').addEventListener('change', e => { state.settings.start = e.target.value || isoDate(new Date()); schedChanged(); });
$('#schedMonthDay').addEventListener('change', e => { state.settings.monthDay = Math.min(31, Math.max(1, +e.target.value || 1)); schedChanged(); });
$('#fWeekdays').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const d = +b.dataset.d, w = state.settings.weekdays;
  state.settings.weekdays = w.includes(d) ? w.filter(x => x !== d) : [...w, d];
  b.classList.toggle('on'); schedChanged();
});
$('#btnAddTime').addEventListener('click', () => {
  const v = $('#newTime').value; if (!v) return;
  if (!state.settings.times.includes(v)) state.settings.times.push(v);
  renderTimes(); schedChanged();
});
$('#timesList').addEventListener('click', e => {
  const b = e.target.closest('button[data-t]'); if (!b) return;
  state.settings.times = state.settings.times.filter(t => t !== b.dataset.t);
  renderTimes(); schedChanged();
});
$('#notifOn').addEventListener('change', async e => {
  if (e.target.checked) {
    if (!notifSupported()) { e.target.checked = false; renderNotifNote(); return toast('Añade la app a la pantalla de inicio'); }
    const p = await Notification.requestPermission();
    if (p !== 'granted') { e.target.checked = false; renderNotifNote(); return toast('Permiso de notificaciones no concedido'); }
    state.settings.notifOn = true; toast('Notificaciones activadas');
  } else state.settings.notifOn = false;
  save(); renderNotifNote();
});
function renderBacks() {
  $('#backRows').innerHTML = BACKS.map(([k, label]) =>
    `<button type="button" class="back-opt ${state.settings.backStyle === k ? 'on' : ''}" data-b="${k}">${pcard(null, k)}<span>${label}</span></button>`).join('');
}
$('#backRows').addEventListener('click', e => {
  const b = e.target.closest('[data-b]'); if (!b) return;
  state.settings.backStyle = b.dataset.b;
  save(); renderBacks(); renderSummaries();
  if (!spinning) showIdle();
});
function fmtSecs(v) { return String(v).replace('.', ',') + ' s'; }
$('#spinSecs').addEventListener('input', e => {
  state.settings.spinSecs = +e.target.value;
  $('#spinVal').textContent = fmtSecs(e.target.value);
  renderSummaries();
});
$('#spinSecs').addEventListener('change', save);
$('#calWeeks').addEventListener('change', e => { state.settings.calWeeks = +e.target.value; save(); });
$('#btnCalendar').addEventListener('click', exportCalendar);
$$('[data-show]').forEach(cb => cb.addEventListener('change', () => { state.settings.show[cb.dataset.show] = cb.checked; save(); }));

/* ----- Apariencia ----- */
function renderSummaries() {
  const lk = state.look, st = state.settings;
  const back = (BACKS.find(b => b[0] === st.backStyle) || BACKS[0])[1];
  $('#sumCards').textContent = `${back} · ${fmtSecs(st.spinSecs)}`;
  $('#sumCardColor').textContent = st.colorBy === 'type' ? 'Por tipo' : 'Por grupo';
  const pn = lk.preset === 'auto' ? 'Automático' : lk.preset === 'custom' ? 'Personal' : (PRESETS[lk.preset] || {}).name || '';
  $('#sumTheme').textContent = `${pn} · ${lk.bgStyle === 'gradient' ? 'degradado' : 'liso'}`;
  $('#sumAlpha').textContent = ALPHA_FIELDS.every(([k]) => !lk.transp[k]) ? 'Opaco' : ALPHA_FIELDS.map(([k]) => lk.transp[k] + '%').join(' · ');
  const fname = k => (FONTS[k] || FONTS.system).name.replace(' (sistema)', '');
  $('#sumFonts').textContent = `${fname(lk.fontTitle)} · ${fname(lk.fontBody)}`;
}
function renderLookSettings() {
  const lk = state.look, cur = currentColors();
  renderSummaries();
  const presetKeys = ['auto', ...Object.keys(PRESETS), 'custom'];
  $('#presets').innerHTML = presetKeys.map(k => {
    const p = k === 'auto' ? PRESETS.claro : k === 'custom' ? lk.colors : PRESETS[k];
    const p2 = k === 'auto' ? PRESETS.oscuro : p;
    const label = k === 'auto' ? 'Automático' : k === 'custom' ? 'Personal' : p.name;
    return `<button type="button" class="preset ${lk.preset === k ? 'on' : ''}" data-p="${k}" style="background:${p.panel};color:${p.text}">
      <span class="sw"><i style="background:${p.bg}"></i><i style="background:${p.btn}"></i><i style="background:${p.cardBack}"></i>${k === 'auto' ? `<i style="background:${p2.bg}"></i>` : ''}</span>${label}</button>`;
  }).join('');
  $('#colorRows').innerHTML = COLOR_FIELDS.map(([k, label]) =>
    `<label class="row">${label}<input type="color" class="color-in" data-c="${k}" value="${cur[k]}"></label>`).join('');
  $('#alphaRows').innerHTML = ALPHA_FIELDS.map(([k, label]) =>
    `<label class="row range-row">${label}<span class="val" id="tv-${k}">${lk.transp[k]} %</span>
      <input type="range" min="0" max="90" step="5" data-a="${k}" value="${lk.transp[k]}"></label>`).join('');
  $$('#bgStyle button').forEach(b => b.classList.toggle('on', b.dataset.v === lk.bgStyle));
  $('#colIR').value = lk.groupColors.IR;
  $('#colOT').value = lk.groupColors.OT;
  $$('#colorBy button').forEach(b => b.classList.toggle('on', b.dataset.v === state.settings.colorBy));
  $('#typeColorRows').innerHTML = TYPES.map(([t]) =>
    `<label class="row">${t}<input type="color" class="color-in" data-tc="${t}" value="${lk.typeColors[t]}"></label>`).join('');
  $('#groupColorGroup').classList.toggle('dim', state.settings.colorBy !== 'group');
  $('#typeColorRows').classList.toggle('dim', state.settings.colorBy !== 'type');
  const fontRows = (key) => Object.entries(FONTS).map(([k, f]) => `
    <div class="row font-opt ${lk[key] === k ? 'on' : ''}" data-font="${k}" data-key="${key}">
      <span class="sample" style="font-family:${f.css.replace(/"/g, '&quot;')}">${key === 'fontTitle' ? 'Pick Your Card' : 'Starly · Illustration Rare'}<small>${f.name}</small></span>
      <span class="tick"></span></div>`).join('');
  $('#fontTitleRows').innerHTML = fontRows('fontTitle');
  $('#fontBodyRows').innerHTML = fontRows('fontBody');
}
function lookChanged() { save(); applyLook(); }
$('#presets').addEventListener('click', e => {
  const b = e.target.closest('[data-p]'); if (!b) return;
  state.look.preset = b.dataset.p;
  lookChanged(); renderLookSettings();
});
$('#colorRows').addEventListener('input', e => {
  const k = e.target.dataset.c; if (!k) return;
  if (state.look.preset !== 'custom') { state.look.colors = Object.assign({}, currentColors()); state.look.preset = 'custom'; }
  state.look.colors[k] = e.target.value;
  applyLook();
  $$('#presets .preset').forEach(p => p.classList.toggle('on', p.dataset.p === 'custom'));
});
$('#colorRows').addEventListener('change', () => { save(); renderLookSettings(); });
for (const g of ['IR', 'OT']) {
  const el = $('#col' + g);
  el.addEventListener('input', () => { state.look.groupColors[g] = el.value; applyLook(); });
  el.addEventListener('change', () => { save(); renderPool(); });
}
$('#colorBy').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  state.settings.colorBy = b.dataset.v;
  save(); renderLookSettings(); renderPool();
  if (!spinning) showIdle();
});
$('#typeColorRows').addEventListener('input', e => { const t = e.target.dataset.tc; if (t) state.look.typeColors[t] = e.target.value; });
$('#typeColorRows').addEventListener('change', () => { save(); renderPool(); });
$('#alphaRows').addEventListener('input', e => {
  const k = e.target.dataset.a; if (!k) return;
  state.look.transp[k] = +e.target.value;
  $('#tv-' + k).textContent = e.target.value + ' %';
  applyLook(); renderSummaries();
});
$('#alphaRows').addEventListener('change', save);
$('#bgStyle').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  state.look.bgStyle = b.dataset.v;
  $$('#bgStyle button').forEach(x => x.classList.toggle('on', x === b));
  lookChanged(); renderSummaries();
});
document.addEventListener('click', e => {
  const r = e.target.closest('.font-opt'); if (!r) return;
  state.look[r.dataset.key] = r.dataset.font;
  lookChanged(); renderLookSettings();
});
$('#btnResetLook').addEventListener('click', () => {
  if (!confirm('¿Volver a la apariencia original?')) return;
  state.look = JSON.parse(JSON.stringify(DEFAULT_LOOK));
  lookChanged(); renderLookSettings();
});

/* ----- Copia de seguridad ----- */
$('#btnExport').addEventListener('click', async () => {
  const file = new File([JSON.stringify(state, null, 1)], `pick-up-${isoDate(new Date())}.json`, { type: 'application/json' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) return await navigator.share({ files: [file] }); }
  catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click();
});
$('#btnImport').addEventListener('click', () => $('#fileImport').click());
$('#fileImport').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const s = JSON.parse(await f.text());
    if (!Array.isArray(s.cards)) throw new Error();
    localStorage.setItem(KEY, JSON.stringify(s));
    state = load(); save(); applyLook(); fillSettings(); renderPool();
    toast('Copia importada');
  } catch (err) { toast('Archivo no válido'); }
  e.target.value = '';
});

/* =========================================================
   Toast y arranque
   ========================================================= */
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400);
}

const APP_VERSION = '11 · ajustes plegables';
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => reg.update()).catch(() => {});
  // Cuando llega una versión nueva, recarga una vez para mostrarla
  let reloaded = false;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
}
$('#appVersion').textContent = 'Versión ' + APP_VERSION;
applyLook();
showIdle();
save();
renderPool();
checkSchedule();
setInterval(checkSchedule, 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkSchedule(); });
