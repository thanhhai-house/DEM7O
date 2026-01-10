/* =========================
   CONFIG — BẮT BUỘC SỬA
========================= */
const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwsv9dWFwPx3XGNL0IfUTm6f5tnB6o2u4jslQqWLLXs06TnG_i4hG8cLf6SxgiIOTsDgQ/exec";

/* =========================
   STATE
========================= */
const state = {
  products: [],
  meta: { prefixes: [], brands: [], units: [] },
  editingKey: null,
  invDraft: {},    // product_key -> {counted_qty, note}
  monthlySummary: null,
};

const $ = (id) => document.getElementById(id);

function toast(msg, type="info"){
  const el = $("toast");
  el.textContent = msg;
  el.style.borderColor = type === "error" ? "rgba(211,91,91,.35)" : "var(--line)";
  el.classList.add("show");
  setTimeout(()=> el.classList.remove("show"), 2600);
}

function setEnvPill(){
  const pill = $("envPill");
  if (!GAS_WEBAPP_URL || GAS_WEBAPP_URL.includes("PASTE_")){
    pill.textContent = "⚠️ Chưa cấu hình GAS_WEBAPP_URL";
    pill.style.borderColor = "rgba(211,91,91,.35)";
  } else {
    pill.textContent = "✅ Đã cấu hình WebApp";
    pill.style.borderColor = "var(--line)";
  }
}

async function api(action, payload={}){
  if (!GAS_WEBAPP_URL || GAS_WEBAPP_URL.includes("PASTE_")){
    toast("Bạn chưa dán GAS_WEBAPP_URL trong app.js", "error");
    throw new Error("Missing GAS_WEBAPP_URL");
  }
  const res = await fetch(GAS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload })
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || "API error");
  return data;
}

function formatMoney(n){
  const x = Number(n || 0);
  return x.toLocaleString("vi-VN");
}
function safeImg(url){
  return url && String(url).trim() ? String(url).trim() : "";
}
function todayYMD(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function isFilter(prefix){
  const p = String(prefix || "").trim().toLowerCase();
  return p.startsWith("lọc") || p.startsWith("loc");
}
function keyLabel(p){
  // hiển thị “mã chính” theo rule
  if (isFilter(p.prefix)) return `OEM: ${p.oem || "—"}`;
  return `SKU: ${p.sku || "—"}`;
}

/* =========================
   TABS
========================= */
function showTab(tabName){
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab===tabName));
  ["products","import","export","inventory","admin"].forEach(v=>{
    const el = $(`view-${v}`);
    if (el) el.style.display = (v===tabName) ? "" : "none";
  });

  if (tabName==="products") renderProductsCards();
  if (tabName==="import") renderImportUI();
  if (tabName==="export") renderExportUI();
  if (tabName==="inventory") renderInventoryUI();
}

/* =========================
   LOADERS
========================= */
async function loadMetaAndProducts(){
  const [metaRes, prodRes] = await Promise.all([
    api("getMeta"),
    api("getProducts"),
  ]);
  state.meta = metaRes.meta;
  state.products = prodRes.products;
}

async function reloadAll(){
  try{
    toast("Đang tải dữ liệu...");
    await loadMetaAndProducts();
    window.ProductUI?.refreshMeta?.(state.meta);
    fillProductSelects();
    renderProductsCards();
    renderImportUI();
    renderExportUI();
    renderInventoryUI();
    toast("Đã tải xong ✅");
  }catch(e){
    toast(e.message, "error");
  }
}

/* =========================
   PRODUCTS — CARD RENDER
========================= */
function renderProductsCards(){
  const q = ($("qProducts").value || "").toLowerCase().trim();
  const grid = $("productsGrid");
  if (!grid) return;

  grid.innerHTML = "";
  const list = state.products.filter(p=>{
    if (!q) return true;
    const hay = `${p.product_name} ${p.brand} ${p.prefix} ${p.sku} ${p.oem} ${p.oem_replace}`.toLowerCase();
    return hay.includes(q);
  });

  list.forEach(p=>{
    const card = document.createElement("div");
    card.className = "pcard";

    const img = safeImg(p.image_url);
    const line1 = `${p.prefix || ""} • ${p.brand || ""} • ${p.unit || ""}`.replace(/^\s*•\s*|\s*•\s*$/g,"");
    const line2 = isFilter(p.prefix)
      ? `OEM: ${p.oem || "—"} | Thay thế: ${p.oem_replace || "—"}`
      : `SKU: ${p.sku || "—"} | Thay thế: ${p.oem_replace || "—"}`;

    card.innerHTML = `
      <img class="pimg" src="${img}" loading="lazy" alt="img"
           onerror="this.onerror=null;this.src='https://via.placeholder.com/160x110?text=No+Image';"/>

      <div class="pinfo">
        <p class="pname">${p.product_name}</p>
        <div class="psub">${line1 || "—"}</div>
        <div class="psub">${line2}</div>
        <div class="pmeta">
          <span>Tồn: <b>${Number(p.qty||0)}</b></span>
          <span>Giá: <b>${formatMoney(p.price||0)}</b></span>
        </div>
      </div>

      <div class="pactions">
        <button class="btn secondary" data-act="detail" data-key="${p.product_key}">Chi tiết</button>
        <button class="btn" data-act="edit" data-key="${p.product_key}">Sửa</button>
        <label class="chkdel">
          <input type="checkbox" data-del="${p.product_key}" />
          Xóa
        </label>
      </div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll("button[data-act]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const key = btn.dataset.key;
      const act = btn.dataset.act;
      if (act==="edit") window.ProductUI.openEdit(key);
      if (act==="detail") window.ProductUI.openDetails(key);
    });
  });
}

/* =========================
   SELECTS (import/export/admin price)
========================= */
function fillProductSelects(){
  const selects = [
    $("importProductSelect"),
    $("exportProductSelect"),
    $("priceProductSelect"),
  ];
  selects.forEach(sel=>{
    if (!sel) return;
    sel.innerHTML = "";
    state.products.forEach(p=>{
      const opt = document.createElement("option");
      opt.value = p.product_key;
      opt.textContent = `${p.product_name} — ${keyLabel(p)}`;
      sel.appendChild(opt);
    });
  });
}

/* =========================
   IMPORT/EXPORT
========================= */
function renderImportUI(){
  const key = $("importProductSelect")?.value;
  const p = state.products.find(x=> x.product_key===key);
  $("importPreview").innerHTML = p
    ? `<div class="row">
         <img class="pimg" src="${safeImg(p.image_url)}"
              onerror="this.onerror=null;this.src='https://via.placeholder.com/160x110?text=No+Image';"/>
         <div>
           <div><b>${p.product_name}</b></div>
           <div class="muted">${keyLabel(p)} • Tồn: <b>${p.qty}</b> • Giá: ${formatMoney(p.price)}</div>
         </div>
       </div>`
    : "Chưa chọn sản phẩm.";
}
function renderExportUI(){
  const key = $("exportProductSelect")?.value;
  const p = state.products.find(x=> x.product_key===key);
  $("exportPreview").innerHTML = p
    ? `<div class="row">
         <img class="pimg" src="${safeImg(p.image_url)}"
              onerror="this.onerror=null;this.src='https://via.placeholder.com/160x110?text=No+Image';"/>
         <div>
           <div><b>${p.product_name}</b></div>
           <div class="muted">${keyLabel(p)} • Tồn: <b>${p.qty}</b> • Giá: ${formatMoney(p.price)}</div>
         </div>
       </div>`
    : "Chưa chọn sản phẩm.";
}

async function doImport(){
  const product_key = $("importProductSelect").value;
  const qty = Number($("importQty").value || 0);
  const note = $("importNote").value || "";
  if (!product_key) return toast("Chọn sản phẩm", "error");
  if (qty <= 0) return toast("Số lượng phải > 0", "error");

  try{
    const res = await api("applyTransaction", { type:"IMPORT", product_key, qty, note });
    toast(`Đã nhập. Tồn mới: ${res.new_qty}`);
    $("importQty").value=""; $("importNote").value="";
    await reloadAll();
  }catch(e){ toast(e.message, "error"); }
}
async function doExport(){
  const product_key = $("exportProductSelect").value;
  const qty = Number($("exportQty").value || 0);
  const note = $("exportNote").value || "";
  if (!product_key) return toast("Chọn sản phẩm", "error");
  if (qty <= 0) return toast("Số lượng phải > 0", "error");

  try{
    const res = await api("applyTransaction", { type:"EXPORT", product_key, qty, note });
    toast(`Đã xuất. Tồn mới: ${res.new_qty}`);
    $("exportQty").value=""; $("exportNote").value="";
    await reloadAll();
  }catch(e){ toast(e.message, "error"); }
}

/* =========================
   INVENTORY CHECK
========================= */
function renderInventoryUI(){
  if (!$("invDate").value) $("invDate").value = todayYMD();
  if (!$("invMonth").value){
    const d = new Date();
    $("invMonth").value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  }

  const q = ($("qInv").value||"").toLowerCase().trim();
  const tbody = $("invTbody");
  tbody.innerHTML = "";

  const list = state.products.filter(p=>{
    if (!q) return true;
    const hay = `${p.product_name} ${p.brand} ${p.prefix} ${p.sku} ${p.oem} ${p.oem_replace}`.toLowerCase();
    return hay.includes(q);
  });

  list.forEach(p=>{
    const draft = state.invDraft[p.product_key] || {};
    const counted = (draft.counted_qty !== undefined && draft.counted_qty !== null) ? draft.counted_qty : "";
    const note = draft.note || "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding:10px; border-bottom:1px solid var(--line);">
        <img class="pimg" src="${safeImg(p.image_url)}"
             onerror="this.onerror=null;this.src='https://via.placeholder.com/160x110?text=No+Image';"/>
      </td>
      <td style="padding:10px; border-bottom:1px solid var(--line);"><b>${keyLabel(p)}</b></td>
      <td style="padding:10px; border-bottom:1px solid var(--line);">${p.product_name}</td>
      <td style="padding:10px; border-bottom:1px solid var(--line);"><b>${Number(p.qty||0)}</b></td>
      <td style="padding:10px; border-bottom:1px solid var(--line);">
        <input data-inv="counted" data-key="${p.product_key}" type="number" min="0" step="1"
               style="width:140px" value="${counted}" placeholder="..." />
      </td>
      <td style="padding:10px; border-bottom:1px solid var(--line);">
        <input data-inv="note" data-key="${p.product_key}" value="${note}" placeholder="ghi chú..." style="width:260px" />
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("input[data-inv]").forEach(inp=>{
    inp.addEventListener("input", ()=>{
      const key = inp.dataset.key;
      const kind = inp.dataset.inv;
      state.invDraft[key] = state.invDraft[key] || {};
      if (kind==="counted"){
        state.invDraft[key].counted_qty = inp.value==="" ? "" : Number(inp.value);
      } else {
        state.invDraft[key].note = inp.value;
      }
    });
  });
}

async function saveInventoryCheck(){
  const date = $("invDate").value;
  if (!date) return toast("Chọn ngày kiểm kê", "error");

  const items = [];
  for (const [product_key, d] of Object.entries(state.invDraft)){
    if (d.counted_qty === "" || d.counted_qty === undefined) continue;
    items.push({ product_key, counted_qty:Number(d.counted_qty||0), note:d.note||"" });
  }
  if (!items.length) return toast("Chưa nhập số thực tế", "error");

  try{
    const res = await api("saveInventoryCheck", { date, items });
    toast(`Đã lưu kiểm kê: ${res.saved} dòng ✅`);
    state.invDraft = {};
    await reloadAll();
  }catch(e){ toast(e.message, "error"); }
}

async function buildMonthlySummary(){
  const month = $("invMonth").value;
  if (!month) return toast("Chọn tháng", "error");
  try{
    const res = await api("buildMonthlySummary", { month });
    $("monthlyResult").innerHTML = `
      <div class="row between">
        <div>
          <div><b>Đã tổng hợp tháng:</b> ${month}</div>
          <div class="muted">Sheet: <b>KIEM_KE_THANG</b> • Dòng: <b>${res.rows}</b></div>
        </div>
        <span class="tag">OK</span>
      </div>
    `;
    toast("Tổng hợp tháng xong ✅");
  }catch(e){ toast(e.message,"error"); }
}

async function createMonthlyDoc(){
  const month = $("invMonth").value;
  if (!month) return toast("Chọn tháng", "error");
  try{
    const res = await api("createMonthlyDocReport", { month });
    $("monthlyResult").innerHTML = `
      <div class="row between">
        <div>
          <div><b>Đã tạo Google Doc:</b> ${month}</div>
          <div class="muted">Mở: <a href="${res.docUrl}" target="_blank" rel="noreferrer">${res.docUrl}</a></div>
        </div>
        <span class="tag">DOC</span>
      </div>
    `;
    toast("Tạo Google Doc xong ✅");
  }catch(e){ toast(e.message,"error"); }
}

/* =========================
   DELETE SELECTED
========================= */
async function deleteSelected(){
  const checks = document.querySelectorAll("input[data-del]:checked");
  if (!checks.length) return toast("Chưa chọn sản phẩm để xóa", "error");
  const keys = Array.from(checks).map(x=> x.dataset.del);

  if (!confirm(`Xóa ${keys.length} sản phẩm?`)) return;

  try{
    for (const product_key of keys){
      await api("deleteProduct", { product_key });
    }
    toast("Đã xóa ✅");
    await reloadAll();
  }catch(e){ toast(e.message, "error"); }
}

/* =========================
   INIT
========================= */
function wireTabs(){
  document.querySelectorAll(".tab").forEach(t=>{
    t.addEventListener("click", ()=> showTab(t.dataset.tab));
  });
}

function wireEvents(){
  $("btnReloadProducts").addEventListener("click", reloadAll);
  $("qProducts").addEventListener("input", renderProductsCards);
  $("btnOpenProductModal").addEventListener("click", ()=> window.ProductUI.openCreate());
  $("btnDeleteSelected").addEventListener("click", deleteSelected);

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

window.addEventListener("DOMContentLoaded", async ()=>{
  $("yearNow").textContent = String(new Date().getFullYear());
  setEnvPill();
  wireTabs();
  wireEvents();
  await reloadAll();
});

/* Expose */
window.AppState = state;
window.AppApi = api;
window.AppToast = toast;
window.AppReloadAll = reloadAll;
