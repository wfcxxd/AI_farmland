const defaultSettingsLocal = {
  refreshInterval: 1,
  theme: "light",
  tempThreshold: 35.0,
  humThreshold: 70.0,
};

export function showSettings(container) {
  container.querySelectorAll(":not(.blur-layer)").forEach((el) => el.remove());
  container.insertAdjacentHTML(
    "beforeend",
    `
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

    <div style="text-align:right;margin-top:24px;">
      <button id="saveSettingsBtn">保存设置</button>
      <button id="resetAllBtn" style="margin-left: 10px;">恢复全部默认</button>
    </div>
  `
  );

  loadSettings();

  document.getElementById("resetRefreshInterval").onclick = () => resetField("refreshInterval");
  document.getElementById("resetTempThreshold").onclick = () => resetField("tempThreshold");
  document.getElementById("resetHumThreshold").onclick = () => resetField("humThreshold");
  document.getElementById("saveSettingsBtn").onclick = saveSettings;
  document.getElementById("resetAllBtn").onclick = resetAllSettings;
}

function loadSettings() {
  const theme = localStorage.getItem("theme") ?? defaultSettingsLocal.theme;
  document.getElementById("theme").value = theme;
  document.body.classList.remove("theme-light", "theme-dark");
  document.body.classList.add(`theme-${theme}`);

  document.getElementById("refreshInterval").value =
    localStorage.getItem("refreshInterval") ?? defaultSettingsLocal.refreshInterval;
  document.getElementById("theme").value = localStorage.getItem("theme") ?? defaultSettingsLocal.theme;
  document.getElementById("tempThreshold").value =
    localStorage.getItem("tempThreshold") ?? defaultSettingsLocal.tempThreshold;
  document.getElementById("humThreshold").value =
    localStorage.getItem("humThreshold") ?? defaultSettingsLocal.humThreshold;
}

function saveSettings() {
  const theme = document.getElementById("theme").value;
  localStorage.setItem("theme", theme);
  document.body.classList.remove("theme-light", "theme-dark");
  document.body.classList.add(`theme-${theme}`);
  
  localStorage.setItem("refreshInterval", document.getElementById("refreshInterval").value);
  localStorage.setItem("theme", document.getElementById("theme").value);
  localStorage.setItem("tempThreshold", document.getElementById("tempThreshold").value);
  localStorage.setItem("humThreshold", document.getElementById("humThreshold").value);
  alert("设置已保存！");
}

function resetField(field) {
  document.getElementById(field).value = defaultSettingsLocal[field];
  saveSettings();
}

function resetAllSettings() {
  Object.keys(defaultSettingsLocal).forEach((key) => localStorage.removeItem(key));
  loadSettings();
}
