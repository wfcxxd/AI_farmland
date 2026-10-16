/**
 * 网络层：后端地址、请求封装、返回格式兼容。
 *
 * 全站所有取数都走这里，页面里不要再直接写 fetch。
 */

/* ---------------------------------------------------------------
 * 可调参数
 * --------------------------------------------------------------- */
export const NETWORK_CONFIG = {
  /** 请求超时（毫秒）。后端不可达时浏览器默认会挂很久，
   *  页面就一直停在「加载中」；8 秒拿不到响应就主动放弃。 */
  timeout: 8000,

  /** 图表页/主页单次取多少条。
   *  图表只用最近 12 条，500 条足够还留了容错；取太多纯属浪费流量。 */
  chartLimit: 500,

  /** 历史页单次取多少条。
   *  历史页要翻页，取少了页数太少；1000 是后端允许的上限。 */
  historyLimit: 1000,
};

/* ---------------------------------------------------------------
 * 后端地址
 *
 * 线上地址写在这里；从 localhost / 127.0.0.1 打开时自动改用同源地址，
 * 配合 dev-server.js 就能用假数据本地预览，不依赖线上后端。
 * --------------------------------------------------------------- */
const PROD_API_BASE = "http://119.45.214.98:9000";

const isLocalPreview =
  typeof location !== "undefined" &&
  (location.hostname === "localhost" || location.hostname === "127.0.0.1");

export const API_BASE = isLocalPreview ? "" : PROD_API_BASE;

/* ---------------------------------------------------------------
 * 请求
 * --------------------------------------------------------------- */

/**
 * 带超时的 GET，返回解析后的 JSON。
 * @param {string} path 以 / 开头的接口路径
 */
export async function fetchJSON(path, { timeout = NETWORK_CONFIG.timeout } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`接口返回 ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`请求超时（${timeout / 1000}s），请检查后端服务是否可用`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 拉传感器数据，并兼容后端的两种返回格式。
 *
 * 后端为了限制单次返回量加了分页，返回可能是：
 *   1) 旧格式：直接是一个数组
 *   2) 新格式：{ rows: [...], nextPageState: ... }
 * 这里统一成数组，调用方不用关心后端用的是哪种。
 *
 * @param {number} limit 单次最多取多少条，默认取图表页的量
 */
export async function fetchSensorData(limit = NETWORK_CONFIG.chartLimit) {
  const json = await fetchJSON(`/all_sensor_data?limit=${limit}`);

  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.rows)) return json.rows;

  throw new Error("接口返回格式不是数组，也不含 rows 字段");
}
