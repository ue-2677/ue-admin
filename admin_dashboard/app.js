import { db, auth, secondaryAuth, escapeHTML, getLocalDateStr } from '../firebase-config.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, setDoc, query, orderBy, getDocs, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

window.escapeHTML = escapeHTML;
window.getLocalDateStr = getLocalDateStr;

let dbUsers = {}; let dbRoutes = []; let dbPoints = []; let dbUidMappings = {};
let dbTasks = []; let dbAssistantRequests = []; let dbNotices = [];
let currentUser = null; const VIRTUAL_DOMAIN = "@patrol.com";

// 表格全域排序與搜尋狀態設定
window.pointSortState = { col: 'floor', desc: false };
window.routeSortState = { col: 'order', desc: false };

window.sortPoints = function(col) {
    window.pointSortState.desc = (window.pointSortState.col === col) ? !window.pointSortState.desc : false;
    window.pointSortState.col = col; window.loadPointsData();
};
window.sortRoutes = function(col) {
    window.routeSortState.desc = (window.routeSortState.col === col) ? !window.routeSortState.desc : false;
    window.routeSortState.col = col; window.loadRoutesData();
};

window.applyRouteFilter = function() { window.loadRoutesData(); };
window.applyPointFilter = function() { window.loadPointsData(); };

window.toggleProfileMenu = function(e) {
    e.stopPropagation();
    const menu = document.getElementById('profileMenu');
    if(menu) menu.classList.toggle('active');
};

window.toggleDeptMenu = function(e) {
    e.stopPropagation();
    const menu = document.getElementById('deptSubMenu');
    const arrow = document.getElementById('deptArrow');
    if(menu) {
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
    if(document.getElementById(tabId)) document.getElementById(tabId).classList.add('active');
};

window.switchAdminView = function(viewId, element = null) {
    if(element) {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
        let titleText = element.innerText;
        if(titleText.includes('\n')) titleText = titleText.split('\n')[1]; 
        else if(titleText.includes(' ')) titleText = titleText.split(' ')[1]; 
        if(document.getElementById('topbarTitle')) document.getElementById('topbarTitle').innerText = titleText;
    }
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    if(document.getElementById(viewId)) document.getElementById(viewId).classList.add('active');
    window.refreshCurrentView();
};

window.refreshCurrentView = function() {
    if(document.getElementById('view-dashboard') && document.getElementById('view-dashboard').classList.contains('active')) window.loadDashboardData();
    if(document.getElementById('view-management') && document.getElementById('view-management').classList.contains('active')) { window.loadRoutesData(); window.loadPointsData(); }
    if(document.getElementById('view-users') && document.getElementById('view-users').classList.contains('active')) window.loadUsersData();
    if(document.getElementById('view-notices') && document.getElementById('view-notices').classList.contains('active')) window.loadNoticesData();
    if(document.getElementById('view-assistant') && document.getElementById('view-assistant').classList.contains('active')) window.loadAssistantRequests(); 
};

window.closeModal = function(modalId) { 
    if(document.getElementById(modalId)) document.getElementById(modalId).classList.remove('active'); 
};

// 🔐 登入驗證與監聽
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
                    auth.signOut(); alert("⚠️ 密碼已被重設，請重新登入！"); window.location.replace('index.html'); return;
                }
                const dbSessionId = data.currentSessionId;
                const myLocalSessionId = localStorage.getItem('patrolSessionId');
                if (dbSessionId && myLocalSessionId && dbSessionId !== myLocalSessionId) {
                    if (userDocListener) userDocListener();
                    auth.signOut(); localStorage.removeItem('patrolSessionId');
                    alert("⚠️ 帳號已在其他設備登入，本機強制登出！"); window.location.replace('index.html'); return;
                }

                currentUser = { username: username, ...data };
                if (currentUser.role !== 'admin' && currentUser.role !== 'sub_admin') {
                    alert("權限不足！"); auth.signOut(); window.location.replace('index.html'); return;
                }
                
                if (!window.isSystemInitialized) {
                    window.isSystemInitialized = true;
                    if(document.getElementById('sidebarContainer')) document.getElementById('sidebarContainer').style.display = 'flex';
                    if(document.getElementById('mainContentContainer')) document.getElementById('mainContentContainer').style.display = 'flex';
                    if(document.getElementById('currentUserDisplay')) document.getElementById('currentUserDisplay').innerHTML = `👤 ${currentUser.name} ▼`;
                    
                    initRealtimeListeners();

                    // 自動判斷並載入首頁
                    if (window.location.pathname.includes('mobile.html')) {
                        const navs = document.querySelectorAll('.mobile-bottom-nav .nav-item');
                        if(navs.length > 1) window.switchAdminView('view-mobile-home', navs[1]);
                    } else {
                        if (document.querySelector('.sidebar .nav-item.active')) {
                            window.switchAdminView('view-dashboard', document.querySelector('.sidebar .nav-item.active'));
                        }
                    }
                }
            } else {
                if (userDocListener) userDocListener(); auth.signOut(); window.location.replace('index.html');
            }
        });
    } else {
        if (userDocListener) { userDocListener(); userDocListener = null; }
        window.isSystemInitialized = false; window.location.replace('index.html');
    }
});

window.performLogout = async function() {
    if(confirm("確定要登出嗎？")) { 
        await auth.signOut(); localStorage.removeItem('cloudCurrentUser'); localStorage.removeItem('patrolSessionId'); window.location.replace('index.html');
    }
};

window.playAlertSound = function() {
    new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play().catch(e=>console.log(e));
};

window.showSystemNotification = function(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body: body, icon: 'https://cdn-icons-png.flaticon.com/512/1827/1827370.png' });
    }
};

let isInitialLoad = true; 
function initRealtimeListeners() {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") Notification.requestPermission();

    onSnapshot(query(collection(db, "notices"), orderBy("createdAt", "desc")), (snapshot) => {
        dbNotices = []; snapshot.forEach(doc => { dbNotices.push({ id: doc.id, ...doc.data() }); });
        if(document.getElementById('view-notices') && document.getElementById('view-notices').classList.contains('active')) window.loadNoticesData();
    });

    onSnapshot(query(collection(db, "workOrders"), where("department", "==", "管理部")), (snapshot) => {
        dbAssistantRequests = []; 
        snapshot.forEach(doc => { dbAssistantRequests.push({ id: doc.id, ...doc.data() }); });
        if(document.getElementById('view-assistant') && document.getElementById('view-assistant').classList.contains('active')) window.loadAssistantRequests();
        window.updateAssistantBadge(); 

        if (!isInitialLoad) {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added" && change.doc.data().dispatcherUsername !== currentUser.username) {
                    window.playAlertSound();
                    window.showSystemNotification("🔔 新助理需求", `地點: ${change.doc.data().location}`);
                }
            });
        }
    });

    setTimeout(() => { isInitialLoad = false; }, 3000);

    onSnapshot(collection(db, "users"), (snapshot) => {
        dbUsers = {}; snapshot.forEach(doc => { dbUsers[doc.id] = doc.data(); });
        if(document.getElementById('view-users') && document.getElementById('view-users').classList.contains('active')) window.loadUsersData();
    });
    onSnapshot(collection(db, "points"), (snapshot) => {
        dbPoints = []; snapshot.forEach(doc => { dbPoints.push({ id: doc.id, ...doc.data() }); });
        if(document.getElementById('view-management') && document.getElementById('view-management').classList.contains('active')) window.loadPointsData();
    });
    onSnapshot(collection(db, "routes"), (snapshot) => {
        dbRoutes = []; snapshot.forEach(doc => { dbRoutes.push({ id: doc.id, ...doc.data() }); });
        if(document.getElementById('view-management') && document.getElementById('view-management').classList.contains('active')) window.loadRoutesData();
    });
    onSnapshot(collection(db, "uidMappings"), (snapshot) => {
        dbUidMappings = {}; snapshot.forEach(doc => { dbUidMappings[doc.id] = doc.data().locationName; });
        if(document.getElementById('view-management') && document.getElementById('view-management').classList.contains('active')) window.loadPointsData();
    });
    onSnapshot(query(collection(db, "tasks"), orderBy("startTimestamp", "desc")), (snapshot) => {
        dbTasks = []; snapshot.forEach(doc => { dbTasks.push({ id: doc.id, ...doc.data() }); });
        if(document.getElementById('view-dashboard') && document.getElementById('view-dashboard').classList.contains('active')) window.loadDashboardData();
    });
    onSnapshot(query(collection(db, "deleteLogs"), orderBy("deletedTimestamp", "desc")), (snapshot) => {
        const tbody = document.getElementById('deleteLogsTableBody');
        if (!tbody) return; tbody.innerHTML = '';
        snapshot.forEach(doc => {
            const log = doc.data();
            tbody.innerHTML += `<tr><td>${log.deletedAt}</td><td style="color:var(--danger); font-weight:bold;">${log.deletedBy}</td>
                <td><span class="badge badge-warning">${log.itemType}</span></td>
                <td><textarea readonly style="width:100%; height:50px; font-size:11px;">${log.dataSnapshot}</textarea></td></tr>`;
        });
    });
}

setInterval(() => { if(document.getElementById('clock')) document.getElementById('clock').innerText = new Date().toLocaleString(); }, 1000);

window.logDeletion = async function(itemType, deletedData) {
    await addDoc(collection(db, "deleteLogs"), { deletedAt: new Date().toLocaleString(), deletedTimestamp: Date.now(), deletedBy: currentUser.name + " (" + currentUser.username + ")", itemType: itemType, dataSnapshot: JSON.stringify(deletedData) });
};

window.loadNoticesData = function() {
    const tbody = document.getElementById('noticesTableBody'); if(!tbody) return; tbody.innerHTML = '';
    const statusFilter = document.getElementById('noticeFilterStatus') ? document.getElementById('noticeFilterStatus').value : 'all';
    const today = window.getLocalDateStr(false);
    let count = 0;

    dbNotices.forEach(notice => {
        const sDate = notice.startDate.replace(/-/g, ''); const eDate = notice.endDate.replace(/-/g, '');
        const isActive = (today >= sDate && today <= eDate);
        if (statusFilter === 'active' && !isActive) return; if (statusFilter === 'expired' && isActive) return; count++;
        let statusTag = isActive ? '<span class="badge badge-success">生效中</span>' : '<span class="badge badge-secondary">未生效 / 已過期</span>';
        const depts = notice.departments.map(d => `<span class="badge badge-info" style="margin-right:4px;">${d}</span>`).join('');
        tbody.innerHTML += `<tr>
            <td><strong>${window.escapeHTML(notice.text)}</strong><br><span style="font-size:11px; color:#888;">發布者: ${notice.createdBy}</span></td>
            <td style="font-family:monospace; font-size:13px;">${notice.startDate} ~ ${notice.endDate}<br>${statusTag}</td><td>${depts}</td>
            <td><button class="btn btn-warning" style="padding: 4px 8px; font-size:12px; margin-bottom:4px;" onclick="window.editNotice('${notice.id}')">✏️</button>
            <button class="btn btn-danger" style="padding: 4px 8px; font-size:12px;" onclick="window.deleteNotice('${notice.id}')">🗑️</button></td></tr>`;
    });
    if (count === 0) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999; padding:20px;">無通知</td></tr>';
};

window.openNoticeModal = function(noticeId = null) {
    if(noticeId) {
        const notice = dbNotices.find(n => n.id === noticeId);
        if (!notice) return;
        document.getElementById('noticeModalTitle').innerText = "✏️ 編輯特別事項"; document.getElementById('editNoticeId').value = noticeId;
        document.getElementById('noticeTextInput').value = notice.text;
        document.getElementById('noticeStartDate').value = notice.startDate; document.getElementById('noticeEndDate').value = notice.endDate;
        document.querySelectorAll('.notice-dept-chk').forEach(c => { c.checked = notice.departments.includes(c.value); });
    } else {
        document.getElementById('noticeModalTitle').innerText = "📢 發布通知"; document.getElementById('editNoticeId').value = "";
        document.getElementById('noticeTextInput').value = '';
        const today = window.getLocalDateStr(true); document.getElementById('noticeStartDate').value = today; document.getElementById('noticeEndDate').value = today;
    }
    document.getElementById('noticeModal').classList.add('active');
};
window.editNotice = function(id) { window.openNoticeModal(id); };
window.saveNotice = async function() {
    const text = document.getElementById('noticeTextInput').value.trim(), sDate = document.getElementById('noticeStartDate').value, eDate = document.getElementById('noticeEndDate').value;
    const editId = document.getElementById('editNoticeId').value; let targetDepts = [];
    document.querySelectorAll('.notice-dept-chk:checked').forEach(c => targetDepts.push(c.value));
    if (!text || !sDate || !eDate || targetDepts.length === 0) { alert("資料不完整！"); return; }
    try {
        if (editId) await updateDoc(doc(db, "notices", editId), { text: text, startDate: sDate, endDate: eDate, departments: targetDepts, updatedBy: currentUser.name, updatedAt: Date.now() });
        else await addDoc(collection(db, "notices"), { text: text, startDate: sDate, endDate: eDate, departments: targetDepts, createdBy: currentUser.name, createdAt: Date.now() });
        window.closeModal('noticeModal');
    } catch(e) { alert("儲存失敗。"); }
};
window.deleteNotice = async function(id) { 
    if(confirm("確定刪除嗎？")) { await window.logDeletion("特別事項", dbNotices.find(n => n.id === id) || {id}); await deleteDoc(doc(db, "notices", id)); }
};

window.updateAssistantBadge = function() {
    const badge = document.getElementById('assistantBadge'); if (!badge) return;
    const incompleteCount = dbAssistantRequests.filter(o => o.status !== '已完成').length;
    if (incompleteCount > 0) { badge.style.display = 'block'; badge.innerText = incompleteCount > 9 ? '9+' : incompleteCount; } else badge.style.display = 'none';
};

window.loadAssistantRequests = function() {
    const tbody = document.getElementById('assistantRequestsTableBody'); if (!tbody) return; tbody.innerHTML = '';
    if (dbAssistantRequests.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#999; padding:20px;">目前無需求。</td></tr>'; return; }
    dbAssistantRequests.sort((a, b) => b.refNumber.localeCompare(a.refNumber));
    dbAssistantRequests.forEach(order => {
        let safeDesc = order.description ? window.escapeHTML(order.description) : '無說明';
        if (order.status === '已完成' && order.completionRemark) safeDesc += `<div style="margin-top:8px; padding:6px; background:#e8f4fd; border-radius:4px; font-size:12px; color:#0056b3; border-left: 3px solid #0056b3;"><strong>結案備註：</strong><br>${window.escapeHTML(order.completionRemark)}</div>`;
        let statusBadge = `<span class="badge ${order.status === '已完成' ? 'badge-success' : (order.status === '跟進中' ? 'badge-info' : 'badge-warning')}">${order.status || '待處理'}</span>`;
        if (order.completer || order.assignee) statusBadge += `<br><span style="font-size:11px; color:var(--primary); font-weight:bold;">👤 ${window.escapeHTML(order.completer || order.assignee)}</span>`;
        const photoHtml = order.photo ? `<div style="margin-top:6px;"><img src="${order.photo}" onclick="window.openImageModal('${order.photo}')" style="max-height:80px; border-radius:4px; border:1px solid #ddd; object-fit:contain; cursor:pointer;"></div>` : '';
        let actionBtn = (!order.status || order.status === '待處理') ? `<button class="btn btn-primary" style="padding: 6px 10px; font-size:13px; margin-bottom: 4px; width: 100%;" onclick="window.takeAssistantRequest('${order.id}')">✋ 接收</button><br>` : (order.status === '跟進中' ? `<button class="btn btn-success" style="padding: 6px 10px; font-size:13px; margin-bottom: 4px; width: 100%;" onclick="window.prepareCompleteRequest('${order.id}')">✅ 完工</button><br>` : '');
        tbody.innerHTML += `<tr>
            <td><strong>${window.escapeHTML(order.refNumber)}</strong><br><span style="font-size:11px; color:#888;">${order.reporter}</span></td>
            <td style="color:var(--primary); font-weight:bold;">${window.escapeHTML(order.location)}</td><td><div>${safeDesc}</div>${photoHtml}</td>
            <td style="color:#666; font-size:13px;">${order.dispatchTime}</td><td>${statusBadge}</td>
            <td>${actionBtn}<button class="btn btn-danger" style="padding: 4px 8px; font-size:12px; width:100%;" onclick="window.deleteWorkOrder('${order.id}')">🗑️ 刪除</button></td></tr>`;
    });
};
window.takeAssistantRequest = async function(id) { try { await updateDoc(doc(db, "workOrders", id), { status: '跟進中', assignee: currentUser.name || currentUser.username, takeTime: new Date().toLocaleString() }); } catch(e) { alert("接單失敗。"); } };
window.prepareCompleteRequest = function(id) { document.getElementById('completingOrderId').value = id; document.getElementById('completionRemarkInput').value = ''; document.getElementById('completeActionModal').classList.add('active'); };
window.executeCompleteRequest = async function(withRemark) {
    const id = document.getElementById('completingOrderId').value, remark = document.getElementById('completionRemarkInput').value.trim();
    if (withRemark && !remark) { alert("請輸入備註！"); return; }
    try {
        let payload = { status: '已完成', completeTime: new Date().toLocaleString(), completer: currentUser.name || currentUser.username };
        if (withRemark) payload.completionRemark = remark;
        await updateDoc(doc(db, "workOrders", id), payload); window.closeModal('completeActionModal');
    } catch(e) { alert("結案失敗。"); }
};
window.deleteWorkOrder = async function(id) { 
    if(confirm("確定刪除嗎？")) { await window.logDeletion("工單", dbAssistantRequests.find(o => o.id === id) || {id}); await deleteDoc(doc(db, "workOrders", id)); } 
};

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
        const img = new Image(); img.onload = function() {
            const canvas = document.createElement('canvas'); const MAX_WIDTH = 800; let width = img.width, height = img.height;
            if (width > MAX_WIDTH) { height = Math.floor(height * (MAX_WIDTH / width)); width = MAX_WIDTH; }
            canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
            manualPhotoBase64 = canvas.toDataURL('image/jpeg', 0.6); 
            document.getElementById('manualIssuePreview').src = manualPhotoBase64; document.getElementById('manualIssuePreview').style.display = 'block';
        }; img.src = e.target.result;
    }; reader.readAsDataURL(file);
};
window.submitManualIssue = async function() {
    const dept = document.getElementById('manualIssueDept').value, loc = document.getElementById('manualIssueLocation').value.trim(), desc = document.getElementById('manualIssueText').value.trim();
    if (!loc) { alert("請填寫地點！"); return; } if (!desc && !manualPhotoBase64) { alert("請填寫需求！"); return; }
    try {
        const q = query(collection(db, "workOrders"), where("department", "==", dept));
        const refNumber = `${dept === '工程部' ? 'ENG' : (dept === '清潔部' ? 'CLN' : 'MGT')}-${window.getLocalDateStr(false)}-${String((await getDocs(q)).size + 1).padStart(3, '0')}`;
        await addDoc(collection(db, "workOrders"), { refNumber, department: dept, location: loc, description: desc, photo: manualPhotoBase64, reporter: currentUser.name + ' (手動發單)', dispatchTime: new Date().toLocaleString(), status: "待處理", dispatcherUsername: currentUser.username, dispatcherName: currentUser.name });
        alert(`✅ 發單成功！單號：${refNumber}`); window.closeModal('manualIssueModal');
    } catch(e) { alert("發單失敗。"); }
};

window.openIssuedWorkOrdersModal = async function() {
    document.getElementById('profileMenu').classList.remove('active');
    const tbody = document.getElementById('issuedWorkOrdersTableBody');
    document.getElementById('issuedWorkOrdersModal').classList.add('active');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#999; padding:20px;">載入中...</td></tr>';
    try {
        let orders = []; (await getDocs(collection(db, "workOrders"))).forEach(doc => { orders.push({ id: doc.id, ...doc.data() }); });
        orders = orders.filter(o => o.dispatcherUsername === currentUser.username).sort((a, b) => (b.refNumber || "").localeCompare(a.refNumber || ""));
        tbody.innerHTML = '';
        if (orders.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#999; padding:20px;">目前沒有紀錄。</td></tr>'; return; }
        orders.forEach(order => {
            let statusBadge = `<span class="badge ${order.status === '已完成' ? 'badge-success' : (order.status === '跟進中' ? 'badge-info' : 'badge-warning')}">${order.status || '待處理'}</span>`;
            if ((order.status === '跟進中' || order.status === '已完成') && (order.completer || order.assignee)) statusBadge += `<br><span style="font-size:11px; color:var(--primary); font-weight:bold;">👤 ${window.escapeHTML(order.completer || order.assignee)}</span>`;
            let safeDesc = window.escapeHTML(order.description || '無文字說明');
            if (order.status === '已完成' && order.completionRemark) safeDesc += `<div style="margin-top:8px; padding:6px; background:#e8f4fd; border-radius:4px; font-size:12px; color:#0056b3; border-left: 3px solid #0056b3;"><strong>結案備註：</strong><br>${window.escapeHTML(order.completionRemark)}</div>`;
            tbody.innerHTML += `<tr><td style="padding:10px;"><strong>${window.escapeHTML(order.refNumber)}</strong><br><span style="font-size:11px; color:#888;">${window.escapeHTML(order.department)}</span></td>
                <td style="padding:10px; color:var(--primary); font-weight:bold;">${window.escapeHTML(order.location)}<br><span style="font-size:11px; color:#6f42c1; font-weight:bold;">發單: ${window.escapeHTML(order.dispatcherName || order.reporter || '未知')}</span></td>
                <td style="padding:10px; font-size:12px;">${safeDesc}</td><td style="padding:10px; font-size:12px; color:#666;">${window.escapeHTML(order.dispatchTime)}</td><td style="padding:10px; text-align:center;">${statusBadge}</td></tr>`;
        });
    } catch (error) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--danger); padding:20px;">讀取失敗。</td></tr>'; }
};

window.openImageModal = function(base64Src) { if (!base64Src) return; document.getElementById('enlargedImage').src = base64Src; document.getElementById('imageViewerModal').style.display = 'flex'; };
window.closeImageModal = function() { document.getElementById('imageViewerModal').style.display = 'none'; document.getElementById('enlargedImage').src = ''; };

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
    else if (range === 'week') { const day = now.getDay() || 7; start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1); end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 7); } 
    else if (range === 'month') { start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth() + 1, 0); } 
    else if (range === 'year') { start = new Date(now.getFullYear(), 0, 1); end = new Date(now.getFullYear(), 11, 31); }
    const format = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if(document.getElementById('taskFilterStartDate')) document.getElementById('taskFilterStartDate').value = format(start);
    if(document.getElementById('taskFilterEndDate')) document.getElementById('taskFilterEndDate').value = format(end);
    window.applyTaskFilters();
};
window.toggleAllTasks = function(source) { document.querySelectorAll('.task-checkbox').forEach(chk => chk.checked = source.checked); };

window.loadDashboardData = function() {
    const tbody = document.getElementById('taskTableBody'); if (!tbody) return; tbody.innerHTML = '';
    const kw = document.getElementById('taskFilterKeyword') ? document.getElementById('taskFilterKeyword').value.toLowerCase().trim() : '';
    const sRaw = document.getElementById('taskFilterStartDate') ? document.getElementById('taskFilterStartDate').value : '';
    const eRaw = document.getElementById('taskFilterEndDate') ? document.getElementById('taskFilterEndDate').value : '';
    const statusF = document.getElementById('taskFilterStatus') ? document.getElementById('taskFilterStatus').value : 'all';
    const sDate = sRaw ? sRaw.replace(/-/g, '') : '00000000', eDate = eRaw ? eRaw.replace(/-/g, '') : '99999999';

    let filtered = dbTasks.filter(t => {
        if (statusF !== 'all' && ((statusF === 'completed' && t.status !== 'completed') || (statusF === 'incomplete' && t.status === 'completed'))) return false;
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
    filtered.forEach(t => { if (t.status === 'completed') cc++; else oc++; ts += (t.skippedPoints || []).length; ti += (t.incidents || []).length; });
    if(document.getElementById('statTotal')) document.getElementById('statTotal').innerText = filtered.length; 
    if(document.getElementById('statCompleted')) document.getElementById('statCompleted').innerText = cc;
    if(document.getElementById('statSkipped')) document.getElementById('statSkipped').innerText = ts;
    if(document.getElementById('statIncidents')) document.getElementById('statIncidents').innerText = ti;

    if (filtered.length === 0) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#999; padding:20px;">無紀錄。</td></tr>'; return; }

    filtered.forEach(t => {
        const sc = [...new Set(t.skippedPoints || [])].length, ic = (t.incidents || []).length;
        let ab = (sc > 0 ? `<span class="badge badge-danger">⚠️ ${sc}</span> ` : '') + (ic > 0 ? `<span class="badge badge-info">📢 ${ic}</span>` : '');
        if (!ab) ab = '<span class="badge badge-success">正常</span>';
        const sb = t.status === 'completed' ? `<span class="badge badge-success">已完成</span>` : `<span class="badge badge-warning">執行中</span>`;
        let startStr = '<span style="color:#999;">未開始</span>';
        if (t.pointLogs && t.pointLogs.length > 0) {
            const d = new Date(t.pointLogs[0].timestamp); startStr = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        } else if (t.startTime) {
            const d = new Date(t.startTime); startStr = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} (建)`;
        }
        tbody.innerHTML += `<tr><td style="text-align: center;"><input type="checkbox" class="task-checkbox" value="${t.id}" style="transform:scale(1.3); cursor:pointer;"></td>
            <td><strong>${window.escapeHTML(t.routeName)}</strong></td><td>${window.escapeHTML(t.guardName || '未登記')}</td>
            <td style="font-family:monospace; color:#555;">${startStr}</td><td>${Math.min(t.currentPointIndex || 0, (t.points || []).length)} / ${(t.points || []).length}</td>
            <td>${ab}</td><td>${sb}</td><td style="white-space: nowrap;"><button class="btn btn-primary" style="padding: 4px 10px; font-size: 12px; margin:0;" onclick="window.viewTaskDetail('${t.id}')">🔍</button>
            <button class="btn btn-danger" style="padding: 4px 10px; font-size: 12px; margin:0; margin-left: 4px;" onclick="window.deleteTask('${t.id}')">🗑️</button></td></tr>`;
    });
};

window.deleteTask = async function(id) {
    if(confirm("確定刪除嗎？")) { try { await window.logDeletion("巡邏紀錄", dbTasks.find(t=>t.id===id)||{id}); await deleteDoc(doc(db, "tasks", id)); } catch(e){ alert("刪除失敗"); } }
};

window.buildTaskReportHtml = function(task) {
    const routeDef = dbRoutes.find(r => r.name === task.routeName), logs = task.pointLogs || [], incidents = task.incidents || [];
    let startH = '未開始', totalH = '未開始', endH = '未完成';
    if (task.status === 'completed') endH = task.endTime || (logs.length > 0 ? new Date(logs[logs.length - 1].timestamp).toLocaleString() : '未知');
    if (logs.length > 0) {
        startH = new Date(logs[0].timestamp).toLocaleString();
        const ts = Math.floor((logs[logs.length - 1].timestamp - logs[0].timestamp) / 1000);
        totalH = `<strong style="color:var(--primary); font-size: 18px;">${Math.floor(ts / 60)} 分 ${ts % 60} 秒</strong>`;
    }
    let html = `<div style="background:#f8f9fa; padding:15px; border-radius:8px; margin-bottom:15px; border: 1px solid #eee; display:flex; justify-content:space-between;">
        <div><p style="margin:0 0 8px 0; font-size:14px;"><strong>巡邏人員：</strong> ${window.escapeHTML(task.guardName || '未登記')}</p><p style="margin:0 0 8px 0; font-size:14px; color:#666;"><strong>建立：</strong> ${task.startTime}</p>
        <p style="margin:0 0 8px 0; font-size:14px; color:var(--primary);"><strong>開始：</strong> ${startH}</p><p style="margin:0; font-size:14px;"><strong>完成：</strong> ${endH}</p></div>
        <div style="text-align:right;"><p style="margin:0 0 8px 0; font-size:14px;"><strong>總耗時：</strong></p>${totalH}</div></div>
        <div style="border: 1px solid #eee; border-radius: 8px; margin-bottom: 20px;"><table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
        <thead style="background: #f0f2f5;"><tr><th style="padding:10px; border-bottom:1px solid #ddd;">巡邏點</th><th style="padding:10px; border-bottom:1px solid #ddd;">狀態</th><th style="padding:10px; border-bottom:1px solid #ddd;">時間</th><th style="padding:10px; border-bottom:1px solid #ddd;">耗時</th><th style="padding:10px; border-bottom:1px solid #ddd; width:20%;">備註</th></tr></thead><tbody>`;

    let prevT = null;
    (task.points || []).forEach((pt, idx) => {
        const log = logs.find(l => l.pointName === pt), inc = incidents.find(i => i.pointName === pt);
        let sb = `<span style="color:#888;">⏳ 未巡</span>`, ts = '-', gs = '-', ext = '';
        let maxInt = 0;
        if (routeDef) { let pi = (routeDef.pointIntervals && routeDef.pointIntervals[idx]) ? routeDef.pointIntervals[idx] : 0; maxInt = (pi > 0 ? pi : (routeDef.globalInterval || 0)) * 60; }
        if (log) {
            ts = log.timeStr;
            if (prevT === null) gs = `<span style="color:#28a745; font-weight:bold;">📍 起始</span>`;
            else {
                const sec = Math.floor((log.timestamp - prevT) / 1000), m = Math.floor(sec / 60), s = sec % 60;
                if (maxInt > 0 && sec > maxInt) { ext = `超時 ${Math.floor((sec-maxInt)/60)}分${(sec-maxInt)%60}秒`; gs = `<span style="color:var(--danger); font-weight:bold;">${m}分${s}秒 ❗️</span>`; } 
                else gs = m > 0 ? `<span style="color:#1a73e8; font-weight:bold;">${m}分${s}秒</span>` : `${s}秒`;
            }
            prevT = log.timestamp;
            sb = log.isSkipped ? `<span style="color:var(--danger); font-weight:bold;">⚠️ 跳過</span>` : `<span style="color:var(--success); font-weight:bold;">✅ 正常</span>`;
        } else if (task.skippedPoints && task.skippedPoints.includes(pt)) { sb = `<span style="color:var(--danger); font-weight:bold;">⚠️ 跳過</span>`; } 
        else if (idx < task.currentPointIndex) { sb = `<span style="color:var(--success); font-weight:bold;">✅ 正常</span>`; }
        let incHtml = inc ? `<div style="margin-top: 5px; padding: 5px; background: #e0f7fa; border-radius: 4px; font-size: 11px; color: #006064;"><strong>📢 報事：</strong>${window.escapeHTML(inc.text || '已上傳照片')}</div>` : '';
        html += `<tr class="avoid-break"><td style="padding:10px;"><strong>${window.escapeHTML(pt)}</strong>${incHtml}</td><td style="padding:10px;">${sb}</td><td style="padding:10px; font-family:monospace; color:#555;">${ts}</td><td style="padding:10px; color:#666;">${gs}</td><td style="padding:10px;">${ext ? `<div style="color:var(--danger); font-size: 12px; font-weight:bold; margin-bottom: 2px;">${ext}</div><div style="border-bottom: 1px dashed #999; height: 10px; width: 100%;"></div>` : `<div style="border-bottom: 1px dashed #999; height: 20px; width: 100%;"></div>`}</td></tr>`;
    });
    html += '</tbody></table></div>';

    if (incidents.length > 0) {
        html += `<h4 style="margin-top:20px; color:var(--danger); border-bottom:1px solid #eee; padding-bottom:8px;">🚨 異常報事紀錄 (${incidents.length} 筆)</h4>`;
        incidents.forEach((inc, index) => {
            html += `<div class="avoid-break" style="border:1px solid #f5c6cb; background:#fdfdfe; padding:15px; border-radius:6px; margin-bottom:15px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;"><p style="margin:0 0 8px 0; font-size:14px;"><strong>📍 地點：</strong>${window.escapeHTML(inc.pointName)}</p><span style="color:#888; font-size:12px;">⏰ ${inc.timeStr}</span></div>
                <div style="margin:0 0 12px 0; font-size:14px; background:#f8f9fa; padding:10px; border-radius:4px; border:1px solid #eee;"><strong>📝 說明：</strong><br><span style="color:#333; line-height:1.5;">${window.escapeHTML(inc.text||'無')}</span></div>
                ${inc.photo ? `<div style="text-align:center; margin-bottom:10px;"><img src="${inc.photo}" onclick="window.openImageModal('${inc.photo}')" style="max-height:200px; border-radius:6px; cursor:pointer; border:1px solid #ddd;"></div>` : ''}
                <button class="btn btn-info pdf-hide-btn" style="width:100%; padding:8px; margin-top:5px;" onclick="window.openDispatchModal('${task.id}', ${index})">📤 轉派</button></div>`;
        });
    }
    return html;
};

window.customCoverPdfDoc = null; window.finalCoverPdfBytes = null; 
window.triggerPdfSelect = function() { if(document.getElementById('hiddenPdfInput')) document.getElementById('hiddenPdfInput').click(); };
window.handleCoverPdfSelect = async function(event) {
    const files = event.target.files; if (!files || files.length === 0) return;
    try {
        const { PDFDocument } = PDFLib; window.customCoverPdfDoc = await PDFDocument.create();
        for (let file of files) {
            const fileBytes = await file.arrayBuffer(); const pdfDoc = await PDFDocument.load(fileBytes);
            const copiedPages = await window.customCoverPdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
            copiedPages.forEach(page => window.customCoverPdfDoc.addPage(page));
        }
        if(document.getElementById('pdfEditorModal')) document.getElementById('pdfEditorModal').classList.add('active');
        await window.renderPdfThumbnails();
    } catch(e) { alert("讀取 PDF 失敗：" + e.message); }
    event.target.value = '';
};

window.renderPdfThumbnails = async function() {
    const container = document.getElementById('pdfThumbnailsContainer'); if(!container) return;
    container.innerHTML = '<div style="padding: 20px; text-align: center; width: 100%; font-weight:bold; color:var(--primary);">⏳ 正在產生預覽縮圖...</div>';
    try {
        const pdfBytes = await window.customCoverPdfDoc.save();
        const loadingTask = pdfjsLib.getDocument({data: pdfBytes}); const pdf = await loadingTask.promise;
        container.innerHTML = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i); const viewport = page.getViewport({scale: 0.4});
            const wrapper = document.createElement('div'); wrapper.style = "text-align: center; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); min-width: 160px; display: flex; flex-direction: column; justify-content: space-between;";
            const canvas = document.createElement('canvas'); const context = canvas.getContext('2d');
            canvas.height = viewport.height; canvas.width = viewport.width; canvas.style = "border: 1px solid #ddd; max-height: 200px; width: auto; object-fit: contain; border-radius: 4px; margin: auto;";
            await page.render({canvasContext: context, viewport: viewport}).promise;
            wrapper.innerHTML = `<div style="font-size: 13px; margin-bottom: 8px; color: #666; font-weight: bold;">第 ${i} 頁</div>`;
            wrapper.appendChild(canvas);
            const controls = document.createElement('div'); controls.style = "display: flex; justify-content: center; gap: 5px; margin-top: 10px;";
            controls.innerHTML = `<button type="button" class="btn btn-warning" style="padding: 6px; font-size: 12px; margin: 0; flex:1;" onclick="window.rotatePdfPage(${i-1})">⟳</button><button type="button" class="btn btn-danger" style="padding: 6px; font-size: 12px; margin: 0; flex:1;" onclick="window.deletePdfPage(${i-1})">🗑️</button>`;
            wrapper.appendChild(controls); container.appendChild(wrapper);
        }
    } catch (e) { container.innerHTML = '<div style="color:red; padding: 20px;">預覽縮圖生成失敗，但仍可直接匯出。</div>'; }
};

window.rotatePdfPage = async function(pageIndex) { const page = window.customCoverPdfDoc.getPage(pageIndex); page.setRotation(PDFLib.degrees(page.getRotation().angle + 90)); await window.renderPdfThumbnails(); };
window.deletePdfPage = async function(pageIndex) {
    if(window.customCoverPdfDoc.getPageCount() <= 1) { alert("⚠️ 最後一頁無法刪除！"); return; }
    if(confirm('確定刪除嗎？')) { window.customCoverPdfDoc.removePage(pageIndex); await window.renderPdfThumbnails(); }
};
window.saveEditedPdf = async function() {
    window.finalCoverPdfBytes = await window.customCoverPdfDoc.save();
    window.closeModal('pdfEditorModal');
    document.querySelectorAll('.pdf-status-text').forEach(el => { el.innerText = `✅ (${window.customCoverPdfDoc.getPageCount()}頁)`; el.style.color = "var(--success)"; });
    document.querySelectorAll('.btn-clear-pdf').forEach(el => el.style.display = "inline-block");
};
window.clearCoverPdf = function() {
    window.finalCoverPdfBytes = null; window.customCoverPdfDoc = null;
    document.querySelectorAll('.pdf-status-text').forEach(el => { el.innerText = `未選擇`; el.style.color = "#666"; });
    document.querySelectorAll('.btn-clear-pdf').forEach(el => el.style.display = "none");
};

window.viewTaskDetail = function(taskId) {
    const task = dbTasks.find(t => t.id === taskId); if (!task) return;
    document.getElementById('taskDetailTitle').innerText = `📋 任務報表：${task.routeName}`;
    document.getElementById('taskDetailContent').innerHTML = window.buildTaskReportHtml(task);
    document.getElementById('taskDetailModal').classList.add('active');
};

window.exportTaskToPDF = async function() {
    const exportArea = document.getElementById('taskExportArea'), rawTitle = document.getElementById('taskDetailTitle').innerText.replace(/[\/\\?%*:|"<>]/g, '-');
    const origScrollY = window.scrollY; window.scrollTo(0, 0);
    exportArea.querySelectorAll('.pdf-hide-btn').forEach(btn => btn.style.display = 'none');
    try {
        const pdfWorker = html2pdf().set({ margin: [10, 10, 15, 10], image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.avoid-break'] } }).from(exportArea);
        const reportBlob = await pdfWorker.output('blob'); const reportBytes = await reportBlob.arrayBuffer();
        if (window.finalCoverPdfBytes) {
            const { PDFDocument } = PDFLib; const mergedPdf = await PDFDocument.create();
            const coverDoc = await PDFDocument.load(window.finalCoverPdfBytes);
            (await mergedPdf.copyPages(coverDoc, coverDoc.getPageIndices())).forEach(page => mergedPdf.addPage(page));
            const reportDoc = await PDFDocument.load(reportBytes);
            (await mergedPdf.copyPages(reportDoc, reportDoc.getPageIndices())).forEach(page => mergedPdf.addPage(page));
            const blob = new Blob([await mergedPdf.save()], { type: 'application/pdf' });
            const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${rawTitle}_含封面.pdf`; link.click();
        } else {
            const link = document.createElement('a'); link.href = URL.createObjectURL(reportBlob); link.download = `${rawTitle}.pdf`; link.click();
        }
    } catch (e) { alert("匯出發生錯誤。"); } finally {
        exportArea.querySelectorAll('.pdf-hide-btn').forEach(btn => btn.style.display = 'block'); window.scrollTo(0, origScrollY);
    }
};

window.batchExportTasks = async function() {
    const checkboxes = document.querySelectorAll('.task-checkbox:checked');
    if (checkboxes.length === 0) { alert("請先勾選匯出項目！"); return; }
    const btn = document.getElementById('batchExportBtn'); btn.innerText = "⏳ 產生中..."; btn.disabled = true;
    
    const loadingOverlay = document.createElement('div');
    loadingOverlay.style.position = 'fixed'; loadingOverlay.style.top = '0'; loadingOverlay.style.left = '0'; loadingOverlay.style.width = '100vw'; loadingOverlay.style.height = '100vh'; loadingOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)'; loadingOverlay.style.color = 'white'; loadingOverlay.style.display = 'flex'; loadingOverlay.style.flexDirection = 'column'; loadingOverlay.style.justifyContent = 'center'; loadingOverlay.style.alignItems = 'center'; loadingOverlay.style.zIndex = '999999'; 
    loadingOverlay.innerHTML = `<div style="font-size: 50px; margin-bottom: 20px;">📄</div><h2 style="margin: 0 0 10px 0;">批次報表合併產生中</h2><p style="color: #ccc; font-size: 14px;">系統正在逐一擷取真實報表，請勿切換視窗或捲動畫面...</p><p id="batchProgressText" style="color: var(--primary); font-size: 18px; font-weight: bold; margin-top: 15px;">進度: 0 / ${checkboxes.length}</p>`;
    document.body.appendChild(loadingOverlay);

    const origScrollY = window.scrollY; window.scrollTo(0, 0);

    try {
        const { PDFDocument } = PDFLib; const megaPdf = await PDFDocument.create();
        if (window.finalCoverPdfBytes) {
            const coverDoc = await PDFDocument.load(window.finalCoverPdfBytes);
            (await megaPdf.copyPages(coverDoc, coverDoc.getPageIndices())).forEach(page => megaPdf.addPage(page));
        }

        const exportModal = document.getElementById('taskDetailModal');
        const exportArea = document.getElementById('taskExportArea');
        const detailContent = document.getElementById('taskDetailContent');
        exportModal.classList.add('active'); exportModal.style.zIndex = '999998'; 

        let currentIndex = 0;
        for (let chk of checkboxes) {
            currentIndex++; document.getElementById('batchProgressText').innerText = `處理進度: ${currentIndex} / ${checkboxes.length}`;
            const task = dbTasks.find(t => t.id === chk.value); if (!task) continue;

            document.getElementById('taskDetailTitle').innerText = `📋 任務報表：${task.routeName}`;
            detailContent.innerHTML = window.buildTaskReportHtml(task);
            exportArea.querySelectorAll('.pdf-hide-btn').forEach(b => b.style.display = 'none');

            await new Promise(resolve => setTimeout(resolve, 500));

            const pdfWorker = html2pdf().set({ margin: [10, 10, 15, 10], html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.avoid-break', 'h2', 'h4'] } }).from(exportArea);
            const reportBlob = await pdfWorker.output('blob'); const reportBytes = await reportBlob.arrayBuffer();
            
            const reportDoc = await PDFDocument.load(reportBytes);
            (await megaPdf.copyPages(reportDoc, reportDoc.getPageIndices())).forEach(p => megaPdf.addPage(p));
        }

        exportModal.classList.remove('active'); exportModal.style.zIndex = ''; 
        const blob = new Blob([await megaPdf.save()], { type: 'application/pdf' });
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `批次巡邏報表合併檔_${window.getLocalDateStr(false)}.pdf`; link.click();
        
    } catch (err) { alert("合併匯出失敗"); } finally {
        window.scrollTo(0, origScrollY); if(document.body.contains(loadingOverlay)) document.body.removeChild(loadingOverlay);
        document.getElementById('taskDetailModal').classList.remove('active');
        btn.innerText = "📥 批次合併匯出"; btn.disabled = false;
        if(document.getElementById('selectAllTasks')) document.getElementById('selectAllTasks').checked = false;
        document.querySelectorAll('.task-checkbox').forEach(c => c.checked = false);
    }
};
