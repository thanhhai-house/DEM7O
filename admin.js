export const Admin = (() => {
  let root;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  function mount(container, app) {
    root = container;
    root.innerHTML = html();
    bind(app);
  }

  function html() {
    return `
      <style>
        .card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:12px}
        .muted{color:#6b7280}
        input,button{padding:10px;border:1px solid #d1d5db;border-radius:10px;background:#fff}
        button{cursor:pointer}
        button.primary{background:#111827;color:#fff;border-color:#111827}
        .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
        .grid{display:grid;grid-template-columns:repeat(12,1fr);gap:12px}
        .col-12{grid-column:span 12}
        .col-6{grid-column:span 6}
        .kv{display:grid;grid-template-columns:160px 1fr;gap:8px;padding:6px 0;border-bottom:1px dashed #e5e7eb}
        .kv:last-child{border-bottom:none}
      </style>

      <div class="card">
        <h3 style="margin:0 0 10px 0">Admin</h3>

        <div class="grid">
          <div class="col-12 card">
            <strong>1) Thêm loại sản phẩm (prefix bắt buộc)</strong>
            <div style="height:10px"></div>
            <div class="row">
              <input id="cat_code" placeholder="Mã (VD: LD, LN, DCR)" style="width:220px">
              <input id="cat_name" placeholder="Tên loại" style="flex:1;min-width:260px">
              <input id="cat_prefix" placeholder="Prefix (VD: LD-)" style="width:180px">
              <input id="cat_fields" placeholder="fields: oem,oem_replace hoặc sku,sku_replace" style="flex:1;min-width:280px">
              <button class="primary" id="add_cat">Thêm</button>
            </div>
            <div style="height:10px"></div>
            <div class="muted">Danh sách loại:</div>
            <div id="list_cat" style="margin-top:6px"></div>
          </div>

          <div class="col-6 card">
            <strong>2) Thêm thương hiệu</strong>
            <div style="height:10px"></div>
            <div class="row">
              <input id="brand" placeholder="Tên thương hiệu" style="flex:1;min-width:240px">
              <button class="primary" id="add_brand">Thêm</button>
            </div>
            <div style="height:10px"></div>
            <div class="muted">Danh sách thương hiệu:</div>
            <div id="list_brand" style="margin-top:6px"></div>
          </div>

          <div class="col-6 card">
            <strong>3) Thêm đơn vị</strong>
            <div style="height:10px"></div>
            <div class="row">
              <input id="unit" placeholder="Đơn vị (cái, bộ, sợi...)" style="flex:1;min-width:240px">
              <button class="primary" id="add_unit">Thêm</button>
            </div>
            <div style="height:10px"></div>
            <div class="muted">Danh sách đơn vị:</div>
            <div id="list_unit" style="margin-top:6px"></div>
          </div>

          <div class="col-12 card">
            <strong>4) Cập nhật giá tiền</strong>
            <div style="height:10px"></div>
            <div class="row">
              <input id="pid" placeholder="Product ID" style="width:240px">
              <input id="ip" type="number" min="0" placeholder="Giá nhập mới" style="width:200px">
              <input id="sp" type="number" min="0" placeholder="Giá bán mới" style="width:200px">
              <input id="note" placeholder="Ghi chú" style="flex:1;min-width:260px">
              <button class="primary" id="upd_price">Cập nhật</button>
            </div>
            <div class="muted" style="font-size:13px;margin-top:8px">Tip: để trống 1 giá thì giữ nguyên giá cũ.</div>
          </div>
        </div>
      </div>
    `;
  }

  function bind(app) {
    root.querySelector("#add_cat").onclick = async () => {
      try {
        const r = await app.api("adminAddCategory", {
          category_code: root.querySelector("#cat_code").value,
          category_name: root.querySelector("#cat_name").value,
          prefix: root.querySelector("#cat_prefix").value,
          fields: root.querySelector("#cat_fields").value,
        });
        app.state.admin = r;
        refresh(app);
        app.toast("Đã thêm loại");
        root.querySelector("#cat_code").value = "";
        root.querySelector("#cat_name").value = "";
        root.querySelector("#cat_prefix").value = "";
        root.querySelector("#cat_fields").value = "";
        await app.reload();
      } catch (e) { app.toast(e.message); }
    };

    root.querySelector("#add_brand").onclick = async () => {
      try {
        const r = await app.api("adminAddBrand", { brand_name: root.querySelector("#brand").value });
        app.state.admin = r;
        refresh(app);
        app.toast("Đã thêm thương hiệu");
        root.querySelector("#brand").value = "";
        await app.reload();
      } catch (e) { app.toast(e.message); }
    };

    root.querySelector("#add_unit").onclick = async () => {
      try {
        const r = await app.api("adminAddUnit", { unit_name: root.querySelector("#unit").value });
        app.state.admin = r;
        refresh(app);
        app.toast("Đã thêm đơn vị");
        root.querySelector("#unit").value = "";
        await app.reload();
      } catch (e) { app.toast(e.message); }
    };

    root.querySelector("#upd_price").onclick = async () => {
      try {
        const r = await app.api("updatePrice", {
          product_id: root.querySelector("#pid").value.trim(),
          import_price: root.querySelector("#ip").value,
          sale_price: root.querySelector("#sp").value,
          note: root.querySelector("#note").value,
        });
        app.toast("Đã cập nhật giá: " + r.product_id);
        root.querySelector("#ip").value = "";
        root.querySelector("#sp").value = "";
        root.querySelector("#note").value = "";
        await app.reload();
      } catch (e) { app.toast(e.message); }
    };
  }

  function refresh(app) {
    if (!root) return;
    const admin = app.state.admin || { categories: [], brands: [], units: [] };

    root.querySelector("#list_cat").innerHTML =
      (admin.categories||[]).map(c =>
        `<div class="kv"><div><strong>${esc(c.category_code)}</strong></div><div>${esc(c.category_name)} <span class="muted">(${esc(c.prefix)})</span> <span class="muted">${esc(c.fields||"")}</span></div></div>`
      ).join("") || `<div class="muted">Chưa có</div>`;

    root.querySelector("#list_brand").innerHTML =
      (admin.brands||[]).map(b => `<div class="kv"><div>Brand</div><div>${esc(b.brand_name)}</div></div>`).join("") || `<div class="muted">Chưa có</div>`;

    root.querySelector("#list_unit").innerHTML =
      (admin.units||[]).map(u => `<div class="kv"><div>Unit</div><div>${esc(u.unit_name)}</div></div>`).join("") || `<div class="muted">Chưa có</div>`;
  }

  return { mount, refresh };
})();
