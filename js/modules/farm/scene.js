/* ============ scene.js · 动画主循环：推进时间轴、按顺序绘制 ============ */
/* 尺寸与节奏在 constants / 农民在 sprites / 场景在 scenery / 作物在 entities */
import {
  CANVAS,
  CYCLE,
  PATH_Y,
  PHASE_LABEL,
  PHASE_SEGS,
  PLOTS,
  PLOT_GRID,
  START_AT,
} from "./constants.js";
import { drawFarmer } from "./sprites.js";
import { drawPlot, getStaticLayer } from "./scenery.js";
import {
  drawParticles,
  drawPlant,
  spawnParticles,
  updateParticles,
} from "./entities.js";

const { W, H } = CANVAS;

/* --- 农民动作参数。改这些调手感 --- */
const ACTION = {
  walkRatio: 0.45,        // 每株作物：前 45% 走过去，后 55% 干活
  walkPhasePerAction: 1,  // 走动相位，1 = 两步。调大 = 迈步更快
  bendMax: 1,             // 弯腰幅度
  walkPhaseEnter: 1.5,    // 进场/退场的走动相位
  groundY: PATH_Y + 8,    // 农民脚底 y。改 +8 让农民站高/站低
  watchX: 296,            // 生长阶段农民站的位置
};

/* --- 动手时刻，占该株动作时间的比例。改这些调什么时候种/浇/割 --- */
const TRIGGER = {
  plant: 0.5,
  waterStart: 0.15,
  waterEnd: 0.9,
  harvest: 0.45,
};

/* 生长速度：base 基础速度 + ramp 随阶段进度加速 */
const GROW_SPEED = { base: 0.62, ramp: 0.5 };
/* 浇水时推进成长度的上限与速度 */
const WATER_GROW = { cap: 0.62, speed: 0.5 };

/* 作物位置由 PLOTS 与 PLOT_GRID 算出 */
function buildPlants() {
  const list = [];
  PLOTS.forEach((pl, plotIndex) => {
    for (let r = 0; r < PLOT_GRID.rows; r++) {
      for (let c = 0; c < PLOT_GRID.cols; c++) {
        list.push({
          plot: plotIndex,
          x: Math.round(pl.x + 11 + (c * (pl.w - 22)) / (PLOT_GRID.cols - 1)),
          y: Math.round(pl.y + 11 + (r * (pl.h - 22)) / (PLOT_GRID.rows - 1)),
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

/* 天色系数：0 = 夜里，1 = 白天。只用于最后压暗的强度 */
function daylight(t) {
  const nightStart = CYCLE - PHASE_SEGS[PHASE_SEGS.length - 1][1];
  if (t < 2) return 0.4 + (t / 2) * 0.6;              // 天亮
  if (t < nightStart) return 1;                        // 整个白天
  const nightLen = CYCLE - nightStart;
  return Math.max(0.25, 1 - ((t - nightStart) / nightLen) * 0.75); // 天黑
}

/* --- 入口 --- */

/**
 * 启动农田动画
 * @param {HTMLCanvasElement} canvas
 * @param {{startAt?: number}} [opts] 从周期第几秒开始
 * @returns {() => void} 销毁函数
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
  /** 每块田是否浇过水（浇水后土色变深） */
  let wetPlots = PLOTS.map(() => false);
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
    wetPlots = PLOTS.map(() => false);
    particles = [];
  }

  /** 从周期中间开始播放时，按起始时刻补齐田地状态 */
  function seedStateFor(time) {
    const b = phaseBounds();
    const growDur = PHASE_SEGS.find(([n]) => n === "grow")[1];
    const harvestDur = PHASE_SEGS.find(([n]) => n === "harvest")[1];

    if (time < b.plant) return;
    for (let i = 0; i < TOTAL; i++) planted[i] = true;

    if (time < b.water) {
      growth.fill(0.05);
    } else if (time < b.grow) {
      const k = (time - b.water) / growDur;
      const base = 0.62 + k * 0.38;
      for (let i = 0; i < TOTAL; i++) growth[i] = Math.min(1, base - (i % 3) * 0.12);
    } else {
      growth.fill(1);
    }

    // 浇过水的地块颜色变深
    if (time >= b.water) wetPlots = PLOTS.map(() => true);

    if (time >= b.harvest) {
      harvested.fill(true);
    } else if (time >= b.grow) {
      const k = (time - b.grow) / harvestDur;
      const done = Math.floor(k * TOTAL);
      for (let i = 0; i < done; i++) harvested[i] = true;
    }
  }

  /** 调试信息挂到 canvas 上 */
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

  /** 这一帧农民的位置与状态，返回 null 表示不画 */
  function farmerFrame(ph, dt) {
    const walkRatio = ACTION.walkRatio;

    if (ph.name === "dawn") {
      // 从左边界走上小径
      return {
        x: -20 + ph.p * 60,
        y: ACTION.groundY,
        dir: "right",
        walk: ph.p * ACTION.walkPhaseEnter,
        tool: "",
        bend: 0,
      };
    }

    if (ph.name === "night") {
      // 收工往右走出画面
      return {
        x: 240 + ph.p * (W - 200),
        y: ACTION.groundY,
        dir: "right",
        walk: ph.p,
        tool: "",
        bend: 0,
      };
    }

    if (ph.name === "grow") {
      // 站在田边看着作物长
      for (let i = 0; i < TOTAL; i++) {
        if (planted[i] && !harvested[i]) {
          growth[i] = Math.min(1, growth[i] + dt * (GROW_SPEED.base + ph.p * GROW_SPEED.ramp));
        }
      }
      return {
        x: ACTION.watchX,
        y: ACTION.groundY,
        dir: "up",
        walk: null,
        tool: "",
        bend: 0,
      };
    }

    // 播种 / 浇水 / 收割：依次走到每株作物下方
    const idxF = ph.p * TOTAL;
    const i = Math.min(TOTAL - 1, Math.floor(idxF));
    const sub = idxF - i;
    const target = PLANTS[i];
    const prevX = i === 0 ? -20 : PLANTS[i - 1].x;
    const tool = ph.name === "water" ? "can" : ph.name === "harvest" ? "" : "hoe";

    // 前半段走过去
    if (sub < walkRatio) {
      const k = sub / walkRatio;
      const dx = target.x - prevX;
      return {
        x: prevX + dx * k,
        y: ACTION.groundY,
        dir: dx >= 0 ? "right" : "left",
        walk: k * ACTION.walkPhasePerAction,
        tool,
        bend: 0,
      };
    }

    // 后半段停下来干活：面向田里（朝上），先弯腰再直起来
    const k = (sub - walkRatio) / (1 - walkRatio);
    const bend = k < 0.5 ? k * 2 * ACTION.bendMax : (1 - k) * 2 * ACTION.bendMax;

    if (ph.name === "plant" && !planted[i] && k > TRIGGER.plant) {
      planted[i] = true;
      spawnParticles(particles, target.x, target.y, 4, "dust");
    }
    if (ph.name === "water") {
      wetPlots[target.plot] = true;
      if (k > TRIGGER.waterStart && k < TRIGGER.waterEnd) {
        spawnParticles(particles, target.x, target.y - 2, 2, "drop");
      }
      if (planted[i]) {
        growth[i] = Math.min(WATER_GROW.cap, growth[i] + dt * WATER_GROW.speed);
      }
    }
    if (ph.name === "harvest" && k > TRIGGER.harvest && !harvested[i]) {
      harvested[i] = true;
      spawnParticles(particles, target.x, target.y, 7, "chaff");
    }

    return {
      x: target.x,
      y: ACTION.groundY,
      dir: "up",
      walk: null,
      tool,
      bend,
    };
  }

  /** 画一帧，返回当前阶段名 */
  function draw(dt) {
    const dl = daylight(t);
    const ph = phaseAt(t);

    if (ph.name !== lastPhase) {
      if (ph.name === "dawn") resetField();
      lastPhase = ph.name;
    }

    /* 静态场景 */
    ctx.drawImage(getStaticLayer(), 0, 0);

    /* 田地 */
    PLOTS.forEach((pl, idx) => drawPlot(ctx, pl, wetPlots[idx], idx));

    /* 作物 */
    for (let i = 0; i < TOTAL; i++) {
      if (!planted[i] || harvested[i]) continue;
      drawPlant(ctx, PLANTS[i].x, PLANTS[i].y, growth[i], i);
    }

    /* 农民 */
    const farmer = farmerFrame(ph, dt);
    if (farmer) {
      drawFarmer(ctx, farmer.x, farmer.y, farmer.dir, farmer.walk, farmer.tool, farmer.bend);
    }

    updateParticles(particles, dt);
    drawParticles(ctx, particles);

    /* 昼夜色调 */
    // 整体压暗表现时间
    if (dl < 1) {
      const dark = (1 - dl) * 0.55;
      ctx.fillStyle = `rgba(24, 32, 62, ${dark.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // 清晨加一点暖色
    if (ph.name === "dawn") {
      ctx.fillStyle = `rgba(255, 196, 120, ${(0.18 * (1 - ph.p)).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }

    return ph.name;
  }

  function frame(now) {
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    t = (t + dt) % CYCLE;

    const phase = draw(dt);
    if (labelEl) labelEl.textContent = PHASE_LABEL[phase] || "";
    if (progressEl) progressEl.style.width = ((t / CYCLE) * 100).toFixed(1) + "%";
    publishDebug(phase);

    raf = requestAnimationFrame(frame);
  }

  // 减少动效：只画一帧
  if (reduceMotion) {
    seedStateFor(START_AT);
    lastPhase = phaseAt(START_AT).name;
    draw(0);
    return () => {};
  }

  seedStateFor(t);
  lastPhase = phaseAt(t).name;
  raf = requestAnimationFrame(frame);

  // 切到后台时暂停
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
