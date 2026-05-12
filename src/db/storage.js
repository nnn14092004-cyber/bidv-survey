/**
 * Data Persistence Layer - Lớp lưu trữ dữ liệu
 * Đọc/ghi dữ liệu khảo sát từ file JSON
 * Hỗ trợ backward compatibility với db.json cũ
 */

const fs = require('fs');
const path = require('path');

// Đường dẫn file dữ liệu mới
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'responses.json');
// Đường dẫn file cũ (để migrate)
const LEGACY_FILE = path.join(__dirname, '..', '..', 'db.json');

/**
 * Khởi tạo thư mục data và migrate dữ liệu cũ nếu có
 */
function initialize() {
    // Tạo thư mục data nếu chưa có
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Migrate dữ liệu từ db.json cũ sang data/responses.json
    if (!fs.existsSync(DATA_FILE)) {
        if (fs.existsSync(LEGACY_FILE)) {
            try {
                const legacyData = fs.readFileSync(LEGACY_FILE, 'utf8');
                fs.writeFileSync(DATA_FILE, legacyData, 'utf8');
                console.log('📦 Đã migrate dữ liệu từ db.json sang data/responses.json');
            } catch (err) {
                console.error('⚠️ Lỗi migrate dữ liệu:', err.message);
                fs.writeFileSync(DATA_FILE, JSON.stringify({ responses: [] }, null, 2));
            }
        } else {
            fs.writeFileSync(DATA_FILE, JSON.stringify({ responses: [] }, null, 2));
            console.log('📄 Đã tạo file data/responses.json mới');
        }
    }
}

/**
 * Đọc toàn bộ dữ liệu từ file
 * @returns {{ responses: Array }} Dữ liệu khảo sát
 */
function readAll() {
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const data = JSON.parse(raw);
        // Đảm bảo luôn có mảng responses
        if (!data.responses || !Array.isArray(data.responses)) {
            data.responses = [];
        }
        return data;
    } catch (err) {
        console.error('⚠️ Lỗi đọc dữ liệu:', err.message);
        return { responses: [] };
    }
}

/**
 * Ghi toàn bộ dữ liệu vào file
 * @param {{ responses: Array }} data - Dữ liệu cần ghi
 */
function writeAll(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('❌ Lỗi ghi dữ liệu:', err.message);
        throw err;
    }
}

/**
 * Thêm một phản hồi mới
 * @param {Object} response - Dữ liệu phản hồi
 * @returns {Object} Phản hồi đã thêm (có id và submittedAt)
 */
function addResponse(response) {
    const db = readAll();
    // Gán ID duy nhất và thời gian gửi
    response.id = Date.now();
    response.submittedAt = new Date().toISOString();
    db.responses.push(response);
    writeAll(db);
    return response;
}

/**
 * Lấy tất cả phản hồi, hỗ trợ lọc theo ngày
 * @param {Object} options - Tùy chọn lọc
 * @param {string} [options.from] - Ngày bắt đầu (ISO format)
 * @param {string} [options.to] - Ngày kết thúc (ISO format)
 * @returns {Array} Danh sách phản hồi
 */
function getResponses({ from, to } = {}) {
    const db = readAll();
    let responses = db.responses;

    // Lọc theo khoảng thời gian nếu có
    if (from) {
        const fromDate = new Date(from);
        responses = responses.filter(r => new Date(r.submittedAt) >= fromDate);
    }
    if (to) {
        const toDate = new Date(to);
        // Đặt cuối ngày để bao gồm cả ngày "to"
        toDate.setHours(23, 59, 59, 999);
        responses = responses.filter(r => new Date(r.submittedAt) <= toDate);
    }

    return responses;
}

/**
 * Xóa toàn bộ dữ liệu (reset)
 */
function resetAll() {
    writeAll({ responses: [] });
}

/**
 * Đếm tổng số phản hồi
 * @returns {number}
 */
function count() {
    return readAll().responses.length;
}

module.exports = {
    initialize,
    readAll,
    writeAll,
    addResponse,
    getResponses,
    resetAll,
    count
};
