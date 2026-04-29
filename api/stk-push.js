const { friendlyDarajaMessage, friendlyExceptionMessage } = require("../lib/error-messages");

const tokenCache = new Map();

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { userMessage: "This payment endpoint only accepts send requests from the website." });
    return;
  }

  try {
    const body = parseBody(req.body);
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
      sendJson(res, 400, {
        userMessage: `Some Daraja settings are missing: ${missing.join(", ")}. Fill them in Settings and try again.`,
      });
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
    if (!darajaResponse.ok) {
      sendJson(res, darajaResponse.status, {
        userMessage: friendlyDarajaMessage(darajaResponse.status, darajaBody),
        details: darajaBody,
      });
      return;
    }
    sendJson(res, darajaResponse.status, darajaBody);
  } catch (error) {
    sendJson(res, 500, {
      userMessage: friendlyExceptionMessage(error),
      details: error.message || String(error),
    });
  }
};

async function getAccessToken(config) {
  const cacheKey = `${config.environment}:${config.consumerKey}:${config.shortcode}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.token;
  }

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
  const expiresIn = Number(body.expires_in || 3599);
  tokenCache.set(cacheKey, {
    token: body.access_token,
    expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000,
  });
  return body.access_token;
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

function parseBody(body) {
  if (!body) return {};
  if (typeof body === "object") return body;
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

function sendJson(res, status, body) {
  res.status(status).json(body);
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
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
