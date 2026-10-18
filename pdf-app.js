/* pdf-app.js —— PDF 工具箱前端 */
(function () {
  "use strict";
  var TB = createPdfToolbox({ PDFLib: window.PDFLib, JSZip: window.JSZip });
  var $ = function (id) { return document.getElementById(id); };

  function fmt(n) {
    var u = ["B", "KB", "MB", "GB"], i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (i === 0 ? n : n.toFixed(1)) + " " + u[i];
  }
  function log(box, msg, cls) {
    var d = document.createElement("div");
    if (cls) d.className = cls;
    d.textContent = msg;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
  }
  function clear(el) { el.innerHTML = ""; }
  function prog(box, r) {
    box.style.display = r == null ? "none" : "block";
    if (r != null) box.firstElementChild.style.width = Math.round(r * 100) + "%";
  }
  function download(name, data, type) {
    var blob = new Blob([data], { type: type || "application/pdf" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  function resultRow(box, name, size, data, type) {
    var row = document.createElement("div");
    row.className = "row";
    var nm = document.createElement("span"); nm.className = "nm"; nm.textContent = name;
    var sz = document.createElement("span"); sz.className = "sz"; sz.textContent = fmt(size);
    var a = document.createElement("a"); a.textContent = "下载";
    a.onclick = function () { download(name, data, type); };
    row.appendChild(nm); row.appendChild(sz); row.appendChild(a);
    box.appendChild(row);
  }
  function bigZip(box, files, zipName) {
    TB.constructor; // noop
    return window.JSZip ? (async function () {
      var zip = new JSZip();
      var used = {};
      files.forEach(function (f) {
        var name = f.name;
        if (used[name]) {
          var dot = name.lastIndexOf(".");
          var stem = dot > 0 ? name.slice(0, dot) : name;
          var ext = dot > 0 ? name.slice(dot) : "";
          var i = 2;
          while (used[stem + "_" + i + ext]) i++;
          name = stem + "_" + i + ext;
        }
        used[name] = 1;
        zip.file(name, f.data);
      });
      var buf = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
      var a = document.createElement("a");
      a.className = "bigdl";
      a.textContent = "打包下载 " + files.length + " 个文件（" + fmt(buf.byteLength) + "）";
      a.onclick = function () { download(zipName, buf, "application/zip"); };
      box.appendChild(a);
    })() : null;
  }
  function readBuf(f) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(new Error("读取失败")); };
      r.readAsArrayBuffer(f);
    });
  }

  // ===================== 文件选择器 =====================
  function picker(dropId, inputId, listId, multi) {
    var drop = $(dropId), input = $(inputId), list = $(listId);
    var files = [];
    function render() {
      clear(list);
      files.forEach(function (f, i) {
        var d = document.createElement("div");
        d.className = "fitem";
        var ord = document.createElement("span"); ord.className = "ord"; ord.textContent = i + 1;
        var nm = document.createElement("span"); nm.className = "nm"; nm.textContent = f.name;
        var sz = document.createElement("span"); sz.className = "sz"; sz.textContent = fmt(f.size);
        d.appendChild(ord); d.appendChild(nm); d.appendChild(sz);
        if (multi) {
          var up = document.createElement("span"); up.className = "mv"; up.textContent = i ? "↑" : "";
          up.onclick = function (e) {
            e.stopPropagation();
            if (i > 0) { var t = files[i - 1]; files[i - 1] = files[i]; files[i] = t; render(); }
          };
          d.appendChild(up);
        }
        var del = document.createElement("button"); del.textContent = "×";
        del.onclick = function (e) { e.stopPropagation(); files.splice(i, 1); render(); };
        d.appendChild(del);
        list.appendChild(d);
      });
    }
    function add(fl) {
      Array.prototype.forEach.call(fl, function (f) {
        if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") return;
        if (files.some(function (x) { return x.name === f.name && x.size === f.size; })) return;
        if (!multi) files = [];
        files.push(f);
      });
      render();
      if (typeof window.__onPick === "function") window.__onPick();
    }
    drop.onclick = function () { input.click(); };
    input.onchange = function () { add(input.files); input.value = ""; };
    ["dragover", "dragenter"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); });
    });
    drop.addEventListener("drop", function (e) { if (e.dataTransfer) add(e.dataTransfer.files); });
    return {
      get files() { return files; },
      get first() { return files[0]; },
      clear: function () { files = []; render(); },
    };
  }

  // ===================== 选项卡 =====================
  document.querySelector("nav").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    document.querySelectorAll("nav button").forEach(function (x) { x.classList.remove("on"); });
    document.querySelectorAll("section").forEach(function (x) { x.classList.remove("on"); });
    b.classList.add("on");
    $("s-" + b.dataset.t).classList.add("on");
  });

  // ===================== 分段按钮 =====================
  function seg(id, cb) {
    var box = $(id);
    box.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      box.querySelectorAll("button").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      cb(b.dataset.v);
    });
    return { get value() { return box.querySelector(".on").dataset.v; } };
  }

  // ===================== 1. 合并 =====================
  var mPick = picker("m-drop", "m-files", "m-list", true);
  $("m-run").onclick = async function () {
    var box = $("m-log"), res = $("m-res");
    clear(box); clear(res);
    if (mPick.files.length < 2) { log(box, "合并至少需要 2 个 PDF", "err"); return; }
    this.disabled = true; prog($("m-prog"), 0);
    try {
      var items = [];
      for (var i = 0; i < mPick.files.length; i++) {
        items.push({ name: mPick.files[i].name, data: await readBuf(mPick.files[i]) });
        prog($("m-prog"), (i + 1) / (mPick.files.length + 1));
      }
      var r = await TB.merge(items);
      r.skipped.forEach(function (s) { log(box, "✗ " + s.name + "：" + s.reason, "err"); });
      r.info.forEach(function (o) { log(box, "  " + o.name + "  " + o.count + " 页", null); });
      log(box, "", null);
      log(box, "合并完成：共 " + r.pages + " 页", "ok");
      resultRow(res, "合并结果.pdf", r.data.byteLength, r.data);
    } catch (e) { log(box, "✗ " + e.message, "err"); }
    this.disabled = false; prog($("m-prog"), null);
  };

  // ===================== 2. 拆分 =====================
  var sPick = picker("s-drop", "s-files", "s-list", false);
  var sMode = seg("s-mode", renderSplitArgs);
  function renderSplitArgs(v) {
    var box = $("s-args");
    clear(box);
    if (v === "chunk") {
      var l = document.createElement("label"); l.textContent = "每";
      var i = document.createElement("input"); i.type = "number"; i.id = "s-n"; i.value = 10; i.style.width = "70px";
      var l2 = document.createElement("label"); l2.textContent = "页一个文件";
      box.appendChild(l); box.appendChild(i); box.appendChild(l2);
    } else if (v === "range") {
      var l3 = document.createElement("label"); l3.textContent = "页码";
      var i2 = document.createElement("input"); i2.type = "text"; i2.id = "s-r";
      i2.placeholder = "如 1-3,5,8-10"; i2.style.flex = "1"; i2.style.minWidth = "140px";
      box.appendChild(l3); box.appendChild(i2);
    } else {
      var s = document.createElement("span");
      s.style.cssText = "font-size:12.5px;color:var(--ink3)";
      s.textContent = "每页拆成一个独立 PDF";
      box.appendChild(s);
    }
  }
  renderSplitArgs("each");
  $("s-files").addEventListener("change", updateSplitInfo);
  async function updateSplitInfo() {
    var f = sPick.first, info = $("s-info");
    if (!f) { info.textContent = ""; return; }
    try {
      var doc = await PDFLib.PDFDocument.load(await readBuf(f), { ignoreEncryption: true });
      info.textContent = "已选择：" + f.name + "，共 " + doc.getPageCount() + " 页";
    } catch (e) { info.textContent = "读取失败：" + e.message; }
  }
  $("s-run").onclick = async function () {
    var box = $("s-log"), res = $("s-res");
    clear(box); clear(res);
    var f = sPick.first;
    if (!f) { log(box, "请先选择 PDF", "err"); return; }
    this.disabled = true; prog($("s-prog"), 0);
    try {
      var data = await readBuf(f);
      var r = await TB.split({ name: f.name, data: data }, sMode.value, {
        pagesPerFile: +(($("s-n") || {}).value || 10),
        ranges: ($("s-r") || {}).value || "",
      });
      prog($("s-prog"), 0.85);
      r.results.forEach(function (x) { log(box, "  " + x.name + "  " + x.pages + " 页", null); });
      log(box, "", null);
      log(box, "拆分完成：" + r.results.length + " 个文件", "ok");
      if (r.results.length === 1) {
        resultRow(res, r.results[0].name, r.results[0].data.byteLength, r.results[0].data);
      } else {
        await bigZip(res, r.results, "PDF拆分结果.zip");
      }
    } catch (e) { log(box, "✗ " + e.message, "err"); }
    this.disabled = false; prog($("s-prog"), null);
  };

  // ===================== 3. 页面操作 =====================
  var pPick = picker("p-drop", "p-files", "p-list", false);
  $("p-files").addEventListener("change", async function () {
    var f = pPick.first, info = $("p-info");
    if (!f) { info.textContent = ""; return; }
    try {
      var doc = await PDFLib.PDFDocument.load(await readBuf(f), { ignoreEncryption: true });
      info.textContent = "已选择：" + f.name + "，共 " + doc.getPageCount() + " 页";
    } catch (e) { info.textContent = "读取失败：" + e.message; }
  });
  $("p-run").onclick = async function () {
    var box = $("p-log"), res = $("p-res");
    clear(box); clear(res);
    var f = pPick.first;
    if (!f) { log(box, "请先选择 PDF", "err"); return; }
    this.disabled = true; prog($("p-prog"), 0.3);
    try {
      var r = await TB.pageOps({ name: f.name, data: await readBuf(f) }, {
        removePages: $("p-del").value,
        rotate: +$("p-rot").value || 0,
        rotatePages: $("p-rotp").value,
        reverse: $("p-rev").checked,
      });
      prog($("p-prog"), 1);
      if (r.removed) log(box, "  删除 " + r.removed + " 页", null);
      log(box, "处理完成：共 " + r.pages + " 页", "ok");
      resultRow(res, f.name.replace(/\.[^.]+$/, "") + "_处理后.pdf", r.data.byteLength, r.data);
    } catch (e) { log(box, "✗ " + e.message, "err"); }
    this.disabled = false; prog($("p-prog"), null);
  };

  // ===================== 4. 水印 =====================
  var wPick = picker("w-drop", "w-files", "w-list", true);
  $("w-run").onclick = async function () {
    var box = $("w-log"), res = $("w-res");
    clear(box); clear(res);
    if (!wPick.files.length) { log(box, "请先选择 PDF", "err"); return; }
    var text = $("w-text").value.trim();
    if (!text) { log(box, "请填写水印文字", "err"); return; }
    if (/[\u4e00-\u9fa5]/.test(text)) {
      log(box, "✗ 网页版不支持中文水印（浏览器字体限制），请用英文或桌面版", "err");
      return;
    }
    this.disabled = true; prog($("w-prog"), 0);
    var outs = [];
    for (var i = 0; i < wPick.files.length; i++) {
      var f = wPick.files[i];
      try {
        var r = await TB.watermark({ name: f.name, data: await readBuf(f) }, {
          text: text, pos: $("w-pos").value,
          size: +$("w-size").value || 40,
          opacity: +$("w-op").value || 15,
          rotation: +$("w-rot").value || 0,
        });
        outs.push({ name: f.name.replace(/\.[^.]+$/, "") + "_水印.pdf", data: r.data });
        log(box, "✓ " + f.name + "  " + r.pages + " 页", "ok");
      } catch (e) { log(box, "✗ " + f.name + "：" + e.message, "err"); }
      prog($("w-prog"), (i + 1) / wPick.files.length);
    }
    if (outs.length === 1) resultRow(res, outs[0].name, outs[0].data.byteLength, outs[0].data);
    else if (outs.length > 1) await bigZip(res, outs, "PDF水印结果.zip");
    this.disabled = false; prog($("w-prog"), null);
  };

  // ===================== 5. 页面尺寸 =====================
  var zPick = picker("z-drop", "z-files", "z-list", true);
  $("z-target").onchange = function () {
    $("z-custom").style.display = this.value === "custom" ? "inline" : "none";
  };
  $("z-run").onclick = async function () {
    var box = $("z-log"), res = $("z-res");
    clear(box); clear(res);
    if (!zPick.files.length) { log(box, "请先选择 PDF", "err"); return; }
    this.disabled = true; prog($("z-prog"), 0);
    var outs = [];
    for (var i = 0; i < zPick.files.length; i++) {
      var f = zPick.files[i];
      try {
        var r = await TB.resizePages({ name: f.name, data: await readBuf(f) }, {
          target: $("z-target").value,
          w: +$("z-w").value || 595,
          h: +$("z-h").value || 842,
        });
        outs.push({ name: f.name.replace(/\.[^.]+$/, "") + "_" + $("z-target").value + ".pdf", data: r.data });
        log(box, "✓ " + f.name + "  → " + Math.round(r.size[0]) + "×" + Math.round(r.size[1]) + " pt", "ok");
      } catch (e) { log(box, "✗ " + f.name + "：" + e.message, "err"); }
      prog($("z-prog"), (i + 1) / zPick.files.length);
    }
    if (outs.length === 1) resultRow(res, outs[0].name, outs[0].data.byteLength, outs[0].data);
    else if (outs.length > 1) await bigZip(res, outs, "PDF尺寸统一.zip");
    this.disabled = false; prog($("z-prog"), null);
  };

  // ===================== 6. 查看信息 =====================
  var iPick = picker("i-drop", "i-files", "i-list", false);
  $("i-run").onclick = async function () {
    var box = $("i-log"), res = $("i-res");
    clear(box); clear(res);
    var f = iPick.first;
    if (!f) { log(box, "请先选择 PDF", "err"); return; }
    try {
      var txt = await TB.extractText({ name: f.name, data: await readBuf(f) });
      txt.split("\n").forEach(function (line) { log(box, line); });
    } catch (e) { log(box, "✗ " + e.message, "err"); }
  };
})();
