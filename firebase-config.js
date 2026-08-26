// 引入 Firebase 核心套件
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// 1. 共用的 Firebase 設定
const firebaseConfig = {
    apiKey: "AIzaSyBq4EKFQ3gjq1kpOWMH5MXosF7O9ENOrjw",
    authDomain: "test-ue-app.firebaseapp.com",
    projectId: "test-ue-app",
    storageBucket: "test-ue-app.firebasestorage.app",
    messagingSenderId: "203707145209",
    appId: "1:203707145209:web:647068d7d0e4b843b47b28"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 2. 共用的工具函數：防 XSS 攻擊字串轉換
const escapeHTML = function(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, function(tag) {
        const charsToReplace = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
        return charsToReplace[tag] || tag;
    });
};

// 3. 共用的工具函數：取得本地時間
const getLocalDateStr = function(withDash = false) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return withDash ? `${y}-${m}-${day}` : `${y}${m}${day}`;
};

// 🌟 將這些變數與函數「匯出」，讓其他 HTML 檔案可以使用
export { app, db, auth, escapeHTML, getLocalDateStr };
