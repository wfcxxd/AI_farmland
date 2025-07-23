let refreshTimer = null;

// 默认设置
const defaultSettings = {
  refreshInterval: 1,
  theme: 'light',
  tempThreshold: 35.0,
  humThreshold: 70.0
};

// 页面加载时导航激活及事件绑定
document.addEventListener('DOMContentLoaded', () => {
  const navLinks = document.querySelectorAll('.content a');
  const savedId = localStorage.getItem('activeMenu');

  const container = document.querySelector('.main-data');
  if (!container.querySelector('.blur-layer')) {
    const blurDiv = document.createElement('div');
    blurDiv.className = 'blur-layer';
    container.appendChild(blurDiv);
  }

  navLinks.forEach(link => {
    const id = link.getAttribute('data-id');

    // 设置激活样式
    if (id === savedId) {
      link.classList.add('active');
      showPage(id);
    }

    // 点击导航切换页面
    link.addEventListener('click', e => {
      e.preventDefault();
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      localStorage.setItem('activeMenu', id);
      showPage(id);
    });
  });

  // 如果没有保存的菜单，默认显示主页
  if (!savedId) {
    const homeLink = document.querySelector('.content a[data-id="home"]');
    if (homeLink) {
      homeLink.classList.add('active');
      showPage('home');
    }
  }
});

// 根据菜单ID显示对应页面内容
function showPage(id) {
  const container = document.querySelector('.main-data');
  container.querySelectorAll(':not(.blur-layer)').forEach(el => el.remove());

  stopAutoRefresh(); // 切换页面先停止之前的自动刷新

  switch (id) {
    case 'home':
      container.insertAdjacentHTML('beforeend', `
        <h2>欢迎</h2>
        <p id="currentTime">加载时间中...</p>
        <p>这里显示主页内容。</p>
      `);
      startAutoRefresh('home');
      break;
    case 'details':
      showDetails();
      startAutoRefresh('details');
      break;
    case 'history-data':
      showHistoryData();
      break;
    case 'settings':
      showSettings();
      // 设置页无自动刷新
      break;
    default:
      container.insertAdjacentHTML('beforeend', `<h2>未知页面</h2>`);
  }
}

// 主页时间更新时间（每秒）
function updateTime() {
  const now = new Date();
  const timeEl = document.getElementById('currentTime');
  if (timeEl) {
    timeEl.textContent = '当前时间：' + now.toLocaleString('zh-CN');
  }
}

// 详细数据图表实例缓存，用于数据更新时复用
const chartsCache = {};

// 详细数据页逻辑，首次加载时完整绘制
async function showDetails() {
  const container = document.querySelector('.main-data');
  container.querySelectorAll(':not(.blur-layer)').forEach(el => el.remove());

  try {
    const res = await fetch('http://127.0.0.1:3000/all_sensor_data');
    const data = await res.json();

    if (!Array.isArray(data)) {
      container.innerHTML += '<p>数据格式错误</p>';
      return;
    }

    // 收集所有传感器ID，去重并排序
    const sensorIds = [...new Set(data.map(item => item.sensor_id))].sort();

    // 创建选择框HTML
    const selectHtml = `
      <label for="sensor-select" style="font-weight:bold; font-size:20px; margin-bottom:10px; display:block;">
        选择传感器：
        <select id="sensor-select">
          ${sensorIds.map(id => `<option value="${id}">${id}</option>`).join('')}
        </select>
      </label>
      <hr />
      <h2 id="sensor-title">${sensorIds[0]}</h2>
    `;
    container.insertAdjacentHTML('beforeend', selectHtml);

    // 渲染某个传感器图表的函数
    function renderSensorCharts(sensorId) {
      // 清除之前的图表，除去选择框和标题
      container.querySelectorAll('.charts-row, hr').forEach(el => el.remove());

      // 过滤该传感器数据并排序时间
      const readings = data.filter(d => d.sensor_id === sensorId)
                           .sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));

      const lastFive = readings.slice(-5);

      const labels = lastFive.map(r => {
        const d = new Date(r.timestamp);
        const datePart = d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
        const timePart = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        return [datePart, timePart];
      });

      const temperature = lastFive.map(r => typeof r.temperature === 'number' ? Number(r.temperature.toFixed(2)) : null);
      const humidity = lastFive.map(r => typeof r.humidity === 'number' ? Number(r.humidity.toFixed(2)) : null);
      const soil_moisture = lastFive.map(r => typeof r.soil_moisture === 'number' ? Number(r.soil_moisture.toFixed(2)) : null);
      const light = lastFive.map(r => typeof r.light === 'number' ? Number(r.light.toFixed(2)) : null);

      const rowDiv1 = document.createElement('div');
      rowDiv1.className = 'charts-row';
      rowDiv1.appendChild(createChartBlock(sensorId, '温度', `temp-chart-${sensorId}`));
      rowDiv1.appendChild(createChartBlock(sensorId, '湿度', `hum-chart-${sensorId}`));

      const rowDiv2 = document.createElement('div');
      rowDiv2.className = 'charts-row';
      rowDiv2.appendChild(createChartBlock(sensorId, '土壤湿度', `soil_moisture-chart-${sensorId}`));
      rowDiv2.appendChild(createChartBlock(sensorId, '光照', `light-chart-${sensorId}`));

      container.appendChild(document.createElement('hr'));
      container.appendChild(rowDiv1);
      container.appendChild(rowDiv2);

      // 清除旧图表
      Object.values(chartsCache).forEach(chart => chart.destroy());
      Object.keys(chartsCache).forEach(key => delete chartsCache[key]);

      // 新建图表
      chartsCache[`temp-chart-${sensorId}`] = drawLineChart(`temp-chart-${sensorId}`, labels, temperature, '温度（℃）', 'rgba(255,99,132,1)', 'rgba(255,99,132,0.6)');
      chartsCache[`hum-chart-${sensorId}`] = drawLineChart(`hum-chart-${sensorId}`, labels, humidity, '湿度（%）', 'rgba(54,162,235,1)', 'rgba(54,162,235,0.6)');
      chartsCache[`soil_moisture-chart-${sensorId}`] = drawLineChart(`soil_moisture-chart-${sensorId}`, labels, soil_moisture, '土壤湿度（%）', 'rgba(75,192,192,1)', 'rgba(75,192,192,0.6)');
      chartsCache[`light-chart-${sensorId}`] = drawLineChart(`light-chart-${sensorId}`, labels, light, '光照（lx）', 'rgba(255,206,86,1)', 'rgba(255,206,86,0.6)');
    }

    // 初始渲染第一个传感器
    renderSensorCharts(sensorIds[0]);

    // 绑定选择事件
    const select = document.getElementById('sensor-select');
    select.addEventListener('change', () => {
      const selectedId = select.value;
      document.getElementById('sensor-title').textContent = selectedId;
      renderSensorCharts(selectedId);
    });

  } catch (err) {
    container.innerHTML = `<p>加载数据失败：${err.message}</p>`;
  }
}

// 只更新详细数据页的图表数据，不重建页面
async function updateDetailsDataOnly() {
  try {
    const res = await fetch('http://127.0.0.1:3000/all_sensor_data');
    const data = await res.json();

    if (!Array.isArray(data)) return;

    const grouped = {};
    data.forEach(item => {
      const id = item.sensor_id;
      if (!grouped[id]) grouped[id] = [];
      grouped[id].push(item);
    });

    for (const [sensorId, readings] of Object.entries(grouped)) {
      const sortedReadings = readings.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // 取最新5条
      const lastFive = sortedReadings.slice(-5);

      const labels = lastFive.map(r => {
        const d = new Date(r.timestamp);
        const datePart = d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
        const timePart = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        return [datePart, timePart];
      });

      const temperature = lastFive.map(r => typeof r.temperature === 'number' ? Number(r.temperature.toFixed(2)) : null);
      const humidity = lastFive.map(r => typeof r.humidity === 'number' ? Number(r.humidity.toFixed(2)) : null);
      const soil_moisture = lastFive.map(r => typeof r.soil_moisture === 'number' ? Number(r.soil_moisture.toFixed(2)) : null);
      const light = lastFive.map(r => typeof r.light === 'number' ? Number(r.light.toFixed(2)) : null);

      // 更新图表数据
      const tempChart = chartsCache[`temp-chart-${sensorId}`];
      if (tempChart) {
        tempChart.data.labels = labels;
        tempChart.data.datasets[0].data = temperature;
        tempChart.update();
      }

      const humChart = chartsCache[`hum-chart-${sensorId}`];
      if (humChart) {
        humChart.data.labels = labels;
        humChart.data.datasets[0].data = humidity;
        humChart.update();
      }

      const soil_moistureChart = chartsCache[`soil_moisture-chart-${sensorId}`];
      if (soil_moistureChart) {
        soil_moistureChart.data.labels = labels;
        soil_moistureChart.data.datasets[0].data = soil_moisture;
        soil_moistureChart.update();
      }

      const lightChart = chartsCache[`light-chart-${sensorId}`];
      if (lightChart) {
        lightChart.data.labels = labels;
        lightChart.data.datasets[0].data = light;
        lightChart.update();
      }
    }
  } catch (err) {
      container.querySelectorAll(':not(.blur-layer)').forEach(el => el.remove());
      const errorEl = document.createElement('p');
      errorEl.textContent = `加载数据失败：${err.message}`;
      container.appendChild(errorEl);
  }
}

// 辅助函数：创建图表块
function createChartBlock(sensorId, title, canvasId) {
  const wrapper = document.createElement('div');
  wrapper.className = 'chart-wrapper';

  const titleEl = document.createElement('div');
  titleEl.textContent = title;

  const canvas = document.createElement('canvas');
  canvas.id = canvasId;

  wrapper.appendChild(titleEl);
  wrapper.appendChild(canvas);

  return wrapper;
}

// 辅助函数：绘制折线图，返回 Chart 实例以便后续更新数据
function createDiagonalPattern(ctx, color, bgColor) {
  const patternCanvas = document.createElement('canvas');
  patternCanvas.width = 10;
  patternCanvas.height = 10;
  const pctx = patternCanvas.getContext('2d');

  // 背景色
  pctx.fillStyle = bgColor;
  pctx.fillRect(0, 0, 10, 10);

  // 斜线颜色和宽度
  pctx.strokeStyle = color;
  pctx.lineWidth = 1;

  // 画斜线
  pctx.beginPath();
  pctx.moveTo(0, 10);
  pctx.lineTo(10, 0);
  pctx.stroke();

  return ctx.createPattern(patternCanvas, 'repeat');
}

function drawLineChart(canvasId, labels, data, label, borderColor, bgColor) {
  const ctx = document.getElementById(canvasId).getContext('2d');

  const pattern = createDiagonalPattern(ctx, 'rgba(255, 255, 255, 0.5)', bgColor);

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor,
        backgroundColor: pattern, // 这里用斜线pattern
        borderWidth: 2,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      interaction: {
        mode: 'nearest',
        intersect: false,
      },
      plugins: {
        tooltip: {
          enabled: true,
          mode: 'nearest',
          intersect: false,
        },
        legend: {
          display: true,
          position: 'top',
        }
      },
      scales: {
        x: {
          ticks: { 
            color: '#ffffffff',
            maxRotation: 0,     
            minRotation: 0,     
            autoSkip: true,      
            maxTicksLimit: 5,
          },
          grid: { color: 'rgba(0,0,0,0.1)' }
        },
        y: {
          ticks: { color: 'rgba(255,255,255,1)' },
          grid: { color: 'rgba(0,0,0,0.1)' }
        }
      }
    }
  });
}

// ===== 自动刷新控制 =====
function startAutoRefresh(page) {
  const intervalMin = Number(localStorage.getItem('refreshInterval')) || defaultSettings.refreshInterval;
  const intervalMs = intervalMin * 60 * 1000;

  if (page === 'home') {
    updateTime(); // 立即更新时间
    refreshTimer = setInterval(updateTime, 1000); // 每秒更新时间
  } else if (page === 'details') {
    refreshTimer = setInterval(updateDetailsDataOnly, intervalMs);
  }
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

//============查看历史数据页面逻辑============
async function showHistoryData() {
  const container = document.querySelector('.main-data');
  container.querySelectorAll(':not(.blur-layer)').forEach(el => el.remove());

  try {
    const res = await fetch('http://127.0.0.1:3000/all_sensor_data');
    const rawData = await res.json();

    // 保留两位小数 & 转换时间
    const data = rawData.map(item => ({
      sensor_name: item.sensor_id || item.sensor_name, // 兼容字段名
      time: new Date(item.timestamp || item.time).toLocaleString(),
      temperature: parseFloat(item.temperature).toFixed(2),
      humidity: parseFloat(item.humidity).toFixed(2),
      soil_moisture: parseFloat(item.soil_moisture).toFixed(2),
      light: parseFloat(item.light).toFixed(2)
    }));

    renderFilterControls(data);
    renderPaginatedTable(data);
  } catch (error) {
      container.querySelectorAll(':not(.blur-layer)').forEach(el => el.remove());
      const errorEl = document.createElement('p');
      errorEl.textContent = `获取历史数据失败：${error.message}`;
      container.appendChild(errorEl);
      console.error('获取历史数据失败：', error);
  }
}

// === 筛选控件 ===
function renderFilterControls(data) {
  const container = document.querySelector('.main-data');
  container.querySelectorAll(':not(.blur-layer)').forEach(el => el.remove());

  const filterDiv = document.createElement('div');
  filterDiv.id = 'filter-controls';

  filterDiv.innerHTML = `
    <h2>历史数据</h2>
    <div class="filter-row">
      <label>传感器名称：
        <select id="filter-name">
          <option value="">全部</option>
        </select>
      </label>
      <label>开始日期：
        <input type="date" id="filter-start-date" />
      </label>
      <label>结束日期：
        <input type="date" id="filter-end-date" />
      </label>
    </div>
    <div class="filter-row">
      <label>温度区间：
        <input type="number" id="temp-min" step="0.01" placeholder="最小值" />
        -
        <input type="number" id="temp-max" step="0.01" placeholder="最大值" />
      </label>
      <label>光照区间：
        <input type="number" id="light-min" step="0.01" placeholder="最小值" />
        -
        <input type="number" id="light-max" step="0.01" placeholder="最大值" />
      </label>
    </div>
    <div class="filter-row">
      <label>湿度区间：
        <input type="number" id="hum-min" step="0.01" placeholder="最小值" />
        -
        <input type="number" id="hum-max" step="0.01" placeholder="最大值" />
      </label>
      <label>土壤湿度区间：
        <input type="number" id="soil-min" step="0.01" placeholder="最小值" />
        -
        <input type="number" id="soil-max" step="0.01" placeholder="最大值" />
      </label>
    </div>
    <div class="filter-row" style="text-align: right; margin-top: 10px;">
      <button id="apply-filter">应用筛选</button>
      <button id="reset-filter" style="margin-left: 10px;">重置筛选</button>
    </div>
  `;

  container.appendChild(filterDiv);

  const tableContainer = document.createElement('div');
  tableContainer.id = 'history-data-container';
  container.appendChild(tableContainer);

  const paginationContainer = document.createElement('div');
  paginationContainer.id = 'pagination-controls';
  container.appendChild(paginationContainer);

  // 填充传感器名称选项
  const sensorNames = [...new Set(data.map(item => item.sensor_name))].sort();
  const filterNameSelect = filterDiv.querySelector('#filter-name');
  sensorNames.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    filterNameSelect.appendChild(option);
  });

  // 应用筛选按钮事件
  document.getElementById('apply-filter').addEventListener('click', () => {
    currentPage = 1; 
    renderPaginatedTable(data);
  });

  // 重置按钮事件
  document.getElementById('reset-filter').addEventListener('click', () => {
    // 清空所有筛选输入
    filterDiv.querySelectorAll('select, input').forEach(input => {
      input.value = '';
    });
    currentPage = 1;
    renderPaginatedTable(data);
  });
}

// === 表格 + 分页渲染 ===
let currentPage = 1;
const rowsPerPage = 10;

function renderPaginatedTable(fullData) {
  let filteredData = applyFilters(fullData);

  // 时间降序排序（不需要表头交互）
  filteredData = filteredData.slice().sort((a, b) => {
    return new Date(b.time) - new Date(a.time);
  });

  const tableContainer = document.getElementById('history-data-container');
  const paginationContainer = document.getElementById('pagination-controls');

  // 计算分页
  const startIdx = (currentPage - 1) * rowsPerPage;
  const endIdx = startIdx + rowsPerPage;
  const pagedData = filteredData.slice(startIdx, endIdx);

  // 表格HTML
  let html = '<table border="1" cellspacing="0" cellpadding="5">';
  html += `
  <thead><tr>
    <th>传感器名称</th>
    <th>时间</th>
    <th>温度 (℃)</th>
    <th>湿度 (%)</th>
    <th>土壤湿度 (%)</th>
    <th>光照 (lx)</th>
  </tr></thead><tbody>
  `;

  pagedData.forEach(item => {
    html += `<tr>
      <td>${item.sensor_name}</td>
      <td>${item.time}</td>
      <td>${item.temperature}</td>
      <td>${item.humidity}</td>
      <td>${item.soil_moisture}</td>
      <td>${item.light}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  tableContainer.innerHTML = html;

  // 分页控件
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  let paginationHtml = '';
  for (let i = 1; i <= totalPages; i++) {
    paginationHtml += `<button class="page-btn" data-page="${i}" ${i === currentPage ? 'disabled' : ''}>${i}</button>`;
  }
  paginationContainer.innerHTML = paginationHtml;

  // 绑定分页事件
  document.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.getAttribute('data-page'));
      renderPaginatedTable(fullData);
    });
  });
}

// === 筛选逻辑 ===
function applyFilters(data) {
  const name = document.getElementById('filter-name').value;
  const startDate = document.getElementById('filter-start-date').value;
  const endDate = document.getElementById('filter-end-date').value;

  const tempMin = parseFloat(document.getElementById('temp-min').value);
  const tempMax = parseFloat(document.getElementById('temp-max').value);
  const humMin = parseFloat(document.getElementById('hum-min').value);
  const humMax = parseFloat(document.getElementById('hum-max').value);
  const soilMin = parseFloat(document.getElementById('soil-min').value);
  const soilMax = parseFloat(document.getElementById('soil-max').value);
  const lightMin = parseFloat(document.getElementById('light-min').value);
  const lightMax = parseFloat(document.getElementById('light-max').value);

  return data.filter(item => {
    const itemDate = new Date(item.time).setHours(0,0,0,0);

    const start = startDate ? new Date(startDate).setHours(0,0,0,0) : null;
    const end = endDate ? new Date(endDate).setHours(23,59,59,999) : null;

    const dateMatch =
      (!start || itemDate >= start) &&
      (!end || itemDate <= end);

    return (!name || item.sensor_name === name) &&
      dateMatch &&
      (isNaN(tempMin) || parseFloat(item.temperature) >= tempMin) &&
      (isNaN(tempMax) || parseFloat(item.temperature) <= tempMax) &&
      (isNaN(humMin) || parseFloat(item.humidity) >= humMin) &&
      (isNaN(humMax) || parseFloat(item.humidity) <= humMax) &&
      (isNaN(soilMin) || parseFloat(item.soil_moisture) >= soilMin) &&
      (isNaN(soilMax) || parseFloat(item.soil_moisture) <= soilMax) &&
      (isNaN(lightMin) || parseFloat(item.light) >= lightMin) &&
      (isNaN(lightMax) || parseFloat(item.light) <= lightMax);
  });
}
// ===== 设置页面逻辑 =====

// 加载设置到表单
function loadSettings() {
  document.getElementById('refreshInterval').value =
    localStorage.getItem('refreshInterval') ?? defaultSettings.refreshInterval;
  document.getElementById('theme').value =
    localStorage.getItem('theme') ?? defaultSettings.theme;
  document.getElementById('tempThreshold').value =
    localStorage.getItem('tempThreshold') ?? defaultSettings.tempThreshold;
  document.getElementById('humThreshold').value =
    localStorage.getItem('humThreshold') ?? defaultSettings.humThreshold;
}

// 保存设置
function saveSettings() {
  localStorage.setItem('refreshInterval', document.getElementById('refreshInterval').value);
  localStorage.setItem('theme', document.getElementById('theme').value);
  localStorage.setItem('tempThreshold', document.getElementById('tempThreshold').value);
  localStorage.setItem('humThreshold', document.getElementById('humThreshold').value);
  alert('设置已保存！');
}

// 单项恢复默认
function resetRefreshInterval() {
  document.getElementById('refreshInterval').value = defaultSettings.refreshInterval;
  saveSettings();
}
function resetTempThreshold() {
  document.getElementById('tempThreshold').value = defaultSettings.tempThreshold;
  saveSettings();
}
function resetHumThreshold() {
  document.getElementById('humThreshold').value = defaultSettings.humThreshold;
  saveSettings();
}

// 恢复全部默认
function resetAllSettings() {
  resetRefreshInterval();
  resetTempThreshold();
  resetHumThreshold();
}

// 显示设置页面
function showSettings() {
  const container = document.querySelector('.main-data');
  container.querySelectorAll(':not(.blur-layer)').forEach(el => el.remove());

  container.insertAdjacentHTML('beforeend', `
    <h2>系统设置</h2>

    <div class="settings-group">
      <label>主题：
        <select id="theme">
          <option value="light">浅色</option>
          <option value="dark">深色</option>
        </select>
      </label>
    </div>
    
    <div class="settings-group">
      <label>刷新间隔（分钟）：
        <input type="number" id="refreshInterval" min="1" />
        <button class="reset-btn" id="resetRefreshInterval">恢复默认</button>
      </label>
    </div>

    <div class="settings-group">
      <label>温度报警阈值（℃）：
        <input type="number" id="tempThreshold" step="0.1" />
        <button class="reset-btn" id="resetTempThreshold">恢复默认</button>
      </label>
    </div>

    <div class="settings-group">
      <label>湿度报警阈值（%）：
        <input type="number" id="humThreshold" step="0.1" />
        <button class="reset-btn" id="resetHumThreshold">恢复默认</button>
      </label>
    </div>

    <div style="text-align: right; margin-top: 24px;">
        <button id="saveSettingsBtn">保存设置</button>
        <button id="resetAllBtn" style="margin-left: 10px;">恢复全部默认</button>
    </div>
  `);

  loadSettings();

  // 绑定事件
  document.getElementById('resetRefreshInterval').onclick = resetRefreshInterval;
  document.getElementById('resetTempThreshold').onclick = resetTempThreshold;
  document.getElementById('resetHumThreshold').onclick = resetHumThreshold;
  document.getElementById('saveSettingsBtn').onclick = saveSettings;
  document.getElementById('resetAllBtn').onclick = resetAllSettings;
}
