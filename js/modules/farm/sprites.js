/* ============ sprites.js · 农民精灵：字符画拼装（俯视） ============ */
/* 字符对应 constants.js 里的 PALETTE。改农民外观就是改下面的字符画 */
import { PALETTE } from "./constants.js";

/* 字符画转位图并缓存 */
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

/* --- 各部件。改字符画即改外观，尺寸变了要同步改下方 drawFarmer 的排布 --- */

/* 草帽 */
const HAT = sprite([
  "..HHHHHHHHH..",
  ".HhhhhhhhhhH.",
  "HhhhhhhhhhhhH",
  "HhhbbbbbbbhhH",
  ".HHHHHHHHHHH.",
]);

/* 脸（朝下时） */
const FACE = sprite([
  "sssssssss",
  "seesssees",
  "sssssssss",
  "SSSSSSSSS",
]);

/* 后脑勺（朝上时） */
const BACK = sprite([
  "aaaaaaaaa",
  "aAAAAAAAa",
  "aaaaaaaaa",
  "AAAAAAAAA",
]);

/* 肩膀 + 背带裤 */
const TORSO = sprite([
  ".gGGGGGGGg.",
  "gGgggggggGg",
  "gGgjjjjjgGg",
  "gGjjjjjjjGg",
  "gGjjjjjjjGg",
  ".ggGGGGGgg.",
]);

/* 手臂 */
const ARM = sprite([
  "gG",
  "gG",
  "gG",
  "gG",
  "sG",
  "sG",
]);

/* 腿 */
const LEG = sprite([
  "jjj",
  "jjj",
  "jjj",
  "JJJ",
]);

/* 靴子 */
const BOOT = sprite([
  "oooo",
  "kkkk",
]);

/* 画一个部件 */
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
 * 画农民（俯视）。竖向排布：帽 0~4 / 脸 5~8 / 肩 9~14 / 腿 15~18 / 靴 19~20
 * 改部位位置就改下面的 top+数字；改整体高度就改 footY-20 这个 20。
 *
 * @param {number} x    脚底中心 x
 * @param {number} y    脚底 y
 * @param {string} dir  "down" / "up" / "left" / "right"
 * @param {number|null} walk 行走相位 0~1，站着传 null
 * @param {string} tool "" | "can" | "hoe"
 * @param {number} bend 0 站立 ~ 1 弯腰
 */
export function drawFarmer(ctx, x, y, dir, walk, tool, bend) {
  const facingUp = dir === "up";
  const sideways = dir === "left" || dir === "right";
  const flip = dir === "left";
  const cx = Math.round(x);
  const footY = Math.round(y);

  // 弯腰时整体压低（改 2 调整压低幅度）
  const top = footY - 20 + Math.round(bend * 2);

  // 行走相位：一个周期两步
  const phase = walk === null ? 0 : Math.sin(walk * Math.PI * 2);
  const bob = walk === null ? 0 : Math.abs(phase) > 0.6 ? 1 : 0;

  /* 脚下影子 */
  ctx.fillStyle = "rgba(30, 46, 26, 0.22)";
  ctx.beginPath();
  ctx.ellipse(cx, footY - 1, 7, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

  /* 腿和靴子：前后交替 */
  const legA = Math.round(phase * 2);
  const legB = -legA;
  part(ctx, LEG, cx - 6, top + 15 + legA);
  part(ctx, LEG, cx + 2, top + 15 + legB);
  part(ctx, BOOT, cx - 6, top + 19 + legA);
  part(ctx, BOOT, cx + 2, top + 19 + legB);

  /* 身体 */
  part(ctx, TORSO, cx - 5, top + 9 - bob);

  /* 手臂与工具 */
  if (tool === "hoe") {
    // 举锄
    part(ctx, ARM, cx - 7, top + 7 - bob);
    part(ctx, ARM, cx + 5, top + 12 - bob);
    ctx.fillStyle = PALETTE.o;
    ctx.fillRect(cx - 1, top + 1, 1, 11);
    ctx.fillStyle = PALETTE.m;
    ctx.fillRect(cx - 2, top + 11, 4, 2);
  } else if (tool === "can") {
    // 提壶浇水
    part(ctx, ARM, cx - 7, top + 10 - bob);
    part(ctx, ARM, cx + 5, top + 8 - bob);
    ctx.fillStyle = PALETTE.m;
    ctx.fillRect(cx + 6, top + 11, 5, 4);
    ctx.fillStyle = PALETTE.k;
    ctx.fillRect(cx + 6, top + 11, 5, 1);
    ctx.fillStyle = PALETTE.w;
    ctx.fillRect(cx + 11, top + 12, 2, 2);
    ctx.fillRect(cx + 13, top + 13, 1, 3);
  } else {
    const swing = Math.round(phase * 1.5);
    part(ctx, ARM, cx - 7, top + 10 - swing);
    part(ctx, ARM, cx + 5, top + 10 + swing);
  }

  /* 头：朝上画后脑勺，朝下画脸 */
  if (facingUp) {
    part(ctx, BACK, cx - 4, top + 5 - bob);
  } else {
    part(ctx, FACE, cx - 4, top + 5 - bob);
  }

  /* 帽子最后画，压住额头接缝 */
  const hatOffset = sideways ? (flip ? -1 : 1) : 0;
  part(ctx, HAT, cx - 6 + hatOffset, top - bob, flip && sideways);
}
