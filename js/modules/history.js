/* ============ history.js · 历史数据页：筛选 + 分页表格 ============ */
import { fetchSensorData, NETWORK_CONFIG } from "./config.js";
import { MSG } from "../common/messages.js";
import { setNotice } from "../common/ui.js";

let currentPage = 1;
/* 每页显示多少行。改这里调整分页密度 */
const rowsPerPage = 12;

/** 把任意值转成数字；空值/非法值一律返回 null */
function toNumberOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** 展示用格式化：null 显示空，否则保留两位小数 */
function formatDisplayNumber(raw) {
  if (raw === null || raw === undefined) return "";
  return Number(raw).toFixed(2);
}

export async function showHistoryData(container) {
  container.querySelectorAll(":not(.blur-layer)").forEach((el) => el.remove());

  const loading = document.createElement("p");
  loading.textContent = MSG.loadingHistory;
  container.appendChild(loading);

  try {
    // 历史页多取一些，翻页才有内容
    const rawData = await fetchSensorData(NETWORK_CONFIG.historyLimit);

    if (rawData.length === 0) {
      loading.textContent = MSG.noHistory;
      return;
    }

    /*
     * 每条记录同时保留「展示用字符串」和「筛选用原始数值」。
     * 筛选要用数字比较，不要拿显示字符串再 parse 回来（空值会算出 NaN）。
     */
    const data = rawData.map((row) => {
      const ts = row.timestamp || row.time;
      const dateObj = ts ? new Date(ts) : null;
      const tempRaw = toNumberOrNull(row.temperature);
      const humRaw = toNumberOrNull(row.humidity);
      const soilRaw = toNumberOrNull(row.soil_moisture);
      const lightRaw = toNumberOrNull(row.light);

      return {
        sensor_name: row.sensor_id || row.sensor_name || "未命名",
        time: dateObj ? dateObj.toLocaleString("zh-CN") : "",
        /* 排序 / 日期筛选用 */
        timestamp: dateObj ? dateObj.toISOString() : null,
        /* 展示用 */
        temperature: formatDisplayNumber(tempRaw),
        humidity: formatDisplayNumber(humRaw),
        soil_moisture: formatDisplayNumber(soilRaw),
        light: formatDisplayNumber(lightRaw),
        /* 筛选用 */
        temperatureRaw: tempRaw,
        humidityRaw: humRaw,
        soil_moistureRaw: soilRaw,
        lightRaw: lightRaw,
      };
    });

    loading.remove();
    renderFilterControls(container, data);
    renderPaginatedTable(container, data);
  } catch (err) {
    loading.textContent = MSG.fetchFailed(err.message, "历史数据");
  }
}

function renderFilterControls(container, data) {
  container.querySelectorAll(":not(.blur-layer)").forEach((el) => el.remove());
  const filterDiv = document.createElement("div");
  filterDiv.id = "filter-controls";
  /*
   * 筛选区做成可折叠：默认收起，只占一行，把竖向空间让给数据表。
   * 收起来的时候用一个提示行显示「当前有效筛选」，不至于不知道筛了什么。
   */
  filterDiv.innerHTML = `
    <div class="filter-head">
      <h2>历史数据</h2>
      <button type="button" id="toggle-filter" class="ghost-btn" aria-expanded="false">
        筛选条件 <span class="caret">▾</span>
      </button>
    </div>

    <div class="filter-body" id="filter-body" hidden>
      <div class="filter-row filter-row-inline">
        <label class="inline-filter">
          <span>传感器：</span>
          <select id="filter-name"></select>
        </label>
        <label class="inline-filter">
          <span>开始日期：</span>
          <input type="date" id="filter-start-date" />
        </label>
        <label class="inline-filter">
          <span>结束日期：</span>
          <input type="date" id="filter-end-date" />
        </label>
      </div>
      <div class="filter-row pair-row">
        <label>温度区间：
          <span class="range-inputs">
            <input type="number" id="temp-min" placeholder="最低" />
            <span>-</span>
            <input type="number" id="temp-max" placeholder="最高" />
          </span>
        </label>
        <label>光照区间：
          <span class="range-inputs">
            <input type="number" id="light-min" placeholder="最低" />
            <span>-</span>
            <input type="number" id="light-max" placeholder="最高" />
          </span>
        </label>
      </div>
      <div class="filter-row pair-row">
        <label>湿度区间：
          <span class="range-inputs">
            <input type="number" id="hum-min" placeholder="最低" />
            <span>-</span>
            <input type="number" id="hum-max" placeholder="最高" />
          </span>
        </label>
        <label>土壤湿度区间：
          <span class="range-inputs">
            <input type="number" id="soil-min" placeholder="最低" />
            <span>-</span>
            <input type="number" id="soil-max" placeholder="最高" />
          </span>
        </label>
      </div>
      <div class="filter-row button-row">
        <button id="apply-filter">应用筛选</button>
        <button id="reset-filter" class="reset-button">重置筛选</button>
      </div>
    </div>

    <p class="filter-summary" id="filter-summary"></p>
  `;
  container.appendChild(filterDiv);

  const tableContainer = document.createElement("div");
  tableContainer.id = "history-data-container";
  container.appendChild(tableContainer);

  const paginationContainer = document.createElement("div");
  paginationContainer.id = "pagination-controls";
  container.appendChild(paginationContainer);

  const sensorNames = [...new Set(data.map((i) => i.sensor_name))].sort();
  const select = filterDiv.querySelector("#filter-name");
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "全部";
  select.appendChild(allOption);
  sensorNames.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });

  // 折叠开关
  const body = document.getElementById("filter-body");
  const toggle = document.getElementById("toggle-filter");
  toggle.addEventListener("click", () => {
    const open = body.hidden;
    body.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.querySelector(".caret").textContent = open ? "▴" : "▾";
  });

  document.getElementById("apply-filter").addEventListener("click", () => {
    currentPage = 1;
    renderPaginatedTable(container, data);
  });
  document.getElementById("reset-filter").addEventListener("click", () => {
    filterDiv.querySelectorAll("select, input").forEach((inp) => (inp.value = ""));
    currentPage = 1;
    renderPaginatedTable(container, data);
  });
}

/** 把当前筛选条件汇总成一句话，收起筛选区时也能看到 */
function updateFilterSummary(data) {
  const el = document.getElementById("filter-summary");
  if (!el) return;

  const name = document.getElementById("filter-name").value;
  const sd = document.getElementById("filter-start-date").value;
  const ed = document.getElementById("filter-end-date").value;
  const ranges = [
    ["温度", "temp-min", "temp-max", "℃"],
    ["湿度", "hum-min", "hum-max", "%"],
    ["土壤", "soil-min", "soil-max", "%"],
    ["光照", "light-min", "light-max", "lx"],
  ];

  const parts = [];
  if (name) parts.push(`传感器 ${name}`);
  if (sd || ed) parts.push(`${sd || "起始"} ~ ${ed || "至今"}`);
  for (const [label, minId, maxId, unit] of ranges) {
    const a = document.getElementById(minId).value;
    const b = document.getElementById(maxId).value;
    if (a || b) parts.push(`${label} ${a || "—"}~${b || "—"}${unit}`);
  }

  const total = data.length;
  if (parts.length === 0) {
    el.innerHTML = `<span class="chip chip-all">未筛选 · 共 ${total} 条记录</span>`;
  } else {
    el.innerHTML =
      `<span class="chip chip-on">筛选中</span>` +
      parts.map((p) => `<span class="chip">${p}</span>`).join("") +
      `<span class="chip chip-all">匹配 ${data.length} 条</span>`;
  }
}

function renderPaginatedTable(container, fullData) {
  let filteredData = applyFilters(fullData);
  // 按时间倒序：直接用 ISO 时间戳，比解析展示字符串可靠
  filteredData = filteredData
    .slice()
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

  const tableContainer = document.getElementById("history-data-container");
  const paginationContainer = document.getElementById("pagination-controls");

  // 先算总页数，并把 currentPage 夹在合法范围内。
  // 否则点完第 5 页再一筛选（结果只剩 1 页），就会渲染出一张空表。
  const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIdx = (currentPage - 1) * rowsPerPage;
  const pagedData = filteredData.slice(startIdx, startIdx + rowsPerPage);

  if (pagedData.length === 0) {
    setNotice(tableContainer, MSG.noFilterMatch);
  } else {
    let html =
      '<div class="table-scroll"><table><thead><tr><th>传感器名称</th><th>时间</th><th>温度 (℃)</th><th>湿度 (%)</th><th>土壤湿度 (%)</th><th>光照 (lx)</th></tr></thead><tbody>';
    pagedData.forEach((item) => {
      html += `<tr><td>${item.sensor_name}</td><td>${item.time}</td><td>${item.temperature}</td><td>${item.humidity}</td><td>${item.soil_moisture}</td><td>${item.light}</td></tr>`;
    });
    html += "</tbody></table></div>";
    tableContainer.innerHTML = html;
  }

  // 顶部汇总条跟着筛选结果更新
  updateFilterSummary(filteredData);
  renderPagination(paginationContainer, container, fullData, totalPages, filteredData.length);
}

/**
 * 渲染分页控件。
 * 只显示当前页附近的页码，两端补省略号。
 */
function renderPagination(paginationContainer, container, fullData, totalPages, totalRows) {
  if (totalPages <= 1) {
    paginationContainer.innerHTML =
      totalRows > 0 ? `<span class="page-total">共 ${totalRows} 条</span>` : "";
    return;
  }

  const goTo = (page) => {
    currentPage = page;
    renderPaginatedTable(container, fullData);
  };

  // 当前页窗口：首页/末页各固定展示 2 个，中间以当前页为中心展开
  const span = 2;
  let start = Math.max(2, currentPage - span);
  let end = Math.min(totalPages - 1, currentPage + span);
  // 靠近两端时把窗口往另一侧补足，避免出现「1 … 3 4 5」这种很短的列表
  if (start <= 3) start = 2;
  if (end >= totalPages - 2) end = totalPages - 1;

  const parts = [];
  parts.push(
    `<button class="page-btn" data-page="1"${currentPage === 1 ? ' disabled aria-current="page"' : ""}>1</button>`
  );
  if (start > 2) parts.push('<span class="page-ellipsis">…</span>');
  for (let i = start; i <= end; i++) {
    parts.push(
      `<button class="page-btn${i === currentPage ? " is-active" : ""}" data-page="${i}"${
        i === currentPage ? ' disabled aria-current="page"' : ""
      }>${i}</button>`
    );
  }
  if (end < totalPages - 1) parts.push('<span class="page-ellipsis">…</span>');
  parts.push(
    `<button class="page-btn" data-page="${totalPages}"${
      currentPage === totalPages ? ' disabled aria-current="page"' : ""
    }>${totalPages}</button>`
  );

  parts.push(
    `<button class="page-btn" data-page="${currentPage - 1}"${
      currentPage === 1 ? " disabled" : ""
    } aria-label="上一页">‹</button>`
  );
  parts.push(
    `<button class="page-btn" data-page="${currentPage + 1}"${
      currentPage === totalPages ? " disabled" : ""
    } aria-label="下一页">›</button>`
  );
  parts.push(`<span class="page-total">共 ${totalRows} 条 / ${totalPages} 页</span>`);

  paginationContainer.innerHTML = parts.join("");

  paginationContainer.querySelectorAll(".page-btn").forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener("click", () => goTo(parseInt(btn.dataset.page, 10)));
  });
}

function applyFilters(data) {
  const name = document.getElementById("filter-name").value;
  const startDate = document.getElementById("filter-start-date").value;
  const endDate = document.getElementById("filter-end-date").value;

  const tempMin = parseFloat(document.getElementById("temp-min").value);
  const tempMax = parseFloat(document.getElementById("temp-max").value);
  const humMin = parseFloat(document.getElementById("hum-min").value);
  const humMax = parseFloat(document.getElementById("hum-max").value);
  const soilMin = parseFloat(document.getElementById("soil-min").value);
  const soilMax = parseFloat(document.getElementById("soil-max").value);
  const lightMin = parseFloat(document.getElementById("light-min").value);
  const lightMax = parseFloat(document.getElementById("light-max").value);

  const startMs = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
  const endMs = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;

  return data.filter((item) => {
    // 用记录自带的 ISO 时间比，而不是把显示字符串再解析回日期
    const itemMs = item.timestamp ? new Date(item.timestamp).getTime() : null;

    const dateMatch =
      (!startMs || (itemMs !== null && itemMs >= startMs)) &&
      (!endMs || (itemMs !== null && itemMs <= endMs));

    // 数值比较一律用 *Raw 原始值，空值不参与匹配
    return (
      (!name || item.sensor_name === name) &&
      dateMatch &&
      (isNaN(tempMin) || (item.temperatureRaw != null && item.temperatureRaw >= tempMin)) &&
      (isNaN(tempMax) || (item.temperatureRaw != null && item.temperatureRaw <= tempMax)) &&
      (isNaN(humMin) || (item.humidityRaw != null && item.humidityRaw >= humMin)) &&
      (isNaN(humMax) || (item.humidityRaw != null && item.humidityRaw <= humMax)) &&
      (isNaN(soilMin) || (item.soil_moistureRaw != null && item.soil_moistureRaw >= soilMin)) &&
      (isNaN(soilMax) || (item.soil_moistureRaw != null && item.soil_moistureRaw <= soilMax)) &&
      (isNaN(lightMin) || (item.lightRaw != null && item.lightRaw >= lightMin)) &&
      (isNaN(lightMax) || (item.lightRaw != null && item.lightRaw <= lightMax))
    );
  });
}