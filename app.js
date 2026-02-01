import { ethers } from "https://esm.sh/ethers@6.10.0?bundle";

console.log("[init] modules loaded");

const API_BASE = "";
const CHAIN_ID = 100;

const addressEl = document.getElementById("address");
const nonceEl = document.getElementById("nonce");
const tokenEl = document.getElementById("token");
const logEl = document.getElementById("log");
const txEl = document.getElementById("tx");
const ephemeralTokenEl = document.getElementById("ephemeralToken");
const ephemeralExpiresEl = document.getElementById("ephemeralExpires");
const pseTokenEl = document.getElementById("pseToken");
const domainInput = document.getElementById("domainInput");
const uriInput = document.getElementById("uriInput");
const statementInput = document.getElementById("statementInput");
const nonceInput = document.getElementById("nonceInput");
const messageInput = document.getElementById("messageInput");
const signatureInput = document.getElementById("signatureInput");
const ttlInput = document.getElementById("ttlInput");
const stepButtons = [
  document.getElementById("connectBtn"),
  document.getElementById("nonceBtn"),
  document.getElementById("signBtn"),
  document.getElementById("authBtn"),
  document.getElementById("cardsBtn"),
  document.getElementById("pseTokenBtn"),
  document.getElementById("pseBtn"),
  document.getElementById("txBtn"),
];

const setActiveStep = (index) => {
  stepButtons.forEach((button, i) => {
    if (!button) return;
    button.classList.toggle("step-active", i === index);
  });
};

const advanceStep = (currentIndex) => {
  const nextIndex = Math.min(currentIndex + 1, stepButtons.length - 1);
  setActiveStep(nextIndex);
};

setActiveStep(0);

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

const maskValue = (value) => {
  if (!value) return "-";
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

const buildSiweMessage = ({ domain, address, statement, uri, nonce, issuedAt }) => {
  return (
    `${domain} wants you to sign in with your Ethereum account:\n` +
    `${address}\n\n` +
    `${statement}\n\n` +
    `URI: ${uri}\n` +
    `Version: 1\n` +
    `Chain ID: ${CHAIN_ID}\n` +
    `Nonce: ${nonce}\n` +
    `Issued At: ${issuedAt}`
  );
};

const requireProvider = () => {
  if (!window.ethereum) {
    throw new Error("No injected wallet found. Install MetaMask or a compatible wallet.");
  }
};

document.getElementById("connectBtn").addEventListener("click", async () => {
  try {
    advanceStep(0);
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
    advanceStep(1);
    const res = await fetch(`${API_BASE}/api/v1/auth/nonce`);
    if (!res.ok) throw new Error(`Nonce request failed: ${res.status}`);
    const nonce = (await res.text()).trim();
    state.nonce = nonce;
    nonceEl.textContent = nonce;
    nonceInput.value = nonce;
    log({ nonce });
  } catch (err) {
    log(err.message || err);
  }
});

document.getElementById("signBtn").addEventListener("click", async () => {
  try {
    advanceStep(2);
    if (!state.signer || !state.address) throw new Error("Connect wallet first.");
    const nonce = nonceInput.value.trim();
    if (!nonce) throw new Error("Nonce is required.");

    const domain = domainInput.value.trim();
    const uri = uriInput.value.trim();
    const statement = statementInput.value.trim();
    if (!domain) throw new Error("Domain is required.");
    if (!statement) throw new Error("Statement is required.");

    const message = buildSiweMessage({
      domain,
      address: state.address,
      statement,
      uri,
      nonce,
      issuedAt: new Date().toISOString(),
    });

    const signature = await state.signer.signMessage(message);
    state.message = message;
    state.signature = signature;
    messageInput.value = message;
    signatureInput.value = signature;
    console.log("[siwe] message", message);
    console.log("[siwe] signature", signature);
    log({ message, signature });
  } catch (err) {
    log(err.message || err);
  }
});

document.getElementById("authBtn").addEventListener("click", async () => {
  try {
    advanceStep(3);
    const message = messageInput.value.trim() || state.message;
    const signature = signatureInput.value.trim() || state.signature;
    const ttlValue = ttlInput.value.trim();
    const ttlInSeconds = ttlValue ? Number(ttlValue) : 36000;
    if (!message || !signature) throw new Error("Sign SIWE first.");
    if (!Number.isFinite(ttlInSeconds) || ttlInSeconds <= 0) {
      throw new Error("TTL must be a positive number.");
    }

    const res = await fetch(`${API_BASE}/api/v1/auth/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        signature,
        ttlInSeconds,
      }),
    });
    if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
    const json = await res.json();
    state.token = json?.accessToken || json?.token || json?.bearerToken || "";
    tokenEl.textContent = maskValue(state.token);
    log(json);
  } catch (err) {
    log(err.message || err);
  }
});

document.getElementById("cardsBtn").addEventListener("click", async () => {
  try {
    advanceStep(4);
    if (!state.token) throw new Error("Authenticate first to get a token.");

    const res = await fetch(`${API_BASE}/api/v1/cards`, {
      headers: {
        accept: "*/*",
        authorization: `Bearer ${state.token}`,
      },
    });
    if (!res.ok) throw new Error(`Cards failed: ${res.status}`);
    const json = await res.json();
    console.log("[cards] raw response", json);
    log(json);
  } catch (err) {
    log(err.message || err);
  }
});

document.getElementById("pseTokenBtn").addEventListener("click", async () => {
  try {
    advanceStep(5);
    if (!state.token) throw new Error("Authenticate first to get a token.");

    const res = await fetch(`${API_BASE}/pse-public/api/v1/auth/token`, {
      headers: {
        accept: "*/*",
        authorization: `Bearer ${state.token}`,
      },
    });
    if (!res.ok) throw new Error(`PSE token failed: ${res.status}`);
    const json = await res.json();
    console.log("[pse-token] raw response", json);
    const token =
      json?.token ||
      json?.accessToken ||
      json?.bearerToken ||
      json?.responseObject?.token ||
      "";
    pseTokenEl.textContent = maskValue(token);
    log(json);
  } catch (err) {
    log(err.message || err);
  }
});

document.getElementById("pseBtn").addEventListener("click", async () => {
  try {
    advanceStep(6);
    const res = await fetch(`${API_BASE}/pse/token`);
    if (!res.ok) throw new Error(`PSE token failed: ${res.status}`);
    const json = await res.json();
    console.log("[pse] raw response", json);
    const token = json?.responseObject?.data?.ephemeralToken || "";
    const expiresAt = json?.responseObject?.data?.expiresAt || "";
    ephemeralTokenEl.textContent = maskValue(token);
    ephemeralExpiresEl.textContent = expiresAt || "-";
    log(json);
  } catch (err) {
    log(err.message || err);
  }
});

document.getElementById("txBtn").addEventListener("click", async () => {
  try {
    advanceStep(7);
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
