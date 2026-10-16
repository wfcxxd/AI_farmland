import { applyTheme, saveTheme, getTheme } from "../common/theme.js";

const defaultSettingsLocal = {
  refreshInterval: 30, // 单位：分钟
  theme: "light",
  tempThreshold: 35.0,
  humThreshold: 70.0,
};

/**
 * 读一个数值设置，非法值回落到默认。
 *
 * 注意：localStorage 没存过时 getItem 返回 null，而 Number(null) === 0，
 * 所以必须先判 null —— 否则新浏览器（或清过缓存）下阈值会静默变成 0，
 * 温度一超过 0℃ 就报「已超限」，湿度阈值变成 0 又永远不告警。
 */
function readNumber(key) {
  const raw = localStorage.getItem(key);
  if (raw === null || raw === "") return defaultSettingsLocal[key];
  const v = Number(raw);
  return Number.isFinite(v) ? v : defaultSettingsLocal[key];
}

/** 把「刷新间隔（分钟）」读成毫秒，供数据页轮询使用 */
export function getRefreshIntervalMs() {
  const minutes = readNumber("refreshInterval");
  const safe = minutes > 0 ? minutes : defaultSettingsLocal.refreshInterval;
  return safe * 60 * 1000;
}

/* ---------------------------------------------------------------
 * 报警阈值的读写接口。
 * 主页的仪表盘用它们来判断是否告警，这样「设置页改阈值 → 主页生效」
 * 走的是同一份数据（localStorage），不需要额外的状态管理。
 * --------------------------------------------------------------- */

/** 温度报警阈值（℃）：超过即告警 */
export function getTempThreshold() {
  return readNumber("tempThreshold");
}

/** 湿度报警阈值（%）：低于它即告警（湿度不足比过高更常见） */
export function getHumThreshold() {
  return readNumber("humThreshold");
}

/** 湿度是否低于阈值 */
export function isHumAlarm(humidity) {
  const v = Number(humidity);
  return Number.isFinite(v) && v < getHumThreshold();
}

/** 温度是否超过阈值 */
export function isTempAlarm(temperature) {
  const v = Number(temperature);
  return Number.isFinite(v) && v > getTempThreshold();
}

/** 一次性拿到全部阈值，省得调用方多次读 localStorage */
export function getThresholds() {
  return {
    temp: getTempThreshold(),
    hum: getHumThreshold(),
    refreshMinutes: readNumber("refreshInterval"),
  };
}

export function showSettings(container) {
  container.querySelectorAll(":not(.blur-layer)").forEach((el) => el.remove());
  container.insertAdjacentHTML(
    "beforeend",
    `
    <h2 class="settings-title">系统设置</h2>

    <div class="settings-card">
      <h3>外观主题</h3>
      <p class="settings-hint">挑一个，整个系统（包括图表）会立刻跟着变。</p>
      <div class="theme-picker" id="themePicker">
        <button type="button" class="theme-card" data-theme="light">
          <span class="theme-preview theme-preview-light">
            <span class="tp-bar"></span>
            <span class="tp-side"></span>
            <span class="tp-block"></span>
          </span>
          <span class="theme-name">浅色模式</span>
        </button>
        <button type="button" class="theme-card" data-theme="dark">
          <span class="theme-preview theme-preview-dark">
            <span class="tp-bar"></span>
            <span class="tp-side"></span>
            <span class="tp-block"></span>
          </span>
          <span class="theme-name">深色模式</span>
        </button>
      </div>
    </div>

    <div class="settings-card">
      <h3>数据刷新</h3>
      <p class="settings-hint">图表页多久拉一次最新数据。</p>
      <div class="settings-group">
        <label for="refreshInterval">刷新间隔（分钟）</label>
        <div class="settings-control">
          <input type="number" id="refreshInterval" min="1" />
          <button type="button" class="reset-btn" id="resetRefreshInterval">恢复默认</button>
        </div>
      </div>
    </div>

    <div class="settings-card">
      <h3>报警阈值</h3>
      <p class="settings-hint">超过阈值时主页会给出提醒。</p>
      <div class="settings-group">
        <label for="tempThreshold">温度报警阈值（℃）</label>
        <div class="settings-control">
          <input type="number" id="tempThreshold" step="0.1" />
          <button type="button" class="reset-btn" id="resetTempThreshold">恢复默认</button>
        </div>
      </div>
      <div class="settings-group">
        <label for="humThreshold">湿度报警阈值（%）</label>
        <div class="settings-control">
          <input type="number" id="humThreshold" step="0.1" />
          <button type="button" class="reset-btn" id="resetHumThreshold">恢复默认</button>
        </div>
      </div>
    </div>

    <div class="settings-actions">
      <button id="saveSettingsBtn">保存设置</button>
      <button id="resetAllBtn">恢复全部默认</button>
    </div>
  `
  );

  loadSettings();
  bindThemePicker();

  document.getElementById("resetRefreshInterval").onclick = () => resetField("refreshInterval");
  document.getElementById("resetTempThreshold").onclick = () => resetField("tempThreshold");
  document.getElementById("resetHumThreshold").onclick = () => resetField("humThreshold");
  document.getElementById("saveSettingsBtn").onclick = saveSettings;
  document.getElementById("resetAllBtn").onclick = resetAllSettings;
}

/** 主题卡片：点一下立刻预览并落盘，不用等「保存设置」 */
function bindThemePicker() {
  const picker = document.getElementById("themePicker");
  if (!picker) return;

  const sync = (theme) => {
    picker.querySelectorAll(".theme-card").forEach((card) => {
      const on = card.dataset.theme === theme;
      card.classList.toggle("is-selected", on);
      card.setAttribute("aria-pressed", String(on));
    });
  };

  picker.querySelectorAll(".theme-card").forEach((card) => {
    card.addEventListener("click", () => {
      sync(saveTheme(card.dataset.theme));
    });
  });

  sync(getTheme());
}

function loadSettings() {
  document.getElementById("refreshInterval").value =
    localStorage.getItem("refreshInterval") ?? defaultSettingsLocal.refreshInterval;
  document.getElementById("tempThreshold").value =
    localStorage.getItem("tempThreshold") ?? defaultSettingsLocal.tempThreshold;
  document.getElementById("humThreshold").value =
    localStorage.getItem("humThreshold") ?? defaultSettingsLocal.humThreshold;
}

function saveSettings() {
  localStorage.setItem("refreshInterval", document.getElementById("refreshInterval").value);
  localStorage.setItem("tempThreshold", document.getElementById("tempThreshold").value);
  localStorage.setItem("humThreshold", document.getElementById("humThreshold").value);
  alert("设置已保存！");
}

function resetField(field) {
  document.getElementById(field).value = defaultSettingsLocal[field];
}

function resetAllSettings() {
  Object.keys(defaultSettingsLocal).forEach((key) => localStorage.removeItem(key));
  loadSettings();
  saveTheme(defaultSettingsLocal.theme);
}
