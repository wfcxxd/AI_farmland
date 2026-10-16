/**
 * 农田动画入口：时间轴推进 + 把各个部分按顺序画出来。
 *
 * 分工：
 *   constants.js  尺寸、节奏、配色、田地布局
 *   sprites.js    农民（部件拼装）
 *   scenery.js    天空、山、田、农舍、风车…
 *   entities.js   作物、粒子
 *   本文件         串起来：每个阶段农民在干什么、什么时候种/浇/收
 */
import {
  CANVAS,
  CYCLE,
  GROUND_Y,
  PHASE_LABEL,
  PHASE_SEGS,
  PLOTS,
  PLOT_GRID,
  START_AT,
} from "./constants.js";
import { drawFarmer } from "./sprites.js";
import {
  drawBirds,
  drawClouds,
  drawFence,
  drawGround,
  drawHills,
  drawHouse,
  drawPlot,
  drawStars,
  drawSunMoon,
  drawWell,
  drawWindmill,
  makeSky,
} from "./scenery.js";
import {
  drawParticles,
  drawPlant,
  spawnParticles,
  updateParticles,
} from "./entities.js";

const { W, H } = CANVAS;

/* ---------------------------------------------------------------
 * 农民的行动参数
 * 这些数字决定「走路占多少时间」「在每株作物前停多久」等手感，
 * 觉得动作太快或太慢就调这里。
 * --------------------------------------------------------------- */
const ACTION = {
  /** 每个作物分到的时间段里，前 50% 用来走过去，后 50% 停下来干活 */
  walkRatio: 0.5,
  /** 每株之间走动的相位：1 = 一个来回（两步）。调大就是腿倒腾更快 */
  walkPhasePerAction: 1,
  /** 弯腰幅度：0 站着，1 完全弯下 */
  bendMax: 1,
  /** 进场/退场时的走动相位 */
  walkPhaseEnter: 1.5,
  /** 生长阶段农民站在这个位置看着 */
  watchX: W - 40,
};

/** 各阶段在作物上「动手」的时刻（占该株动作时间的比例，0~1） */
const TRIGGER = {
  plant: 0.5,      // 过了一半才把种子种下
  waterStart: 0.2, // 这段区间内持续洒水
  waterEnd: 0.85,
  harvest: 0.4,    // 过了就割下来了
};

/** 生长阶段的速度：基础值 + 随阶段进度加速 */
const GROW_SPEED = { base: 0.62, ramp: 0.5 };
/** 浇水阶段顺手推进的成长度上限与速度 */
const WATER_GROW = { cap: 0.62, speed: 0.5 };

/** 作物位置：三块田 × 每块 4 列 3 行 */
function buildPlants() {
  const list = [];
  PLOTS.forEach((pl, plotIndex) => {
    for (let r = 0; r < PLOT_GRID.rows; r++) {
      for (let c = 0; c < PLOT_GRID.cols; c++) {
        list.push({
          plot: plotIndex,
          x: Math.round(pl.x + 11 + (c * (pl.w - 22)) / (PLOT_GRID.cols - 1)),
          y: Math.round(pl.y + 9 + (r * (pl.h - 14)) / (PLOT_GRID.rows - 1)),
        });
      }
    }
  });
  return list;
}

const PLANTS = buildPlants();

/** 各阶段的结束时刻，形如 { dawn: 2, plant: 6, ... } */
function phaseBounds() {
  let acc = 0;
  const b = {};
  for (const [name, dur] of PHASE_SEGS) {
    acc += dur;
    b[name] = acc;
  }
  return b;
}

/** 当前处于哪个阶段、该阶段进度 p（0~1） */
function phaseAt(t) {
  let acc = 0;
  for (const [name, dur] of PHASE_SEGS) {
    if (t < acc + dur) return { name, p: (t - acc) / dur, t };
    acc += dur;
  }
  return { name: PHASE_SEGS[PHASE_SEGS.length - 1][0], p: 1, t };
}

/**
 * 天亮程度：0 = 深夜，1 = 正午。
 * 日出后线性变亮，白天走正弦曲线，入夜再压下去。
 */
function daylight(t) {
  const nightStart = CYCLE - PHASE_SEGS[PHASE_SEGS.length - 1][1];
  if (t < 2) return 0.15 + (t / 2) * 0.45;
  if (t < nightStart) return 0.6 + 0.4 * Math.sin(((t - 2) / (nightStart - 2)) * Math.PI);
  const nightLen = CYCLE - nightStart;
  return Math.max(0.15, 1 - ((t - nightStart) / nightLen) * 0.85);
}

/* ---------------------------------------------------------------
 * 入口
 * --------------------------------------------------------------- */

/**
 * 启动农田动画
 *
 * @param {HTMLCanvasElement} canvas 展示用画布
 * @param {{startAt?: number}} [opts] startAt：从周期第几秒开始，默认 START_AT
 * @returns {() => void} 销毁函数（切页面时调用，停掉动画循环）
 */
export function initFarmScene(canvas, opts = {}) {
  if (!canvas) return () => {};

  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;
  ctx.imageSmoothingEnabled = false;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const startAt = Number.isFinite(Number(opts.startAt)) ? Number(opts.startAt) : START_AT;

  const TOTAL = PLANTS.length;
  let planted = new Array(TOTAL).fill(false);
  let growth = new Array(TOTAL).fill(0);
  let harvested = new Array(TOTAL).fill(false);
  let particles = [];
  let lastPhase = "";
  let t = startAt;
  let raf = 0;
  let last = 0;

  const labelEl = canvas.parentElement.querySelector(".farm-caption");
  const progressEl = canvas.parentElement.querySelector(".farm-progress");

  function resetField() {
    planted = new Array(TOTAL).fill(false);
    growth = new Array(TOTAL).fill(0);
    harvested = new Array(TOTAL).fill(false);
    particles = [];
  }

  /**
   * 从周期中间开始播放时，田里不能是空的
   * （否则直接跳到「生长」阶段会看到一片光秃秃的土地）。
   * 按起始时刻把地里状态补上：该种的种下、该长到的长到、该收的收掉。
   */
  function seedStateFor(time) {
    const b = phaseBounds();
    const growDur = PHASE_SEGS.find(([n]) => n === "grow")[1];
    const harvestDur = PHASE_SEGS.find(([n]) => n === "harvest")[1];

    if (time < b.plant) return;                       // 还没到播种，保持空地
    for (let i = 0; i < TOTAL; i++) planted[i] = true;

    if (time < b.water) {
      growth.fill(0.05);                              // 刚种下
    } else if (time < b.grow) {
      // 浇水途中：越往后长得越高，并按株错开一点显得自然
      const k = (time - b.water) / growDur;
      const base = 0.62 + k * 0.38;
      for (let i = 0; i < TOTAL; i++) growth[i] = Math.min(1, base - (i % 3) * 0.12);
    } else {
      growth.fill(1);                                 // 已成熟
    }

    if (time >= b.harvest) {
      harvested.fill(true);
    } else if (time >= b.grow) {
      // 收割进行到哪儿了，和动画里的节奏保持一致
      const k = (time - b.grow) / harvestDur;
      const done = Math.floor(k * TOTAL);
      for (let i = 0; i < done; i++) harvested[i] = true;
    }
  }

  /** 调试信息挂到 canvas 上，方便排查（也便于以后接真实数据） */
  function publishDebug(phase) {
    canvas.__farmDebug = {
      t: Number(t.toFixed(2)),
      phase,
      planted: planted.filter(Boolean).length,
      harvested: harvested.filter(Boolean).length,
      maxGrowth: Number(Math.max(...growth).toFixed(2)),
      frames: (canvas.__farmDebug ? canvas.__farmDebug.frames : 0) + 1,
    };
  }

  /**
   * 算出这一帧农民在哪、在干什么。
   * 返回 null 表示这一帧不画农民。
   */
  function farmerFrame(ph, dt) {
    const walkRatio = ACTION.walkRatio;

    if (ph.name === "dawn") {
      // 从左边界走进田里
      return {
        x: -20 + ph.p * 46,
        y: GROUND_Y,
        dir: 1,
        walk: ph.p * ACTION.walkPhaseEnter,
        tool: "",
        bend: 0,
      };
    }

    if (ph.name === "night") {
      // 收工往左走出画面
      return {
        x: ACTION.watchX - ph.p * (W + 30),
        y: GROUND_Y,
        dir: -1,
        walk: ph.p,
        tool: "",
        bend: 0,
      };
    }

    if (ph.name === "grow") {
      // 站在田边看着作物长，轻微上下浮动
      for (let i = 0; i < TOTAL; i++) {
        if (planted[i] && !harvested[i]) {
          growth[i] = Math.min(1, growth[i] + dt * (GROW_SPEED.base + ph.p * GROW_SPEED.ramp));
        }
      }
      const bob = Math.sin(t * 1.4) * 0.6;
      return { x: ACTION.watchX, y: GROUND_Y + bob, dir: -1, walk: null, tool: "", bend: 0 };
    }

    // 播种 / 浇水 / 收割：依次走到每株作物前
    const idxF = ph.p * TOTAL;
    const i = Math.min(TOTAL - 1, Math.floor(idxF));
    const sub = idxF - i;                 // 在这一株上的进度 0~1
    const target = PLANTS[i];
    const prevX = i === 0 ? -20 : PLANTS[i - 1].x;
    const tool = ph.name === "water" ? "can" : ph.name === "harvest" ? "" : "hoe";

    // 前半段走过去
    if (sub < walkRatio) {
      const k = sub / walkRatio;
      return {
        x: prevX + (target.x - prevX) * k,
        y: GROUND_Y,
        dir: 1,
        walk: k * ACTION.walkPhasePerAction,
        tool,
        bend: 0,
      };
    }

    // 后半段停下来干活（先弯腰再直起来）
    const k = (sub - walkRatio) / (1 - walkRatio);
    const bend = k < 0.5 ? k * 2 * ACTION.bendMax : (1 - k) * 2 * ACTION.bendMax;

    if (ph.name === "plant" && !planted[i] && k > TRIGGER.plant) {
      planted[i] = true;
      spawnParticles(particles, target.x, GROUND_Y - 8, 4, "dust");
    }
    if (ph.name === "water") {
      if (k > TRIGGER.waterStart && k < TRIGGER.waterEnd) {
        spawnParticles(particles, target.x + 12, GROUND_Y - 14, 2, "drop");
      }
      if (planted[i]) {
        growth[i] = Math.min(WATER_GROW.cap, growth[i] + dt * WATER_GROW.speed);
      }
    }
    if (ph.name === "harvest" && k > TRIGGER.harvest && !harvested[i]) {
      harvested[i] = true;
      spawnParticles(particles, target.x, GROUND_Y - 16, 7, "chaff");
    }

    return { x: target.x, y: GROUND_Y, dir: 1, walk: null, tool, bend };
  }

  /** 画一帧，返回当前阶段名 */
  function draw(dt) {
    const dl = daylight(t);
    const ph = phaseAt(t);

    // 进入日出阶段时清空田地，准备下一轮
    if (ph.name !== lastPhase) {
      if (ph.name === "dawn") resetField();
      lastPhase = ph.name;
    }

    /* --- 背景，按远近顺序画 --- */
    makeSky(ctx, dl);
    drawStars(ctx, t, dl);
    drawSunMoon(ctx, t, dl);
    if (dl > 0.3) drawClouds(ctx, t);
    if (dl > 0.4) drawBirds(ctx, t);
    drawWindmill(ctx, t, dl);
    drawHills(ctx, dl);
    drawHouse(ctx, dl);
    drawGround(ctx, dl);
    drawFence(ctx, dl);
    PLOTS.forEach((pl) => drawPlot(ctx, pl, dl));

    /* --- 主体 --- */
    const farmer = farmerFrame(ph, dt);

    for (let i = 0; i < TOTAL; i++) {
      if (!planted[i] || harvested[i]) continue;
      drawPlant(ctx, PLANTS[i].x, PLANTS[i].y, growth[i]);
    }

    if (farmer) {
      drawFarmer(ctx, farmer.x, farmer.y, farmer.dir, farmer.walk, farmer.tool, farmer.bend);
    }

    // 水井画在农民之后，遮住脚下的接缝
    drawWell(ctx, dl);

    updateParticles(particles, dt);
    drawParticles(ctx, particles);

    // 入夜整体压暗
    if (dl < 0.5) {
      ctx.fillStyle = `rgba(12,18,38,${((0.5 - dl) * 0.9).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }

    return ph.name;
  }

  function frame(now) {
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;              // 标签页切回来时别一次跳太多
    t = (t + dt) % CYCLE;

    const phase = draw(dt);
    if (labelEl) labelEl.textContent = PHASE_LABEL[phase] || "";
    if (progressEl) progressEl.style.width = ((t / CYCLE) * 100).toFixed(1) + "%";
    publishDebug(phase);

    raf = requestAnimationFrame(frame);
  }

  // 系统设置了「减少动效」：只画一帧静态画面，不起循环
  if (reduceMotion) {
    seedStateFor(START_AT);
    lastPhase = phaseAt(START_AT).name;
    draw(0);
    return () => {};
  }

  // 从周期中段开始，一进主页就是有长势的画面
  seedStateFor(t);
  lastPhase = phaseAt(t).name;
  raf = requestAnimationFrame(frame);

  // 页面切到后台时暂停，省电
  function onVisibilityChange() {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    cancelAnimationFrame(raf);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
