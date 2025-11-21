// FRONT-END INTERAÇÃO - Presale Lunaro Token (LNR) com múltiplas opções de compra
import { ethers } from "ethers";
import Web3Modal from "web3modal";
import axios from "axios";
import {
  contractAddress,
  contractABI,
  tokens,
  oneInchRouter,
  defaultSlippage,
} from "./constants/index.js";

// 👇 Coinbase Onramp (cbpay-js)
import { initOnRamp } from "@coinbase/cbpay-js";

// ========================================================================
// CONFIGURAÇÃO GERAL (.env para chaves)
// ========================================================================

// Presale termina em 31/01/2026 23:59:59
const COUNTDOWN_END_DATE = "2026-01-31T23:59:59";
let BNB_PRICE_IN_USD = 1090; // Fallback
const HARD_CAP_USD = 2500000; // META DE $2.5 MILHÕES
const USDT_PRICE_IN_USD = 1;
const DISPLAY_LNR_PRICE_USD = 0.0275; // $0.0275 por LNR na presale
const STAGE_2_THRESHOLD_PERCENT = 50; // depois de 50% da hard cap vira Stage 2
// AUTO BUY (BNB detect → auto compra LNR)
window.initialBNBBalance = null;

const WALLETCONNECT_PROJECT_ID =
  import.meta.env.VITE_WALLETCONNECT_ID ||
  "32ed3ea3bca55289803b2a1972da8a07";

const ONEINCH_API_KEY =
  import.meta.env.VITE_1INCH_API_KEY || "3ihHZTcYwk4NoMUnIBPdYwBJM1kxyWHr";

const BACKEND_BASE_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

const RPC_URL =
  "https://bnb-mainnet.g.alchemy.com/v2/HAXUAQ3oER2HJSh_-sFgE"; // Seu Alchemy URL

const COINGECKO_API =
  "https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd";

const ONEINCH_BASE_URL = "https://api.1inch.dev/swap/v6.0/56";

const NATIVE_ADDRESS =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"; // Endereço 1inch para BNB nativo

// Coinbase Onramp
const COINBASE_APP_ID =
  import.meta.env.VITE_COINBASE_APP_ID ||
  "49a51074-ac3c-4488-9793-f1d6572ed3fe";

// ========================================================================
// ABI MÍNIMO ERC20 (PARA ALLOWANCE/APPROVE)
// ========================================================================
const ERC20_MIN_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "_spender", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [
      { name: "_owner", type: "address" },
      { name: "_spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
  },
];

// ========================================================================
// ESTADO GLOBAL
// ========================================================================
let provider, signer, userAddress, contract;
let tokenRate = BigInt(0); // LNR por 1 BNB
let isSaleActive = false;

// ========================================================================
// UTIL DOM
// ========================================================================
const el = (id) => document.getElementById(id);

const connectWalletBtn = el("connectWalletBtn");
const purchaseSuccessModal = el("purchaseSuccessModal");
const purchaseFailureModal = el("purchaseFailureModal");
const liveFeedList = el("live-feed-list");
const topBuyersList = el("top-buyers-list");

const tabs = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

const countdownEl = el("countdown");
const totalRaisedDisplay = el("totalRaisedDisplay");
const hardCapDisplay = el("hardCapDisplay");
const progressBarFill = el("progressBarFill");
const progressBarLabel = el("progressBarLabel");
const presaleStageBadge = el("presaleStageBadge");
const presalePriceEl = el("currentPresalePriceValue");

const walletStatusEl = el("walletStatus");
const walletAddressEl = el("walletAddress");

// BNB Direto
const currencyAmountInput = el("currencyAmount");
const lnrToReceiveEl = el("lnrToReceive");
const buyButton = el("buyButton");

// Multi-Token
const tokenSelect = el("tokenSelect");
const tokenAmountInput = el("tokenAmount") || el("usdtAmount");
const tokenLnrToReceiveEl =
  el("tokenLnrToReceive") || el("usdtLnrToReceive");
const buyWithTokenButton =
  el("buyWithTokenButton") || el("buyWithUsdtButton");
const tokenCardsContainer = document.getElementById("tokenCardsContainer");
let selectedTokenSymbol = null; // USDT / BUSD / USDC / MATIC / ETH

// Cartão
const cardAmountInput = el("cardAmount");
const cardLnrToReceiveEl = el("cardLnrToReceive");
const buyWithCardButton = el("buyWithCardButton");

// ========================================================================
// PREÇOS DINÂMICOS
// ========================================================================
async function fetchBNBPrice() {
  try {
    const res = await axios.get(COINGECKO_API);
    BNB_PRICE_IN_USD = res.data.binancecoin.usd || BNB_PRICE_IN_USD;
    console.log(`Preço BNB atualizado: $${BNB_PRICE_IN_USD}`);
  } catch (err) {
    console.warn("Erro ao buscar preço BNB:", err);
  }
}
fetchBNBPrice();
setInterval(fetchBNBPrice, 60000);

// ========================================================================
// WEB3MODAL SETUP
// ========================================================================
const providerOptions = {
  walletconnect: {
    package: true, // se der erro, substituir por WalletConnectProvider
    options: { projectId: WALLETCONNECT_PROJECT_ID, chains: [56] },
  },
};

const web3Modal = new Web3Modal({
  cacheProvider: true,
  providerOptions,
  theme: "dark",
});

// ========================================================================
// UI HELPERS (feedback, abas, botões)
// ========================================================================
function showFeedback(modalElement) {
  if (modalElement) modalElement.classList.remove("hidden");
  setTimeout(() => modalElement && modalElement.classList.add("hidden"), 3000);
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tabContents.forEach((tc) => tc.classList.add("hidden"));
    tab.classList.add("active");
    const targetContent = el(`tab-${tab.dataset.tab}`);
    targetContent?.classList.remove("hidden");
  });
});

function enablePurchaseButtons() {
  if (currencyAmountInput) {
    currencyAmountInput.disabled = false;
    currencyAmountInput.placeholder = "Ex: 0.5 BNB";
  }
  if (buyButton) {
    buyButton.disabled = false;
    buyButton.textContent = "BUY WITH BNB";
  }

  if (tokenAmountInput) {
    tokenAmountInput.disabled = false;
    tokenAmountInput.placeholder = "Ex: 100.0";
  }
  if (buyWithTokenButton) {
    buyWithTokenButton.disabled = false;
    buyWithTokenButton.textContent = "BUY WITH TOKEN";
  }

  if (cardAmountInput) {
    cardAmountInput.disabled = false;
    cardAmountInput.placeholder = "Ex: 100 USD";
  }
  if (buyWithCardButton) {
    buyWithCardButton.disabled = false;
    buyWithCardButton.textContent = "BUY WITH CARD";
  }
}

function disablePurchaseButtons(reason) {
  if (currencyAmountInput) {
    currencyAmountInput.disabled = true;
    currencyAmountInput.placeholder = reason;
  }
  if (buyButton) {
    buyButton.disabled = true;
    buyButton.textContent = reason;
  }

  if (tokenAmountInput) {
    tokenAmountInput.disabled = true;
    tokenAmountInput.placeholder = reason;
  }
  if (buyWithTokenButton) {
    buyWithTokenButton.disabled = true;
    buyWithTokenButton.textContent = reason;
  }

  if (cardAmountInput) {
    cardAmountInput.disabled = true;
    cardAmountInput.placeholder = reason;
  }
  if (buyWithCardButton) {
    buyWithCardButton.disabled = true;
    buyWithCardButton.textContent = reason;
  }
}

function updateUIOnConnect(address) {
  // Deixa o endereço disponível pro widget de terceiros (Coinbase, etc.)
  window.userWallet = address;

  if (walletStatusEl) {
    walletStatusEl.textContent = "Connected";
    walletStatusEl.className = "neon-text-green";
  }
  if (walletAddressEl) {
    walletAddressEl.textContent = `${address.substring(
      0,
      6
    )}...${address.substring(address.length - 4)}`;
  }
  if (connectWalletBtn) connectWalletBtn.textContent = "Disconnect";

  if (isSaleActive) enablePurchaseButtons();
  else disablePurchaseButtons("Venda não ativa");

  updatePresaleData();
  populateTokenCards();
}

function updateUIOnDisconnect() {
  if (walletStatusEl) {
    walletStatusEl.textContent = "Disconnected";
    walletStatusEl.className = "neon-text-purple";
  }
  if (walletAddressEl) walletAddressEl.textContent = "";
  if (connectWalletBtn) connectWalletBtn.textContent = "Connect Wallet";
  disablePurchaseButtons("Conecte a wallet");
}

if (presalePriceEl) {
  presalePriceEl.textContent = `$${DISPLAY_LNR_PRICE_USD.toFixed(4)}`;
}

// ========================================================================
// WALLET CONEXÃO
// ========================================================================
async function connectWallet() {
  try {
    const instance = await web3Modal.connect();
    instance.on("accountsChanged", () => window.location.reload());
    instance.on("chainChanged", () => window.location.reload());
    instance.on("disconnect", () => disconnect());

    provider = new ethers.BrowserProvider(instance);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();
    contract = new ethers.Contract(contractAddress, contractABI, signer);

    // Salva saldo inicial de BNB pra lógica de auto-buy
    window.initialBNBBalance = await provider.getBalance(userAddress);

    const network = await provider.getNetwork();
    if (network.chainId !== 56n) {
      alert("Por favor, mude para BNB Chain!");
      return disconnect();
    }

    updateUIOnConnect(userAddress);
  } catch (error) {
    console.error("Erro na conexão:", error);
    alert(`Falha: ${error.message}`);
  }
}

async function disconnect() {
  await web3Modal.clearCachedProvider();
  provider = null;
  signer = null;
  userAddress = null;
  contract = null;
  updateUIOnDisconnect();
}

// ========================================================================
// PRESALE DATA UPDATE (DÓLAR + STAGE + LABEL BARRA)
// ========================================================================
async function updatePresaleData() {
  const publicProvider = new ethers.JsonRpcProvider(RPC_URL);
  const readOnlyContract = new ethers.Contract(
    contractAddress,
    contractABI,
    publicProvider
  );

  try {
    const isInitialized = await readOnlyContract.initialized();
    if (!isInitialized) {
      console.warn("Contrato não inicializado.");
      disablePurchaseButtons("Venda não iniciada");
      return;
    }

    const [totalRaised_BNB_Wei, price, saleStatus] = await Promise.all([
      readOnlyContract.totalRaised(),
      readOnlyContract.tokenPrice(),
      readOnlyContract.saleActive(),
    ]);

    isSaleActive = saleStatus;

    const totalRaisedBNB = ethers.formatEther(totalRaised_BNB_Wei);
    const totalRaisedUSD = parseFloat(totalRaisedBNB) * BNB_PRICE_IN_USD;
    const progressPercent = (totalRaisedUSD / HARD_CAP_USD) * 100;

    const totalRaisedUSD_Display = totalRaisedUSD.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });

    const hardCapUSD_Display = HARD_CAP_USD.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

    if (totalRaisedDisplay)
      totalRaisedDisplay.textContent = `${totalRaisedUSD_Display} Raised`;
    if (hardCapDisplay)
      hardCapDisplay.textContent = `Hard Cap: ${hardCapUSD_Display}`;

    if (progressBarFill) {
      const clamped = progressPercent > 100 ? 100 : progressPercent;
      progressBarFill.style.width = `${clamped.toFixed(2)}%`;
    }

    if (progressBarLabel) {
      progressBarLabel.textContent = `${totalRaisedUSD_Display} / ${hardCapUSD_Display}`;
    }

    if (presaleStageBadge) {
      const stageText =
        progressPercent < STAGE_2_THRESHOLD_PERCENT ? "Stage 1" : "Stage 2";
      presaleStageBadge.textContent = stageText;
    }

    const oneBNB = ethers.parseEther("1");
    tokenRate = oneBNB / price;
    console.log(`Taxa de Token (LNR por 1 BNB): ${tokenRate}`);
    console.log(`Status da Venda (isSaleActive): ${isSaleActive}`);

    if (isSaleActive && userAddress) enablePurchaseButtons();
    else if (!isSaleActive) disablePurchaseButtons("Venda não ativa");
  } catch (err) {
    console.error("Erro ao buscar dados da presale:", err);
    disablePurchaseButtons("Erro ao carregar dados");
  }
}

// ========================================================================
// AUTO BUY → Detecta BNB novo na wallet (ex: via onramp / bridge)
// ========================================================================
async function checkAutoBuy() {
  if (!window.initialBNBBalance || !userAddress || !provider || !contract)
    return;

  try {
    const newBalance = await provider.getBalance(userAddress);
    const diff = newBalance - window.initialBNBBalance;

    if (diff > 0n) {
      console.log(
        "🟢 Detectado BNB novo:",
        ethers.formatEther(diff),
        "BNB"
      );

      // ignora poeira < 0.00001 BNB
      if (diff < ethers.parseEther("0.00001")) {
        window.initialBNBBalance = newBalance;
        return;
      }

      // Testa se o contrato aceitaria esse valor
      await contract.buy.staticCall({ value: diff });

      // Compra automática
      const tx = await contract.buy({ value: diff });
      console.log("TX auto-buy:", tx.hash);
      await tx.wait();

      alert("🎉 Compra automática concluída! Você recebeu seus LUNARO.");

      // Atualiza base pra próximos checks
      window.initialBNBBalance = await provider.getBalance(userAddress);

      updatePresaleData();
    }
  } catch (err) {
    console.error("Auto-buy erro:", err);
  }
}

// ========================================================================
// COMPRA COM BNB DIRETO
// ========================================================================
async function buyLunaro() {
  if (!contract) return alert("Conecte sua wallet primeiro.");

  const amount = currencyAmountInput?.value;
  if (!amount || amount <= 0) return alert("Insira um valor BNB válido.");

  const amountNum = parseFloat(amount);
  if (amountNum < 0.00001) {
    return alert("Minimum purchase is 0.00001 BNB.");
  }

  buyButton.disabled = true;
  buyButton.textContent = "PROCESSANDO...";

  try {
    const value = ethers.parseEther(amount);
    await contract.buy.staticCall({ value });
    const tx = await contract.buy({ value });
    alert("Transação enviada! Aguardando confirmação...");
    await tx.wait();
    showFeedback(purchaseSuccessModal);
    await updatePresaleData();
  } catch (err) {
    console.error(err);
    const reason = err.reason || err.data?.message || err.message;
    alert(`Falha na transação: ${reason}`);
    showFeedback(purchaseFailureModal);
  } finally {
    buyButton.disabled = false;
    if (isSaleActive) buyButton.textContent = "BUY WITH BNB";
    else disablePurchaseButtons("Venda não ativa");
    if (currencyAmountInput) currencyAmountInput.value = "";
    if (lnrToReceiveEl) lnrToReceiveEl.textContent = "0 LNR";
  }
}

// ========================================================================
// HELPER FUNCTIONS FOR 1INCH SWAPS (APPROVE/ALLOWANCE)
// ========================================================================
async function checkAllowance(tokenAddress, spenderAddress) {
  const tokenContract = new ethers.Contract(
    tokenAddress,
    ERC20_MIN_ABI,
    signer
  );
  const allowance = await tokenContract.allowance(userAddress, spenderAddress);
  return allowance;
}

async function approveToken(tokenAddress, spenderAddress, amount) {
  const tokenContract = new ethers.Contract(
    tokenAddress,
    ERC20_MIN_ABI,
    signer
  );
  const tx = await tokenContract.approve(spenderAddress, amount);
  alert("Aprovação enviada! Por favor, aguarde a confirmação...");
  await tx.wait();
  alert("Aprovação confirmada! Você pode continuar com a compra.");
}

// ========================================================================
// SWAP VIA 1INCH → TOKEN ⇒ BNB (Nativo) NA BSC
// ========================================================================
async function swapTokenForBNB(tokenAddress, humanAmount) {
  if (!signer || !userAddress) {
    throw new Error("Conecte sua wallet antes de usar o swap.");
  }

  // 1) Descobre os decimais do token (USDT, USDC, etc.)
  const decimals = await getTokenDecimals(tokenAddress);

  // 2) Converte o valor digitado (ex: 100 USDT) pra wei
  const amountWei = ethers.parseUnits(humanAmount.toString(), decimals);

  // 3) Garante allowance suficiente pro router do 1inch
  const currentAllowance = await checkAllowance(tokenAddress, oneInchRouter);
  if (currentAllowance < amountWei) {
    console.log("⛽️ Fazendo approve pro 1inch router...");
    await approveToken(tokenAddress, oneInchRouter, amountWei);
  }

  console.log("🔁 Chamando 1inch swap API...");

  // 4) Monta chamada pro endpoint /swap da 1inch (BSC = chainId 56)
  const url = `${ONEINCH_BASE_URL}/swap`;

  const params = {
    src: tokenAddress, // token de origem (USDT, USDC, etc.)
    dst: NATIVE_ADDRESS, // BNB nativo
    amount: amountWei.toString(),
    from: userAddress,
    slippage: defaultSlippage, // 1.5% (do seu constants)
    disableEstimate: false,
  };

  const headers = {
    Authorization: `Bearer ${ONEINCH_API_KEY}`,
    Accept: "application/json",
  };

  let swapData;
  try {
    const response = await axios.get(url, { params, headers });
    swapData = response.data;
  } catch (err) {
    console.error("Erro na chamada 1inch:", err?.response?.data || err);
    throw new Error(
      "Falha ao buscar rota no 1inch. Verifique a API key e o token."
    );
  }

  if (!swapData || !swapData.tx) {
    console.error("Resposta inesperada do 1inch:", swapData);
    throw new Error("Resposta inválida do 1inch (sem objeto tx).");
  }

  const txData = swapData.tx;

  const rawDstAmount =
    swapData.toTokenAmount ||
    swapData.dstAmount ||
    swapData.toTokenAmount?.toString?.() ||
    null;

  if (!rawDstAmount) {
    console.warn(
      "Não encontrei campo toTokenAmount/dstAmount na resposta. Usando apenas o TX."
    );
  }

  const tx = await signer.sendTransaction({
    to: txData.to,
    data: txData.data,
    value: txData.value ? BigInt(txData.value) : 0n,
    gasPrice: txData.gasPrice ? BigInt(txData.gasPrice) : undefined,
    gasLimit: txData.gas ? BigInt(txData.gas) : undefined,
  });

  console.log("TX swap enviada:", tx.hash);
  await tx.wait();
  console.log("✅ Swap confirmado on-chain.");

  if (rawDstAmount) {
    const full = BigInt(rawDstAmount);
    const safeAmount = (full * 98n) / 100n;
    console.log(
      `BNB estimado recebido pelo swap: ${ethers.formatEther(
        full
      )} | usaremos para compra: ${ethers.formatEther(safeAmount)}`
    );
    return safeAmount;
  }

  console.log("⚠️ Usando fallback por saldo de BNB.");
  const afterBalance = await provider.getBalance(userAddress);
  return afterBalance;
}

// ========================================================================
// COMPRA COM OUTROS TOKENS (TOKEN TAB)
// ========================================================================
async function buyWithTokens() {
  if (!contract || !userAddress) {
    return alert("Conecte sua wallet primeiro.");
  }

  const rawValue = tokenAmountInput?.value?.toString().trim();
  const amountNum = Number(rawValue);

  if (!rawValue || isNaN(amountNum) || amountNum <= 0) {
    return alert("Insira um valor válido.");
  }

  const sym = selectedTokenSymbol || "USDT";

  // 🔹 Mínimo para stablecoins (~$2)
  if (["USDT", "USDC", "BUSD", "DAI"].includes(sym) && amountNum < 2) {
    return alert("Minimum purchase is 2 units for stablecoins (≈ $2).");
  }

  // 🔹 Checar se tem BNB para pagar gas quando usar outros tokens
  if (!["BNB", "WBNB"].includes(sym)) {
    try {
      const bnbBalance = await provider.getBalance(userAddress);
      const minGasBNB = ethers.parseEther("0.0005"); // ~0.0005 BNB para gas

      if (bnbBalance < minGasBNB) {
        return alert(
          "Para comprar com outros tokens (USDT, USDC, BUSD, DAI, etc.) você precisa ter um pouco de BNB na carteira para pagar as taxas de gás da rede."
        );
      }
    } catch (e) {
      console.warn("Erro ao checar saldo de BNB para gas:", e);
    }
  }

  const selectedToken = getSelectedToken().address;

  buyWithTokenButton.disabled = true;
  buyWithTokenButton.textContent = "PROCESSANDO SWAP...";

  try {
    // Faz o swap do token → BNB via 1inch
    const bnbReceived = await swapTokenForBNB(selectedToken, amountNum);
    const bnbToSpendWei = bnbReceived;

    // Testa se o contrato aceita esse valor
    await contract.buy.staticCall({ value: bnbToSpendWei });

    // Compra LNR com o BNB recebido
    const tx = await contract.buy({ value: bnbToSpendWei });
    alert("Transação enviada! Aguardando confirmação...");
    await tx.wait();

    showFeedback(purchaseSuccessModal);
    await updatePresaleData();
  } catch (err) {
    console.error("Falha no swap:", err);
    alert(`Falha: ${err.message}`);
    showFeedback(purchaseFailureModal);
  } finally {
    buyWithTokenButton.disabled = false;
    buyWithTokenButton.textContent = "BUY WITH TOKEN";
    if (tokenAmountInput) tokenAmountInput.value = "";
    if (tokenLnrToReceiveEl) tokenLnrToReceiveEl.textContent = "0 LNR";
  }
}


// ========================================================================
// CÁLCULOS UI
// ========================================================================
async function getTokenDecimals(tokenAddress) {
  const publicProvider = new ethers.JsonRpcProvider(RPC_URL);
  const token = new ethers.Contract(tokenAddress, ERC20_MIN_ABI, publicProvider);
  return await token.decimals();
}

function getSelectedToken() {
  const sym = selectedTokenSymbol || "USDT";
  return tokens[sym] || tokens.USDT;
}

// ========================================================================
// POPULAR CARDS / SELECT DE TOKENS
// ========================================================================
async function populateTokenCards() {
  if (!tokenCardsContainer) return;

  tokenCardsContainer.innerHTML = "";

  const tokenEntries = Object.entries(tokens).filter(([sym, cfg]) => {
    return cfg.address && !["BNB", "WBNB"].includes(sym);
  });

  let balances = [];

  if (userAddress && provider) {
    const readProvider = provider;

    for (const [sym, cfg] of tokenEntries) {
      try {
        const erc20 = new ethers.Contract(
          cfg.address,
          ERC20_MIN_ABI,
          readProvider
        );
        const [rawBal, decimals] = await Promise.all([
          erc20.balanceOf(userAddress),
          erc20.decimals(),
        ]);

        const humanBal = Number(ethers.formatUnits(rawBal, decimals));
        balances.push({ sym, cfg, humanBal });
      } catch (e) {
        console.warn("Erro ao ler saldo de", sym, e);
        balances.push({ sym, cfg, humanBal: 0 });
      }
    }
  } else {
    balances = tokenEntries.map(([sym, cfg]) => ({
      sym,
      cfg,
      humanBal: null,
    }));
  }

  const withBalance = balances.filter(
    (b) => b.humanBal !== null && b.humanBal > 0.01
  );

  const listToRender = withBalance.length > 0 ? withBalance : balances;

  listToRender.forEach(({ sym, cfg, humanBal }) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className =
      "token-card-select w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-900/60 hover:border-neon-blue hover:bg-gray-900 transition flex items-center gap-3 text-left";
    card.dataset.symbol = sym;

    const logoSrc = cfg.logo || `/tokens/${sym.toLowerCase()}.png`;

    card.innerHTML = `
      <img src="${logoSrc}" alt="${sym} logo"
        class="w-8 h-8 rounded-full bg-black/40 object-contain" />
      <div class="flex flex-col">
        <span class="font-semibold text-sm">${sym}</span>
        <span class="text-xs text-gray-400">${cfg.name || ""}</span>
        ${
          humanBal !== null
            ? `<span class="text-[11px] mt-1 text-neon-green/80">Balance: ${humanBal.toFixed(
                3
              )}</span>`
            : ""
        }
      </div>
    `;

    card.addEventListener("click", () => {
      setSelectedToken(sym);
    });

    tokenCardsContainer.appendChild(card);
  });

  if (!selectedTokenSymbol && listToRender.length > 0) {
    setSelectedToken(listToRender[0].sym);
  }
}

function setSelectedToken(sym) {
  selectedTokenSymbol = sym;

  if (!tokenCardsContainer) return;
  tokenCardsContainer
    .querySelectorAll(".token-card-select")
    .forEach((card) => {
      if (card.dataset.symbol === sym) {
        card.classList.add("ring-2", "ring-neon-blue", "border-neon-blue");
      } else {
        card.classList.remove("ring-2", "ring-neon-blue", "border-neon-blue");
      }
    });
}

// ========================================================================
// FEED AO VIVO + TOP BUYERS (range pequeno de blocos)
// ========================================================================
function listenForPurchases() {
  const publicProvider = new ethers.JsonRpcProvider(RPC_URL);
  const readOnlyContract = new ethers.Contract(
    contractAddress,
    contractABI,
    publicProvider
  );

  setInterval(async () => {
    try {
      const latestBlockNumber = await publicProvider.getBlockNumber(); // number
      const fromBlock = Math.max(0, latestBlockNumber - 9);
      const toBlock = latestBlockNumber;

      const filter = readOnlyContract.filters.TokensPurchased();
      const events = await readOnlyContract.queryFilter(
        filter,
        fromBlock,
        toBlock
      );

      const ordered = events.slice().reverse();

      // LIVE FEED
      if (liveFeedList) {
        liveFeedList.innerHTML = "";

        ordered.slice(0, 5).forEach((event) => {
          const buyer = event.args[0];
          const amount = event.args[1];

          const item = document.createElement("div");
          item.className = "live-purchase-item";

          const formattedAmount = parseFloat(
            ethers.formatEther(amount)
          ).toLocaleString("en-US");

          const shortAddress = `${buyer.substring(
            0,
            6
          )}...${buyer.substring(buyer.length - 4)}`;

          item.innerHTML = `✅ <span class="neon-text-blue">${shortAddress}</span> just bought <span class="neon-text-green">${formattedAmount} LNR</span>`;

          liveFeedList.appendChild(item);
        });
      }

      // TOP BUYERS
      if (topBuyersList) {
        const totals = new Map();

        events.forEach((event) => {
          const buyer = event.args[0];
          const amount = event.args[1];
          const prev = totals.get(buyer) ?? 0n;
          totals.set(buyer, prev + amount);
        });

        const top = [...totals.entries()]
          .sort((a, b) => (a[1] < b[1] ? 1 : -1))
          .slice(0, 5);

        topBuyersList.innerHTML = "";

        top.forEach(([addr, totalWei], index) => {
          const div = document.createElement("div");
          div.className = "top-buyer-item";

          const totalLNR = parseFloat(
            ethers.formatEther(totalWei)
          ).toLocaleString("en-US", { maximumFractionDigits: 0 });

          const short = `${addr.substring(0, 6)}...${addr.substring(
            addr.length - 4
          )}`;

          div.innerHTML = `
            <span class="top-buyer-address">#${index + 1} ${short}</span>
            <span class="top-buyer-amount">${totalLNR} LNR</span>
          `;

          topBuyersList.appendChild(div);
        });
      }
    } catch (err) {
      console.warn("Erro ao buscar eventos (range blocos):", err);
    }
  }, 10000);
}

// ========================================================================
// COUNTDOWN
// ========================================================================
function startCountdown() {
  const interval = setInterval(() => {
    if (!countdownEl) {
      clearInterval(interval);
      return;
    }
    const distance =
      new Date(COUNTDOWN_END_DATE).getTime() - new Date().getTime();
    if (distance < 0) {
      clearInterval(interval);
      countdownEl.innerHTML =
        "<span class='neon-text-green'>PRESALE ENDED</span>";
      disablePurchaseButtons("Venda encerrada");
      return;
    }
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor(
      (distance % (1000 * 60 * 60)) / (1000 * 60)
    );
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    countdownEl.innerHTML = `<div><span>${String(days).padStart(
      2,
      "0"
    )}</span><br><span class="text-base text-gray-500">DAYS</span></div>
      <div><span>${String(hours).padStart(
        2,
        "0"
      )}</span><br><span class="text-base text-gray-500">HOURS</span></div>
      <div><span>${String(minutes).padStart(
        2,
        "0"
      )}</span><br><span class="text-base text-gray-500">MINUTES</span></div>
      <div><span>${String(seconds).padStart(
        2,
        "0"
      )}</span><br><span class="text-base text-gray-500">SECONDS</span></div>`;
  }, 1000);
}

// ========================================================================
// COINBASE ONRAMP (CARD TAB) - via backend com sessionToken
// ========================================================================
async function createCoinbaseSessionOnBackend(amount, walletAddress) {
  if (!walletAddress) {
    throw new Error("Wallet address não informado.");
  }

  try {
    const response = await fetch(
      `${BACKEND_BASE_URL}/api/coinbase/onramp-order`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationAddress: walletAddress,
          amountInfo: {
            amount: amount.toString(),
            currency: "USD",
          },
          userInfo: {
            email: "juniorcaeb@gmail.com",
            phone: "+5527999999999",
            country: "BR",
          },
          network: "base",
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Erro ao criar onramp-order no backend:", text);
      throw new Error("Falha ao criar sessão de pagamento. Tente novamente.");
    }

    const data = await response.json();
    console.log("Resposta do backend /onramp-order:", data);

    if (data.sessionToken) {
      return data.sessionToken;
    }

    if (data.onrampUrl || data.url) {
      const url = data.onrampUrl || data.url;
      return url;
    }

    throw new Error("Backend não retornou sessionToken nem onrampUrl.");
  } catch (err) {
    console.error("Erro em createCoinbaseSessionOnBackend:", err);
    throw err;
  }
}

async function openCoinbaseOnramp(usdValue = 50) {
  if (!userAddress) {
    alert("Connect your wallet first.");
    return;
  }

  if (!COINBASE_APP_ID) {
    alert("Coinbase Onramp não configurado (APP ID faltando).");
    return;
  }

  try {
    const sessionToken = await createCoinbaseSessionOnBackend(
      usdValue,
      userAddress
    );

    if (typeof sessionToken === "string" && sessionToken.startsWith("http")) {
      window.open(sessionToken, "_blank");
      return;
    }

    const options = {
      appId: COINBASE_APP_ID,
      sessionToken,
      widgetParameters: {
        addresses: {
          base: [userAddress],
        },
        assets: ["USDC"],
        presetFiatAmount: usdValue,
        fiatCurrency: "USD",
        defaultAsset: "USDC",
        defaultNetwork: "base",
        defaultPaymentMethod: "CARD",
      },
      experienceLoggedIn: "popup",
      experienceLoggedOut: "popup",
      closeOnExit: true,
      closeOnSuccess: true,
      onSuccess: () => {
        console.log("✅ Coinbase Onramp sucesso");
      },
      onExit: () => {
        console.log("Coinbase Onramp fechado");
      },
      onEvent: (event) => {
        console.log("Coinbase Onramp event:", event);
      },
    };

    initOnRamp(options, (error, instance) => {
      if (error) {
        console.error("Erro Coinbase Onramp:", error);
        alert("Não foi possível abrir o Coinbase Onramp. Veja o console.");
        return;
      }
      instance.open();
    });
  } catch (err) {
    console.error(err);
    alert(err.message || "Erro ao criar sessão de pagamento.");
  }
}

// ========================================================================
// INICIALIZAÇÃO
// ========================================================================
document.addEventListener("DOMContentLoaded", () => {
  // AOS
  if (window.AOS) {
    AOS.init({ duration: 800, once: true });
  }

  // HANDLERS PRINCIPAIS
  if (connectWalletBtn) {
    connectWalletBtn.addEventListener("click", () =>
      userAddress ? disconnect() : connectWallet()
    );
  }

  if (buyButton) {
    buyButton.addEventListener("click", buyLunaro);
  }

  if (currencyAmountInput && lnrToReceiveEl) {
    currencyAmountInput.addEventListener("input", (e) => {
      const bnbValue = parseFloat(e.target.value) || 0;
      if (Number(tokenRate) > 0) {
        lnrToReceiveEl.textContent = `${(
          bnbValue * Number(tokenRate)
        ).toLocaleString("en-US", { maximumFractionDigits: 0 })} LNR`;
      } else {
        lnrToReceiveEl.textContent = "0 LNR";
      }
    });
  }

  if (tokenAmountInput && tokenLnrToReceiveEl) {
    tokenAmountInput.addEventListener("input", () => {
      const amount = parseFloat(tokenAmountInput.value) || 0;
      if (Number(tokenRate) > 0) {
        tokenLnrToReceiveEl.textContent = `${(
          (amount / BNB_PRICE_IN_USD) *
          Number(tokenRate)
        ).toLocaleString("en-US", { maximumFractionDigits: 0 })} LNR`;
      } else {
        tokenLnrToReceiveEl.textContent = "0 LNR";
      }
    });
  }

  if (buyWithTokenButton) {
    buyWithTokenButton.addEventListener("click", buyWithTokens);
  }

  if (cardAmountInput && cardLnrToReceiveEl) {
    cardAmountInput.addEventListener("input", (e) => {
      const usdValue = parseFloat(e.target.value) || 0;
      if (Number(tokenRate) > 0) {
        cardLnrToReceiveEl.textContent = `${(
          (usdValue / BNB_PRICE_IN_USD) *
          Number(tokenRate)
        ).toLocaleString("en-US", { maximumFractionDigits: 0 })} LNR`;
      } else {
        cardLnrToReceiveEl.textContent = "0 LNR";
      }
    });
  }

  if (buyWithCardButton) {
    buyWithCardButton.addEventListener("click", () => {
      const usdValue = parseFloat(cardAmountInput?.value || "0");
      if (!usdValue || usdValue < 5) {
        alert("Minimum purchase: $5 USD");
        return;
      }
      openCoinbaseOnramp(usdValue);
    });
  }

  // INICIALIZAÇÕES DE PRESALE
  populateTokenCards();
  startCountdown();
  updatePresaleData();
  listenForPurchases();
  setInterval(updatePresaleData, 30000);

  // AUTO BUY: checa novo BNB periodicamente
  setInterval(checkAutoBuy, 8000);

  if (web3Modal.cachedProvider) {
    connectWallet();
  }

  // CURSOR NEON PERSONALIZADO
  const customCursor = document.querySelector(".custom-cursor");
  if (customCursor) {
    window.addEventListener("mousemove", (e) => {
      customCursor.style.left = e.clientX + "px";
      customCursor.style.top = e.clientY + "px";
    });

    const hoverTargets = document.querySelectorAll(
      "a, button, .neon-button, .merch-card, .token-card, .roadmap-item"
    );

    hoverTargets.forEach((el) => {
      el.addEventListener("mouseenter", () =>
        customCursor.classList.add("custom-cursor--active")
      );
      el.addEventListener("mouseleave", () =>
        customCursor.classList.remove("custom-cursor--active")
      );
    });
  }

  // PARTÍCULAS GALÁCTICAS
  const canvas = document.getElementById("bg-particles");
  if (canvas) {
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      console.warn("Canvas encontrado, mas getContext('2d') retornou null.");
    } else {
      let particles = [];
      const PARTICLE_COUNT = 80;

      function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      window.addEventListener("resize", resizeCanvas);
      resizeCanvas();

      function createParticles() {
        particles = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 2 + 0.5,
            vx: (Math.random() - 0.5) * 0.2,
            vy: (Math.random() - 0.5) * 0.2,
            alpha: Math.random() * 0.5 + 0.3,
          });
        }
      }

      function animateParticles() {
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ffffff";

        particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x = canvas.width;
          if (p.x > canvas.width) p.x = 0;
          if (p.y < 0) p.y = canvas.height;
          if (p.y > canvas.height) p.y = 0;

          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        });

        requestAnimationFrame(animateParticles);
      }

      createParticles();
      animateParticles();
    }
  }

  // SONS FUTURISTAS (HOVER / CLICK)
  const hoverSound = document.getElementById("ui-hover-sound");
  const clickSound = document.getElementById("ui-click-sound");

  const interactiveSelectors = [
    ".neon-button",
    ".nav-link",
    ".merch-card",
    ".token-card",
    ".roadmap-item",
    ".security-card",
  ];

  interactiveSelectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      el.addEventListener("mouseenter", () => {
        if (!hoverSound) return;
        hoverSound.currentTime = 0;
        hoverSound.play().catch(() => {});
      });

      el.addEventListener("click", () => {
        if (!clickSound) return;
        clickSound.currentTime = 0;
        clickSound.play().catch(() => {});
      });
    });
  });
});
