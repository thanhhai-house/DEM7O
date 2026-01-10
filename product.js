(function(){
  const $ = (id)=> document.getElementById(id);

  function openModal(){ $("productModalBackdrop").classList.add("show"); }
  function closeModal(){
    $("productModalBackdrop").classList.remove("show");
    // reset view mode
    setModeEdit_(true);
    $("detailsBox").style.display = "none";
  }

  function setModeEdit_(isEdit){
    // enable/disable inputs
    ["p_name","p_prefix","p_brand","p_unit","p_qty","p_price","p_note","p_image","p_sku","p_oem","p_oem_replace"]
      .forEach(id => { const el = $(id); if (el) el.disabled = !isEdit; });

    $("btnSaveProduct").style.display = isEdit ? "" : "none";
    $("btnDeleteProduct").style.display = isEdit ? "" : "none";
  }

  function refreshMeta(meta){
    const fill = (sel, arr)=>{
      sel.innerHTML = "";
      const empty = document.createElement("option");
      empty.value=""; empty.textContent="—";
      sel.appendChild(empty);
      (arr||[]).forEach(v=>{
        const opt=document.createElement("option");
        opt.value=v; opt.textContent=v;
        sel.appendChild(opt);
      });
    };
    fill($("p_prefix"), meta.prefixes||[]);
    fill($("p_brand"), meta.brands||[]);
    fill($("p_unit"), meta.units||[]);
  }

  function isFilterPrefix(prefix){
    const p = String(prefix||"").trim().toLowerCase();
    return p.startsWith("lọc") || p.startsWith("loc");
  }

  function toggleKeyFields(){
    const prefix = $("p_prefix").value || "";
    const isLoc = isFilterPrefix(prefix);
    $("rowSKU").style.display = isLoc ? "none" : "";
    $("rowOEM").style.display = isLoc ? "" : "none";
    $("rowOEMR").style.display = isLoc ? "" : "none";
  }

  function clearForm(){
    $("p_name").value="";
    $("p_prefix").value="";
    $("p_brand").value="";
    $("p_unit").value="";
    $("p_qty").value="0";
    $("p_price").value="0";
    $("p_note").value="";
    $("p_sku").value="";
    $("p_oem").value="";
    $("p_oem_replace").value="";
    $("p_image").value="";
    $("p_image_preview").src="https://via.placeholder.com/900x600?text=Image";
    toggleKeyFields();
  }

  function fillFormFromProduct(p){
    $("p_name").value = p.product_name || "";
    $("p_prefix").value = p.prefix || "";
    $("p_brand").value = p.brand || "";
    $("p_unit").value = p.unit || "";
    $("p_qty").value = Number(p.qty||0);
    $("p_price").value = Number(p.price||0);
    $("p_note").value = p.note || "";
    $("p_sku").value = p.sku || "";
    $("p_oem").value = p.oem || "";
    $("p_oem_replace").value = p.oem_replace || "";
    $("p_image_preview").src = p.image_url || "https://via.placeholder.com/900x600?text=No+Image";
    toggleKeyFields();
  }

  async function uploadSelectedImageIfAny(){
    const fi = $("p_image");
    const file = fi.files && fi.files[0];
    if (!file) return null;

    const base64 = await new Promise((resolve,reject)=>{
      const r = new FileReader();
      r.onload = ()=>{
        const s = String(r.result||"");
        resolve(s.includes(",") ? s.split(",")[1] : s);
      };
      r.onerror = reject;
      r.readAsDataURL(file);
    });

    const res = await window.AppApi("uploadImage", {
      filename: file.name,
      mimeType: file.type || "image/jpeg",
      base64
    });
    return { image_id: res.image_id, image_url: res.image_url };
  }

  async function saveProduct(){
    const prefix = $("p_prefix").value || "";
    const isLoc = isFilterPrefix(prefix);

    const product = {
      product_name: ($("p_name").value||"").trim(),
      prefix,
      brand: $("p_brand").value || "",
      unit: $("p_unit").value || "",
      qty: Number($("p_qty").value||0),
      price: Number($("p_price").value||0),
      note: $("p_note").value || "",
      sku: ($("p_sku").value||"").trim(),
      oem: ($("p_oem").value||"").trim(),
      oem_replace: ($("p_oem_replace").value||"").trim(),
    };

    if (!product.product_name) return window.AppToast("Thiếu tên sản phẩm", "error");
    if (!product.prefix) return window.AppToast("Thiếu prefix", "error");

    if (isLoc) {
      if (!product.oem) return window.AppToast("Sản phẩm LỌC bắt buộc nhập OEM", "error");
    } else {
      if (!product.sku) return window.AppToast("Sản phẩm không phải LỌC bắt buộc nhập SKU", "error");
    }

    try{
      window.AppToast("Đang lưu...");
      const uploaded = await uploadSelectedImageIfAny();
      if (uploaded){
        product.image_id = uploaded.image_id;
        product.image_url = uploaded.image_url;
        $("p_image_preview").src = uploaded.image_url;
      }

      // Nếu đang sửa thì gửi product_key để backend tìm đúng dòng
      const editingKey = window.AppState.editingKey;
      if (editingKey) product.product_key = editingKey;

      const res = await window.AppApi("upsertProduct", { product });
      window.AppToast(res.message || "Đã lưu ✅");
      closeModal();
      window.AppState.editingKey = null;
      await window.AppReloadAll();
    }catch(e){
      window.AppToast(e.message, "error");
    }
  }

  async function deleteProduct(){
    const key = window.AppState.editingKey;
    if (!key) return;
    if (!confirm("Xóa sản phẩm này?")) return;
    try{
      const res = await window.AppApi("deleteProduct", { product_key: key });
      window.AppToast(res.message || "Đã xóa ✅");
      closeModal();
      window.AppState.editingKey = null;
      await window.AppReloadAll();
    }catch(e){
      window.AppToast(e.message, "error");
    }
  }

  function openCreate(){
    window.AppState.editingKey = null;
    $("productModalTitle").textContent = "Thêm sản phẩm";
    $("detailsBox").style.display = "none";
    setModeEdit_(true);
    clearForm();
    refreshMeta(window.AppState.meta);
    openModal();
  }

  function openEdit(product_key){
    const p = window.AppState.products.find(x=> x.product_key === product_key);
    if (!p) return window.AppToast("Không tìm thấy sản phẩm", "error");

    window.AppState.editingKey = product_key;
    $("productModalTitle").textContent = "Sửa sản phẩm";
    $("detailsBox").style.display = "none";
    setModeEdit_(true);

    refreshMeta(window.AppState.meta);
    clearForm();
    fillFormFromProduct(p);
    openModal();
  }

  function openDetails(product_key){
    const p = window.AppState.products.find(x=> x.product_key === product_key);
    if (!p) return window.AppToast("Không tìm thấy sản phẩm", "error");

    window.AppState.editingKey = product_key;
    $("productModalTitle").textContent = "Chi tiết sản phẩm";
    setModeEdit_(false);

    refreshMeta(window.AppState.meta);
    clearForm();
    fillFormFromProduct(p);

    // show details box
    $("detailsBox").style.display = "";
    $("detailKeyTag").textContent = (isFilterPrefix(p.prefix) ? `OEM: ${p.oem||"—"}` : `SKU: ${p.sku||"—"}`);

    $("d_name").textContent = p.product_name || "—";
    $("d_prefix").textContent = p.prefix || "—";
    $("d_brand").textContent = p.brand || "—";
    $("d_unit").textContent = p.unit || "—";
    $("d_qty").textContent = String(Number(p.qty||0));
    $("d_price").textContent = String(Number(p.price||0).toLocaleString("vi-VN"));
    $("d_sku").textContent = p.sku || "—";
    $("d_oem").textContent = p.oem || "—";
    $("d_replace").textContent = p.oem_replace || "—"; // đây là “thay thế” như bạn yêu cầu
    $("d_note").textContent = p.note || "—";

    openModal();
  }

  function wire(){
    $("btnCloseProductModal").addEventListener("click", closeModal);
    $("productModalBackdrop").addEventListener("click",(e)=>{
      if (e.target.id==="productModalBackdrop") closeModal();
    });
    $("btnSaveProduct").addEventListener("click", saveProduct);
    $("btnDeleteProduct").addEventListener("click", deleteProduct);

    $("p_prefix").addEventListener("change", toggleKeyFields);

    $("p_image").addEventListener("change", ()=>{
      const file = $("p_image").files && $("p_image").files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      $("p_image_preview").src = url;
    });
  }

  window.ProductUI = { openCreate, openEdit, openDetails, refreshMeta };
  window.addEventListener("DOMContentLoaded", wire);
})();
