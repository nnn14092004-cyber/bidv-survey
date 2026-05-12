/**
 * BIDV Survey Form - Client-side Logic
 * Tách từ index.html, thêm các tính năng mới:
 * - Progress bar theo section
 * - Auto-save draft vào localStorage
 * - Character counter cho textarea
 * - Success animation (thay alert)
 * - Loading state khi submit
 * - Toast notifications (thay alert lỗi)
 * - Admin mini panel (Firebase auth)
 */

// ─── 20 câu hỏi Likert (giữ nguyên field names) ────────────────────────────
const likertQuestions = [
    { name: "tc1", text: "TC1: Hệ thống hoạt động ổn định, ít khi bị gián đoạn." },
    { name: "tc2", text: "TC2: Giao dịch được xử lý chính xác, không sai sót." },
    { name: "tc3", text: "TC3: Thời gian phản hồi giao dịch nhanh chóng." },
    { name: "dapung1", text: "Đáp ứng 1: BIDV giải quyết nhanh khi tôi gặp sự cố." },
    { name: "dapung2", text: "Đáp ứng 2: Tổng đài hỗ trợ 24/7 hiệu quả." },
    { name: "bm1", text: "Bảo mật 1: Tôi tin tưởng vào các lớp bảo mật (OTP, sinh trắc học)." },
    { name: "bm2", text: "Bảo mật 2: Thông tin cá nhân được bảo vệ an toàn." },
    { name: "deDung1", text: "Dễ dùng 1: Giao diện thân thiện, dễ thao tác." },
    { name: "deDung2", text: "Dễ dùng 2: Các tính năng được bố trí hợp lý, dễ tìm." },
    { name: "ht1", text: "Hữu hình 1: Giao diện hiện đại, màu sắc chuyên nghiệp." },
    { name: "ht2", text: "Hữu hình 2: Ứng dụng có nhiều tính năng hữu ích." },
    { name: "haiLong", text: "Hài lòng chung: Nhìn chung tôi hài lòng với BIDV SmartBanking." },
    { name: "cskh1", text: "CSKH 1: Dịch vụ chăm sóc khách hàng qua tổng đài chuyên nghiệp." },
    { name: "tinhnang1", text: "Tính năng: Ứng dụng thường xuyên cập nhật tính năng mới hữu ích." },
    { name: "tocdo1", text: "Tốc độ: Thao tác trên app rất nhanh, không bị đơ." },
    { name: "huongdan1", text: "Hướng dẫn: Có hướng dẫn sử dụng rõ ràng, dễ hiểu." },
    { name: "sinhtrac1", text: "Sinh trắc học: Tính năng nhận diện khuôn mặt hoạt động tốt." },
    { name: "baotri1", text: "Bảo trì: Lịch bảo trì được thông báo trước hợp lý." },
    { name: "phicn1", text: "Phí: Mức phí dịch vụ cạnh tranh so với ngân hàng khác." },
    { name: "nhandien1", text: "Nhận diện: Độ chính xác của nhận diện giọng nói/vân tay cao." }
];

const DRAFT_KEY = 'bidv_survey_draft';
const MAX_FEEDBACK_CHARS = 2000;

// ─── Toast Notification System ───────────────────────────────────────────────

function createToastContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

function showToast(message, type = 'info') {
    const container = createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { info: 'ℹ️', error: '❌', warning: '⚠️', success: '✅' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    // Tự động xóa sau 5 giây
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ─── Success Modal ───────────────────────────────────────────────────────────

function showSuccessModal() {
    const overlay = document.createElement('div');
    overlay.className = 'success-overlay';
    overlay.innerHTML = `
        <div class="success-card">
            <div class="success-icon">✓</div>
            <h2>Cảm ơn bạn!</h2>
            <p>Khảo sát của bạn đã được ghi nhận thành công.<br>Phản hồi của bạn giúp chúng tôi cải thiện dịch vụ.</p>
            <button onclick="this.closest('.success-overlay').remove()">Đóng</button>
        </div>
    `;
    document.body.appendChild(overlay);
    // Tự động đóng sau 8 giây
    setTimeout(() => overlay.remove(), 8000);
}

// ─── Render Likert Questions ─────────────────────────────────────────────────

function renderLikertQuestions() {
    const container = document.getElementById('likertContainer');
    if (!container) return;

    likertQuestions.forEach(q => {
        const div = document.createElement('div');
        div.innerHTML = `<p class="font-medium mb-1">${q.text}</p><div class="likert-row" id="row-${q.name}"></div>`;
        container.appendChild(div);
        const row = div.querySelector('.likert-row');
        for (let i = 1; i <= 5; i++) {
            const label = document.createElement('label');
            label.className = 'likert-option';
            label.innerHTML = `<span>${i}</span><input type="radio" name="${q.name}" value="${i}" class="likert-radio" required>`;
            row.appendChild(label);
        }
    });
}

// ─── Progress Bar ────────────────────────────────────────────────────────────

function updateProgressBar() {
    const fill = document.getElementById('progressFill');
    const text = document.getElementById('progressText');
    if (!fill || !text) return;

    const form = document.getElementById('surveyForm');
    if (!form) return;

    // Đếm số section đã hoàn thành
    let sectionsComplete = 0;
    const totalSections = 4;

    // Section A: Thông tin cá nhân (fullName, dob, gender, age, job)
    const fullName = form.querySelector('input[name="fullName"]')?.value?.trim();
    const dob = form.querySelector('input[name="dob"]')?.value;
    const gender = form.querySelector('input[name="gender"]:checked');
    const age = form.querySelector('select[name="age"]')?.value;
    const job = form.querySelector('select[name="job"]')?.value;
    if (fullName && dob && gender && age && job) sectionsComplete++;

    // Section B: Thói quen (duration là bắt buộc)
    const duration = form.querySelector('input[name="duration"]:checked');
    if (duration) sectionsComplete++;

    // Section C: Likert (20 câu)
    let likertAnswered = 0;
    likertQuestions.forEach(q => {
        if (form.querySelector(`input[name="${q.name}"]:checked`)) likertAnswered++;
    });
    if (likertAnswered === 20) sectionsComplete++;

    // Section D: Phản hồi (tùy chọn nên luôn tính là xong nếu đã điền A, B, C)
    if (sectionsComplete === 3) sectionsComplete = 4;

    const percent = Math.round((sectionsComplete / totalSections) * 100);
    fill.style.width = percent + '%';
    const labels = ['A. Thông tin cá nhân', 'B. Thói quen sử dụng', 'C. Đánh giá chất lượng', 'D. Hoàn thành!'];
    text.textContent = `${percent}% – ${labels[Math.min(sectionsComplete, 3)]}`;
}

// ─── Auto-save Draft ─────────────────────────────────────────────────────────

function saveDraft() {
    const form = document.getElementById('surveyForm');
    if (!form) return;

    const draft = {};
    // Lưu text inputs
    form.querySelectorAll('input[type="text"], input[type="date"], textarea').forEach(el => {
        if (el.name && el.value) draft[el.name] = el.value;
    });
    // Lưu selects
    form.querySelectorAll('select').forEach(el => {
        if (el.name && el.value) draft[el.name] = el.value;
    });
    // Lưu radios
    form.querySelectorAll('input[type="radio"]:checked').forEach(el => {
        if (el.name) draft[el.name] = el.value;
    });
    // Lưu checkboxes
    const checkboxGroups = {};
    form.querySelectorAll('input[type="checkbox"]:checked').forEach(el => {
        if (el.name) {
            if (!checkboxGroups[el.name]) checkboxGroups[el.name] = [];
            checkboxGroups[el.name].push(el.value);
        }
    });
    Object.assign(draft, checkboxGroups);

    draft._savedAt = new Date().toISOString();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));

    // Hiện indicator auto-save
    const indicator = document.getElementById('autosaveIndicator');
    if (indicator) {
        indicator.textContent = '💾 Đã lưu nháp';
        indicator.classList.add('visible');
        setTimeout(() => indicator.classList.remove('visible'), 2000);
    }
}

function restoreDraft() {
    try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        const form = document.getElementById('surveyForm');
        if (!form) return;

        // Khôi phục text inputs
        form.querySelectorAll('input[type="text"], input[type="date"], textarea').forEach(el => {
            if (el.name && draft[el.name]) el.value = draft[el.name];
        });
        // Khôi phục selects
        form.querySelectorAll('select').forEach(el => {
            if (el.name && draft[el.name]) el.value = draft[el.name];
        });
        // Khôi phục radios
        form.querySelectorAll('input[type="radio"]').forEach(el => {
            if (el.name && draft[el.name] === el.value) el.checked = true;
        });
        // Khôi phục checkboxes
        form.querySelectorAll('input[type="checkbox"]').forEach(el => {
            if (el.name && Array.isArray(draft[el.name]) && draft[el.name].includes(el.value)) {
                el.checked = true;
            }
        });

        showToast('Đã khôi phục bản nháp trước đó', 'info');
    } catch (e) {
        console.warn('Không thể khôi phục draft:', e);
    }
}

function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
}

// ─── Character Counter ───────────────────────────────────────────────────────

function setupCharCounter() {
    const textarea = document.querySelector('textarea[name="feedback"]');
    if (!textarea) return;

    // Tạo counter element
    const counter = document.createElement('div');
    counter.className = 'char-counter';
    counter.id = 'charCounter';
    counter.textContent = `0 / ${MAX_FEEDBACK_CHARS}`;
    textarea.parentElement.appendChild(counter);

    textarea.addEventListener('input', () => {
        const len = textarea.value.length;
        counter.textContent = `${len} / ${MAX_FEEDBACK_CHARS}`;
        counter.className = 'char-counter';
        if (len > MAX_FEEDBACK_CHARS * 0.9) counter.className += ' danger';
        else if (len > MAX_FEEDBACK_CHARS * 0.75) counter.className += ' warning';

        // Giới hạn ký tự
        if (len > MAX_FEEDBACK_CHARS) {
            textarea.value = textarea.value.substring(0, MAX_FEEDBACK_CHARS);
            counter.textContent = `${MAX_FEEDBACK_CHARS} / ${MAX_FEEDBACK_CHARS}`;
        }
    });
}

// ─── Form Submission ─────────────────────────────────────────────────────────

function setupFormSubmit() {
    const form = document.getElementById('surveyForm');
    const submitBtn = document.getElementById('submitBtn');
    if (!form || !submitBtn) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Thu thập dữ liệu
        const fullName = document.querySelector('input[name="fullName"]').value.trim();
        const dob = document.querySelector('input[name="dob"]').value;
        const gender = document.querySelector('input[name="gender"]:checked')?.value;
        const age = document.querySelector('select[name="age"]').value;
        const job = document.querySelector('select[name="job"]').value;
        const income = document.querySelector('select[name="income"]').value;
        const duration = document.querySelector('input[name="duration"]:checked')?.value;
        const frequency = document.querySelector('input[name="frequency"]:checked')?.value;
        const features = Array.from(document.querySelectorAll('input[name="features"]:checked')).map(cb => cb.value);
        const difficulties = Array.from(document.querySelectorAll('input[name="difficulties"]:checked')).map(cb => cb.value);
        const feedback = document.querySelector('textarea[name="feedback"]').value;

        // Validate thông tin bắt buộc
        if (!fullName || !dob || !gender || !age || !job || !duration) {
            showToast('Vui lòng điền đầy đủ thông tin bắt buộc (*)', 'error');
            return;
        }

        // Validate Likert
        const likertValues = {};
        let missing = false;
        let firstMissing = null;
        likertQuestions.forEach(q => {
            const val = document.querySelector(`input[name="${q.name}"]:checked`)?.value;
            if (!val) {
                missing = true;
                if (!firstMissing) firstMissing = q.name;
            }
            likertValues[q.name] = val ? parseInt(val) : null;
        });
        if (missing) {
            showToast('Vui lòng đánh giá đầy đủ 20 tiêu chí ở phần C', 'error');
            // Cuộn đến câu hỏi chưa trả lời
            const row = document.getElementById(`row-${firstMissing}`);
            if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        // Hiện loading state
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        const payload = {
            fullName, dob, gender, age, job, income,
            duration, frequency, features, difficulties, feedback,
            ...likertValues
        };

        try {
            const res = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();

            if (result.success) {
                showSuccessModal();
                form.reset();
                clearDraft();
                updateProgressBar();
            } else {
                // Hiển thị lỗi validation chi tiết nếu có
                const errorMsg = result.errors
                    ? result.errors.join('<br>')
                    : (result.message || 'Có lỗi xảy ra, vui lòng thử lại');
                showToast(errorMsg, 'error');
            }
        } catch (err) {
            showToast('Lỗi kết nối máy chủ. Vui lòng kiểm tra kết nối mạng.', 'error');
            console.error('Submit error:', err);
        } finally {
            // Khôi phục nút submit
            submitBtn.innerHTML = originalText;
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    });
}

// ─── Admin Mini Panel ────────────────────────────────────────────────────────

let adminPanelOpen = false;

function setupAdminTrigger() {
    const trigger = document.getElementById('adminTrigger');
    if (!trigger) return;

    trigger.addEventListener('click', async () => {
        // Kiểm tra Firebase đã load chưa
        if (typeof firebase === 'undefined' || typeof auth === 'undefined') {
            showToast('Đang tải module xác thực...', 'warning');
            return;
        }

        const user = auth.currentUser;
        if (user) {
            // Đã đăng nhập → mở panel
            openAdminPanel(user);
        } else {
            // Chưa đăng nhập → trigger login
            try {
                const result = await signInWithGoogle();
                if (result.user) {
                    openAdminPanel(result.user);
                }
            } catch (err) {
                if (err.code !== 'auth/popup-closed-by-user') {
                    showToast('Lỗi đăng nhập: ' + err.message, 'error');
                }
            }
        }
    });
}

async function openAdminPanel(user) {
    if (adminPanelOpen) return;
    adminPanelOpen = true;

    // Tạo overlay
    const overlay = document.createElement('div');
    overlay.className = 'admin-panel-overlay';
    overlay.id = 'adminPanelOverlay';
    overlay.onclick = closeAdminPanel;
    document.body.appendChild(overlay);

    // Tạo panel
    const panel = document.createElement('div');
    panel.className = 'admin-mini-panel';
    panel.id = 'adminMiniPanel';
    panel.innerHTML = `
        <div class="admin-panel-header">
            <h3>🔐 Admin Panel</h3>
            <button class="admin-panel-close" onclick="closeAdminPanel()">×</button>
        </div>
        <div class="admin-panel-body">
            <div style="text-align:center; padding:2rem; color:#64748b">Đang tải dữ liệu...</div>
        </div>
        <div class="admin-panel-footer">
            <a href="/admin" class="btn-full-admin">📊 Mở Admin đầy đủ →</a>
        </div>
    `;
    document.body.appendChild(panel);

    // Animate mở
    requestAnimationFrame(() => {
        requestAnimationFrame(() => panel.classList.add('open'));
    });

    // Fetch thống kê nhanh
    try {
        const token = await getIdToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch('/api/admin/stats', { headers });

        if (res.status === 403) {
            panel.querySelector('.admin-panel-body').innerHTML = `
                <div style="text-align:center; padding:2rem;">
                    <div style="font-size:3rem; margin-bottom:1rem;">🚫</div>
                    <p style="color:#dc2626; font-weight:600;">Không có quyền truy cập</p>
                    <p style="color:#64748b; font-size:0.85rem; margin-top:0.5rem;">Email ${user.email} không nằm trong danh sách quản trị viên.</p>
                </div>`;
            return;
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Tính top/bottom criteria
        const criteria = [
            { name: "Ổn định hệ thống", key: "tc1" }, { name: "Xử lý chính xác", key: "tc2" },
            { name: "Phản hồi nhanh", key: "tc3" }, { name: "Đáp ứng sự cố", key: "dapung1" },
            { name: "Tổng đài 24/7", key: "dapung2" }, { name: "Bảo mật OTP", key: "bm1" },
            { name: "Bảo mật thông tin", key: "bm2" }, { name: "Giao diện thân thiện", key: "deDung1" },
            { name: "Bố trí tính năng", key: "deDung2" }, { name: "Giao diện hiện đại", key: "ht1" },
            { name: "Nhiều tính năng", key: "ht2" }, { name: "Hài lòng chung", key: "haiLong" },
            { name: "CSKH", key: "cskh1" }, { name: "Cập nhật mới", key: "tinhnang1" },
            { name: "Tốc độ", key: "tocdo1" }, { name: "Hướng dẫn", key: "huongdan1" },
            { name: "Sinh trắc học", key: "sinhtrac1" }, { name: "Bảo trì", key: "baotri1" },
            { name: "Phí dịch vụ", key: "phicn1" }, { name: "Nhận diện", key: "nhandien1" }
        ];
        const scores = criteria.map(c => ({ name: c.name, score: data.likertAvg[c.key] || 0 }));
        const sorted = [...scores].sort((a, b) => b.score - a.score);
        const top3 = sorted.slice(0, 3);
        const bottom3 = sorted.slice(-3).reverse();

        panel.querySelector('.admin-panel-body').innerHTML = `
            <div class="stat-row">
                <span>📅 Hôm nay</span>
                <span class="stat-value">${data.todayCount || 0} phản hồi</span>
            </div>
            <div class="stat-row">
                <span>📊 Tổng cộng</span>
                <span class="stat-value">${data.total.toLocaleString()} phản hồi</span>
            </div>
            <div class="stat-row">
                <span>👨 Nam</span>
                <span class="stat-value">${data.genderCount.Nam || 0}</span>
            </div>
            <div class="stat-row">
                <span>👩 Nữ</span>
                <span class="stat-value">${data.genderCount['Nữ'] || 0}</span>
            </div>

            <div class="admin-panel-section">
                <h4>✅ Điểm mạnh</h4>
                <ul>
                    ${top3.map(t => `<li>✅ ${t.name}: <strong>${t.score}/5</strong></li>`).join('')}
                </ul>
            </div>

            <div class="admin-panel-section" style="background:#fef2f2;">
                <h4>⚠️ Cần cải thiện</h4>
                <ul>
                    ${bottom3.map(b => `<li>⚠️ ${b.name}: <strong>${b.score}/5</strong></li>`).join('')}
                </ul>
            </div>
        `;
    } catch (err) {
        panel.querySelector('.admin-panel-body').innerHTML = `
            <div style="text-align:center; padding:2rem; color:#dc2626;">
                <p>Lỗi tải dữ liệu</p>
                <p style="font-size:0.8rem; color:#94a3b8; margin-top:0.5rem;">${err.message}</p>
            </div>`;
    }
}

function closeAdminPanel() {
    const panel = document.getElementById('adminMiniPanel');
    const overlay = document.getElementById('adminPanelOverlay');
    if (panel) {
        panel.classList.remove('open');
        setTimeout(() => panel.remove(), 400);
    }
    if (overlay) overlay.remove();
    adminPanelOpen = false;
}

// ─── Warning khi rời trang (nếu có draft) ────────────────────────────────────

function setupBeforeUnloadWarning() {
    window.addEventListener('beforeunload', (e) => {
        const form = document.getElementById('surveyForm');
        if (!form) return;

        // Chỉ cảnh báo nếu có dữ liệu đã nhập
        const hasData = form.querySelector('input[name="fullName"]')?.value?.trim();
        if (hasData) {
            e.preventDefault();
            e.returnValue = 'Bạn có dữ liệu chưa gửi. Chắc chắn muốn rời trang?';
        }
    });
}

// ─── Khởi tạo ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Render câu hỏi Likert
    renderLikertQuestions();

    // Khôi phục draft (nếu có)
    restoreDraft();

    // Thiết lập progress bar
    updateProgressBar();

    // Character counter cho textarea
    setupCharCounter();

    // Form submit handler
    setupFormSubmit();

    // Admin trigger button
    setupAdminTrigger();

    // Warning khi rời trang
    setupBeforeUnloadWarning();

    // Lắng nghe thay đổi form để cập nhật progress + auto-save
    const form = document.getElementById('surveyForm');
    if (form) {
        let saveTimeout;
        form.addEventListener('change', () => {
            updateProgressBar();
            // Debounce auto-save: lưu sau 1 giây không thay đổi
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveDraft, 1000);
        });
        form.addEventListener('input', () => {
            updateProgressBar();
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveDraft, 1000);
        });
    }
});
