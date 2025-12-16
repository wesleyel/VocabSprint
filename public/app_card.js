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

const els = {
  prev: document.getElementById("prev"),
  next: document.getElementById("next"),
  word: document.getElementById("word"),
  meaning: document.getElementById("meaning"),
  mastered: document.getElementById("mastered"),
  stats: document.getElementById("stats"),
  autoAudio: document.getElementById("autoAudio"),
  audioTip: document.getElementById("audioTip"),
};

const items = await apiGetWords();

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

function render(direction = 1) {
  const current = items[index];
  const prev = items[index - 1];
  const next = items[index + 1];

  els.prev.textContent = prev ? prev.word : "—";
  els.next.textContent = next ? next.word : "—";

  els.word.textContent = current.word;
  els.meaning.textContent = current.meaning ?? "";
  els.mastered.textContent = current.mastered ? "状态：已掌握" : "状态：未掌握";

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
    if (index < items.length - 1) go(1);
  } catch (e) {
    // rollback
    current.mastered = !mastered;
    render(1);
    alert(String(e));
  }
}

function go(delta) {
  index = clamp(index + delta, 0, items.length - 1);
  render(delta);
}

if (els.autoAudio) {
  els.autoAudio.checked = getAutoAudio();
  els.autoAudio.addEventListener("change", () => {
    setAutoAudio(Boolean(els.autoAudio.checked));
    renderStats();
  });
}

globalThis.addEventListener("keydown", (e) => {
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
  unlockAudioOnce();
  const key = e.key.toLowerCase();
  if (key === "a" || key === "w") go(-1);
  if (key === "d" || key === "s") go(1);
  if (key === "j") mark(true);
  if (key === "k") mark(false);
});

globalThis.addEventListener("pointerdown", () => unlockAudioOnce(), { once: true });

render(1);
