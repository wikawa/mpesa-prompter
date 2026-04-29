# M-Pesa Prompter Website

A reusable M-Pesa STK Push website. Anyone can open the site, enter their own Daraja settings, paste phone numbers, and send payment prompts without writing code.

## Run Locally

This project uses Node.js for the Daraja proxy. Use Node 18 or newer.

```bash
npm run check
npm start
```

Open:

```text
http://localhost:3000
```

## How Users Use It

1. Open the website.
2. Go to `Settings`.
3. Enter their own Daraja details:
   - Environment
   - Consumer key
   - Consumer secret
   - Business shortcode
   - Passkey
   - Receiving Paybill/Till
   - Callback URL
4. Leave `Proxy endpoint` as `/api/stk-push`.
5. Save settings, then send prompts from the `Send` tab.

Settings are saved in the user's browser `localStorage`.

## Why There Is A Proxy

Browsers cannot reliably call Safaricom Daraja directly because of CORS. The website sends the user's settings and payment request to:

```text
/api/stk-push
```

The Node server then calls Daraja and returns the result to the browser.

You can confirm the Node server is running here:

```text
/api/health
```

## Live Deployment

Deploy this whole folder to a Node-capable host such as Render, Railway, Fly.io, a VPS, or any server that can run:

```bash
npm start
```

If you deploy on Vercel, the `/api` folder provides serverless functions for:

- `/api/stk-push`
- `/api/mpesa-callback`
- `/api/health`

On a live HTTPS domain, users can keep the default proxy endpoint:

```text
/api/stk-push
```

For callbacks, users can either enter their own public callback URL or use the deployed website's callback route:

```text
https://your-domain.com/api/mpesa-callback
```

Server environment variables are optional fallbacks. If a user fills settings in the website, those user-provided settings are used first.
