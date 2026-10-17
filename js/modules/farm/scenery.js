/* ============ scenery.js · 场景绘制：草地 / 小径 / 田地 / 农舍 / 树 / 栅栏 / 水井 ============ */
/* 静态部分预渲染到离屏画布，每帧只贴图一次 */
import { CANVAS, PLOTS, PATH_Y, HOUSE, WELL, TERRAIN } from "./constants.js";

const { W, H } = CANVAS;

/* --- 颜色小工具 --- */

/** 线性插值两个 [r,g,b] */
export function mix(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
}

/** [r,g,b] -> "rgb(r,g,b)" */
export const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** [r,g,b] + alpha -> "rgba(r,g,b,a)" */
export const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/* 稳定伪随机数：同一坐标每次结果相同，不会闪烁 */
function hash(x, y, seed = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/* 线性同余随机数，用于撒点 */
function makeRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* --- 草地 --- */

/**
 * 逐像素画草皮：低频噪声做色块，高频噪声做颗粒。
 * 不要改成 16px 平铺，会有明显的方格接缝。
 */
function paintGrass(g) {
  const img = g.createImageData(W, H);
  const d = img.data;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const patch = hash(Math.floor(x / 11), Math.floor(y / 9), 1); // 大块的深浅
      const fine = hash(x, y, 2);                                    // 细碎颗粒
      const t = patch * 0.55 + fine * 0.45;
      const c = mix(TERRAIN.grassLight, TERRAIN.grassDark, t * 0.9);
      const i = (y * W + x) * 4;
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  // 撒一些草簇（深色两三根短竖线），打断大色块
  const rnd = makeRandom(20240607);
  for (let i = 0; i < 220; i++) {
    const x = Math.floor(rnd() * W);
    const y = Math.floor(rnd() * H);
    const tall = 1 + Math.floor(rnd() * 2);
    g.fillStyle = rgba(TERRAIN.grassEdge, 0.55 + rnd() * 0.3);
    g.fillRect(x, y, 1, tall);
    if (rnd() > 0.6) g.fillRect(x + 1, y + 1, 1, tall - 1);
  }

  // 少量亮色小草尖，增加层次
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rnd() * W);
    const y = Math.floor(rnd() * H);
    g.fillStyle = rgba(mix(TERRAIN.grassLight, [230, 240, 180], 0.5), 0.5);
    g.fillRect(x, y, 1, 1);
  }
}

/* --- 小径 --- */

function paintPaths(g) {
  // 下方横向主路
  g.fillStyle = rgb(TERRAIN.path);
  g.fillRect(0, PATH_Y - 8, W, 16);

  // 路面颗粒 + 边缘做旧，避免变成一块纯色长条
  const rnd = makeRandom(99991);
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(rnd() * W);
    const y = PATH_Y - 8 + Math.floor(rnd() * 16);
    g.fillStyle = rgba(TERRAIN.pathDark, 0.35 + rnd() * 0.4);
    g.fillRect(x, y, 1 + Math.floor(rnd() * 2), 1);
  }
  // 上下边缘各压一条深色，做出踩实的边界
  g.fillStyle = rgba(TERRAIN.grassEdge, 0.5);
  g.fillRect(0, PATH_Y - 8, W, 1);
  g.fillStyle = rgba(TERRAIN.pathDark, 0.5);
  g.fillRect(0, PATH_Y + 7, W, 1);

  // 每块田到主路的短连接
  PLOTS.forEach((pl) => {
    const cx = Math.round(pl.x + pl.w / 2);
    const top = pl.y + pl.h;
    const bottom = PATH_Y - 8;
    if (bottom <= top) return;
    g.fillStyle = rgb(TERRAIN.path);
    g.fillRect(cx - 6, top, 12, bottom - top);
    g.fillStyle = rgba(TERRAIN.pathDark, 0.4);
    for (let y = top + 2; y < bottom; y += 4) g.fillRect(cx - 6, y, 12, 1);
  });
}

/* --- 田地：会随浇水变色，逐帧画 --- */

/** 预生成的土块位置，避免每帧重新算随机 */
const CLODS = (() => {
  const rnd = makeRandom(13579);
  return PLOTS.map((pl) =>
    Array.from({ length: 90 }, () => ({
      x: pl.x + 2 + Math.floor(rnd() * (pl.w - 4)),
      y: pl.y + 2 + Math.floor(rnd() * (pl.h - 4)),
      w: 1 + Math.floor(rnd() * 2),
      h: 1,
      dark: rnd() > 0.45,
    }))
  );
})();

/**
 * 画一块田：土块 + 边缘阴影。
 * @param {object} pl  {x,y,w,h}
 * @param {boolean} wet 是否浇过水（土色更深）
 * @param {number} index 第几块田，用来取预生成的土块
 */
export function drawPlot(g, pl, wet, index = 0) {
  const base = wet ? TERRAIN.soilWet : TERRAIN.soilLight;
  const dark = wet ? mix(TERRAIN.soilWet, [0, 0, 0], 0.4) : TERRAIN.soilDark;

  g.fillStyle = rgb(base);
  g.fillRect(pl.x, pl.y, pl.w, pl.h);

  // 碎土块：深一块浅一块，看起来是翻过的地
  const clods = CLODS[index] || [];
  for (const c of clods) {
    g.fillStyle = rgba(c.dark ? dark : mix(base, [255, 240, 210], 0.28), c.dark ? 0.75 : 0.6);
    g.fillRect(c.x, c.y, c.w, c.h);
  }

  // 边缘：整圈压暗一条，做出田地陷下去的边界感
  g.fillStyle = rgba(dark, 0.75);
  g.fillRect(pl.x, pl.y, pl.w, 1);
  g.fillRect(pl.x, pl.y + pl.h - 1, pl.w, 1);
  g.fillRect(pl.x, pl.y, 1, pl.h);
  g.fillRect(pl.x + pl.w - 1, pl.y, 1, pl.h);
  // 上沿再压深一点，模拟土埂的阴影
  g.fillStyle = rgba(dark, 0.55);
  g.fillRect(pl.x + 1, pl.y + 1, pl.w - 2, 1);
}

/* --- 农舍 --- */

function paintHouse(g) {
  const { x, y, w, h } = HOUSE;
  const wallH = 7;

  // 落在地上的影子
  g.fillStyle = "rgba(40, 60, 30, 0.25)";
  g.fillRect(x + 3, y + h, w - 4, 4);

  // 屋前沿：一条木色门廊，比白墙自然
  g.fillStyle = rgb(TERRAIN.wood);
  g.fillRect(x, y + h - wallH, w, wallH);
  g.fillStyle = rgba([0, 0, 0], 0.22);
  g.fillRect(x, y + h - 1, w, 1);

  // 屋顶主体
  const roofH = h - wallH;
  g.fillStyle = rgb(TERRAIN.roofDark);
  g.fillRect(x, y, w, roofH);

  // 瓦片：一行行横向瓦，隔行错开半格，比规则条纹自然
  for (let row = 0, ty = y + 2; ty < y + roofH - 1; ty += 4, row++) {
    g.fillStyle = rgb(row % 2 ? TERRAIN.roofLight : mix(TERRAIN.roofLight, TERRAIN.roofDark, 0.3));
    g.fillRect(x + 1, ty, w - 2, 3);
    g.fillStyle = rgba([0, 0, 0], 0.18);
    g.fillRect(x + 1, ty + 3, w - 2, 1);
    // 瓦缝
    for (let sx = x + 1 + (row % 2 ? 3 : 6); sx < x + w - 2; sx += 6) {
      g.fillStyle = rgba([0, 0, 0], 0.14);
      g.fillRect(sx, ty, 1, 3);
    }
  }

  // 屋脊
  const ridgeX = x + Math.round(w / 2);
  g.fillStyle = rgb(mix(TERRAIN.roofLight, [255, 255, 255], 0.3));
  g.fillRect(ridgeX - 1, y + 1, 2, roofH - 2);
  g.fillStyle = rgba([0, 0, 0], 0.2);
  g.fillRect(ridgeX - 2, y + 1, 1, roofH - 2);

  // 屋檐外沿深色压边
  g.fillStyle = rgba([0, 0, 0], 0.32);
  g.fillRect(x, y, w, 2);
  g.fillRect(x, y, 2, roofH);
  g.fillRect(x + w - 2, y, 2, roofH);
  g.fillRect(x, y + roofH - 2, w, 2);

  // 烟囱
  g.fillStyle = rgb(TERRAIN.stone);
  g.fillRect(x + w - 12, y + 3, 6, 7);
  g.fillStyle = rgba([0, 0, 0], 0.35);
  g.fillRect(x + w - 12, y + 3, 6, 2);

  // 门 + 窗（窗子用暖米色，不要纯白）
  g.fillStyle = rgb(mix(TERRAIN.wood, [0, 0, 0], 0.35));
  g.fillRect(ridgeX - 4, y + h - wallH + 1, 8, wallH - 2);
  g.fillStyle = rgb(mix(TERRAIN.wall, [255, 240, 200], 0.35));
  g.fillRect(x + 7, y + h - wallH + 2, 4, 3);
  g.fillRect(x + w - 12, y + h - wallH + 2, 4, 3);
  g.fillStyle = rgba([0, 0, 0], 0.25);
  g.fillRect(x + 7, y + h - wallH + 5, 4, 1);
  g.fillRect(x + w - 12, y + h - wallH + 5, 4, 1);
}

/* --- 树与栅栏 --- */

/** 一棵从上方看的树：树冠分三层，带高光和落影 */
function paintTree(g, cx, cy, r) {
  // 落影（偏右下）
  g.fillStyle = "rgba(40, 60, 30, 0.22)";
  g.beginPath();
  g.arc(cx + 2, cy + 3, r, 0, Math.PI * 2);
  g.fill();

  // 外圈深绿
  g.fillStyle = rgb(TERRAIN.leafDark);
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();

  // 中间层
  g.fillStyle = rgb(TERRAIN.leafLight);
  g.beginPath();
  g.arc(cx - 0.5, cy - 0.5, r - 2, 0, Math.PI * 2);
  g.fill();

  // 高光（左上），让树冠有球面感
  g.fillStyle = rgba(mix(TERRAIN.leafLight, [255, 255, 220], 0.45), 0.85);
  g.beginPath();
  g.arc(cx - 2, cy - 2, Math.max(1, r - 4), 0, Math.PI * 2);
  g.fill();

  // 叶隙：几个深色小点，避免太像塑料球
  const rnd = makeRandom(Math.round(cx * 7 + cy * 13));
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * (r - 2);
    g.fillStyle = rgba(TERRAIN.leafDark, 0.7);
    g.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), 1, 1);
  }
}

function paintTrees(g) {
  paintTree(g, 288, 10, 9);
  paintTree(g, 306, 24, 7);
  paintTree(g, 270, 20, 6);
  paintTree(g, 252, 9, 5);
}

/** 农舍右侧的一小段木栅栏 */
function paintFence(g) {
  const y = 22;
  const x0 = 92;
  const x1 = 138;

  // 落影
  g.fillStyle = "rgba(40, 60, 30, 0.18)";
  g.fillRect(x0, y + 4, x1 - x0, 2);

  // 横杆两道
  g.fillStyle = rgb(TERRAIN.wood);
  g.fillRect(x0, y + 1, x1 - x0, 1);
  g.fillRect(x0, y + 3, x1 - x0, 1);

  // 立柱
  for (let x = x0; x < x1; x += 10) {
    g.fillStyle = rgb(mix(TERRAIN.wood, [0, 0, 0], 0.3));
    g.fillRect(x, y - 2, 2, 8);
    g.fillStyle = rgb(mix(TERRAIN.wood, [255, 255, 255], 0.18));
    g.fillRect(x, y - 2, 1, 7);
  }
}

/* --- 水井 --- */

function paintWell(g) {
  const { x, y, r } = WELL;

  g.fillStyle = "rgba(40, 60, 30, 0.22)";
  g.beginPath();
  g.arc(x + 1, y + 2, r, 0, Math.PI * 2);
  g.fill();

  // 石圈：外深内浅，看起来是垒起来的石头
  g.fillStyle = rgb(mix(TERRAIN.stone, [0, 0, 0], 0.3));
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = rgb(TERRAIN.stone);
  g.beginPath();
  g.arc(x, y, r - 1.5, 0, Math.PI * 2);
  g.fill();

  // 石缝
  const rnd = makeRandom(777);
  for (let i = 0; i < 8; i++) {
    const a = rnd() * Math.PI * 2;
    g.fillStyle = rgba(mix(TERRAIN.stone, [0, 0, 0], 0.45), 0.8);
    g.fillRect(Math.round(x + Math.cos(a) * (r - 1)), Math.round(y + Math.sin(a) * (r - 1)), 2, 1);
  }

  // 井水
  g.fillStyle = rgb([38, 54, 66]);
  g.beginPath();
  g.arc(x, y, r - 5, 0, Math.PI * 2);
  g.fill();

  // 水面反光
  g.fillStyle = rgba([150, 200, 220], 0.5);
  g.fillRect(x - 3, y - 2, 3, 1);
  g.fillRect(x + 1, y + 1, 2, 1);
}

/* --- 静态图层：只渲染一次 --- */

let staticLayer = null;

/** 取得预渲染好的场景图层（草地 + 小径 + 房子 + 树 + 栅栏 + 水井） */
export function getStaticLayer() {
  if (staticLayer) return staticLayer;

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;

  paintGrass(g);
  paintPaths(g);
  paintHouse(g);
  paintTrees(g);
  paintFence(g);
  paintWell(g);

  staticLayer = c;
  return c;
}

/** 清掉缓存（主题/尺寸变了才需要，正常不用管） */
export function resetStaticLayer() {
  staticLayer = null;
}
