const storageKey = "mpesa_bulk_prompter_settings";
const defaultProxyUrl = "/api/stk-push";
const defaultCallbackPath = "/api/mpesa-callback";
const defaultCallbackUrl = window.location.protocol.startsWith("http")
  ? `${window.location.origin}${defaultCallbackPath}`
  : defaultCallbackPath;

const fields = {
  numbers: document.querySelector("#numbers"),
  amount: document.querySelector("#amount"),
  transactionType: document.querySelector("#transactionType"),
  accountReference: document.querySelector("#accountReference"),
  description: document.querySelector("#description"),
  environment: document.querySelector("#environment"),
  proxyUrl: document.querySelector("#proxyUrl"),
  consumerKey: document.querySelector("#consumerKey"),
  consumerSecret: document.querySelector("#consumerSecret"),
  shortcode: document.querySelector("#shortcode"),
  passkey: document.querySelector("#passkey"),
  partyB: document.querySelector("#partyB"),
  callbackUrl: document.querySelector("#callbackUrl"),
};

const elements = {
  settingsState: document.querySelector("#settingsState"),
  validationSummary: document.querySelector("#validationSummary"),
  recipientMeta: document.querySelector("#recipientMeta"),
  recipientList: document.querySelector("#recipientList"),
  resultSummary: document.querySelector("#resultSummary"),
  resultsList: document.querySelector("#resultsList"),
  previewAmount: document.querySelector("#previewAmount"),
  previewCount: document.querySelector("#previewCount"),
  settingsMessage: document.querySelector("#settingsMessage"),
};

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  localStorage.setItem(storageKey, JSON.stringify(settings));
}

function applySettings(settings) {
  fields.environment.value = settings.environment || "sandbox";
  fields.proxyUrl.value = settings.proxyUrl || defaultProxyUrl;
  fields.consumerKey.value = settings.consumerKey || "";
  fields.consumerSecret.value = settings.consumerSecret || "";
  fields.shortcode.value = settings.shortcode || "";
  fields.passkey.value = settings.passkey || "";
  fields.partyB.value = settings.partyB || "";
  fields.callbackUrl.value = settings.callbackUrl || defaultCallbackUrl;
  updateSettingsState();
}

function getSettings() {
  return {
    environment: fields.environment.value,
    proxyUrl: fields.proxyUrl.value.trim() || defaultProxyUrl,
    consumerKey: fields.consumerKey.value.trim(),
    consumerSecret: fields.consumerSecret.value.trim(),
    shortcode: fields.shortcode.value.trim(),
    passkey: fields.passkey.value.trim(),
    partyB: fields.partyB.value.trim(),
    callbackUrl: fields.callbackUrl.value.trim() || defaultCallbackUrl,
  };
}

function missingSettings(settings) {
  const required = ["consumerKey", "consumerSecret", "shortcode", "passkey", "callbackUrl"];
  return required.filter((key) => !settings[key]);
}

function updateSettingsState() {
  const missing = missingSettings(getSettings());
  if (missing.length === 0) {
    elements.settingsState.textContent = "Settings ready";
    elements.settingsState.classList.add("ready");
    return;
  }
  elements.settingsState.textContent = `${missing.length} settings missing`;
  elements.settingsState.classList.remove("ready");
}

function parseNumbers(raw) {
  const unique = [];
  const seen = new Set();
  raw
    .split(/[\n,\s;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      if (!seen.has(item)) {
        seen.add(item);
        unique.push(item);
      }
    });
  return unique;
}

function normalizePhone(raw) {
  let phone = raw.trim().replace(/[^\d+]/g, "");
  if (phone.startsWith("+")) phone = phone.slice(1);
  if (phone.startsWith("0") && phone.length === 10) phone = `254${phone.slice(1)}`;
  if ((phone.startsWith("7") || phone.startsWith("1")) && phone.length === 9) phone = `254${phone}`;
  return /^254[17]\d{8}$/.test(phone) ? phone : null;
}

function getRecipients() {
  return parseNumbers(fields.numbers.value).map((raw) => ({
    raw,
    phone: normalizePhone(raw),
  }));
}

function renderRecipients() {
  const recipients = getRecipients();
  const valid = recipients.filter((item) => item.phone);
  const invalid = recipients.length - valid.length;
  const amount = Number(fields.amount.value || 0);

  elements.previewAmount.textContent = amount > 0 ? amount.toLocaleString() : "0";
  elements.previewCount.textContent = `${valid.length} recipient${valid.length === 1 ? "" : "s"}`;
  elements.recipientMeta.textContent = recipients.length
    ? `${valid.length} valid, ${invalid} invalid`
    : "No numbers yet";
  elements.validationSummary.textContent = invalid
    ? `${invalid} number${invalid === 1 ? "" : "s"} will be skipped.`
    : "Ready.";

  elements.recipientList.innerHTML = "";
  if (!recipients.length) {
    elements.recipientList.innerHTML = '<p class="muted">Paste phone numbers to preview normalized recipients.</p>';
    return;
  }

  recipients.forEach((item) => {
    const row = document.createElement("div");
    row.className = `recipient-item ${item.phone ? "" : "invalid"}`;
    row.innerHTML = `
      <span>${escapeHtml(item.phone || item.raw)}</span>
      <span class="badge ${item.phone ? "" : "failed"}">${item.phone ? "Valid" : "Invalid"}</span>
    `;
    elements.recipientList.appendChild(row);
  });
}

function baseUrlFor(environment) {
  return environment === "live" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
}

function timestamp() {
  const now = new Date();
  const two = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`;
}

function buildPayload(settings, phone) {
  const stamp = timestamp();
  return {
    BusinessShortCode: settings.shortcode,
    Password: btoa(`${settings.shortcode}${settings.passkey}${stamp}`),
    Timestamp: stamp,
    TransactionType: fields.transactionType.value,
    Amount: Number(fields.amount.value),
    PartyA: phone,
    PartyB: settings.partyB || settings.shortcode,
    PhoneNumber: phone,
    CallBackURL: settings.callbackUrl,
    AccountReference: fields.accountReference.value.trim() || "Payment",
    TransactionDesc: fields.description.value.trim() || "Payment Request",
  };
}

function buildProxyPayload(settings, phone) {
  const payload = {
    TransactionType: fields.transactionType.value,
    Amount: Number(fields.amount.value),
    PartyA: phone,
    PhoneNumber: phone,
    AccountReference: fields.accountReference.value.trim() || "Payment",
    TransactionDesc: fields.description.value.trim() || "Payment Request",
    CallBackURL: settings.callbackUrl,
  };

  if (settings.shortcode) payload.BusinessShortCode = settings.shortcode;
  if (settings.partyB || settings.shortcode) payload.PartyB = settings.partyB || settings.shortcode;
  return payload;
}

async function getAccessToken(settings) {
  const response = await fetch(`${baseUrlFor(settings.environment)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: {
      Authorization: `Basic ${btoa(`${settings.consumerKey}:${settings.consumerSecret}`)}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Token request failed: HTTP ${response.status}`);
  }
  const body = await response.json();
  if (!body.access_token) {
    throw new Error("Token response did not include access_token.");
  }
  return body.access_token;
}

async function sendPrompt(settings, phone) {
  const payload = settings.proxyUrl ? buildProxyPayload(settings, phone) : buildPayload(settings, phone);

  if (settings.proxyUrl) {
    const response = await fetch(settings.proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings, payload }),
    });
    const body = await readResponse(response);
    return response.ok ? successMessage(phone, body) : failedMessage(phone, `Proxy HTTP ${response.status}: ${formatResponse(body)}`);
  }

  const token = await getAccessToken(settings);
  const response = await fetch(`${baseUrlFor(settings.environment)}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await readResponse(response);
  return response.ok ? successMessage(phone, body) : failedMessage(phone, `Daraja HTTP ${response.status}: ${formatResponse(body)}`);
}

async function readResponse(response) {
  const text = await response.text();
  if (!text) return "";
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function successMessage(phone, body) {
  const responseCode = String(body.ResponseCode ?? body.responseCode ?? "");
  const checkout = body.CheckoutRequestID || body.checkoutRequestId || "";
  const message = body.CustomerMessage || body.customerMessage || body.ResponseDescription || "Prompt sent.";
  return {
    phone,
    ok: responseCode === "0" || responseCode === "",
    message: checkout ? `${message} CheckoutRequestID: ${checkout}` : message,
  };
}

function failedMessage(phone, message) {
  return { phone, ok: false, message: String(message) };
}

function formatResponse(body) {
  return typeof body === "string" ? body : JSON.stringify(body);
}

function renderResults(results) {
  const success = results.filter((item) => item.ok).length;
  elements.resultSummary.textContent = `Done. Success: ${success}/${results.length}`;
  elements.resultsList.innerHTML = "";

  results.forEach((item) => {
    const row = document.createElement("div");
    row.className = `result-item ${item.ok ? "" : "failed"}`;
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(item.phone)}</strong>
        <p class="muted">${escapeHtml(item.message)}</p>
      </div>
      <span class="badge ${item.ok ? "" : "failed"}">${item.ok ? "Sent" : "Failed"}</span>
    `;
    elements.resultsList.appendChild(row);
  });
}

function setActiveTab(tabName) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.tab === tabName);
  });
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === `${tabName}Panel`);
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
});

document.querySelector("#settingsForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const settings = getSettings();
  saveSettings(settings);
  updateSettingsState();
  elements.settingsMessage.textContent = "Settings saved.";
});

document.querySelector("#clearSettings").addEventListener("click", () => {
  localStorage.removeItem(storageKey);
  applySettings({});
  elements.settingsMessage.textContent = "Settings cleared.";
});

document.querySelector("#sendForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const settings = getSettings();
  const missing = missingSettings(settings);
  const amount = Number(fields.amount.value);
  const recipients = getRecipients().filter((item) => item.phone);

  if (missing.length) {
    elements.validationSummary.textContent = `Missing settings: ${missing.join(", ")}`;
    setActiveTab("settings");
    return;
  }
  if (!Number.isInteger(amount) || amount < 1) {
    elements.validationSummary.textContent = "Enter a valid amount greater than 0.";
    return;
  }
  if (!recipients.length) {
    elements.validationSummary.textContent = "Enter at least one valid Kenyan phone number.";
    return;
  }

  setActiveTab("results");
  elements.resultSummary.textContent = `Sending prompts to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}...`;
  elements.resultsList.innerHTML = "";

  const results = [];
  for (const recipient of recipients) {
    try {
      results.push(await sendPrompt(settings, recipient.phone));
    } catch (error) {
      const corsHint = String(error.message || error).includes("Failed to fetch")
        ? " Direct browser calls are probably blocked by CORS. Add a proxy endpoint in Settings."
        : "";
      results.push(failedMessage(recipient.phone, `${error.message || error}.${corsHint}`));
    }
    renderResults(results);
  }
});

["input", "change"].forEach((eventName) => {
  fields.numbers.addEventListener(eventName, renderRecipients);
  fields.amount.addEventListener(eventName, renderRecipients);
  Object.values(fields).forEach((field) => field.addEventListener(eventName, updateSettingsState));
});

applySettings(loadSettings());
renderRecipients();
