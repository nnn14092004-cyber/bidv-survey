const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const DB_FILE = 'db.json';
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ responses: [] }, null, 2));
}

function readDB() {
  const data = fs.readFileSync(DB_FILE, 'utf8');
  return JSON.parse(data);
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.post('/api/submit', (req, res) => {
  try {
    console.log(' Received survey:', req.body.fullName, req.body.dob);
    const db = readDB();
    const newResp = req.body;
    newResp.id = Date.now();
    newResp.submittedAt = new Date().toISOString();
    db.responses.push(newResp);
    writeDB(db);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/admin/stats', (req, res) => {
  try {
    const db = readDB();
    const responses = db.responses;
    const total = responses.length;

    const genderCount = { Nam: 0, Nữ: 0 };
    const ageGroups = {};
    const durationCount = {};
    const likertAvg = {
      tc1:0, tc2:0, tc3:0, dapung1:0, dapung2:0, bm1:0, bm2:0,
      deDung1:0, deDung2:0, ht1:0, ht2:0, haiLong:0,
      cskh1:0, tinhnang1:0, tocdo1:0, huongdan1:0,
      sinhtrac1:0, baotri1:0, phicn1:0, nhandien1:0
    };
    const featureFreq = {};
    const difficultyFreq = {};
    const dailyAvg = {};

    responses.forEach(r => {
      if (r.gender) genderCount[r.gender] = (genderCount[r.gender]||0)+1;
      if (r.age) ageGroups[r.age] = (ageGroups[r.age]||0)+1;
      if (r.duration) durationCount[r.duration] = (durationCount[r.duration]||0)+1;
      for (let key in likertAvg) if (r[key]) likertAvg[key] += r[key];
      (r.features || []).forEach(f => featureFreq[f] = (featureFreq[f]||0)+1);
      (r.difficulties || []).forEach(d => difficultyFreq[d] = (difficultyFreq[d]||0)+1);

      let totalScore = 0, cnt = 0;
      for (let key in likertAvg) if (r[key]) { totalScore += r[key]; cnt++; }
      const avgScore = cnt ? totalScore / cnt : 0;
      const date = r.submittedAt ? r.submittedAt.split('T')[0] : new Date(r.id).toISOString().split('T')[0];
      if (!dailyAvg[date]) dailyAvg[date] = { sum: 0, count: 0 };
      dailyAvg[date].sum += avgScore;
      dailyAvg[date].count += 1;
    });

    if (total > 0) {
      for (let key in likertAvg) likertAvg[key] = +(likertAvg[key] / total).toFixed(2);
    }

    const timeline = Object.keys(dailyAvg).sort().map(date => ({
      date, avg: +(dailyAvg[date].sum / dailyAvg[date].count).toFixed(2)
    }));

    res.json({
      total, genderCount, ageGroups, durationCount, likertAvg,
      featureFreq, difficultyFreq, timeline,
      rawResponses: responses.slice(-200).reverse()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Reset endpoint - so sánh trực tiếp, in log để debug
app.post('/api/admin/reset', (req, res) => {
  const { password } = req.body;
  console.log('Reset password received:', password);
  if (password !== '14092004') {
    return res.status(401).json({ success: false, message: 'Sai mật khẩu admin' });
  }
  try {
    writeDB({ responses: [] });
    res.json({ success: true, message: 'Đã xóa toàn bộ dữ liệu' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(` Server running at http://localhost:${PORT}`);
});