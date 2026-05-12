/**
 * BIDV Admin Dashboard - Client-side Logic
 * Firebase Auth + Dashboard với date filter, search, pagination
 */

// ─── Biến toàn cục ──────────────────────────────────────────────────────────
let currentData = null;
let charts = {};
let refreshInterval = null;
let currentPage = 1;
let abortController = null;
const ROWS_PER_PAGE = 20;
const LIKERT_KEYS = ['tc1','tc2','tc3','dapung1','dapung2','bm1','bm2','deDung1','deDung2','ht1','ht2','haiLong','cskh1','tinhnang1','tocdo1','huongdan1','sinhtrac1','baotri1','phicn1','nhandien1'];
const CRITERIA_NAMES = [
    {name:"TC1 (Ổn định)",key:"tc1"},{name:"TC2 (Chính xác)",key:"tc2"},{name:"TC3 (Phản hồi nhanh)",key:"tc3"},
    {name:"Đáp ứng sự cố",key:"dapung1"},{name:"Tổng đài 24/7",key:"dapung2"},{name:"Bảo mật OTP",key:"bm1"},
    {name:"Bảo mật thông tin",key:"bm2"},{name:"Giao diện thân thiện",key:"deDung1"},{name:"Bố trí tính năng",key:"deDung2"},
    {name:"Giao diện hiện đại",key:"ht1"},{name:"Nhiều tính năng",key:"ht2"},{name:"Hài lòng chung",key:"haiLong"},
    {name:"CSKH",key:"cskh1"},{name:"Cập nhật mới",key:"tinhnang1"},{name:"Tốc độ",key:"tocdo1"},
    {name:"Hướng dẫn",key:"huongdan1"},{name:"Sinh trắc học",key:"sinhtrac1"},{name:"Bảo trì",key:"baotri1"},
    {name:"Phí dịch vụ",key:"phicn1"},{name:"Nhận diện",key:"nhandien1"}
];

// ─── Firebase Auth Flow ──────────────────────────────────────────────────────

function initAuthFlow() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            showDashboard(user);
            refreshData();
            startAutoRefresh();
        } else {
            showLoginScreen();
            stopAutoRefresh();
        }
    });
}

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'none';
}

function showDashboard(user) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    // Hiển thị thông tin user
    const userInfo = document.getElementById('userInfo');
    if (userInfo) {
        userInfo.innerHTML = `
            <img src="${user.photoURL || ''}" alt="" class="user-avatar" onerror="this.style.display='none'">
            <span>${user.displayName || user.email}</span>`;
    }
}

async function handleGoogleLogin() {
    const errorEl = document.getElementById('loginError');
    const loadingEl = document.getElementById('loginLoading');
    errorEl.style.display = 'none';
    loadingEl.style.display = 'block';

    try {
        await signInWithGoogle();
    } catch (err) {
        loadingEl.style.display = 'none';
        if (err.code !== 'auth/popup-closed-by-user') {
            errorEl.textContent = 'Lỗi đăng nhập: ' + err.message;
            errorEl.style.display = 'block';
        }
    }
}

async function handleLogout() {
    stopAutoRefresh();
    destroyCharts();
    await signOut();
}

// ─── API Calls (với AbortController + Auth token) ────────────────────────────

async function fetchStats(from, to) {
    if (abortController) abortController.abort();
    abortController = new AbortController();

    const headers = await getAuthHeaders();
    let url = '/api/admin/stats';
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (params.toString()) url += '?' + params;

    const res = await fetch(url, { headers, signal: abortController.signal });
    if (res.status === 401 || res.status === 403) {
        await handleLogout();
        throw new Error('Phiên đăng nhập hết hạn');
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ─── Charts ──────────────────────────────────────────────────────────────────

function destroyCharts() {
    Object.values(charts).forEach(c => { try { if(c) c.destroy(); } catch(e){} });
    charts = {};
}

function renderCharts(data) {
    const { genderCount, ageGroups, durationCount, likertAvg, timeline } = data;

    const genderCtx = document.getElementById('genderPieChart')?.getContext('2d');
    if (genderCtx) charts.gender = new Chart(genderCtx, {
        type:'doughnut',
        data:{labels:['Nam','Nữ'],datasets:[{data:[genderCount.Nam||0,genderCount['Nữ']||0],backgroundColor:['#005391','#00A69C']}]},
        options:{responsive:true,maintainAspectRatio:false}
    });

    const ageCtx = document.getElementById('agePieChart')?.getContext('2d');
    if (ageCtx) charts.age = new Chart(ageCtx, {
        type:'pie',
        data:{labels:Object.keys(ageGroups),datasets:[{data:Object.values(ageGroups),backgroundColor:['#1E3A8A','#2563EB','#3B82F6','#60A5FA','#93C5FD']}]},
        options:{responsive:true,maintainAspectRatio:false}
    });

    const durCtx = document.getElementById('durationPieChart')?.getContext('2d');
    if (durCtx) charts.duration = new Chart(durCtx, {
        type:'doughnut',
        data:{labels:Object.keys(durationCount),datasets:[{data:Object.values(durationCount),backgroundColor:['#0F766E','#14B8A6','#2DD4BF','#5EEAD4']}]},
        options:{responsive:true,maintainAspectRatio:false}
    });

    const lineCtx = document.getElementById('trendLineChart')?.getContext('2d');
    if (lineCtx && timeline && timeline.length) {
        charts.trend = new Chart(lineCtx, {
            type:'line',
            data:{labels:timeline.map(t=>t.date),datasets:[{label:'Điểm TB',data:timeline.map(t=>t.avg),borderColor:'#005391',backgroundColor:'rgba(0,83,145,0.1)',fill:true,tension:0.3}]},
            options:{responsive:true,maintainAspectRatio:false,scales:{y:{min:1,max:5}}}
        });
    } else if (lineCtx) {
        lineCtx.canvas.parentElement.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:2rem">Chưa đủ dữ liệu theo ngày</p>';
    }

    const barCtx = document.getElementById('avgBarChart')?.getContext('2d');
    if (barCtx) {
        const labels = ['TC1','TC2','TC3','Đáp1','Đáp2','BM1','BM2','DD1','DD2','HH1','HH2','HL','CSKH','TN','TĐ','HD','ST','BT','Phí','ND'];
        const values = LIKERT_KEYS.map(k => likertAvg[k] || 0);
        charts.bar = new Chart(barCtx, {
            type:'bar',
            data:{labels,datasets:[{label:'Điểm TB',data:values,backgroundColor:'#005391'}]},
            options:{responsive:true,maintainAspectRatio:false,scales:{y:{min:1,max:5}}}
        });
    }
}

// ─── Insights ────────────────────────────────────────────────────────────────

function renderInsights(likertAvg) {
    const scores = CRITERIA_NAMES.map(c => ({name:c.name,score:likertAvg[c.key]||0}));
    const sorted = [...scores].sort((a,b) => b.score - a.score);
    const top3 = sorted.slice(0,3), bottom3 = sorted.slice(-3).reverse();
    return `<div class="insight-grid">
        <div class="insight insight-green"><h3 class="green">🏆 Điểm mạnh</h3><ul>${top3.map(t=>`<li>${t.name}: <strong>${t.score}/5</strong></li>`).join('')}</ul></div>
        <div class="insight insight-red"><h3 class="red">⚠️ Điểm yếu</h3><ul>${bottom3.map(b=>`<li>${b.name}: <strong>${b.score}/5</strong> – cần cải thiện</li>`).join('')}</ul></div>
    </div>`;
}

// ─── Render Stats (giữ nguyên layout gốc + thêm search/pagination) ──────────

function renderStats(data) {
    const { total, todayCount, genderCount, ageGroups, durationCount, featureFreq, difficultyFreq, rawResponses, timeline, likertAvg } = data;
    const ageHtml = Object.entries(ageGroups).map(([k,v])=>`${k}: <strong>${v}</strong><br>`).join('') || 'Chưa có';
    const durHtml = Object.entries(durationCount).map(([k,v])=>`${k}: <strong>${v}</strong><br>`).join('') || 'Chưa có';
    const featHtml = Object.entries(featureFreq).map(([k,v])=>`<li>${k}: ${v}</li>`).join('') || '<li>Chưa có</li>';
    const diffHtml = Object.entries(difficultyFreq).map(([k,v])=>`<li>${k}: ${v}</li>`).join('') || '<li>Chưa có</li>';

    document.getElementById('statsContainer').innerHTML = `
        <div class="grid-4">
            <div class="stat-card"><div class="big-num">${total}</div><div>Tổng phản hồi</div></div>
            <div class="stat-card"><div class="big-num">${todayCount||0}</div><div>Hôm nay</div></div>
            <div class="stat-card"><div><strong>Nam:</strong> ${genderCount.Nam||0}<br><strong>Nữ:</strong> ${genderCount['Nữ']||0}</div></div>
            <div class="stat-card"><div class="section-title" style="font-size:0.9rem">Độ tuổi</div>${ageHtml}</div>
        </div>
        ${renderInsights(likertAvg)}
        <div class="flex-charts">
            <div class="stat-card"><h3 class="section-title" style="text-align:center">Giới tính</h3><div class="chart-container"><canvas id="genderPieChart"></canvas></div></div>
            <div class="stat-card"><h3 class="section-title" style="text-align:center">Độ tuổi</h3><div class="chart-container"><canvas id="agePieChart"></canvas></div></div>
            <div class="stat-card"><h3 class="section-title" style="text-align:center">Thời gian sử dụng</h3><div class="chart-container"><canvas id="durationPieChart"></canvas></div></div>
        </div>
        <div class="stat-card"><div class="section-title">📈 Xu hướng điểm TB theo thời gian</div><div class="chart-container"><canvas id="trendLineChart"></canvas></div></div>
        <div class="stat-card"><div class="section-title">📊 Điểm TB 20 chỉ tiêu</div><div class="chart-container" style="height:300px"><canvas id="avgBarChart"></canvas></div></div>
        <div class="grid-2">
            <div class="stat-card"><div class="section-title">⭐ Tính năng dùng nhiều</div><ul>${featHtml}</ul></div>
            <div class="stat-card"><div class="section-title">🚧 Khó khăn gặp phải</div><ul>${diffHtml}</ul></div>
        </div>
        <div class="stat-card">
            <div class="section-title">📋 Phản hồi gần nhất</div>
            <div class="search-bar"><input type="text" id="searchInput" placeholder="🔍 Tìm kiếm theo tên, góp ý..." oninput="filterTable()"></div>
            <div class="overflow-x">
                <table><thead><tr><th>Thời gian</th><th>Họ tên</th><th>Ngày sinh</th><th>GT</th><th>Tuổi</th><th>Thu nhập</th><th>Tần suất</th><th>Điểm TB</th><th>Góp ý</th></tr></thead>
                <tbody id="tableBody"></tbody></table>
            </div>
            <div id="paginationContainer" class="pagination"></div>
        </div>`;

    // Render bảng với pagination
    renderTable(rawResponses || []);
    // Render charts sau khi DOM sẵn sàng
    requestAnimationFrame(() => renderCharts(data));
}

// ─── Table với Search + Pagination ───────────────────────────────────────────

function renderTable(responses) {
    if (!responses || !responses.length) {
        document.getElementById('tableBody').innerHTML = '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:1rem">Chưa có dữ liệu</td></tr>';
        document.getElementById('paginationContainer').innerHTML = '';
        return;
    }

    const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
    let filtered = responses;
    if (searchTerm) {
        filtered = responses.filter(r =>
            (r.fullName||'').toLowerCase().includes(searchTerm) ||
            (r.feedback||'').toLowerCase().includes(searchTerm) ||
            (r.gender||'').toLowerCase().includes(searchTerm) ||
            (r.age||'').toLowerCase().includes(searchTerm)
        );
    }

    const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
    if (currentPage > totalPages) currentPage = totalPages || 1;
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const pageData = filtered.slice(start, start + ROWS_PER_PAGE);

    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = pageData.map(r => {
        let totalScore = 0, cnt = 0;
        LIKERT_KEYS.forEach(k => { if(r[k]) { totalScore += r[k]; cnt++; }});
        const avg = cnt ? (totalScore/cnt).toFixed(1) : '?';
        return `<tr>
            <td>${r.submittedAt ? new Date(r.submittedAt).toLocaleString('vi-VN') : '?'}</td>
            <td>${r.fullName||'??'}</td><td>${r.dob||'??'}</td><td>${r.gender||'?'}</td>
            <td>${r.age||'?'}</td><td>${r.income||'?'}</td><td>${r.frequency||'?'}</td>
            <td><strong>${avg}</strong></td><td>${(r.feedback||'').substring(0,80)}</td>
        </tr>`;
    }).join('');

    // Pagination
    const pagEl = document.getElementById('paginationContainer');
    if (totalPages <= 1) { pagEl.innerHTML = `<span class="pagination-info">${filtered.length} kết quả</span>`; return; }

    let pagHtml = `<span class="pagination-info">${filtered.length} kết quả | Trang ${currentPage}/${totalPages}</span>`;
    pagHtml += `<button ${currentPage===1?'disabled':''} onclick="changePage(${currentPage-1})">‹</button>`;
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 2) {
            pagHtml += `<button class="${i===currentPage?'active':''}" onclick="changePage(${i})">${i}</button>`;
        } else if (Math.abs(i - currentPage) === 3) {
            pagHtml += '<span>...</span>';
        }
    }
    pagHtml += `<button ${currentPage===totalPages?'disabled':''} onclick="changePage(${currentPage+1})">›</button>`;
    pagEl.innerHTML = pagHtml;
}

function changePage(page) { currentPage = page; renderTable(currentData?.rawResponses || []); }
function filterTable() { currentPage = 1; renderTable(currentData?.rawResponses || []); }

// ─── Refresh Data ────────────────────────────────────────────────────────────

async function refreshData() {
    const from = document.getElementById('dateFrom')?.value || '';
    const to = document.getElementById('dateTo')?.value || '';
    try {
        const data = await fetchStats(from, to);
        currentData = data;
        destroyCharts();
        renderStats(data);
    } catch (err) {
        if (err.name === 'AbortError') return;
        document.getElementById('statsContainer').innerHTML = `
            <div class="banner banner-red"><strong>❌ Lỗi:</strong> ${err.message}<br><br>
            Hãy đảm bảo server đang chạy: <code>node server.js</code></div>`;
    }
}

function startAutoRefresh() { stopAutoRefresh(); refreshInterval = setInterval(refreshData, 30000); }
function stopAutoRefresh() { if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; } }

// ─── Export Excel (thêm đầy đủ fields) ───────────────────────────────────────

function exportToExcel() {
    if (!currentData?.rawResponses?.length) return alert('Chưa có dữ liệu');
    const wsData = currentData.rawResponses.map(r => ({
        'Thời gian': r.submittedAt, 'Họ tên': r.fullName, 'Ngày sinh': r.dob,
        'Giới tính': r.gender, 'Tuổi': r.age, 'Nghề nghiệp': r.job,
        'Thu nhập': r.income, 'Thời gian dùng': r.duration, 'Tần suất': r.frequency,
        'Tính năng': (r.features||[]).join(', '),
        'TC1':r.tc1,'TC2':r.tc2,'TC3':r.tc3,'Đáp ứng1':r.dapung1,'Đáp ứng2':r.dapung2,
        'BM1':r.bm1,'BM2':r.bm2,'Dễ dùng1':r.deDung1,'Dễ dùng2':r.deDung2,
        'Hữu hình1':r.ht1,'Hữu hình2':r.ht2,'Hài lòng':r.haiLong,
        'CSKH1':r.cskh1,'Tính năng1':r.tinhnang1,'Tốc độ1':r.tocdo1,
        'Hướng dẫn1':r.huongdan1,'Sinh trắc1':r.sinhtrac1,'Bảo trì1':r.baotri1,
        'Phí1':r.phicn1,'Nhận diện1':r.nhandien1,
        'Khó khăn': (r.difficulties||[]).join(', '), 'Góp ý': r.feedback
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PhanHoi');
    XLSX.writeFile(wb, `BIDV_Survey_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.xlsx`);
}

// ─── Reset Data (dùng Firebase token thay password) ──────────────────────────

async function confirmReset() {
    if (!confirm("⚠️ Xóa VĨNH VIỄN tất cả dữ liệu? Không thể hoàn tác.")) return;
    try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/admin/reset', { method: 'POST', headers });
        const data = await res.json();
        if (data.success) { alert("✅ Đã xóa toàn bộ!"); refreshData(); }
        else alert("❌ " + data.message);
    } catch (err) { alert("❌ Lỗi: " + err.message); }
}

// ─── Date Filter ─────────────────────────────────────────────────────────────

function applyDateFilter() { currentPage = 1; refreshData(); }
function clearDateFilter() {
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    currentPage = 1;
    refreshData();
}

// ─── Cleanup khi rời trang ───────────────────────────────────────────────────

window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
    if (abortController) abortController.abort();
});

// ─── Khởi động ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase !== 'undefined' && typeof auth !== 'undefined') {
        initAuthFlow();
    } else {
        console.error('Firebase chưa được tải');
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        refreshData();
        startAutoRefresh();
    }
});
