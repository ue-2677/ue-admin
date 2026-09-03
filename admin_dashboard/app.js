// ==========================================
// 1. Firebase 初始化與共用變數
// ==========================================
import { db, auth, secondaryAuth, escapeHTML, getLocalDateStr } from '../firebase-config.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, setDoc, query, orderBy, getDocs, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

window.escapeHTML = escapeHTML;
window.getLocalDateStr = getLocalDateStr;

let dbUsers = {}; let dbRoutes = []; let dbPoints = []; let dbUidMappings = {};
let dbTasks = []; let dbAssistantRequests = []; let dbNotices = [];
let currentUser = null; const VIRTUAL_DOMAIN = "@patrol.com";

// ==========================================
// 2. UI 切換與導覽列控制
// ==========================================
window.pointSortState = { col: 'floor', desc: false };
window.routeSortState = { col: 'order', desc: false };

window.sortPoints = function(col) {
    if (window.pointSortState.col === col) window.pointSortState.desc = !window.pointSortState.desc;
    else { window.pointSortState.col = col; window.pointSortState.desc = false; }
    window.loadPointsData();
};

window.sortRoutes = function(col) {
    if (window.routeSortState.col === col) window.routeSortState.desc = !window.routeSortState.desc;
    else { window.routeSortState.col = col; window.routeSortState.desc = false; }
    window.loadRoutesData();
};

window.applyRouteFilter = function() { window.loadRoutesData(); };
window.applyPointFilter = function() { window.loadPointsData(); };

window.toggleProfileMenu = function(e) {
    e.stopPropagation();
    const menu = document.getElementById('profileMenu');
    if (menu) menu.classList.toggle('active');
};

window.toggleDeptMenu = function(e) {
    e.stopPropagation();
    const menu = document.getElementById('deptSubMenu');
    const arrow = document.getElementById('deptArrow');
    if (menu) {
        menu.classList.toggle('active');
        if (arrow) arrow.style.transform = menu.classList.contains('active') ? 'rotate(90deg)' : 'rotate(0deg)';
    }
};

window.closeProfileMenu = function(e) {
    if (!e.target.matches('.profile-trigger')) {
        document.querySelectorAll(".profile-dropdown-content").forEach(el => el.classList.remove('active'));
    }
    if (!e.target.closest('.nav-item')) {
        const deptMenu = document.getElementById('deptSubMenu');
        const arrow = document.getElementById('deptArrow');
        if (deptMenu && deptMenu.classList.contains('active')) {
            deptMenu.classList.remove('active');
            if (arrow) arrow.style.transform = 'rotate(0deg)';
        }
    }
};

window.switchTab = function(tabId, element) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    const tab = document.getElementById(tabId);
    if (tab) tab.classList.add('active');
};

window.switchAdminView = function(viewId, element = null) {
    if(element) {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
        let titleText = element.innerText;
        if(titleText.includes('\n')) titleText = titleText.split('\n')[1]; 
        else if(titleText.includes(' ')) titleText = titleText.split(' ')[1]; 
        const titleEl = document.getElementById('topbarTitle');
        if (titleEl) titleEl.innerText = titleText;
    }
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    const view = document.getElementById(viewId);
    if (view) view.classList.add('active');
    window.refreshCurrentView();
};

window.refreshCurrentView = function() {
    const d = document.getElementById('view-dashboard'); if(d && d.classList.contains('active')) window.loadDashboardData();
    const m = document.getElementById('view-management'); if(m && m.classList.contains('active')) { window.loadRoutesData(); window.loadPointsData(); }
    const u = document.getElementById('view-users'); if(u && u.classList.contains('active')) window.loadUsersData();
    const n = document.getElementById('view-notices'); if(n && n.classList.contains('active')) window.loadNoticesData();
    const a = document.getElementById('view-assistant'); if(a && a.classList.contains('active')) window.loadAssistantRequests(); 
};

window.closeModal = function(modalId) { 
    const m = document.getElementById(modalId);
    if (m) m.classList.remove('active'); 
};

// ==========================================
// 3. 權限驗證與登入監聽
// ==========================================
window.isSystemInitialized = false; 
let userDocListener = null; 

onAuthStateChanged(auth, async (user) => {
    if (user) {
        let username = user.email.replace(VIRTUAL_DOMAIN, '');
        const q = query(collection(db, "users"), where("authEmail", "==", user.email));
        const snap = await getDocs(q);
        if (!snap.empty) username = snap.docs[0].id;

        if (userDocListener) userDocListener(); 

        userDocListener = onSnapshot(doc(db, "users", username), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.authEmail && data.authEmail !== user.email) {
                    if (userDocListener) userDocListener();
                    auth.signOut(); alert("⚠️ 此帳號的密碼已被管理員重設，請重新登入！"); window.location.replace('../index.html'); return;
                }
                const dbSessionId = data.currentSessionId;
                const myLocalSessionId = localStorage.getItem('patrolSessionId');
                if (dbSessionId && myLocalSessionId && dbSessionId !== myLocalSessionId) {
                    if (userDocListener) userDocListener();
                    auth.signOut(); localStorage.removeItem('patrolSessionId');
                    alert("⚠️ 您的帳號已在其他設備登入，本機強制登出！"); window.location.replace('../index.html'); return;
                }

                currentUser = { username: username, ...data };
                if (currentUser.role !== 'admin' && currentUser.role !== 'sub_admin') {
                    alert("權限不足，將返回登入頁！"); auth.signOut(); window.location.replace('../index.html'); return;
                }
                
                if (!window.isSystemInitialized) {
                    window.isSystemInitialized = true;
                    const sc = document.getElementById('sidebarContainer'); if(sc) sc.style.display = 'flex';
                    const mc = document.getElementById('mainContentContainer'); if(mc) mc.style.display = 'flex';
                    const cu = document.getElementById('currentUserDisplay'); if(cu) cu.innerHTML = `👤 ${currentUser.name} ▼`;
                    
                    initRealtimeListeners();

                    // 自動判斷跳轉：若是手機版則開 mobile 首頁，電腦版則開 dashboard
                    if (window.location.pathname.includes('mobile.html')) {
                        const navs = document.querySelectorAll('.mobile-bottom-nav .nav-item');
                        if (navs.length > 1) window.switchAdminView('view-mobile-home', navs[1]);
                    } else {
                        const activeNav = document.querySelector('.sidebar .nav-item.active');
                        if (activeNav) window.switchAdminView('view-dashboard', activeNav);
                    }
                }
            } else {
                if (userDocListener) userDocListener(); auth.signOut(); window.location.replace('../index.html');
            }
        });
    } else {
        if (userDocListener) { userDocListener(); userDocListener = null; }
        window.isSystemInitialized = false; window.location.replace('../index.html');
    }
});

window.performLogout = async function() {
    if(confirm("確定要登出系統嗎？")) { 
        await auth.signOut();
        localStorage.removeItem('cloudCurrentUser'); 
        localStorage.removeItem('patrolSessionId');
        window.location.replace('../index.html');
    }
};

window.playAlertSound = function() {
    const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
    audio.play().catch(e => console.log(e));
};

window.showSystemNotification = function(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body: body, icon: 'https://cdn-icons-png.flaticon.com/512/1827/1827370.png' });
    }
};

// ==========================================
// 4. 即時資料監聽 (Realtime Firestore)
// ==========================================
let isInitialLoad = true; 

function initRealtimeListeners() {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }

    onSnapshot(query(collection(db, "notices"), orderBy("createdAt", "desc")), (snapshot) => {
        dbNotices = []; snapshot.forEach(doc => { dbNotices.push({ id: doc.id, ...doc.data() }); });
        const vn = document.getElementById('view-notices');
        if(vn && vn.classList.contains('active')) window.loadNoticesData();
    });

    onSnapshot(query(collection(db, "workOrders"), where("department", "==", "管理部")), (snapshot) => {
        dbAssistantRequests = []; 
        snapshot.forEach(doc => { dbAssistantRequests.push({ id: doc.id, ...doc.data() }); });
        const va = document.getElementById('view-assistant');
        if(va && va.classList.contains('active')) window.loadAssistantRequests();
        window.updateAssistantBadge(); 

        if (!isInitialLoad) {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    if (data.dispatcherUsername !== currentUser.username) {
                        window.playAlertSound();
                        window.showSystemNotification("🔔 收到新助理需求", `地點: ${data.location}\n說明: ${data.description}`);
                    }
                }
            });
        }
    });

    setTimeout(() => { isInitialLoad = false; }, 3000);

    onSnapshot(collection(db, "users"), (snapshot) => {
        dbUsers = {}; snapshot.forEach(doc => { dbUsers[doc.id] = doc.data(); });
        const vu = document.getElementById('view-users');
        if(vu && vu.classList.contains('active')) window.loadUsersData();
    });
    
    onSnapshot(collection(db, "points"), (snapshot) => {
        dbPoints = []; snapshot.forEach(doc => { dbPoints.push({ id: doc.id, ...doc.data() }); });
        const vm = document.getElementById('view-management');
        if(vm && vm.classList.contains('active')) window.loadPointsData();
    });
    
    onSnapshot(collection(db, "routes"), (snapshot) => {
        dbRoutes = []; snapshot.forEach(doc => { dbRoutes.push({ id: doc.id, ...doc.data() }); });
        const vm = document.getElementById('view-management');
        if(vm && vm.classList.contains('active')) window.loadRoutesData();
    });
    
    onSnapshot(collection(db, "uidMappings"), (snapshot) => {
        dbUidMappings = {}; snapshot.forEach(doc => { dbUidMappings[doc.id] = doc.data().locationName; });
        const vm = document.getElementById('view-management');
        if(vm && vm.classList.contains('active')) window.loadPointsData();
    });
    
    onSnapshot(query(collection(db, "tasks"), orderBy("startTimestamp", "desc")), (snapshot) => {
        dbTasks = []; snapshot.forEach(doc => { dbTasks.push({ id: doc.id, ...doc.data() }); });
        const vd = document.getElementById('view-dashboard');
        if(vd && vd.classList.contains('active')) window.loadDashboardData();
    });
    
    onSnapshot(query(collection(db, "deleteLogs"), orderBy("deletedTimestamp", "desc")), (snapshot) => {
        const tbody = document.getElementById('deleteLogsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        snapshot.forEach(doc => {
            const log = doc.data();
            tbody.innerHTML += `<tr>
                <td>${log.deletedAt}</td>
                <td style="color:var(--danger); font-weight:bold;">${log.deletedBy}</td>
                <td><span class="badge badge-warning">${log.itemType}</span></td>
                <td><textarea readonly style="width:100%; height:50px; font-size:11px;">${log.dataSnapshot}</textarea></td>
            </tr>`;
        });
    });
}

setInterval(() => { 
    const c = document.getElementById('clock');
    if(c) c.innerText = new Date().toLocaleString(); 
}, 1000);

window.logDeletion = async function(itemType, deletedData) {
    await addDoc(collection(db, "deleteLogs"), {
        deletedAt: new Date().toLocaleString(),
        deletedTimestamp: Date.now(),
        deletedBy: currentUser.name + " (" + currentUser.username + ")",
        itemType: itemType,
        dataSnapshot: JSON.stringify(deletedData)
    });
};

// ==========================================
// 5. 特別事項通知管理
// ==========================================
window.loadNoticesData = function() {
    const tbody = document.getElementById('noticesTableBody'); if(!tbody) return; tbody.innerHTML = '';
    const sf = document.getElementById('noticeFilterStatus');
    const statusFilter = sf ? sf.value : 'all';
    const today = window.getLocalDateStr(false);
    let count = 0;

    dbNotices.forEach(notice => {
        const sDate = notice.startDate.replace(/-/g, '');
        const eDate = notice.endDate.replace(/-/g, '');
        const isActive = (today >= sDate && today <= eDate);
        
        if (statusFilter === 'active' && !isActive) return;
        if (statusFilter === 'expired' && isActive) return;
        count++;
        
        let statusTag = isActive ? '<span class="badge badge-success">生效中</span>' : '<span class="badge badge-secondary">未生效 / 已過期</span>';
        const depts = notice.departments.map(d => `<span class="badge badge-info" style="margin-right:4px;">${d}</span>`).join('');

        tbody.innerHTML += `<tr>
            <td><strong>${window.escapeHTML(notice.text)}</strong><br><span style="font-size:11px; color:#888;">發布者: ${notice.createdBy}</span></td>
            <td style="font-family:monospace; font-size:13px;">${notice.startDate} ~ ${notice.endDate}<br>${statusTag}</td>
            <td>${depts}</td>
            <td>
                <button class="btn btn-warning" style="padding: 4px 8px; font-size:12px; margin-bottom:4px;" onclick="window.editNotice('${notice.id}')">✏️ 編輯</button>
                <button class="btn btn-danger" style="padding: 4px 8px; font-size:12px;" onclick="window.deleteNotice('${notice.id}')">🗑️ 刪除</button>
            </td>
        </tr>`;
    });
    if (count === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999; padding:20px;">目前無符合條件的通知</td></tr>'; }
};

window.openNoticeModal = function(noticeId = null) {
    const title = document.getElementById('noticeModalTitle');
    const editId = document.getElementById('editNoticeId');
    if (noticeId) {
        const notice = dbNotices.find(n => n.id === noticeId);
        if (!notice) return;
        title.innerText = "✏️ 編輯特別事項通知"; editId.value = noticeId;
        document.getElementById('noticeTextInput').value = notice.text;
        document.getElementById('noticeStartDate').value = notice.startDate; 
        document.getElementById('noticeEndDate').value = notice.endDate;
        document.querySelectorAll('.notice-dept-chk').forEach(c => { c.checked = notice.departments.includes(c.value); });
    } else {
        title.innerText = "📢 發布特別事項通知"; editId.value = "";
        document.getElementById('noticeTextInput').value = '';
        const today = window.getLocalDateStr(true);
        document.getElementById('noticeStartDate').value = today; 
        document.getElementById('noticeEndDate').value = today;
        document.querySelectorAll('.notice-dept-chk').forEach(c => c.checked = (c.value === '工程部' || c.value === '清潔部'));
    }
    document.getElementById('noticeModal').classList.add('active');
};

window.editNotice = function(id) { window.openNoticeModal(id); };

window.saveNotice = async function() {
    const text = document.getElementById('noticeTextInput').value.trim();
    const sDate = document.getElementById('noticeStartDate').value;
    const eDate = document.getElementById('noticeEndDate').value;
    const editId = document.getElementById('editNoticeId').value;
    let targetDepts = [];
    document.querySelectorAll('.notice-dept-chk:checked').forEach(c => targetDepts.push(c.value));

    if (!text || !sDate || !eDate) { alert("請填寫完整內容與日期！"); return; }
    if (sDate > eDate) { alert("結束日期不可早於開始日期！"); return; }
    if (targetDepts.length === 0) { alert("至少選擇一個發布部門！"); return; }

    try {
        if (editId) {
            await updateDoc(doc(db, "notices", editId), { text: text, startDate: sDate, endDate: eDate, departments: targetDepts, updatedBy: currentUser.name, updatedAt: Date.now() });
            alert("✅ 通知更新成功！");
        } else {
            await addDoc(collection(db, "notices"), { text: text, startDate: sDate, endDate: eDate, departments: targetDepts, createdBy: currentUser.name, createdAt: Date.now() });
            alert("✅ 通知發布成功！");
        }
        window.closeModal('noticeModal');
    } catch(e) { alert("儲存失敗，請檢查網路。"); }
};

window.deleteNotice = async function(id) { 
    if(confirm("確定要刪除這條通知嗎？")) {
        const notice = dbNotices.find(n => n.id === id) || { id: id };
        await window.logDeletion("特別事項通知", notice);
        await deleteDoc(doc(db, "notices", id));
    }
};

// ==========================================
// 6. 物業助理需求管理
// ==========================================
window.updateAssistantBadge = function() {
    const badge = document.getElementById('assistantBadge');
    if (!badge) return;
    const incompleteCount = dbAssistantRequests.filter(o => o.status !== '已完成').length;
    if (incompleteCount > 0) { badge.style.display = 'block'; badge.innerText = incompleteCount > 9 ? '9+' : incompleteCount; } 
    else { badge.style.display = 'none'; }
};

window.loadAssistantRequests = function() {
    const tbody = document.getElementById('assistantRequestsTableBody');
    if (!tbody) return; tbody.innerHTML = '';
    
    if (dbAssistantRequests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#999; padding:20px;">目前無任何管理部需求通知。</td></tr>'; return;
    }

    dbAssistantRequests.sort((a, b) => b.refNumber.localeCompare(a.refNumber));

    dbAssistantRequests.forEach(order => {
        const safeRefNumber = window.escapeHTML(order.refNumber);
        const safeLocation = window.escapeHTML(order.location);
        let safeDesc = order.description ? window.escapeHTML(order.description) : '<span style="color:#aaa;">無文字說明</span>';
        
        if (order.status === '已完成' && order.completionRemark) {
             safeDesc += `<div style="margin-top:8px; padding:6px; background:#e8f4fd; border-radius:4px; font-size:12px; color:#0056b3; border-left: 3px solid #0056b3;"><strong>結案備註：</strong><br>${window.escapeHTML(order.completionRemark)}</div>`;
        }

        let statusClass = 'badge-warning'; let statusText = order.status || '待處理';
        if (order.status === '已完成') statusClass = 'badge-success';
        else if (order.status === '跟進中') statusClass = 'badge-info';
        
        let statusBadge = `<span class="badge ${statusClass}">${statusText}</span>`;
        const personName = order.completer || order.assignee;
        if ((order.status === '跟進中' || order.status === '已完成') && personName) {
            statusBadge += `<br><span style="font-size:11px; color:var(--primary); font-weight:bold; display:inline-block; margin-top:4px;">👤 ${window.escapeHTML(personName)}</span>`;
        }

        const photoHtml = order.photo ? `<div style="margin-top:6px;"><img src="${order.photo}" onclick="window.openImageModal('${order.photo}')" style="max-height:80px; border-radius:4px; border:1px solid #ddd; object-fit:contain; cursor:pointer; transition:0.2s;"></div>` : '';

        let actionBtn = '';
        if (!order.status || order.status === '待處理') {
            actionBtn = `<button class="btn btn-primary" style="padding: 6px 10px; font-size:13px; margin-bottom: 4px; width: 100%;" onclick="window.takeAssistantRequest('${order.id}')">✋ 接收此單</button><br>`;
        } else if (order.status === '跟進中') {
            actionBtn = `<button class="btn btn-success" style="padding: 6px 10px; font-size:13px; margin-bottom: 4px; width: 100%;" onclick="window.prepareCompleteRequest('${order.id}')">✅ 點擊完成</button><br>`;
        }
        const delBtn = `<button class="btn btn-danger" style="padding: 4px 8px; font-size:12px; width:100%;" onclick="window.deleteWorkOrder('${order.id}')">🗑️ 刪除</button>`;

        tbody.innerHTML += `
            <tr>
                <td><strong>${safeRefNumber}</strong><br><span style="font-size:11px; color:#888;">${order.reporter}</span></td>
                <td style="color:var(--primary); font-weight:bold;">${safeLocation}</td>
                <td><div>${safeDesc}</div>${photoHtml}</td>
                <td style="color:#666; font-size:13px;">${order.dispatchTime}</td>
                <td>${statusBadge}</td>
                <td>${actionBtn}${delBtn}</td>
            </tr>
        `;
    });
};

window.takeAssistantRequest = async function(id) {
    try { 
        await updateDoc(doc(db, "workOrders", id), { status: '跟進中', assignee: currentUser.name || currentUser.username, takeTime: new Date().toLocaleString() }); 
    } catch(e) { alert("接單失敗，請檢查網路連線。"); }
};

window.prepareCompleteRequest = function(id) {
    document.getElementById('completingOrderId').value = id;
    document.getElementById('completionRemarkInput').value = '';
    document.getElementById('completeActionModal').classList.add('active');
};

window.executeCompleteRequest = async function(withRemark) {
    const id = document.getElementById('completingOrderId').value;
    const remark = document.getElementById('completionRemarkInput').value.trim();
    if (withRemark && !remark) { alert("請輸入備註內容，或選擇「直接完成」。"); return; }
    
    try {
        let payload = { status: '已完成', completeTime: new Date().toLocaleString(), completer: currentUser.name || currentUser.username };
        if (withRemark) payload.completionRemark = remark;
        await updateDoc(doc(db, "workOrders", id), payload);
        window.closeModal('completeActionModal');
    } catch(e) { alert("結案失敗，請檢查網路。"); }
};

window.deleteWorkOrder = async function(id) {
    if(confirm("確定要刪除這筆紀錄嗎？")) { 
        const orderData = dbAssistantRequests.find(o => o.id === id) || { id: id };
        await window.logDeletion("物業助理工單", orderData);
        await deleteDoc(doc(db, "workOrders", id)); 
    }
};

// ==========================================
// 7. 手動發單邏輯
// ==========================================
let manualPhotoBase64 = "";

window.openManualIssueModal = function() {
    if(document.getElementById('manualIssueLocation')) document.getElementById('manualIssueLocation').value = ''; 
    if(document.getElementById('manualIssueText')) document.getElementById('manualIssueText').value = '';
    if(document.getElementById('manualIssuePhoto')) document.getElementById('manualIssuePhoto').value = ''; 
    if(document.getElementById('manualIssuePreview')) document.getElementById('manualIssuePreview').style.display = 'none';
    manualPhotoBase64 = ""; document.getElementById('manualIssueModal').classList.add('active');
};

window.handleManualPhoto = function(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas'); const MAX_WIDTH = 800; let width = img.width, height = img.height;
            if (width > MAX_WIDTH) { height = Math.floor(height * (MAX_WIDTH / width)); width = MAX_WIDTH; }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
            manualPhotoBase64 = canvas.toDataURL('image/jpeg', 0.6); 
            const pv = document.getElementById('manualIssuePreview');
            if(pv) { pv.src = manualPhotoBase64; pv.style.display = 'block'; }
        }; 
        img.src = e.target.result;
    }; 
    reader.readAsDataURL(file);
};

window.submitManualIssue = async function() {
    const dept = document.getElementById('manualIssueDept').value;
    const loc = document.getElementById('manualIssueLocation').value.trim();
    const desc = document.getElementById('manualIssueText').value.trim();
    if (!loc) { alert("請填寫發生地點！"); return; }
    if (!desc && !manualPhotoBase64) { alert("請填寫需求內容或上傳相片！"); return; }
    
    let prefix = dept === '工程部' ? 'ENG' : (dept === '清潔部' ? 'CLN' : 'MGT');
    const dateStr = window.getLocalDateStr(false);
    
    try {
        const q = query(collection(db, "workOrders"), where("department", "==", dept));
        const querySnapshot = await getDocs(q);
        const refNumber = `${prefix}-${dateStr}-${String(querySnapshot.size + 1).padStart(3, '0')}`;
        
        await addDoc(collection(db, "workOrders"), {
            refNumber: refNumber, department: dept, location: loc, description: desc, photo: manualPhotoBase64, 
            reporter: currentUser.name + ' (手動發單)', dispatchTime: new Date().toLocaleString(), status: "待處理",
            dispatcherUsername: currentUser.username, dispatcherName: currentUser.name
        });
        alert(`✅ 發單成功！單號：${refNumber}`);
        window.closeModal('manualIssueModal');
    } catch(e) { alert("發單失敗，請檢查網路連線。"); }
};

// ==========================================
// 8. 已發工單追蹤紀錄
// ==========================================
window.openIssuedWorkOrdersModal = async function() {
    const pm = document.getElementById('profileMenu'); if(pm) pm.classList.remove('active');
    const modal = document.getElementById('issuedWorkOrdersModal');
    const tbody = document.getElementById('issuedWorkOrdersTableBody');
    if(!modal || !tbody) return;

    modal.classList.add('active');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#999; padding:20px;">讀取雲端工單資料中...</td></tr>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "workOrders"));
        let orders = [];
        querySnapshot.forEach((doc) => { orders.push({ id: doc.id, ...doc.data() }); });
        
        orders = orders.filter(o => o.dispatcherUsername === currentUser.username);
        orders.sort((a, b) => (b.refNumber || "").localeCompare(a.refNumber || ""));
        tbody.innerHTML = '';
        
        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#999; padding:20px;">您目前沒有發出的工單紀錄。</td></tr>'; return;
        }
        
        orders.forEach(order => {
            let statusClass = 'badge-warning'; let statusText = order.status || '待處理';
            if (order.status === '已完成') statusClass = 'badge-success';
            else if (order.status === '跟進中') statusClass = 'badge-info';
            
            let statusBadge = `<span class="badge ${statusClass}">${window.escapeHTML(statusText)}</span>`;
            const personName = order.completer || order.assignee;
            if ((order.status === '跟進中' || order.status === '已完成') && personName) {
                statusBadge += `<br><span style="font-size:11px; color:var(--primary); font-weight:bold; display:inline-block; margin-top:4px;">👤 ${window.escapeHTML(personName)}</span>`;
            }

            const safeRef = window.escapeHTML(order.refNumber); const safeDept = window.escapeHTML(order.department);
            const safeLoc = window.escapeHTML(order.location); let safeDesc = window.escapeHTML(order.description || '無文字說明');
            
            if (order.status === '已完成' && order.completionRemark) {
                safeDesc += `<div style="margin-top:8px; padding:6px; background:#e8f4fd; border-radius:4px; font-size:12px; color:#0056b3; border-left: 3px solid #0056b3;"><strong>結案備註：</strong><br>${window.escapeHTML(order.completionRemark)}</div>`;
            }

            const safeDispatcher = window.escapeHTML(order.dispatcherName || order.reporter || '系統/未知');
            
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding:10px;"><strong>${safeRef}</strong><br><span style="font-size:11px; color:#888;">${safeDept}</span></td>
                    <td style="padding:10px; color:var(--primary); font-weight:bold;">${safeLoc}<br><span style="font-size:11px; color:#6f42c1; font-weight:bold;">發單: ${safeDispatcher}</span></td>
                    <td style="padding:10px; font-size:12px;">${safeDesc}</td>
                    <td style="padding:10px; font-size:12px; color:#666;">${window.escapeHTML(order.dispatchTime)}</td>
                    <td style="padding:10px; text-align:center;">${statusBadge}</td>
                </tr>
            `;
        });
    } catch (error) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--danger); padding:20px;">讀取失敗，請檢查網路連線。</td></tr>'; }
};

window.openImageModal = function(base64Src) {
    if (!base64Src) return;
    const img = document.getElementById('enlargedImage');
    const modal = document.getElementById('imageViewerModal');
    if(img && modal) { img.src = base64Src; modal.style.display = 'flex'; }
};

window.closeImageModal = function() {
    const modal = document.getElementById('imageViewerModal');
    const img = document.getElementById('enlargedImage');
    if(modal) modal.style.display = 'none';
    if(img) img.src = ''; 
};

// ==========================================
// 9. 總覽儀表板 (篩選、日期快速鍵、表格、匯出)
// ==========================================
window.applyTaskFilters = function() { window.loadDashboardData(); };

window.clearTaskFilters = function() {
    if(document.getElementById('taskFilterKeyword')) document.getElementById('taskFilterKeyword').value = '';
    if(document.getElementById('taskFilterStartDate')) document.getElementById('taskFilterStartDate').value = '';
    if(document.getElementById('taskFilterEndDate')) document.getElementById('taskFilterEndDate').value = '';
    if(document.getElementById('taskFilterStatus')) document.getElementById('taskFilterStatus').value = 'all';
    if(document.getElementById('selectAllTasks')) document.getElementById('selectAllTasks').checked = false;
    window.loadDashboardData();
};

window.setQuickDate = function(range) {
    const now = new Date(); let start, end;
    if (range === 'today') { start = now; end = now; } 
    else if (range === 'week') { 
        const day = now.getDay() || 7; 
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1); 
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 7); 
    } 
    else if (range === 'month') { 
        start = new Date(now.getFullYear(), now.getMonth(), 1); 
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0); 
    } 
    else if (range === 'year') { 
        start = new Date(now.getFullYear(), 0, 1); 
        end = new Date(now.getFullYear(), 11, 31); 
    }
    const format = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if(document.getElementById('taskFilterStartDate')) document.getElementById('taskFilterStartDate').value = format(start);
    if(document.getElementById('taskFilterEndDate')) document.getElementById('taskFilterEndDate').value = format(end);
    window.applyTaskFilters();
};

window.toggleAllTasks = function(source) {
    document.querySelectorAll('.task-checkbox').forEach(chk => { chk.checked = source.checked; });
};

window.loadDashboardData = function() {
    const tbody = document.getElementById('taskTableBody'); 
    if (!tbody) return; tbody.innerHTML = '';
    
    const kw = document.getElementById('taskFilterKeyword') ? document.getElementById('taskFilterKeyword').value.toLowerCase().trim() : '';
    const sRaw = document.getElementById('taskFilterStartDate') ? document.getElementById('taskFilterStartDate').value : '';
    const eRaw = document.getElementById('taskFilterEndDate') ? document.getElementById('taskFilterEndDate').value : '';
    const statusF = document.getElementById('taskFilterStatus') ? document.getElementById('taskFilterStatus').value : 'all';
    
    const sDate = sRaw ? sRaw.replace(/-/g, '') : '00000000';
    const eDate = eRaw ? eRaw.replace(/-/g, '') : '99999999';

    let filtered = dbTasks.filter(t => {
        if (statusF !== 'all') {
            if (statusF === 'completed' && t.status !== 'completed') return false;
            if (statusF === 'incomplete' && t.status === 'completed') return false;
        }
        if (kw && !`${t.guardName} ${t.routeName} ${t.status}`.toLowerCase().includes(kw)) return false;
        
        const targetT = (t.pointLogs && t.pointLogs.length > 0) ? t.pointLogs[0].timestamp : t.startTime;
        if (targetT && sRaw) {
            const d = new Date(targetT);
            if (!isNaN(d)) {
                const td = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
                if (td < sDate || td > eDate) return false;
            }
        }
        return true;
    });

    let cc = 0, oc = 0, ts = 0, ti = 0;
    filtered.forEach(t => { 
        if (t.status === 'completed') cc++; else oc++; 
        ts += (t.skippedPoints || []).length; 
        ti += (t.incidents || []).length; 
    });
    
    if(document.getElementById('statTotal')) document.getElementById('statTotal').innerText = filtered.length; 
    if(document.getElementById('statCompleted')) document.getElementById('statCompleted').innerText = cc;
    if(document.getElementById('statSkipped')) document.getElementById('statSkipped').innerText = ts;
    if(document.getElementById('statIncidents')) document.getElementById('statIncidents').innerText = ti;

    if (filtered.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#999; padding:20px;">目前尚無符合條件的任務紀錄。</td></tr>'; 
        return; 
    }

    filtered.forEach(t => {
        const sc = [...new Set(t.skippedPoints || [])].length;
        const ic = (t.incidents || []).length;

        let ab = '';
        if (sc > 0) ab += `<span class="badge badge-danger" style="margin-right:4px;">⚠️ 跳過 ${sc}</span>`;
        if (ic > 0) ab += `<span class="badge badge-info">📢 報事 ${ic}</span>`;
        if (!ab) ab = '<span class="badge badge-success">正常無異常</span>';

        const sb = t.status === 'completed' ? `<span class="badge badge-success">已完成</span>` : `<span class="badge badge-warning" style="color:#333;">執行中</span>`;
        
        let startStr = '<span style="color:#999;">尚未開始</span>';
        if (t.pointLogs && t.pointLogs.length > 0) {
            const d = new Date(t.pointLogs[0].timestamp); 
            startStr = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        } else if (t.startTime) {
            const d = new Date(t.startTime); 
            startStr = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} (建立)`;
        }

        tbody.innerHTML += `<tr>
            <td style="text-align: center;"><input type="checkbox" class="task-checkbox" value="${t.id}" style="transform:scale(1.3); cursor:pointer;"></td>
            <td><strong>${window.escapeHTML(t.routeName)}</strong></td>
            <td>${window.escapeHTML(t.guardName || '未登記')}</td>
            <td style="font-family:monospace; color:#555;">${startStr}</td>
            <td>${Math.min(t.currentPointIndex || 0, (t.points || []).length)} / ${(t.points || []).length}</td>
            <td>${ab}</td>
            <td>${sb}</td>
            <td style="white-space: nowrap;">
                <button class="btn btn-primary" style="padding: 4px 10px; font-size: 12px; margin:0;" onclick="window.viewTaskDetail('${t.id}')">🔍 查看</button>
                <button class="btn btn-danger" style="padding: 4px 10px; font-size: 12px; margin:0; margin-left: 4px;" onclick="window.deleteTask('${t.id}')">🗑️ 刪除</button>
            </td>
        </tr>`;
    });
};

window.deleteTask = async function(id) {
    if(confirm("確定要刪除這筆巡邏任務嗎？\n(此功能通常用於清除員工誤開、或一直卡在執行中的無效任務)")) { 
        try { 
            const t = dbTasks.find(x => x.id === id) || {id: id};
            await window.logDeletion("巡邏紀錄", t); 
            await deleteDoc(doc(db, "tasks", id)); 
        } catch(e) { alert("刪除失敗"); } 
    }
};

window.buildTaskReportHtml = function(task) {
    const routeDef = dbRoutes.find(r => r.name === task.routeName);
    const logs = task.pointLogs || [];
    const incidents = task.incidents || [];
    
    let startH = '<span style="color:#999; font-size:12px;">尚未開始</span>';
    let totalH = '<span style="color:#999; font-size:12px;">尚未開始</span>';
    let endH = '<span style="color:#999; font-size:12px;">尚未完成</span>';

    if (task.status === 'completed') endH = task.endTime || (logs.length > 0 ? new Date(logs[logs.length - 1].timestamp).toLocaleString() : '未知');
    
    if (logs.length > 0) {
        startH = new Date(logs[0].timestamp).toLocaleString();
        const ts = Math.floor((logs[logs.length - 1].timestamp - logs[0].timestamp) / 1000);
        totalH = `<strong style="color:var(--primary); font-size: 18px;">${Math.floor(ts / 60)} 分 ${ts % 60} 秒</strong>`;
    }

    let html = `
        <div style="background:#f8f9fa; padding:15px; border-radius:8px; margin-bottom:15px; border: 1px solid #eee; display:flex; justify-content:space-between;">
            <div>
                <p style="margin:0 0 8px 0; font-size:14px;"><strong>巡邏人員：</strong> ${window.escapeHTML(task.guardName || '未登記')}</p>
                <p style="margin:0 0 8px 0; font-size:14px; color:#666;"><strong>建立任務：</strong> ${task.startTime}</p>
                <p style="margin:0 0 8px 0; font-size:14px; color:var(--primary);"><strong>實際開始：</strong> ${startH}</p>
                <p style="margin:0; font-size:14px;"><strong>完成時間：</strong> ${endH}</p>
            </div>
            <div style="text-align:right;">
                <p style="margin:0 0 8px 0; font-size:14px;"><strong>實際總耗時：</strong></p>
                ${totalH}
            </div>
        </div>
        <div style="border: 1px solid #eee; border-radius: 8px; margin-bottom: 20px;">
            <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
                <thead style="background: #f0f2f5;">
                    <tr>
                        <th style="padding:10px; border-bottom:1px solid #ddd;">巡邏點</th>
                        <th style="padding:10px; border-bottom:1px solid #ddd;">狀態</th>
                        <th style="padding:10px; border-bottom:1px solid #ddd;">打卡時間</th>
                        <th style="padding:10px; border-bottom:1px solid #ddd;">距上點耗時</th>
                        <th style="padding:10px; border-bottom:1px solid #ddd; width:20%;">備註 (手寫區)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    let prevT = null;
    (task.points || []).forEach((pt, idx) => {
        const log = logs.find(l => l.pointName === pt);
        const inc = incidents.find(i => i.pointName === pt);
        let sb = `<span style="color:#888;">⏳ 尚未巡檢</span>`, ts = '-', gs = '-', ext = '';
        
        let maxInt = 0;
        if (routeDef) { 
            let pi = (routeDef.pointIntervals && routeDef.pointIntervals[idx]) ? routeDef.pointIntervals[idx] : 0; 
            maxInt = (pi > 0 ? pi : (routeDef.globalInterval || 0)) * 60; 
        }

        if (log) {
            ts = log.timeStr;
            if (prevT === null) gs = `<span style="color:#28a745; font-weight:bold;">📍 起始點</span>`;
            else {
                const sec = Math.floor((log.timestamp - prevT) / 1000);
                const m = Math.floor(sec / 60);
                const s = sec % 60;
                if (maxInt > 0 && sec > maxInt) { 
                    ext = `超時 ${Math.floor((sec-maxInt)/60)}分${(sec-maxInt)%60}秒`; 
                    gs = `<span style="color:var(--danger); font-weight:bold;">${m}分${s}秒 ❗️</span>`; 
                } else {
                    gs = m > 0 ? `<span style="color:#1a73e8; font-weight:bold;">${m}分${s}秒</span>` : `${s}秒`;
                }
            }
            prevT = log.timestamp;
            sb = log.isSkipped ? `<span style="color:var(--danger); font-weight:bold;">⚠️ 跳過</span>` : `<span style="color:var(--success); font-weight:bold;">✅ 正常</span>`;
        } else if (task.skippedPoints && task.skippedPoints.includes(pt)) { 
            sb = `<span style="color:var(--danger); font-weight:bold;">⚠️ 跳過</span>`; 
        } else if (idx < task.currentPointIndex) { 
            sb = `<span style="color:var(--success); font-weight:bold;">✅ 正常</span>`; 
        }

        let incHtml = '';
        if (inc) {
            incHtml = `<div style="margin-top: 5px; padding: 5px; background: #e0f7fa; border-radius: 4px; font-size: 11px; color: #006064;"><strong>📢 報事：</strong>${window.escapeHTML(inc.text || '已上傳現場照片')}</div>`;
        }
        
        const remarkContent = ext ? `<div style="color:var(--danger); font-size: 12px; font-weight:bold; margin-bottom: 2px;">${ext}</div><div style="border-bottom: 1px dashed #999; height: 10px; width: 100%;"></div>` : `<div style="border-bottom: 1px dashed #999; height: 20px; width: 100%;"></div>`;

        html += `<tr class="avoid-break">
            <td style="padding:10px;"><strong>${window.escapeHTML(pt)}</strong>${incHtml}</td>
            <td style="padding:10px;">${sb}</td>
            <td style="padding:10px; font-family:monospace; color:#555;">${ts}</td>
            <td style="padding:10px; color:#666;">${gs}</td>
            <td style="padding:10px;">${remarkContent}</td>
        </tr>`;
    });
    html += '</tbody></table></div>';

    if (incidents.length > 0) {
        html += `<h4 style="margin-top:20px; color:var(--danger); border-bottom:1px solid #eee; padding-bottom:8px;">🚨 異常報事紀錄 (${incidents.length} 筆)</h4>`;
        incidents.forEach((inc, index) => {
            html += `
            <div class="avoid-break" style="border:1px solid #f5c6cb; background:#fdfdfe; padding:15px; border-radius:6px; margin-bottom:15px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <p style="margin:0 0 8px 0; font-size:14px;"><strong>📍 回報地點：</strong>${window.escapeHTML(inc.pointName)}</p>
                    <span style="color:#888; font-size:12px;">⏰ ${inc.timeStr}</span>
                </div>
                <div style="margin:0 0 12px 0; font-size:14px; background:#f8f9fa; padding:10px; border-radius:4px; border:1px solid #eee;">
                    <strong>📝 描述說明：</strong><br><span style="color:#333; line-height:1.5;">${window.escapeHTML(inc.text||'無')}</span>
                </div>
                ${inc.photo ? `<div style="text-align:center; margin-bottom:10px;"><img src="${inc.photo}" onclick="window.openImageModal('${inc.photo}')" style="max-height:200px; border-radius:6px; cursor:pointer; border:1px solid #ddd;"></div>` : ''}
                <button class="btn btn-info pdf-hide-btn" style="width:100%; padding:8px; margin-top:5px;" onclick="window.openDispatchModal('${task.id}', ${index})">📤 轉派給其他部門</button>
            </div>`;
        });
    }
    return html;
};

// ==========================================
// 10. PDF 編輯器與合併匯出模組
// ==========================================
window.customCoverPdfDoc = null; 
window.finalCoverPdfBytes = null; 

window.triggerPdfSelect = function() { 
    if(document.getElementById('hiddenPdfInput')) document.getElementById('hiddenPdfInput').click(); 
};

window.handleCoverPdfSelect = async function(event) {
    const files = event.target.files; 
    if (!files || files.length === 0) return;

    try {
        const { PDFDocument } = PDFLib; 
        window.customCoverPdfDoc = await PDFDocument.create();

        for (let file of files) {
            const fileBytes = await file.arrayBuffer(); 
            const pdfDoc = await PDFDocument.load(fileBytes);
            const copiedPages = await window.customCoverPdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
            copiedPages.forEach(page => window.customCoverPdfDoc.addPage(page));
        }

        const modal = document.getElementById('pdfEditorModal');
        if(modal) modal.classList.add('active');
        await window.renderPdfThumbnails();
    } catch(e) { alert("讀取 PDF 失敗：" + e.message); }
    event.target.value = '';
};

window.renderPdfThumbnails = async function() {
    const container = document.getElementById('pdfThumbnailsContainer'); 
    if(!container) return;

    container.innerHTML = '<div style="padding: 20px; text-align: center; width: 100%; font-weight:bold; color:var(--primary);">⏳ 正在產生預覽縮圖...</div>';
    
    try {
        const pdfBytes = await window.customCoverPdfDoc.save();
        const loadingTask = pdfjsLib.getDocument({data: pdfBytes}); 
        const pdf = await loadingTask.promise;

        container.innerHTML = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i); 
            const viewport = page.getViewport({scale: 0.4});
            
            const wrapper = document.createElement('div'); 
            wrapper.style = "text-align: center; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); min-width: 160px; display: flex; flex-direction: column; justify-content: space-between;";
            
            const canvas = document.createElement('canvas'); 
            const context = canvas.getContext('2d');
            canvas.height = viewport.height; 
            canvas.width = viewport.width; 
            canvas.style = "border: 1px solid #ddd; max-height: 200px; width: auto; object-fit: contain; border-radius: 4px; margin: auto;";
            
            await page.render({canvasContext: context, viewport: viewport}).promise;
            
            wrapper.innerHTML = `<div style="font-size: 13px; margin-bottom: 8px; color: #666; font-weight: bold;">第 ${i} 頁</div>`;
            wrapper.appendChild(canvas);
            
            const controls = document.createElement('div'); 
            controls.style = "display: flex; justify-content: center; gap: 5px; margin-top: 10px;";
            controls.innerHTML = `<button type="button" class="btn btn-warning" style="padding: 6px; font-size: 12px; margin: 0; flex:1;" onclick="window.rotatePdfPage(${i-1})">⟳ 旋轉</button><button type="button" class="btn btn-danger" style="padding: 6px; font-size: 12px; margin: 0; flex:1;" onclick="window.deletePdfPage(${i-1})">🗑️ 刪除</button>`;
            
            wrapper.appendChild(controls); 
            container.appendChild(wrapper);
        }
    } catch (e) { 
        container.innerHTML = '<div style="color:red; padding: 20px;">預覽縮圖生成失敗，但仍可直接匯出。</div>'; 
    }
};

window.rotatePdfPage = async function(pageIndex) { 
    const page = window.customCoverPdfDoc.getPage(pageIndex); 
    page.setRotation(PDFLib.degrees(page.getRotation().angle + 90)); 
    await window.renderPdfThumbnails(); 
};

window.deletePdfPage = async function(pageIndex) {
    if(window.customCoverPdfDoc.getPageCount() <= 1) { alert("⚠️ 這是最後一頁，無法刪除！若不需要封面，請點選取消或移除。"); return; }
    if(confirm('確定要刪除這頁嗎？')) { 
        window.customCoverPdfDoc.removePage(pageIndex); 
        await window.renderPdfThumbnails(); 
    }
};

window.saveEditedPdf = async function() {
    window.finalCoverPdfBytes = await window.customCoverPdfDoc.save();
    window.closeModal('pdfEditorModal');
    document.querySelectorAll('.pdf-status-text').forEach(el => { el.innerText = `✅ 已就緒 (${window.customCoverPdfDoc.getPageCount()} 頁)`; el.style.color = "var(--success)"; });
    document.querySelectorAll('.btn-clear-pdf').forEach(el => el.style.display = "inline-block");
};

window.clearCoverPdf = function() {
    window.finalCoverPdfBytes = null; window.customCoverPdfDoc = null;
    document.querySelectorAll('.pdf-status-text').forEach(el => { el.innerText = `尚未選擇`; el.style.color = "#666"; });
    document.querySelectorAll('.btn-clear-pdf').forEach(el => el.style.display = "none");
};

window.viewTaskDetail = function(taskId) {
    const task = dbTasks.find(t => t.id === taskId); if (!task) return;
    document.getElementById('taskDetailTitle').innerText = `📋 任務報表：${task.routeName}`;
    document.getElementById('taskDetailContent').innerHTML = window.buildTaskReportHtml(task);
    document.getElementById('taskDetailModal').classList.add('active');
};

window.exportTaskToPDF = async function() {
    const exportArea = document.getElementById('taskExportArea');
    const tableContainer = document.getElementById('taskTableContainer');
    const rawTitle = document.getElementById('taskDetailTitle').innerText.replace(/[\/\\?%*:|"<>]/g, '-');
    
    const origScrollY = window.scrollY; window.scrollTo(0, 0);
    
    if (tableContainer) { tableContainer.style.maxHeight = 'none'; tableContainer.style.overflowY = 'visible'; }
    exportArea.querySelectorAll('.pdf-hide-btn').forEach(btn => btn.style.display = 'none');

    try {
        const pdfWorker = html2pdf().set({ 
            margin: [10, 10, 15, 10], image: { type: 'jpeg', quality: 0.98 }, 
            html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0 }, 
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, 
            pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.avoid-break'] } 
        }).from(exportArea);
        
        const reportBlob = await pdfWorker.output('blob'); 
        const reportBytes = await reportBlob.arrayBuffer();
        
        if (window.finalCoverPdfBytes) {
            const { PDFDocument } = PDFLib; 
            const mergedPdf = await PDFDocument.create();
            
            const coverDoc = await PDFDocument.load(window.finalCoverPdfBytes);
            const copiedCoverPages = await mergedPdf.copyPages(coverDoc, coverDoc.getPageIndices());
            copiedCoverPages.forEach(page => mergedPdf.addPage(page));
            
            const reportDoc = await PDFDocument.load(reportBytes);
            const reportPages = await mergedPdf.copyPages(reportDoc, reportDoc.getPageIndices());
            reportPages.forEach(page => mergedPdf.addPage(page));
            
            const blob = new Blob([await mergedPdf.save()], { type: 'application/pdf' });
            const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${rawTitle}_含封面.pdf`; link.click();
        } else {
            const link = document.createElement('a'); link.href = URL.createObjectURL(reportBlob); link.download = `${rawTitle}.pdf`; link.click();
        }
    } catch (e) { alert("匯出發生錯誤。"); console.error(e); } 
    finally {
        if (tableContainer) { tableContainer.style.maxHeight = '400px'; tableContainer.style.overflowY = 'auto'; }
        exportArea.querySelectorAll('.pdf-hide-btn').forEach(btn => btn.style.display = 'block'); 
        window.scrollTo(0, origScrollY);
    }
};

window.batchExportTasks = async function() {
    const checkboxes = document.querySelectorAll('.task-checkbox:checked');
    if (checkboxes.length === 0) { alert("請先勾選您要匯出的任務報表！"); return; }
    
    const btn = document.getElementById('batchExportBtn'); 
    btn.innerText = "⏳ 產生中..."; btn.disabled = true;
    
    const loadingOverlay = document.createElement('div');
    loadingOverlay.style.position = 'fixed'; loadingOverlay.style.top = '0'; loadingOverlay.style.left = '0'; 
    loadingOverlay.style.width = '100vw'; loadingOverlay.style.height = '100vh'; 
    loadingOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)'; loadingOverlay.style.color = 'white'; 
    loadingOverlay.style.display = 'flex'; loadingOverlay.style.flexDirection = 'column'; 
    loadingOverlay.style.justifyContent = 'center'; loadingOverlay.style.alignItems = 'center'; 
    loadingOverlay.style.zIndex = '999999'; 
    loadingOverlay.innerHTML = `<div style="font-size: 50px; margin-bottom: 20px;">📄</div><h2 style="margin: 0 0 10px 0;">批次報表合併產生中</h2><p style="color: #ccc; font-size: 14px;">系統正在逐一擷取真實報表，請勿切換視窗或捲動畫面...</p><p id="batchProgressText" style="color: var(--primary); font-size: 18px; font-weight: bold; margin-top: 15px;">進度: 0 / ${checkboxes.length}</p>`;
    document.body.appendChild(loadingOverlay);

    const origScrollY = window.scrollY; 
    window.scrollTo(0, 0);

    try {
        const { PDFDocument } = PDFLib; 
        const megaPdf = await PDFDocument.create();
        
        if (window.finalCoverPdfBytes) {
            const coverDoc = await PDFDocument.load(window.finalCoverPdfBytes);
            const copiedPages = await megaPdf.copyPages(coverDoc, coverDoc.getPageIndices());
            copiedPages.forEach(page => megaPdf.addPage(page));
        }

        const exportModal = document.getElementById('taskDetailModal');
        const exportArea = document.getElementById('taskExportArea');
        const detailContent = document.getElementById('taskDetailContent');
        exportModal.classList.add('active'); 
        exportModal.style.zIndex = '999998'; 

        let currentIndex = 0;
        for (let chk of checkboxes) {
            currentIndex++; 
            document.getElementById('batchProgressText').innerText = `處理進度: ${currentIndex} / ${checkboxes.length}`;
            
            const task = dbTasks.find(t => t.id === chk.value); 
            if (!task) continue;

            document.getElementById('taskDetailTitle').innerText = `📋 任務報表：${task.routeName}`;
            detailContent.innerHTML = window.buildTaskReportHtml(task);
            exportArea.querySelectorAll('.pdf-hide-btn').forEach(b => b.style.display = 'none');

            await new Promise(resolve => setTimeout(resolve, 500));

            const pdfWorker = html2pdf().set({ 
                margin: [10, 10, 15, 10], html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0 }, 
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, 
                pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.avoid-break', 'h2', 'h4'] } 
            }).from(exportArea);
            
            const reportBlob = await pdfWorker.output('blob'); 
            const reportBytes = await reportBlob.arrayBuffer();
            
            const reportDoc = await PDFDocument.load(reportBytes);
            const pages = await megaPdf.copyPages(reportDoc, reportDoc.getPageIndices());
            pages.forEach(p => megaPdf.addPage(p));
        }

        exportModal.classList.remove('active'); 
        exportModal.style.zIndex = ''; 
        
        const blob = new Blob([await megaPdf.save()], { type: 'application/pdf' });
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); 
        link.download = `批次巡邏報表合併檔_${window.getLocalDateStr(false)}.pdf`; link.click();
        
    } catch (err) { 
        alert("合併匯出失敗：" + err.message); console.error(err);
    } finally {
        window.scrollTo(0, origScrollY); 
        if(document.body.contains(loadingOverlay)) document.body.removeChild(loadingOverlay);
        document.getElementById('taskDetailModal').classList.remove('active');
        btn.innerText = "📥 批次合併匯出"; btn.disabled = false;
        if(document.getElementById('selectAllTasks')) document.getElementById('selectAllTasks').checked = false;
        document.querySelectorAll('.task-checkbox').forEach(c => c.checked = false);
    }
};

window.openDispatchModal = function(taskId, incidentIndex) {
    const task = dbTasks.find(t => t.id === taskId);
    const inc = task.incidents[incidentIndex];
    window.currentDispatchData = { location: inc.pointName, photo: inc.photo || "", reporter: task.guardName, reportTime: inc.timeStr };
    document.getElementById('dispatchLocation').innerText = inc.pointName;
    document.getElementById('dispatchText').value = inc.text || ""; 
    document.getElementById('dispatchModal').classList.add('active');
};

window.submitWorkOrder = async function() {
    const dept = document.getElementById('dispatchDept').value;
    const descText = document.getElementById('dispatchText').value.trim();
    if (!descText && !window.currentDispatchData.photo) { alert("請輸入工單說明或提供照片！"); return; }

    const prefix = dept === '工程部' ? 'ENG' : (dept === '清潔部' ? 'CLN' : 'MGT');
    const dateStr = window.getLocalDateStr(false);

    try {
        const q = query(collection(db, "workOrders"), where("department", "==", dept));
        const querySnapshot = await getDocs(q);
        const refNumber = `${prefix}-${dateStr}-${String(querySnapshot.size + 1).padStart(3, '0')}`;

        await addDoc(collection(db, "workOrders"), {
            refNumber: refNumber, department: dept, location: window.currentDispatchData.location,
            description: descText, photo: window.currentDispatchData.photo, reporter: window.currentDispatchData.reporter,
            reportTime: window.currentDispatchData.reportTime, dispatchTime: new Date().toLocaleString(), status: "待處理",
            dispatcherUsername: currentUser.username, dispatcherName: currentUser.name
        });
        alert(`✅ 成功派發！\n獨立工單編號：${refNumber}`);
        window.closeModal('dispatchModal');
    } catch (e) { alert("派單失敗，請檢查網路連線。"); }
};

// ==========================================
// 11. 人員管理與帳號控制
// ==========================================
window.loadUsersData = function() {
    try {
        const tbody = document.getElementById('usersTableBody'); 
        if (!tbody) return; tbody.innerHTML = '';
        
        const kw = document.getElementById('userFilterKeyword') ? document.getElementById('userFilterKeyword').value.toLowerCase().trim() : '';
        const roleFilter = document.getElementById('userFilterRole') ? document.getElementById('userFilterRole').value : 'all';

        let userCount = 0;
        for (let username in dbUsers) {
            const u = dbUsers[username];
            if (roleFilter !== 'all' && u.role !== roleFilter) continue;
            if (kw && !`${username} ${u.name || ''}`.toLowerCase().includes(kw)) continue;

            userCount++;
            let roleBadge = '';
            if (u.role === 'admin') roleBadge = '<span class="badge badge-danger">最高管理員</span>';
            else if (u.role === 'sub_admin') roleBadge = '<span class="badge badge-warning">二級管理員</span>';
            else if (u.role === 'engineering') roleBadge = '<span class="badge" style="background-color: #007bff; color: white;">工程部人員</span>';
            else if (u.role === 'cleaning') roleBadge = '<span class="badge" style="background-color: #17a2b8; color: white;">清潔部人員</span>';
            else if (u.role === 'assistant') roleBadge = '<span class="badge" style="background-color: #6f42c1; color: white;">物業助理</span>';
            else roleBadge = '<span class="badge badge-info">一般巡邏員</span>';

            let actionBtns = '';
            if (currentUser && currentUser.role === 'admin') {
                actionBtns = `<button class="btn btn-warning" style="padding: 4px 8px; font-size:12px;" onclick="window.openUserModal('${username}')">✏️ 編輯</button>
                    <button class="btn btn-danger" style="padding: 4px 8px; font-size:12px;" onclick="window.deleteUser('${username}')">🗑️ 停權/刪除</button>`;
            } else if (currentUser && currentUser.role === 'sub_admin') {
                if (username === currentUser.username) actionBtns = `<span style="font-size:12px; color:#888;">(請利用右上角改密碼)</span>`;
                else actionBtns = `<span style="font-size:12px; color:#aaa;">無權修改</span>`;
            }

            tbody.innerHTML += `<tr>
                <td><code>${window.escapeHTML(username)}</code></td>
                <td><strong>${window.escapeHTML(u.name || '未設定姓名')}</strong></td>
                <td><span style="color:#28a745; font-size:13px; font-weight:bold;">🔒 已加密</span></td>
                <td>${roleBadge}</td><td>${actionBtns}</td>
            </tr>`;
        }
        if (userCount === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#999; padding:20px;">找不到符合條件的人員資料。</td></tr>'; }
    } catch (err) { console.error("載入人員列表發生錯誤:", err); }
};

window.openUserModal = function(username = null) {
    if (username) {
        if (currentUser.role !== 'admin' && username !== currentUser.username) { alert("無權編輯！"); return; }
        document.getElementById('userModalTitle').innerText = "編輯人員資料與強制重設密碼";
        document.getElementById('editOriginalUsername').value = username;
        document.getElementById('userModalUsername').value = username; document.getElementById('userModalUsername').readOnly = true; 
        document.getElementById('userModalName').value = dbUsers[username].name;
        document.getElementById('userModalPassword').value = ""; document.getElementById('userModalPassword').readOnly = false; document.getElementById('userModalPassword').placeholder = "若不變更密碼請留空；輸入新密碼將強制重設！";
        document.getElementById('userModalRole').value = dbUsers[username].role || 'user';
    } else {
        document.getElementById('userModalTitle').innerText = "新增巡邏人員帳號"; 
        document.getElementById('editOriginalUsername').value = ""; document.getElementById('userModalUsername').value = ""; 
        document.getElementById('userModalUsername').readOnly = false; document.getElementById('userModalName').value = ""; 
        document.getElementById('userModalPassword').value = ""; document.getElementById('userModalPassword').readOnly = false; document.getElementById('userModalPassword').placeholder = "設定密碼 (至少6碼)";
        document.getElementById('userModalRole').value = "user";
    }
    document.getElementById('userModal').classList.add('active');
};

window.saveUser = async function() {
    const origUn = document.getElementById('editOriginalUsername').value;
    const un = document.getElementById('userModalUsername').value.trim().toLowerCase();
    const name = document.getElementById('userModalName').value.trim();
    const pw = document.getElementById('userModalPassword').value.trim();
    const role = document.getElementById('userModalRole').value;
    
    if (!un || !name) { alert("請填寫帳號與姓名！"); return; }
    try {
        if (origUn) {
            if (currentUser.role !== 'admin' && origUn !== currentUser.username) { alert("無權限！"); return; }
            let updatePayload = { role: role, name: name };
            if (pw) {
                if (pw.length < 6) { alert("新密碼至少需要 6 個字元！"); return; }
                document.getElementById('userModalTitle').innerText = "⏳ 正在建立新密碼驗證通道...";
                const shadowEmail = `${origUn}_alias_${Date.now()}${VIRTUAL_DOMAIN}`;
                await createUserWithEmailAndPassword(secondaryAuth, shadowEmail, pw);
                await secondaryAuth.signOut();
                updatePayload.authEmail = shadowEmail; 
            }
            await updateDoc(doc(db, "users", origUn), updatePayload);
            alert("✅ 人員資料已同步更新！");
        } else {
            if (!pw || pw.length < 6) { alert("請設定新密碼 (至少6個字元)！"); return; }
            if (dbUsers[un]) { alert("此帳號名稱已存在！"); return; }
            document.getElementById('userModalTitle').innerText = "⏳ 正在與 Google 安全伺服器連線建立帳號...";
            const virtualEmail = `${un}${VIRTUAL_DOMAIN}`;
            await createUserWithEmailAndPassword(secondaryAuth, virtualEmail, pw);
            await setDoc(doc(db, "users", un), { role: role, name: name, createdAt: new Date().toISOString() });
            await secondaryAuth.signOut();
            alert(`✅ 新帳號 ${un} 建立成功！`);
        }
        window.closeModal('userModal'); 
    } catch(e) { alert("儲存失敗：" + e.message); }
};

window.deleteUser = async function(username) {
    if (currentUser.role !== 'admin') { alert("只有最高管理員能刪除！"); return; }
    if (username === 'admin' || username === currentUser.username) { alert("不可刪除預設帳號或自己！"); return; }
    if (confirm(`警告：確定要停權並刪除帳號 ${username} 嗎？`)) {
        const userData = dbUsers[username];
        await window.logDeletion("人員帳號", userData);
        await deleteDoc(doc(db, "users", username));
        alert(`✅ 帳號 ${username} 已被停權。`);
    }
};

window.openSelfPasswordModal = function() {
    const pm = document.getElementById('profileMenu'); if(pm) pm.classList.remove('active');
    document.getElementById('selfOldPassword').value = ''; 
    document.getElementById('selfNewPassword').value = '';
    document.getElementById('selfConfirmPassword').value = ''; 
    document.getElementById('selfPasswordModal').classList.add('active');
};

window.saveSelfPassword = async function() {
    const oldPw = document.getElementById('selfOldPassword').value.trim();
    const newPw = document.getElementById('selfNewPassword').value.trim();
    const confPw = document.getElementById('selfConfirmPassword').value.trim();
    
    if (!oldPw || !newPw || !confPw) { alert("請填寫所有密碼欄位！"); return; }
    if (newPw !== confPw) { alert("新密碼不相符！"); return; }
    if (newPw.length < 6) { alert("新密碼至少需要 6 個字元！"); return; }
    try {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, oldPw);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, newPw);
        window.closeModal('selfPasswordModal');
        alert("✅ 密碼修改成功！基於安全機制，請使用新密碼重新登入。");
        await auth.signOut(); window.location.replace('../index.html'); 
    } catch(e) { alert("❌ 更新失敗，請確認舊密碼正確。"); }
};

// ==========================================
// 12. 路線與點位資料庫管理
// ==========================================
window.loadPointsData = function() {
    const tbody = document.getElementById('pointsTableBody'); if (!tbody) return; tbody.innerHTML = '';
    let keyword = document.getElementById('pointFilterKeyword') ? document.getElementById('pointFilterKeyword').value.toLowerCase().trim() : "";
    let points = [...dbPoints];
    
    if (keyword) points = points.filter(pt => (pt.floor && pt.floor.toLowerCase().includes(keyword)) || (pt.name && pt.name.toLowerCase().includes(keyword)));
    points.sort((a, b) => {
        let valA = (a[window.pointSortState.col] || "").toLowerCase(); let valB = (b[window.pointSortState.col] || "").toLowerCase();
        if (valA < valB) return window.pointSortState.desc ? 1 : -1;
        if (valA > valB) return window.pointSortState.desc ? -1 : 1; return 0;
    });

    if(document.getElementById('sort-point-floor')) document.getElementById('sort-point-floor').innerText = window.pointSortState.col === 'floor' ? (window.pointSortState.desc ? '▼' : '▲') : '';
    if(document.getElementById('sort-point-name')) document.getElementById('sort-point-name').innerText = window.pointSortState.col === 'name' ? (window.pointSortState.desc ? '▼' : '▲') : '';

    if (!points || points.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999; padding:20px;">目前尚無符合的點位資料。</td></tr>'; return; }

    points.forEach((pt) => {
        const fullPtName = `${pt.floor || ''} ${pt.name || ''}`.trim();
        let boundUids = Object.keys(dbUidMappings || {}).filter(k => dbUidMappings[k] === fullPtName);
        let uidDisplay = boundUids.length > 0 ? `<code style="color: var(--primary);">${boundUids.join(', ')}</code>` : '<span style="color:#999;">尚未綁定</span>';
        
        tbody.innerHTML += `<tr>
            <td><strong>${window.escapeHTML(pt.floor || '無')}</strong></td>
            <td>${window.escapeHTML(pt.name || '無')}</td>
            <td>${uidDisplay}</td>
            <td>
                <button class="btn btn-warning" style="padding: 4px 8px; font-size:12px;" onclick="window.editPoint('${pt.id}')">✏️ 編輯</button>
                <button class="btn btn-danger" style="padding: 4px 8px; font-size:12px;" onclick="window.deletePoint('${pt.id}')">🗑️ 刪除</button>
            </td>
        </tr>`;
    });
};

window.openPointModal = function(ptId = null) {
    const uniqueFloors = [...new Set(dbPoints.map(p => p.floor))];
    const dataList = document.getElementById('floorDatalist');
    const kwContainer = document.getElementById('quickFloorKeywords');
    if(dataList) dataList.innerHTML = ''; 
    if(kwContainer) kwContainer.innerHTML = '<span style="font-size:12px; color:#666;">快速加入：</span>';
    const commonKeywords = ['A棟', 'B棟', '1F', 'B1', 'RF'];
    commonKeywords.forEach(kw => { if(kwContainer) kwContainer.innerHTML += `<span class="badge badge-warning" style="cursor:pointer; user-select:none;" onclick="window.appendFloorText('${kw}')">+ ${kw}</span>`; });
    uniqueFloors.forEach(f => {
        if(dataList) dataList.innerHTML += `<option value="${f}"></option>`;
        if (!commonKeywords.includes(f) && kwContainer) { kwContainer.innerHTML += `<span class="badge badge-info" style="cursor:pointer; user-select:none;" onclick="window.setFloorText('${f}')">${f}</span>`; }
    });

    if (ptId !== null) {
        const pt = dbPoints.find(p => p.id === ptId);
        const fullPtName = `${pt.floor} ${pt.name}`;
        const boundUids = Object.keys(dbUidMappings).filter(k => dbUidMappings[k] === fullPtName);
        document.getElementById('pointModalTitle').innerText = "編輯巡邏點位"; document.getElementById('editPointId').value = ptId;
        document.getElementById('pointModalFloor').value = pt.floor; document.getElementById('pointModalName').value = pt.name;
        document.getElementById('pointModalUid').value = boundUids.length > 0 ? boundUids[0] : "";
    } else {
        document.getElementById('pointModalTitle').innerText = "新增巡邏點位"; document.getElementById('editPointId').value = "";
        document.getElementById('pointModalFloor').value = ""; document.getElementById('pointModalName').value = ""; document.getElementById('pointModalUid').value = "";
    }
    document.getElementById('pointModal').classList.add('active');
};

window.appendFloorText = function(text) { 
    const input = document.getElementById('pointModalFloor'); 
    if (input.value && !input.value.endsWith(' ')) input.value += ' ' + text; else input.value += text; input.focus(); 
};
window.setFloorText = function(text) { 
    document.getElementById('pointModalFloor').value = text; document.getElementById('pointModalFloor').focus(); 
};

window.savePoint = async function() {
    const floor = document.getElementById('pointModalFloor').value.trim(), name = document.getElementById('pointModalName').value.trim();
    const inputUid = document.getElementById('pointModalUid').value.trim(), editIdx = document.getElementById('editPointId').value;
    if (!floor || !name) { alert("樓層與位置名為必填！"); return; }
    const newFullName = `${floor} ${name}`;
    try {
        if (editIdx !== "") {
            const pt = dbPoints.find(p => p.id === editIdx);
            const oldFullName = `${pt.floor} ${pt.name}`;
            await updateDoc(doc(db, "points", editIdx), { floor, name });
            const updatePromises = [];
            if (oldFullName !== newFullName) {
                for (let k in dbUidMappings) { if (dbUidMappings[k] === oldFullName) updatePromises.push(setDoc(doc(db, "uidMappings", k), { locationName: newFullName })); }
                for (let r of dbRoutes) {
                    if (r.points.includes(oldFullName)) {
                        const newPoints = r.points.map(p => p === oldFullName ? newFullName : p);
                        updatePromises.push(updateDoc(doc(db, "routes", r.id), { points: newPoints }));
                    }
                }
            }
            await Promise.all(updatePromises);
        } else { await addDoc(collection(db, "points"), { floor, name }); }
        const mapPromises = [];
        for (let k in dbUidMappings) { if (dbUidMappings[k] === newFullName) mapPromises.push(deleteDoc(doc(db, "uidMappings", k))); }
        if (inputUid) mapPromises.push(setDoc(doc(db, "uidMappings", inputUid), { locationName: newFullName }));
        await Promise.all(mapPromises);
        window.closeModal('pointModal');
    } catch(e) { console.error("Error saving point", e); alert("儲存失敗！"); }
};

window.editPoint = function(id) { window.openPointModal(id); };

window.deletePoint = async function(id) { 
    if (confirm("確定要刪除這個巡邏點嗎？")) { 
        const pt = dbPoints.find(p => p.id === id) || { id: id };
        await window.logDeletion("巡邏點位", pt);
        await deleteDoc(doc(db, "points", id)); 
    } 
};

window.exportRoutesBackup = function() {
    const routesData = JSON.stringify(dbRoutes, null, 2);
    const blob = new Blob([routesData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `雲端巡邏路線備份_${window.getLocalDateStr(false)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
};

window.handleImportRoutes = function(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!Array.isArray(importedData)) throw new Error("無效的檔案格式");
            const userChoice = confirm(`成功讀取了 ${importedData.length} 條路線設定。\n\n[確定] 覆蓋現有所有路線 (舊路線將被刪除)\n[取消] 與現有的路線合併儲存 (新增)`);
            if (userChoice) {
                const deletePromises = dbRoutes.map(r => deleteDoc(doc(db, "routes", r.id)));
                await Promise.all(deletePromises);
            }
            const addPromises = importedData.map(route => {
                return addDoc(collection(db, "routes"), {
                    mainRoute: route.mainRoute || '', // 🌟 支援匯入主路線設定
                    name: route.name, points: route.points, pointIntervals: route.pointIntervals || [],
                    routeOrder: route.routeOrder || 999, globalInterval: route.globalInterval || 0, isActive: route.isActive !== false
                });
            });
            await Promise.all(addPromises);
            alert("✅ 路線匯入至雲端完成！");
        } catch (err) { alert("❌ 匯入失敗：檔案格式不正確或損壞。"); }
        event.target.value = '';
    };
    reader.readAsText(file);
};

// 🌟 改良：將表格改為「依主路線分組」的視覺化結構
// 🌟 改良：依主路線「資料夾」分群顯示
// 🌟 路線表格載入 (絕對隔離版：保證子路線獨立分群)
window.loadRoutesData = function() {
    const tbody = document.getElementById('routesTableBody'); 
    if (!tbody) return; 
    tbody.innerHTML = '';
    
    let keyword = document.getElementById('routeFilterKeyword') ? document.getElementById('routeFilterKeyword').value.toLowerCase().trim() : "";
    
    // 使用深拷貝確保資料絕對不連動
    let routes = JSON.parse(JSON.stringify(dbRoutes));

    if (keyword) {
        routes = routes.filter(r => (r.name && r.name.toLowerCase().includes(keyword)) || (r.mainRoute && r.mainRoute.toLowerCase().includes(keyword)));
    }
    
    // 子路線的排序規則
    routes.sort((a, b) => {
        if (window.routeSortState.col === 'order') {
            let valA = a.routeOrder || 999; let valB = b.routeOrder || 999;
            return window.routeSortState.desc ? valB - valA : valA - valB;
        } else {
            let valA = (a.name || "").toLowerCase(); let valB = (b.name || "").toLowerCase();
            if (valA < valB) return window.routeSortState.desc ? 1 : -1;
            if (valA > valB) return window.routeSortState.desc ? -1 : 1; return 0;
        }
    });

    if(document.getElementById('sort-route-order')) document.getElementById('sort-route-order').innerText = window.routeSortState.col === 'order' ? (window.routeSortState.desc ? '▼' : '▲') : '';
    if(document.getElementById('sort-route-name')) document.getElementById('sort-route-name').innerText = window.routeSortState.col === 'name' ? (window.routeSortState.desc ? '▼' : '▲') : '';

    if (!routes || routes.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#999; padding:20px;">目前尚無符合的路線資料。</td></tr>'; 
        return; 
    }
    
    // 🌟 將路線進行主路線群組歸類
    let groupedRoutes = {};
    routes.forEach(r => {
        let key = r.mainRoute ? r.mainRoute.trim() : '📌 獨立路線 (未分類)';
        if (!groupedRoutes[key]) groupedRoutes[key] = [];
        groupedRoutes[key].push(r);
    });

    // 將群組名稱依字母排序 (獨立路線放最後)
    let groupKeys = Object.keys(groupedRoutes).sort((a, b) => {
        if (a === '📌 獨立路線 (未分類)') return 1;
        if (b === '📌 獨立路線 (未分類)') return -1;
        return a.localeCompare(b);
    });

    groupKeys.forEach(groupName => {
        // 畫出主路線標題列
        tbody.innerHTML += `
            <tr style="background-color: #e8f0fe;">
                <td colspan="6" style="padding: 10px 15px; border-left: 4px solid var(--primary);">
                    <strong style="color: var(--primary); font-size: 15px;">📂 主路線群組：${window.escapeHTML(groupName)}</strong>
                </td>
            </tr>
        `;

        // 畫出該主路線底下的獨立子路線
        groupedRoutes[groupName].forEach((route) => {
            const globalInt = route.globalInterval || 0;
            const safePoints = route.points || []; 
            const formattedPoints = safePoints.map((pt, i) => {
                let interval = (route.pointIntervals && route.pointIntervals[i]) ? route.pointIntervals[i] : 0;
                let effectiveInterval = interval > 0 ? interval : globalInt;
                let intervalTag = effectiveInterval > 0 ? ` <span style="color:var(--danger); font-size:11px;">(${effectiveInterval}分)</span>` : '';
                return `<span style="display:inline-block; margin-bottom:4px;"><b>${i + 1}.</b> ${window.escapeHTML(pt)}${intervalTag}</span>`;
            }).join(' ➔ ');
            
            const statusBadge = route.isActive !== false ? '<span class="badge badge-success">已啟用</span>' : '<span class="badge badge-danger">已停用</span>';
            
            tbody.innerHTML += `<tr>
                <td style="padding-left: 30px;"><b style="font-size:14px; color:#666;">${route.routeOrder || '-'}</b></td>
                <td><strong>${window.escapeHTML(route.name || '未命名路線')}</strong></td>
                <td>${statusBadge}</td>
                <td>${safePoints.length} 點</td>
                <td style="font-size:13px; color:#555;">${formattedPoints || '<span style="color:#aaa;">無點位</span>'}</td>
                <td style="white-space: nowrap;">
                    <button class="btn btn-warning" style="padding: 4px 8px; font-size:12px; margin:0;" onclick="window.editRoute('${route.id}')">✏️ 編輯</button>
                    <button class="btn btn-danger" style="padding: 4px 8px; font-size:12px; margin:0; margin-left: 4px;" onclick="window.deleteRoute('${route.id}')">🗑️ 刪除</button>
                </td>
            </tr>`;
        });
    });
};

window.openRouteModal = function(routeId = null) {
    const container = document.getElementById('pointsInputContainer'); 
    container.innerHTML = '';
    
    // 🌟 更新主路線的歷史下拉選單
    const dataList = document.getElementById('mainRouteDatalist');
    if (dataList) {
        dataList.innerHTML = '';
        const uniqueMains = [...new Set(dbRoutes.map(r => r.mainRoute).filter(Boolean))];
        uniqueMains.forEach(m => dataList.innerHTML += `<option value="${window.escapeHTML(m)}"></option>`);
    }

    if (routeId) {
        const route = dbRoutes.find(r => r.id === routeId);
        document.getElementById('routeModalTitle').innerText = "編輯巡邏路線"; 
        document.getElementById('editRouteId').value = routeId;
        
        // 絕對獨立給值
        document.getElementById('routeModalMainRoute').value = route.mainRoute ? route.mainRoute : ''; 
        document.getElementById('routeModalName').value = route.name ? route.name : ''; 
        document.getElementById('routeModalOrder').value = route.routeOrder || 1;
        document.getElementById('routeModalGlobalInterval').value = route.globalInterval || 0; 
        document.getElementById('routeModalActive').checked = route.isActive !== false;
        
        route.points.forEach((pt, idx) => { 
            window.addPointInputRow(pt, idx + 1, (route.pointIntervals && route.pointIntervals[idx] !== undefined) ? route.pointIntervals[idx] : 0); 
        });
    } else {
        document.getElementById('routeModalTitle').innerText = "新增巡邏路線"; 
        document.getElementById('editRouteId').value = "";
        document.getElementById('routeModalMainRoute').value = ''; 
        document.getElementById('routeModalName').value = ""; 
        document.getElementById('routeModalOrder').value = dbRoutes.length + 1;
        document.getElementById('routeModalGlobalInterval').value = 0; 
        document.getElementById('routeModalActive').checked = true;
        
        window.addPointInputRow('', 1, 0); 
        window.addPointInputRow('', 2, 0);
    }
    document.getElementById('routeModal').classList.add('active');
};

window.addPointInputRow = function(fullPointName = '', orderNumber = null, maxInterval = 0) {
    const container = document.getElementById('pointsInputContainer');
    if (orderNumber === null) orderNumber = container.children.length + 1;
    const uniqueFloors = [...new Set(dbPoints.map(p => p.floor))];
    let selectedFloor = '', selectedName = '';
    if (fullPointName) {
        const found = dbPoints.find(p => `${p.floor} ${p.name}` === fullPointName);
        if (found) { selectedFloor = found.floor; selectedName = found.name; }
    }
    let floorOpts = '<option value="">-- 選樓層 --</option>';
    uniqueFloors.forEach(f => { floorOpts += `<option value="${f}" ${f === selectedFloor ? 'selected' : ''}>${f}</option>`; });
    const div = document.createElement('div'); div.className = 'point-input-row';
    div.innerHTML = `
        <input type="number" class="form-control point-order" value="${orderNumber}" onchange="window.handleOrderChange(this)" style="width: 60px; text-align: center; font-weight: bold; background: #e8f0fe;">
        <select class="form-control point-floor-select" onchange="window.updateNameOptions(this)" style="flex: 1.2;">${floorOpts}</select>
        <select class="form-control point-name-select" style="flex: 1.5;"><option value="">-- 先選樓層 --</option></select>
        <input type="number" class="form-control point-interval" value="${maxInterval}" min="0" style="width: 85px;" placeholder="限時(分)" title="距離上個點的超時限制(分鐘)">
        <button type="button" class="btn btn-danger" onclick="this.parentElement.remove()" style="padding: 10px;">❌</button>`;
    container.appendChild(div);
    if (selectedFloor) window.updateNameOptions(div.querySelector('.point-floor-select'), selectedName);
};

window.updateNameOptions = function(floorSelectElem, preSelectedName = '') {
    const floor = floorSelectElem.value, nameSelect = floorSelectElem.parentElement.querySelector('.point-name-select');
    if (!floor) { nameSelect.innerHTML = '<option value="">-- 先選樓層 --</option>'; return; }
    let nameOpts = '<option value="">-- 選地點 --</option>';
    dbPoints.filter(p => p.floor === floor).forEach(p => { nameOpts += `<option value="${p.name}" ${p.name === preSelectedName ? 'selected' : ''}>${p.name}</option>`; });
    nameSelect.innerHTML = nameOpts;
};

window.handleOrderChange = function(inputElement) {
    const newOrder = parseInt(inputElement.value); if (isNaN(newOrder) || newOrder < 1) { inputElement.value = 1; return; }
    const allInputs = Array.from(document.querySelectorAll('.point-order'));
    if (allInputs.some(inp => inp !== inputElement && parseInt(inp.value) === newOrder)) {
        if (confirm(`已有設定為第 ${newOrder} 個點的地點。\n是否將此地點設為第 ${newOrder} 點，並將後續順延？`)) {
            allInputs.forEach(inp => { if (inp !== inputElement && parseInt(inp.value) >= newOrder) inp.value = parseInt(inp.value) + 1; });
            window.reorderUI();
        }
    } else { window.reorderUI(); }
};

window.reorderUI = function() {
    const container = document.getElementById('pointsInputContainer'), rows = Array.from(container.children);
    rows.sort((a, b) => (parseInt(a.querySelector('.point-order').value) || 999) - (parseInt(b.querySelector('.point-order').value) || 999));
    rows.forEach(row => container.appendChild(row));
};

window.saveRoute = async function() {
    // 🌟 保證只抓取當下輸入框的值，不受其他路線干擾
    const currentMainRoute = document.getElementById('routeModalMainRoute').value.trim(); 
    const currentName = document.getElementById('routeModalName').value.trim();
    const targetRouteId = document.getElementById('editRouteId').value;
    const routeOrder = parseInt(document.getElementById('routeModalOrder').value) || 999;
    const isActive = document.getElementById('routeModalActive').checked;
    const globalInterval = parseInt(document.getElementById('routeModalGlobalInterval').value) || 0;
    
    let pointsData = [];
    document.querySelectorAll('.point-input-row').forEach(row => {
        const order = parseInt(row.querySelector('.point-order').value) || 999;
        const floor = row.querySelector('.point-floor-select').value;
        const ptName = row.querySelector('.point-name-select').value;
        const interval = parseInt(row.querySelector('.point-interval').value) || 0;
        if (floor && ptName) pointsData.push({ order: order, name: `${floor} ${ptName}`, interval: interval });
    });
    
    if (!currentName) { alert("請輸入子路線名稱！"); return; }
    if (pointsData.length === 0) { alert("至少需選擇一個巡邏點！"); return; }
    if (new Set(pointsData.map(p => p.order)).size !== pointsData.length) { alert("⚠️ 儲存失敗：發現相同的次序數字！"); return; }
    
    pointsData.sort((a, b) => a.order - b.order);
    
    // 獨立封裝 Payload，絕對只針對單一物件更新
    const payload = { 
        mainRoute: currentMainRoute, 
        name: currentName, 
        points: pointsData.map(p => p.name), 
        pointIntervals: pointsData.map(p => p.interval), 
        routeOrder: routeOrder, 
        globalInterval: globalInterval, 
        isActive: isActive 
    };
    
    try {
        if (targetRouteId !== "") { 
            // 嚴格指定只更新該 ID
            await updateDoc(doc(db, "routes", targetRouteId), payload); 
        } else { 
            await addDoc(collection(db, "routes"), payload); 
        }
        window.closeModal('routeModal'); 
        alert("路線設定已獨立儲存成功！");
    } catch(e) { alert("儲存失敗"); }
};

window.editRoute = function(id) { window.openRouteModal(id); };

window.deleteRoute = async function(id) { 
    if (confirm("確定要刪除這條路線嗎？")) {
        const route = dbRoutes.find(r => r.id === id) || { id: id };
        await window.logDeletion("巡邏路線", route);
        await deleteDoc(doc(db, "routes", id));
    }
};
