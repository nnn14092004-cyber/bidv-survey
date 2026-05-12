/**
 * BIDV SmartBanking Survey System - Express Server
 * Entry point chính cho ứng dụng
 * 
 * Middleware stack: dotenv → helmet → compression → morgan → cors → rate-limit → routes
 */

// Load biến môi trường từ .env
require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Import modules nội bộ
const storage = require('./src/db/storage');
const { initializeFirebase, verifyFirebaseToken } = require('./src/middleware/auth');
const surveyRoutes = require('./src/routes/survey');
const adminRoutes = require('./src/routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ─── Khởi tạo ──────────────────────────────────────────────────────────────

// Khởi tạo storage (migrate dữ liệu cũ nếu có)
storage.initialize();

// Khởi tạo Firebase Admin SDK
initializeFirebase();

// ─── Security Headers (Helmet) ──────────────────────────────────────────────

app.use(helmet({
    // Cho phép load CDN scripts (Tailwind, Chart.js, Firebase, etc.)
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "'unsafe-eval'",
                "https://cdn.tailwindcss.com",
                "https://cdn.jsdelivr.net",
                "https://cdn.sheetjs.com",
                "https://www.gstatic.com",
                "https://apis.google.com",
                "https://*.firebaseapp.com",
                "https://*.googleapis.com"
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://fonts.googleapis.com",
                "https://cdnjs.cloudflare.com"
            ],
            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com",
                "https://cdnjs.cloudflare.com"
            ],
            imgSrc: ["'self'", "data:", "https://placehold.co", "https://*.googleusercontent.com"],
            connectSrc: [
                "'self'",
                "https://*.googleapis.com",
                "https://*.firebaseio.com",
                "https://*.firebaseapp.com",
                "https://identitytoolkit.googleapis.com",
                "https://securetoken.googleapis.com"
            ],
            frameSrc: [
                "'self'",
                "https://*.firebaseapp.com",
                "https://accounts.google.com",
                "https://*.googleapis.com"
            ]
        }
    },
    // Cho phép cross-origin cho Firebase auth popup
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

// ─── Compression ─────────────────────────────────────────────────────────────

app.use(compression());

// ─── Request Logging (Morgan) ────────────────────────────────────────────────

app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── CORS Configuration ─────────────────────────────────────────────────────

const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000'];

app.use(cors({
    origin: NODE_ENV === 'development' ? true : corsOrigins,
    credentials: true
}));

// ─── Body Parsers ────────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiting (chỉ cho API submit để chống spam) ────────────────────────

const submitLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: parseInt(process.env.RATE_LIMIT_MAX) || 50,
    message: {
        success: false,
        message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// ─── Static Files ────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'public')));

// ─── Health Check ────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        totalResponses: storage.count()
    });
});

// ─── API Routes ──────────────────────────────────────────────────────────────

// Survey routes (public - có rate limiting)
app.use('/api', submitLimiter, surveyRoutes);

// Admin routes (protected - yêu cầu Firebase token)
app.use('/api/admin', verifyFirebaseToken, adminRoutes);

// ─── Page Routes ─────────────────────────────────────────────────────────────

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use((req, res) => {
    res.status(404).json({ error: 'Không tìm thấy trang' });
});

// ─── Error Handler ───────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.stack);
    res.status(500).json({
        success: false,
        message: NODE_ENV === 'production' ? 'Lỗi hệ thống' : err.message
    });
});

// ─── Start Server ────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
    console.log(`\n🚀 BIDV Survey Server đang chạy!`);
    console.log(`📍 Trang khảo sát: http://localhost:${PORT}`);
    console.log(`📍 Trang admin:    http://localhost:${PORT}/admin`);
    console.log(`📍 Health check:   http://localhost:${PORT}/health`);
    console.log(`🔧 Môi trường:     ${NODE_ENV}`);
    console.log(`📊 Tổng phản hồi:  ${storage.count()}\n`);
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

function gracefulShutdown(signal) {
    console.log(`\n📴 Nhận tín hiệu ${signal} - Đang tắt server...`);
    server.close(() => {
        console.log('✅ Server đã tắt an toàn');
        process.exit(0);
    });

    // Force shutdown sau 10 giây nếu không tắt được
    setTimeout(() => {
        console.error('⚠️ Buộc tắt server sau 10 giây');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));