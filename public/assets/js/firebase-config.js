/**
 * Firebase Configuration - Cấu hình Firebase Authentication
 * 
 * HƯỚNG DẪN THIẾT LẬP:
 * 1. Truy cập https://console.firebase.google.com
 * 2. Tạo project mới hoặc chọn project có sẵn
 * 3. Vào Project Settings → General → Your apps → Add web app
 * 4. Copy firebaseConfig bên dưới và thay thế các giá trị placeholder
 * 5. Bật Authentication → Sign-in method → Google → Enable
 */

// TODO: Thay thế bằng config thực từ Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSy_YOUR_API_KEY_HERE",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};

// Khởi tạo Firebase App
firebase.initializeApp(firebaseConfig);

// Khởi tạo Firebase Auth với Google Provider
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Cấu hình Google Provider - luôn hiện dialog chọn tài khoản
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

/**
 * Đăng nhập bằng Google Popup
 * @returns {Promise<firebase.auth.UserCredential>}
 */
async function signInWithGoogle() {
    try {
        const result = await auth.signInWithPopup(googleProvider);
        return result;
    } catch (error) {
        console.error('Lỗi đăng nhập Google:', error);
        throw error;
    }
}

/**
 * Đăng xuất
 * @returns {Promise<void>}
 */
async function signOut() {
    try {
        await auth.signOut();
    } catch (error) {
        console.error('Lỗi đăng xuất:', error);
        throw error;
    }
}

/**
 * Lấy ID Token hiện tại để gửi kèm API request
 * @returns {Promise<string|null>} ID Token hoặc null nếu chưa đăng nhập
 */
async function getIdToken() {
    const user = auth.currentUser;
    if (!user) return null;
    try {
        return await user.getIdToken(true); // force refresh
    } catch (error) {
        console.error('Lỗi lấy token:', error);
        return null;
    }
}

/**
 * Tạo headers Authorization cho fetch request
 * @returns {Promise<Object>} Headers object với Bearer token
 */
async function getAuthHeaders() {
    const token = await getIdToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}
