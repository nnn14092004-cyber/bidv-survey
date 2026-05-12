# 📊 BIDV SmartBanking - Hệ thống Khảo sát Chất lượng

Hệ thống khảo sát trực tuyến đánh giá chất lượng dịch vụ BIDV SmartBanking, bao gồm form khảo sát người dùng và dashboard phân tích cho quản trị viên.

## ✨ Tính năng

### Trang khảo sát (`/`)
- Form 4 phần: Thông tin cá nhân, Thói quen sử dụng, 20 câu Likert (1-5), Phản hồi
- Progress bar tiến độ điền form
- Auto-save draft vào localStorage
- Character counter cho textarea
- Success animation sau khi submit
- Loading state và toast notifications

### Trang admin (`/admin`)
- **Firebase Google Authentication** (thay thế password hardcode)
- Dashboard thống kê: tổng phản hồi, giới tính, độ tuổi, thời gian dùng
- Biểu đồ: doughnut, pie, line trend, bar chart 20 tiêu chí (Chart.js)
- **Date range filter** (lọc theo ngày)
- **Search** trong bảng phản hồi
- **Pagination** (thay vì hardcode 200 dòng)
- Xuất Excel (SheetJS) với đầy đủ fields
- Auto-refresh mỗi 30 giây
- Admin mini panel trong trang survey

### Backend
- Express.js với modular routes
- Firebase Admin SDK token verification
- Rate limiting chống spam
- Input validation (express-validator)
- Security headers (Helmet)
- Compression & request logging
- JSON file persistence
- Health check endpoint
- Graceful shutdown

## 📁 Cấu trúc thư mục

```
bidv-survey/
├── public/                        # Static files (Express serves)
│   ├── index.html                 # Trang khảo sát
│   ├── admin.html                 # Trang admin (Firebase auth)
│   └── assets/
│       ├── images/logo.jpg        # Logo BIDV
│       ├── css/
│       │   ├── survey.css         # Styles cho survey
│       │   └── admin.css          # Styles cho admin
│       └── js/
│           ├── survey.js          # Logic survey
│           ├── admin.js           # Logic admin dashboard
│           └── firebase-config.js # Firebase client config
├── src/
│   ├── routes/
│   │   ├── survey.js              # POST /api/submit
│   │   └── admin.js               # GET /api/admin/stats, POST /api/admin/reset
│   ├── middleware/
│   │   └── auth.js                # Firebase Admin SDK verify
│   └── db/
│       └── storage.js             # Data persistence (JSON file)
├── data/
│   └── responses.json             # Dữ liệu khảo sát (gitignored)
├── server.js                      # Express entry point
├── package.json
├── .env                           # Credentials (gitignored)
├── .env.example                   # Template biến môi trường
├── .gitignore
└── README.md
```

## 🚀 Cài đặt & Chạy

### 1. Cài đặt dependencies

```bash
npm install
```

### 2. Thiết lập Firebase

#### a. Tạo Firebase Project
1. Truy cập [Firebase Console](https://console.firebase.google.com)
2. Click "Add project" → đặt tên → tạo project
3. Bật **Authentication** → **Sign-in method** → **Google** → **Enable**

#### b. Lấy Web App Config
1. **Project Settings** → **General** → **Your apps** → **Add web app**
2. Copy `firebaseConfig` object
3. Paste vào file `public/assets/js/firebase-config.js`

#### c. Lấy Admin SDK Credentials
1. **Project Settings** → **Service accounts** → **Generate new private key**
2. Mở file JSON tải về, copy các giá trị vào `.env`:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`

#### d. Cấu hình Admin Whitelist
Trong `.env`, thêm email được phép truy cập admin:
```
ADMIN_EMAILS=your-email@gmail.com,other-admin@gmail.com
```

### 3. Cấu hình Environment

```bash
# Copy template
cp .env.example .env

# Sửa file .env với credentials thực
```

### 4. Chạy server

```bash
# Development
npm start

# Server sẽ chạy tại http://localhost:3000
```

### 5. Truy cập

- **Khảo sát**: http://localhost:3000
- **Admin**: http://localhost:3000/admin
- **Health**: http://localhost:3000/health

## 🔐 Bảo mật

- **Firebase Authentication**: Google Sign-In với email whitelist
- **Firebase Admin SDK**: Server verify mọi request admin
- **Helmet.js**: Security headers tự động
- **Rate Limiting**: Giới hạn 50 submissions / 15 phút
- **Input Validation**: express-validator cho mọi input
- **CORS**: Cấu hình origins cụ thể
- **No hardcoded credentials**: Tất cả credentials trong .env

## 📝 API Endpoints

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/api/submit` | No | Gửi khảo sát (rate limited) |
| GET | `/api/admin/stats` | Firebase | Thống kê (hỗ trợ `?from=&to=`) |
| POST | `/api/admin/reset` | Firebase | Reset toàn bộ dữ liệu |
| GET | `/api/admin/export` | Firebase | Xuất dữ liệu JSON |
| GET | `/health` | No | Health check |

## ⚠️ Development Mode

Nếu chưa cấu hình Firebase credentials trong `.env`, server sẽ chạy ở **development mode**:
- Admin API không yêu cầu authentication
- Console sẽ hiện cảnh báo
- **KHÔNG SỬ DỤNG trong production**

## 📦 Dependencies

| Package | Mục đích |
|---------|----------|
| express | Web framework |
| firebase-admin | Server-side auth verification |
| helmet | Security headers |
| express-rate-limit | Chống spam |
| compression | Gzip responses |
| morgan | Request logging |
| cors | Cross-Origin Resource Sharing |
| dotenv | Environment variables |
| express-validator | Input validation |
