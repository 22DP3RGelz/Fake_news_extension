const api = typeof browser !== "undefined" ? browser : chrome;
const ARTICLE_GATE_MODES = new Set(["strict", "balanced", "lenient"]);

const state = {
  trustedDomains: [],
  clickbaitWords: [],
  approvedDomains: [],
  articleGateMode: "strict"
};

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    api.runtime.sendMessage(message, (response) => {
      if (api.runtime.lastError) {
        reject(api.runtime.lastError);
        return;
      }

      if (!response || response.success === false) {
        reject(new Error(response?.error || "Storage request failed"));
        return;
      }

      resolve(response);
    });
  });
}

function setStatus(message, type = "") {
  const status = document.getElementById("saveStatus");
  status.textContent = message;
  status.className = `status-pill ${type}`.trim();
}

function reportError(error) {
  console.error(error);
  setStatus(error.message || "Settings action failed.", "error");
}

function normalizeDomain(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function normalizeWord(value) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

function renderList(listId, items, getLabel, onRemove, getMeta) {
  const list = document.getElementById(listId);
  list.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No items yet.";
    list.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const li = document.createElement("li");
    const labelWrap = document.createElement("div");
    const label = document.createElement("strong");
    const removeBtn = document.createElement("button");

    label.textContent = getLabel(item);
    labelWrap.appendChild(label);

    const meta = getMeta ? getMeta(item) : "";
    if (meta) {
      const metaEl = document.createElement("span");
      metaEl.className = "item-meta";
      metaEl.textContent = meta;
      labelWrap.appendChild(metaEl);
    }

    removeBtn.type = "button";
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      onRemove(item).catch(reportError);
    });

    li.appendChild(labelWrap);
    li.appendChild(removeBtn);
    list.appendChild(li);
  });
}

function renderArticleGateMode() {
  document.querySelectorAll(".segmented-control label").forEach(label => {
    const input = label.querySelector("input");
    label.classList.toggle("selected", input && input.value === state.articleGateMode);
    if (input) input.checked = input.value === state.articleGateMode;
  });
}

function render() {
  renderList("trustedDomainsList", state.trustedDomains, item => item, removeTrustedDomain);
  renderList("clickbaitWordsList", state.clickbaitWords, item => item, removeClickbaitWord);
  renderList(
    "approvedDomainsList",
    state.approvedDomains,
    item => item.domain || item,
    removeApprovedDomain,
    item => {
      const approvedAt = formatDate(item.approvedAt);
      return approvedAt ? `Approved ${approvedAt}` : "";
    }
  );
  renderArticleGateMode();
}

async function loadSettings(showReady = true) {
  setStatus("Loading...");

  const [trusted, clickbait, approved, gateMode] = await Promise.all([
    sendMessage({ action: "getTrustedDomains" }),
    sendMessage({ action: "getClickbaitWords" }),
    sendMessage({ action: "getUserApprovedDomains" }),
    sendMessage({ action: "getArticleGateMode" })
  ]);

  state.trustedDomains = (trusted.domains || []).slice().sort();
  state.clickbaitWords = (clickbait.words || []).slice().sort();
  state.approvedDomains = (approved.domains || []).slice().sort((a, b) =>
    String(a.domain || a).localeCompare(String(b.domain || b))
  );
  state.articleGateMode = ARTICLE_GATE_MODES.has(gateMode.mode) ? gateMode.mode : "strict";

  render();
  if (showReady) setStatus("Ready", "success");
}

async function addTrustedDomain(event) {
  event.preventDefault();
  const input = document.getElementById("trustedDomainInput");
  const domain = normalizeDomain(input.value);
  if (!domain) return setStatus("Enter a domain first.", "error");

  await sendMessage({ action: "addTrustedDomain", domain });
  input.value = "";
  await loadSettings(false);
  setStatus("Trusted domain added.", "success");
}

async function removeTrustedDomain(domain) {
  await sendMessage({ action: "removeTrustedDomain", domain });
  await loadSettings(false);
  setStatus("Trusted domain removed.", "success");
}

async function addClickbaitWord(event) {
  event.preventDefault();
  const input = document.getElementById("clickbaitWordInput");
  const word = normalizeWord(input.value);
  if (!word) return setStatus("Enter a word or phrase first.", "error");

  await sendMessage({ action: "addClickbaitWord", word });
  input.value = "";
  await loadSettings(false);
  setStatus("Clickbait word added.", "success");
}

async function removeClickbaitWord(word) {
  await sendMessage({ action: "removeClickbaitWord", word });
  await loadSettings(false);
  setStatus("Clickbait word removed.", "success");
}

async function addApprovedDomain(event) {
  event.preventDefault();
  const input = document.getElementById("approvedDomainInput");
  const domain = normalizeDomain(input.value);
  if (!domain) return setStatus("Enter a domain first.", "error");

  await sendMessage({
    action: "approveUserDomain",
    domain,
    metadata: { source: "settings" }
  });
  input.value = "";
  await loadSettings(false);
  setStatus("Approved domain added.", "success");
}

async function removeApprovedDomain(item) {
  const domain = item.domain || item;
  await sendMessage({ action: "removeApprovedDomain", domain });
  await loadSettings(false);
  setStatus("Approved domain removed.", "success");
}

async function setArticleGateMode(event) {
  const mode = event.target.value;
  if (!ARTICLE_GATE_MODES.has(mode)) return;

  await sendMessage({ action: "setArticleGateMode", mode });
  state.articleGateMode = mode;
  renderArticleGateMode();
  setStatus("Article gate mode saved.", "success");
}

function bindEvents() {
  document.getElementById("trustedDomainForm").addEventListener("submit", (event) => {
    addTrustedDomain(event).catch(reportError);
  });
  document.getElementById("clickbaitWordForm").addEventListener("submit", (event) => {
    addClickbaitWord(event).catch(reportError);
  });
  document.getElementById("approvedDomainForm").addEventListener("submit", (event) => {
    addApprovedDomain(event).catch(reportError);
  });

  document.querySelectorAll('input[name="articleGateMode"]').forEach(input => {
    input.addEventListener("change", (event) => {
      setArticleGateMode(event).catch(reportError);
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  try {
    await loadSettings();
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Settings failed to load.", "error");
  }
});
