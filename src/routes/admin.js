/**
 * Admin API Routes - Các route quản trị
 * GET  /api/admin/stats  - Lấy thống kê tổng hợp (hỗ trợ date filter)
 * POST /api/admin/reset  - Reset toàn bộ dữ liệu
 * GET  /api/admin/export  - Xuất dữ liệu (server-side)
 * Tất cả route đều yêu cầu Firebase authentication
 */

const express = require('express');
const router = express.Router();
const storage = require('../db/storage');

// 20 key Likert để tính thống kê
const LIKERT_KEYS = [
    'tc1', 'tc2', 'tc3', 'dapung1', 'dapung2', 'bm1', 'bm2',
    'deDung1', 'deDung2', 'ht1', 'ht2', 'haiLong',
    'cskh1', 'tinhnang1', 'tocdo1', 'huongdan1',
    'sinhtrac1', 'baotri1', 'phicn1', 'nhandien1'
];

/**
 * Tính toán thống kê từ danh sách phản hồi
 * @param {Array} responses - Danh sách phản hồi
 * @returns {Object} Dữ liệu thống kê đầy đủ
 */
function computeStats(responses) {
    const total = responses.length;

    const genderCount = { "Nam": 0, "Nữ": 0 };
    const ageGroups = {};
    const durationCount = {};
    const featureFreq = {};
    const difficultyFreq = {};
    const dailyAvg = {};

    // Khởi tạo bộ đếm Likert
    const likertSum = {};
    const likertCount = {};
    LIKERT_KEYS.forEach(k => { likertSum[k] = 0; likertCount[k] = 0; });

    // Đếm phản hồi hôm nay
    const todayStr = new Date().toISOString().split('T')[0];
    let todayCount = 0;

    responses.forEach(r => {
        // Thống kê cơ bản
        if (r.gender) genderCount[r.gender] = (genderCount[r.gender] || 0) + 1;
        if (r.age) ageGroups[r.age] = (ageGroups[r.age] || 0) + 1;
        if (r.duration) durationCount[r.duration] = (durationCount[r.duration] || 0) + 1;

        // Thống kê tính năng và khó khăn
        (r.features || []).forEach(f => featureFreq[f] = (featureFreq[f] || 0) + 1);
        (r.difficulties || []).forEach(d => difficultyFreq[d] = (difficultyFreq[d] || 0) + 1);

        // Tính điểm Likert
        let personTotalScore = 0;
        let personAnsweredCount = 0;

        LIKERT_KEYS.forEach(key => {
            if (r[key] !== undefined && r[key] !== null) {
                const val = Number(r[key]);
                likertSum[key] += val;
                likertCount[key] += 1;
                personTotalScore += val;
                personAnsweredCount += 1;
            }
        });

        // Xu hướng điểm theo ngày
        const avgScore = personAnsweredCount ? personTotalScore / personAnsweredCount : 0;
        const date = r.submittedAt ? r.submittedAt.split('T')[0] : todayStr;
        if (!dailyAvg[date]) dailyAvg[date] = { sum: 0, count: 0 };
        dailyAvg[date].sum += avgScore;
        dailyAvg[date].count += 1;

        // Đếm hôm nay
        if (date === todayStr) todayCount++;
    });

    // Tính trung bình Likert
    const likertAvg = {};
    LIKERT_KEYS.forEach(k => {
        likertAvg[k] = likertCount[k] ? +(likertSum[k] / likertCount[k]).toFixed(2) : 0;
    });

    // Xu hướng timeline
    const timeline = Object.keys(dailyAvg).sort().map(date => ({
        date,
        avg: +(dailyAvg[date].sum / dailyAvg[date].count).toFixed(2),
        count: dailyAvg[date].count
    }));

    return {
        total,
        todayCount,
        genderCount,
        ageGroups,
        durationCount,
        likertAvg,
        featureFreq,
        difficultyFreq,
        timeline,
        rawResponses: responses.slice(-200).reverse()
    };
}

/**
 * GET /api/admin/stats
 * Lấy thống kê tổng hợp, hỗ trợ lọc theo ngày
 * Query params: ?from=2025-01-01&to=2025-12-31
 */
router.get('/stats', (req, res) => {
    try {
        const { from, to } = req.query;
        const responses = storage.getResponses({ from, to });
        const stats = computeStats(responses);

        // Thêm thông tin tổng tất cả (không lọc) để so sánh
        if (from || to) {
            stats.totalAll = storage.count();
        }

        res.json(stats);
    } catch (err) {
        console.error('❌ Lỗi lấy thống kê:', err.message);
        res.status(500).json({ error: 'Lỗi hệ thống' });
    }
});

/**
 * POST /api/admin/reset
 * Reset toàn bộ dữ liệu khảo sát
 * Yêu cầu Firebase authentication (không dùng password)
 */
router.post('/reset', (req, res) => {
    try {
        storage.resetAll();
        console.log(`⚠️ Dữ liệu đã được Reset bởi: ${req.user?.email || 'Unknown'}`);
        res.json({ success: true, message: 'Đã xóa toàn bộ dữ liệu' });
    } catch (err) {
        console.error('❌ Lỗi reset dữ liệu:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
    }
});

/**
 * GET /api/admin/export
 * Xuất toàn bộ dữ liệu (server-side export)
 * Hỗ trợ lọc theo ngày
 */
router.get('/export', (req, res) => {
    try {
        const { from, to } = req.query;
        const responses = storage.getResponses({ from, to });
        res.json({
            success: true,
            count: responses.length,
            data: responses
        });
    } catch (err) {
        console.error('❌ Lỗi xuất dữ liệu:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
    }
});

module.exports = router;
