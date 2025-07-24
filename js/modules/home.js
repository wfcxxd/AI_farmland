export function showHome(container) {
  const blur = container.querySelector('.blur-layer');
  if (blur) blur.remove();

  container.insertAdjacentHTML(
    "beforeend",
    `
    <div class="home-grid">
      <div class="home-block block-1">
        <h3>区块一：欢迎信息</h3>
        <p id="currentTime">加载时间中...</p>
        <p>这里可以放系统简介、通知等内容。</p>
      </div>

      <div class="home-block block-2">
        <h3>区块二：环境提醒</h3>
        <p>这里展示阈值状态、预警信息或传感器摘要。</p>
      </div>

      <div class="home-block block-3">
        <h3>区块三：说明或动态展示</h3>
        <p>可以在此展示简略图表、动态轮播等。</p>
      </div>
    </div>
    `
  );
  updateTime();
}

let homeTimer = null;

export function startHomeAutoRefresh() {
  updateTime();
  homeTimer = setInterval(updateTime, 1000);
}

export function stopHomeAutoRefresh() {
  if (homeTimer) {
    clearInterval(homeTimer);
    homeTimer = null;
  }
}

function updateTime() {
  const now = new Date();
  const timeEl = document.getElementById("currentTime");
  if (timeEl) {
    timeEl.textContent = "当前时间：" + now.toLocaleString("zh-CN");
  }
}