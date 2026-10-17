/* ============ config.js · 网络层：后端地址 / 请求封装 / 取数 ============ */
import { mockFetch } from "./mock-api.js";

/* 可调参数。改数值就是改这里 */
export const NETWORK_CONFIG = {
  timeout: 8000,        // 请求超时（毫秒）
  chartLimit: 500,      // 主页与图表页单次取多少条
  historyLimit: 1000,   // 历史页单次取多少条（后端上限 1000）
};

/* 后端地址。换服务器改这一行 */
const PROD_API_BASE = "http://119.45.214.98:9000";

/* 从本机打开时改用同源地址；要加新的本机域名，改这个判断 */
const isLocalPreview =
  typeof location !== "undefined" &&
  (location.hostname === "localhost" || location.hostname === "127.0.0.1");

export const API_BASE = isLocalPreview ? "" : PROD_API_BASE;

/*
 * 是否使用模拟数据。规则：本机默认关闭、线上默认开启，
 * 可用网址参数强制切换：?demo=1 开启，?demo=0 关闭。
 */
const demoParam =
  typeof location !== "undefined"
    ? new URLSearchParams(location.search).get("demo")
    : null;

export const USE_MOCK =
  demoParam === "0" || demoParam === "off"
    ? false
    : demoParam === "1" || demoParam === "on"
      ? true
      : !isLocalPreview;

/* ============ 请求封装 ============ */

/**
 * 带超时的 GET，返回解析后的 JSON。
 * @param {string} path 以 / 开头的接口路径
 */
export async function fetchJSON(path, { timeout = NETWORK_CONFIG.timeout } = {}) {
  if (USE_MOCK) return (await mockFetch(path)).json();

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
 * 拉传感器数据。兼容后端两种返回格式：纯数组，或 { rows: [...] }。
 * @param {number} limit 单次最多取多少条
 */
export async function fetchSensorData(limit = NETWORK_CONFIG.chartLimit) {
  const json = await fetchJSON(`/all_sensor_data?limit=${limit}`);

  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.rows)) return json.rows;

  throw new Error("接口返回格式不是数组，也不含 rows 字段");
}
