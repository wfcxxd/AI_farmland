# AI_farmland — 智慧农田监测系统

基于 NB-IoT 上报数据的农田环境监测与展示系统。

## 组成

| 部分 | 位置 | 说明 |
| --- | --- | --- |
| 前端 | `index.html` + `html/` + `css/` + `js/` | 原生 ES Module，无构建步骤，直接静态托管即可 |
| 后端 | `server/cassandra_server.js` | Express + Cassandra，同时开 HTTP(9000) 和 UDP(9001) |
| 数据 | Cassandra keyspace `stm_32` | 表 `sensor_data`、`all_sensor_data` |

## 数据流

```
NB-IoT 模块 --UDP:9001--> cassandra_server --+--> sensor_data
                                             +--> all_sensor_data
浏览器 --HTTP:9000/all_sensor_data------------^
```

NB 模块上报纸文格式：`VDD=3210 T=26C H=57% L=123`（可选 `ID=NODE1` 指定传感器编号）。


## 演示模式（模拟后端）

原后端服务器已停服，而 GitHub Pages 是纯静态托管、没有服务端，直接部署上去
页面会取不到数据。所以 `js/modules/mock-api.js` 在浏览器里生成一套模拟数据，
效果和真实后端一致：**4 个传感器 × 最近 24 小时，每 10 分钟一条，共 576 条**，
数值随昼夜变化（白天温度高、湿度低、光照强）。

## 项目结构

```
.
├── index.html / index.js / index.css   登录页
├── html/          四个内页
├── css/
│   ├── common.css     
│   ├── home.css       主页
│   ├── details.css    数据图表页
│   ├── history.css    历史数据页
│   └── settings.css   设置页
├── js/
│   ├── common/     通用能力
│   │   ├── theme.js        深浅主题切换
│   │   ├── toggle-sidebar.js  侧栏收起/展开
│   │   ├── background-helper.js
│   │   ├── messages.js     全站提示文案
│   │   └── ui.js           空状态/错误的统一渲染
│   ├── entries/    每个页面的装配入口
│   └── modules/
│       ├── config.js     后端地址、请求封装、取数
│       ├── mock-api.js   演示模式下在浏览器里生成数据
│       ├── settings.js   设置项的读写与阈值判断
│       ├── home.js       主页仪表盘
│       ├── details.js    数据图表页
│       ├── history.js    历史数据页
│       └── farm/         像素农田动画
├── images/ music/ 素材
└── server/       
```