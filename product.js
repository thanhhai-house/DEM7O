(function () {
  const $ = (id) => document.getElementById(id);

  function openModal() {
    $("productModalBackdrop").classList.add("show");
  }
  function closeModal() {
    $("productModalBackdrop").classList.remove("show");
  }

  function clearForm() {
    $("p_id").value = "";
    $("p_name").value = "";
    $("p_qty").value = "0";
    $("p_price").value = "0";
    $("p_note").value = "";
    $("p_image").value = "";
    $("p_image_preview").src = "https://via.placeholder.com/220?text=Image";
  }

  function refreshMeta(meta) {
    const fill = (sel, arr) => {
      sel.innerHTML = "";
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "—";
      sel.appendChild(empty);
      arr.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        sel.appendChild(opt);
      });
    };
    fill($("p_prefix"), meta.prefixes || []);
    fill($("p_brand"), meta.brands || []);
    fill($("p_unit"), meta.units || []);
  }

  function setEditing(product) {
    $("productModalTitle").textContent = product ? "Sửa sản phẩm" : "Thêm sản phẩm";
    $("btnDeleteProduct").style.display = product ? "" : "none";

    if (!product) return;

    $("p_id").value = product.product_id;
    $("p_name").value = product.product_name;
    $("p_prefix").value = product.prefix || "";
    $("p_brand").value = product.brand || "";
    $("p_unit").value = product.unit || "";
    $("p_qty").value = Number(product.qty || 0);
    $("p_price").value = Number(product.price || 0);
    $("p_note").value = product.note || "";

    const img = product.image_url || "";
    $("p_image_preview").src = img || "https://via.placeholder.com/220?text=Image";
    $("p_image_preview").onerror = function () {
      this.onerror = null;
      this.src = "https://via.placeholder.com/220?text=No+Image";
    };
  }

  async function uploadSelectedImageIfAny() {
    const fileInput = $("p_image");
    const file = fileInput.files && fileInput.files[0];
    if (!file) return null;

    // convert to base64 (raw)
    const base64 = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result || "");
        const raw = s.includes(",") ? s.split(",")[1] : s;
        resolve(raw);
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

  async function saveProduct() {
    const state = window.AppState;
    const editingId = state.editingProductId;

    const product_id = $("p_id").value.trim();
    const product_name = $("p_name").value.trim();
    const prefix = $("p_prefix").value;
    const brand = $("p_brand").value;
    const unit = $("p_unit").value;
    const qty = Number($("p_qty").value || 0);
    const price = Number($("p_price").value || 0);
    const note = $("p_note").value || "";

    if (!product_id) return window.AppToast("Thiếu mã sản phẩm", "error");
    if (!product_name) return window.AppToast("Thiếu tên sản phẩm", "error");

    try {
      window.AppToast("Đang lưu...");
      // upload image (optional)
      const uploaded = await uploadSelectedImageIfAny();
      if (uploaded) {
        $("p_image_preview").src = uploaded.image_url;
      }

      const payload = {
        product: {
          product_id,
          product_name,
          prefix,
          brand,
          unit,
          qty,
          price,
          note,
          image_id: uploaded?.image_id,
          image_url: uploaded?.image_url,
        }
      };

      const res = await window.AppApi("upsertProduct", payload);
      window.AppToast(res.message || "Đã lưu ✅");
      closeModal();
      state.editingProductId = null;
      await window.AppReloadAll();
    } catch (e) {
      window.AppToast(e.message, "error");
    }
  }

  async function deleteProduct() {
    const state = window.AppState;
    const editingId = state.editingProductId;
    if (!editingId) return;
    if (!confirm(`Xóa sản phẩm ${editingId}?`)) return;
    try {
      const res = await window.AppApi("deleteProduct", { product_id: editingId });
      window.AppToast(res.message || "Đã xóa ✅");
      closeModal();
      state.editingProductId = null;
      await window.AppReloadAll();
    } catch (e) {
      window.AppToast(e.message, "error");
    }
  }

  function openCreate() {
    const state = window.AppState;
    state.editingProductId = null;
    clearForm();
    setEditing(null);
    refreshMeta(state.meta);
    $("p_id").disabled = false;
    openModal();
  }

  function openEdit(product_id) {
    const state = window.AppState;
    const p = state.products.find(x => x.product_id === product_id);
    if (!p) return window.AppToast("Không tìm thấy sản phẩm", "error");

    state.editingProductId = product_id;
    clearForm();
    refreshMeta(state.meta);
    setEditing(p);
    $("p_id").disabled = true; // không đổi mã khi edit
    openModal();
  }

  function openDetails(product_id) {
    const state = window.AppState;
    const p = state.products.find(x => x.product_id === product_id);
    if (!p) return window.AppToast("Không tìm thấy sản phẩm", "error");

    const img = p.image_url || "";
    alert(
      `Mã: ${p.product_id}\nTên: ${p.product_name}\nPrefix: ${p.prefix || ""}\nBrand: ${p.brand || ""}\nUnit: ${p.unit || ""}\nTồn: ${p.qty}\nGiá: ${p.price}\nẢnh: ${img}`
    );
  }

  function wire() {
    $("btnCloseProductModal").addEventListener("click", closeModal);
    $("productModalBackdrop").addEventListener("click", (e) => {
      if (e.target.id === "productModalBackdrop") closeModal();
    });
    $("btnSaveProduct").addEventListener("click", saveProduct);
    $("btnDeleteProduct").addEventListener("click", deleteProduct);

    $("p_image").addEventListener("change", () => {
      const file = $("p_image").files && $("p_image").files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      $("p_image_preview").src = url;
    });
  }

  window.ProductUI = {
    openCreate,
    openEdit,
    openDetails,
    refreshMeta
  };

  window.addEventListener("DOMContentLoaded", wire);
})();
