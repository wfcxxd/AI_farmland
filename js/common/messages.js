/* ============ messages.js · 全站提示文案 ============ */
export const MSG = {
  /* 加载中 */
  loadingDash: "正在读取传感器数据…",
  loadingHistory: "正在加载历史数据…",
  loadingAlarm: "正在检查…",

  /* 空状态 */
  noSensorAtAll: "暂无传感器数据",
  noSensorForOne: "该传感器暂无数据",
  noHistory: "暂无历史数据",
  noAlarmData: "暂无数据可判断",
  noFilterMatch: "没有符合条件的数据，试试放宽筛选条件",
  allNormal: "全部正常，无告警",

  /**
   * 取数失败。
   * @param {string} why 失败原因（一般是 err.message）
   * @param {string} [what] 取的是什么，比如「历史数据」
   */
  fetchFailed: (why, what) => `${what ? what + "获取" : "数据获取"}失败：${why}`,
};

/** 页面里统一的短标签（主机名/表头之类） */
export const LABEL = {
  updatedAt: (time) => `更新于 ${time}`,
};
