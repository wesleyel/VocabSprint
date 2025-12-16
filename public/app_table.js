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

function setRowStyle(tr, mastered) {
  tr.classList.toggle("mastered", mastered);
  tr.classList.toggle("unknown", !mastered);
}

const statusEl = document.getElementById("status");
const tbody = document.getElementById("tbody");

const items = await apiGetWords();
statusEl.textContent = `共 ${items.length} 个单词`;

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
    } catch (e) {
      // rollback
      checkbox.checked = !next;
      setRowStyle(tr, !next);
      alert(String(e));
    }
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

  tr.append(tdCheck, tdId, tdWord, tdMeaning, tdFreq);
  fragment.appendChild(tr);
}

tbody.appendChild(fragment);
