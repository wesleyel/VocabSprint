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

const els = {
  prev: document.getElementById("prev"),
  next: document.getElementById("next"),
  word: document.getElementById("word"),
  meaning: document.getElementById("meaning"),
  stats: document.getElementById("stats"),
  autoAudio: document.getElementById("autoAudio"),
  audioTip: document.getElementById("audioTip"),
  badgePrev: document.getElementById("badgePrev"),
  badgeCur: document.getElementById("badgeCur"),
  badgeNext: document.getElementById("badgeNext"),
  prevMeta: document.getElementById("prevMeta"),
  curMeta: document.getElementById("curMeta"),
  nextMeta: document.getElementById("nextMeta"),
  filter: document.getElementById("filter"),
  exportBtn: document.getElementById("exportBtn"),
  exportModal: document.getElementById("exportModal"),
  exportClose: document.getElementById("exportClose"),
  exportMode: document.getElementById("exportMode"),
  exportText: document.getElementById("exportText"),
  exportDownload: document.getElementById("exportDownload"),
};

const items = await apiGetWords();

function getFilter() {
  try {
    return localStorage.getItem("cardFilter") ?? "all";
  } catch {
    return "all";
  }
}

function setFilter(v) {
  try {
    localStorage.setItem("cardFilter", v);
  } catch {
    // ignore
  }
}

function applyFilterIndices(mode) {
  const indices = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (mode === "mastered" && !it.mastered) continue;
    if (mode === "unknown" && it.mastered) continue;
    if (mode === "vocab" && !it.vocab) continue;
    indices.push(i);
  }
  return indices;
}

function isExportModalOpen() {
  return Boolean(els.exportModal && !els.exportModal.hasAttribute("hidden"));
}

function getExportModeValue() {
  const v = els.exportMode?.value;
  if (v === "vocab" || v === "mastered") return v;
  return "vocab";
}

function buildExportText(mode) {
  const list = [];
  for (const it of items) {
    if (mode === "vocab" && !it.vocab) continue;
    if (mode === "mastered" && !it.mastered) continue;
    const w = String(it.word ?? "").trim();
    if (w) list.push(w);
  }
  return list.join("\n");
}

function refreshExportText() {
  if (!els.exportText) return;
  els.exportText.value = buildExportText(getExportModeValue());
}

function openExportModal() {
  if (!els.exportModal) return;
  if (els.exportMode) {
    els.exportMode.value = (filterMode === "vocab" || filterMode === "mastered") ? filterMode : "vocab";
  }
  refreshExportText();
  els.exportModal.removeAttribute("hidden");
  els.exportText?.focus();
  els.exportText?.select?.();
}

function closeExportModal() {
  if (!els.exportModal) return;
  els.exportModal.setAttribute("hidden", "");
  els.exportBtn?.focus?.();
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

let filterMode = getFilter();
let visibleIndices = applyFilterIndices(filterMode);

function getVisiblePosForIndex(idx) {
  const pos = visibleIndices.indexOf(idx);
  return pos >= 0 ? pos : 0;
}

const session = {
  startAt: new Date(),
  markedCount: 0,
};

function formatTime(d) {
  return d.toLocaleTimeString("zh-CN", { hour12: false });
}

function getMasteredCount() {
  let count = 0;
  for (const it of items) if (it.mastered) count++;
  return count;
}

function renderStats() {
  const masteredCount = getMasteredCount();
  const total = items.length;
  const pct = total > 0 ? Math.round((masteredCount / total) * 1000) / 10 : 0;
  els.stats.textContent = `开始时间：${formatTime(session.startAt)}  ｜  本次标记：${session.markedCount}  ｜  已掌握：${masteredCount}/${total}（${pct}%）`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function getIndexFromUrl() {
  const url = new URL(location.href);
  const raw = url.searchParams.get("i");
  const idx = raw ? Number(raw) : 0;
  if (!Number.isFinite(idx)) return 0;
  return clamp(Math.trunc(idx), 0, items.length - 1);
}

function setIndexToUrl(i) {
  const url = new URL(location.href);
  url.searchParams.set("i", String(i));
  history.replaceState(null, "", url.toString());
}

let index = getIndexFromUrl();
let visiblePos = getVisiblePosForIndex(index);

function playSwapAnimation(direction) {
  // direction: -1 (prev) or +1 (next)
  const host = els.word?.parentElement;
  if (!host) return;
  host.classList.add("animSwap");
  const dy = direction < 0 ? -18 : 18;
  host.animate(
    [
      { opacity: 0.0, transform: `translateY(${dy}px)` },
      { opacity: 1.0, transform: "translateY(0px)" },
    ],
    { duration: 180, easing: "ease-out" },
  );
}

const audio = new Audio();
audio.preload = "none";
let audioUnlocked = false;

function getAutoAudio() {
  try {
    return localStorage.getItem("autoAudio") === "1";
  } catch {
    return false;
  }
}

function setAutoAudio(v) {
  try {
    localStorage.setItem("autoAudio", v ? "1" : "0");
  } catch {
    // ignore
  }
}

async function speak(word) {
  if (!word) return;
  const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`;
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch {
    // ignore
  }
  audio.src = url;
  await audio.play();
}

function unlockAudioOnce() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  if (els.audioTip) els.audioTip.textContent = "";
}

function setBadge(el, item) {
  if (!el) return;
  if (!item) {
    el.textContent = "";
    el.classList.remove("show", "mastered", "unknown");
    return;
  }
  const mastered = Boolean(item.mastered);
  const prefix = item.vocab ? "生词 · " : "";
  el.textContent = `${prefix}${mastered ? "已掌握" : "未掌握"}`;
  el.classList.toggle("show", true);
  el.classList.toggle("mastered", mastered);
  el.classList.toggle("unknown", !mastered);
}

function setPanelStateFromItem(badgeEl, item) {
  const panel = badgeEl?.parentElement;
  if (!panel) return;
  panel.classList.remove("state-mastered", "state-unknown");
  if (!item) return;
  panel.classList.add(item.mastered ? "state-mastered" : "state-unknown");
}

function setMeta(el, item) {
  if (!el) return;
  if (!item) {
    el.textContent = "";
    return;
  }
  const other = item.other ? String(item.other) : "—";
  const freq = item.freq != null ? String(item.freq) : "—";
  el.innerHTML = `词频 ${freq}<span class="sep">·</span>其他拼写 ${escapeHtml(other)}`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function render(direction = 1) {
  // ensure visible indices up to date
  visibleIndices = applyFilterIndices(filterMode);
  if (visibleIndices.length === 0) {
    els.prev.textContent = "—";
    els.next.textContent = "—";
    els.word.textContent = "—";
    els.meaning.textContent = "";
    setBadge(els.badgePrev, null);
    setBadge(els.badgeCur, null);
    setBadge(els.badgeNext, null);
    setMeta(els.prevMeta, null);
    setMeta(els.curMeta, null);
    setMeta(els.nextMeta, null);
    renderStats();
    return;
  }

  // keep index within visible list
  visiblePos = clamp(visiblePos, 0, visibleIndices.length - 1);
  index = visibleIndices[visiblePos];

  const current = items[index];
  const prev = visiblePos > 0 ? items[visibleIndices[visiblePos - 1]] : null;
  const next = visiblePos < visibleIndices.length - 1 ? items[visibleIndices[visiblePos + 1]] : null;

  els.prev.textContent = prev ? prev.word : "—";
  els.next.textContent = next ? next.word : "—";

  els.word.textContent = current.word;
  els.meaning.textContent = current.meaning ?? "";

  setBadge(els.badgePrev, prev);
  setBadge(els.badgeCur, current);
  setBadge(els.badgeNext, next);

  setPanelStateFromItem(els.badgePrev, prev);
  setPanelStateFromItem(els.badgeCur, current);
  setPanelStateFromItem(els.badgeNext, next);

  setMeta(els.prevMeta, prev);
  setMeta(els.curMeta, current);
  setMeta(els.nextMeta, next);

  setIndexToUrl(index);
  renderStats();
  playSwapAnimation(direction);

  if (getAutoAudio()) {
    if (!audioUnlocked) {
      if (els.audioTip) {
        els.audioTip.textContent = "提示：浏览器可能需要一次键盘/点击后才能自动播放";
      }
    } else {
      speak(current.word).catch(() => {
        if (els.audioTip) els.audioTip.textContent = "音频播放失败（可能被浏览器拦截）";
      });
    }
  }
}

async function mark(mastered) {
  const current = items[index];
  const before = Boolean(current.mastered);
  current.mastered = mastered;
  render(1);
  try {
    await apiSetMastered(current.id, mastered);
    if (before !== mastered) session.markedCount += 1;
    renderStats();
    // auto go next after a successful mark
    if (visiblePos < visibleIndices.length - 1) go(1);
  } catch (_e) {
    // rollback
    current.mastered = !mastered;
    render(1);
    // silent
  }
}

function go(delta) {
  if (visibleIndices.length === 0) return;
  visiblePos = clamp(visiblePos + delta, 0, visibleIndices.length - 1);
  render(delta);
}

async function toggleVocab() {
  const current = items[index];
  if (!current) return;
  const before = Boolean(current.vocab);
  current.vocab = !before;
  render(1);
  try {
    await apiSetVocab(current.id, current.vocab);
    // if filter is vocab and we removed it, move to next available
    if (filterMode === "vocab" && before === true && current.vocab === false) {
      visibleIndices = applyFilterIndices(filterMode);
      visiblePos = clamp(visiblePos, 0, Math.max(0, visibleIndices.length - 1));
      render(1);
    }
  } catch (_e) {
    current.vocab = before;
    render(1);
    // silent
  }
}

function jumpToNearestUnmastered(direction) {
  // direction: -1 (prev) or +1 (next)
  if (!Number.isFinite(direction) || direction === 0) return;
  if (visibleIndices.length === 0) return;
  const step = direction < 0 ? -1 : 1;

  const findInVisible = () => {
    // Ensure visible indices are current.
    visibleIndices = applyFilterIndices(filterMode);
    if (visibleIndices.length === 0) return -1;

    // Keep visiblePos in range.
    visiblePos = clamp(visiblePos, 0, visibleIndices.length - 1);

    for (let p = visiblePos + step; p >= 0 && p < visibleIndices.length; p += step) {
      const idx = visibleIndices[p];
      const it = items[idx];
      if (it && !it.mastered) return p;
    }
    return -1;
  };

  let targetPos = findInVisible();

  // If current filter has no reachable unknown, fall back to 'all'.
  if (targetPos < 0 && filterMode !== "all") {
    const fromIdx = index;
    filterMode = "all";
    setFilter(filterMode);
    if (els.filter) els.filter.value = filterMode;
    visibleIndices = applyFilterIndices(filterMode);
    // Preserve current item position when switching filter.
    visiblePos = Math.max(0, visibleIndices.indexOf(fromIdx));
    targetPos = findInVisible();
  }

  if (targetPos < 0) return; // silent

  visiblePos = targetPos;
  render(step);
}

if (els.autoAudio) {
  els.autoAudio.checked = getAutoAudio();
  els.autoAudio.addEventListener("change", () => {
    setAutoAudio(Boolean(els.autoAudio.checked));
    renderStats();
  });
}

if (els.filter) {
  els.filter.value = filterMode;
  els.filter.addEventListener("change", () => {
    filterMode = els.filter.value;
    setFilter(filterMode);
    visibleIndices = applyFilterIndices(filterMode);
    visiblePos = 0;
    render(1);
  });
}

if (els.exportBtn) els.exportBtn.addEventListener("click", openExportModal);
if (els.exportClose) els.exportClose.addEventListener("click", closeExportModal);
if (els.exportMode) els.exportMode.addEventListener("change", refreshExportText);
if (els.exportDownload) els.exportDownload.addEventListener("click", downloadExportTxt);

globalThis.addEventListener(
  "keydown",
  (e) => {
  if (isExportModalOpen()) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeExportModal();
    }
    return;
  }

  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT")) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  unlockAudioOnce();
  const key = e.key.toLowerCase();
  if (key === "a" || key === "w") go(-1);
  if (key === "d" || key === "s") go(1);
  if (key === "q") {
    e.preventDefault();
    e.stopPropagation();
    jumpToNearestUnmastered(-1);
  }
  if (key === "e") {
    e.preventDefault();
    e.stopPropagation();
    jumpToNearestUnmastered(1);
  }
  if (key === "j") mark(true);
  if (key === "k") mark(false);
  if (key === "l") toggleVocab();
  },
  { capture: true },
);

globalThis.addEventListener("pointerdown", () => unlockAudioOnce(), { once: true });

render(1);
