// 设置背景图片
const images = [
  'images/bj1.PNG',
  'images/bj2.PNG',
  'images/bj3.PNG',
  'images/bj4.JPG',
  'images/bj5.PNG',
  'images/bj6.JPG'
];
const selectedImage = images[Math.floor(Math.random() * images.length)];
document.querySelector('.background').style.backgroundImage = `url('${selectedImage}')`;

// 设置音乐
const musicList = [
  'music/Minecraft.m4a',
  'music/Danny.m4a'
];
const randomMusic = musicList[Math.floor(Math.random() * musicList.length)];
const bgm = document.getElementById('bgm');
bgm.src = randomMusic;

// 自动播放失败时等待用户点击恢复
document.addEventListener('click', () => {
  bgm.muted = false;
  bgm.play().catch((e) => {
    console.warn('播放失败：', e);
  });
}, { once: true }); // 只监听一次点击事件

// 密码可见性切换
function togglePassword() {
  const password = document.getElementById('password');
  const toggleBtn = document.querySelector('.toggle-password img');

  if (password.type === 'password') {
    password.type = 'text';
    toggleBtn.src = 'images/hide.png';
    toggleBtn.alt = '隐藏密码';
  } else {
    password.type = 'password';
    toggleBtn.src = 'images/show.png';
    toggleBtn.alt = '显示密码';
  }
}

// 登录验证
document.getElementById('loginform').addEventListener('submit', function (e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorMsg = document.getElementById('errormessage');

  if (username === 'admin' && password === '123456') {
    errorMsg.textContent = '';
    errorMsg.style.display = 'none';
    alert('登录成功！');
    window.location.href = 'html/home.html';
  } else {
    errorMsg.textContent = '用户名或密码错误，请重新输入';
    errorMsg.style.display = 'block';
  }
});
