# M-Pesa Prompter Website

Static website plus a small Node backend for Safaricom Daraja STK Push.

## Run Locally

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## Live Website Setup

Deploy this whole folder to a Node-capable host such as Render, Railway, Fly.io, VPS, or any server that can run:

```bash
npm start
```

Set these environment variables on the server:

```text
MPESA_ENVIRONMENT=live
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_SHORTCODE=...
MPESA_PASSKEY=...
MPESA_PARTY_B=...
```

The website already uses:

- Proxy endpoint: `/api/stk-push`
- Callback URL: `https://your-live-domain.com/api/mpesa-callback`

So users should leave those fields unchanged. When deployed on a real HTTPS domain, the server can automatically use that domain for the callback URL. You may still set `MPESA_CALLBACK_URL` manually if Safaricom requires a specific URL.

## What The Proxy Does

The browser sends payment details to `/api/stk-push`.

The server then:

- Gets a Daraja access token
- Builds the secure STK Push password
- Sends the request to Safaricom
- Receives callbacks at `/api/mpesa-callback`

This avoids browser CORS problems and keeps Daraja secrets on the server.
