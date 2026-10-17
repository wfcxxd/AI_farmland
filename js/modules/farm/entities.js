/* ============ entities.js · 作物与粒子 ============ */
/* 作物按成长度 0~1 画成一簇叶子：小芽 → 展叶 → 茂密 → 成熟金黄 */
import { CANVAS } from "./constants.js";

const { H } = CANVAS;

/* 作物配色。要比田地亮，否则会糊进土里 */
const CROP_COLORS = {
  leafYoung: "#8fd45c",
  leafMid: "#6fc247",
  leafHighlight: "#c3ea8a",
  leafDark: "#4d8a2c",
  leafRipe: "#e8c95a",
  leafRipeHighlight: "#f7e08a",
  leafRipeDark: "#a8862a",
  fruit: "#fff6d0",
};

/* 成熟阈值：成长度超过它颜色转金黄。改这里调整成熟时机 */
const RIPE_AT = 0.72;

/** 稳定伪随机（0~1），同一个种子每次结果相同 */
function hash(a, b) {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * 画一簇叶子
 * @param {number} rad 半径（1~3）
 * @param {number} seed 每株的种子，决定边缘镂空位置
 */
function drawBlob(ctx, x, y, rad, leaf, dark, seed) {
  // 由半径决定轮廓：半径越大越接近圆
  for (let dy = -rad; dy <= rad; dy++) {
    for (let dx = -rad; dx <= rad; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > rad + 0.35) continue;

      // 边缘像素按种子随机镂空，做出不规则外形
      const edge = d > rad - 0.6;
      if (edge && hash(seed + dx * 3.1, seed + dy * 5.7) > 0.62) continue;

      // 左上受光、右下背光
      const lit = -dx - dy;
      ctx.fillStyle = lit > rad * 0.5 ? leaf : lit < -rad * 0.4 ? dark : leaf;
      ctx.fillRect(x + dx, y + dy, 1, 1);
    }
  }
}

/**
 * 画一株作物。改下面 rad 的分档可调整各阶段大小
 * @param {number} x      株心 x
 * @param {number} y      株心 y
 * @param {number} g      成长度 0~1
 * @param {number} seed   每株的种子
 */
export function drawPlant(ctx, x, y, g, seed = 0) {
  if (g <= 0) return;
  x = Math.round(x);
  y = Math.round(y);

  const ripe = g > RIPE_AT;
  const leaf = ripe ? CROP_COLORS.leafRipe : g > 0.45 ? CROP_COLORS.leafMid : CROP_COLORS.leafYoung;
  const dark = ripe ? CROP_COLORS.leafRipeDark : CROP_COLORS.leafDark;
  const shine = ripe ? CROP_COLORS.leafRipeHighlight : CROP_COLORS.leafHighlight;

  // 刚破土：一个小芽
  if (g < 0.16) {
    ctx.fillStyle = leaf;
    ctx.fillRect(x, y - 1, 1, 2);
    return;
  }

  // 幼苗：一对小叶
  if (g < 0.34) {
    ctx.fillStyle = leaf;
    ctx.fillRect(x, y, 1, 1);
    if (hash(seed, 1) > 0.35) ctx.fillRect(x - 1, y - 1, 1, 1);
    if (hash(seed, 2) > 0.35) ctx.fillRect(x + 1, y - 1, 1, 1);
    ctx.fillStyle = dark;
    ctx.fillRect(x - 1, y + 1, 1, 1);
    return;
  }

  // 成长中 / 成熟：叶簇随成长度变大
  const rad = g < 0.5 ? 1 : g < 0.66 ? 2 : ripe ? 3 : 2;
  drawBlob(ctx, x, y, rad, leaf, dark, seed);

  // 几根伸出来的叶尖，打破圆形轮廓
  ctx.fillStyle = leaf;
  const tips = rad >= 2 ? 3 : 2;
  for (let i = 0; i < tips; i++) {
    const a = hash(seed, i + 11) * Math.PI * 2;
    const len = rad + 1 + Math.floor(hash(seed, i + 21) * 2);
    ctx.fillRect(
      Math.round(x + Math.cos(a) * len),
      Math.round(y + Math.sin(a) * len),
      1,
      1
    );
  }

  // 受光高光
  if (rad >= 2) {
    ctx.fillStyle = shine;
    ctx.fillRect(x - 1, y - 1, 1, 1);
  }

  // 成熟：加几粒饱满的果实
  if (ripe) {
    ctx.fillStyle = CROP_COLORS.fruit;
    for (let i = 0; i < 3; i++) {
      const a = hash(seed, i + 31) * Math.PI * 2;
      const r = 1 + hash(seed, i + 41) * 1.6;
      ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1);
    }
  }
}

/* 粒子：播种扬土 dust / 浇水水珠 drop / 收割谷粒 chaff */
const PARTICLE_COLORS = {
  drop: "rgba(150,214,236,",   // 水珠
  chaff: "rgba(240,198,74,",   // 谷粒
  dust: "rgba(190,150,100,",   // 扬起的土
};

/** 在 (x,y) 生成 n 个粒子；kind 决定颜色和行为 */
export function spawnParticles(list, x, y, n, kind) {
  for (let i = 0; i < n; i++) {
    list.push({
      x,
      y,
      vx: (Math.random() - 0.5) * (kind === "drop" ? 0.35 : 1.0),
      vy: kind === "drop" ? 0.3 + Math.random() * 0.25 : -0.6 - Math.random() * 0.9,
      life: 1,
      kind,
    });
  }
}

/** 按 dt（秒）推进所有粒子，超出画面或生命结束的移除 */
export function updateParticles(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    if (p.kind === "drop") p.vy += 0.07 * dt * 60;   // 水珠受重力
    if (p.kind === "chaff") p.vy += 0.03 * dt * 60;
    p.life -= dt * (p.kind === "drop" ? 1.3 : 0.85);
    if (p.life <= 0 || p.y > H) list.splice(i, 1);
  }
}

export function drawParticles(ctx, list) {
  for (const p of list) {
    const alpha = Math.max(0, Math.min(1, p.life)).toFixed(3);
    ctx.fillStyle = (PARTICLE_COLORS[p.kind] || "rgba(200,200,200,") + alpha + ")";
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, p.kind === "drop" ? 2 : 1);
  }
}
