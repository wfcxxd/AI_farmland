/**
 * 前端模拟后端（Demo 数据）。
 *
 * 为什么需要它：GitHub Pages 是纯静态托管，没有服务端，
 * 而原来的后端（119.45.214.98）已经停服。所以把"造数据"这一步
 * 搬到浏览器里跑，效果和真实后端一样 —— 页面照常拿数据、照常自动刷新。
 *
 * 部署后无需任何配置：只要不是从 localhost 打开，就自动启用。
 * 想临时关掉看真实接口，在网址后面加 ?demo=0
 *   https://wfcxxd.github.io/AI_farmland/html/home.html?demo=0
 *
 * 数据特征（和 server/dev-server.js 保持一致，改的时候两边都改）：
 *   4 个传感器 × 最近 24 小时，每 10 分钟一条 = 576 条
 *   数值随昼夜变化：白天温度高、湿度低、光照强，夜里反过来
 */

/* 传感器配置：baseT 温度基准 / baseH 湿度 / baseS 土壤湿度 / baseL 光照基准 */
const SENSORS = [
  { id: "A区-01", baseT: 24, baseH: 62, baseS: 45, baseL: 900 },
  { id: "A区-02", baseT: 26, baseH: 55, baseS: 38, baseL: 1100 },
  { id: "B区-01", baseT: 22, baseH: 70, baseS: 55, baseL: 700 },
  { id: "B区-02", baseT: 28, baseH: 48, baseS: 32, baseL: 1300 },
];

/** 最近 24 小时，每 10 分钟一个点 */
const POINTS = 144;
const STEP_MS = 10 * 60 * 1000;

/** 保留两位小数，和真实后端返回的精度一致 */
const round = (n, d = 2) => Number(n.toFixed(d));

/** 每条数据的抖动幅度：让相邻两次请求的数值有细微变化，看起来像实时采集 */
const JITTER = {
  temperature: 0.6,
  humidity: 1.0,
  soil_moisture: 0.8,
  light: 60,
};

/**
 * 生成一个"截至此刻"的数据快照。
 *
 * 关键设计：最新一条的时间锚定在「当前分钟」，
 * 所以每次调用（自动刷新会周期性调用）拿到的时间戳都会往前走，
 * 页面上的「更新于 xx:xx」就会真的变化。
 */
export function generateSnapshot() {
  const now = Date.now();
  // 对齐到整分钟，避免同一分钟内多次刷新出现毫秒级跳动
  const anchor = Math.floor(now / 60000) * 60000;
  const rows = [];

  for (const s of SENSORS) {
    for (let i = POINTS - 1; i >= 0; i--) {
      const ts = new Date(anchor - i * STEP_MS);
      // 日内相位：约 14:00 达到峰值（hour 8 起步，正弦周期 24 小时）
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

    // 真实后端返回的是「按时间倒序」，最新的一条在最前面。
    // 必须照这个顺序，否则 limit 截断会把最新的数据切掉。
    const rows = generateSnapshot()
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);

    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ rows, nextPageState: null }),
    });
  }

  // 其它接口目前没有，返回 404 让调用方走正常的错误处理
  return Promise.resolve({
    ok: false,
    status: 404,
    json: () => Promise.resolve({}),
  });
}
