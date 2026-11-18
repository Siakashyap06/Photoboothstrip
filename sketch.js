// Vintage Photobooth — 4 poses, one strip.
// Press the red button (or S) to start · R = reset · P = save strip

const FRAMES = 4;
const CAM_W = 480, CAM_H = 360;
const POSES = ['SMILE!', 'NEW YORK SERIOUS', 'TOURIST MODE', 'BODEGA CAT ENERGY'];

let capture, camReady = false;
let shots = [];
let stripG;
let running = false;
let film = 'bw';

const $ = (id) => document.getElementById(id);

// ---------------- p5 ----------------
function setup() {
  const c = createCanvas(CAM_W, CAM_H);
  c.parent('cam');
  pixelDensity(1);
  capture = createCapture(VIDEO);
  capture.size(CAM_W, CAM_H);
  capture.hide();
  stripG = createGraphics(400, 40 + FRAMES * (CAM_H * 360 / CAM_W + 14) + 70);
  stripG.pixelDensity(1);
  applyFilmLook();
}

function draw() {
  background(10);
  if (capture && capture.loadedmetadata) {
    push(); translate(width, 0); scale(-1, 1);
    image(capture, 0, 0, width, height);
    pop();
    // soft live vignette + flicker so the preview feels like an old booth
    noStroke();
    if (random() < 0.04) { fill(255, 10); rect(0, 0, width, height); }
  } else {
    fill(220); textAlign(CENTER, CENTER); textFont('Special Elite'); textSize(18);
    text('Allow camera access\nto use the booth', width / 2, height / 2);
  }
}

function keyPressed() {
  if (key === 's' || key === 'S') start();
  else if (key === 'r' || key === 'R') reset();
  else if (key === 'p' || key === 'P') saveStrip();
}

// ---------------- flow ----------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function start() {
  if (running || !(capture && capture.loadedmetadata)) return;
  running = true;
  reset(true);
  const coin = $('go');
  coin.classList.add('pressed'); coin.disabled = true;
  sfx.coin();
  await sleep(400);
  coin.classList.remove('pressed');
  $('booth').classList.add('shooting');

  for (let i = 0; i < FRAMES; i++) {
    $('pose').textContent = `POSE ${i + 1} OF ${FRAMES} · ${POSES[i]}`;
    for (let n = 3; n >= 1; n--) {
      const el = $('count');
      el.textContent = n; el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick');
      sfx.beep(n === 1 ? 880 : 660);
      await sleep(1000);
    }
    takeShot();
    const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
    sfx.shutter();
    $('frames').children[i].classList.add('on');
    await sleep(i < FRAMES - 1 ? 900 : 600);
  }

  $('pose').textContent = 'DEVELOPING… CHECK THE SLOT →';
  $('booth').classList.remove('shooting');
  composeStrip();
  sfx.whir();
  await sleep(900);
  deliver();
  setTimeout(() => { $('pose').textContent = 'LOOK HERE ↑'; }, 5000);
  coin.disabled = false;
  running = false;
}

function reset(keepRunning) {
  shots = [];
  stripG.clear();
  [...$('frames').children].forEach((f) => f.classList.remove('on'));
  $('tray').classList.remove('open');
  $('booth').classList.remove('delivered');
  $('after').classList.remove('ready');
  $('stripImg').removeAttribute('src');
  if (!keepRunning) { running = false; $('go').disabled = false; $('pose').textContent = 'LOOK HERE ↑'; }
}

function deliver() {
  const img = $('stripImg');
  img.src = stripG.elt.toDataURL('image/png');
  img.classList.remove('developing'); void img.offsetWidth; img.classList.add('developing');
  const t = $('tray'); t.classList.remove('open'); void t.offsetWidth; t.classList.add('open');
  $('booth').classList.add('delivered');
  setTimeout(() => $('after').classList.add('ready'), 5600);
}

function saveStrip() {
  if (shots.length === FRAMES) save(stripG, `photobooth_strip_${film}.png`);
}

// ---------------- capture & processing ----------------
function takeShot() {
  let raw = createImage(CAM_W, CAM_H);
  raw.copy(capture, 0, 0, capture.width, capture.height, 0, 0, CAM_W, CAM_H);
  raw = mirrorImage(raw);
  let img = toGray(raw);
  img = contrastCurve(img, 1.15, 0.95);
  img = addGrain(img, 14);
  img = vignette(img, 0.38);
  if (film === 'sepia') img = sepia(img);
  shots.push(img);
}

function composeStrip() {
  const g = stripG, pad = 20, gap = 14;
  const w = g.width - pad * 2, h = w * CAM_H / CAM_W;
  const paper = film === 'sepia' ? color(246, 236, 214) : color(250, 248, 243);
  g.push(); g.clear();
  g.noStroke(); g.fill(paper); g.rect(0, 0, g.width, g.height);
  for (let i = 0; i < shots.length; i++) {
    const y = pad + i * (h + gap);
    g.image(shots[i], pad, y, w, h);
    g.noFill(); g.stroke(0, 50); g.strokeWeight(1); g.rect(pad, y, w, h);
  }
  // footer stamp
  const y0 = pad + FRAMES * (h + gap) + 8;
  g.noStroke(); g.fill(film === 'sepia' ? color(110, 70, 40) : color(40));
  g.textAlign(CENTER, TOP);
  g.textFont('Archivo Black'); g.textSize(24); g.text('PHOTOBOOTH', g.width / 2, y0);
  g.textFont('Special Elite'); g.textSize(13);
  const d = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  g.text(`NEW YORK, NY  ·  ${d}`, g.width / 2, y0 + 32);
  g.pop();
}

// ---------------- film toggle ----------------
document.querySelectorAll('[data-film]').forEach((b) => b.addEventListener('click', () => {
  film = b.dataset.film;
  document.querySelectorAll('[data-film]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
  applyFilmLook();
}));
function applyFilmLook() {
  const c = document.querySelector('#cam canvas');
  if (c) c.style.filter = film === 'sepia' ? 'grayscale(1) sepia(.75) contrast(1.1)' : 'grayscale(1) contrast(1.15)';
}

$('go').addEventListener('click', start);
$('save').addEventListener('click', saveStrip);
$('again').addEventListener('click', () => { reset(); start(); });

// ---------------- sound (tiny WebAudio synth) ----------------
const sfx = (() => {
  let ctx;
  const ac = () => (ctx = ctx || new (window.AudioContext || window.webkitAudioContext)());
  function tone(freq, dur, type = 'square', vol = 0.06, delay = 0) {
    const a = ac(), o = a.createOscillator(), g = a.createGain(), t = a.currentTime + delay;
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur);
  }
  function noise(dur, vol = 0.25, delay = 0) {
    const a = ac(), n = a.createBufferSource(), b = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const g = a.createGain(); g.gain.value = vol; n.buffer = b; n.connect(g).connect(a.destination); n.start(a.currentTime + delay);
  }
  return {
    coin: () => { tone(1320, 0.12, 'triangle', 0.08); tone(1760, 0.25, 'triangle', 0.06, 0.08); },
    beep: (f) => tone(f, 0.12, 'square', 0.04),
    shutter: () => { noise(0.05, 0.35); noise(0.06, 0.25, 0.09); },
    whir: () => { for (let i = 0; i < 8; i++) tone(120 + i * 6, 0.12, 'sawtooth', 0.02, i * 0.1); },
  };
})();

// ---------------- image helpers ----------------
function mirrorImage(src) {
  const w = src.width, h = src.height, out = createImage(w, h);
  src.loadPixels(); out.loadPixels();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = 4 * (y * w + x), j = 4 * (y * w + (w - 1 - x));
    out.pixels[j] = src.pixels[i]; out.pixels[j + 1] = src.pixels[i + 1]; out.pixels[j + 2] = src.pixels[i + 2]; out.pixels[j + 3] = 255;
  }
  out.updatePixels(); return out;
}
function toGray(src) {
  const out = createImage(src.width, src.height); src.loadPixels(); out.loadPixels();
  for (let i = 0; i < src.pixels.length; i += 4) {
    const v = floor(0.299 * src.pixels[i] + 0.587 * src.pixels[i + 1] + 0.114 * src.pixels[i + 2]);
    out.pixels[i] = out.pixels[i + 1] = out.pixels[i + 2] = v; out.pixels[i + 3] = 255;
  }
  out.updatePixels(); return out;
}
function contrastCurve(img, contrast = 1.1, gamma = 1.0) {
  const out = createImage(img.width, img.height); img.loadPixels(); out.loadPixels();
  for (let i = 0; i < img.pixels.length; i += 4) {
    let v = constrain(0.5 + (img.pixels[i] / 255 - 0.5) * contrast, 0, 1);
    const p = floor(pow(v, gamma) * 255);
    out.pixels[i] = out.pixels[i + 1] = out.pixels[i + 2] = p; out.pixels[i + 3] = 255;
  }
  out.updatePixels(); return out;
}
function addGrain(img, amount = 10) {
  const out = createImage(img.width, img.height); img.loadPixels(); out.loadPixels();
  for (let i = 0; i < img.pixels.length; i += 4) {
    const p = floor(constrain(img.pixels[i] + (random() * 2 - 1) * amount, 0, 255));
    out.pixels[i] = out.pixels[i + 1] = out.pixels[i + 2] = p; out.pixels[i + 3] = 255;
  }
  out.updatePixels(); return out;
}
function vignette(img, strength = 0.3) {
  const w = img.width, h = img.height, cx = w / 2, cy = h / 2, maxR = sqrt(cx * cx + cy * cy);
  const out = createImage(w, h); img.loadPixels(); out.loadPixels();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = 4 * (y * w + x), r = sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxR;
    const p = floor(constrain(img.pixels[i] * (1 - strength * r * r), 0, 255));
    out.pixels[i] = out.pixels[i + 1] = out.pixels[i + 2] = p; out.pixels[i + 3] = 255;
  }
  out.updatePixels(); return out;
}
function sepia(img) {
  const out = createImage(img.width, img.height); img.loadPixels(); out.loadPixels();
  for (let i = 0; i < img.pixels.length; i += 4) {
    const v = img.pixels[i];
    out.pixels[i] = constrain(v * 1.07 + 20, 0, 255);
    out.pixels[i + 1] = constrain(v * 0.95 + 8, 0, 255);
    out.pixels[i + 2] = constrain(v * 0.78, 0, 255);
    out.pixels[i + 3] = 255;
  }
  out.updatePixels(); return out;
}
