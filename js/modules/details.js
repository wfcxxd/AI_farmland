const chartsCache = {};
let detailsTimer = null;
let scrollHost = null;

export async function showDetails(container) {
  const toRemove = container.querySelectorAll(":not(.blur-layer):not(.charts-scroll):not(#sensor-select):not(#sensor-title):not(label)");
  toRemove.forEach(el => el.remove());

  try {
    const res = await fetch("https://1.95.210.241/all_sensor_data");
    const data = await res.json();

    if (!Array.isArray(data)) {
      container.innerHTML += "<p>请求数据失败</p>";
      return;
    }

    const sensorIds = [...new Set(data.map((item) => item.sensor_id))].sort();

    if (!container.querySelector("#sensor-select")) {
        container.insertAdjacentHTML(
        "beforeend",
        `
        <label for="sensor-select" style="font-weight:bold; font-size:20px; margin-bottom:10px; display:block;">
            选择传感器：
            <select id="sensor-select">
            ${sensorIds.map((id) => `<option value="${id}">${id}</option>`).join("")}
            </select>
        </label>
        <hr />
        <h2 id="sensor-title">${sensorIds[0]}</h2>
        `
        );
    }

    scrollHost = container.querySelector(".charts-scroll");
    if (!scrollHost) {
        scrollHost = document.createElement("div");
        scrollHost.className = "charts-scroll";
        container.appendChild(scrollHost);
    }
   

    function renderSensorCharts(sensorId) {
      scrollHost.innerHTML = "";

      const readings = data
        .filter((d) => d.sensor_id === sensorId)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      const lastFive = readings.slice(-5);

      const labels = lastFive.map((r) => {
        const d = new Date(r.timestamp);
        const datePart = d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
        const timePart = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
        return [datePart, timePart];
      });

      const temperature = lastFive.map((r) => toNum(r.temperature));
      const humidity = lastFive.map((r) => toNum(r.humidity));
      const soil = lastFive.map((r) => toNum(r.soil_moisture));
      const light = lastFive.map((r) => toNum(r.light));

      const rowDiv1 = document.createElement("div");
      rowDiv1.className = "charts-row";
      rowDiv1.appendChild(createChartBlock(sensorId, "温度", `temp-chart-${sensorId}`));
      rowDiv1.appendChild(createChartBlock(sensorId, "湿度", `hum-chart-${sensorId}`));

      const rowDiv2 = document.createElement("div");
      rowDiv2.className = "charts-row";
      rowDiv2.appendChild(createChartBlock(sensorId, "土壤湿度", `soil-chart-${sensorId}`));
      rowDiv2.appendChild(createChartBlock(sensorId, "光照", `light-chart-${sensorId}`));

      scrollHost.appendChild(document.createElement("hr"));
      scrollHost.appendChild(rowDiv1);
      scrollHost.appendChild(rowDiv2);

      destroyCharts();
      chartsCache[`temp-chart-${sensorId}`] = drawLineChart(
        `temp-chart-${sensorId}`,
        labels,
        temperature,
        "温度（℃）",
        "rgba(255,99,132,1)",
        "rgba(255,99,132,0.6)"
      );
      chartsCache[`hum-chart-${sensorId}`] = drawLineChart(
        `hum-chart-${sensorId}`,
        labels,
        humidity,
        "湿度（%）",
        "rgba(54,162,235,1)",
        "rgba(54,162,235,0.6)"
      );
      chartsCache[`soil-chart-${sensorId}`] = drawLineChart(
        `soil-chart-${sensorId}`,
        labels,
        soil,
        "土壤湿度（%）",
        "rgba(75,192,192,1)",
        "rgba(75,192,192,0.6)"
      );
      chartsCache[`light-chart-${sensorId}`] = drawLineChart(
        `light-chart-${sensorId}`,
        labels,
        light,
        "光照（lx）",
        "rgba(255,206,86,1)",
        "rgba(255,206,86,0.6)"
      );
    }

    // 初始渲染
    renderSensorCharts(sensorIds[0]);

    document.getElementById("sensor-select").addEventListener("change", (e) => {
      const id = e.target.value;
      document.getElementById("sensor-title").textContent = id;
      renderSensorCharts(id);
    });
  } catch (err) {
    container.innerHTML = `<p>加载数据失败：${err.message}</p>`;
  }
}

export function startDetailsAutoRefresh(intervalMs) {
  detailsTimer = setInterval(updateDetailsDataOnly, intervalMs);
}

export function stopDetailsAutoRefresh() {
  if (detailsTimer) {
    clearInterval(detailsTimer);
    detailsTimer = null;
  }
}

async function updateDetailsDataOnly() {
  try {
    const res = await fetch("http://1.95.210.241:9000/all_sensor_data");
    const data = await res.json();
    if (!Array.isArray(data)) return;

    const grouped = {};
    data.forEach((item) => {
      const id = item.sensor_id;
      (grouped[id] = grouped[id] || []).push(item);
    });

    Object.entries(grouped).forEach(([sensorId, readings]) => {
      const sorted = readings.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const lastFive = sorted.slice(-5);
      const labels = lastFive.map((r) => {
        const d = new Date(r.timestamp);
        const datePart = d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
        const timePart = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
        return [datePart, timePart];
      });

      const temp = lastFive.map((r) => toNum(r.temperature));
      const hum = lastFive.map((r) => toNum(r.humidity));
      const soil = lastFive.map((r) => toNum(r.soil_moisture));
      const light = lastFive.map((r) => toNum(r.light));

      updateChart(`temp-chart-${sensorId}`, labels, temp);
      updateChart(`hum-chart-${sensorId}`, labels, hum);
      updateChart(`soil-chart-${sensorId}`, labels, soil);
      updateChart(`light-chart-${sensorId}`, labels, light);
    });
  } catch (err) {
    console.error("更新详细数据失败", err);
  }
}

function updateChart(key, labels, data) {
  const ch = chartsCache[key];
  if (ch) {
    ch.data.labels = labels;
    ch.data.datasets[0].data = data;
    ch.update('none');
  }
}

function destroyCharts() {
  Object.values(chartsCache).forEach((chart) => chart.destroy && chart.destroy());
  Object.keys(chartsCache).forEach((key) => delete chartsCache[key]);
}

function toNum(value) {
  return typeof value === "number" ? Number(value.toFixed(2)) : null;
}

function createChartBlock(sensorId, title, canvasId) {
  const wrapper = document.createElement("div");
  wrapper.className = "chart-wrapper";
  const titleEl = document.createElement("div");
  titleEl.textContent = title;
  const canvas = document.createElement("canvas");
  canvas.id = canvasId;
  wrapper.appendChild(titleEl);
  wrapper.appendChild(canvas);
  return wrapper;
}

function createDiagonalPattern(ctx, color, bgColor) {
  const patternCanvas = document.createElement("canvas");
  patternCanvas.width = 10;
  patternCanvas.height = 10;
  const pctx = patternCanvas.getContext("2d");
  pctx.fillStyle = bgColor;
  pctx.fillRect(0, 0, 10, 10);
  pctx.strokeStyle = color;
  pctx.lineWidth = 1;
  pctx.beginPath();
  pctx.moveTo(0, 10);
  pctx.lineTo(10, 0);
  pctx.stroke();
  return ctx.createPattern(patternCanvas, "repeat");
}

function drawLineChart(canvasId, labels, data, label, borderColor, bgColor) {
  const canvas = document.getElementById(canvasId);
  const ctx = document.getElementById(canvasId).getContext("2d");

  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = 'rgba(0,0,0,0)'; // 完全透明
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();

  const pattern = createDiagonalPattern(ctx, "rgba(255,255,255,0.5)", bgColor);
   return new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label,
          data,
          borderColor,
          backgroundColor: pattern,
          borderWidth: 2,
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: {
            color: "#ccc"
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: "#ccc"
          }
        },
        y: {
          ticks: {
            color: "#ccc"
          }
        }
      },
      backgroundColor: "transparent"
    },
    plugins: [{
      id: "custom_background_clearer",
      beforeDraw: (chart) => {
        const ctx = chart.canvas.getContext("2d");
        ctx.save();
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = "rgba(0,0,0,0)";  // 完全透明
        ctx.fillRect(0, 0, chart.width, chart.height);
        ctx.restore();
      }
    }]
  });
}