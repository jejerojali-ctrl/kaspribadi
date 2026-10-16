"use strict";

const STORAGE_KEY = "kas-pribadi.transactions.v1";
const CATEGORY_STORAGE_KEY = "kas-pribadi.categories.v1";
const DEFAULT_CATEGORIES = {
  income: ["Gaji", "Bonus", "Hasil usaha", "Hadiah", "Lainnya"],
  expense: ["Makanan", "Transportasi", "Belanja", "Tagihan", "Kesehatan", "Hiburan", "Lainnya"]
};
const currencyFormat = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
});
const shortDateFormat = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric"
});
const monthFormat = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric"
});

const elements = {
  status: document.querySelector("#status-banner"),
  installButton: document.querySelector("#install-app"),
  installLabel: document.querySelector("#install-label"),
  installMessage: document.querySelector("#install-message"),
  monthPicker: document.querySelector("#month-picker"),
  periodChip: document.querySelector("#period-chip"),
  breadcrumb: document.querySelector("#breadcrumb-label"),
  pageTitle: document.querySelector("#page-title"),
  pageDescription: document.querySelector("#page-description"),
  summaryView: document.querySelector("#summary-view"),
  historyView: document.querySelector("#history-view"),
  chartMonth: document.querySelector("#chart-month"),
  chart: document.querySelector("#balance-chart"),
  chartTooltip: document.querySelector("#chart-tooltip"),
  clearDateFilter: document.querySelector("#clear-date-filter"),
  currentBalance: document.querySelector("#current-balance"),
  monthlyIncome: document.querySelector("#monthly-income"),
  monthlyExpense: document.querySelector("#monthly-expense"),
  monthlyNet: document.querySelector("#monthly-net"),
  monthlyCount: document.querySelector("#monthly-count"),
  averageExpense: document.querySelector("#average-expense"),
  monthFootnote: document.querySelector("#month-footnote"),
  transactionList: document.querySelector("#transaction-list"),
  historyList: document.querySelector("#history-list"),
  emptyState: document.querySelector("#empty-state"),
  historyEmpty: document.querySelector("#history-empty"),
  historyCount: document.querySelector("#history-count"),
  transactionSubtitle: document.querySelector("#transaction-subtitle"),
  entryPanel: document.querySelector("#entry-panel"),
  entryHeading: document.querySelector("#entry-heading"),
  form: document.querySelector("#transaction-form"),
  description: document.querySelector("#description"),
  amount: document.querySelector("#amount"),
  category: document.querySelector("#category"),
  categoryManager: document.querySelector("#category-manager"),
  categoryManagerHeading: document.querySelector("#category-manager-heading"),
  categoryManagerDescription: document.querySelector("#category-manager-description"),
  categoryManagerMessage: document.querySelector("#category-manager-message"),
  categoryList: document.querySelector("#category-list"),
  newCategory: document.querySelector("#new-category"),
  addCategory: document.querySelector("#add-category"),
  toggleCategoryManager: document.querySelector("#toggle-category-manager"),
  date: document.querySelector("#transaction-date"),
  saveEntry: document.querySelector("#save-entry"),
  formHint: document.querySelector("#form-hint")
};

let transactions = [];
let storageReady = true;
let categoryStorageReady = true;
let categoriesByType = {
  income: [...DEFAULT_CATEGORIES.income],
  expense: [...DEFAULT_CATEGORIES.expense]
};
let transactionType = "expense";
let editingId = null;
let activeView = "summary";
let activeFilter = "all";
let selectedDate = null;
let showAllTransactions = false;
let deferredInstallPrompt = null;

function showStatus(message) {
  elements.status.textContent = message;
  elements.status.hidden = false;
}

function clearStatus() {
  elements.status.textContent = "";
  elements.status.hidden = true;
}

function showInstallMessage(message) {
  elements.installMessage.textContent = message;
  elements.installMessage.hidden = false;
}

function isInstalledAsApp() {
  return window.matchMedia("(display-mode: standalone)").matches
    || navigator.standalone === true;
}

function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function setupPwa() {
  if (isInstalledAsApp()) {
    elements.installButton.hidden = true;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    elements.installLabel.textContent = "Pasang aplikasi";
    elements.installButton.setAttribute("aria-label", "Pasang aplikasi Kas Pribadi");
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    elements.installButton.hidden = true;
    showInstallMessage("Kas Pribadi berhasil dipasang di perangkat ini.");
  });

  elements.installButton.addEventListener("click", async () => {
    if (!window.isSecureContext) {
      showInstallMessage("Agar bisa dipasang dan dibuka offline, aplikasi harus diakses dari alamat HTTPS. localhost hanya aman di perangkat yang menjalankan server.");
      return;
    }

    if (deferredInstallPrompt) {
      try {
        const promptEvent = deferredInstallPrompt;
        deferredInstallPrompt = null;
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === "accepted") {
          showInstallMessage("Ikuti konfirmasi browser untuk menyelesaikan pemasangan Kas Pribadi.");
        }
      } catch (error) {
        console.error("Pemasangan Kas Pribadi gagal dimulai.", error);
        showInstallMessage("Browser belum dapat memulai pemasangan. Coba lagi lewat menu browser.");
      }
      return;
    }

    if (isIOSDevice()) {
      showInstallMessage("Di iPhone/iPad: buka alamat HTTPS aplikasi di Safari, ketuk Bagikan, lalu pilih Tambahkan ke Layar Utama.");
      return;
    }

    showInstallMessage("Di Android, buka alamat HTTPS aplikasi dengan Chrome lalu pilih Pasang aplikasi. Jika pilihan belum muncul, muat ulang halaman setelah koneksi internet tersedia.");
  });

  if (!("serviceWorker" in navigator)) return;
  if (!window.isSecureContext) return;

  navigator.serviceWorker.register("./service-worker.js", { scope: "./" })
    .catch((error) => {
      console.error("Service worker Kas Pribadi gagal didaftarkan.", error);
      showInstallMessage("Mode offline belum aktif. Pastikan aplikasi dibuka lewat HTTPS, lalu muat ulang halaman.");
    });
}

function isValidTransaction(item) {
  if (item === null || typeof item !== "object") return false;
  const [year, month, day] = typeof item.date === "string" ? item.date.split("-").map(Number) : [];
  const parsedDate = new Date(year, month - 1, day);

  return item !== null
    && typeof item.id === "string"
    && typeof item.description === "string"
    && typeof item.category === "string"
    && (item.type === "income" || item.type === "expense")
    && Number.isSafeInteger(item.amount)
    && item.amount > 0
    && typeof item.date === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
    && !Number.isNaN(parsedDate.getTime())
    && parsedDate.getFullYear() === year
    && parsedDate.getMonth() === month - 1
    && parsedDate.getDate() === day;
}

function loadTransactions() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return [];

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || !parsed.every(isValidTransaction)) {
      throw new Error("Format catatan tidak sesuai.");
    }
    return parsed;
  } catch (error) {
    storageReady = false;
    showStatus("Catatan lokal tidak dapat dibaca. Data belum diubah; periksa penyimpanan browser sebelum mencoba lagi.");
    return [];
  }
}

function isValidCategoryList(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every((category) => typeof category === "string"
      && category.length > 0
      && category.length <= 32
      && category.trim() === category)
    && new Set(value.map((category) => category.toLocaleLowerCase("id-ID"))).size === value.length;
}

function loadCategories() {
  try {
    const saved = localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (saved === null) {
      return {
        income: [...DEFAULT_CATEGORIES.income],
        expense: [...DEFAULT_CATEGORIES.expense]
      };
    }

    const parsed = JSON.parse(saved);
    if (parsed === null || typeof parsed !== "object"
      || !isValidCategoryList(parsed.income)
      || !isValidCategoryList(parsed.expense)) {
      throw new Error("Format kategori tidak sesuai.");
    }
    return { income: [...parsed.income], expense: [...parsed.expense] };
  } catch (error) {
    categoryStorageReady = false;
    showStatus("Kategori tersimpan tidak dapat dibaca. Kategori bawaan tersedia, tetapi perubahan kategori dinonaktifkan agar data tidak tertimpa.");
    return {
      income: [...DEFAULT_CATEGORIES.income],
      expense: [...DEFAULT_CATEGORIES.expense]
    };
  }
}

function saveCategories(nextCategories) {
  if (!categoryStorageReady) {
    showStatus("Kategori belum dapat diubah karena daftar tersimpan tidak berhasil dibaca.");
    return false;
  }

  try {
    localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(nextCategories));
    categoriesByType = nextCategories;
    clearCategoryManagerMessage();
    return true;
  } catch (error) {
    showStatus("Kategori belum tersimpan. Pastikan penyimpanan browser tersedia, lalu coba lagi.");
    return false;
  }
}

function saveTransactions(nextTransactions) {
  if (!storageReady) {
    showStatus("Transaksi belum dapat disimpan karena catatan lokal tidak berhasil dibaca.");
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTransactions));
    transactions = nextTransactions;
    clearStatus();
    return true;
  } catch (error) {
    showStatus("Perubahan belum tersimpan. Pastikan penyimpanan browser tersedia, lalu coba lagi.");
    return false;
  }
}

function formatCurrency(value) {
  return currencyFormat.format(value).replace(/\u00a0/g, " ");
}

function getLocalDateString(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function monthKey(date) {
  return date.slice(0, 7);
}

function currentMonthKey() {
  return getLocalDateString().slice(0, 7);
}

function getSelectedMonth() {
  return elements.monthPicker.value || currentMonthKey();
}

function getMonthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return monthFormat.format(new Date(year, month - 1, 1));
}

function setMonth(key) {
  if (!/^\d{4}-\d{2}$/.test(key)) return;
  elements.monthPicker.value = key;
  selectedDate = null;
  render();
}

function shiftMonth(amount) {
  const [year, month] = getSelectedMonth().split("-").map(Number);
  const next = new Date(year, month - 1 + amount, 1);
  setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
}

function sortedTransactions(items) {
  return [...items].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

function monthTransactions() {
  return transactions.filter((item) => monthKey(item.date) === getSelectedMonth());
}

function currentBalance() {
  return transactions.reduce((total, item) => total + (item.type === "income" ? item.amount : -item.amount), 0);
}

function calculateMonthTotals(items) {
  return items.reduce((totals, item) => {
    if (item.type === "income") totals.income += item.amount;
    else totals.expense += item.amount;
    return totals;
  }, { income: 0, expense: 0 });
}

function updateCategoryOptions(preferred, archived = false) {
  const categories = categoriesByType[transactionType];
  elements.category.replaceChildren();
  const availableCategories = preferred && !categories.includes(preferred)
    ? [...categories, preferred]
    : categories;
  availableCategories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = archived && category === preferred && !categories.includes(category)
      ? `${category} (kategori dihapus)`
      : category;
    elements.category.append(option);
  });
  if (preferred && availableCategories.includes(preferred)) elements.category.value = preferred;
  renderCategoryManager();
}

function clearCategoryManagerMessage() {
  elements.categoryManagerMessage.textContent = "";
  elements.categoryManagerMessage.hidden = true;
}

function showCategoryManagerMessage(message) {
  elements.categoryManagerMessage.textContent = message;
  elements.categoryManagerMessage.hidden = false;
}

function renderCategoryManager() {
  const categories = categoriesByType[transactionType];
  elements.categoryManagerHeading.textContent = `Kategori ${transactionType === "income" ? "pemasukan" : "pengeluaran"}`;
  elements.categoryManagerDescription.textContent = `Daftar untuk ${transactionType === "income" ? "pemasukan" : "pengeluaran"}. Kategori pada transaksi lama tetap tersimpan setelah dihapus.`;
  elements.categoryList.setAttribute("aria-label", `Daftar kategori ${transactionType === "income" ? "pemasukan" : "pengeluaran"}`);
  elements.categoryList.replaceChildren();

  categories.forEach((category) => {
    const item = document.createElement("li");
    item.className = "category-list-item";
    const name = document.createElement("span");
    name.className = "category-name";
    name.textContent = category;

    const deleteButton = document.createElement("button");
    deleteButton.className = "category-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "Hapus";
    deleteButton.setAttribute("aria-label", `Hapus kategori ${category}`);
    deleteButton.disabled = !categoryStorageReady || categories.length <= 1;
    deleteButton.addEventListener("click", () => removeCategory(category));

    item.append(name, deleteButton);
    elements.categoryList.append(item);
  });

  elements.newCategory.disabled = !categoryStorageReady;
  document.querySelector("#add-category").disabled = !categoryStorageReady;
  if (!categoryStorageReady) {
    showCategoryManagerMessage("Daftar kategori tidak dapat dibaca. Kelola kategori dinonaktifkan agar data lama tidak tertimpa.");
  }
}

function openCategoryManager() {
  elements.categoryManager.hidden = false;
  elements.toggleCategoryManager.setAttribute("aria-expanded", "true");
  clearCategoryManagerMessage();
  renderCategoryManager();
}

function closeCategoryManager() {
  elements.categoryManager.hidden = true;
  elements.toggleCategoryManager.setAttribute("aria-expanded", "false");
  clearCategoryManagerMessage();
}

function addCategory(event) {
  const category = elements.newCategory.value.trim();
  if (!category) {
    showCategoryManagerMessage("Masukkan nama kategori terlebih dahulu.");
    elements.newCategory.focus();
    return;
  }

  if (categoriesByType[transactionType].some((item) => item.toLocaleLowerCase("id-ID") === category.toLocaleLowerCase("id-ID"))) {
    showCategoryManagerMessage("Kategori itu sudah ada pada jenis transaksi ini.");
    elements.newCategory.focus();
    return;
  }

  const nextCategories = {
    ...categoriesByType,
    [transactionType]: [...categoriesByType[transactionType], category]
  };
  if (!saveCategories(nextCategories)) return;

  elements.newCategory.value = "";
  updateCategoryOptions(category);
  render();
  elements.newCategory.focus();
}

function removeCategory(category) {
  const categoryTransactions = transactions.filter((item) => item.type === transactionType && item.category === category).length;
  const historyNote = categoryTransactions
    ? ` ${categoryTransactions} transaksi lama akan tetap menampilkan kategori ini.`
    : "";
  const shouldDelete = window.confirm(`Hapus kategori "${category}" dari pilihan ${transactionType === "income" ? "pemasukan" : "pengeluaran"}?${historyNote}`);
  if (!shouldDelete) return;

  const nextList = categoriesByType[transactionType].filter((item) => item !== category);
  if (nextList.length === 0) {
    showCategoryManagerMessage("Sisakan setidaknya satu kategori untuk jenis transaksi ini.");
    return;
  }

  const nextCategories = { ...categoriesByType, [transactionType]: nextList };
  if (!saveCategories(nextCategories)) return;

  const editingArchivedCategory = editingId !== null
    && transactions.some((item) => item.id === editingId && item.type === transactionType && item.category === category);
  const nextSelection = elements.category.value === category && !editingArchivedCategory
    ? nextList[0]
    : elements.category.value;
  updateCategoryOptions(nextSelection, editingArchivedCategory);
  render();
}

function setTransactionType(type) {
  transactionType = type;
  document.querySelectorAll(".type-option").forEach((button) => {
    const selected = button.dataset.type === type;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  updateCategoryOptions();
  clearCategoryManagerMessage();
}

function openEntry(transaction = null) {
  editingId = transaction ? transaction.id : null;
  elements.entryPanel.hidden = false;
  closeCategoryManager();
  elements.entryHeading.textContent = transaction ? "Ubah transaksi" : "Catat transaksi";
  elements.saveEntry.textContent = transaction ? "Simpan perubahan" : "Simpan transaksi";
  elements.formHint.textContent = transaction ? "Periksa kembali detail sebelum menyimpan." : "Nominal disimpan sebagai rupiah.";

  if (transaction) {
    setTransactionType(transaction.type);
    elements.description.value = transaction.description;
    elements.amount.value = String(transaction.amount);
    elements.date.value = transaction.date;
    updateCategoryOptions(transaction.category, true);
  } else {
    elements.form.reset();
    setTransactionType("expense");
    elements.date.value = getLocalDateString();
  }

  elements.entryPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => elements.description.focus(), 0);
}

function closeEntry() {
  elements.entryPanel.hidden = true;
  closeCategoryManager();
  elements.form.reset();
  editingId = null;
  elements.entryHeading.textContent = "Catat transaksi";
  elements.saveEntry.textContent = "Simpan transaksi";
  setTransactionType("expense");
}

function createTransactionRow(item) {
  const row = document.createElement("article");
  row.className = "transaction-row";

  const primary = document.createElement("div");
  primary.className = "transaction-primary";
  const description = document.createElement("span");
  description.className = "transaction-description";
  description.textContent = item.description;
  const category = document.createElement("span");
  category.className = "transaction-category";
  category.textContent = item.category;
  primary.append(description, category);

  const date = document.createElement("time");
  date.className = "transaction-date";
  date.dateTime = item.date;
  date.textContent = shortDateFormat.format(new Date(`${item.date}T00:00:00`));

  const type = document.createElement("span");
  type.className = "transaction-type";
  type.textContent = item.type === "income" ? "Pemasukan" : "Pengeluaran";

  const amount = document.createElement("strong");
  amount.className = `transaction-amount is-${item.type}`;
  amount.textContent = `${item.type === "income" ? "+" : "−"} ${formatCurrency(item.amount)}`;

  const actions = document.createElement("div");
  actions.className = "transaction-actions";

  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "transaction-action";
  edit.setAttribute("aria-label", `Ubah ${item.description}`);
  edit.title = "Ubah transaksi";
  edit.innerHTML = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m12.7 4.2 3.1 3.1M4 16l3.7-.8 8.6-8.6a1.7 1.7 0 0 0-2.4-2.4l-8.6 8.6L4 16Z" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  edit.addEventListener("click", () => openEntry(item));

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "transaction-action delete";
  remove.setAttribute("aria-label", `Hapus ${item.description}`);
  remove.title = "Hapus transaksi";
  remove.innerHTML = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.5 6h11M8 6V4.5h4V6m-6 0 .6 9.2h6.8L14 6m-5 3v4m2-4v4" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  remove.addEventListener("click", () => {
    const shouldDelete = window.confirm(`Hapus transaksi "${item.description}"?`);
    if (!shouldDelete) return;
    saveTransactions(transactions.filter((entry) => entry.id !== item.id));
    render();
  });

  actions.append(edit, remove);
  row.append(primary, date, type, amount, actions);
  return row;
}

function filteredItems(items) {
  return items.filter((item) => {
    const typeMatches = activeFilter === "all" || item.type === activeFilter;
    const dateMatches = !selectedDate || item.date === selectedDate;
    return typeMatches && dateMatches;
  });
}

function renderTransactionLists() {
  const monthlyItems = sortedTransactions(filteredItems(monthTransactions()));
  const visibleItems = activeView === "history"
    ? sortedTransactions(filteredItems(transactions))
    : (showAllTransactions ? monthlyItems : monthlyItems.slice(0, 6));
  const target = activeView === "history" ? elements.historyList : elements.transactionList;
  target.replaceChildren(...visibleItems.map(createTransactionRow));

  if (activeView === "history") {
    elements.historyEmpty.hidden = visibleItems.length > 0;
    elements.historyCount.textContent = `${visibleItems.length} dari ${transactions.length} transaksi`;
  } else {
    elements.emptyState.hidden = visibleItems.length > 0;
    elements.transactionSubtitle.textContent = selectedDate
      ? `Transaksi pada ${shortDateFormat.format(new Date(`${selectedDate}T00:00:00`))}`
      : `Catatan kas ${getMonthLabel(getSelectedMonth())}`;
    elements.clearDateFilter.hidden = !selectedDate;
    document.querySelector("#view-all").hidden = showAllTransactions || monthlyItems.length <= 6;
    document.querySelector("#view-all").textContent = "Lihat semua";
    document.querySelector("#empty-heading").textContent = selectedDate
      ? "Tidak ada transaksi pada tanggal ini"
      : "Belum ada catatan di bulan ini";
  }
}

function chartPath(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
}

function renderChart(items) {
  const width = 760;
  const height = 270;
  const left = 96;
  const right = 18;
  const top = 14;
  const bottom = 32;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const [year, month] = getSelectedMonth().split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyAmounts = new Map();

  items.forEach((item) => {
    const day = Number(item.date.slice(8, 10));
    const daily = dailyAmounts.get(day) || { volume: 0, net: 0 };
    daily.volume += item.amount;
    daily.net += item.type === "income" ? item.amount : -item.amount;
    dailyAmounts.set(day, daily);
  });

  const startingBalance = transactions.reduce((total, item) => {
    if (item.date < `${getSelectedMonth()}-01`) return total + (item.type === "income" ? item.amount : -item.amount);
    return total;
  }, 0);
  const hasChartData = items.length > 0 || startingBalance !== 0;
  let runningBalance = startingBalance;
  const values = [];
  const dailyBalances = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const activity = dailyAmounts.get(day) || { volume: 0, net: 0 };
    runningBalance += activity.net;
    values.push(runningBalance);
    dailyBalances.push({ day, balance: runningBalance, ...activity });
  }

  let minimum = Math.min(0, ...values);
  let maximum = Math.max(0, ...values);
  if (minimum === maximum) {
    const padding = hasChartData ? Math.max(1, Math.abs(maximum) * 0.1) : 100000;
    minimum -= padding;
    maximum += padding;
  }
  const range = maximum - minimum;
  const padding = range * 0.12;
  minimum -= padding;
  maximum += padding;

  const xForDay = (day) => left + ((day - 1) / Math.max(1, daysInMonth - 1)) * plotWidth;
  const yForValue = (value) => top + ((maximum - value) / (maximum - minimum)) * plotHeight;
  const plotted = dailyBalances.map((point) => ({
    ...point,
    x: xForDay(point.day),
    y: yForValue(point.balance)
  }));
  const path = chartPath(plotted);
  const areaPath = `${path} L ${plotted[plotted.length - 1].x.toFixed(2)} ${(top + plotHeight).toFixed(2)} L ${plotted[0].x.toFixed(2)} ${(top + plotHeight).toFixed(2)} Z`;
  const tickValues = hasChartData ? [maximum, maximum * 0.5 + minimum * 0.5, minimum] : [0];
  const numberShort = new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1
  });
  const formatChartValue = (value) => `${value < 0 ? "−" : ""}Rp${numberShort.format(Math.abs(value))}`;
  const maxVolume = Math.max(1, ...dailyBalances.map((point) => point.volume));
  const firstWeek = [1, 8, 15, 22, 29].filter((day) => day <= daysInMonth);

  const markup = [
    '<defs><linearGradient id="balance-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#e9b64f" stop-opacity=".15"/><stop offset="100%" stop-color="#e9b64f" stop-opacity="0"/></linearGradient></defs>',
    tickValues.map((tick, index) => {
      const y = yForValue(tick);
      return `<g><line class="chart-grid-line${Math.abs(tick) < 0.0001 ? " chart-zero-line" : ""}" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"/><text class="chart-axis-label" x="${left - 10}" y="${y + 3}" text-anchor="end">${formatChartValue(tick)}</text></g>`;
    }).join(""),
    hasChartData ? `<path class="chart-area" d="${areaPath}"/><path class="chart-path" d="${path}"/>` : "",
    plotted.map((point) => {
      if (point.volume === 0) return "";
      const radius = 3.5 + Math.sqrt(point.volume / maxVolume) * 5;
      const dateValue = `${getSelectedMonth()}-${String(point.day).padStart(2, "0")}`;
      const flowType = point.net > 0 ? "is-income" : point.net < 0 ? "is-expense" : "";
      const isSelected = selectedDate === dateValue;
      const label = `${point.day} ${getMonthLabel(getSelectedMonth())}: saldo ${formatCurrency(point.balance)}, arus kas ${formatCurrency(point.volume)}`;
      return `<g class="chart-point ${flowType}${isSelected ? " is-selected" : ""}" data-date="${dateValue}" tabindex="0" role="button" aria-label="${label}"><circle class="point-hit" cx="${point.x}" cy="${point.y}" r="28"/><circle class="point-selection" cx="${point.x}" cy="${point.y}" r="${radius + 4}"/><circle class="point-core" cx="${point.x}" cy="${point.y}" r="${radius}"/><title>${label}</title></g>`;
    }).join(""),
    firstWeek.map((day) => `<text class="chart-axis-label day-label" x="${xForDay(day)}" y="${height - 7}" text-anchor="middle">${day}</text>`).join("")
  ].join("");

  elements.chart.innerHTML = markup;
  elements.chartMonth.textContent = getMonthLabel(getSelectedMonth());
  elements.chart.setAttribute("aria-label", `Perubahan saldo harian selama ${getMonthLabel(getSelectedMonth())}`);

  if (!hasChartData) {
    elements.chart.insertAdjacentHTML("beforeend", `<text class="chart-empty-label" x="${left + plotWidth / 2}" y="${top + plotHeight / 2}" text-anchor="middle">Belum ada pergerakan kas pada bulan ini</text>`);
  }
}

function updateSummary(items) {
  const totals = calculateMonthTotals(items);
  const net = totals.income - totals.expense;
  elements.currentBalance.textContent = formatCurrency(currentBalance());
  elements.monthlyIncome.textContent = formatCurrency(totals.income);
  elements.monthlyExpense.textContent = formatCurrency(totals.expense);
  elements.monthlyNet.textContent = `${net < 0 ? "− " : ""}${formatCurrency(Math.abs(net))}`;
  elements.monthlyNet.classList.toggle("is-negative", net < 0);
  elements.monthlyCount.textContent = String(items.length);
  elements.averageExpense.textContent = formatCurrency(items.filter((item) => item.type === "expense").length
    ? totals.expense / items.filter((item) => item.type === "expense").length
    : 0);
  elements.monthFootnote.textContent = items.length
    ? `Ada ${items.length} catatan kas pada bulan ini.`
    : "Catat transaksi untuk mulai melihat pola kas.";
  elements.periodChip.textContent = getMonthLabel(getSelectedMonth());
  renderChart(items);
}

function renderFilterButtons() {
  document.querySelectorAll(".filter-option").forEach((button) => {
    const selected = button.dataset.filter === activeFilter;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function render() {
  const monthItems = monthTransactions();
  elements.summaryView.hidden = activeView !== "summary";
  elements.historyView.hidden = activeView !== "history";
  elements.breadcrumb.textContent = activeView === "summary" ? "Ringkasan" : "Semua transaksi";
  elements.pageTitle.textContent = activeView === "summary" ? "Ringkasan kas" : "Semua transaksi";
  elements.pageDescription.textContent = activeView === "summary"
    ? "Lihat posisi uangmu dan perubahannya sepanjang bulan."
    : "Telusuri semua pemasukan dan pengeluaran yang tersimpan.";
  elements.periodChip.hidden = activeView === "history";

  updateSummary(monthItems);
  renderTransactionLists();
  renderFilterButtons();
  document.querySelector("#open-entry").disabled = !storageReady;
  document.querySelector("#empty-add").disabled = !storageReady;
  document.querySelector("#history-add").disabled = !storageReady;
  elements.saveEntry.disabled = !storageReady;
}

function handleSubmit(event) {
  event.preventDefault();
  if (!elements.form.reportValidity()) return;

  const amount = Number(elements.amount.value);
  const description = elements.description.value.trim();
  const date = elements.date.value;
  if (!description || !Number.isSafeInteger(amount) || amount <= 0 || !isValidTransaction({
    id: "validation",
    description,
    category: elements.category.value,
    type: transactionType,
    amount,
    date
  })) {
    showStatus("Periksa nama, nominal, kategori, dan tanggal transaksi.");
    return;
  }

  if (editingId) {
    const next = transactions.map((item) => item.id === editingId
      ? { ...item, description, amount, date, type: transactionType, category: elements.category.value }
      : item);
    if (saveTransactions(next)) {
      closeEntry();
      render();
    }
    return;
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const next = [...transactions, {
    id,
    description,
    amount,
    date,
    type: transactionType,
    category: elements.category.value
  }];
  if (saveTransactions(next)) {
    selectedDate = null;
    if (monthKey(date) !== getSelectedMonth()) setMonth(monthKey(date));
    closeEntry();
    render();
  }
}

function setView(view) {
  activeView = view;
  if (view === "history") {
    showAllTransactions = true;
    selectedDate = null;
  } else {
    showAllTransactions = false;
  }
  document.querySelectorAll(".nav-item").forEach((button) => {
    const selected = button.dataset.view === view;
    button.classList.toggle("is-active", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  render();
}

document.querySelectorAll(".type-option").forEach((button) => {
  button.addEventListener("click", () => setTransactionType(button.dataset.type));
});
elements.toggleCategoryManager.addEventListener("click", () => {
  if (elements.categoryManager.hidden) openCategoryManager();
  else closeCategoryManager();
});
document.querySelector("#close-category-manager").addEventListener("click", closeCategoryManager);
elements.addCategory.addEventListener("click", addCategory);
elements.newCategory.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addCategory();
  }
});

document.querySelectorAll(".filter-option").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    renderTransactionLists();
    renderFilterButtons();
  });
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelector("#open-entry").addEventListener("click", () => openEntry());
document.querySelector("#empty-add").addEventListener("click", () => openEntry());
document.querySelector("#history-add").addEventListener("click", () => openEntry());
document.querySelector("#close-entry").addEventListener("click", closeEntry);
document.querySelector("#cancel-entry").addEventListener("click", closeEntry);
elements.form.addEventListener("submit", handleSubmit);
document.querySelector("#previous-month").addEventListener("click", () => shiftMonth(-1));
document.querySelector("#next-month").addEventListener("click", () => shiftMonth(1));
elements.monthPicker.addEventListener("change", () => {
  if (elements.monthPicker.value) {
    selectedDate = null;
    render();
  }
});
document.querySelector("#view-all").addEventListener("click", () => {
  setView("history");
});
document.querySelector("#clear-date-filter").addEventListener("click", () => {
  selectedDate = null;
  elements.chartTooltip.hidden = true;
  render();
});

elements.chart.addEventListener("click", (event) => {
  const point = event.target.closest(".chart-point");
  if (!point) return;
  selectedDate = point.dataset.date;
  elements.chartTooltip.textContent = point.querySelector("title").textContent;
  elements.chartTooltip.hidden = false;
  render();
  const selectedPoint = elements.chart.querySelector(`[data-date="${selectedDate}"]`);
  if (selectedPoint) selectedPoint.focus();
});

elements.chart.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".chart-point")) {
    event.preventDefault();
    event.target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }
});

elements.monthPicker.value = currentMonthKey();
transactions = loadTransactions();
categoriesByType = loadCategories();
updateCategoryOptions();
render();
setupPwa();
