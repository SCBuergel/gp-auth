import { SiweMessage } from "https://esm.sh/siwe@2.3.2?bundle";
import { ethers } from "https://esm.sh/ethers@6.10.0?bundle";

console.log("[init] modules loaded");

const API_BASE = "";
const CHAIN_ID = 100;

const addressEl = document.getElementById("address");
const nonceEl = document.getElementById("nonce");
const tokenEl = document.getElementById("token");
const logEl = document.getElementById("log");
const txEl = document.getElementById("tx");

const state = {
  provider: null,
  signer: null,
  address: null,
  nonce: null,
  message: null,
  signature: null,
  token: null,
};

const log = (value) => {
  const line = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  logEl.textContent = `${line}\n${logEl.textContent}`;
};

const requireProvider = () => {
  if (!window.ethereum) {
    throw new Error("No injected wallet found. Install MetaMask or a compatible wallet.");
  }
};

document.getElementById("connectBtn").addEventListener("click", async () => {
  try {
    console.log("[connect] click");
    requireProvider();
    console.log("[connect] window.ethereum detected", window.ethereum);

    state.provider = new ethers.BrowserProvider(window.ethereum);
    console.log("[connect] BrowserProvider created");

    const accounts = await state.provider.send("eth_requestAccounts", []);
    console.log("[connect] eth_requestAccounts result", accounts);

    state.signer = await state.provider.getSigner();
    console.log("[connect] signer acquired", state.signer);

    state.address = await state.signer.getAddress();
    console.log("[connect] address", state.address);

    addressEl.textContent = state.address;
    log("Wallet connected.");
  } catch (err) {
    console.error("[connect] error", err);
    log(err.message || err);
  }
});

document.getElementById("nonceBtn").addEventListener("click", async () => {
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/nonce`);
    if (!res.ok) throw new Error(`Nonce request failed: ${res.status}`);
    const nonce = (await res.text()).trim();
    state.nonce = nonce;
    nonceEl.textContent = nonce;
    log({ nonce });
  } catch (err) {
    log(err.message || err);
  }
});

document.getElementById("signBtn").addEventListener("click", async () => {
  try {
    if (!state.signer || !state.address) throw new Error("Connect wallet first.");
    if (!state.nonce) throw new Error("Fetch nonce first.");

    const domain = "something.com";
    const uri = "https://something.com/";

    const message = new SiweMessage({
      domain,
      address: state.address,
      statement: "Sign in with Ethereum to Gnosis Pay",
      uri,
      version: "1",
      chainId: CHAIN_ID,
      nonce: state.nonce,
      issuedAt: new Date().toISOString(),
    }).prepareMessage();

    const signature = await state.signer.signMessage(message);
    state.message = message;
    state.signature = signature;
    console.log("[siwe] message", message);
    console.log("[siwe] signature", signature);
    log({ message, signature });
  } catch (err) {
    log(err.message || err);
  }
});

document.getElementById("authBtn").addEventListener("click", async () => {
  try {
    if (!state.message || !state.signature) throw new Error("Sign SIWE first.");

    const res = await fetch(`${API_BASE}/api/v1/auth/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: state.message,
        signature: state.signature,
        ttlInSeconds: 36000,
      }),
    });
    if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
    const json = await res.json();
    state.token = json?.accessToken || json?.token || json?.bearerToken || "";
    tokenEl.textContent = state.token ? `${state.token.slice(0, 12)}...` : "(missing token field)";
    log(json);
  } catch (err) {
    log(err.message || err);
  }
});

document.getElementById("txBtn").addEventListener("click", async () => {
  try {
    if (!state.token) throw new Error("Authenticate first to get a token.");

    const limit = 25;
    let offset = 0;
    let nextPath = `/api/v1/cards/transactions?limit=${limit}&offset=${offset}`;
    const all = [];

    while (nextPath) {
      const res = await fetch(`${API_BASE}${nextPath}`, {
        headers: {
          accept: "*/*",
          authorization: `Bearer ${state.token}`,
        },
      });
      if (!res.ok) throw new Error(`Transactions failed: ${res.status}`);
      const json = await res.json();
      console.log("[tx] raw response", json);
      const items = json?.items || json?.transactions || json?.data || json || [];
      if (Array.isArray(items)) {
        all.push(...items);
      } else {
        all.push(items);
      }

      nextPath = json?.nextPath || json?.next_path || "";
      if (!nextPath && items.length === limit) {
        offset += limit;
        nextPath = `/api/v1/cards/transactions?limit=${limit}&offset=${offset}`;
      }
    }

    txEl.textContent = JSON.stringify(all, null, 2);
    log(`Fetched ${all.length} transactions.`);
  } catch (err) {
    log(err.message || err);
  }
});
