/* ============ constants.js · 农田动画的可调参数 ============ */

/* 画布尺寸。改这里要同步改 css/home.css 里 .farm-showcase 的 aspect-ratio */
export const CANVAS = { W: 320, H: 96 };

/* 格子边长 */
export const TILE = 16;

/*
 * 时间轴：每项 [阶段名, 持续秒数]，合计为一个周期（当前 23 秒）。
 * 改秒数就是改节奏；增删项可加新阶段（记得在 PHASE_LABEL 里补文字）。
 */
export const PHASE_SEGS = [
  ["dawn", 2.0],
  ["plant", 4.0],
  ["water", 4.0],
  ["grow", 5.0],
  ["harvest", 6.0],
  ["night", 2.0],
];

/* 一个完整周期的秒数（自动算出，不用改） */
export const CYCLE = PHASE_SEGS.reduce((sum, [, dur]) => sum + dur, 0);

/* 主页进入时从周期第几秒开始播。改这里调整一进来看到哪一幕 */
export const START_AT = 7.5;

/* 各阶段显示在画面上的文字。改这里换文案 */
export const PHASE_LABEL = {
  dawn: "清晨 · 准备下地",
  plant: "播种",
  water: "浇水",
  grow: "生长",
  harvest: "收割",
  night: "天黑 · 收工",
};

/*
 * 场景纵向布局：y 0~30 农舍与树，y 30~74 三块田，y 74~96 小径。
 * 改下面各组数值就是挪动元素的位置。
 */

/* 三块田的位置与大小。改 x/y 挪位置，改 w/h 改大小 */
export const PLOTS = [
  { x: 8, y: 30, w: 88, h: 44 },
  { x: 116, y: 30, w: 88, h: 44 },
  { x: 224, y: 30, w: 88, h: 44 },
];

/* 每块田的作物列数与行数。改这里改株数（当前 4×3，三块共 36 株） */
export const PLOT_GRID = { cols: 4, rows: 3 };

/* 小径中心线 y。改这里让农民站得高一点或低一点 */
export const PATH_Y = 84;

/* 农舍位置与大小 */
export const HOUSE = { x: 4, y: 2, w: 46, h: 26 };

/* 水井圆心与半径 */
export const WELL = { x: 74, y: 12, r: 8 };

/* 农民配色。键名对应 sprites.js 字符画里的字符，换成别的颜色就改值 */
export const PALETTE = {
  k: "#2b2f2a",   // 描边
  h: "#e3b34a",   // 草帽亮
  H: "#b8892f",   // 草帽暗
  b: "#8f6a22",   // 帽带
  s: "#f8d3b0",   // 皮肤
  S: "#e0b28c",   // 皮肤暗
  a: "#6b5238",   // 头发
  A: "#4a3826",   // 头发暗
  g: "#568f7b",   // 上衣亮
  G: "#3f6d5e",   // 上衣暗
  j: "#4a6f92",   // 背带裤
  J: "#3b5a78",   // 背带裤暗
  o: "#6b4a33",   // 靴子 / 木柄
  w: "#7fc7de",   // 水
  m: "#9aa3a8",   // 金属
  e: "#33261c",   // 眼睛
};

/* 地形配色（草、土、小径、房顶、树叶…）。改这里整体换色调 */
export const TERRAIN = {
  grassLight: [126, 158, 86],
  grassDark: [104, 138, 70],
  grassEdge: [88, 120, 60],

  soilLight: [132, 96, 62],
  soilDark: [104, 74, 46],
  soilWet: [86, 60, 38],

  path: [196, 176, 138],
  pathDark: [172, 152, 116],

  roofLight: [170, 86, 72],
  roofDark: [134, 62, 52],
  wall: [214, 198, 168],

  wood: [138, 104, 66],
  leafLight: [92, 148, 72],
  leafDark: [64, 112, 52],
  stone: [150, 146, 138],
};
