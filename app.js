/* =========================
   CONFIG — BẮT BUỘC SỬA
========================= */
const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzwqgI9fZWOHBanFy5AwWgwY6QOdFHtBh37poJ-YqFiAURtLl9qXqiYVsQmgbZOAHcrfA/exec"; // <-- Dán URL Web App của Apps Script

/* =========================
   STATE
========================= */
const state = {
  products: [],
  meta: { prefixes: [], brands: [], units: [] },
  editingProductId: null,
  invDraft: {}, // product_id -> {counted_qty, note}
  monthlySummary: null,
};

const $ = (id) => document.getElementById(id);

function toast(msg, type = "info") {
  const el = $("toast");
  el.textContent = msg;
  el.style.borderColor = type === "error" ? "rgba(211,91,91,.35)" : "var(--line)";
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

function setEnvPill() {
  const pill = $("envPill");
  if (!GAS_WEBAPP_URL || GAS_WEBAPP_URL.includes("PASTE_")) {
    pill.textContent = "⚠️ Chưa cấu hình GAS_WEBAPP_URL";
    pill.style.borderColor = "rgba(211,91,91,.35)";
  } else {
    pill.textContent = "✅ Đã cấu hình WebApp";
    pill.style.borderColor = "var(--line)";
  }
}

async function api(action, payload = {}) {
  if (!GAS_WEBAPP_URL || GAS_WEBAPP_URL.includes("PASTE_")) {
    toast("Bạn chưa dán GAS_WEBAPP_URL trong app.js", "error");
    throw new Error("Missing GAS_WEBAPP_URL");
  }
  const res = await fetch(GAS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // GAS dễ parse hơn
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || "API error");
  return data;
}

function formatMoney(n) {
  const x = Number(n || 0);
  return x.toLocaleString("vi-VN");
}

function safeImg(url) {
  return url && String(url).trim() ? String(url).trim() : "";
}

function todayYMD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* =========================
   TABS
========================= */
function showTab(tabName) {
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === tabName);
  });
  const views = ["products", "import", "export", "inventory", "admin"];
  views.forEach((v) => {
    const el = $(`view-${v}`);
    if (el) el.style.display = (v === tabName) ? "" : "none";
  });

  if (tabName === "products") renderProductsTable();
  if (tabName === "import") renderImportUI();
  if (tabName === "export") renderExportUI();
  if (tabName === "inventory") renderInventoryUI();
  if (tabName === "admin") renderAdminUI();
}

/* =========================
   LOADERS
========================= */
async function loadMetaAndProducts() {
  const [metaRes, prodRes] = await Promise.all([
    api("getMeta"),
    api("getProducts"),
  ]);
  state.meta = metaRes.meta;
  state.products = prodRes.products;
}

async function reloadAll() {
  try {
    toast("Đang tải dữ liệu...");
    await loadMetaAndProducts();
    renderProductsTable();
    fillMetaSelects();
    fillProductSelects();
    renderImportUI();
    renderExportUI();
    renderInventoryUI();
    renderAdminUI();
    toast("Đã tải xong ✅");
  } catch (e) {
    toast(e.message, "error");
  }
}

/* =========================
   PRODUCTS LIST
========================= */
function renderProductsTable() {
  const q = ($("qProducts").value || "").toLowerCase().trim();
  const tbody = $("productsTbody");
  tbody.innerHTML = "";

  const rows = state.products
    .filter(p => {
      if (!q) return true;
      const hay = `${p.product_id} ${p.product_name} ${p.brand} ${p.prefix}`.toLowerCase();
      return hay.includes(q);
    })
    .map(p => {
      const img = safeImg(p.image_url);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <img class="thumb" src="${img}" alt="img"
               onerror="this.onerror=null;this.src='https://via.placeholder.com/48?text=No';" />
        </td>
        <td><b>${p.product_id}</b></td>
        <td>${p.product_name}</td>
        <td>${p.brand || ""}</td>
        <td>${p.unit || ""}</td>
        <td><b>${Number(p.qty || 0)}</b></td>
        <td>${formatMoney(p.price || 0)}</td>
        <td class="row" style="gap:8px;">
          <button class="btn secondary" data-act="detail" data-id="${p.product_id}">Details</button>
          <button class="btn" data-act="edit" data-id="${p.product_id}">Sửa</button>
        </td>
      `;
      return tr;
    });

  rows.forEach(tr => tbody.appendChild(tr));

  tbody.querySelectorAll("button[data-act]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      if (act === "edit") window.ProductUI.openEdit(id);
      if (act === "detail") window.ProductUI.openDetails(id);
    });
  });
}

/* =========================
   IMPORT/EXPORT
========================= */
function fillProductSelects() {
  const selects = [
    $("importProductSelect"),
    $("exportProductSelect"),
    $("priceProductSelect"),
  ];
  selects.forEach(sel => {
    if (!sel) return;
    sel.innerHTML = "";
    state.products.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.product_id;
      opt.textContent = `${p.product_id} — ${p.product_name}`;
      sel.appendChild(opt);
    });
  });
}

function renderImportUI() {
  const sel = $("importProductSelect");
  const id = sel?.value;
  const p = state.products.find(x => x.product_id === id);
  $("importPreview").innerHTML = p
    ? `<div class="row">
         <img class="thumb" src="${safeImg(p.image_url)}"
              onerror="this.onerror=null;this.src='https://via.placeholder.com/48?text=No';" />
         <div>
           <div><b>${p.product_id}</b> — ${p.product_name}</div>
           <div class="muted">Tồn hiện tại: <b>${p.qty}</b> • Giá: ${formatMoney(p.price)}</div>
         </div>
       </div>`
    : "Chưa chọn sản phẩm.";
}

function renderExportUI() {
  const sel = $("exportProductSelect");
  const id = sel?.value;
  const p = state.products.find(x => x.product_id === id);
  $("exportPreview").innerHTML = p
    ? `<div class="row">
         <img class="thumb" src="${safeImg(p.image_url)}"
              onerror="this.onerror=null;this.src='https://via.placeholder.com/48?text=No';" />
         <div>
           <div><b>${p.product_id}</b> — ${p.product_name}</div>
           <div class="muted">Tồn hiện tại: <b>${p.qty}</b> • Giá: ${formatMoney(p.price)}</div>
         </div>
       </div>`
    : "Chưa chọn sản phẩm.";
}

async function doImport() {
  const product_id = $("importProductSelect").value;
  const qty = Number($("importQty").value || 0);
  const note = $("importNote").value || "";
  if (!product_id) return toast("Chọn sản phẩm", "error");
  if (qty <= 0) return toast("Số lượng phải > 0", "error");

  try {
    const res = await api("applyTransaction", {
      type: "IMPORT",
      product_id,
      qty,
      note
    });
    toast(`Đã nhập: ${res.new_qty}`, "info");
    await reloadAll();
    $("importQty").value = "";
    $("importNote").value = "";
  } catch (e) {
    toast(e.message, "error");
  }
}

async function doExport() {
  const product_id = $("exportProductSelect").value;
  const qty = Number($("exportQty").value || 0);
  const note = $("exportNote").value || "";
  if (!product_id) return toast("Chọn sản phẩm", "error");
  if (qty <= 0) return toast("Số lượng phải > 0", "error");

  try {
    const res = await api("applyTransaction", {
      type: "EXPORT",
      product_id,
      qty,
      note
    });
    toast(`Đã xuất: ${res.new_qty}`, "info");
    await reloadAll();
    $("exportQty").value = "";
    $("exportNote").value = "";
  } catch (e) {
    toast(e.message, "error");
  }
}

/* =========================
   INVENTORY CHECK
========================= */
function renderInventoryUI() {
  if (!$("invDate").value) $("invDate").value = todayYMD();
  if (!$("invMonth").value) {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    $("invMonth").value = `${yyyy}-${mm}`;
  }

  const q = ($("qInv").value || "").toLowerCase().trim();
  const tbody = $("invTbody");
  tbody.innerHTML = "";

  const list = state.products.filter(p => {
    if (!q) return true;
    const hay = `${p.product_id} ${p.product_name} ${p.brand} ${p.prefix}`.toLowerCase();
    return hay.includes(q);
  });

  list.forEach(p => {
    const draft = state.invDraft[p.product_id] || {};
    const counted = (draft.counted_qty !== undefined && draft.counted_qty !== null)
      ? draft.counted_qty
      : "";
    const note = draft.note || "";
    const systemQty = Number(p.qty || 0);
    const diff = (counted === "" ? null : Number(counted) - systemQty);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <img class="thumb" src="${safeImg(p.image_url)}"
             onerror="this.onerror=null;this.src='https://via.placeholder.com/48?text=No';"/>
      </td>
      <td><b>${p.product_id}</b></td>
      <td>${p.product_name}</td>
      <td><b>${systemQty}</b></td>
      <td>
        <input data-inv="counted" data-id="${p.product_id}"
               type="number" step="1" min="0" style="width:140px"
               value="${counted}" placeholder="..." />
      </td>
      <td>
        ${diff === null ? `<span class="muted">—</span>` :
          `<span class="diff ${diff >= 0 ? "plus" : "minus"}">${diff >= 0 ? "+" : ""}${diff}</span>`}
      </td>
      <td>
        <input data-inv="note" data-id="${p.product_id}"
               value="${note}" placeholder="ghi chú..." style="width:260px" />
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("input[data-inv]").forEach(inp => {
    inp.addEventListener("input", () => {
      const id = inp.dataset.id;
      const kind = inp.dataset.inv;
      state.invDraft[id] = state.invDraft[id] || {};
      if (kind === "counted") {
        const v = inp.value;
        state.invDraft[id].counted_qty = (v === "" ? "" : Number(v));
      } else {
        state.invDraft[id].note = inp.value;
      }
      // re-render row diff quickly by re-render table (simple)
      renderInventoryUI();
    });
  });
}

async function saveInventoryCheck() {
  const date = $("invDate").value;
  if (!date) return toast("Chọn ngày kiểm kê", "error");

  const items = [];
  for (const [product_id, d] of Object.entries(state.invDraft)) {
    if (d.counted_qty === "" || d.counted_qty === undefined) continue;
    items.push({
      product_id,
      counted_qty: Number(d.counted_qty || 0),
      note: d.note || ""
    });
  }
  if (!items.length) return toast("Chưa nhập số thực tế cho sản phẩm nào", "error");

  try {
    const res = await api("saveInventoryCheck", { date, items });
    toast(`Đã lưu kiểm kê: ${res.saved} dòng ✅`);
    state.invDraft = {};
    await reloadAll();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function buildMonthlySummary() {
  const month = $("invMonth").value; // YYYY-MM
  if (!month) return toast("Chọn tháng", "error");
  try {
    const res = await api("buildMonthlySummary", { month });
    state.monthlySummary = res;
    $("monthlyResult").innerHTML = `
      <div class="row between">
        <div>
          <div><b>Đã tổng hợp tháng:</b> ${month}</div>
          <div class="muted">Sheet: <b>KIEM_KE_THANG</b> • Số dòng: <b>${res.rows}</b></div>
        </div>
        <span class="tag">OK</span>
      </div>
    `;
    toast("Tổng hợp tháng xong ✅");
  } catch (e) {
    toast(e.message, "error");
  }
}

async function createMonthlyDoc() {
  const month = $("invMonth").value;
  if (!month) return toast("Chọn tháng", "error");
  try {
    const res = await api("createMonthlyDocReport", { month });
    $("monthlyResult").innerHTML = `
      <div class="row between">
        <div>
          <div><b>Đã tạo báo cáo Google Doc:</b> ${month}</div>
          <div class="muted">Mở: <a href="${res.docUrl}" target="_blank" rel="noreferrer">${res.docUrl}</a></div>
        </div>
        <span class="tag">DOC</span>
      </div>
    `;
    toast("Tạo Google Doc xong ✅");
  } catch (e) {
    toast(e.message, "error");
  }
}

/* =========================
   INIT + EVENTS
========================= */
function wireTabs() {
  document.querySelectorAll(".tab").forEach(t => {
    t.addEventListener("click", () => showTab(t.dataset.tab));
  });
}

function wireEvents() {
  $("btnReloadProducts").addEventListener("click", reloadAll);
  $("qProducts").addEventListener("input", renderProductsTable);
  $("btnOpenProductModal").addEventListener("click", () => window.ProductUI.openCreate());

  $("btnReloadImport").addEventListener("click", reloadAll);
  $("importProductSelect").addEventListener("change", renderImportUI);
  $("btnDoImport").addEventListener("click", doImport);

  $("btnReloadExport").addEventListener("click", reloadAll);
  $("exportProductSelect").addEventListener("change", renderExportUI);
  $("btnDoExport").addEventListener("click", doExport);

  $("btnReloadInv").addEventListener("click", reloadAll);
  $("qInv").addEventListener("input", renderInventoryUI);
  $("btnSaveInv").addEventListener("click", saveInventoryCheck);
  $("btnBuildMonthly").addEventListener("click", buildMonthlySummary);
  $("btnCreateDoc").addEventListener("click", createMonthlyDoc);

  $("btnReloadAdmin").addEventListener("click", reloadAll);
}

function fillMetaSelects() {
  // product modal selects handled in product.js via ProductUI.refreshMeta
  window.ProductUI?.refreshMeta?.(state.meta);

  // admin price select already filled by fillProductSelects
}

function renderAdminUI() {
  window.AdminUI?.refresh?.(state);
}

window.addEventListener("DOMContentLoaded", async () => {
  setEnvPill();
  wireTabs();
  wireEvents();
  try {
    await reloadAll();
  } catch (e) {
    toast(e.message, "error");
  }
});

/* Expose state for other modules */
window.AppState = state;
window.AppApi = api;
window.AppToast = toast;
window.AppReloadAll = reloadAll;
window.AppFillProductSelects = fillProductSelects;
window.AppFillMetaSelects = fillMetaSelects;
