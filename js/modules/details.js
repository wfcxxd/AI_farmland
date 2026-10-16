import { fetchSensorData, NETWORK_CONFIG } from "./config.js";
import { THEME_EVENT } from "../common/theme.js";
import { getThresholds } from "./settings.js";
import { MSG } from "../common/messages.js";
import { setNotice } from "../common/ui.js";

const chartsCache = {};
let detailsTimer = null;
let scrollHost = null;

/** 最近渲染用的数据窗口大小（图表显示多少条） */
const WINDOW_SIZE = 12;

/** 全部读数，供状态条与图表共用 */
let allData = [];

/* 四个指标的定义，渲染、刷新、换主题都复用这一份 */
const CHART_META = [
  { key: "temp", field: "temperature", title: "温度", unit: "℃", digits: 1, stroke: "#ff6384", fill: "rgba(255,99,132,0.16)" },
  { key: "hum", field: "humidity", title: "湿度", unit: "%", digits: 1, stroke: "#36a2eb", fill: "rgba(54,162,235,0.16)" },
  { key: "soil", field: "soil_moisture", title: "土壤湿度", unit: "%", digits: 1, stroke: "#2fa8a8", fill: "rgba(47,168,168,0.18)" },
  { key: "light", field: "light", title: "光照", unit: "lx", digits: 0, stroke: "#e0a52a", fill: "rgba(224,165,42,0.18)" },
];

/* 上一次渲染用的传感器，换主题时重新渲染要它 */
let currentSensorId = null;

/** 从 CSS 变量读取当前主题的图表配色，这样换主题能跟着变 */
function readChartTheme() {
  const css = getComputedStyle(document.body);
  const pick = (name, fallback) => (css.getPropertyValue(name) || "").trim() || fallback;
  return {
    text: pick("--text-color", "#222"),
    muted: pick("--muted-color", "#666"),
    grid: pick("--card-border", "rgba(0,0,0,.1)"),
    tooltipBg: pick("--tooltip-bg", "rgba(20,28,28,.92)"),
  };
}

/** 把某个传感器最近 WINDOW_SIZE 条读数整理成图表需要的形状 */
function readingsFor(sensorId) {
  const readings = allData
    .filter((d) => d.sensor_id === sensorId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return readings.slice(-WINDOW_SIZE);
}

function makeLabels(rows) {
  return rows.map((r) => {
    const d = new Date(r.timestamp);
    return [
      d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }),
      d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    ];
  });
}

/**
 * 顶部状态条：四个指标的当前值 + 窗口内区间 + 趋势 + 阈值告警。
 * 阈值来自设置页，和主页共用同一套判断。
 */
function renderStatus(rows) {
  const host = document.getElementById("detailStatus");
  if (!host) return;
  const th = getThresholds();

  if (rows.length === 0) {
    setNotice(host, MSG.noSensorForOne);
    return;
  }

  const last = rows[rows.length - 1];
  const t = new Date(last.timestamp);

  host.innerHTML = CHART_META.map((meta) => {
    const raw = rows.map((r) => Number(r[meta.field])).filter(Number.isFinite);
    if (raw.length === 0) return "";
    const cur = raw[raw.length - 1];
    const lo = Math.min(...raw);
    const hi = Math.max(...raw);

    // 趋势：拿最近三条比一下
    const tail = raw.slice(-3);
    const trend = tail.length >= 2 ? tail[tail.length - 1] - tail[0] : 0;
    const arrow = trend > 0.05 ? "↑" : trend < -0.05 ? "↓" : "→";

    // 阈值判断（只有温度和湿度有阈值含义）
    let alarm = false;
    let limitText = "";
    if (meta.field === "temperature") {
      alarm = cur > th.temp;
      limitText = `阈值 ${th.temp}${meta.unit}`;
    } else if (meta.field === "humidity") {
      alarm = cur < th.hum;
      limitText = `阈值 ${th.hum}${meta.unit}`;
    }

    const d = meta.digits;
    return `
      <div class="status-tile${alarm ? " is-alarm" : ""}">
        <span class="status-label">${meta.title}</span>
        <span class="status-value">${cur.toFixed(d)}<em>${meta.unit}</em></span>
        <span class="status-range">区间 ${lo.toFixed(d)} ~ ${hi.toFixed(d)} <b class="trend">${arrow}</b></span>
        ${limitText ? `<span class="status-limit">${alarm ? "已超限 · " : ""}${limitText}</span>` : ""}
      </div>`;
  }).join("");

  const meta = document.getElementById("detailMeta");
  if (meta) {
    meta.textContent = `最近 ${rows.length} 条 · 更新于 ${t.toLocaleString("zh-CN")}`;
  }
}

function renderSensorCharts(sensorId) {
  const rows = readingsFor(sensorId);
  scrollHost.innerHTML = "";
  destroyCharts();

  renderStatus(rows);

  if (rows.length === 0) {
    setNotice(scrollHost, MSG.noSensorForOne);
    return;
  }

  const labels = makeLabels(rows);
  const grid = document.createElement("div");
  grid.className = "charts-row";

  CHART_META.forEach((meta) => {
    const canvasId = `${meta.key}-chart-${sensorId}`;
    const values = rows.map((r) => toNum(r[meta.field]));
    const { wrapper, canvas } = createChartBlock(
      `${meta.title}（${meta.unit}）`,
      canvasId
    );
    grid.appendChild(wrapper);
    chartsCache[canvasId] = drawLineChart(
      canvas,
      labels,
      values,
      meta.unit,
      meta.stroke,
      meta.fill
    );
  });

  scrollHost.appendChild(grid);
}

export async function showDetails(container) {
  container.querySelectorAll(":not(.blur-layer)").forEach((el) => el.remove());

  try {
    // 一次最多取 500 条，够画最近 12 条（WINDOW_SIZE）了
    const data = await fetchSensorData(NETWORK_CONFIG.chartLimit);

    const sensorIds = [...new Set(data.map((item) => item.sensor_id))].sort();

    if (sensorIds.length === 0) {
      setNotice(container, MSG.noSensorAtAll);
      return;
    }

    allData = data;

    // 顶部工具条：选传感器 + 最近更新时间
    container.insertAdjacentHTML(
      "beforeend",
      `
      <div class="detail-toolbar">
        <label class="toolbar-field" for="sensor-select">
          <span>传感器</span>
          <select id="sensor-select">
            ${sensorIds.map((id) => `<option value="${id}">${id}</option>`).join("")}
          </select>
        </label>
        <span class="toolbar-meta" id="detailMeta"></span>
      </div>
      <div class="detail-status" id="detailStatus"></div>
      `
    );

    // 图表容器复用同一个节点，避免每次重建丢失滚动位置
    scrollHost = document.createElement("div");
    scrollHost.className = "charts-scroll";
    container.appendChild(scrollHost);

    currentSensorId = sensorIds[0];
    renderSensorCharts(currentSensorId);

    document.getElementById("sensor-select").addEventListener("change", (e) => {
      currentSensorId = e.target.value;
      renderSensorCharts(currentSensorId);
    });
  } catch (err) {
    setNotice(container, MSG.fetchFailed(err.message), "error");
  }
}

/* 切换深浅色时重新建图，让坐标轴、网格、tooltip 配色跟上新主题 */
window.addEventListener(THEME_EVENT, () => {
  // 数据还没到就什么都不做，等首次渲染走正常流程
  if (currentSensorId && allData.length) renderSensorCharts(currentSensorId);
});

/** 把 [[日期,时间], ...] 拍平成两行数组，Chart.js 才会按两行显示 */
function splitLabels(labels) {
  if (!labels.length) return [[], []];
  return [labels.map((l) => l[0]), labels.map((l) => l[1])];
}

export function startDetailsAutoRefresh(intervalMs) {
  // 未传参时 setInterval 会退化成 ~1ms 的高频空转，这里给一个兜底值
  const ms = Number(intervalMs) > 0 ? Number(intervalMs) : 30 * 1000;
  stopDetailsAutoRefresh();
  detailsTimer = setInterval(updateDetailsDataOnly, ms);
}

export function stopDetailsAutoRefresh() {
  if (detailsTimer) {
    clearInterval(detailsTimer);
    detailsTimer = null;
  }
}

let lastFetchTime = 0;
const FETCH_INTERVAL = 3000;

async function updateDetailsDataOnly() {
  // 页面隐藏时不再请求，回到前台再恢复，省流量也省服务器
  if (document.hidden) return;

  const now = Date.now();
  if (now - lastFetchTime < FETCH_INTERVAL) {
    return;
  }
  lastFetchTime = now;

  try {
    const data = await fetchSensorData(NETWORK_CONFIG.chartLimit);
    allData = data;

    // 只刷新当前选中的传感器：状态条 + 图表数据，不重建图表实例
    if (!currentSensorId) return;
    const rows = readingsFor(currentSensorId);
    if (rows.length === 0) return;

    renderStatus(rows);
    const labels = makeLabels(rows);
    CHART_META.forEach((meta) => {
      updateChart(
        `${meta.key}-chart-${currentSensorId}`,
        labels,
        rows.map((r) => toNum(r[meta.field]))
      );
    });
    const meta = document.getElementById("detailMeta");
    if (meta) {
      meta.textContent = `最近 ${rows.length} 条 · 更新于 ${new Date().toLocaleString("zh-CN")}`;
    }
  } catch (err) {
    console.error("更新详细数据失败", err);
  }
}

function updateChart(key, labels, data) {
  const ch = chartsCache[key];
  if (ch) {
    ch.data.labels = labels;
    ch.data.datasets[0].data = data;
    // tooltip 的标题回调依赖这两个数组，更新时一起换掉
    const theme = readChartTheme();
    ch.options.plugins.tooltip.backgroundColor = theme.tooltipBg;
    ch.update("none");
  }
}

function destroyCharts() {
  Object.values(chartsCache).forEach((chart) => chart.destroy && chart.destroy());
  Object.keys(chartsCache).forEach((key) => delete chartsCache[key]);
}

function toNum(value) {
  return typeof value === "number" ? Number(value.toFixed(2)) : null;
}

function createChartBlock(title, canvasId) {
  const wrapper = document.createElement("div");
  wrapper.className = "chart-wrapper";
  const titleEl = document.createElement("div");
  titleEl.className = "chart-title";
  titleEl.textContent = title;
  const canvas = document.createElement("canvas");
  canvas.id = canvasId;
  wrapper.appendChild(titleEl);
  wrapper.appendChild(canvas);
  return { wrapper, canvas };
}

function drawLineChart(canvas, labels, data, unit, borderColor, fillColor) {
  // 注意：这里必须直接收 canvas 元素。
  // 之前用 document.getElementById(canvasId) 反查，但此时 canvas 还挂在
  // 尚未插入文档的容器里，反查会返回 null，图就画不出来。
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  const theme = readChartTheme();
  const [line1, line2] = splitLabels(labels);

  return new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: unit,
          data,
          borderColor,
          /*
           * 原来这里塞的是 createDiagonalPattern() 生成的斜线图案，
           * 再叠加一个 beforeDraw 插件往画布上刷 rgba(99,99,99,.34) 灰底 ——
           * 那层灰底同时把 tooltip 压在了下面，所以"加了背景就看不到数据"。
           * 现在图案和插件都删掉，只留一个淡色填充，
           * 卡片背景交给 .chart-wrapper 的 CSS 管。
           */
          backgroundColor: fillColor,
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: borderColor,
          pointBorderColor: "#fff",
          pointBorderWidth: 1.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      /*
       * 关掉入场动画：图表每 30 秒轮询刷新一次，动画只是白等；
       * 而且 rAF 驱动的动画在无头浏览器/后台标签页里不推进，
       * 会导致画布一直是空的（截图时就踩到了这个坑）。
       */
      animation: false,
      /* 鼠标不用正好压在点上，靠近也能出提示 */
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: theme.tooltipBg,
          titleColor: "#fff",
          bodyColor: "#fff",
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            // 第一行显示完整时间，第二行显示「温度：23.4 ℃」
            title: (items) => {
              const i = items[0].dataIndex;
              return `${line1[i]} ${line2[i]}`;
            },
            label: (item) => {
              const v = item.parsed.y;
              return v === null ? "无数据" : `${item.dataset.label}：${v}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: theme.muted, maxRotation: 0, autoSkipPadding: 12, font: { size: 11 } },
          grid: { color: theme.grid },
          border: { color: theme.grid },
        },
        y: {
          beginAtZero: false,
          ticks: { color: theme.muted, font: { size: 11 } },
          grid: { color: theme.grid },
          border: { color: theme.grid },
        },
      },
    },
  });
}