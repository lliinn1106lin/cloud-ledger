// app.js — 雲端個人記帳本核心邏輯（含右側滑出式側邊欄與偏好設定）
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

import { auth, db, googleProvider, isFirebaseConfigured } from "./firebase-config.js";

// ==================== 分類與配色常數 ====================
const CATEGORIES = {
  expense: ["餐飲", "交通", "娛樂", "購物", "居住", "醫療", "教育", "其他支出"],
  income: ["薪資", "獎金", "投資", "零用錢", "兼職", "其他收入"]
};

const CATEGORY_COLORS = [
  "#6366f1",
  "#f43f5e",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#8b5cf6",
  "#ec4899",
  "#64748b"
];

const DEFAULT_SETTINGS = {
  darkMode: false,
  currency: "NT$",
  monthlyBudget: 0,
  defaultType: "expense"
};

// ==================== 應用程式狀態 ====================
let currentUser = null;
let allTransactions = [];
let unsubscribeSnapshot = null;
let chartInstance = null;
let currentChartType = "expense";
let pendingDeleteId = null;
let userSettings = { ...DEFAULT_SETTINGS };

// ==================== DOM 元素參照 ====================
const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const configWarning = document.getElementById("config-warning");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");

const userAvatar = document.getElementById("user-avatar");
const userName = document.getElementById("user-name");
const userEmail = document.getElementById("user-email");

const monthPicker = document.getElementById("month-picker");
const prevMonthBtn = document.getElementById("prev-month-btn");
const nextMonthBtn = document.getElementById("next-month-btn");
const exportCsvBtn = document.getElementById("export-csv-btn");
const openAddModalBtn = document.getElementById("open-add-modal-btn");

const totalIncomeEl = document.getElementById("total-income");
const totalExpenseEl = document.getElementById("total-expense");
const netBalanceEl = document.getElementById("net-balance");

const budgetCard = document.getElementById("budget-card");
const budgetText = document.getElementById("budget-text");
const budgetBar = document.getElementById("budget-bar");

const chartTabExpense = document.getElementById("chart-tab-expense");
const chartTabIncome = document.getElementById("chart-tab-income");
const chartCanvas = document.getElementById("category-chart");
const chartEmpty = document.getElementById("chart-empty");

const filterTypeEl = document.getElementById("filter-type");
const searchInputEl = document.getElementById("search-input");
const recordCountEl = document.getElementById("record-count");
const transactionListEl = document.getElementById("transaction-list");
const listEmptyEl = document.getElementById("list-empty");

// 右側滑出式側邊欄 (Drawer)
const openDrawerBtn = document.getElementById("open-drawer-btn");
const closeDrawerBtn = document.getElementById("close-drawer-btn");
const drawerBackdrop = document.getElementById("drawer-backdrop");
const drawerPanel = document.getElementById("drawer-panel");
const drawerAvatar = document.getElementById("drawer-avatar");
const drawerName = document.getElementById("drawer-name");
const drawerEmail = document.getElementById("drawer-email");
const drawerUid = document.getElementById("drawer-uid");
const copyUidBtn = document.getElementById("copy-uid-btn");
const drawerAddBtn = document.getElementById("drawer-add-btn");
const drawerJumpTodayBtn = document.getElementById("drawer-jump-today-btn");
const drawerExportMonthBtn = document.getElementById("drawer-export-month-btn");
const drawerExportAllBtn = document.getElementById("drawer-export-all-btn");
const drawerTotalCount = document.getElementById("drawer-total-count");
const drawerSwitchAccountBtn = document.getElementById("drawer-switch-account-btn");

// 側邊欄設定控制項
const settingDarkMode = document.getElementById("setting-dark-mode");
const settingCurrency = document.getElementById("setting-currency");
const settingBudget = document.getElementById("setting-budget");
const saveBudgetBtn = document.getElementById("save-budget-btn");
const settingDefaultType = document.getElementById("setting-default-type");

// 新增/編輯 Modal
const txModal = document.getElementById("tx-modal");
const modalTitle = document.getElementById("modal-title");
const closeModalBtn = document.getElementById("close-modal-btn");
const cancelModalBtn = document.getElementById("cancel-modal-btn");
const txForm = document.getElementById("tx-form");
const txIdInput = document.getElementById("tx-id");
const txTypeInput = document.getElementById("tx-type");
const typeBtnExpense = document.getElementById("type-btn-expense");
const typeBtnIncome = document.getElementById("type-btn-income");
const txDateInput = document.getElementById("tx-date");
const txAmountInput = document.getElementById("tx-amount");
const txCategorySelect = document.getElementById("tx-category");
const txNoteInput = document.getElementById("tx-note");
const saveTxBtn = document.getElementById("save-tx-btn");

// 刪除確認 Modal
const deleteModal = document.getElementById("delete-modal");
const deletePreview = document.getElementById("delete-preview");
const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");

const toastEl = document.getElementById("toast");

// ==================== 初始化 ====================
function init() {
  monthPicker.value = getTodayMonth();
  loadSettings("guest");

  if (!isFirebaseConfigured()) {
    configWarning.classList.remove("hidden");
  }

  bindEvents();
  listenToAuthState();
}

function getTodayDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getTodayMonth() {
  return getTodayDate().slice(0, 7);
}

// ==================== 事件綁定 ====================
function bindEvents() {
  loginBtn.addEventListener("click", handleGoogleLogin);
  logoutBtn.addEventListener("click", handleLogout);

  monthPicker.addEventListener("change", renderDashboard);
  prevMonthBtn.addEventListener("click", () => shiftMonth(-1));
  nextMonthBtn.addEventListener("click", () => shiftMonth(1));

  exportCsvBtn.addEventListener("click", () => handleExportCSV(false));
  openAddModalBtn.addEventListener("click", () => openTxModal());

  chartTabExpense.addEventListener("click", () => switchChartType("expense"));
  chartTabIncome.addEventListener("click", () => switchChartType("income"));

  filterTypeEl.addEventListener("change", renderTransactionList);
  searchInputEl.addEventListener("input", renderTransactionList);

  // 右側邊欄開關
  openDrawerBtn.addEventListener("click", openDrawer);
  closeDrawerBtn.addEventListener("click", closeDrawer);
  drawerBackdrop.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  // 側邊欄快速功能
  copyUidBtn.addEventListener("click", handleCopyUid);
  drawerAddBtn.addEventListener("click", () => {
    closeDrawer();
    openTxModal();
  });
  drawerJumpTodayBtn.addEventListener("click", () => {
    monthPicker.value = getTodayMonth();
    renderDashboard();
    closeDrawer();
    showToast("已切換回本月帳本", "info");
  });
  drawerExportMonthBtn.addEventListener("click", () => {
    closeDrawer();
    handleExportCSV(false);
  });
  drawerExportAllBtn.addEventListener("click", () => {
    closeDrawer();
    handleExportCSV(true);
  });
  drawerSwitchAccountBtn.addEventListener("click", async () => {
    closeDrawer();
    await handleGoogleLogin();
  });

  // 側邊欄設定控制
  settingDarkMode.addEventListener("change", () => {
    userSettings.darkMode = settingDarkMode.checked;
    applyDarkMode(userSettings.darkMode);
    saveSettings();
    renderChart(getMonthTransactions());
  });

  settingCurrency.addEventListener("change", () => {
    userSettings.currency = settingCurrency.value;
    saveSettings();
    renderDashboard();
    showToast(`已切換幣別為 ${userSettings.currency}`, "success");
  });

  saveBudgetBtn.addEventListener("click", () => {
    const val = Math.max(0, Number(settingBudget.value) || 0);
    userSettings.monthlyBudget = val;
    saveSettings();
    renderDashboard();
    showToast(val > 0 ? `已設定每月預算 ${formatCurrency(val)}` : "已關閉預算進度條", "success");
  });

  settingDefaultType.addEventListener("change", () => {
    userSettings.defaultType = settingDefaultType.value;
    saveSettings();
    showToast("已更新預設記帳類型", "success");
  });

  // Modal 相關
  closeModalBtn.addEventListener("click", closeTxModal);
  cancelModalBtn.addEventListener("click", closeTxModal);
  typeBtnExpense.addEventListener("click", () => setModalType("expense"));
  typeBtnIncome.addEventListener("click", () => setModalType("income"));
  txForm.addEventListener("submit", handleSaveTransaction);

  // 刪除確認 Modal
  cancelDeleteBtn.addEventListener("click", closeDeleteModal);
  confirmDeleteBtn.addEventListener("click", handleConfirmDelete);
}

// ==================== 右側邊欄開關動畫 ====================
function openDrawer() {
  drawerBackdrop.classList.remove("hidden");
  requestAnimationFrame(() => {
    drawerBackdrop.classList.remove("opacity-0");
    drawerPanel.classList.remove("translate-x-full");
  });
}

function closeDrawer() {
  drawerPanel.classList.add("translate-x-full");
  drawerBackdrop.classList.add("opacity-0");
  setTimeout(() => {
    drawerBackdrop.classList.add("hidden");
  }, 300);
}

async function handleCopyUid() {
  if (!currentUser) return;
  try {
    await navigator.clipboard.writeText(currentUser.uid);
    showToast("已複製你的使用者 UID", "success");
  } catch {
    showToast("無法自動複製，請手動選取", "info");
  }
}

// ==================== 偏好設定儲存 (依 UID 隔離) ====================
function getSettingsKey(uid) {
  return `cloud_ledger_settings_${uid || (currentUser ? currentUser.uid : "guest")}`;
}

function loadSettings(uid) {
  try {
    const raw = localStorage.getItem(getSettingsKey(uid));
    userSettings = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    userSettings = { ...DEFAULT_SETTINGS };
  }

  settingDarkMode.checked = Boolean(userSettings.darkMode);
  settingCurrency.value = userSettings.currency || "NT$";
  settingBudget.value = userSettings.monthlyBudget || "";
  settingDefaultType.value = userSettings.defaultType || "expense";
  applyDarkMode(userSettings.darkMode);
}

function saveSettings() {
  try {
    localStorage.setItem(getSettingsKey(), JSON.stringify(userSettings));
  } catch (err) {
    console.warn("無法儲存設定到 localStorage:", err);
  }
}

function applyDarkMode(enabled) {
  document.documentElement.classList.toggle("dark", Boolean(enabled));
}

// ==================== Firebase 登入與帳號隔離 ====================
async function handleGoogleLogin() {
  if (!isFirebaseConfigured()) {
    showToast("請先在 firebase-config.js 填入 Firebase 金鑰", "error");
    return;
  }
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    console.error("Google 登入失敗:", err);
    if (err.code === "auth/popup-closed-by-user") {
      showToast("已取消登入", "info");
    } else if (err.code === "auth/unauthorized-domain") {
      showToast("此網域尚未加入 Firebase 已授權網域，請檢查設定", "error");
    } else {
      showToast(`登入失敗：${err.message}`, "error");
    }
  }
}

async function handleLogout() {
  closeDrawer();
  try {
    await signOut(auth);
    showToast("已登出帳號", "info");
  } catch (err) {
    console.error("登出失敗:", err);
    showToast("登出時發生錯誤", "error");
  }
}

function listenToAuthState() {
  onAuthStateChanged(auth, (user) => {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }

    if (user) {
      currentUser = user;
      loadSettings(user.uid);

      authSection.classList.add("hidden");
      appSection.classList.remove("hidden");

      const displayName = user.displayName || "使用者";
      const email = user.email || "";
      const avatarUrl =
        user.photoURL ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff`;

      userName.textContent = displayName;
      userEmail.textContent = email;
      userAvatar.src = avatarUrl;

      drawerName.textContent = displayName;
      drawerEmail.textContent = email;
      drawerAvatar.src = avatarUrl;
      drawerUid.textContent = user.uid;

      subscribeUserTransactions(user.uid);
    } else {
      currentUser = null;
      allTransactions = [];
      authSection.classList.remove("hidden");
      appSection.classList.add("hidden");
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
    }
  });
}

function subscribeUserTransactions(uid) {
  const txRef = collection(db, "users", uid, "transactions");
  const q = query(txRef, orderBy("date", "desc"));

  unsubscribeSnapshot = onSnapshot(
    q,
    (snapshot) => {
      allTransactions = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      drawerTotalCount.textContent = `${allTransactions.length} 筆`;
      renderDashboard();
    },
    (error) => {
      console.error("讀取 Firestore 資料失敗:", error);
      showToast("無法讀取記帳資料，請檢查 Firestore 安全規則", "error");
    }
  );
}

// ==================== 儀表板渲染 ====================
function getMonthTransactions() {
  const selectedMonth = monthPicker.value || getTodayMonth();
  return allTransactions.filter((tx) => (tx.date || "").startsWith(selectedMonth));
}

function renderDashboard() {
  const monthTxs = getMonthTransactions();

  let income = 0;
  let expense = 0;
  for (const tx of monthTxs) {
    const amt = Number(tx.amount) || 0;
    if (tx.type === "income") income += amt;
    else expense += amt;
  }
  const balance = income - expense;

  totalIncomeEl.textContent = formatCurrency(income);
  totalExpenseEl.textContent = formatCurrency(expense);
  netBalanceEl.textContent = formatCurrency(balance);
  netBalanceEl.className = `mt-2 text-2xl font-bold ${
    balance >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-rose-600 dark:text-rose-400"
  }`;

  // 更新每月預算進度條
  const budget = Number(userSettings.monthlyBudget) || 0;
  if (budget > 0) {
    budgetCard.classList.remove("hidden");
    const pct = Math.min(100, Math.round((expense / budget) * 100));
    budgetText.textContent = `${formatCurrency(expense)} / ${formatCurrency(budget)} (${Math.round((expense / budget) * 100)}%)`;
    budgetBar.style.width = `${pct}%`;
    if (expense > budget) {
      budgetBar.className = "h-full rounded-full bg-rose-500 transition-all duration-300";
    } else if (expense >= budget * 0.8) {
      budgetBar.className = "h-full rounded-full bg-amber-500 transition-all duration-300";
    } else {
      budgetBar.className = "h-full rounded-full bg-emerald-500 transition-all duration-300";
    }
  } else {
    budgetCard.classList.add("hidden");
  }

  renderChart(monthTxs);
  renderTransactionList();
}

function shiftMonth(delta) {
  const [y, m] = (monthPicker.value || getTodayMonth()).split("-").map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  const newY = date.getFullYear();
  const newM = String(date.getMonth() + 1).padStart(2, "0");
  monthPicker.value = `${newY}-${newM}`;
  renderDashboard();
}

// ==================== Chart.js 分類圓餅圖 ====================
function switchChartType(type) {
  currentChartType = type;
  if (type === "expense") {
    chartTabExpense.className = "rounded-md bg-white dark:bg-slate-700 px-2.5 py-1 text-slate-900 dark:text-white shadow-sm transition";
    chartTabIncome.className = "rounded-md px-2.5 py-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition";
  } else {
    chartTabIncome.className = "rounded-md bg-white dark:bg-slate-700 px-2.5 py-1 text-slate-900 dark:text-white shadow-sm transition";
    chartTabExpense.className = "rounded-md px-2.5 py-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition";
  }
  renderChart(getMonthTransactions());
}

function renderChart(monthTxs) {
  const filtered = monthTxs.filter((tx) => tx.type === currentChartType);

  if (filtered.length === 0) {
    chartCanvas.classList.add("hidden");
    chartEmpty.classList.remove("hidden");
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  chartCanvas.classList.remove("hidden");
  chartEmpty.classList.add("hidden");

  const categoryTotals = {};
  for (const tx of filtered) {
    const cat = tx.category || "未分類";
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(tx.amount) || 0);
  }

  const labels = Object.keys(categoryTotals);
  const data = Object.values(categoryTotals);
  const total = data.reduce((sum, v) => sum + v, 0);
  const isDark = Boolean(userSettings.darkMode);

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(chartCanvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: labels.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]),
          borderWidth: 2,
          borderColor: isDark ? "#0f172a" : "#ffffff",
          hoverOffset: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: "62%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: isDark ? "#cbd5e1" : "#334155",
            padding: 16,
            usePointStyle: true,
            font: { size: 12, family: "'Inter', 'Noto Sans TC', sans-serif" }
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed || 0;
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${formatCurrency(val)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// ==================== 收支明細列表 ====================
function renderTransactionList() {
  const monthTxs = getMonthTransactions();
  const filterType = filterTypeEl.value;
  const keyword = searchInputEl.value.trim().toLowerCase();

  const filtered = monthTxs.filter((tx) => {
    if (filterType !== "all" && tx.type !== filterType) return false;
    if (keyword) {
      const cat = (tx.category || "").toLowerCase();
      const note = (tx.note || "").toLowerCase();
      if (!cat.includes(keyword) && !note.includes(keyword)) return false;
    }
    return true;
  });

  recordCountEl.textContent = `${filtered.length} 筆`;

  if (filtered.length === 0) {
    transactionListEl.innerHTML = "";
    listEmptyEl.classList.remove("hidden");
    return;
  }

  listEmptyEl.classList.add("hidden");

  transactionListEl.innerHTML = filtered
    .map((tx) => {
      const isIncome = tx.type === "income";
      const badgeClass = isIncome
        ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
        : "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300";
      const amountClass = isIncome
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-rose-600 dark:text-rose-400";
      const sign = isIncome ? "+" : "-";

      return `
        <div class="flex items-center justify-between gap-3 py-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 rounded-xl px-2 transition">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-semibold ${badgeClass}">
                ${escapeHtml(tx.category || "未分類")}
              </span>
              <span class="text-xs text-slate-400">${escapeHtml(tx.date || "")}</span>
            </div>
            ${
              tx.note
                ? `<p class="mt-1 truncate text-sm text-slate-700 dark:text-slate-200">${escapeHtml(tx.note)}</p>`
                : `<p class="mt-1 text-xs text-slate-400 italic">無備註</p>`
            }
          </div>

          <div class="flex items-center gap-3 shrink-0">
            <span class="text-sm sm:text-base font-bold ${amountClass}">
              ${sign}${formatCurrency(tx.amount)}
            </span>
            <div class="flex items-center gap-1">
              <button
                type="button"
                data-action="edit"
                data-id="${escapeHtml(tx.id)}"
                title="編輯"
                class="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 transition"
              >
                ✏️
              </button>
              <button
                type="button"
                data-action="delete"
                data-id="${escapeHtml(tx.id)}"
                title="刪除"
                class="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950 hover:text-rose-600 transition"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  transactionListEl.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const tx = allTransactions.find((item) => item.id === id);
      if (!tx) return;

      if (action === "edit") openTxModal(tx);
      if (action === "delete") openDeleteModal(tx);
    });
  });
}

// ==================== 新增 / 編輯 Modal 邏輯 ====================
function openTxModal(tx = null) {
  if (tx) {
    modalTitle.textContent = "編輯收支紀錄";
    txIdInput.value = tx.id;
    setModalType(tx.type || "expense");
    txDateInput.value = tx.date || getTodayDate();
    txAmountInput.value = tx.amount || "";
    txCategorySelect.value = tx.category || CATEGORIES[tx.type || "expense"][0];
    txNoteInput.value = tx.note || "";
  } else {
    modalTitle.textContent = "新增收支紀錄";
    txIdInput.value = "";
    setModalType(userSettings.defaultType || "expense");
    txDateInput.value = getTodayDate();
    txAmountInput.value = "";
    txNoteInput.value = "";
  }

  txModal.classList.remove("hidden");
  txModal.classList.add("flex");
}

function closeTxModal() {
  txModal.classList.add("hidden");
  txModal.classList.remove("flex");
}

function setModalType(type) {
  txTypeInput.value = type;
  if (type === "expense") {
    typeBtnExpense.className =
      "rounded-xl border-2 border-rose-500 bg-rose-50 dark:bg-rose-950 py-2 text-sm font-semibold text-rose-700 dark:text-rose-300 transition";
    typeBtnIncome.className =
      "rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition";
  } else {
    typeBtnIncome.className =
      "rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300 transition";
    typeBtnExpense.className =
      "rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition";
  }

  const options = CATEGORIES[type];
  txCategorySelect.innerHTML = options
    .map((cat) => `<option value="${cat}">${cat}</option>`)
    .join("");
}

async function handleSaveTransaction(e) {
  e.preventDefault();
  if (!currentUser) return;

  const id = txIdInput.value.trim();
  const type = txTypeInput.value;
  const date = txDateInput.value;
  const amount = Number(txAmountInput.value);
  const category = txCategorySelect.value;
  const note = txNoteInput.value.trim();

  if (!date || !amount || amount <= 0) {
    showToast("請輸入有效的日期與金額", "error");
    return;
  }

  saveTxBtn.disabled = true;
  saveTxBtn.textContent = "儲存中...";

  try {
    const payload = {
      type,
      date,
      amount,
      category,
      note,
      updatedAt: serverTimestamp()
    };

    if (id) {
      const docRef = doc(db, "users", currentUser.uid, "transactions", id);
      await updateDoc(docRef, payload);
      showToast("已更新紀錄", "success");
    } else {
      const colRef = collection(db, "users", currentUser.uid, "transactions");
      await addDoc(colRef, {
        ...payload,
        createdAt: serverTimestamp()
      });
      showToast("已新增紀錄", "success");
    }

    const txMonth = date.slice(0, 7);
    if (monthPicker.value !== txMonth) {
      monthPicker.value = txMonth;
    }

    closeTxModal();
  } catch (err) {
    console.error("儲存紀錄失敗:", err);
    showToast("儲存失敗，請檢查網路或 Firestore 權限", "error");
  } finally {
    saveTxBtn.disabled = false;
    saveTxBtn.textContent = "儲存紀錄";
  }
}

// ==================== 刪除確認邏輯 ====================
function openDeleteModal(tx) {
  pendingDeleteId = tx.id;
  const typeLabel = tx.type === "income" ? "收入" : "支出";
  deletePreview.textContent = `${tx.date} · ${typeLabel} · ${tx.category} · ${formatCurrency(tx.amount)}`;
  deleteModal.classList.remove("hidden");
  deleteModal.classList.add("flex");
}

function closeDeleteModal() {
  pendingDeleteId = null;
  deleteModal.classList.add("hidden");
  deleteModal.classList.remove("flex");
}

async function handleConfirmDelete() {
  if (!currentUser || !pendingDeleteId) return;
  try {
    const docRef = doc(db, "users", currentUser.uid, "transactions", pendingDeleteId);
    await deleteDoc(docRef);
    showToast("已刪除紀錄", "success");
    closeDeleteModal();
  } catch (err) {
    console.error("刪除紀錄失敗:", err);
    showToast("刪除失敗，請稍後再試", "error");
  }
}

// ==================== 匯出 CSV ====================
function handleExportCSV(exportAll = false) {
  const targetTxs = exportAll ? allTransactions : getMonthTransactions();
  if (targetTxs.length === 0) {
    showToast(exportAll ? "目前沒有任何紀錄可以匯出" : "本月沒有紀錄可以匯出", "info");
    return;
  }

  const headers = ["日期", "類型", "分類", "金額", "備註"];
  const rows = targetTxs.map((tx) => [
    tx.date || "",
    tx.type === "income" ? "收入" : "支出",
    tx.category || "",
    tx.amount ?? 0,
    tx.note || ""
  ]);

  const csvLines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(","))
  ];

  const csvContent = "\uFEFF" + csvLines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  const selectedMonth = monthPicker.value || getTodayMonth();
  const filename = exportAll ? `個人記帳_全部紀錄.csv` : `個人記帳_${selectedMonth}.csv`;
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`已匯出 ${filename}`, "success");
}

function csvEscape(value) {
  const str = String(value ?? "");
  return `"${str.replace(/"/g, '""')}"`;
}

// ==================== 工具函式 ====================
function formatCurrency(num) {
  const n = Number(num) || 0;
  const symbol = userSettings.currency || "NT$";
  return `${symbol} ${n.toLocaleString("zh-TW")}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let toastTimer = null;
function showToast(message, type = "info") {
  const colors = {
    success: "bg-emerald-600",
    error: "bg-rose-600",
    info: "bg-slate-800"
  };

  toastEl.textContent = message;
  toastEl.className = `fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg transition-all duration-300 ${
    colors[type] || colors.info
  }`;

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.add("hidden");
  }, 3000);
}

// 啟動應用程式
init();
