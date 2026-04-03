const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Khởi tạo file db.json nếu chưa có
const DB_FILE = 'db.json';
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ responses: [] }, null, 2));
}

// Đọc dữ liệu
function readDB() {
  const data = fs.readFileSync(DB_FILE, 'utf8');
  return JSON.parse(data);
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// API nhận phản hồi
app.post('/api/submit', (req, res) => {
  try {
    const db = readDB();
    const newResp = req.body;
    newResp.id = Date.now();
    newResp.submittedAt = new Date().toISOString();
    db.responses.push(newResp);
    writeDB(db);
    res.json({ success: true, id: newResp.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// API lấy thống kê
app.get('/api/admin/stats', (req, res) => {
  try {
    const db = readDB();
    const responses = db.responses;
    const total = responses.length;

    const genderCount = { Nam: 0, Nữ: 0 };
    const ageGroups = {};
    const jobCount = {};
    const durationCount = {};
    const likertAvg = {
      tc1:0, tc2:0, tc3:0,
      dapung1:0, dapung2:0,
      bm1:0, bm2:0,
      deDung1:0, deDung2:0,
      ht1:0, ht2:0,
      haiLong:0
    };
    const featureFreq = {};
    const difficultyFreq = {};

    responses.forEach(r => {
      if (r.gender) genderCount[r.gender] = (genderCount[r.gender]||0)+1;
      if (r.age) ageGroups[r.age] = (ageGroups[r.age]||0)+1;
      if (r.job) jobCount[r.job] = (jobCount[r.job]||0)+1;
      if (r.duration) durationCount[r.duration] = (durationCount[r.duration]||0)+1;

      for (let key in likertAvg) {
        if (r[key]) likertAvg[key] += r[key];
      }
      (r.features || []).forEach(f => featureFreq[f] = (featureFreq[f]||0)+1);
      (r.difficulties || []).forEach(d => difficultyFreq[d] = (difficultyFreq[d]||0)+1);
    });

    if (total > 0) {
      for (let key in likertAvg) likertAvg[key] = +(likertAvg[key] / total).toFixed(2);
    }

    res.json({
      total,
      genderCount,
      ageGroups,
      jobCount,
      durationCount,
      likertAvg,
      featureFreq,
      difficultyFreq,
      rawResponses: responses.slice(-100).reverse()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Trang admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(` Server running at http://localhost:${PORT}`);
  console.log(` Survey: http://localhost:${PORT}`);
  console.log(` Admin: http://localhost:${PORT}/admin (pass: bidv2025)`);
});