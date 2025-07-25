let currentPage = 1;
const rowsPerPage = 12;

export async function showHistoryData(container) {
  container.querySelectorAll(":not(.blur-layer)").forEach((el) => el.remove());
  try {
    const res = await fetch("http://1.95.210.241:9000/all_sensor_data");
    const rawData = await res.json();
    const data = rawData.map((item) => ({
      sensor_name: item.sensor_id || item.sensor_name,
      time: new Date(item.timestamp || item.time).toLocaleString(),
      temperature: parseFloat(item.temperature).toFixed(2),
      humidity: parseFloat(item.humidity).toFixed(2),
      soil_moisture: parseFloat(item.soil_moisture).toFixed(2),
      light: parseFloat(item.light).toFixed(2),
    }));
    renderFilterControls(container, data);
    renderPaginatedTable(container, data);
  } catch (err) {
    const p = document.createElement("p");
  p.textContent = "获取历史数据失败";
  container.appendChild(p);
  }
}

function renderFilterControls(container, data) {
  container.querySelectorAll(":not(.blur-layer)").forEach((el) => el.remove());
  const filterDiv = document.createElement("div");
  filterDiv.id = "filter-controls";
  filterDiv.innerHTML = `
    <h2>历史数据</h2>
      <div class="filter-row filter-row-inline">
        <label class="inline-filter">
          <span>传感器：</span>
          <select id="filter-name"></select>
        </label>
        <label class="inline-filter">
          <span>开始：</span>
          <input type="date" id="filter-start-date" />
        </label>
        <label class="inline-filter">
          <span>结束：</span>
          <input type="date" id="filter-end-date" />
        </label>
      </div>
    <div class="filter-row pair-row">
      <label>温度区间：
        <div class="input-pair">
          <input type="number" id="temp-min" ... />
          <span>-</span>
          <input type="number" id="temp-max" ... />
        </div>
      </label>
      <label>光照区间：
        <div class="input-pair">
          <input type="number" id="light-min" ... />
          <span>-</span>
          <input type="number" id="light-max" ... />
        </div>
      </label>
    </div>
    <div class="filter-row pair-row">
      <label>湿度区间：
        <div class="input-pair">
          <input type="number" id="hum-min" ... />
          <span>-</span>
          <input type="number" id="hum-max" ... />
        </div>
      </label>
      <label>土壤湿度区间：
        <div class="input-pair">
          <input type="number" id="soil-min" ... />
          <span>-</span>
          <input type="number" id="soil-max" ... />
        </div>
      </label>
    </div>
    <div class="filter-row button-row">
      <button id="apply-filter">应用筛选</button>
      <button id="reset-filter" class="reset-button">重置筛选</button>
    </div>
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

function renderPaginatedTable(container, fullData) {
  let filteredData = applyFilters(fullData);
  filteredData = filteredData.slice().sort((a, b) => new Date(b.time) - new Date(a.time));

  const tableContainer = document.getElementById("history-data-container");
  const paginationContainer = document.getElementById("pagination-controls");

  const startIdx = (currentPage - 1) * rowsPerPage;
  const pagedData = filteredData.slice(startIdx, startIdx + rowsPerPage);

  let html =
    "<table border=\"1\" cellspacing=\"0\" cellpadding=\"5\"><thead><tr><th>传感器名称</th><th>时间</th><th>温度 (℃)</th><th>湿度 (%)</th><th>土壤湿度 (%)</th><th>光照 (lx)</th></tr></thead><tbody>";
  pagedData.forEach((item) => {
    html += `<tr><td>${item.sensor_name}</td><td>${item.time}</td><td>${item.temperature}</td><td>${item.humidity}</td><td>${item.soil_moisture}</td><td>${item.light}</td></tr>`;
  });
   html += "</tbody></table>";
  tableContainer.innerHTML = html;

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  let phtml = "";
  for (let i = 1; i <= totalPages; i++) {
    phtml += `<button class=\"page-btn\" data-page=\"${i}\" ${i === currentPage ? "disabled" : ""}>${i}</button>`;
  }
  paginationContainer.innerHTML = phtml;

  document.querySelectorAll(".page-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentPage = parseInt(btn.dataset.page);
      renderPaginatedTable(container, fullData);
    });
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

  return data.filter((item) => {
    const itemDate = new Date(item.time).setHours(0, 0, 0, 0);
    const start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
    const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;
    const dateMatch = (!start || itemDate >= start) && (!end || itemDate <= end);

    return (
      (!name || item.sensor_name === name) &&
      dateMatch &&
      (isNaN(tempMin) || parseFloat(item.temperature) >= tempMin) &&
      (isNaN(tempMax) || parseFloat(item.temperature) <= tempMax) &&
      (isNaN(humMin) || parseFloat(item.humidity) >= humMin) &&
      (isNaN(humMax) || parseFloat(item.humidity) <= humMax) &&
      (isNaN(soilMin) || parseFloat(item.soil_moisture) >= soilMin) &&
      (isNaN(soilMax) || parseFloat(item.soil_moisture) <= soilMax) &&
      (isNaN(lightMin) || parseFloat(item.light) >= lightMin) &&
      (isNaN(lightMax) || parseFloat(item.light) <= lightMax)
    );
  });
}