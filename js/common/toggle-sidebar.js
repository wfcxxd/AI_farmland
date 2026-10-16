/**
 * 侧栏收起/展开。
 * 之前这里给 body 挂的是 'sidebar-open'，但 common.css 里生效的类名是 'sidebar-collapsed'，
 * 两边对不上，所以按钮点了也没反应。现在统一由这里维护两个类。
 */
export function initSidebarToggle() {
  const btn = document.getElementById('sidebar-toggle');
  if (!btn) return;

  const isMobile = () => window.matchMedia('(max-width:768px)').matches;

  const render = (open) => {
    document.body.classList.toggle('sidebar-open', open);
    document.body.classList.toggle('sidebar-collapsed', !open);
    btn.textContent = open ? '‹' : '›';
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? '收起导航' : '展开导航');
    localStorage.setItem('sidebarOpen', open ? '1' : '0');
  };

  const isOpen = () => document.body.classList.contains('sidebar-open');

  btn.addEventListener('click', () => render(!isOpen()));

  const saved = localStorage.getItem('sidebarOpen');
  if (isMobile()) {
    render(saved === '1');
  } else {
    render(true); // 桌面端默认展开
  }

  window.matchMedia('(max-width:768px)').addEventListener('change', (e) => {
    if (e.matches) {
      render(localStorage.getItem('sidebarOpen') === '1');
    } else {
      render(true);
    }
  });
}
