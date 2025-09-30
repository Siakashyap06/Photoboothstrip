// Photobooth Strip — classic GREYSCALE look (no edge/X-ray)
// Keys: S=start, R=reset, P=save

let capture;
const FRAMES = 4;
const INTERVAL_MS = 3000;

let started = false;
let shotCount = 0;
let nextShotAt = 0;
let shots = [];        // processed frames (greyscale)
let stripG;            // full-res strip (for saving)

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont('monospace');

  capture = createCapture(VIDEO);
  capture.size(360, 270);
  capture.hide();

  stripG = createGraphics(360 + 40, 4 * (270 + 16) + 40);
  stripG.pixelDensity(1);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  background(18);

  // layout: left preview, right strip (scaled to fit)
  const leftW = min(440, width * 0.45);
  const leftX = 16, leftY = 16, leftH = height - 80;

  drawPreviewPanel(leftX, leftY, leftW, leftH);
  drawStripScaled(leftX + leftW + 16, 16, width - (leftX + leftW + 32), height - 32);

  if (started && shotCount < FRAMES) {
    const remaining = max(0, nextShotAt - millis());
    drawCountdownOverPreview(remaining);
    if (remaining <= 0) {
      takeShot();
      shotCount++;
      if (shotCount < FRAMES) nextShotAt = millis() + INTERVAL_MS;
      else composeStrip();
    }
  }

  // UI
  fill(200);
  noStroke();
  textSize(14);
  textAlign(LEFT, BOTTOM);
  text(`Controls: S = Start • R = Reset • P = Save`, 20, height - 20);
}

function drawPreviewPanel(x, y, pw, ph) {
  push();
  translate(x, y);
  noStroke(); fill(30); rect(0, 0, pw, ph, 14);

  // fit camera preview into panel with margins
  const m = 20;
  const scaleFactor = min((pw - 2*m) / capture.width, (ph * 0.75 - 2*m) / capture.height);
  const w = capture.width * scaleFactor;
  const h = capture.height * scaleFactor;
  const px = m, py = m;

  // mirrored preview
  push();
  translate(px + w, py);
  scale(-scaleFactor, scaleFactor);
  image(capture, 0, 0);
  pop();

  noFill(); stroke(255, 40); rect(px, py, w, h, 8);

  fill(220); noStroke(); textSize(16); textAlign(LEFT, TOP);
  const status = !started ? "Ready to shoot"
    : shotCount < FRAMES ? `Capturing… (${shotCount}/${FRAMES})` : "Done!";
  text(status, px, py + h + 12);
  pop();
}

function drawStripScaled(x, y, aw, ah) {
  push();
  translate(x, y);

  const stripW = stripG.width, stripH = stripG.height;
  const s = min(aw / stripW, ah / stripH, 1.0);
  const dx = max(0, (aw - stripW * s) / 2);
  const dy = max(0, (ah - stripH * s) / 2);

  // shadow
  noStroke(); fill(0, 120);
  rect(dx + 18 * s, dy + 18 * s, stripW * s, stripH * s, 20 * s);

  // paper
  fill(245); rect(dx, dy, stripW * s, stripH * s, 20 * s);

  if (shotCount === FRAMES) {
    push(); translate(dx, dy); scale(s); image(stripG, 0, 0); pop();
  } else {
    // partial live preview
    const pad = 20, gap = 16, w = capture.width, h = capture.height;
    push(); translate(dx, dy); scale(s);
    fill(250); noStroke(); rect(0, 0, stripW, stripH, 20);
    for (let i = 0; i < shots.length; i++) {
      image(shots[i], pad, pad + i * (h + gap));
      noFill(); stroke(0, 40); strokeWeight(1.5);
      rect(pad, pad + i * (h + gap), w, h, 6);
    }
    pop();
  }
  pop();
}

function drawCountdownOverPreview(msLeft) {
  // recompute the preview rectangle to overlay countdown neatly
  const leftX = 16, leftY = 16;
  const pw = min(440, width * 0.45);
  const ph = height - 80;
  const m = 20;
  const scaleFactor = min((pw - 2*m) / capture.width, (ph * 0.75 - 2*m) / capture.height);
  const w = capture.width * scaleFactor;
  const h = capture.height * scaleFactor;
  const px = leftX + m, py = leftY + m;

  const sLeft = constrain(ceil(msLeft / 1000), 0, 3);

  push();
  fill(0, 120); noStroke(); rect(px, py, w, h, 8);
  const t = (msLeft % 1000) / 1000;
  const ring = map(t, 0, 1, 20, 60);
  noFill(); stroke(255); strokeWeight(4);
  circle(px + w / 2, py + h / 2, 160 + ring);
  noStroke(); fill(255); textAlign(CENTER, CENTER); textSize(64);
  text(sLeft === 0 ? "★" : sLeft, px + w / 2, py + h / 2);
  pop();
}

function keyPressed() {
  if (key === 'S' || key === 's') {
    resetBooth();
    started = true;
    nextShotAt = millis() + INTERVAL_MS;
  } else if (key === 'R' || key === 'r') {
    resetBooth();
  } else if (key === 'P' || key === 'p') {
    if (shotCount === FRAMES) {
      composeStrip();
      save(stripG, 'photobooth_strip.png');
    }
  }
}

function resetBooth() {
  started = false;
  shotCount = 0;
  nextShotAt = 0;
  shots = [];
  stripG.clear();
  background(18);
}

// --------- Capture & processing (GREYSCALE FILM LOOK) ----------

function takeShot() {
  // copy & mirror current frame
  let raw = createImage(capture.width, capture.height);
  raw.copy(capture, 0, 0, capture.width, capture.height, 0, 0, capture.width, capture.height);
  raw = mirrorImage(raw);

  // Process for a classic photo look
  let gray = toGray(raw);                      // true greyscale
  gray = contrastCurve(gray, 1.10, 0.95);      // slight S-curve (contrast + gentle gamma)
  gray = addGrain(gray, 12);                   // subtle film grain (0..~20 sensible)
  gray = vignette(gray, 0.35);                 // soft darkening at edges (0..1)

  shots.push(gray);
}

function composeStrip() {
  const pad = 20, gap = 16, w = capture.width, h = capture.height;

  stripG.push();
  stripG.clear();

  // paper
  stripG.noStroke(); stripG.fill(250);
  stripG.rect(0, 0, stripG.width, stripG.height, 20);

  // header
  stripG.fill(0, 70); stripG.textAlign(CENTER, TOP); stripG.textSize(14);
  stripG.text(`PHOTO STRIP — Greyscale`, stripG.width / 2, 8);

  // frames
  for (let i = 0; i < shots.length; i++) {
    stripG.image(shots[i], pad, pad + i * (h + gap));
    stripG.noFill(); stripG.stroke(0, 40); stripG.strokeWeight(1.5);
    stripG.rect(pad, pad + i * (h + gap), w, h, 6);
  }

  stripG.pop();
}

// --------- Image helpers ----------

function mirrorImage(src) {
  const w = src.width, h = src.height;
  let out = createImage(w, h);
  src.loadPixels(); out.loadPixels();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = 4 * (y * w + x);
      const j = 4 * (y * w + (w - 1 - x));
      out.pixels[j+0] = src.pixels[i+0];
      out.pixels[j+1] = src.pixels[i+1];
      out.pixels[j+2] = src.pixels[i+2];
      out.pixels[j+3] = src.pixels[i+3];
    }
  }
  out.updatePixels();
  return out;
}

function toGray(src) {
  let out = createImage(src.width, src.height);
  src.loadPixels(); out.loadPixels();
  for (let i = 0; i < src.pixels.length; i += 4) {
    const r = src.pixels[i], g = src.pixels[i+1], b = src.pixels[i+2];
    const v = floor(0.299*r + 0.587*g + 0.114*b); // luma
    out.pixels[i] = out.pixels[i+1] = out.pixels[i+2] = v;
    out.pixels[i+3] = 255;
  }
  out.updatePixels();
  return out;
}

// Slight S-curve with a bit more pop in mids; contrast>1 increases slope; gamma < 1 brightens
function contrastCurve(grayImg, contrast = 1.1, gamma = 1.0) {
  let out = createImage(grayImg.width, grayImg.height);
  grayImg.loadPixels(); out.loadPixels();
  for (let i = 0; i < grayImg.pixels.length; i += 4) {
    let v = grayImg.pixels[i] / 255.0;     // 0..1
    // center to 0..1 around 0.5, apply contrast, re-center
    v = 0.5 + (v - 0.5) * contrast;
    v = constrain(v, 0, 1);
    // gamma
    v = pow(v, gamma);
    const p = floor(v * 255);
    out.pixels[i] = out.pixels[i+1] = out.pixels[i+2] = p;
    out.pixels[i+3] = 255;
  }
  out.updatePixels();
  return out;
}

function addGrain(grayImg, amount = 10) {
  let out = createImage(grayImg.width, grayImg.height);
  grayImg.loadPixels(); out.loadPixels();
  for (let i = 0; i < grayImg.pixels.length; i += 4) {
    const v = grayImg.pixels[i];
    // uniform noise in [-amount, +amount]
    const n = (random() * 2 - 1) * amount;
    const p = floor(constrain(v + n, 0, 255));
    out.pixels[i] = out.pixels[i+1] = out.pixels[i+2] = p;
    out.pixels[i+3] = 255;
  }
  out.updatePixels();
  return out;
}

// Radial darkening at edges for a soft vignette; strength 0..1
function vignette(grayImg, strength = 0.3) {
  const w = grayImg.width, h = grayImg.height;
  const cx = w * 0.5, cy = h * 0.5;
  const maxR = sqrt(cx*cx + cy*cy);
  let out = createImage(w, h);
  grayImg.loadPixels(); out.loadPixels();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = 4 * (y * w + x);
      const v = grayImg.pixels[i];
      const dx = x - cx, dy = y - cy;
      const r = sqrt(dx*dx + dy*dy) / maxR;      // 0 center .. 1 corners
      const falloff = 1.0 - strength * r*r;      // quadratic falloff
      const p = floor(constrain(v * falloff, 0, 255));
      out.pixels[i] = out.pixels[i+1] = out.pixels[i+2] = p;
      out.pixels[i+3] = 255;
    }
  }
  out.updatePixels();
  return out;
}

