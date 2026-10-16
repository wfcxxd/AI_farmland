/**
 * 会随时间变化的东西：作物和粒子。
 *
 * 作物不是手绘 N 个成长阶段，而是按成长度 g（0~1）程序化画出来：
 * 茎变高 → 长叶 → 抽穗 → 转金黄。想调成长曲线只改下面的数字。
 *
 * 粒子用于三种效果：播种扬土（dust）、浇水水珠（drop）、收割谷粒（chaff）。
 */
import { CANVAS } from "./constants.js";

const { H } = CANVAS;

/* ---------------------------------------------------------------
 * 作物配色
 * 注意：这些颜色必须比田地本身亮不少，否则会完全糊进土里。
 * 实测田地在正午约为 rgb(118,115,59)，所以作物用更亮更饱和的黄绿。
 * --------------------------------------------------------------- */
const CROP_COLORS = {
  leafYoung: "#6fc247",   // 幼苗叶
  leafMid: "#8fd45c",     // 中期叶
  leafRipe: "#f4d76a",    // 成熟叶/穗（金黄）
  stemYoung: "#4d8a2c",
  stemMid: "#5da233",
  stemRipe: "#c9a83e",
  grainHighlight: "#fff0b8", // 成熟谷粒高光
};

/** 成长度到 0.72 以上就算成熟（颜色转金黄） */
const RIPE_AT = 0.72;

/**
 * 画一株作物
 *
 * @param {number} x      根部 x
 * @param {number} baseY  根部 y（作物往上长）
 * @param {number} g      成长度 0~1
 */
export function drawPlant(ctx, x, baseY, g) {
  if (g <= 0) return;
  x = Math.round(x);
  baseY = Math.round(baseY);

  const ripe = g > RIPE_AT;
  const leaf = ripe ? CROP_COLORS.leafRipe : g > 0.45 ? CROP_COLORS.leafMid : CROP_COLORS.leafYoung;
  const stem = ripe ? CROP_COLORS.stemRipe : g > 0.45 ? CROP_COLORS.stemMid : CROP_COLORS.stemYoung;

  // 刚破土：只露一个小芽
  if (g < 0.14) {
    ctx.fillStyle = leaf;
    ctx.fillRect(x, baseY - 1, 2, 1);
    return;
  }

  // 茎
  const hgt = Math.max(2, Math.round(g * 8));
  ctx.fillStyle = stem;
  ctx.fillRect(x, baseY - hgt, 1, hgt);

  // 叶（两侧各一片，错开一格显得有层次）
  if (g > 0.3) {
    const ly = baseY - Math.round(hgt * 0.55);
    ctx.fillStyle = leaf;
    ctx.fillRect(x - 2, ly, 2, 1);
    ctx.fillRect(x + 1, ly + 2, 2, 1);
  }

  // 穗：成熟后更饱满并加高光
  if (g > 0.55) {
    ctx.fillStyle = leaf;
    ctx.fillRect(x - 1, baseY - hgt - 3, 3, 3);
    if (ripe) {
      ctx.fillStyle = CROP_COLORS.grainHighlight;
      ctx.fillRect(x - 1, baseY - hgt - 3, 3, 1);
      ctx.fillStyle = CROP_COLORS.leafRipe;
      ctx.fillRect(x, baseY - hgt, 1, 1);
    }
  }
}

/* ---------------------------------------------------------------
 * 粒子
 * 每个粒子是一个带速度的小点，生命值 1 -> 0 逐渐淡出。
 * --------------------------------------------------------------- */
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
