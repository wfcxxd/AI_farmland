/* ============ home.js · 主页仪表盘：指标 / 告警 / 传感器状态 ============ */
import { initFarmScene } from "./farm/scene.js";
import { fetchSensorData, NETWORK_CONFIG } from "./config.js";
import { getThresholds, getRefreshIntervalMs } from "./settings.js";
import { MSG } from "../common/messages.js";
import { setText } from "../common/ui.js";

let homeTimer = null;
let disposeFarmScene = null;
let started = false;

/** 最新一次拉到的全部读数 */
let allReadings = [];

/** 四个指标的展示配置，图表页和主页共用同一套字段名 */
const METRICS = [
  { key: "temperature", label: "温度", unit: "℃", digits: 1 },
  { key: "humidity", label: "湿度", unit: "%", digits: 1 },
  { key: "soil_moisture", label: "土壤湿度", unit: "%", digits: 1 },
  { key: "light", label: "光照", unit: "lx", digits: 0 },
];

export function showHome(container) {
  const blur = container.querySelector('.blur-layer');
  if (blur) blur.remove();

  container.insertAdjacentHTML(
    "beforeend",
    `
    <!-- 农田动态展示区：像素风农事动画 -->
    <section class="farm-showcase" aria-label="农田动态展示">
      <canvas class="farm-canvas"></canvas>
      <div class="farm-overlay">
        <span class="farm-badge">实时农事</span>
        <span class="farm-caption">清晨 · 准备下地</span>
      </div>
      <div class="farm-progress-track"><div class="farm-progress"></div></div>
    </section>

    <div class="home-grid">
      <section class="home-block block-1">
        <h3>整体环境</h3>
        <p class="block-sub" id="summaryMeta">${MSG.loadingDash}</p>
        <div class="metric-grid" id="metricGrid"></div>
      </section>

      <section class="home-block block-2" id="alarmBlock">
        <h3>阈值告警</h3>
        <p class="block-sub" id="thresholdHint">—</p>
        <div class="alarm-list" id="alarmList">
          <p class="alarm-none">${MSG.loadingAlarm}</p>
        </div>
      </section>

      <section class="home-block block-3">
        <h3>传感器状态</h3>
        <p class="block-sub" id="sensorMeta">—</p>
        <div class="sensor-list" id="sensorList"></div>
      </section>
    </div>
    `
  );

  // 启动像素动画。重复进入时先销毁上一实例，避免叠加多个 requestAnimationFrame
  if (disposeFarmScene) disposeFarmScene();
  // 从周期中段（作物正在长起来）开始，一进主页就是有内容的画面
  disposeFarmScene = initFarmScene(container.querySelector(".farm-canvas"), { startAt: 7.5 });

  started = false;
  refreshDashboard();
}

export function startHomeAutoRefresh() {
  if (homeTimer) return;
  // 用「设置」页里的刷新间隔
  // 刷新间隔取自设置页；这里 5000 是最小间隔（毫秒），改它限制最快刷新频率
  const ms = Math.max(5000, getRefreshIntervalMs());
  homeTimer = setInterval(refreshDashboard, ms);
}

export function stopHomeAutoRefresh() {
  if (homeTimer) {
    clearInterval(homeTimer);
    homeTimer = null;
  }
  if (disposeFarmScene) {
    disposeFarmScene();
    disposeFarmScene = null;
  }
}

/* ------------------------------------------------------------------
 * 数据与渲染
 * ------------------------------------------------------------------ */

async function refreshDashboard() {
  try {
    // 和图表页/历史页共用同一个取数函数，自动带上 limit 与返回格式兼容
    const data = await fetchSensorData(NETWORK_CONFIG.chartLimit);
    allReadings = data;
    render(data);
  } catch (err) {
    renderError(err.message);
  }
}

/** 取每个传感器最新的一条读数 */
function latestPerSensor(data) {
  const byId = new Map();
  for (const r of data) {
    const id = r.sensor_id || r.sensor_name;
    if (!id) continue;
    const cur = byId.get(id);
    const ts = new Date(r.timestamp || r.time).getTime();
    if (!cur || ts > cur.ts) byId.set(id, { ts, row: r });
  }
  return [...byId.entries()]
    .map(([id, v]) => ({ id, ...v.row, ts: v.ts }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id), "zh-CN"));
}

const num = (v, d = 1) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(d) : "—";
};

function render(data) {
  const latest = latestPerSensor(data);
  const th = getThresholds();

  if (latest.length === 0) {
    setText(document.getElementById("summaryMeta"), MSG.noSensorAtAll);
    document.getElementById("metricGrid").innerHTML = "";
    document.getElementById("alarmList").innerHTML =
      `<p class="alarm-none">${MSG.noAlarmData}</p>`;
    document.getElementById("sensorList").innerHTML = "";
    setText(document.getElementById("thresholdHint"), "—");
    return;
  }

  /* --- 区块一：整体环境（各指标平均值） --- */
  const avg = {};
  for (const m of METRICS) {
    const vals = latest.map((r) => Number(r[m.key])).filter(Number.isFinite);
    avg[m.key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
  }

  document.getElementById("summaryMeta").textContent =
    `共 ${latest.length} 个传感器 · 更新于 ${new Date().toLocaleTimeString("zh-CN")}`;

  document.getElementById("metricGrid").innerHTML = METRICS.map((m) => {
    const v = avg[m.key];
    const alarm =
      (m.key === "temperature" && Number.isFinite(v) && v > th.temp) ||
      (m.key === "humidity" && Number.isFinite(v) && v < th.hum);
    return `
      <div class="metric${alarm ? " metric-alarm" : ""}">
        <span class="metric-label">${m.label}</span>
        <span class="metric-value">${num(v, m.digits)}<em>${m.unit}</em></span>
      </div>`;
  }).join("");

  /* --- 区块二：阈值告警 --- */
  document.getElementById("thresholdHint").textContent =
    `温度 > ${th.temp}℃ 或 湿度 < ${th.hum}%（可在设置页修改）`;

  const alarms = [];
  for (const r of latest) {
    const t = Number(r.temperature);
    const h = Number(r.humidity);
    if (Number.isFinite(t) && t > th.temp) {
      alarms.push({ id: r.id, kind: "high", label: "温度过高", value: `${num(t, 1)}℃`, limit: `阈值 ${th.temp}℃` });
    }
    if (Number.isFinite(h) && h < th.hum) {
      alarms.push({ id: r.id, kind: "low", label: "湿度偏低", value: `${num(h, 1)}%`, limit: `阈值 ${th.hum}%` });
    }
  }

  const alarmBlock = document.getElementById("alarmBlock");
  if (alarms.length === 0) {
    alarmBlock.classList.remove("has-alarm");
    document.getElementById("alarmList").innerHTML =
      `<p class="alarm-none ok">${MSG.allNormal}</p>`;
  } else {
    alarmBlock.classList.add("has-alarm");
    document.getElementById("alarmList").innerHTML = alarms
      .slice(0, 6)   // 最多显示 6 条告警，改这个数调整条数
      .map(
        (a) => `
      <div class="alarm-item ${a.kind}">
        <span class="alarm-dot"></span>
        <span class="alarm-sensor">${a.id}</span>
        <span class="alarm-text">${a.label}</span>
        <span class="alarm-value">${a.value}</span>
        <span class="alarm-limit">${a.limit}</span>
      </div>`
      )
      .join("");
    if (alarms.length > 6) {
      document.getElementById("alarmList").insertAdjacentHTML(
        "beforeend",
        `<p class="alarm-more">另有 ${alarms.length - 6} 条告警…</p>`
      );
    }
  }

  /* --- 区块三：传感器状态 --- */
  document.getElementById("sensorMeta").textContent =
    `${latest.length} 个节点在线 · 按最新读数排序`;

  document.getElementById("sensorList").innerHTML = latest
    .map((r) => {
      const t = Number(r.temperature);
      const h = Number(r.humidity);
      const tAlarm = Number.isFinite(t) && t > th.temp;
      const hAlarm = Number.isFinite(h) && h < th.hum;
      const state = tAlarm || hAlarm ? "warn" : "ok";
      const stateText = state === "warn" ? "异常" : "正常";
      return `
      <div class="sensor-row ${state}">
        <span class="sensor-name">${r.id}</span>
        <span class="sensor-vals">
          <span${tAlarm ? ' class="hot"' : ""}>${num(t, 1)}℃</span>
          <span${hAlarm ? ' class="cold"' : ""}>${num(h, 1)}%</span>
          <span>${num(r.soil_moisture, 1)}%</span>
        </span>
        <span class="sensor-state">${stateText}</span>
      </div>`;
    })
    .join("");
}

/** 取数失败时把三个区块都置成「失败」状态，避免页面停在旧数据上 */
function renderError(msg) {
  const reason = MSG.fetchFailed(msg);

  // 清空数值区
  setText(document.getElementById("metricGrid"), "");
  setText(document.getElementById("sensorList"), "");

  // 文字区标记失败
  setText(document.getElementById("summaryMeta"), reason);
  setText(document.getElementById("sensorMeta"), "—");
  setText(document.getElementById("thresholdHint"), "—");

  const alarmList = document.getElementById("alarmList");
  if (alarmList) alarmList.innerHTML = `<p class="alarm-none err">${reason}</p>`;
}
