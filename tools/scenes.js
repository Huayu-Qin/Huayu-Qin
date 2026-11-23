// Scene definitions for tools/render.js. Units are arbitrary; Y is up, the floor is y = 0.

const rotX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
const rotY = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
const rotZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
const mul = (a, b) => {
  const o = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]);
  return o;
};
const deg = (d) => d * Math.PI / 180;
const local = (p, x, y, z) => {
  const m = p.m, px = x - p.c[0], py = y - p.c[1], pz = z - p.c[2];
  return [m[0] * px + m[3] * py + m[6] * pz, m[1] * px + m[4] * py + m[7] * pz, m[2] * px + m[5] * py + m[8] * pz];
};

// Letters are drawn as round tubes lying on the floor. Coordinates: x right, y up the page, cap height 1.
const GLYPHS = {
  H: { w: 0.7, s: [[0, 0, 0, 1], [0.7, 0, 0.7, 1], [0, 0.5, 0.7, 0.5]] },
  U: { w: 0.7, s: [[0, 1, 0, 0.35], [0.7, 1, 0.7, 0.35]], arcs: [[0.35, 0.35, 0.35, true]] },
  A: { w: 0.8, s: [[0, 0, 0.4, 1], [0.8, 0, 0.4, 1], [0.17, 0.36, 0.63, 0.36]] },
  Y: { w: 0.8, s: [[0, 1, 0.4, 0.48], [0.8, 1, 0.4, 0.48], [0.4, 0.48, 0.4, 0]] },
  Q: { w: 1.0, s: [[0.6, 0.34, 0.98, -0.04]], arcs: [[0.5, 0.5, 0.5, false]] },
  I: { w: 0, s: [[0, 0, 0, 1]] },
  N: { w: 0.7, s: [[0, 0, 0, 1], [0, 1, 0.7, 0], [0.7, 0, 0.7, 1]] },
};

function word(text, x0, zBase, s, rt, mat, gap = 0.5) {
  const groups = [];
  let gx = 0;
  for (const ch of text) {
    const g = GLYPHS[ch];
    const prims = [];
    const X = (v) => x0 + (gx + v) * s, Z = (v) => zBase - v * s;
    for (const [a, b, c, d] of g.s) prims.push({ t: 'capsule', a: [X(a), rt, Z(b)], b: [X(c), rt, Z(d)], r: rt, mat });
    for (const [cx, cy, R, half] of g.arcs || []) prims.push({ t: 'arc', c: [X(cx), rt, Z(cy)], R: R * s, r: rt, half, mat });
    groups.push({ c: [X(g.w / 2), rt, Z(0.5)], r: 0.85 * s + rt, prims });
    gx += g.w + gap;
  }
  return groups;
}

const MATS = {
  light: {
    slab: { col: [0.93, 0.91, 0.87], spec: 0.12, gloss: 24, rim: 0.10 },
    base: { col: [0.80, 0.77, 0.72], spec: 0.10, gloss: 20, rim: 0.10 },
    ink: { col: [0.12, 0.125, 0.16], spec: 0.9, gloss: 90, rim: 0.22 },
    coral: { col: [1.0, 0.30, 0.16], spec: 0.8, gloss: 90, rim: 0.4 },
    cobalt: { col: [0.13, 0.30, 0.98], spec: 0.8, gloss: 90, rim: 0.4 },
    butter: { col: [1.0, 0.74, 0.16], spec: 0.7, gloss: 80, rim: 0.35 },
    cream: { col: [0.96, 0.94, 0.89], spec: 0.5, gloss: 60, rim: 0.2 },
    body: { col: [0.09, 0.09, 0.12], spec: 0.9, gloss: 120, rim: 0.6 },
    screen: { col: [0.97, 0.96, 0.93], spec: 0.3, gloss: 120, rim: 0.2 },
  },
  dark: {
    slab: { col: [0.17, 0.18, 0.27], spec: 0.25, gloss: 30, rim: 0.3 },
    base: { col: [0.12, 0.125, 0.2], spec: 0.2, gloss: 20, rim: 0.3 },
    ink: { col: [0.96, 0.94, 0.89], spec: 0.7, gloss: 90, rim: 0.3 },
    coral: { col: [1.0, 0.30, 0.16], spec: 0.8, gloss: 90, rim: 0.4 },
    cobalt: { col: [0.16, 0.34, 1.0], spec: 0.8, gloss: 90, rim: 0.5 },
    butter: { col: [1.0, 0.74, 0.16], spec: 0.7, gloss: 80, rim: 0.35 },
    cream: { col: [0.96, 0.94, 0.89], spec: 0.5, gloss: 60, rim: 0.2 },
    body: { col: [0.03, 0.03, 0.045], spec: 0.9, gloss: 120, rim: 0.9 },
    screen: { col: [0.93, 0.92, 0.90], spec: 0.3, gloss: 120, rim: 0.2 },
  },
};

const ENV = {
  light: { light: { dir: [-0.55, 1.0, 0.42], col: [1.02, 0.99, 0.93], k: 9 }, sky: [0.30, 0.33, 0.42], ground: [0.20, 0.17, 0.15], exposure: 1, aoScale: 1, aoGain: 1.6 },
  dark: { light: { dir: [-0.55, 1.0, 0.42], col: [1.02, 0.99, 0.95], k: 9 }, sky: [0.22, 0.26, 0.40], ground: [0.08, 0.07, 0.11], exposure: 1, aoScale: 1, aoGain: 1.6 },
};

// A phone: dark body, light screen with three message cards.
function phone(c, m, hw, hh, cards) {
  return {
    t: 'plate', c, m, h: [hw, hh, 0.075], R: hw * 0.36, e: 0.05, mat: 'body',
    matFn: (x, y, z, p) => {
      const [lx, ly, lz] = local(p, x, y, z);
      if (lz < p.h[2] - 0.012) return 'body';
      const bz = hw * 0.11;
      const dx = Math.abs(lx) - (hw - bz - hw * 0.27), dy = Math.abs(ly) - (hh - bz - hw * 0.27);
      if (Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) > hw * 0.27) return 'body';
      for (const [cx, cy, w, h, mat] of cards) {
        const ex = Math.abs(lx - cx * hw) - (w * hw - h * hw), ey = Math.abs(ly - cy * hh) ;
        if (Math.hypot(Math.max(ex, 0), ey) < h * hw) return mat;
      }
      return 'screen';
    },
  };
}
const CARDS = [[-0.18, 0.5, 0.52, 0.17, 'cobalt'], [0.18, 0.08, 0.52, 0.17, 'coral'], [-0.3, -0.34, 0.4, 0.17, 'butter']];

function hero(theme) {
  const groups = [];
  groups.push({ c: [0, -0.3, 0], r: 9, prims: [
    { t: 'slab', c: [0, -0.16, 0.1], h: [5.75, 0.16, 2.5], R: 0.9, e: 0.07, mat: 'slab' },
    { t: 'slab', c: [0.35, -0.62, 0.4], h: [5.75, 0.12, 2.5], R: 0.9, e: 0.07, mat: 'base' },
  ] });
  groups.push(...word('HUAYU', -4.7, -0.3, 1.3, 0.21, 'ink'));
  groups.push(...word('QIN', -4.7, 1.82, 1.3, 0.21, 'coral'));
  // Planet with a ring: the exploring part.
  const pc = [4.25, 1.55, -1.25];
  groups.push({ c: pc, r: 1.5, prims: [
    { t: 'sphere', c: pc, r: 0.76, mat: 'cobalt' },
    { t: 'torus', c: pc, m: mul(rotZ(deg(-18)), rotX(deg(24))), R: 1.2, r: 0.06, sy: 0.4, mat: 'cream' },
  ] });
  // Phone standing on the slab: the building part.
  const pm = mul(rotY(deg(-20)), rotX(deg(-15)));
  groups.push({ c: [3.85, 1.0, 1.5], r: 1.4, prims: [phone([3.85, 1.0, 1.5], pm, 0.56, 1.04, CARDS)] });
  // A hop of small spheres from the name to the phone.
  const dots = [];
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    dots.push({ t: 'sphere', c: [-0.45 + 3.2 * t, 0.17 + 1.15 * 4 * t * (1 - t), 1.25 + 0.25 * t], r: 0.17 - 0.008 * i, mat: 'butter' });
  }
  groups.push({ c: [1.3, 0.6, 1.3], r: 2.4, prims: dots });
  return {
    width: 1600, aspect: 1.88, groups, mats: MATS[theme], ...ENV[theme],
    cam: { target: [0.3, 0.12, 0.2], pitch: deg(47), yaw: deg(-8), dist: 15.7, fov: deg(26) },
    catcher: { y: -1.5, k: 2.5, dir: [-0.12, 1, -0.3], a: theme === 'light' ? 0.2 : 0.5 },
  };
}

// Small scenes used as icons. They stand on nothing: only a soft shadow is kept under them.
function icon(theme, groups, cam = {}) {
  const env = ENV[theme];
  return {
    width: 360, aspect: 1, groups, mats: MATS[theme], ...env,
    cam: { target: [0, 0.75, 0], pitch: deg(28), yaw: deg(-26), dist: 9.2, fov: deg(26), ...cam },
    catcher: { y: 0, k: 5, a: theme === 'light' ? 0.22 : 0.5 },
  };
}

function iconTranslate(theme) {
  const pm = mul(rotY(deg(-14)), rotX(deg(-12)));
  return icon(theme, [
    { c: [0, 1.1, 0], r: 1.6, prims: [phone([0, 1.17, 0], pm, 0.66, 1.2, CARDS)] },
    { c: [0, 1.2, 0.6], r: 2.2, prims: [
      { t: 'capsule', a: [-1.5, 1.75, 0.5], b: [-1.05, 1.75, 0.5], r: 0.24, mat: 'cobalt' },
      { t: 'capsule', a: [1.0, 0.75, 0.75], b: [1.5, 0.75, 0.75], r: 0.24, mat: 'coral' },
    ] },
  ], { target: [0, 1.1, 0] });
}

function iconSwitch(theme) {
  return icon(theme, [
    { c: [0, 0.9, 0], r: 2.4, prims: [
      { t: 'capsule', a: [-0.7, 1.55, -0.5], b: [0.7, 1.55, -0.5], r: 0.4, mat: 'ink' },
      { t: 'sphere', c: [-0.72, 1.55, -0.38], r: 0.5, mat: 'cobalt' },
      { t: 'capsule', a: [-0.7, 0.46, 0.45], b: [0.7, 0.46, 0.45], r: 0.4, mat: 'ink' },
      { t: 'sphere', c: [0.72, 0.5, 0.57], r: 0.5, mat: 'coral' },
    ] },
  ], { target: [0, 0.95, 0], yaw: deg(-20) });
}

function iconBook(theme) {
  const m = rotY(deg(22));
  return icon(theme, [
    { c: [0, 0.4, 0], r: 2.2, prims: [
      { t: 'plate', c: [0, 0.06, 0], m: mul(m, rotX(deg(-90))), h: [1.0, 1.3, 0.06], R: 0.12, e: 0.04, mat: 'cobalt' },
      { t: 'plate', c: [0.04, 0.33, 0], m: mul(m, rotX(deg(-90))), h: [0.92, 1.22, 0.22], R: 0.08, e: 0.05, mat: 'cream' },
      { t: 'plate', c: [0, 0.6, 0], m: mul(m, rotX(deg(-90))), h: [1.0, 1.3, 0.06], R: 0.12, e: 0.04, mat: 'cobalt' },
      { t: 'rbox', c: [-0.98 * Math.cos(deg(22)), 0.33, 0.98 * Math.sin(deg(22))], m, h: [0.07, 0.33, 1.3], r: 0.06, mat: 'cobalt' },
      { t: 'plate', c: [0.25 * Math.cos(deg(22)) + 1.22 * Math.sin(deg(22)), 0.36, -0.25 * Math.sin(deg(22)) + 1.22 * Math.cos(deg(22))], m: mul(m, rotX(deg(-90))), h: [0.14, 0.3, 0.035], R: 0.05, e: 0.03, mat: 'coral' },
      { t: 'sphere', c: [0.15, 1.02, 0.1], r: 0.36, mat: 'butter' },
    ] },
  ], { target: [0, 0.55, 0], pitch: deg(34), dist: 9.6 });
}

// Workshop icons: a watch, a screen with caption bars, a camera on a stand.
function iconWatch(theme) {
  const pm = mul(rotY(deg(-14)), rotX(deg(-12)));
  return icon(theme, [
    { c: [0, 1.75, 0], r: 2.4, prims: [
      { t: 'plate', c: [0, 2.82, -0.2], m: pm, h: [0.5, 0.62, 0.05], R: 0.16, e: 0.04, mat: 'coral' },
      { t: 'plate', c: [0, 0.66, 0.24], m: pm, h: [0.5, 0.62, 0.05], R: 0.16, e: 0.04, mat: 'coral' },
      phone([0, 1.75, 0], pm, 0.8, 0.9, [[0, 0.3, 0.5, 0.16, 'cobalt'], [-0.12, -0.3, 0.38, 0.16, 'butter']]),
      { t: 'sphere', c: [0.9, 1.95, 0.2], r: 0.15, mat: 'butter' },
    ] },
  ], { target: [0, 1.7, 0], dist: 11.5 });
}

function iconSubtitle(theme) {
  const pm = mul(rotY(deg(-12)), rotX(deg(-10)));
  return icon(theme, [
    { c: [0, 1.2, 0], r: 2.4, prims: [
      phone([0, 1.25, 0], pm, 1.35, 0.95, [[0, -0.42, 0.62, 0.085, 'cobalt'], [0, -0.74, 0.42, 0.085, 'coral']]),
      { t: 'sphere', c: [-0.05, 1.62, 0.32], r: 0.3, mat: 'butter' },
      { t: 'capsule', a: [-0.5, 0.14, 0.2], b: [0.5, 0.14, 0.2], r: 0.14, mat: 'ink' },
    ] },
  ], { target: [0, 1.15, 0], dist: 10.2 });
}

function iconCamera(theme) {
  const m = rotY(deg(35));
  const f = (d) => [Math.sin(deg(35)) * -d, 0, Math.cos(deg(35)) * d]; // along the body, toward the lens
  const at = (d, y, side = 0) => [f(d)[0] + side * Math.cos(deg(35)), y, f(d)[2] + side * Math.sin(deg(35))];
  return icon(theme, [
    { c: [0, 1.1, 0], r: 2.6, prims: [
      { t: 'rbox', c: at(-0.1, 1.65), m, h: [0.52, 0.5, 0.9], r: 0.2, mat: 'cream' },
      { t: 'sphere', c: at(0.82, 1.65), r: 0.44, mat: 'body' },
      { t: 'sphere', c: at(1.12, 1.65), r: 0.21, mat: 'cobalt' },
      { t: 'sphere', c: at(0.35, 2.2, -0.25), r: 0.13, mat: 'coral' },
      { t: 'capsule', a: at(-0.35, 1.1), b: at(-0.35, 0.3), r: 0.15, mat: 'ink' },
      { t: 'cyl', c: at(-0.35, 0.13), m: rotY(0), R: 0.7, h: 0.13, e: 0.06, mat: 'ink' },
    ] },
  ], { target: [0, 1.1, 0], dist: 10 });
}

// Three layers with different things standing on top: one foundation under every project.
function foundation(theme) {
  const sc = icon(theme, [
    { c: [0, 0.6, 0], r: 4.2, prims: [
      { t: 'slab', c: [0, 0.14, 0], h: [2.7, 0.14, 1.75], R: 0.5, e: 0.06, mat: 'ink' },
      { t: 'slab', c: [0, 0.5, 0], h: [2.35, 0.14, 1.45], R: 0.45, e: 0.06, mat: 'cobalt' },
      { t: 'slab', c: [0, 0.86, 0], h: [2.0, 0.14, 1.15], R: 0.4, e: 0.06, mat: 'slab' },
      { t: 'rbox', c: [-1.2, 1.4, 0.1], m: rotY(deg(24)), h: [0.4, 0.4, 0.4], r: 0.1, mat: 'coral' },
      { t: 'sphere', c: [0, 1.46, 0.25], r: 0.46, mat: 'butter' },
      { t: 'cyl', c: [1.2, 1.45, -0.05], m: rotY(0), R: 0.4, h: 0.45, e: 0.09, mat: 'cobalt' },
    ] },
  ], { target: [0, 0.75, 0], pitch: deg(30), yaw: deg(-24), dist: 10.6 });
  sc.width = 720; sc.aspect = 2.0;
  return sc;
}

function buildScene(name, theme) {
  if (name === 'hero') return hero(theme);
  if (name === 'translate') return iconTranslate(theme);
  if (name === 'switch') return iconSwitch(theme);
  if (name === 'book') return iconBook(theme);
  if (name === 'watch') return iconWatch(theme);
  if (name === 'subtitle') return iconSubtitle(theme);
  if (name === 'camera') return iconCamera(theme);
  if (name === 'foundation') return foundation(theme);
  throw new Error('unknown scene ' + name);
}
module.exports = { buildScene };
