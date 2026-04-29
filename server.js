const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 3000);
const root = __dirname;

loadEnvFile();

const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname;

    if (req.method === "GET" && pathname === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        service: "mpesa-prompter",
        proxy: "/api/stk-push",
        callback: "/api/mpesa-callback",
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/stk-push") {
      await handleStkPush(req, res);
      return;
    }

    if (req.method === "POST" && pathname === "/api/mpesa-callback") {
      const callback = await readJson(req);
      console.log("M-Pesa callback:", JSON.stringify(callback, null, 2));
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message || String(error) });
  }
});

server.listen(port, () => {
  console.log(`M-Pesa Prompter running at http://localhost:${port}`);
});

async function handleStkPush(req, res) {
  const body = await readJson(req);
  const settings = body.settings || {};
  const incomingPayload = body.payload || {};
  const config = {
    environment: value(settings.environment, process.env.MPESA_ENVIRONMENT, "sandbox"),
    consumerKey: value(settings.consumerKey, process.env.MPESA_CONSUMER_KEY),
    consumerSecret: value(settings.consumerSecret, process.env.MPESA_CONSUMER_SECRET),
    shortcode: value(settings.shortcode, process.env.MPESA_SHORTCODE),
    passkey: value(settings.passkey, process.env.MPESA_PASSKEY),
    partyB: value(settings.partyB, settings.shortcode, process.env.MPESA_PARTY_B),
    callbackUrl: value(settings.callbackUrl, process.env.MPESA_CALLBACK_URL, defaultCallbackUrl(req)),
  };

  const missing = ["consumerKey", "consumerSecret", "shortcode", "passkey", "callbackUrl"].filter((key) => !config[key]);
  if (missing.length) {
    sendJson(res, 400, { error: `Missing proxy settings: ${missing.join(", ")}` });
    return;
  }

  const token = await getAccessToken(config);
  const timestamp = getTimestamp();
  const payload = {
    ...incomingPayload,
    BusinessShortCode: config.shortcode,
    Password: Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString("base64"),
    Timestamp: timestamp,
    PartyB: config.partyB || config.shortcode,
    CallBackURL: config.callbackUrl,
  };

  const darajaResponse = await fetch(`${baseUrlFor(config.environment)}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const darajaBody = await readFetchBody(darajaResponse);
  sendJson(res, darajaResponse.status, darajaBody);
}

async function getAccessToken(config) {
  const basic = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64");
  const response = await fetch(`${baseUrlFor(config.environment)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: {
      Authorization: `Basic ${basic}`,
    },
  });
  const body = await readFetchBody(response);

  if (!response.ok) {
    throw new Error(`Token request failed: HTTP ${response.status} ${JSON.stringify(body)}`);
  }
  if (!body.access_token) {
    throw new Error("Token response did not include access_token.");
  }
  return body.access_token;
}

function serveStatic(req, res) {
  const requested = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const filePath = path.normalize(path.join(root, requested));

  if (!filePath.startsWith(root)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendText(res, 404, "Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentType(filePath),
      "Cache-Control": "no-store",
    });
    res.end(content);
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON request body."));
      }
    });
    req.on("error", reject);
  });
}

async function readFetchBody(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(status === 204 ? "" : JSON.stringify(body));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
  };
  return types[ext] || "application/octet-stream";
}

function baseUrlFor(environment) {
  return environment === "live" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
}

function defaultCallbackUrl(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  if (!host) return "";
  const proto = req.headers["x-forwarded-proto"] || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}/api/mpesa-callback`;
}

function getTimestamp() {
  const now = new Date();
  const two = (item) => String(item).padStart(2, "0");
  return `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`;
}

function value(...values) {
  return values.find((item) => typeof item === "string" && item.trim())?.trim() || "";
}

function loadEnvFile() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separator = trimmed.indexOf("=");
    if (separator === -1) return;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    const parsedValue = rawValue.replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) {
      process.env[key] = parsedValue;
    }
  });
}
