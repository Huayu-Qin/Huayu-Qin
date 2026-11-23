// Small ray-marching renderer for the profile art. No dependencies.
//   node tools/render.js <scene> <light|dark> <out.png> [width] [samples]
// Scenes are defined in tools/scenes.js. Output is an RGBA PNG with a transparent background,
// so each image sits directly on GitHub's page colour.
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const zlib = require('zlib');
const fs = require('fs');
const os = require('os');
const path = require('path');

if (isMainThread) {
  const [scene, theme, out, w, ss] = process.argv.slice(2);
  const { buildScene } = require('./scenes.js');
  const sc = buildScene(scene, theme);
  const W = parseInt(w || sc.width, 10);
  const H = Math.round(W / sc.aspect);
  const SS = parseInt(ss || 2, 10);
  const n = Math.max(1, os.cpus().length - 1);
  const buf = Buffer.alloc(W * H * 4);
  let next = 0, done = 0;
  const band = 8;
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const wk = new Worker(__filename, { workerData: { scene, theme, W, H, SS } });
    const give = () => {
      if (next >= H) { wk.postMessage(null); return; }
      wk.postMessage({ y0: next, y1: Math.min(H, next + band) });
      next += band;
    };
    wk.on('message', (m) => {
      Buffer.from(m.px.buffer).copy(buf, m.y0 * W * 4);
      give();
    });
    wk.on('exit', () => {
      if (++done === n) {
        fs.writeFileSync(out, png(buf, W, H));
        console.log(`${out} ${W}x${H} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      }
    });
    give();
  }
} else {
  const { scene, theme, W, H, SS } = workerData;
  const { buildScene } = require(path.join(__dirname, 'scenes.js'));
  const R = makeRenderer(buildScene(scene, theme), W, H, SS);
  parentPort.on('message', (m) => {
    if (!m) process.exit(0);
    parentPort.postMessage({ y0: m.y0, px: R(m.y0, m.y1) });
  });
}

function png(rgba, W, H) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    rgba.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeRenderer(sc, W, H, SS) {
  const groups = sc.groups;
  // Material colours are written as sRGB; lighting is done in linear light.
  const mats = {};
  for (const k in sc.mats) mats[k] = { ...sc.mats[k], col: sc.mats[k].col.map((v) => Math.pow(v, 2.2)) };
  sc = { ...sc, mats };
  let hit = null;

  function primDist(p, x, y, z) {
    switch (p.t) {
      case 'sphere': return Math.hypot(x - p.c[0], y - p.c[1], z - p.c[2]) - p.r;
      case 'capsule': {
        const ax = p.a[0], ay = p.a[1], az = p.a[2];
        const bx = p.b[0] - ax, by = p.b[1] - ay, bz = p.b[2] - az;
        const px = x - ax, py = y - ay, pz = z - az;
        let h = (px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz);
        h = h < 0 ? 0 : h > 1 ? 1 : h;
        return Math.hypot(px - bx * h, py - by * h, pz - bz * h) - p.r;
      }
      case 'arc': { // ring in the XZ plane; half=true keeps the side with z >= cz
        const dx = x - p.c[0], dy = y - p.c[1], dz = z - p.c[2];
        if (p.half && dz < 0) return Math.hypot(Math.abs(dx) - p.R, dy, dz) - p.r;
        return Math.hypot(Math.hypot(dx, dz) - p.R, dy) - p.r;
      }
      case 'slab': { // rounded rectangle in XZ, extruded in Y, soft edge e
        const dx = Math.abs(x - p.c[0]) - (p.h[0] - p.R), dz = Math.abs(z - p.c[2]) - (p.h[2] - p.R);
        const d2 = Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0) - p.R + p.e;
        const dy = Math.abs(y - p.c[1]) - p.h[1] + p.e;
        return Math.min(Math.max(d2, dy), 0) + Math.hypot(Math.max(d2, 0), Math.max(dy, 0)) - p.e;
      }
      default: { // rotated shapes work in local space
        const m = p.m;
        const px = x - p.c[0], py = y - p.c[1], pz = z - p.c[2];
        const lx = m[0] * px + m[3] * py + m[6] * pz;
        const ly = m[1] * px + m[4] * py + m[7] * pz;
        const lz = m[2] * px + m[5] * py + m[8] * pz;
        if (p.t === 'rbox') {
          const qx = Math.abs(lx) - p.h[0] + p.r, qy = Math.abs(ly) - p.h[1] + p.r, qz = Math.abs(lz) - p.h[2] + p.r;
          return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - p.r;
        }
        if (p.t === 'plate') { // rounded rectangle in local XY, extruded in local Z
          const dx = Math.abs(lx) - (p.h[0] - p.R), dy2 = Math.abs(ly) - (p.h[1] - p.R);
          const d2 = Math.hypot(Math.max(dx, 0), Math.max(dy2, 0)) + Math.min(Math.max(dx, dy2), 0) - p.R + p.e;
          const dz = Math.abs(lz) - p.h[2] + p.e;
          return Math.min(Math.max(d2, dz), 0) + Math.hypot(Math.max(d2, 0), Math.max(dz, 0)) - p.e;
        }
        if (p.t === 'torus') { // ring around local Y; sy flattens the tube
          const q = Math.hypot(lx, lz) - p.R;
          return (Math.hypot(q, ly / p.sy) - p.r) * Math.min(1, p.sy);
        }
        if (p.t === 'cyl') { // capped cylinder along local Y with soft edge
          const dr = Math.hypot(lx, lz) - p.R + p.e, dy = Math.abs(ly) - p.h + p.e;
          return Math.min(Math.max(dr, dy), 0) + Math.hypot(Math.max(dr, 0), Math.max(dy, 0)) - p.e;
        }
        if (p.t === 'cone') { // rounded cone along local Y: radius R at -h to 0 at +h
          const q = Math.hypot(lx, lz);
          const k = p.R / (2 * p.h), s = 1 / Math.hypot(1, k);
          const side = (q - (p.h - ly) * k) * s;
          const d = Math.max(side, -ly - p.h);
          return d + p.e * 0 ;
        }
        return 1e9;
      }
    }
  }

  function map(x, y, z) {
    let d = 1e9;
    for (let g = 0; g < groups.length; g++) {
      const G = groups[g];
      const bd = Math.hypot(x - G.c[0], y - G.c[1], z - G.c[2]) - G.r;
      if (bd > d) continue;
      const ps = G.prims;
      for (let i = 0; i < ps.length; i++) {
        const di = primDist(ps[i], x, y, z);
        if (di < d) { d = di; hit = ps[i]; }
      }
    }
    return d;
  }

  function march(ox, oy, oz, dx, dy, dz, tmax) {
    let t = 0.02;
    for (let i = 0; i < 160; i++) {
      const d = map(ox + dx * t, oy + dy * t, oz + dz * t);
      if (d < 0.0008 * t) return t;
      t += d * 0.95;
      if (t > tmax) break;
    }
    return -1;
  }

  function shadow(ox, oy, oz, L, k) {
    let res = 1, t = 0.03;
    for (let i = 0; i < 56; i++) {
      const d = map(ox + L[0] * t, oy + L[1] * t, oz + L[2] * t);
      if (d < 0.0006) return 0;
      const r = k * d / t; if (r < res) res = r;
      t += Math.min(Math.max(d, 0.02), 0.35);
      if (t > 14) break;
    }
    return res * res * (3 - 2 * res);
  }

  function ao(x, y, z, nx, ny, nz) {
    let occ = 0, w = 1;
    for (let i = 1; i <= 5; i++) {
      const h = 0.06 * i * sc.aoScale;
      occ += (h - map(x + nx * h, y + ny * h, z + nz * h)) * w;
      w *= 0.62;
    }
    return Math.max(0, 1 - sc.aoGain * occ);
  }

  const cam = sc.cam;
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const ro = [cam.target[0] + cam.dist * sy * cp, cam.target[1] + cam.dist * sp, cam.target[2] + cam.dist * cy * cp];
  const f = norm([cam.target[0] - ro[0], cam.target[1] - ro[1], cam.target[2] - ro[2]]);
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const th = Math.tan(cam.fov / 2), asp = W / H;
  const L = norm(sc.light.dir), LC = sc.light.col;
  const Hc = sc.sky, Gc = sc.ground;

  function trace(px, py) {
    const sx = (2 * px / W - 1) * asp * th, sy2 = (1 - 2 * py / H) * th;
    const d = norm([f[0] + r[0] * sx + u[0] * sy2, f[1] + r[1] * sx + u[1] * sy2, f[2] + r[2] * sx + u[2] * sy2]);
    const t = march(ro[0], ro[1], ro[2], d[0], d[1], d[2], cam.dist * 2.2);
    if (t < 0) {
      // Shadow catcher: an invisible plane under the scene keeps only the soft shadow, as alpha.
      if (sc.catcher && d[1] < 0) {
        const tp = (sc.catcher.y - ro[1]) / d[1];
        const x = ro[0] + d[0] * tp, z = ro[2] + d[2] * tp;
        const s = shadow(x, sc.catcher.y, z, sc.catcher.dir ? norm(sc.catcher.dir) : L, sc.catcher.k);
        return [0, 0, 0, sc.catcher.a * (1 - s)];
      }
      return [0, 0, 0, 0];
    }
    const x = ro[0] + d[0] * t, y = ro[1] + d[1] * t, z = ro[2] + d[2] * t;
    const p = hit;
    const e = 0.0015;
    const n = norm([
      map(x + e, y, z) - map(x - e, y, z),
      map(x, y + e, z) - map(x, y - e, z),
      map(x, y, z + e) - map(x, y, z - e)]);
    let mat = sc.mats[p.mat];
    if (p.matFn) mat = sc.mats[p.matFn(x, y, z, p)] || mat;
    const ox = x + n[0] * 0.004, oy = y + n[1] * 0.004, oz = z + n[2] * 0.004;
    const ndl = n[0] * L[0] + n[1] * L[1] + n[2] * L[2];
    const wrap = Math.max(0, (ndl + 0.25) / 1.25);
    const sh = ndl > -0.25 ? shadow(ox, oy, oz, L, sc.light.k) : 0;
    const a = ao(x, y, z, n[0], n[1], n[2]);
    const up = 0.5 + 0.5 * n[1];
    const hv = norm([L[0] - d[0], L[1] - d[1], L[2] - d[2]]);
    const ndh = Math.max(0, n[0] * hv[0] + n[1] * hv[1] + n[2] * hv[2]);
    const ndv = Math.max(0, -(n[0] * d[0] + n[1] * d[1] + n[2] * d[2]));
    const fres = Math.pow(1 - ndv, 4);
    const spec = Math.pow(ndh, mat.gloss) * mat.spec * sh * (ndl > 0 ? 1 : 0);
    const c = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const amb = (Gc[i] + (Hc[i] - Gc[i]) * up) * a;
      c[i] = mat.col[i] * (LC[i] * wrap * sh + amb) + spec * LC[i] + fres * mat.rim * Hc[i] * a + (mat.emit ? mat.emit[i] : 0);
    }
    return [c[0], c[1], c[2], 1];
  }

  const tone = (v) => { // linear up to 0.75, soft shoulder above, then sRGB gamma
    v *= sc.exposure;
    if (v > 0.75) v = 0.75 + 0.25 * (1 - Math.exp(-(v - 0.75) / 0.25));
    return Math.pow(Math.max(0, v), 1 / 2.2);
  };

  return (y0, y1) => {
    const out = new Uint8Array((y1 - y0) * W * 4);
    for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
      let R0 = 0, G0 = 0, B0 = 0, A0 = 0;
      for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
        const c = trace(x + (i + 0.5) / SS, y + (j + 0.5) / SS);
        R0 += tone(c[0]) * c[3]; G0 += tone(c[1]) * c[3]; B0 += tone(c[2]) * c[3]; A0 += c[3];
      }
      const o = ((y - y0) * W + x) * 4;
      if (A0 > 0) {
        out[o] = Math.round(255 * R0 / A0); out[o + 1] = Math.round(255 * G0 / A0); out[o + 2] = Math.round(255 * B0 / A0);
      }
      out[o + 3] = Math.round(255 * A0 / (SS * SS));
    }
    return out;
  };
}

function norm(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
