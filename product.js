export const Products = (() => {
  let root;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
  const fmt = (n) => (Number(n || 0)).toLocaleString("vi-VN");
  const debounce = (fn, ms) => { let t=null; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };

  const state = {
    formMode:"ADD",
    editId:null,
    detailId:null,
    pendingImageBase64:null,
    pendingImageMime:null,
    pendingImageName:null
  };

  function mount(container, app) {
    root = container;
    root.innerHTML = html();
    bind(app);
  }

  function html() {
    return `
      <style>
        .card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:12px}
        .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
        .muted{color:#6b7280}
        input,select,button{padding:10px;border:1px solid #d1d5db;border-radius:10px;background:#fff}
        button{cursor:pointer}
        button.primary{background:#111827;color:#fff;border-color:#111827}
        .table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden}
        .table th,.table td{padding:10px;border-bottom:1px solid #e5e7eb;text-align:left;font-size:14px;vertical-align:top}
        .table th{background:#f9fafb}
        .badge{display:inline-block;padding:3px 8px;border-radius:999px;border:1px solid #e5e7eb;font-size:12px}
        .badge.low{border-color:#f59e0b}
        .badge.zero{border-color:#ef4444}
        .badge.ok{border-color:#10b981}
        .thumb{width:52px;height:52px;border-radius:10px;border:1px solid #e5e7eb;object-fit:cover;background:#fff}
        .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;padding:16px;z-index:50}
        .modal{background:#fff;border-radius:16px;max-width:820px;width:100%;border:1px solid #e5e7eb}
        .mhead{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #e5e7eb}
        .mbody{padding:14px}
        .mfoot{padding:12px 14px;border-top:1px solid #e5e7eb;display:flex;gap:10px;justify-content:flex-end}
        .grid{display:grid;grid-template-columns:repeat(12,1fr);gap:12px}
        .col-12{grid-column:span 12}
        .col-6{grid-column:span 6}
        .col-4{grid-column:span 4}
        .col-3{grid-column:span 3}
        .kv{display:grid;grid-template-columns:180px 1fr;gap:8px;padding:6px 0;border-bottom:1px dashed #e5e7eb}
        .kv:last-child{border-bottom:none}
      </style>

      <div class="card">
        <div class="row">
          <input id="q" placeholder="Tìm ID / tên / OEM / SKU / mã thay thế..." style="flex:1;min-width:260px">
          <select id="cat"></select>
          <button class="primary" id="add">+ Thêm sản phẩm</button>
          <button id="reload">Tải lại</button>
        </div>

        <div style="height:10px"></div>

        <table class="table">
          <thead><tr>
            <th>Ảnh</th><th>ID</th><th>Tên</th><th>Nhóm</th><th>Hãng</th><th>Tồn</th><th>Giá bán</th><th>Hành động</th>
          </tr></thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>

      <!-- FORM -->
      <div class="modal-backdrop" id="mform">
        <div class="modal">
          <div class="mhead">
            <div>
              <strong id="ftitle">Thêm sản phẩm</strong>
              <div class="muted" style="font-size:12px">ID tự tạo theo prefix nhóm. Ảnh lưu Drive.</div>
            </div>
            <button id="fclose">Đóng</button>
          </div>

          <div class="mbody">
            <div class="grid">
              <div class="col-4"><div class="muted" style="font-size:12px">Nhóm</div><select id="f_category"></select></div>
              <div class="col-4"><div class="muted" style="font-size:12px">Hãng</div><select id="f_brand"></select></div>
              <div class="col-4"><div class="muted" style="font-size:12px">Đơn vị</div><select id="f_unit"></select></div>

              <div class="col-12"><div class="muted" style="font-size:12px">Tên</div><input id="f_name" style="width:100%"></div>

              <div class="col-6" id="woem"><div class="muted" style="font-size:12px">OEM</div><input id="f_oem" style="width:100%"></div>
              <div class="col-6" id="woemr"><div class="muted" style="font-size:12px">OEM thay thế (phẩy)</div><input id="f_oem_replace" style="width:100%"></div>

              <div class="col-6" id="wsku"><div class="muted" style="font-size:12px">SKU</div><input id="f_sku" style="width:100%"></div>
              <div class="col-6" id="wskur"><div class="muted" style="font-size:12px">SKU thay thế (phẩy)</div><input id="f_sku_replace" style="width:100%"></div>

              <div class="col-3"><div class="muted" style="font-size:12px">Giá nhập</div><input id="f_import_price" type="number" min="0" value="0" style="width:100%"></div>
              <div class="col-3"><div class="muted" style="font-size:12px">Giá bán</div><input id="f_sale_price" type="number" min="0" value="0" style="width:100%"></div>
              <div class="col-3"><div class="muted" style="font-size:12px">Tồn</div><input id="f_stock" type="number" min="0" value="0" style="width:100%"></div>
              <div class="col-3"><div class="muted" style="font-size:12px">Tồn tối thiểu</div><input id="f_min_stock" type="number" min="0" value="0" style="width:100%"></div>

              <div class="col-6"><div class="muted" style="font-size:12px">Vị trí</div><input id="f_location" style="width:100%"></div>
              <div class="col-6"><div class="muted" style="font-size:12px">Ghi chú</div><input id="f_note" style="width:100%"></div>

              <div class="col-12">
                <div class="muted" style="font-size:12px">Hình ảnh (upload Drive)</div>
                <input id="f_img" type="file" accept="image/*" style="width:100%">
                <div style="margin-top:10px;display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">
                  <img id="img_preview" src="" style="max-width:240px;max-height:180px;border:1px solid #e5e7eb;border-radius:12px;display:none;object-fit:cover">
                  <div class="muted" id="img_hint" style="font-size:13px">Chọn ảnh để preview. Bấm Lưu sẽ upload lên Google Drive.</div>
                </div>
              </div>

              <div class="col-12 muted" style="font-size:12px">Mode: <strong id="fmode">ADD</strong> | ID: <strong id="fid">-</strong></div>
            </div>
          </div>

          <div class="mfoot">
            <button class="primary" id="fsave">Lưu</button>
          </div>
        </div>
      </div>

      <!-- DETAIL -->
      <div class="modal-backdrop" id="mdetail">
        <div class="modal">
          <div class="mhead">
            <div>
              <strong>Chi tiết sản phẩm</strong>
              <div class="muted" style="font-size:12px">Ảnh + tất cả field</div>
            </div>
            <button id="dclose">Đóng</button>
          </div>
          <div class="mbody" id="dbody"></div>
          <div class="mfoot">
            <button class="primary" id="dedit">Sửa</button>
            <button id="din">Nhập nhanh</button>
            <button id="dout">Xuất nhanh</button>
          </div>
        </div>
      </div>
    `;
  }

  function open(id){ root.querySelector("#"+id).style.display="flex"; }
  function close(id){ root.querySelector("#"+id).style.display="none"; }

  function buildOptions(sel, items, valKey, textFn, allOpt=false){
    sel.innerHTML = "";
    if(allOpt){
      const o=document.createElement("option");
      o.value=""; o.textContent="Tất cả nhóm";
      sel.appendChild(o);
    }
    items.forEach(it=>{
      const o=document.createElement("option");
      o.value=it[valKey];
      o.textContent=textFn(it);
      sel.appendChild(o);
    });
  }

  function updateDynamic(app){
    const admin = app.state.admin || {categories:[]};
    const code = root.querySelector("#f_category").value || "";
    const cat = (admin.categories||[]).find(x=>String(x.category_code)===String(code));
    const fields = String(cat?.fields||"").toLowerCase();
    const showOEM = fields.includes("oem");
    const showSKU = fields.includes("sku");

    root.querySelector("#woem").style.display = showOEM ? "" : "none";
    root.querySelector("#woemr").style.display = showOEM ? "" : "none";
    root.querySelector("#wsku").style.display = showSKU ? "" : "none";
    root.querySelector("#wskur").style.display = showSKU ? "" : "none";
  }

  function badge(p){
    const stock = Number(p.stock||0), min = Number(p.min_stock||0);
    if (stock<=0) return `<span class="badge zero">Hết</span>`;
    if (min>0 && stock<=min) return `<span class="badge low">Thấp</span>`;
    return `<span class="badge ok">OK</span>`;
  }

  function resetPendingImage(){
    state.pendingImageBase64 = null;
    state.pendingImageMime = null;
    state.pendingImageName = null;
    root.querySelector("#f_img").value = "";
  }

  function previewImage(){
    const input = root.querySelector("#f_img");
    const img = root.querySelector("#img_preview");
    const hint = root.querySelector("#img_hint");

    const f = input.files && input.files[0];
    if (!f) {
      resetPendingImage();
      img.style.display = "none";
      hint.textContent = "Chọn ảnh để preview. Bấm Lưu sẽ upload lên Google Drive.";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result; // data:image/...;base64,....
      const parts = String(dataUrl).split(",");
      state.pendingImageBase64 = parts[1] || null;
      state.pendingImageMime = f.type || "image/jpeg";
      state.pendingImageName = f.name || "image.jpg";

      img.src = dataUrl;
      img.style.display = "";
      hint.textContent = "Preview OK. Ảnh sẽ upload khi bấm Lưu.";
    };
    reader.readAsDataURL(f);
  }

  function bind(app) {
    root.querySelector("#add").onclick = () => openForm(app, "ADD");
    root.querySelector("#reload").onclick = () => app.reload();

    root.querySelector("#q").addEventListener("input", debounce(() => refresh(app), 200));
    root.querySelector("#cat").addEventListener("change", () => refresh(app));

    root.querySelector("#fclose").onclick = () => close("mform");
    root.querySelector("#fsave").onclick = () => saveForm(app);
    root.querySelector("#f_category").addEventListener("change", ()=>updateDynamic(app));
    root.querySelector("#f_img").addEventListener("change", ()=>previewImage());

    root.querySelector("#dclose").onclick = () => close("mdetail");
    root.querySelector("#dedit").onclick = () => openForm(app, "EDIT", state.detailId);
    root.querySelector("#din").onclick = () => quickMove("import");
    root.querySelector("#dout").onclick = () => quickMove("export");

    updateDynamic(app);
  }

  async function openForm(app, mode, product_id=null){
    state.formMode = mode;
    state.editId = product_id;

    root.querySelector("#fmode").textContent = mode;
    root.querySelector("#fid").textContent = product_id || "(sẽ tạo sau khi lưu)";
    root.querySelector("#ftitle").textContent = mode==="ADD" ? "Thêm sản phẩm" : "Điều chỉnh sản phẩm";

    // dropdowns
    const admin = app.state.admin || {categories:[],brands:[],units:[]};
    buildOptions(root.querySelector("#cat"), admin.categories||[], "category_code", c=>`${c.category_code} - ${c.category_name}`, true);
    buildOptions(root.querySelector("#f_category"), admin.categories||[], "category_code", c=>`${c.category_code} - ${c.category_name}`);
    buildOptions(root.querySelector("#f_brand"), admin.brands||[], "brand_name", b=>b.brand_name);
    buildOptions(root.querySelector("#f_unit"), admin.units||[], "unit_name", u=>u.unit_name);

    // reset fields
    const set = (id,v)=>root.querySelector("#"+id).value=v;
    set("f_name",""); set("f_oem",""); set("f_oem_replace",""); set("f_sku",""); set("f_sku_replace","");
    set("f_import_price",0); set("f_sale_price",0); set("f_stock",0); set("f_min_stock",0);
    set("f_location",""); set("f_note","");

    // image preview
    resetPendingImage();
    const img = root.querySelector("#img_preview");
    const hint = root.querySelector("#img_hint");
    img.style.display = "none";
    hint.textContent = "Chọn ảnh để preview. Bấm Lưu sẽ upload lên Google Drive.";

    if(mode==="EDIT" && product_id){
      const p = await app.api("getProduct",{product_id});
      if(!p) return app.toast("Không tìm thấy sản phẩm");
      set("f_category", p.category||"");
      set("f_brand", p.brand||"");
      set("f_unit", p.unit||"");
      set("f_name", p.product_name||"");
      set("f_oem", p.oem||"");
      set("f_oem_replace", p.oem_replace||"");
      set("f_sku", p.sku||"");
      set("f_sku_replace", p.sku_replace||"");
      set("f_import_price", Number(p.import_price||0));
      set("f_sale_price", Number(p.sale_price||0));
      set("f_stock", Number(p.stock||0));
      set("f_min_stock", Number(p.min_stock||0));
      set("f_location", p.location||"");
      set("f_note", p.note||"");

      if (p.image_url) {
        img.src = p.image_url;
        img.style.display = "";
        hint.textContent = "Ảnh hiện tại. Nếu chọn ảnh mới rồi Lưu sẽ thay ảnh (file cũ đưa vào thùng rác).";
      }
    }

    updateDynamic(app);
    open("mform");
  }

  async function saveForm(app){
    try{
      const v = (id)=>root.querySelector("#"+id).value;

      const payload = {
        category: v("f_category"),
        brand: v("f_brand"),
        unit: v("f_unit"),
        product_name: v("f_name"),
        oem: v("f_oem"),
        oem_replace: v("f_oem_replace"),
        sku: v("f_sku"),
        sku_replace: v("f_sku_replace"),
        import_price: v("f_import_price"),
        sale_price: v("f_sale_price"),
        stock: v("f_stock"),
        min_stock: v("f_min_stock"),
        location: v("f_location"),
        note: v("f_note"),
      };

      let pid = null;

      if(state.formMode==="ADD"){
        const r = await app.api("addProduct", payload);
        pid = r.product_id;
        app.toast("Đã thêm: " + pid);
      } else {
        payload.product_id = state.editId;
        await app.api("updateProduct", payload);
        pid = payload.product_id;
        app.toast("Đã cập nhật: " + pid);
      }

      // upload image if selected
      if (state.pendingImageBase64) {
        await app.api("uploadProductImage", {
          product_id: pid,
          file_name: state.pendingImageName,
          mime_type: state.pendingImageMime,
          base64: state.pendingImageBase64,
          replace_old: true
        });
        resetPendingImage();
      }

      close("mform");
      await app.reload();
    }catch(e){ app.toast(e.message); }
  }

  async function openDetail(app, product_id){
    const p = await app.api("getProduct",{product_id});
    if(!p) return app.toast("Không tìm thấy sản phẩm");
    state.detailId = product_id;

    const keys = Object.keys(p);
    const topImg = p.image_url ? `
      <div style="margin-bottom:12px">
        <img src="${esc(p.image_url)}" style="max-width:100%;max-height:340px;border:1px solid #e5e7eb;border-radius:14px;object-fit:contain;background:#fff">
      </div>` : `<div class="muted" style="margin-bottom:12px">Chưa có ảnh</div>`;

    root.querySelector("#dbody").innerHTML =
      topImg +
      keys.map(k =>
        `<div class="kv"><div class="muted">${esc(k)}</div><div><strong>${esc(String(p[k]??""))}</strong></div></div>`
      ).join("");

    open("mdetail");
  }

  function quickMove(tab){
    const id = state.detailId;
    if(!id) return;
    close("mdetail");
    document.querySelector(`.tab[data-tab="${tab}"]`)?.click();
    if(tab==="import") document.getElementById("in_pid").value = id;
    if(tab==="export") document.getElementById("out_pid").value = id;
  }

  function refresh(app){
    if(!root) return;

    const admin = app.state.admin || {categories:[]};
    buildOptions(root.querySelector("#cat"), admin.categories||[], "category_code", c=>`${c.category_code} - ${c.category_name}`, true);

    const q = (root.querySelector("#q").value||"").trim().toLowerCase();
    const fc = root.querySelector("#cat").value;

    const list = (app.state.products||[]).filter(p=>{
      if(fc && String(p.category||"")!==String(fc)) return false;
      if(!q) return true;
      const hay = [p.product_id,p.product_name,p.oem,p.oem_replace,p.sku,p.sku_replace,p.brand,p.unit,p.category]
        .map(x=>String(x||"").toLowerCase()).join(" | ");
      return hay.includes(q);
    });

    const tbody = root.querySelector("#tbody");
    tbody.innerHTML = "";

    list.forEach(p=>{
      const imgHtml = p.image_url
        ? `<img class="thumb" src="${esc(p.image_url)}" alt="img">`
        : `<div class="thumb" style="display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px">No Img</div>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${imgHtml}</td>
        <td><strong>${esc(p.product_id)}</strong></td>
        <td>${esc(p.product_name||"")}</td>
        <td>${esc(p.category||"")}</td>
        <td>${esc(p.brand||"")}</td>
        <td>${badge(p)} <span class="muted">(${fmt(p.stock||0)})</span></td>
        <td>${fmt(p.sale_price||0)}</td>
        <td>
          <div class="row" style="gap:6px">
            <button data-act="detail" data-id="${esc(p.product_id)}">Chi tiết</button>
            <button data-act="edit" data-id="${esc(p.product_id)}">Sửa</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("button").forEach(btn=>{
      btn.onclick = ()=>{
        const id = btn.dataset.id;
        const act = btn.dataset.act;
        if(act==="detail") openDetail(app, id);
        if(act==="edit") openForm(app, "EDIT", id);
      };
    });
  }

  return { mount, refresh };
})();
