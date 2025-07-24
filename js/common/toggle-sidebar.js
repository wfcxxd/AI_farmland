export function initSidebarToggle(){
  const btn  = document.getElementById('sidebar-toggle');
  if(!btn) return;

  const isMobile = () => window.matchMedia('(max-width:768px)').matches;

  const open  = () => {
    document.body.classList.add('sidebar-open');
    btn.setAttribute('aria-expanded', 'true');
    localStorage.setItem('sidebarOpen', '1');
  };
  const close = () => {
    document.body.classList.remove('sidebar-open');
    btn.setAttribute('aria-expanded', 'false');
    localStorage.setItem('sidebarOpen', '0');
  };
  const toggle = () => (document.body.classList.contains('sidebar-open') ? close() : open());

  btn.addEventListener('click', toggle);

  const saved = localStorage.getItem('sidebarOpen');
  if (isMobile()) {
    saved === '1' ? open() : close();
  } else {
    open();
  }

  window.matchMedia('(max-width:768px)').addEventListener('change', e=>{
    if(e.matches){
      const saved2 = localStorage.getItem('sidebarOpen');
      saved2 === '1' ? open() : close();
    }else{
      open();
    }
  });
}
