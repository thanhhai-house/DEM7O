import { Products } from "./product.js";
import { Admin } from "./admin.js";

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "GAS_URL";

const App = {
  gasUrl: "",
  state: {
    products: [],
    admin: { categories: [], brands: [], units: [] },
    activeTab: "products",
  },

  toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.style.display = "block";
    setTimeout(() => (t.style.display = "none"), 2200);
  },

  setStatus(msg) { $("status").textContent = msg; },

  setGasUrl(url) {
    this.gasUrl = (url || "").trim();
    $("gasUrl").value = this.gasUrl;
    if (this.gasUrl) {
      localStorage.setItem(STORAGE_KEY, this.gasUrl);
      this.setStatus("Đã cấu hình GAS");
    } else {
      localStorage.removeItem(STORAGE_KEY);
      this.setStatus("Chưa cấu hình GAS");
    }
  },

  async api(action, payload = {}) {
    if (!this.gasUrl) throw new Error("Chưa dán GAS URL. Dán link Apps Script Web App rồi bấm Lưu.");
    const res = await fetch(this.gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, payload }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "API error");
    return json.result;
  },

  bindTabs() {
    document.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
        btn.classList.add("active");
        this.switchTab(btn.dataset.tab);
      });
    });
  },

  switchTab(tab) {
    this.state.activeTab = tab;
    $("view-products").style.display = tab === "products" ? "" : "none";
    $("view-import").style.display = tab === "import" ? "" : "none";
    $("view-export").style.display = tab === "export" ? "" : "none";
    $("view-admin").style.display = tab === "admin" ? "" : "none";
  },

  renderImportExport() {
    $("view-import").innerHTML = `
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:14px">
        <h3 style="margin:0 0 10px 0">Nhập sản phẩm</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <input id="in_pid" placeholder="Product ID" style="flex:1;min-width:240px;padding:10px;border:1px solid #d1d5db;border-radius:10px">
          <input id="in_qty" type="number" min="1" value="1" style="width:140px;padding:10px;border:1px solid #d1d5db;border-radius:10px">
          <input id="in_price" type="number" min="0" value="0" style="width:180px;padding:10px;border:1px solid #d1d5db;border-radius:10px" placeholder="Giá nhập">
          <input id="in_note" placeholder="Ghi chú" style="flex:1;min-width:240px;padding:10px;border:1px solid #d1d5db;border-radius:10px">
          <button id="btn_import" style="padding:10px 12px;border-radius:10px;border:1px solid #111827;background:#111827;color:#fff;cursor:pointer">Lưu nhập</button>
        </div>
      </div>
    `;

    $("view-export").innerHTML = `
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:14px">
        <h3 style="margin:0 0 10px 0">Xuất sản phẩm</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <input id="out_pid" placeholder="Product ID" style="flex:1;min-width:240px;padding:10px;border:1px solid #d1d5db;border-radius:10px">
          <input id="out_qty" type="number" min="1" value="1" style="width:140px;padding:10px;border:1px solid #d1d5db;border-radius:10px">
          <input id="out_price" type="number" min="0" value="0" style="width:180px;padding:10px;border:1px solid #d1d5db;border-radius:10px" placeholder="Giá xuất/bán">
          <input id="out_note" placeholder="Ghi chú" style="flex:1;min-width:240px;padding:10px;border:1px solid #d1d5db;border-radius:10px">
          <button id="btn_export" style="padding:10px 12px;border-radius:10px;border:1px solid #111827;background:#111827;color:#fff;cursor:pointer">Lưu xuất</button>
        </div>
      </div>
    `;

    $("btn_import").addEventListener("click", async () => {
      try {
        const r = await this.api("importStock", {
          product_id: $("in_pid").value.trim(),
          quantity: $("in_qty").value,
          price: $("in_price").value,
          note: $("in_note").value,
        });
        this.toast("Đã nhập. Tồn mới: " + r.stock);
        await this.reload();
      } catch (e) { this.toast(e.message); }
    });

    $("btn_export").addEventListener("click", async () => {
      try {
        const r = await this.api("exportStock", {
          product_id: $("out_pid").value.trim(),
          quantity: $("out_qty").value,
          price: $("out_price").value,
          note: $("out_note").value,
        });
        this.toast("Đã xuất. Tồn mới: " + r.stock);
        await this.reload();
      } catch (e) { this.toast(e.message); }
    });
  },

  async loadAll() {
    this.setStatus("Init...");
    await this.api("init");
    this.setStatus("Đang tải dữ liệu...");
    const all = await this.api("getAll");
    this.state.products = all.products || [];
    this.state.admin = all.admin || this.state.admin;
    this.setStatus("Sẵn sàng");
  },

  async reload() {
    try {
      this.setStatus("Đang tải lại...");
      const all = await this.api("getAll");
      this.state.products = all.products || [];
      this.state.admin = all.admin || this.state.admin;

      Products.refresh(this);
      Admin.refresh(this);

      this.setStatus("Sẵn sàng");
    } catch (e) {
      this.setStatus("Lỗi");
      this.toast(e.message);
    }
  },

  bindGasBox() {
    const saved = localStorage.getItem(STORAGE_KEY) || "";
    this.setGasUrl(saved);

    $("saveGas").addEventListener("click", async () => {
      const url = $("gasUrl").value.trim();
      this.setGasUrl(url);
      if (!url) return this.toast("Đã xoá GAS URL");

      try {
        await this.loadAll();
        Products.refresh(this);
        Admin.refresh(this);
        this.toast("Kết nối OK");
      } catch (e) {
        this.toast(e.message);
      }
    });

    $("clearGas").addEventListener("click", () => {
      this.setGasUrl("");
      this.toast("Đã xoá GAS URL");
    });
  },

  async boot() {
    this.bindGasBox();
    this.bindTabs();
    this.renderImportExport();

    Products.mount($("view-products"), this);
    Admin.mount($("view-admin"), this);

    if (this.gasUrl) {
      try {
        await this.loadAll();
        Products.refresh(this);
        Admin.refresh(this);
      } catch (e) {
        this.toast(e.message);
      }
    }
  },
};

App.boot();
export default App;
