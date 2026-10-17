/* ============ mock-api.js · 模拟后端：在浏览器里生成数据 ============ */

/* 传感器列表与各自的基准值。增删传感器、改数值范围都改这里 */
const SENSORS = [
  { id: "A区-01", baseT: 24, baseH: 62, baseS: 45, baseL: 900 },
  { id: "A区-02", baseT: 26, baseH: 55, baseS: 38, baseL: 1100 },
  { id: "B区-01", baseT: 22, baseH: 70, baseS: 55, baseL: 700 },
  { id: "B区-02", baseT: 28, baseH: 48, baseS: 32, baseL: 1300 },
];

/* 数据密度：POINTS 条 × 每条间隔 STEP_MS 毫秒。改这两个调整时间跨度 */
const POINTS = 144;
const STEP_MS = 10 * 60 * 1000;

/* 保留两位小数 */
const round = (n, d = 2) => Number(n.toFixed(d));

/* 每次取值的随机抖动幅度。调大数值波动更明显，调 0 则完全稳定 */
const JITTER = {
  temperature: 0.6,
  humidity: 1.0,
  soil_moisture: 0.8,
  light: 60,
};

/**
 * 生成一份截至此刻的数据快照，最新一条锚定在当前分钟。
 * 这里决定数值随时间怎么变（昼夜曲线），改这段就是改变化规律。
 */
export function generateSnapshot() {
  const now = Date.now();
  // 对齐到整分钟，避免毫秒跳动
  const anchor = Math.floor(now / 60000) * 60000;
  const rows = [];

  for (const s of SENSORS) {
    for (let i = POINTS - 1; i >= 0; i--) {
      const ts = new Date(anchor - i * STEP_MS);
      // 日内相位：约 14:00 达到峰值。改 -8 这个偏移可移动峰值时刻
      const hour = ts.getHours() + ts.getMinutes() / 60;
      const phase = Math.sin(((hour - 8) / 24) * 2 * Math.PI);
      const rnd = () => (Math.random() - 0.5) * 2;

      rows.push({
        sensor_id: s.id,
        timestamp: ts.toISOString(),
        temperature: round(s.baseT + phase * 7 + rnd() * JITTER.temperature),
        humidity: round(s.baseH - phase * 12 + rnd() * JITTER.humidity),
        soil_moisture: round(s.baseS - phase * 6 + rnd() * JITTER.soil_moisture),
        light: Math.max(0, Math.round(s.baseL + phase * 800 + rnd() * JITTER.light)),
      });
    }
  }

  return rows;
}

/**
 * 模拟后端的接口响应。
 * @param {string} path 形如 "/all_sensor_data?limit=500"
 */
export function mockFetch(path) {
  const url = new URL(path, "http://demo.local");

  if (url.pathname === "/all_sensor_data") {
    const limit = Number(url.searchParams.get("limit")) || 500;

    // 按时间倒序，和真实后端一致；顺序错了 limit 截断会切掉最新数据
    const rows = generateSnapshot()
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);

    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ rows, nextPageState: null }),
    });
  }

  // 未实现的接口返回 404
  return Promise.resolve({
    ok: false,
    status: 404,
    json: () => Promise.resolve({}),
  });
}
