/**
 * 环境绘制：天空、日月星、云鸟、风车、远山、农舍、栅栏、地面、田地、水井。
 *
 * 每个函数都是「就地往 ctx 上画」，没有内部状态。
 * dl 是当天的明暗系数：0 = 全黑深夜，1 = 正午，
 * 大部分颜色都用 mix(夜色, 日色, dl) 算出来，所以同一个函数能画出昼夜变化。
 *
 * 想加一个场景元素（比如稻草人）：写一个 drawScarecrow(ctx, dl) 并导出，
 * 然后在 scene.js 的 draw() 里按顺序调用它。
 */
import { CANVAS, CYCLE } from "./constants.js";

const { W, H } = CANVAS;

/* ---------------- 环境绘制 ---------------- */
export function makeSky(ctx, dl) {
  const top = mix([14, 20, 40], [92, 166, 214], dl);
  const bottom = mix([36, 42, 64], [180, 218, 234], dl);
  const grd = ctx.createLinearGradient(0, 0, 0, 44);
  grd.addColorStop(0, rgb(top));
  grd.addColorStop(1, rgb(bottom));
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, 44);
}

export function drawStars(ctx, t, dl) {
  if (dl > 0.42) return;
  const a = (0.42 - dl) / 0.42;
  for (let i = 0; i < 60; i++) {
    const sx = (i * 53) % W;
    const sy = (i * 17) % 36;
    const tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
    ctx.fillStyle = `rgba(255,255,255,${((0.2 + tw * 0.6) * a).toFixed(3)})`;
    ctx.fillRect(sx, sy, 1, 1);
  }
}

export function drawSunMoon(ctx, t, dl) {
  const prog = (t % CYCLE) / CYCLE;
  const x = 26 + prog * (W - 52);
  const y = 34 - Math.sin(prog * Math.PI) * 24;

  if (dl < 0.35) {
    ctx.fillStyle = "#e8eef5";
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c9d4e0";
    ctx.fillRect(x - 2, y - 2, 2, 2);
    ctx.fillRect(x + 1, y + 1, 2, 2);
  } else {
    ctx.fillStyle = `rgba(255,240,180,${(0.14 + dl * 0.12).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgb(mix([255, 236, 160], [255, 250, 226], dl));
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawClouds(ctx, t) {
  const clouds = [
    { x: 40, y: 10, w: 30, sp: 2.0 },
    { x: 150, y: 6, w: 22, sp: 2.8 },
    { x: 240, y: 15, w: 34, sp: 1.6 },
    { x: 300, y: 4, w: 18, sp: 3.4 },
  ];
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  for (const c of clouds) {
    const cx = (c.x + t * c.sp) % (W + 70) - 35;
    ctx.fillRect(cx, c.y, c.w, 3);
    ctx.fillRect(cx + 4, c.y - 2, c.w - 10, 2);
    ctx.fillRect(cx + 6, c.y + 3, c.w - 14, 2);
  }
}

export function drawBirds(ctx, t) {
  ctx.fillStyle = "rgba(40,50,60,0.5)";
  for (let i = 0; i < 4; i++) {
    const bx = (t * (5 + i * 1.6) + i * 80) % (W + 30) - 15;
    const by = 12 + (i % 3) * 4 + Math.sin(t * 1.4 + i) * 2;
    const f = Math.sin(t * 6 + i * 2) > 0 ? 0 : 1;
    ctx.fillRect(Math.round(bx), Math.round(by), 1, 1);
    ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 1 + f, 1, 1);
    ctx.fillRect(Math.round(bx) + 1, Math.round(by) - 1 + f, 1, 1);
  }
}

export function drawWindmill(ctx, t, dl) {
  const body = rgb(mix([26, 30, 34], [124, 110, 94], dl));
  const blade = rgb(mix([34, 38, 42], [170, 158, 140], dl));
  const x = 300, baseY = 50, topY = 22;

  ctx.fillStyle = body;
  ctx.fillRect(x - 4, topY + 7, 8, baseY - topY - 7);
  ctx.fillRect(x - 5, topY + 3, 10, 4);

  const cx = x, cy = topY + 4;
  const ang = t * 0.7;
  for (let i = 0; i < 4; i++) {
    const a = ang + (i * Math.PI) / 2;
    const dx = Math.cos(a), dy = Math.sin(a);
    ctx.fillStyle = blade;
    for (let r = 3; r <= 10; r++) {
      ctx.fillRect(Math.round(cx + dx * r), Math.round(cy + dy * r), 1, 1);
    }
  }
  ctx.fillStyle = body;
  ctx.fillRect(cx - 1, cy - 1, 2, 2);
}

export function drawHills(ctx, dl) {
  const far = rgb(mix([28, 40, 44], [106, 142, 124], dl));
  const near = rgb(mix([22, 32, 36], [84, 120, 102], dl));
  ctx.fillStyle = far;
  ctx.beginPath();
  ctx.moveTo(0, 46);
  for (let x = 0; x <= W; x += 4) {
    ctx.lineTo(x, 38 - Math.sin(x * 0.028) * 5 - Math.sin(x * 0.009) * 4);
  }
  ctx.lineTo(W, 46);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = near;
  ctx.beginPath();
  ctx.moveTo(0, 50);
  for (let x = 0; x <= W; x += 4) {
    ctx.lineTo(x, 45 - Math.sin(x * 0.018 + 1.4) * 4);
  }
  ctx.lineTo(W, 50);
  ctx.closePath();
  ctx.fill();
}

/** 远处农舍 */
export function drawHouse(ctx, dl) {
  const wall = rgb(mix([44, 36, 32], [210, 194, 170], dl));
  const roof = rgb(mix([30, 24, 22], [152, 78, 58], dl));
  const dark = rgb(mix([18, 14, 12], [92, 70, 55], dl));
  const glow = rgb(mix([60, 50, 40], [255, 214, 130], dl > 0.42 ? 0.12 : 0.95));
  const x = 56, y = 36, w = 34, h = 22;

  // 屋顶（逐行收窄的三角）
  ctx.fillStyle = roof;
  for (let i = 0; i < 9; i++) {
    ctx.fillRect(x - 4 + i, y - 9 + i, w + 8 - i * 2, 1);
  }
  ctx.fillStyle = wall;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = dark;
  ctx.fillRect(x + 5, y + 8, 7, 14);
  ctx.fillRect(x + 20, y + 7, 8, 8);
  // 夜里窗户发亮
  ctx.fillStyle = glow;
  ctx.fillRect(x + 21, y + 8, 6, 6);
  // 烟囱（贴在屋顶左侧，别太高太突兀）
  ctx.fillStyle = roof;
  ctx.fillRect(x + 3, y - 8, 5, 6);
  ctx.fillStyle = dark;
  ctx.fillRect(x + 3, y - 8, 5, 1);
}

export function drawFence(ctx, dl) {
  const wood = rgb(mix([44, 33, 26], [150, 116, 76], dl));
  const dark = rgb(mix([30, 22, 18], [114, 86, 56], dl));
  for (let x = 2; x < W; x += 14) {
    ctx.fillStyle = dark;
    ctx.fillRect(x, 42, 2, 9);
    ctx.fillStyle = wood;
    ctx.fillRect(x, 42, 1, 9);
  }
  ctx.fillStyle = wood;
  ctx.fillRect(0, 44, W, 1);
  ctx.fillRect(0, 48, W, 1);
}

export function drawGround(ctx, dl) {
  const g1 = rgb(mix([22, 30, 26], [124, 134, 76], dl));
  const g2 = rgb(mix([18, 25, 22], [100, 120, 64], dl));
  const soil = rgb(mix([26, 19, 15], [118, 82, 52], dl));
  const path = rgb(mix([32, 26, 20], [204, 182, 142], dl));
  const pathDark = rgb(mix([24, 19, 15], [176, 154, 116], dl));

  ctx.fillStyle = g1;
  ctx.fillRect(0, 50, W, 6);
  ctx.fillStyle = g2;
  ctx.fillRect(0, 56, W, 8);
  ctx.fillStyle = soil;
  ctx.fillRect(0, 64, W, H - 64);

  // 前景横向小径
  ctx.fillStyle = path;
  ctx.fillRect(0, 100, W, 7);
  ctx.fillStyle = pathDark;
  for (let x = 0; x < W; x += 6) ctx.fillRect(x + 2, 101, 3, 1);

  // 两块田之间的纵向小径
  for (const gx of [104, 202]) {
    ctx.fillStyle = path;
    ctx.fillRect(gx, 52, 8, 48);
    ctx.fillStyle = pathDark;
    for (let y = 54; y < 100; y += 5) ctx.fillRect(gx + 1, y, 6, 1);
  }
}

/** 前景的水井，放在第一块田右前方（避开中间那条小径） */
export function drawWell(ctx, dl) {
  const stone = rgb(mix([40, 42, 44], [182, 182, 176], dl));
  const stoneD = rgb(mix([28, 30, 32], [142, 142, 136], dl));
  const wood = rgb(mix([44, 33, 26], [150, 116, 76], dl));
  const x = 74, y = 110;

  ctx.fillStyle = stoneD;
  ctx.fillRect(x - 9, y - 8, 18, 8);
  ctx.fillStyle = stone;
  ctx.fillRect(x - 8, y - 9, 16, 7);
  ctx.fillStyle = stoneD;
  ctx.fillRect(x - 7, y - 8, 14, 2);
  // 井架
  ctx.fillStyle = wood;
  ctx.fillRect(x - 8, y - 17, 2, 9);
  ctx.fillRect(x + 6, y - 17, 2, 9);
  ctx.fillRect(x - 9, y - 19, 18, 2);
  // 水桶
  ctx.fillStyle = wood;
  ctx.fillRect(x - 2, y - 15, 4, 3);
}

/** 一块田地：翻好的土 + 垄沟 + 边缘 */
export function drawPlot(ctx, pl, dl) {
  const tilled = rgb(mix([28, 20, 15], [132, 92, 56], dl));
  const ridge = rgb(mix([20, 14, 11], [106, 70, 42], dl));
  const edge = rgb(mix([34, 24, 18], [156, 112, 70], dl));

  ctx.fillStyle = tilled;
  ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
  ctx.fillStyle = edge;
  ctx.fillRect(pl.x, pl.y, pl.w, 1);
  ctx.fillRect(pl.x, pl.y, 1, pl.h);
  ctx.fillStyle = ridge;
  ctx.fillRect(pl.x, pl.y + pl.h - 1, pl.w, 1);
  ctx.fillRect(pl.x + pl.w - 1, pl.y, 1, pl.h);

  // 垄沟
  for (let y = pl.y + 5; y < pl.y + pl.h - 2; y += 6) {
    ctx.fillStyle = ridge;
    ctx.fillRect(pl.x + 2, y, pl.w - 4, 1);
  }
}

/* ---------------------------------------------------------------
 * 颜色小工具
 * --------------------------------------------------------------- */

/** 线性插值两个 [r,g,b]，t=0 取 a，t=1 取 b */
export function mix(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
}

/** [r,g,b] -> "rgb(r,g,b)" */
export const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** [r,g,b] + alpha -> "rgba(r,g,b,a)"，用于半透明效果 */
export const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
