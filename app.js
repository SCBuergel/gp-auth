import { ethers } from "https://esm.sh/ethers@6.10.0?bundle";
import { SiweMessage } from "https://esm.sh/siwe@2.3.2?bundle";

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
const psePublicKeyEl = document.getElementById("psePublicKey");
const pseTokenEl = document.getElementById("pseToken");
const domainInput = document.getElementById("domainInput");
const uriInput = document.getElementById("uriInput");
const statementInput = document.getElementById("statementInput");
const useSiweLibInput = document.getElementById("useSiweLibInput");
const nonceInput = document.getElementById("nonceInput");
const messageInput = document.getElementById("messageInput");
const signatureInput = document.getElementById("signatureInput");
const ttlInput = document.getElementById("ttlInput");
const cardTokenInput = document.getElementById("cardTokenInput");
const encryptedKeyInput = document.getElementById("encryptedKeyInput");
const pseAppIdInput = document.getElementById("pseAppIdInput");
const stepButtons = [
  document.getElementById("connectBtn"),
  document.getElementById("nonceBtn"),
  document.getElementById("signBtn"),
  document.getElementById("authBtn"),
  document.getElementById("cardsBtn"),
  document.getElementById("pseTokenBtn"),
  document.getElementById("pseBtn"),
  document.getElementById("publicKeyBtn"),
  document.getElementById("detailsBtn"),
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
  cardId: null,
  cardToken: null,
  pseToken: null,
  ephemeralToken: null,
  psePublicKey: null,
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
  const siwe = new SiweMessage({
    domain,
    address,
    statement,
    uri,
    version: "1",
    chainId: CHAIN_ID,
    nonce,
    issuedAt,
  });
  return siwe.prepareMessage();
};

const buildSiweMessageVanilla = ({
  domain,
  address,
  statement,
  uri,
  nonce,
  issuedAt,
}) => {
  const header = `${domain} wants you to sign in with your Ethereum account:\n${address}`;
  const statementBlock = statement ? `\n\n${statement}` : "";
  const fields = [
    `URI: ${uri}`,
    "Version: 1",
    `Chain ID: ${CHAIN_ID}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ];
  return `${header}${statementBlock}\n\n${fields.join("\n")}`;
};

const DEFAULT_ADDRESS = "0x0000000000000000000000000000000000000000";
let messageInputTouched = false;

if (messageInput) {
  messageInput.addEventListener("input", () => {
    messageInputTouched = true;
  });
}

const buildDefaultLoginMessage = () => {
  const domain = domainInput?.value.trim() || "";
  const uri = uriInput?.value.trim() || "";
  const statement = statementInput?.value.trim() || "";
  const nonce = nonceInput?.value.trim() || state.nonce || "000";
  const issuedAt = new Date().toISOString();
  const address = state.address || DEFAULT_ADDRESS;

  return buildSiweMessageVanilla({
    domain,
    address,
    statement,
    uri,
    nonce,
    issuedAt,
  });
};

const populateLoginMessage = () => {
  if (!messageInput || messageInputTouched) return;
  messageInput.value = buildDefaultLoginMessage();
};

populateLoginMessage();

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
    populateLoginMessage();
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
    populateLoginMessage();
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
    if (!uri) throw new Error("URI is required.");
    if (!statement) throw new Error("Statement is required.");

    const issuedAt = new Date().toISOString();
    const messagePayload = {
      domain,
      address: state.address,
      statement,
      uri,
      nonce,
      issuedAt,
    };
    const useSiweLib = useSiweLibInput ? useSiweLibInput.checked : true;
    const messageToSign = useSiweLib
      ? buildSiweMessage(messagePayload)
      : messageInput.value.trim();
    if (!messageToSign) {
      throw new Error("Login Message (override) is required when not using SIWE.");
    }

    const signature = await state.signer.signMessage(messageToSign);
    state.message = messageToSign;
    state.signature = signature;
    messageInput.value = messageToSign;
    signatureInput.value = signature;
    console.log("[siwe] message", messageToSign);
    console.log("[siwe] signature", signature);
    log({ message: messageToSign, signature });
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
    const items = Array.isArray(json) ? json : json?.items || json?.data || [];
    if (Array.isArray(items) && items.length > 0) {
      const first = items[0] || {};
      state.cardId = first.id || state.cardId;
      state.cardToken = first.cardToken || state.cardToken;
      if (cardTokenInput && first.cardToken) {
        cardTokenInput.value = first.cardToken;
      }
    }
    log(json);
  } catch (err) {
    log(err.message || err);
  }
});

document.getElementById("pseTokenBtn").addEventListener("click", async () => {
  try {
    advanceStep(5);
    if (!state.token) throw new Error("Authenticate first to get a token.");

    const pseAppId = pseAppIdInput?.value.trim();
    if (!pseAppId) throw new Error("PSE App ID is required.");
    const res = await fetch(`${API_BASE}/pse-public/api/v1/auth/token`, {
      method: "POST",
      headers: {
        accept: "*/*",
        authorization: `Bearer ${state.token}`,
        "x-app-id": pseAppId,
      },
    });
    if (!res.ok) throw new Error(`PSE token failed: ${res.status}`);
    const json = await res.json();
    console.log("[pse-token] raw response", json);
    const token =
      json?.data?.token ||
      json?.token ||
      json?.accessToken ||
      json?.bearerToken ||
      json?.responseObject?.token ||
      "";
    state.pseToken = token || null;
    pseTokenEl.textContent = maskValue(token);
    log(json);
  } catch (err) {
    log(err.message || err);
  }
});

document.getElementById("pseBtn").addEventListener("click", async () => {
  try {
    advanceStep(6);
    const res = await fetch(`${API_BASE}/pse/token`, {
      headers: {},
    });
    if (!res.ok) throw new Error(`PSE token failed: ${res.status}`);
    const json = await res.json();
    console.log("[pse] raw response", json);
    const token = json?.responseObject?.data?.ephemeralToken || "";
    const expiresAt = json?.responseObject?.data?.expiresAt || "";
    state.ephemeralToken = token || null;
    ephemeralTokenEl.textContent = maskValue(token);
    ephemeralExpiresEl.textContent = expiresAt || "-";
    log(json);
  } catch (err) {
    log(err.message || err);
  }
});

document.getElementById("publicKeyBtn").addEventListener("click", async () => {
  try {
    advanceStep(7);
    if (!state.pseToken) {
      throw new Error("Fetch PSE token (step 6) first.");
    }
    const cardToken = cardTokenInput?.value.trim() || state.cardToken;
    if (!cardToken) {
      throw new Error("Card token is required (step 5 or override).");
    }
    const pseAppId = pseAppIdInput?.value.trim();
    if (!pseAppId) throw new Error("PSE App ID is required.");
    const keyRes = await fetch(
      `${API_BASE}/pse-public/api/v1/cards/${cardToken}/public-key`,
      {
        headers: {
          accept: "*/*",
          authorization: `Bearer ${state.pseToken}`,
          "x-app-id": pseAppId,
        },
      }
    );
    if (!keyRes.ok) throw new Error(`Public key failed: ${keyRes.status}`);
    const keyJson = await keyRes.json();
    console.log("[pse-public-key] raw response", keyJson);
    const publicKey = keyJson?.data?.publicKey || "";
    state.psePublicKey = publicKey || null;
    psePublicKeyEl.textContent = publicKey ? maskValue(publicKey) : "-";
    log(keyJson);
  } catch (err) {
    log(err.message || err);
  }
});

document.getElementById("detailsBtn").addEventListener("click", async () => {
  try {
    advanceStep(8);
    if (!state.pseToken) throw new Error("Fetch PSE token (step 6) first.");
    if (!state.ephemeralToken) throw new Error("Fetch ephemeral token (step 7) first.");
    if (!state.psePublicKey) throw new Error("Fetch public key (step 8) first.");
    const cardToken = cardTokenInput?.value.trim() || state.cardToken;
    if (!cardToken) {
      throw new Error("Card token is required (step 5 or override).");
    }
    const encryptedKey = encryptedKeyInput?.value.trim();
    if (!encryptedKey) throw new Error("Encrypted key is required.");
    const pseAppId = pseAppIdInput?.value.trim();
    if (!pseAppId) throw new Error("PSE App ID is required.");

    const detailsUrl = `${API_BASE}/pse-public/api/v1/cards/${cardToken}/details` +
      `?ephemeralToken=${encodeURIComponent(state.ephemeralToken)}` +
      `&encryptedKey=${encodeURIComponent(encryptedKey)}`;
    const res = await fetch(detailsUrl, {
      headers: {
        accept: "*/*",
        authorization: `Bearer ${state.pseToken}`,
        "x-app-id": pseAppId,
      },
    });
    if (!res.ok) throw new Error(`Card details failed: ${res.status}`);
    const json = await res.json();
    console.log("[card-details] raw response", json);
    log(json);
  } catch (err) {
    log(err.message || err);
  }
});

document.getElementById("txBtn").addEventListener("click", async () => {
  try {
    advanceStep(9);
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
