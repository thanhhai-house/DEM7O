(function(){
  const $ = (id)=> document.getElementById(id);

  async function addMeta(kind){
    const map = { prefix:$("newPrefix"), brand:$("newBrand"), unit:$("newUnit") };
    const input = map[kind];
    const value = (input.value||"").trim();
    if (!value) return window.AppToast("Nhập giá trị", "error");

    try{
      const res = await window.AppApi("addMeta", { kind, value });
      window.AppToast(res.message || "OK ✅");
      input.value="";
      await window.AppReloadAll();
    }catch(e){ window.AppToast(e.message, "error"); }
  }

  async function updatePrice(){
    const product_key = $("priceProductSelect").value;
    const price = Number($("newPrice").value||0);
    if (!product_key) return window.AppToast("Chọn sản phẩm", "error");

    try{
      const res = await window.AppApi("updatePrice", { product_key, price });
      window.AppToast(res.message || "Đã cập nhật giá ✅");
      $("newPrice").value="";
      await window.AppReloadAll();
    }catch(e){ window.AppToast(e.message, "error"); }
  }

  function wire(){
    $("btnAddPrefix").addEventListener("click", ()=> addMeta("prefix"));
    $("btnAddBrand").addEventListener("click", ()=> addMeta("brand"));
    $("btnAddUnit").addEventListener("click", ()=> addMeta("unit"));
    $("btnUpdatePrice").addEventListener("click", updatePrice);
  }

  window.addEventListener("DOMContentLoaded", wire);
})();
