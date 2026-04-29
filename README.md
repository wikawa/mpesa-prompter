# M-Pesa Prompter Website

A reusable M-Pesa STK Push website. Anyone can open the site, enter their own Daraja settings, paste phone numbers, and send payment prompts.

## Run Locally

```bash
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

## Live Deployment

Deploy this whole folder to a Node-capable host such as Render, Railway, Fly.io, a VPS, or any server that can run:

```bash
npm start
```

On a live HTTPS domain, users can keep the default proxy endpoint:

```text
/api/stk-push
```

For callbacks, users can either enter their own public callback URL or use the deployed website's callback route:

```text
https://your-domain.com/api/mpesa-callback
```

Server environment variables are optional fallbacks. If a user fills settings in the website, those user-provided settings are used first.
