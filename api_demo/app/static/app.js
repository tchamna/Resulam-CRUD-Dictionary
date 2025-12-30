const baseUrl = window.location.origin;
const logEl = document.getElementById("log");
const toastEl = document.getElementById("toast");
const clafricaToggle = document.getElementById("clafrica-toggle");
const spellcheckToggle = document.getElementById("spellcheck-toggle");
const definitionTextarea = document.getElementById("definition-textarea");
const languageInput = document.getElementById("language-input");
const languageIdInput = document.getElementById("language-id");
const languageDropdown = document.getElementById("language-dropdown");
const definitionLanguageId = document.getElementById("definition-language-id");
const reseedLanguageId = document.getElementById("reseed-language-id");
const randomLanguageId = document.getElementById("random-language-id");
const dictionaryTitle = document.getElementById("dictionary-title");
const labelWord = document.getElementById("label-word");
const labelDefinition = document.getElementById("label-definition");
const labelExamples = document.getElementById("label-examples");
const labelSynonyms = document.getElementById("label-synonyms");
const labelTranslationFr = document.getElementById("label-translation-fr");
const labelTranslationEn = document.getElementById("label-translation-en");
const confirmModal = document.getElementById("confirm-modal");
const confirmTitle = document.getElementById("confirm-title");
const confirmBody = document.getElementById("confirm-body");
const confirmCancel = document.getElementById("confirm-cancel");
const confirmAccept = document.getElementById("confirm-accept");
const tokenExpiredModal = document.getElementById("token-expired-modal");
const tokenExpiredTitle = document.getElementById("token-expired-title");
const tokenExpiredBody = document.getElementById("token-expired-body");
const tokenExpiredSignIn = document.getElementById("token-expired-signin");
const toolsToggle = document.getElementById("toggle-tools");
const toolsPanel = document.getElementById("tools-panel");

let languageCache = [];
let currentUserRole = null;
let currentUserEmail = null;
let confirmResolver = null;
let lastSearchTerm = "";
let lastSearchLanguageId = "";
let lastListMode = "search";
let lastRandomLanguageId = "";
let currentLanguageKey = "";
let tokenExpiredOpen = false;
const confirmDefaults = {
  title: confirmTitle ? confirmTitle.textContent : "Confirm",
  confirmText: confirmAccept ? confirmAccept.textContent : "Confirm",
  cancelText: confirmCancel ? confirmCancel.textContent : "Cancel",
};

let clafricaMap = {};
let clafricaKeys = [];
let clafricaMaxKeyLen = 0;
let clafricaPrefixes = new Set();

function getPreferredAuthTab() {
  const adminRoute = window.location.pathname.startsWith("/admin");
  if (adminRoute) {
    return "login";
  }
  const pref = localStorage.getItem("auth_pref");
  return pref === "login" ? "login" : "register";
}

function setAuthPreference(tab) {
  if (!tab) {
    localStorage.removeItem("auth_pref");
    return;
  }
  localStorage.setItem("auth_pref", tab);
}

const tokenStore = {
  access: localStorage.getItem("access_token") || "",
  refresh: localStorage.getItem("refresh_token") || "",
};

function setTokens(access, refresh) {
  tokenStore.access = access || "";
  tokenStore.refresh = refresh || "";
  localStorage.setItem("access_token", tokenStore.access);
  localStorage.setItem("refresh_token", tokenStore.refresh);
  renderTokens();
}

function renderTokens() {}

function showToast(message, anchor) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.remove("is-hidden");
  toastEl.classList.add("show");
  if (anchor && anchor.getBoundingClientRect) {
    const rect = anchor.getBoundingClientRect();
    const top = rect.bottom + 8;
    const left = rect.left;
    toastEl.style.top = `${Math.min(top, window.innerHeight - 60)}px`;
    toastEl.style.left = `${Math.min(left, window.innerWidth - 220)}px`;
  } else {
    toastEl.style.top = "";
    toastEl.style.left = "";
    toastEl.style.right = "24px";
    toastEl.style.bottom = "24px";
  }
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toastEl.classList.remove("show");
    toastEl.classList.add("is-hidden");
  }, 1800);
}

function focusRandomWords() {
  const randomForm = document.querySelector('form[data-endpoint="/dictionary/random"]');
  if (!randomForm) {
    return;
  }
  randomForm.scrollIntoView({ behavior: "smooth", block: "start" });
  const submitButton = document.getElementById("random-submit");
  if (submitButton) {
    submitButton.focus();
  }
}

function focusLoginForm() {
  const loginForm = document.getElementById("login-form");
  if (!loginForm) {
    return;
  }
  const loginTab = document.querySelector('.auth-tab[data-auth-tab="login"]');
  if (loginTab) {
    loginTab.click();
  }
  loginForm.scrollIntoView({ behavior: "smooth", block: "start" });
  const passwordInput = loginForm.querySelector('input[name="password"]');
  if (passwordInput) {
    passwordInput.focus();
  }
}

function showTokenExpired(message) {
  if (tokenExpiredOpen || !tokenExpiredModal) {
    return;
  }
  tokenExpiredOpen = true;
  if (tokenExpiredTitle) {
    tokenExpiredTitle.textContent = "Token Expired";
  }
  if (tokenExpiredBody) {
    tokenExpiredBody.textContent = message || "Your session expired. Please sign in again.";
  }
  setTokens("", "");
  setAuthPreference("login");
  showAuthOnly("login");
  tokenExpiredModal.classList.remove("is-hidden");
  if (tokenExpiredSignIn) {
    tokenExpiredSignIn.focus();
  }
}

function closeTokenExpired() {
  if (tokenExpiredModal) {
    tokenExpiredModal.classList.add("is-hidden");
  }
  tokenExpiredOpen = false;
}

function appendLog(title, payload) {
  const stamp = new Date().toLocaleTimeString();
  const line = `\n[${stamp}] ${title}\n${JSON.stringify(payload, null, 2)}`;
  logEl.textContent = line + logEl.textContent;
}

async function apiRequest({ endpoint, method, body, auth, retryOnUnauthorized = true }) {
  const headers = { "Content-Type": "application/json" };
  if (auth && tokenStore.access) {
    headers.Authorization = `Bearer ${tokenStore.access}`;
  }

  const response = await fetch(baseUrl + endpoint, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : { status: "OK" };
  } catch {
    data = { raw: text };
  }

  if (
    response.status === 401 &&
    auth &&
    retryOnUnauthorized &&
    tokenStore.refresh &&
    endpoint !== "/auth/refresh"
  ) {
    const refresh = await fetch(baseUrl + "/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: tokenStore.refresh }),
    });
    if (refresh.ok) {
      const refreshData = await refresh.json().catch(() => ({}));
      if (refreshData.access_token) {
        setTokens(refreshData.access_token, refreshData.refresh_token || tokenStore.refresh);
        return apiRequest({ endpoint, method, body, auth, retryOnUnauthorized: false });
      }
    }
  }

  if (response.status === 401 && auth && (tokenStore.access || tokenStore.refresh)) {
    const detail = data?.detail || "Token expired.";
    showTokenExpired(detail);
  }

  return { status: response.status, ok: response.ok, data };
}

async function loadCurrentUser() {
  try {
    const res = await apiRequest({ endpoint: "/users/me", method: "GET", auth: true });
    if (res.ok && res.data && res.data.role) {
      currentUserRole = res.data.role;
      currentUserEmail = res.data.email || null;
      return res.data;
    }
  } catch (err) {
    appendLog("Current user error", { message: err.message });
  }
  return null;
}

function isAdmin() {
  return currentUserRole === "admin" || currentUserRole === "super_admin";
}

function isSuperAdmin() {
  return currentUserRole === "super_admin";
}

function openConfirm(message, options = {}) {
  if (!confirmModal || !confirmBody || !confirmAccept || !confirmCancel) {
    return Promise.resolve(false);
  }
  const title = options.title || confirmDefaults.title;
  const confirmText = options.confirmText || confirmDefaults.confirmText;
  const cancelText = options.cancelText || confirmDefaults.cancelText;
  if (confirmTitle) {
    confirmTitle.textContent = title;
  }
  confirmBody.textContent = message;
  confirmAccept.textContent = confirmText;
  confirmCancel.textContent = cancelText;
  confirmModal.classList.remove("is-hidden");
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function closeConfirm(result) {
  if (confirmModal) {
    confirmModal.classList.add("is-hidden");
  }
  if (confirmResolver) {
    confirmResolver(result);
    confirmResolver = null;
  }
}

if (confirmCancel) {
  confirmCancel.addEventListener("click", () => closeConfirm(false));
}

if (confirmAccept) {
  confirmAccept.addEventListener("click", () => closeConfirm(true));
}

if (confirmModal) {
  confirmModal.addEventListener("click", (event) => {
    if (event.target && event.target.classList.contains("modal-backdrop")) {
      closeConfirm(false);
    }
  });
}

if (tokenExpiredSignIn) {
  tokenExpiredSignIn.addEventListener("click", () => {
    closeTokenExpired();
    focusLoginForm();
  });
}

if (tokenExpiredModal) {
  tokenExpiredModal.addEventListener("click", (event) => {
    if (event.target && event.target.classList.contains("modal-backdrop")) {
      closeTokenExpired();
    }
  });
}

async function loadClafricaMap() {
  try {
    const res = await apiRequest({ endpoint: "/dictionary/clafrica-map", method: "GET" });
    if (res.ok && res.data && typeof res.data === "object") {
      clafricaMap = res.data;
      clafricaKeys = Object.keys(clafricaMap).sort((a, b) => b.length - a.length);
      clafricaMaxKeyLen = clafricaKeys.length ? clafricaKeys[0].length : 0;
      clafricaPrefixes = new Set();
      clafricaKeys.forEach((key) => {
        for (let i = 1; i < key.length; i += 1) {
          clafricaPrefixes.add(key.slice(0, i));
        }
      });
    }
  } catch (err) {
    appendLog("Clafrica map error", { message: err.message });
  }
}

async function loadLanguages() {
  if (!languageInput || !languageDropdown) {
    return;
  }
  try {
    const res = await apiRequest({ endpoint: "/dictionary/languages", method: "GET" });
    if (res.ok && Array.isArray(res.data)) {
      languageCache = res.data;
      renderLanguageDropdown(languageCache, "", false);
      if (languageCache.length) {
        const nufi = languageCache.find((row) => normalizeLanguageKey(row.name) === "nufi");
        setLanguage(nufi || languageCache[0]);
        await fetchRandomWords();
      }
    }
  } catch (err) {
    appendLog("Languages error", { message: err.message });
  }
}

function renderLanguageDropdown(list, query, shouldOpen = true) {
  if (!languageDropdown) {
    return;
  }
  languageDropdown.textContent = "";
  list.forEach((row) => {
    const item = document.createElement("div");
    item.className = "dropdown-item";
    item.textContent = row.name;
    item.addEventListener("click", () => {
      setLanguage(row);
      closeLanguageDropdown();
    });
    if (isAdmin() && normalizeLanguageKey(row.name) !== "nufi") {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "ghost small";
      remove.textContent = "Delete";
      remove.addEventListener("click", async (event) => {
        event.stopPropagation();
        const ok = window.confirm(`Delete language "${row.name}" and its words?`);
        if (!ok) return;
        await deleteLanguage(row.id);
      });
      item.appendChild(remove);
    }
    languageDropdown.appendChild(item);
  });
  const exactMatch = query ? findLanguageMatch(query) : null;
  if (!exactMatch) {
    const create = document.createElement("div");
    create.className = "dropdown-item";
    create.textContent = "Add your language";
    create.addEventListener("click", async () => {
      const name = languageInput ? languageInput.value.trim() : "";
      if (!name) {
        return;
      }
      const ok = await openConfirm(`Create new language "${name}"?`, {
        title: "Create language",
        confirmText: "Create",
        cancelText: "Edit",
      });
      if (!ok) {
        if (languageInput) {
          languageInput.focus();
        }
        return;
      }
      createLanguage(name);
    });
    languageDropdown.appendChild(create);
  }
  languageDropdown.classList.toggle("open", shouldOpen);
}

function normalizeLanguageKey(value) {
  return value.toLowerCase().replace(/'/g, "").replace(/\s+/g, "-");
}

function findLanguageMatch(value) {
  const key = normalizeLanguageKey(value);
  return languageCache.find((row) => row.slug === key || row.name.toLowerCase() === value.toLowerCase());
}

function getDictionaryLabels() {
  if (currentLanguageKey === "nufi") {
    return {
      title: "Ŋwɑ̀'nǐpàhsì",
      needsDefinition: "Pō yǎt sì pàhsì",
      defined: "Pàhsì",
      define: "Pàhsì",
      edit: "Cōp pàhsì",
      wordLabel: "Njâ'wū",
      definitionLabel: "Pàhsì",
      examplesLabel: "Mfóhnì",
      synonymsLabel: "Fóhmbʉ̄ɑ̄",
      translationFrLabel: "Fāhngə́ə́ mɑ̀ Flàŋsī",
      translationEnLabel: "Fāhngə́ə́ mɑ̀ Nglǐsì",
    };
  }
  return {
    title: "Dictionary",
    needsDefinition: "needs definition",
    defined: "defined",
    define: "Define",
    edit: "Edit",
    wordLabel: "Word",
    definitionLabel: "Definitions",
    examplesLabel: "Examples",
    synonymsLabel: "Syn.",
    translationFrLabel: "Traduction en Francais",
    translationEnLabel: "Translation in English",
  };
}

function updateDictionaryLabels() {
  if (!dictionaryTitle) {
    return;
  }
  const labels = getDictionaryLabels();
  dictionaryTitle.textContent = labels.title;
  if (labelWord) labelWord.textContent = labels.wordLabel;
  if (labelDefinition) labelDefinition.textContent = labels.definitionLabel;
  if (labelExamples) labelExamples.textContent = labels.examplesLabel;
  if (labelSynonyms) labelSynonyms.textContent = labels.synonymsLabel;
  if (labelTranslationFr) labelTranslationFr.textContent = labels.translationFrLabel;
  if (labelTranslationEn) labelTranslationEn.textContent = labels.translationEnLabel;
}

function setLanguage(row) {
  if (!languageInput || !languageIdInput) {
    return;
  }
  languageInput.value = row.name;
  languageIdInput.value = row.id;
  currentLanguageKey = normalizeLanguageKey(row.name);
  updateDictionaryLabels();
  syncLanguageHiddenFields();
  fetchRandomWords();
}

function closeLanguageDropdown() {
  if (!languageDropdown) {
    return;
  }
  languageDropdown.classList.remove("open");
}

async function createLanguage(name) {
  try {
    const res = await apiRequest({
      endpoint: "/dictionary/languages",
      method: "POST",
      body: { name },
      auth: true,
    });
    appendLog("POST /dictionary/languages", res.data);
    if (res.ok) {
      await loadLanguages();
      const match = findLanguageMatch(name);
      if (match) {
        setLanguage(match);
        closeLanguageDropdown();
      }
    }
  } catch (err) {
    appendLog("Create language failed", { message: err.message });
  }
}

async function deleteLanguage(id) {
  try {
    const res = await apiRequest({
      endpoint: `/dictionary/languages/${id}`,
      method: "DELETE",
      auth: true,
    });
    appendLog("DELETE /dictionary/languages", res.data);
    if (res.ok) {
      await loadLanguages();
    }
  } catch (err) {
    appendLog("Delete language failed", { message: err.message });
  }
}

async function fetchRandomWords() {
  if (!languageIdInput || !languageIdInput.value) {
    return;
  }
  lastListMode = "random";
  lastRandomLanguageId = languageIdInput.value;
  try {
    const res = await apiRequest({
      endpoint: `/dictionary/random?language_id=${languageIdInput.value}&limit=10`,
      method: "GET",
      auth: true,
    });
    if (res.ok) {
      renderResult("dictionary-result", res);
    }
  } catch (err) {
    appendLog("Random words error", { message: err.message });
  }
}

function syncLanguageHiddenFields() {
  if (!languageIdInput) {
    return;
  }
  const value = languageIdInput.value;
  if (definitionLanguageId) {
    definitionLanguageId.value = value;
  }
  if (reseedLanguageId) {
    reseedLanguageId.value = value;
  }
  if (randomLanguageId) {
    randomLanguageId.value = value;
  }
}

function applyClafricaToken(token, allowPartialAtEnd) {
  if (!clafricaMaxKeyLen) {
    return token;
  }
  let output = "";
  let i = 0;
  while (i < token.length) {
    let matched = false;
    const maxLen = Math.min(clafricaMaxKeyLen, token.length - i);
    for (let len = maxLen; len > 0; len -= 1) {
      const chunk = token.slice(i, i + len);
      const replacement = clafricaMap[chunk];
      if (replacement) {
        if (allowPartialAtEnd && i + len === token.length && clafricaPrefixes.has(chunk)) {
          break;
        }
        output += replacement;
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      output += token[i];
      i += 1;
    }
  }
  return output;
}

function applyClafricaReplacement(event) {
  if (!clafricaToggle || !clafricaToggle.checked) {
    return;
  }
  if (!event || event.key !== " ") {
    return;
  }
  const target = event.target;
  if (!target || !target.dataset || target.dataset.clafrica !== "true") {
    return;
  }

  const value = target.value;
  const cursor = target.selectionStart;
  const before = value.slice(0, cursor);
  const after = value.slice(cursor);
  const match = before.match(/(\S+)$/);
  if (!match) {
    return;
  }
  const token = match[1];
  const replacement = applyClafricaToken(token, false);
  if (!replacement || replacement === token) {
    return;
  }
  const newBefore = before.slice(0, -token.length) + replacement + " ";
  target.value = newBefore + after;
  const newCursor = newBefore.length;
  target.setSelectionRange(newCursor, newCursor);
  event.preventDefault();
}

function applyClafricaOnInput(event) {
  if (!clafricaToggle || !clafricaToggle.checked) {
    return;
  }
  const target = event.target;
  if (!target || !target.dataset || target.dataset.clafrica !== "true") {
    return;
  }
  const value = target.value;
  const cursor = target.selectionStart;
  if (cursor === null || cursor === undefined) {
    return;
  }
  const left = value.slice(0, cursor);
  const right = value.slice(cursor);
  const match = left.match(/(\S+)$/);
  if (!match) {
    return;
  }
  const token = match[1];
  const replacement = applyClafricaToken(token, true);
  if (!replacement || replacement === token) {
    return;
  }
  const newLeft = left.slice(0, -token.length) + replacement;
  target.value = newLeft + right;
  const newCursor = newLeft.length;
  target.setSelectionRange(newCursor, newCursor);
}

function resolveEndpoint(template, data) {
  if (!template.includes(":id")) return template;
  return template.replace(":id", data.id);
}

function collectFormData(form) {
  const data = {};
  new FormData(form).forEach((value, key) => {
    if (value !== "") {
      data[key] = value;
    }
  });
  return data;
}

function renderResult(targetId, res) {
  const el = document.getElementById(targetId);
  if (!el) return;

  if (!res.ok) {
    el.textContent = `Error ${res.status}: ${JSON.stringify(res.data)}`;
    return;
  }

  if (targetId === "dictionary-result" && Array.isArray(res.data)) {
    const labels = getDictionaryLabels();
    if (res.data.length === 0) {
      el.textContent = "No words found. You can add it below.";
      if (lastSearchTerm && lastSearchLanguageId) {
        const form = document.getElementById("definition-form");
        if (form) {
          const idInput = form.querySelector('input[name="id"]');
          const wordInput = form.querySelector('input[name="word"]');
          const definitionInput = form.querySelector('textarea[name="definition"]');
          const examplesInput = form.querySelector('textarea[name="examples"]');
          const synonymsInput = form.querySelector('input[name="synonyms"]');
          const translationFrInput = form.querySelector('textarea[name="translation_fr"]');
          const translationEnInput = form.querySelector('textarea[name="translation_en"]');
          const languageInput = form.querySelector('input[name="language_id"]');
          if (idInput) idInput.value = "";
          if (idInput) idInput.placeholder = "(new word)";
          if (wordInput) wordInput.value = lastSearchTerm;
          if (definitionInput) definitionInput.value = "";
          if (examplesInput) examplesInput.value = "";
          if (synonymsInput) synonymsInput.value = "";
          if (translationFrInput) translationFrInput.value = "";
          if (translationEnInput) translationEnInput.value = "";
          if (languageInput) languageInput.value = lastSearchLanguageId;
          form.scrollIntoView({ behavior: "smooth", block: "start" });
          if (definitionInput) {
            definitionInput.focus();
          }
        }
      }
      return;
    }

    el.textContent = "";
    const list = document.createElement("div");
    list.className = "item-list";
    res.data.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "item-row";
      row.dataset.entryId = entry.id;

      const meta = entry.definition ? labels.defined : labels.needsDefinition;
      const by = entry.updated_by_email ? `, by ${entry.updated_by_email}` : "";
      const label = document.createElement("span");
      label.textContent = `#${entry.id} ${entry.word} (${meta}${by})`;

      const useButton = document.createElement("button");
      useButton.type = "button";
      useButton.className = "ghost small";
      useButton.textContent = entry.definition ? labels.edit : labels.define;
      if (entry.definition && entry.definition.trim()) {
        const fields = [
          entry.definition,
          entry.examples,
          entry.synonyms,
          entry.translation_fr,
          entry.translation_en,
        ];
        const filled = fields.filter((value) => value && String(value).trim()).length;
        const total = fields.length;
        const ratio = total ? filled / total : 0;
        const lightness = Math.round(78 - ratio * 36);
        useButton.classList.add("defined-btn");
        useButton.style.background = `hsl(140, 45%, ${lightness}%)`;
      }
      useButton.addEventListener("click", () => {
        const form = document.getElementById("definition-form");
        if (!form) return;
        const idInput = form.querySelector('input[name="id"]');
        const wordInput = form.querySelector('input[name="word"]');
        const definitionInput = form.querySelector('textarea[name="definition"]');
        const examplesInput = form.querySelector('textarea[name="examples"]');
        const synonymsInput = form.querySelector('input[name="synonyms"]');
        const translationFrInput = form.querySelector('textarea[name="translation_fr"]');
        const translationEnInput = form.querySelector('textarea[name="translation_en"]');
        const languageInput = form.querySelector('input[name="language_id"]');
        if (idInput) idInput.value = entry.id;
        if (idInput) idInput.placeholder = "";
        if (wordInput) wordInput.value = entry.word;
        if (definitionInput) definitionInput.value = entry.definition || "";
        if (examplesInput) examplesInput.value = entry.examples || "";
        if (synonymsInput) synonymsInput.value = entry.synonyms || "";
        if (translationFrInput) translationFrInput.value = entry.translation_fr || "";
        if (translationEnInput) translationEnInput.value = entry.translation_en || "";
        if (languageInput) languageInput.value = entry.language_id;
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      row.appendChild(label);
      row.appendChild(useButton);
      list.appendChild(row);
    });
    el.appendChild(list);
    return;
  }

  if (targetId === "definition-result" && res.ok) {
    el.textContent = "Definition saved.";
    return;
  }

  if (targetId === "reseed-result" && res.ok) {
    el.textContent = `Reseeded ${res.data.count} words.`;
    return;
  }

  if (targetId === "invite-result" || targetId === "invite-result-users") {
    if (!res.ok) {
      el.textContent = `Error ${res.status}: ${JSON.stringify(res.data)}`;
      return;
    }
    const codes = Array.isArray(res.data?.codes) ? res.data.codes : [];
    if (!codes.length) {
      el.textContent = "No invite codes returned.";
      return;
    }
    el.textContent = `Invite codes: ${codes.join(", ")}`;
    return;
  }

  if (targetId === "register-result") {
    if (!res.ok) {
      el.textContent = `Error ${res.status}: ${JSON.stringify(res.data)}`;
      return;
    }
    const token = res.data?.verification_token;
    if (token) {
      el.textContent = `Verification token: ${token}`;
      return;
    }
  }

  if (targetId === "users-result" && Array.isArray(res.data)) {
    if (res.data.length === 0) {
      el.textContent = "No users yet.";
      return;
    }

    const emailCounts = res.data.reduce((acc, user) => {
      const key = (user.email || "").toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    el.textContent = "";
    const list = document.createElement("div");
    list.className = "item-list";
    res.data.forEach((user) => {
      const row = document.createElement("div");
      row.className = "item-row";

      const label = document.createElement("span");
      const count = typeof user.defined_count === "number" ? user.defined_count : 0;
      const verified = user.is_verified ? "verified" : "unverified";
      const deletedTag = user.is_deleted ? ", deleted" : "";
      label.textContent = `#${user.id} ${user.email} (${user.role}${deletedTag}, ${verified}, ${count} defined)`;

      const useButton = document.createElement("button");
      useButton.type = "button";
      useButton.className = "ghost small";
      useButton.textContent = "Use email";
      if (user.is_deleted) {
        useButton.disabled = true;
      }
      useButton.addEventListener("click", () => {
        if (user.is_deleted) {
          return;
        }
        const emailInput = document.querySelector(
          'form[data-endpoint="/users/role"] input[name="email"]'
        );
        if (emailInput) {
          emailInput.value = user.email;
          emailInput.focus();
        }
      });

      row.appendChild(label);
      row.appendChild(useButton);
      if (!user.is_deleted && (emailCounts[user.email.toLowerCase()] || 0) > 1) {
        const dedupeButton = document.createElement("button");
        dedupeButton.type = "button";
        dedupeButton.className = "ghost small";
        dedupeButton.textContent = "Deduplicate";
        dedupeButton.addEventListener("click", async () => {
          const res = await apiRequest({
            endpoint: "/users/deduplicate",
            method: "PUT",
            body: { email: user.email },
            auth: true,
          });
          appendLog("PUT /users/deduplicate", res.data);
          if (res.ok) {
            showToast(`Deduped ${user.email}`, dedupeButton);
            refreshUsersList();
          } else {
            showToast("Deduplicate failed", dedupeButton);
          }
        });
        row.appendChild(dedupeButton);
      }
      if (!user.is_deleted && !user.is_verified) {
        const verifyButton = document.createElement("button");
        verifyButton.type = "button";
        verifyButton.className = "ghost small";
        verifyButton.textContent = "Verify";
        verifyButton.addEventListener("click", async () => {
          const res = await apiRequest({
            endpoint: "/users/verify",
            method: "PUT",
            body: { email: user.email },
            auth: true,
          });
          appendLog("PUT /users/verify", res.data);
          if (res.ok) {
            showToast(`Verified ${user.email}`, verifyButton);
            refreshUsersList();
          } else {
            showToast("Verify failed", verifyButton);
          }
        });
        row.appendChild(verifyButton);
      }
      if (isSuperAdmin() && !user.is_deleted && user.role !== "super_admin") {
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "ghost small";
        deleteButton.textContent = "Delete user";
        deleteButton.addEventListener("click", async () => {
          if (currentUserEmail && user.email === currentUserEmail) {
            showToast("Cannot delete your own account", deleteButton);
            return;
          }
          const confirmed = await openConfirm(`Delete ${user.email}?`, {
            title: "Delete user",
            confirmText: "Delete",
            cancelText: "Cancel",
          });
          if (!confirmed) {
            return;
          }
          const res = await apiRequest({
            endpoint: `/users/${user.id}`,
            method: "DELETE",
            auth: true,
          });
          appendLog(`DELETE /users/${user.id}`, res.data);
          if (res.ok) {
            showToast(`Deleted ${user.email}`, deleteButton);
            refreshUsersList();
          } else {
            showToast("Delete failed", deleteButton);
          }
        });
        row.appendChild(deleteButton);
      }
      list.appendChild(row);
    });
    el.appendChild(list);
    return;
  }

  el.textContent = JSON.stringify(res.data, null, 2);
}

document.querySelectorAll("form").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    let method = form.dataset.method || "GET";
    let endpointTemplate = form.dataset.endpoint || "";
    const needsAuth = form.dataset.auth === "true";
    const expectsToken = form.dataset.tokenOut === "true";
    const usesRefresh = form.dataset.refresh === "true";
    const resultTarget = form.dataset.resultTarget || "";

    const data = collectFormData(form);
    if (endpointTemplate === "/auth/register") {
      const confirmInput = form.querySelector('input[name="confirm_password"]');
      if (!data.password || !data.confirm_password || data.password !== data.confirm_password) {
        if (confirmInput) {
          confirmInput.classList.add("input-error");
          confirmInput.setAttribute("aria-invalid", "true");
        }
        showToast("Passwords do not match.", event.submitter);
        return;
      }
      if (confirmInput) {
        confirmInput.classList.remove("input-error");
        confirmInput.removeAttribute("aria-invalid");
      }
    }
    if (data.confirm_password) {
      delete data.confirm_password;
    }
    if (typeof data.search === "string") {
      data.search = data.search.trim();
    }
    if (typeof data.id === "string") {
      const cleanedId = data.id.trim();
      if (!/^\d+$/.test(cleanedId)) {
        delete data.id;
      } else {
        data.id = cleanedId;
      }
    }
    if (endpointTemplate === "/dictionary" && method === "GET") {
      if (!data.language_id) {
        const guess = languageInput ? languageInput.value.trim() : "";
        const match = guess ? findLanguageMatch(guess) : null;
        if (match) {
          data.language_id = match.id;
          if (languageIdInput) {
            languageIdInput.value = match.id;
          }
          syncLanguageHiddenFields();
        }
      }
      if (!data.language_id) {
        const resultEl = document.getElementById("dictionary-result");
        if (resultEl) {
          resultEl.textContent = "Select a language before fetching words.";
        }
        return;
      }
    }
    if (endpointTemplate === "/dictionary" && method === "GET") {
      lastSearchTerm = data.search || "";
      lastSearchLanguageId = data.language_id || "";
      lastListMode = "search";
    }
    if (endpointTemplate === "/dictionary/random" && method === "GET") {
      lastListMode = "random";
      lastRandomLanguageId = data.language_id || "";
    }
    if (usesRefresh && !data.refresh_token && tokenStore.refresh) {
      data.refresh_token = tokenStore.refresh;
    }
    if (form.id === "definition-form") {
      if (!data.language_id) {
        showToast("Select a language before saving.", event.submitter);
        return;
      }
      if (!data.id && data.word) {
        const searchWord = String(data.word).trim();
        if (searchWord) {
          const lookupParams = new URLSearchParams({
            language_id: data.language_id,
            search: searchWord,
            limit: "50",
            offset: "0",
          });
          const lookup = await apiRequest({
            endpoint: `/dictionary?${lookupParams.toString()}`,
            method: "GET",
            auth: needsAuth,
          });
          if (lookup.ok && Array.isArray(lookup.data)) {
            const exact = lookup.data.find((row) => row.word === searchWord);
            if (exact) {
              data.id = String(exact.id);
            }
          }
        }
      }
      if (data.id) {
        endpointTemplate = "/dictionary/:id";
        method = "PUT";
      } else {
        endpointTemplate = "/dictionary";
        method = "POST";
      }
    }

    const endpoint = resolveEndpoint(endpointTemplate, data);
    if (endpointTemplate.includes(":id")) {
      delete data.id;
      if (endpointTemplate === "/dictionary/:id") {
        delete data.word;
      }
    }

    let endpointWithQuery = endpoint;
    const params = new URLSearchParams();
    if ((method === "GET" || method === "DELETE") && Object.keys(data).length) {
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.append(key, value);
        }
      });
    }
    if (method === "PUT" && data.language_id) {
      params.append("language_id", data.language_id);
      delete data.language_id;
    }
    const qs = params.toString();
    if (qs) {
      endpointWithQuery = `${endpoint}?${qs}`;
    }

    const body = method === "GET" || method === "DELETE" ? null : data;
    const isDefinitionSaveRequest =
      form.id === "definition-form" &&
      ((endpointTemplate === "/dictionary/:id" && method === "PUT") ||
        (endpointTemplate === "/dictionary" && method === "POST"));
    let definitionSaveAnnounced = false;
    if (isDefinitionSaveRequest) {
      showToast("Definition saved", event.submitter);
      focusRandomWords();
      definitionSaveAnnounced = true;
    }

    try {
      const res = await apiRequest({ endpoint: endpointWithQuery, method, body, auth: needsAuth });
      appendLog(`${method} ${endpointWithQuery} -> ${res.status}`, res.data);
      const isDefinitionForm = form.id === "definition-form";
      const isDefinitionSave =
        res.ok &&
        isDefinitionForm &&
        ((endpointTemplate === "/dictionary/:id" && method === "PUT") ||
          (endpointTemplate === "/dictionary" && method === "POST"));
      if (isDefinitionSave) {
        if (!definitionSaveAnnounced) {
          showToast("Definition saved", event.submitter);
          focusRandomWords();
        }
        if (endpointTemplate === "/dictionary/:id" && method === "PUT") {
          await replaceDefinedEntry(res.data.id);
        }
      } else if (isDefinitionSaveRequest && !res.ok) {
        const detail = res.data?.detail || "Save failed.";
        showToast(detail, event.submitter);
      }
      if (endpoint === "/auth/register" && res.ok) {
        const loginForm = document.getElementById("login-form");
        if (loginForm) {
          const emailInput = loginForm.querySelector('input[name="email"]');
          if (emailInput && data.email) {
            emailInput.value = data.email;
          }
          const loginTab = document.querySelector('.auth-tab[data-auth-tab="login"]');
          if (loginTab) {
            loginTab.click();
          }
          loginForm.scrollIntoView({ behavior: "smooth", block: "start" });
          const passwordInput = loginForm.querySelector('input[name="password"]');
          if (passwordInput) {
            passwordInput.focus();
          }
        }
      }
      if (resultTarget) {
        renderResult(resultTarget, res);
        if (resultTarget === "dictionary-result" && res.ok) {
          const resultEl = document.getElementById("dictionary-result");
          if (resultEl) {
            resultEl.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
      }
      if (endpoint === "/auth/login" && !res.ok) {
        const detail = res.data?.detail || "Login failed.";
        showToast(detail, event.submitter);
      }
      if (endpoint === "/auth/register" && !res.ok) {
        const detail = res.data?.detail || "Registration failed.";
        showToast(detail, event.submitter);
        if (res.status === 409 && data.email) {
          const loginForm = document.getElementById("login-form");
          if (loginForm) {
            const emailInput = loginForm.querySelector('input[name="email"]');
            if (emailInput) {
              emailInput.value = data.email;
            }
            const loginTab = document.querySelector('.auth-tab[data-auth-tab="login"]');
            if (loginTab) {
              loginTab.click();
            } else {
              showAuthOnly("login");
            }
            loginForm.scrollIntoView({ behavior: "smooth", block: "start" });
            const passwordInput = loginForm.querySelector('input[name="password"]');
            if (passwordInput) {
              passwordInput.focus();
            }
          }
        }
      }
      if (expectsToken && res.ok && res.data.access_token) {
        setTokens(res.data.access_token, res.data.refresh_token || "");
        if (endpoint === "/auth/login") {
          showDictionaryOnly();
          const dictionaryPanel = document.getElementById("panel-dictionary");
          if (dictionaryPanel) {
            dictionaryPanel.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
      }
    } catch (err) {
      appendLog(`${method} ${endpoint} failed`, { message: err.message });
    }
  });
});

function refreshUsersList() {
  const usersForm = document.querySelector('form[data-endpoint="/users"][data-method="GET"]');
  if (!usersForm) {
    return;
  }
  if (typeof usersForm.requestSubmit === "function") {
    usersForm.requestSubmit();
  } else {
    usersForm.dispatchEvent(new Event("submit", { cancelable: true }));
  }
}

const googleLoginButton = document.getElementById("google-login");
if (googleLoginButton) {
  googleLoginButton.addEventListener("click", () => {
    const inviteInput = document.getElementById("google-invite");
    const invite = inviteInput ? inviteInput.value.trim() : "";
    const url = invite ? `/auth/google/login?invite=${encodeURIComponent(invite)}` : "/auth/google/login";
    window.location.href = url;
  });
}

const logoutButton = document.getElementById("logout-button");
if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    setTokens("", "");
    setAuthPreference("login");
    showToast("Signed out.", logoutButton);
    if (!isAdminRoute) {
      showAuthOnly("login");
    }
  });
}

const randomForm = document.querySelector('form[data-endpoint="/dictionary/random"]');
if (randomForm) {
  const countInput = randomForm.querySelector('input[name="limit"]');
  const submitButton = document.getElementById("random-submit");
  const updateRandomLabel = () => {
    const value = countInput ? parseInt(countInput.value, 10) : 10;
    const safeValue = Number.isFinite(value) && value > 0 ? value : 10;
    if (submitButton) {
      submitButton.textContent = `Show ${safeValue} random words`;
    }
  };
  if (countInput) {
    countInput.addEventListener("input", updateRandomLabel);
    updateRandomLabel();
  }
}

const dictionaryForm = document.querySelector('form[data-endpoint="/dictionary"][data-method="GET"]');
if (dictionaryForm) {
  const statusSelect = dictionaryForm.querySelector('select[name="status"]');
  if (statusSelect) {
    statusSelect.addEventListener("change", () => {
      if (typeof dictionaryForm.requestSubmit === "function") {
        dictionaryForm.requestSubmit();
      } else {
        dictionaryForm.dispatchEvent(new Event("submit", { cancelable: true }));
      }
      const results = document.getElementById("dictionary-result");
      if (results) {
        results.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }
}

async function replaceDefinedEntry(entryId) {
  if (lastListMode !== "random") {
    return;
  }
  const list = document.querySelector("#dictionary-result .item-list");
  if (list) {
    const row = list.querySelector(`[data-entry-id="${entryId}"]`);
    if (row) {
      row.remove();
    }
  }
  if (!lastRandomLanguageId) {
    return;
  }
  try {
    const res = await apiRequest({
      endpoint: `/dictionary/random?language_id=${lastRandomLanguageId}&limit=1`,
      method: "GET",
      auth: true,
    });
    if (res.ok && Array.isArray(res.data) && res.data.length) {
      const entry = res.data[0];
      let list = document.querySelector("#dictionary-result .item-list");
      if (!list) {
        const container = document.getElementById("dictionary-result");
        if (!container) return;
        container.textContent = "";
        list = document.createElement("div");
        list.className = "item-list";
        container.appendChild(list);
      }
      const row = document.createElement("div");
      row.className = "item-row";
      row.dataset.entryId = entry.id;

      const meta = entry.definition ? "defined" : "needs definition";
      const by = entry.updated_by_email ? `, by ${entry.updated_by_email}` : "";
      const label = document.createElement("span");
      label.textContent = `#${entry.id} ${entry.word} (${meta}${by})`;

      const useButton = document.createElement("button");
      useButton.type = "button";
      useButton.className = "ghost small";
      useButton.textContent = entry.definition ? "Edit" : "Define";
      useButton.addEventListener("click", () => {
        const form = document.getElementById("definition-form");
        if (!form) return;
        const idInput = form.querySelector('input[name="id"]');
        const wordInput = form.querySelector('input[name="word"]');
        const definitionInput = form.querySelector('textarea[name="definition"]');
        const languageInput = form.querySelector('input[name="language_id"]');
        if (idInput) idInput.value = entry.id;
        if (idInput) idInput.placeholder = "";
        if (wordInput) wordInput.value = entry.word;
        if (definitionInput) definitionInput.value = entry.definition || "";
        if (languageInput) languageInput.value = entry.language_id;
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      row.appendChild(label);
      row.appendChild(useButton);
      list.appendChild(row);
    }
  } catch (err) {
    appendLog("Random replace failed", { message: err.message });
  }
}

document.querySelectorAll(".menu-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.panel;
    document.querySelectorAll(".menu-btn").forEach((btn) => {
      btn.classList.toggle("active", btn === button);
    });
    document.querySelectorAll(".panel").forEach((panel) => {
      panel.classList.toggle("panel-active", panel.id === target);
    });
  });
});

document.querySelectorAll(".sub-menu-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.authView;
    document.querySelectorAll(".sub-menu-btn").forEach((btn) => {
      btn.classList.toggle("active", btn === button);
    });
    const basic = document.querySelector(".auth-basic");
    const advanced = document.querySelector(".auth-advanced");
    if (!basic || !advanced) return;
    basic.classList.toggle("is-hidden", view !== "basic");
    advanced.classList.toggle("is-hidden", view !== "advanced");
  });
});

document.querySelectorAll(".auth-tab").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.authTab;
    setAuthPreference(target);
    document.querySelectorAll(".auth-tab").forEach((btn) => {
      btn.classList.toggle("active", btn === button);
    });
    document.querySelectorAll(".auth-basic form").forEach((form) => {
      form.classList.toggle("is-hidden", form.dataset.authTab !== target);
    });
  });
});

if (toolsToggle && toolsPanel) {
  toolsToggle.addEventListener("click", () => {
    toolsPanel.classList.toggle("is-hidden");
  });
}

document.querySelectorAll("[data-clafrica=\"true\"]").forEach((input) => {
  input.addEventListener("keydown", applyClafricaReplacement);
  input.addEventListener("input", applyClafricaOnInput);
});

if (languageInput) {
  languageInput.addEventListener("click", () => {
    renderLanguageDropdown(languageCache, languageInput.value.trim(), true);
  });
  languageInput.addEventListener("input", () => {
    const query = languageInput.value.trim();
    const filtered = query
      ? languageCache.filter((row) => row.name.toLowerCase().includes(query.toLowerCase()))
      : languageCache;
    renderLanguageDropdown(filtered, query, true);
    const match = findLanguageMatch(query);
    if (match) {
      setLanguage(match);
    }
  });
  document.addEventListener("click", (event) => {
    if (!languageDropdown || !languageInput) {
      return;
    }
    if (languageDropdown.contains(event.target) || languageInput.contains(event.target)) {
      return;
    }
    closeLanguageDropdown();
  });
}

if (spellcheckToggle) {
  const updateSpellcheck = () => {
    const enabled = spellcheckToggle.checked;
    document.querySelectorAll('textarea[data-clafrica="true"], input[data-clafrica="true"]').forEach((el) => {
      el.spellcheck = enabled;
    });
  };
  spellcheckToggle.addEventListener("change", updateSpellcheck);
  updateSpellcheck();
}

const isAdminRoute = window.location.pathname.startsWith("/admin");
document.querySelectorAll(".admin-only").forEach((el) => {
  if (!isAdminRoute) {
    el.classList.add("is-hidden");
  }
});
if (isAdminRoute) {
  document.querySelectorAll(".invite-field").forEach((el) => {
    el.classList.add("is-hidden");
  });
}

function showAuthOnly(defaultTab = "register") {
  const authPanel = document.getElementById("panel-auth");
  document.querySelectorAll(".panel").forEach((panel) => {
    if (panel !== authPanel) {
      panel.classList.remove("panel-active");
      panel.classList.add("is-hidden");
    }
  });
  if (authPanel) {
    authPanel.classList.add("panel-active");
    authPanel.classList.remove("is-hidden");
  }
  document.querySelectorAll(".auth-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.authTab === defaultTab);
  });
  document.querySelectorAll(".auth-basic form").forEach((form) => {
    form.classList.toggle("is-hidden", form.dataset.authTab !== defaultTab);
  });
}

function showDictionaryOnly() {
  const dictPanel = document.getElementById("panel-dictionary");
  const authPanel = document.getElementById("panel-auth");
  if (authPanel) {
    authPanel.classList.remove("panel-active");
    authPanel.classList.add("is-hidden");
  }
  document.querySelectorAll(".panel").forEach((panel) => {
    if (panel !== dictPanel) {
      panel.classList.remove("panel-active");
    }
  });
  if (dictPanel) {
    dictPanel.classList.add("panel-active");
    dictPanel.classList.remove("is-hidden");
  }
  document.querySelectorAll(".menu-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.panel === "panel-dictionary");
  });
}

if (!isAdminRoute) {
  const firstVisitKey = "auth_first_visit_done";
  const hasTokens = Boolean(tokenStore.access);
  const firstVisit = !sessionStorage.getItem(firstVisitKey);
  if (!hasTokens && firstVisit) {
    showAuthOnly("register");
    sessionStorage.setItem(firstVisitKey, "true");
  } else {
    showAuthOnly(getPreferredAuthTab());
  }
}

if (isAdminRoute) {
  const registerTab = document.querySelector('.auth-tab[data-auth-tab="register"]');
  const loginTab = document.querySelector('.auth-tab[data-auth-tab="login"]');
  const registerForm = document.querySelector('.auth-basic form[data-auth-tab="register"]');
  const loginForm = document.querySelector('.auth-basic form[data-auth-tab="login"]');
  const authTabs = document.querySelector(".auth-tabs");
  const subMenu = document.querySelector(".sub-menu");
  const registerResult = document.getElementById("register-result");
  if (registerTab) registerTab.classList.add("is-hidden");
  if (registerTab) registerTab.classList.remove("active");
  if (registerForm) registerForm.classList.add("is-hidden");
  if (loginTab) loginTab.classList.add("active");
  if (loginForm) loginForm.classList.remove("is-hidden");
  if (authTabs) authTabs.classList.add("is-hidden");
  if (subMenu) subMenu.classList.add("is-hidden");
  if (registerResult) registerResult.classList.add("is-hidden");
  const registerButtons = document.querySelectorAll(
    '.auth-basic form[data-auth-tab="register"] button, .auth-basic form[data-auth-tab="register"] .result'
  );
  registerButtons.forEach((el) => el.classList.add("is-hidden"));
  if (loginForm) {
    let loginButton = loginForm.querySelector('button[type="submit"]');
    if (!loginButton) {
      loginButton = document.createElement("button");
      loginButton.type = "submit";
      loginButton.textContent = "Login";
      loginForm.appendChild(loginButton);
    }
    loginButton.classList.remove("is-hidden");
  }
}

const activeAuthTab = document.querySelector(".auth-tab.active");
if (activeAuthTab) {
  const target = activeAuthTab.dataset.authTab;
  document.querySelectorAll(".auth-basic form").forEach((form) => {
    form.classList.toggle("is-hidden", form.dataset.authTab !== target);
  });
}

renderTokens();
loadCurrentUser().then((user) => {
  if (!isAdminRoute) {
    if (user && tokenStore.access) {
      showDictionaryOnly();
    } else {
      showAuthOnly(getPreferredAuthTab());
    }
  }
});
loadClafricaMap();
loadLanguages();

const params = new URLSearchParams(window.location.search);
const verifyToken = params.get("verify_token");
if (verifyToken) {
  apiRequest({
    endpoint: "/auth/verify/confirm",
    method: "POST",
    body: { token: verifyToken },
  }).then((res) => {
    if (res.ok) {
      showToast("Email verified.");
      params.delete("verify_token");
      const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
      window.history.replaceState({}, "", cleanUrl);
    } else {
      showToast("Verification failed.");
    }
  });
}
