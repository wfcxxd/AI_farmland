/**
 * 像素精灵：把字符画转成小位图，并按部件拼出农民。
 *
 * 农民不做逐帧手绘，而是拆成 7 个部件（帽子/头/身体/手臂/腿/靴/水壶），
 * 按整数偏移绘制就能拼出走、锄地、浇水、收割等动作。
 * 想改外观（比如帽子变红），改下面对应的字符画即可：
 *   .  透明
 *   h/H 草帽亮/暗      s/S 肤色亮/暗       e 眼睛
 *   g/G 上衣亮/暗      j/J 背带裤亮/暗     b 靴子
 *   w 水   m/n 金属   o 木柄   k 描边
 */
import { PALETTE } from "./constants.js";

/* ---------------------------------------------------------------
 * 字符画 -> canvas 位图
 * --------------------------------------------------------------- */
const cache = new Map();

/** @param {string[]} rows 每行等长的字符画 */
function sprite(rows) {
  const key = rows.join("|");
  const hit = cache.get(key);
  if (hit) return hit;

  const h = rows.length;
  const w = rows[0].length;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === "." || ch === " ") continue;
      const color = PALETTE[ch];
      if (!color) continue;
      g.fillStyle = color;
      g.fillRect(x, y, 1, 1);
    }
  }

  const out = { canvas: c, w, h };
  cache.set(key, out);
  return out;
}

/* ---------------------------------------------------------------
 * 农民各部件（整体约 14×24）
 * 尺寸参照星露谷：那边农民 16×32（1 格宽 2 格高），地块 16×16。
 * --------------------------------------------------------------- */
const HAT = sprite([
  ".....hhhh.....",
  "...hhhhhhhh...",
  "..hhhhhhhhhh..",
  ".HHHHHHHHHHHh.",
]);

const HEAD = sprite([
  "....ssssss....",
  "...sSssssSs...",
  "...seessees...",
  "...ssssssss...",
  "...sSsmmsSs...",
  "....SSSSSS....",
]);

const TORSO = sprite([
  "...GGGGGGGG...",
  "..GggggggggG..",
  "..GgGGGGGGgG..",
  "..GgjjjjjjgG..",
  "...jjjjjjjj...",
  "...JjjjjjjJ...",
  "...JJjjjjJJ...",
]);

const ARM = sprite([
  "ss",
  "gg",
  "GG",
]);

const LEG = sprite([
  ".jjj.",
  ".jjj.",
  ".jjj.",
  ".JJJ.",
]);

const BOOT = sprite([
  "bbbbb",
  "bbbbb",
  "kkkkk",
]);

const CAN = sprite([
  "...mm...",
  "..mmmno.",
  ".wmmnno.",
  ".wmm....",
  "ww......",
  "ww......",
]);

/** 画一个部件；flip=true 时水平镜像（人物朝左走） */
function part(ctx, sp, x, y, flip) {
  x = Math.round(x);
  y = Math.round(y);
  if (flip) {
    ctx.save();
    ctx.translate(x + sp.w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(sp.canvas, 0, 0);
    ctx.restore();
  } else {
    ctx.drawImage(sp.canvas, x, y);
  }
}

/**
 * 画农民
 *
 * @param {number} x      脚底中心 x
 * @param {number} y      脚底 y
 * @param {number} dir    1 朝右 / -1 朝左
 * @param {number|null} walk  行走相位（0~1 走两步），站立不动时传 null
 * @param {string} tool   "" | "can"（提水壶） | "hoe"（扛锄头）
 * @param {number} bend   0 站立 ~ 1 弯腰
 */
export function drawFarmer(ctx, x, y, dir, walk, tool, bend) {
  const flip = dir < 0;
  // 一个 walk 周期对应两步。取整数倍频率，左右腿交替才干净
  const legPhase = walk === null ? 0 : Math.sin(walk * Math.PI * 2);
  const armPhase = walk === null ? 0 : Math.sin(walk * Math.PI * 2 + Math.PI);
  const bob = walk === null ? 0 : Math.abs(legPhase) > 0.55 ? 1 : 0; // 单脚落地时抬一下
  const footY = Math.round(y) - 24 - bob;
  const lean = bend > 0 ? Math.round(bend * 3) : 0;
  const cx = Math.round(x);

  // 腿 + 靴：前后错开，步态更清楚
  const lx = cx - 4 + Math.round(legPhase * 1.3);
  const rx = cx + 1 - Math.round(legPhase * 1.3);
  part(ctx, LEG, lx, footY + 16);
  part(ctx, LEG, rx, footY + 16);
  part(ctx, BOOT, lx, footY + 19);
  part(ctx, BOOT, rx, footY + 19);

  // 身体
  const armY = footY + 6 + lean;
  part(ctx, TORSO, cx - 7, footY + 5 + lean);

  if (tool === "can") {
    part(ctx, ARM, cx + (flip ? -6 : 6), armY + 4, flip);
    part(ctx, ARM, cx + (flip ? -8 : 8), armY + 6, flip);
    part(ctx, CAN, cx + (flip ? -16 : 10), armY + 8, flip);
  } else if (tool === "hoe") {
    part(ctx, ARM, cx + (flip ? -6 : 5), armY - 5, flip);
    part(ctx, ARM, cx + (flip ? -7 : 6), armY + 5, flip);
    // 木柄 + 锄头
    ctx.fillStyle = PALETTE.o;
    const hx = cx + (flip ? -10 : 10);
    ctx.fillRect(hx, armY - 10, 1, 18);
    ctx.fillStyle = PALETTE.m;
    ctx.fillRect(hx - (flip ? 0 : 1), armY + 6, 4, 2);
  } else {
    // 手臂与腿反相摆动，走起来才像人
    const swing = Math.round(armPhase * 1.3);
    part(ctx, ARM, cx - 8, armY + swing, flip);
    part(ctx, ARM, cx + 6, armY - swing, flip);
  }

  // 头 + 帽子最后画，盖住脖子接缝
  part(ctx, HEAD, cx - 7, footY + 1, flip);
  part(ctx, HAT, cx - 7, footY - 3, flip);
}
