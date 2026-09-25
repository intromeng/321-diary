const STORAGE_KEY = "journal-321-entries-v1";

const moods = [
  { value: 1, label: "很低落", face: "😞" },
  { value: 2, label: "低落", face: "😕" },
  { value: 3, label: "一般", face: "😐" },
  { value: 4, label: "开心", face: "🙂" },
  { value: 5, label: "很开心", face: "😄" },
];

const fieldGroups = [
  { id: "gratitude", count: 3, placeholders: ["今天发生了什么好事？", "谁或什么给了你温暖？", "还有一件小确幸是……"] },
  { id: "improve", count: 2, placeholders: ["哪件事可以换一种做法？", "明天想试着改变什么？"] },
  { id: "affirmation", count: 1, placeholders: ["对今天的自己说一句……"] },
];

const form = document.querySelector("#diary-form");
const todayKey = toDateKey(new Date());
let entries = loadEntries();

document.querySelector("#today-date").textContent = formatFullDate(todayKey);
renderMoodOptions();
renderFields();
fillTodayEntry();
bindNavigation();
renderTrend();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearErrors();

  const formData = new FormData(form);
  const entry = {
    date: todayKey,
    mood: Number(formData.get("mood")),
    gratitude: readGroup(formData, "gratitude", 3),
    improve: readGroup(formData, "improve", 2),
    affirmation: readGroup(formData, "affirmation", 1),
    updatedAt: new Date().toISOString(),
  };

  const missing = validateEntry(entry);
  if (missing.length) {
    document.querySelector("#form-status").textContent = `还有 ${missing.length} 处没有填写，请补充后再保存。`;
    missing[0].focus();
    return;
  }

  persistEntry(entry);
  renderSuccess(entry);
  renderTrend();
  showView("success");
});

document.querySelector("#dialog-close").addEventListener("click", () => document.querySelector("#entry-dialog").close());

function renderMoodOptions() {
  document.querySelector("#mood-options").innerHTML = moods.map((mood) => `
    <label class="mood-option">
      <input type="radio" name="mood" value="${mood.value}" />
      <span class="mood-face"><strong>${mood.face}</strong><span>${mood.label}</span></span>
    </label>
  `).join("");
}

function renderFields() {
  fieldGroups.forEach((group) => {
    document.querySelector(`#${group.id}-fields`).innerHTML = group.placeholders.map((placeholder, index) => `
      <input class="text-field" name="${group.id}-${index}" maxlength="120" placeholder="${placeholder}" aria-label="${group.id} ${index + 1}" />
    `).join("");
  });
}

function fillTodayEntry() {
  const entry = entries.find((item) => item.date === todayKey);
  if (!entry) return;
  const mood = form.querySelector(`[name="mood"][value="${entry.mood}"]`);
  if (mood) mood.checked = true;
  fieldGroups.forEach((group) => {
    entry[group.id].forEach((value, index) => {
      form.elements[`${group.id}-${index}`].value = value;
    });
  });
  form.querySelector(".primary-button").textContent = "更新今天";
}

function readGroup(formData, id, count) {
  return Array.from({ length: count }, (_, index) => String(formData.get(`${id}-${index}`) || "").trim());
}

function validateEntry(entry) {
  const missing = [];
  if (!entry.mood) {
    document.querySelector("#mood-error").textContent = "请先选择今天的心情。";
    missing.push(form.querySelector('[name="mood"]'));
  }
  fieldGroups.forEach((group) => {
    entry[group.id].forEach((value, index) => {
      if (!value) {
        const input = form.elements[`${group.id}-${index}`];
        input.classList.add("has-error");
        input.setAttribute("aria-invalid", "true");
        missing.push(input);
      }
    });
  });
  return missing;
}

function clearErrors() {
  document.querySelector("#mood-error").textContent = "";
  document.querySelector("#form-status").textContent = "";
  form.querySelectorAll(".has-error").forEach((input) => {
    input.classList.remove("has-error");
    input.removeAttribute("aria-invalid");
  });
}

function bindNavigation() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });
}

function showView(name) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("is-active", view.id === `${name}-view`));
  document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("is-active", button.dataset.view === name || (name === "success" && button.dataset.view === "today")));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderSuccess(entry) {
  const mood = moods.find((item) => item.value === entry.mood);
  document.querySelector("#success-copy").textContent = entries.length === 1
    ? `这是第一颗心情点：${mood.label}。继续记录，变化会慢慢浮现。`
    : `今天是“${mood.label}”。下面是你最近几次记录留下的心情足迹。`;
  document.querySelector("#mini-trend").innerHTML = recentEntries().map((item) => `
    <span class="mini-point" style="--lift: ${item.mood * 8}px"><i></i><span>${shortDate(item.date)}</span></span>
  `).join("");
}

function renderTrend() {
  const recent = recentEntries();
  const chart = document.querySelector("#trend-chart");
  document.querySelector("#history-count").textContent = `${entries.length} 篇`;

  if (!recent.length) {
    chart.innerHTML = '<p class="chart-empty">写下第一篇日记后，心情会从这里开始留下轨迹。</p>';
    document.querySelector("#trend-summary").textContent = "还没有记录。今天可以成为起点。";
  } else {
    chart.innerHTML = recent.map((entry) => {
      const mood = moods.find((item) => item.value === entry.mood);
      return `<div class="chart-column ${entry.date === todayKey ? "today" : ""}" title="${mood.label}">
        <span>${mood.label}</span><i class="chart-bar" style="--height: ${entry.mood * 28}px"></i><span>${shortDate(entry.date)}</span>
      </div>`;
    }).join("");
    const lastMood = moods.find((item) => item.value === recent.at(-1).mood);
    document.querySelector("#trend-summary").textContent = recent.length === 1
      ? `目前有 1 次记录：${lastMood.label}。再多写几次，就能看见变化。`
      : `最近一次是“${lastMood.label}”。趋势只呈现记录，不评判你的情绪。`;
  }

  const history = document.querySelector("#history-list");
  if (!entries.length) {
    history.innerHTML = '<p class="empty-state">还没有日记。去“今天”写下第一篇吧。</p>';
    return;
  }

  history.innerHTML = [...entries].reverse().map((entry) => {
    const mood = moods.find((item) => item.value === entry.mood);
    return `<button class="history-item" data-entry-date="${entry.date}">
      <span class="history-date">${shortDate(entry.date)}</span>
      <span class="history-preview">${escapeHtml(entry.gratitude[0])}</span>
      <span class="history-mood" aria-label="${mood.label}">${mood.face}</span>
    </button>`;
  }).join("");

  history.querySelectorAll("[data-entry-date]").forEach((button) => {
    button.addEventListener("click", () => openEntry(button.dataset.entryDate));
  });
}

function openEntry(date) {
  const entry = entries.find((item) => item.date === date);
  if (!entry) return;
  const mood = moods.find((item) => item.value === entry.mood);
  document.querySelector("#dialog-date").textContent = formatFullDate(entry.date);
  document.querySelector("#dialog-title").textContent = mood.label;
  document.querySelector("#dialog-body").innerHTML = `
    <section class="dialog-section"><h3>3 件感恩的事</h3><ol>${entry.gratitude.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}</ol></section>
    <section class="dialog-section"><h3>2 件可以改进的事</h3><ol>${entry.improve.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}</ol></section>
    <section class="dialog-section"><h3>给自己的肯定</h3><p>${escapeHtml(entry.affirmation[0])}</p></section>
  `;
  document.querySelector("#entry-dialog").showModal();
}

function recentEntries() { return [...entries].sort((a, b) => a.date.localeCompare(b.date)).slice(-7); }

function persistEntry(entry) {
  const existingIndex = entries.findIndex((item) => item.date === entry.date);
  if (existingIndex >= 0) entries[existingIndex] = entry;
  else entries.push(entry);
  entries.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function loadEntries() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatFullDate(dateKey) {
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date(`${dateKey}T12:00:00`));
}

function shortDate(dateKey) {
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(new Date(`${dateKey}T12:00:00`));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

registerModelTools();

function registerModelTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return;

  const stringList = (count) => ({
    type: "array",
    items: { type: "string", minLength: 1, maxLength: 120 },
    minItems: count,
    maxItems: count,
  });

  try {
    void Promise.resolve(context.registerTool({
      name: "save_today_321_journal",
      title: "保存今天的 321 日记",
      description: "保存或更新今天的心情、3 件感恩、2 件改进和 1 句自我肯定，并同步更新页面上的趋势。",
      inputSchema: {
        type: "object",
        properties: {
          mood: { type: "integer", minimum: 1, maximum: 5 },
          gratitude: stringList(3),
          improve: stringList(2),
          affirmation: { type: "string", minLength: 1, maxLength: 120 },
        },
        required: ["mood", "gratitude", "improve", "affirmation"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const entry = {
          date: todayKey,
          mood: Number(input.mood),
          gratitude: input.gratitude.map((text) => String(text).trim()),
          improve: input.improve.map((text) => String(text).trim()),
          affirmation: [String(input.affirmation).trim()],
          updatedAt: new Date().toISOString(),
        };
        const invalid = !Number.isInteger(entry.mood) || entry.mood < 1 || entry.mood > 5
          || [...entry.gratitude, ...entry.improve, ...entry.affirmation].some((text) => !text || text.length > 120)
          || entry.gratitude.length !== 3 || entry.improve.length !== 2;
        if (invalid) throw new Error("日记内容不完整或超过长度限制。 ");
        persistEntry(entry);
        renderSuccess(entry);
        renderTrend();
        showView("success");
        return { saved: true, date: entry.date, entryCount: entries.length };
      },
    })).catch(() => {});
  } catch {
    // The journal remains fully usable in browsers without WebMCP support.
  }
}
