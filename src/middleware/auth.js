/**
 * Firebase Authentication Middleware
 * Xác thực token Firebase và kiểm tra quyền admin
 */

const admin = require('firebase-admin');

// Biến lưu trạng thái khởi tạo Firebase
let firebaseInitialized = false;

/**
 * Khởi tạo Firebase Admin SDK
 * Sử dụng credentials từ biến môi trường
 */
function initializeFirebase() {
    if (firebaseInitialized) return;

    try {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY;

        if (!projectId || !clientEmail || !privateKey) {
            console.warn('⚠️ Firebase credentials chưa được cấu hình trong .env');
            console.warn('   Admin authentication sẽ bị bỏ qua (development mode)');
            return;
        }

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                // Xử lý ký tự newline trong private key
                privateKey: privateKey.replace(/\\n/g, '\n')
            })
        });

        firebaseInitialized = true;
        console.log('🔐 Firebase Admin SDK đã khởi tạo thành công');
    } catch (err) {
        console.error('❌ Lỗi khởi tạo Firebase Admin SDK:', err.message);
    }
}

/**
 * Lấy danh sách email admin từ biến môi trường
 * @returns {string[]} Mảng email được phép truy cập admin
 */
function getAdminEmails() {
    const emails = process.env.ADMIN_EMAILS || '';
    return emails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

/**
 * Middleware xác thực Firebase Token
 * Kiểm tra header Authorization: Bearer <id_token>
 * Verify token qua Firebase Admin SDK và kiểm tra whitelist email
 */
async function verifyFirebaseToken(req, res, next) {
    // Development mode: bỏ qua xác thực nếu Firebase chưa cấu hình
    if (!firebaseInitialized) {
        console.warn('⚠️ Firebase chưa cấu hình - cho phép truy cập không xác thực (dev mode)');
        req.user = { email: 'dev@localhost', name: 'Developer' };
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Thiếu token xác thực. Vui lòng đăng nhập.'
        });
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
        // Verify token với Firebase Admin SDK
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userEmail = (decodedToken.email || '').toLowerCase();

        // Kiểm tra email có trong whitelist không
        const adminEmails = getAdminEmails();
        if (adminEmails.length > 0 && !adminEmails.includes(userEmail)) {
            return res.status(403).json({
                success: false,
                message: 'Email của bạn không có quyền truy cập admin.'
            });
        }

        // Gắn thông tin user vào request để sử dụng ở các middleware/route tiếp theo
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name || decodedToken.email
        };

        next();
    } catch (err) {
        console.error('❌ Lỗi xác thực token:', err.message);
        return res.status(401).json({
            success: false,
            message: 'Token không hợp lệ hoặc đã hết hạn.'
        });
    }
}

module.exports = {
    initializeFirebase,
    verifyFirebaseToken,
    getAdminEmails
};
