async function apiGetWords() {
  const res = await fetch("/api/words");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? "API error");
  return data.items;
}

async function apiSetMastered(id, mastered) {
  const res = await fetch("/api/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, mastered }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? "API error");
}

async function apiSetVocab(id, vocab) {
  const res = await fetch("/api/vocab", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, vocab }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? "API error");
}

function setRowStyle(tr, mastered) {
  tr.classList.toggle("mastered", mastered);
  tr.classList.toggle("unknown", !mastered);
}

const statusEl = document.getElementById("status");
const tbody = document.getElementById("tbody");
const filterEl = document.getElementById("filter");

const exportEls = {
  btn: document.getElementById("exportBtn"),
  modal: document.getElementById("exportModal"),
  close: document.getElementById("exportClose"),
  mode: document.getElementById("exportMode"),
  text: document.getElementById("exportText"),
  download: document.getElementById("exportDownload"),
};

const itemsAll = await apiGetWords();
statusEl.textContent = `共 ${itemsAll.length} 个单词`;

let currentIndex = 0;
let rowRefs = [];
let checkboxRefs = [];
let items = [];

function getFilter() {
  try {
    return localStorage.getItem("tableFilter") ?? "all";
  } catch {
    return "all";
  }
}

function setFilter(v) {
  try {
    localStorage.setItem("tableFilter", v);
  } catch {
    // ignore
  }
}

function applyFilter(list, mode) {
  if (mode === "mastered") return list.filter((it) => Boolean(it.mastered));
  if (mode === "unknown") return list.filter((it) => !it.mastered);
  if (mode === "vocab") return list.filter((it) => Boolean(it.vocab));
  return list;
}

function isExportModalOpen() {
  return Boolean(exportEls.modal && !exportEls.modal.hasAttribute("hidden"));
}

function getExportModeValue() {
  const v = exportEls.mode?.value;
  if (v === "vocab" || v === "mastered") return v;
  return "vocab";
}

function buildExportText(mode) {
  const filtered = applyFilter(itemsAll, mode);
  return filtered.map((it) => String(it.word ?? "").trim()).filter(Boolean).join("\n");
}

function refreshExportText() {
  if (!exportEls.text) return;
  exportEls.text.value = buildExportText(getExportModeValue());
}

function openExportModal() {
  if (!exportEls.modal) return;
  const cur = filterEl?.value;
  if (exportEls.mode) {
    exportEls.mode.value = (cur === "vocab" || cur === "mastered") ? cur : "vocab";
  }
  refreshExportText();
  exportEls.modal.removeAttribute("hidden");
  exportEls.text?.focus();
  exportEls.text?.select?.();
}

function closeExportModal() {
  if (!exportEls.modal) return;
  exportEls.modal.setAttribute("hidden", "");
  exportEls.btn?.focus?.();
}

function downloadExportTxt() {
  const mode = getExportModeValue();
  const content = buildExportText(mode);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = mode === "vocab" ? "vocab.txt" : "mastered.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function focusIndex(i, opts = { scroll: true, block: "nearest" }) {
  if (checkboxRefs.length === 0) return;
  currentIndex = clamp(i, 0, checkboxRefs.length - 1);
  const cb = checkboxRefs[currentIndex];
  if (!cb) return;
  cb.focus({ preventScroll: true });
  if (opts.scroll) cb.scrollIntoView({ block: opts.block ?? "nearest" });
}

async function setMasteredAtIndex(i, mastered) {
  const tr = rowRefs[i];
  const cb = checkboxRefs[i];
  const item = items[i];
  if (!tr || !cb || !item) return;

  const before = Boolean(cb.checked);
  if (before === mastered) {
    focusIndex(i, { scroll: false });
    return;
  }

  cb.checked = mastered;
  setRowStyle(tr, mastered);
  focusIndex(i, { scroll: false });

  try {
    await apiSetMastered(item.id, mastered);
  } catch (e) {
    cb.checked = before;
    setRowStyle(tr, before);
    focusIndex(i, { scroll: false });
    alert(String(e));
  }
}

async function setVocabAtIndex(i, vocab) {
  const item = items[i];
  if (!item) return;
  const before = Boolean(item.vocab);
  if (before === vocab) {
    focusIndex(i, { scroll: false });
    return;
  }

  item.vocab = vocab;
  focusIndex(i, { scroll: false });
  try {
    await apiSetVocab(item.id, vocab);
  } catch (e) {
    item.vocab = before;
    focusIndex(i, { scroll: false });
    alert(String(e));
  }
}

function renderTable() {
  const mode = filterEl?.value ?? "all";
  items = applyFilter(itemsAll, mode);

  rowRefs = [];
  checkboxRefs = [];
  tbody.textContent = "";

  const fragment = document.createDocumentFragment();
  for (const item of items) {
    const tr = document.createElement("tr");
    setRowStyle(tr, item.mastered);

    const tdCheck = document.createElement("td");
    tdCheck.className = "checkboxCell";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(item.mastered);
    checkbox.addEventListener("change", async () => {
      const next = checkbox.checked;
      setRowStyle(tr, next);
      try {
        await apiSetMastered(item.id, next);
        item.mastered = next;
      } catch (e) {
        // rollback
        checkbox.checked = !next;
        setRowStyle(tr, !next);
        alert(String(e));
      }
    });

    checkbox.addEventListener("focus", () => {
      const idx = checkboxRefs.indexOf(checkbox);
      if (idx >= 0) currentIndex = idx;
    });
    tdCheck.appendChild(checkbox);

    const tdId = document.createElement("td");
    tdId.textContent = String(item.rank);

    const tdWord = document.createElement("td");
    const link = document.createElement("a");
    link.href = `/card?i=${encodeURIComponent(item.rank - 1)}`;
    link.textContent = item.word;
    link.style.color = "inherit";
    link.style.textDecoration = "underline";
    tdWord.appendChild(link);

    const tdMeaning = document.createElement("td");
    tdMeaning.textContent = item.meaning;

    const tdFreq = document.createElement("td");
    tdFreq.textContent = String(item.freq);

    // keep columns consistent with existing table header
    tr.append(tdCheck, tdId, tdWord, tdMeaning, tdFreq);
    rowRefs.push(tr);
    checkboxRefs.push(checkbox);
    fragment.appendChild(tr);
  }

  tbody.appendChild(fragment);
  statusEl.textContent = `共 ${itemsAll.length} 个单词，当前显示 ${items.length} 个`;

  if (items.length > 0) {
    currentIndex = clamp(currentIndex, 0, items.length - 1);
    focusIndex(currentIndex, { scroll: false });
  }
}

if (filterEl) {
  const initial = getFilter();
  filterEl.value = initial;
  filterEl.addEventListener("change", () => {
    setFilter(filterEl.value);
    currentIndex = 0;
    renderTable();
  });
}

if (exportEls.btn) exportEls.btn.addEventListener("click", openExportModal);
if (exportEls.close) exportEls.close.addEventListener("click", closeExportModal);
if (exportEls.mode) exportEls.mode.addEventListener("change", refreshExportText);
if (exportEls.download) exportEls.download.addEventListener("click", downloadExportTxt);

renderTable();

globalThis.addEventListener("keydown", async (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;

  if (isExportModalOpen()) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeExportModal();
    }
    return;
  }

  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
    return;
  }

  // Only handle when focus is inside the table page and preferably on checkboxes.
  const key = e.key.toLowerCase();
  const isNav = key === "w" || key === "s" || key === "a" || key === "d";
  const isMark = key === "j" || key === "k";
  const isVocab = key === "l";
  if (!isNav && !isMark && !isVocab) return;

  // Prevent page scroll on W/S
  e.preventDefault();

  if (isNav) {
    // "typewriter" mode: A/D moves and centers next row
    const block = (key === "a" || key === "d") ? "center" : "nearest";
    if (key === "w" || key === "a") focusIndex(currentIndex - 1, { scroll: true, block });
    if (key === "s" || key === "d") focusIndex(currentIndex + 1, { scroll: true, block });
    return;
  }

  // J/K: mark mastered/unknown on current row
  if (key === "j") await setMasteredAtIndex(currentIndex, true);
  if (key === "k") await setMasteredAtIndex(currentIndex, false);

  // L: toggle vocab book
  if (key === "l") {
    const item = items[currentIndex];
    if (!item) return;
    await setVocabAtIndex(currentIndex, !item.vocab);
    // If current filter is vocab and we removed it, re-render and keep position
    if ((filterEl?.value ?? "all") === "vocab" && !item.vocab) {
      const keep = clamp(currentIndex, 0, Math.max(0, items.length - 2));
      currentIndex = keep;
      renderTable();
    }
  }
});
