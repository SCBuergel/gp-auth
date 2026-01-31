# GnosisPay SIWE Minimal Demo

This is a minimal vanilla JS web app that demonstrates:
- Fetching a nonce from GnosisPay
- Performing a SIWE signature with a wallet
- Exchanging the SIWE message + signature for a bearer token
- Fetching and rendering card transactions

It includes a tiny Node server that:
- Serves the static `index.html` and `app.js`
- Proxies `/api/*` to `https://api.gnosispay.com` to avoid CORS issues

## Requirements

- Node.js 18+ (tested with Node 20+)
- A browser with an injected wallet (e.g., MetaMask)

## Run locally

1. Start the server:

   ```bash
   node server.js
   ```

2. Open the app:

   ```
   http://localhost:8080
   ```

## Usage flow

1. **Connect Wallet** — connects the injected wallet.
2. **Fetch Nonce** — fetches a nonce from GnosisPay.
3. **Sign SIWE** — signs a SIWE message (logs message + signature).
4. **Gnosis Pay Login** — exchanges message + signature for a token.
5. **Fetch Transactions** — fetches and logs transaction data.

Open DevTools Console to see detailed logs for each step.
