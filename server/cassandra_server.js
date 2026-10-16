// cassandra_server.js

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cassandra = require('cassandra-driver');
const { v4: uuidv4 } = require('uuid');
const dgram = require('dgram'); // 新增：UDP

const app = express();
const httpPort = 9000;      // HTTP 端口（保持原来）
const udpPort = 9001;       // NB 模块发 UDP 的端口，要和固件 NB_SRV_PORT 一致

app.use(bodyParser.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Cassandra 客户端
const client = new cassandra.Client({
  contactPoints: ['127.0.0.1'],
  localDataCenter: 'datacenter1',
  protocolOptions: { port: 9042 },
  keyspace: 'stm_32'
});

// 统一的插入函数：HTTP 和 UDP 都用它
const insertSensorDataQuery = `
  INSERT INTO sensor_data (sensor_id, timestamp, temperature, humidity, light, soil_moisture)
  VALUES (?, ?, ?, ?, ?, ?)`;

const insertAllDataQuery = `
  INSERT INTO all_sensor_data (id, sensor_id, timestamp, temperature, humidity, light, soil_moisture)
  VALUES (?, ?, ?, ?, ?, ?, ?)`;

/**
 * 通用插入函数
 * data = {
 *   sensor_id: string,
 *   timestamp: Date,
 *   temperature: number | null,
 *   humidity: number | null,
 *   light: number | null,
 *   soil_moisture: number | null
 * }
 */
async function insertSensorData(data) {
  const { sensor_id, timestamp, temperature, humidity, light, soil_moisture } = data;

  if (!sensor_id || !timestamp) {
    throw new Error('sensor_id 和 timestamp 是必须的');
  }

  const params1 = [sensor_id, timestamp, temperature, humidity, light, soil_moisture];
  const params2 = [uuidv4(), sensor_id, timestamp, temperature, humidity, light, soil_moisture];

  await Promise.all([
    client.execute(insertSensorDataQuery, params1, { prepare: true }),
    client.execute(insertAllDataQuery, params2, { prepare: true })
  ]);
}

/* =========================================================================
 * 1. HTTP 接口（保持原来逻辑，只是改成用 insertSensorData）
 * ========================================================================= */

app.post('/sensor_data', async (req, res) => {
  try {
    const { sensor_id, timestamp, temperature, humidity, light, soil_moisture } = req.body;

    if (!sensor_id || !timestamp) {
      return res.status(400).json({ error: 'sensor_id 和 timestamp 是必须的' });
    }

    await insertSensorData({
      sensor_id,
      timestamp: new Date(timestamp),
      temperature,
      humidity,
      light,
      soil_moisture
    });

    res.json({ message: '插入成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 查询所有历史数据（不限制 sensor_id）
app.get('/all_sensor_data', async (req, res) => {
  try {
    const result = await client.execute('SELECT * FROM all_sensor_data');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除数据接口
app.delete('/sensor_data', async (req, res) => {
  const { sensor_id, timestamp } = req.body;
  if (!sensor_id || !timestamp) {
    return res.status(400).json({ error: 'sensor_id 和 timestamp 是必须的' });
  }
  const query = 'DELETE FROM sensor_data WHERE sensor_id = ? AND timestamp = ?';
  const params = [sensor_id, new Date(timestamp)];
  try {
    await client.execute(query, params, { prepare: true });
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新数据接口
app.put('/sensor_data', async (req, res) => {
  const { sensor_id, timestamp, temperature, humidity, light, soil_moisture } = req.body;
  if (!sensor_id || !timestamp) {
    return res.status(400).json({ error: 'sensor_id 和 timestamp 是必须的' });
  }
  const query = `
    UPDATE sensor_data SET temperature = ?, humidity = ?, light = ?, soil_moisture = ?
    WHERE sensor_id = ? AND timestamp = ?`;
  const params = [temperature, humidity, light, soil_moisture, sensor_id, new Date(timestamp)];
  try {
    await client.execute(query, params, { prepare: true });
    res.json({ message: '更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================================
 * 2. NB UDP 网关：监听 9001 端口，把 NB 的一行字符串写进 Cassandra
 * ========================================================================= */

function startNbUdpServer() {
  const udpServer = dgram.createSocket('udp4');

  udpServer.on('listening', () => {
    const addr = udpServer.address();
    console.log(`NB UDP server listening on ${addr.address}:${addr.port}`);
  });

  udpServer.on('error', (err) => {
    console.error('NB UDP server error:', err);
  });

  udpServer.on('message', async (msg, rinfo) => {
    const line = msg.toString('utf8').trim();
    console.log('[NB-UDP] recv:', line, 'from', rinfo.address, rinfo.port);

    // 预期格式: "VDD=3210 T=26C H=57% L=123"
    const parts = line.split(/\s+/);

    let vdd = null;
    let temp = null;
    let humi = null;
    let lux = null;
    let sensorId = 'nb01'; // 如果只有一块板子，先写死；以后可以在报文里加 ID=XXX

    for (const p of parts) {
      const [kRaw, vRaw] = p.split('=');
      if (!kRaw || vRaw === undefined) continue;

      const k = kRaw.toUpperCase();
      const numStr = vRaw.replace(/[^\d.-]/g, ''); // 去掉 "C" "%"

      if (k === 'ID') {
        // 预留：如果以后固件里加了 ID=NODE1 之类
        sensorId = vRaw;
        continue;
      }

      const n = Number(numStr);
      if (Number.isNaN(n)) continue;

      switch (k) {
        case 'VDD': vdd = n; break;
        case 'T':   temp = n; break;
        case 'H':   humi = n; break;
        case 'L':   lux  = n; break;
        default: break;
      }
    }

    // soil_moisture 目前 NB 没上报，先写 null
    const now = new Date();

    try {
      await insertSensorData({
        sensor_id: sensorId,
        timestamp: now,
        temperature: temp,
        humidity: humi,
        light: lux,
        soil_moisture: null
      });

      console.log(`[NB-UDP] saved data: sensor_id=${sensorId}, time=${now.toISOString()}, T=${temp}, H=${humi}, L=${lux}, VDD=${vdd}`);
    } catch (err) {
      console.error('[NB-UDP] save error:', err);
    }
  });

  udpServer.bind(udpPort, '0.0.0.0');
}

/* =========================================================================
 * 3. 启动顺序：先连 Cassandra，再开 HTTP + UDP
 * ========================================================================= */

client.connect()
  .then(() => {
    console.log('连接 Cassandra 成功');

    app.get('/', (req, res) => {
      res.send('服务正常运行');
    });

    // HTTP
    app.listen(httpPort, '0.0.0.0')
      .on('listening', () => {
        console.log(`HTTP 服务器运行在 http://0.0.0.0:${httpPort}`);
      })
      .on('error', (err) => {
        console.error('HTTP 端口监听失败:', err.message);
      });

    // NB UDP
    startNbUdpServer();
  })
  .catch(err => {
    console.error('连接 Cassandra 失败:', err.message);
  });
