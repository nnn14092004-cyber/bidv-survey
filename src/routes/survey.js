/**
 * Survey API Routes - Các route xử lý khảo sát
 * POST /api/submit - Nhận phản hồi khảo sát từ người dùng
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const storage = require('../db/storage');

// Danh sách 20 key Likert hợp lệ
const LIKERT_KEYS = [
    'tc1', 'tc2', 'tc3', 'dapung1', 'dapung2', 'bm1', 'bm2',
    'deDung1', 'deDung2', 'ht1', 'ht2', 'haiLong',
    'cskh1', 'tinhnang1', 'tocdo1', 'huongdan1',
    'sinhtrac1', 'baotri1', 'phicn1', 'nhandien1'
];

/**
 * Validation rules cho form khảo sát
 * Kiểm tra và sanitize tất cả input đầu vào
 */
const submitValidation = [
    body('fullName')
        .trim()
        .notEmpty().withMessage('Họ tên không được để trống')
        .isLength({ max: 100 }).withMessage('Họ tên tối đa 100 ký tự')
        .escape(), // Chống XSS
    body('dob')
        .notEmpty().withMessage('Ngày sinh không được để trống'),
    body('gender')
        .isIn(['Nam', 'Nữ']).withMessage('Giới tính không hợp lệ'),
    body('age')
        .isIn(['Dưới 18', '18-25', '26-35', '36-45', 'Trên 45'])
        .withMessage('Độ tuổi không hợp lệ'),
    body('job')
        .isIn(['Học sinh/SV', 'Nhân viên văn phòng', 'Công chức', 'Kinh doanh tự do', 'Nội trợ', 'Đã nghỉ hưu', 'Khác'])
        .withMessage('Nghề nghiệp không hợp lệ'),
    body('income')
        .optional()
        .isIn(['Dưới 5tr', '5-10tr', '10-20tr', 'Trên 20tr']),
    body('duration')
        .isIn(['<6 tháng', '6-12 tháng', '1-3 năm', '>3 năm'])
        .withMessage('Thời gian sử dụng không hợp lệ'),
    body('frequency')
        .optional()
        .isIn(['Hàng ngày', '2-3 lần/tuần', '1 lần/tuần', 'Ít hơn']),
    body('features')
        .optional()
        .isArray(),
    body('difficulties')
        .optional()
        .isArray(),
    body('feedback')
        .optional()
        .trim()
        .isLength({ max: 2000 }).withMessage('Góp ý tối đa 2000 ký tự'),
    // Validate 20 Likert values (1-5)
    ...LIKERT_KEYS.map(key =>
        body(key)
            .isInt({ min: 1, max: 5 }).withMessage(`${key} phải có giá trị 1-5`)
    )
];

/**
 * POST /api/submit
 * Nhận và lưu phản hồi khảo sát
 */
router.post('/submit', submitValidation, (req, res) => {
    // Kiểm tra kết quả validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Dữ liệu không hợp lệ',
            errors: errors.array().map(e => e.msg)
        });
    }

    try {
        // Chỉ lấy các field cho phép (whitelist approach - chống injection)
        const allowedFields = [
            'fullName', 'dob', 'gender', 'age', 'job', 'income',
            'duration', 'frequency', 'features', 'difficulties', 'feedback',
            ...LIKERT_KEYS
        ];

        const sanitizedData = {};
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                sanitizedData[field] = req.body[field];
            }
        });

        // Lưu vào storage
        const saved = storage.addResponse(sanitizedData);
        console.log(`✅ Nhận khảo sát mới từ: ${saved.fullName || 'Ẩn danh'} (ID: ${saved.id})`);

        res.json({ success: true, message: 'Khảo sát đã được ghi nhận' });
    } catch (err) {
        console.error('❌ Lỗi lưu khảo sát:', err.message);
        res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống, vui lòng thử lại sau'
        });
    }
});

module.exports = router;
