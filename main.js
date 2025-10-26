// main.js (VERSÃO IMPERIAL VIDENTE - CORRIGE O FALSO "INSUFFICIENT FUNDS")
import { ethers } from "ethers";
import Web3Modal from "web3modal";
import { contractAddress, contractABI, tokens } from "./constants/index.js";

// ========================================================================
// CONFIGURAÇÃO DO IMPÉRIO (!!! ATUALIZE AQUI !!!)
// ========================================================================
const COUNTDOWN_END_DATE = '2025-12-31T23:59:59';
const BNB_PRICE_IN_USD = 1090;
const USDT_PRICE_IN_USD = 1;
const WALLETCONNECT_PROJECT_ID = '32ed3ea3bca55289803b2a1972da8a07';
// ========================================================================

// --- CONFIGURAÇÃO DO WEB3MODAL ---
const providerOptions = {
  walletconnect: {
    package: true,
    options: {
      projectId: WALLETCONNECT_PROJECT_ID,
      chains: [56], // BNB Chain Mainnet
    },
  },
};
const web3Modal = new Web3Modal({
  cacheProvider: true, 
  providerOptions,
  theme: "dark",
});

// --- VARIÁVEIS GLOBAIS ---
let provider, signer, userAddress, contract;
let tokenRate = BigInt(0); // Taxa de LNR por 1 BNB
let isSaleActive = false; // <<< O OLHO VIDENTE!

// --- ELEMENTOS DO DOM ---
const el = (id) => document.getElementById(id);
// Globais
const connectWalletBtn = el('connectWalletBtn');
const purchaseSuccessModal = el('purchaseSuccessModal');
const purchaseFailureModal = el('purchaseFailureModal');
const liveFeedList = el('live-feed-list');
// Abas
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
// Aba BNB
const countdownEl = el('countdown');
const totalRaisedDisplay = el('totalRaisedDisplay');
const hardCapDisplay = el('hardCapDisplay');
const progressBarFill = el('progressBarFill');
const walletStatusEl = el('walletStatus'); 
const walletAddressEl = el('walletAddress');
const currencyAmountInput = el('currencyAmount');
const lnrToReceiveEl = el('lnrToReceive');
const buyButton = el('buyButton');
// Aba USDT
const usdtAmountInput = el('usdtAmount');
const usdtLnrToReceiveEl = el('usdtLnrToReceive');
const buyWithUsdtButton = el('buyWithUsdtButton');
// Aba Card
const cardAmountInput = el('cardAmount');
const cardLnrToReceiveEl = el('cardLnrToReceive');
const buyWithCardButton = el('buyWithCardButton');

// --- LÓGICA DAS ABAS DE PAGAMENTO ---
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.add('hidden'));
        tab.classList.add('active');
        const targetContent = el(`tab-${tab.dataset.tab}`);
        if (targetContent) {
            targetContent.classList.remove('hidden');
        }
    });
});

// --- FUNÇÕES DE FEEDBACK VISUAL ---
function showFeedback(modalElement) {
    if (modalElement) modalElement.classList.remove('hidden');
    setTimeout(() => {
        if (modalElement) modalElement.classList.add('hidden');
    }, 3000); 
}

// --- LÓGICA DE CONEXÃO ---
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

    updateUIOnConnect(userAddress);
    // listenForPurchases(); // Mantenha comentado para evitar erros de nó
  } catch (error) {
    console.error("Could not connect to wallet:", error);
  }
}

async function disconnect() {
    await web3Modal.clearCachedProvider();
    provider = signer = userAddress = contract = null;
    updateUIOnDisconnect();
}

function updateUIOnConnect(address) {
    if (walletStatusEl) walletStatusEl.textContent = 'Connected';
    if (walletStatusEl) walletStatusEl.className = 'neon-text-green';
    if (walletAddressEl) walletAddressEl.textContent = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    if (connectWalletBtn) connectWalletBtn.textContent = 'Disconnect';
    
    // ATIVAÇÃO CONDICIONAL!
    if (isSaleActive) {
        enablePurchaseButtons();
    } else {
        disablePurchaseButtons("Sale is not active");
    }
    
    updatePresaleData();
}

function updateUIOnDisconnect() {
    if (walletStatusEl) walletStatusEl.textContent = 'Disconnected';
    if (walletStatusEl) walletStatusEl.className = 'neon-text-purple';
    if (walletAddressEl) walletAddressEl.textContent = '';
    if (connectWalletBtn) connectWalletBtn.textContent = 'Connect Wallet';
    disablePurchaseButtons("Connect wallet");
}

function enablePurchaseButtons() {
    if (currencyAmountInput) { currencyAmountInput.disabled = false; currencyAmountInput.placeholder = "Ex: 0.5 BNB"; }
    if (buyButton) { buyButton.disabled = false; buyButton.textContent = "BUY WITH BNB"; }
    if (usdtAmountInput) { usdtAmountInput.disabled = false; usdtAmountInput.placeholder = "Ex: 100 USDT"; }
    if (buyWithUsdtButton) { buyWithUsdtButton.disabled = false; buyWithUsdtButton.textContent = "BUY WITH USDT"; }
    if (cardAmountInput) { cardAmountInput.disabled = false; cardAmountInput.placeholder = "Ex: 100 USD"; }
    if (buyWithCardButton) { buyWithCardButton.disabled = false; buyWithCardButton.textContent = "BUY WITH CARD"; }
}

function disablePurchaseButtons(reason) {
    if (currencyAmountInput) { currencyAmountInput.disabled = true; currencyAmountInput.placeholder = reason; }
    if (buyButton) { buyButton.disabled = true; buyButton.textContent = reason; }
    if (usdtAmountInput) { usdtAmountInput.disabled = true; usdtAmountInput.placeholder = reason; }
    if (buyWithUsdtButton) { buyWithUsdtButton.disabled = true; buyWithUsdtButton.textContent = reason; }
    if (cardAmountInput) { cardAmountInput.disabled = true; cardAmountInput.placeholder = reason; }
    if (buyWithCardButton) { buyWithCardButton.disabled = true; buyWithCardButton.textContent = reason; }
}


// --- LÓGICA DA PRÉ-VENDA (Leitura de Contrato) ---
async function updatePresaleData() {
    // Usando um nó RPC público e robusto
    const publicProvider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
    const readOnlyContract = new ethers.Contract(contractAddress, contractABI, publicProvider);
    
    try {
        // Assegura que o contrato foi inicializado antes de ler
        const isInitialized = await readOnlyContract.initialized();
        if (!isInitialized) {
            console.warn("Contrato não inicializado. Aguardando inicialização...");
            if (totalRaisedDisplay) totalRaisedDisplay.textContent = "Aguardando Início...";
            if (hardCapDisplay) hardCapDisplay.textContent = "Hard Cap: Carregando...";
            disablePurchaseButtons("Sale not started");
            return;
        }

        const [totalRaised, hardCap, price, saleStatus] = await Promise.all([ // <<< CORREÇÃO
            readOnlyContract.totalRaised(),
            readOnlyContract.hardCap(),
            readOnlyContract.tokenPrice(),
            readOnlyContract.saleActive() // <<< CORREÇÃO: LÊ O STATUS DA VENDA
        ]);
        
        isSaleActive = saleStatus; // <<< CORREÇÃO: ATUALIZA O OLHO VIDENTE
        
        const totalRaisedBNB = ethers.formatEther(totalRaised);
        const hardCapBNB = ethers.formatEther(hardCap);
        
        if (totalRaisedDisplay) totalRaisedDisplay.textContent = `${parseFloat(totalRaisedBNB).toFixed(4)} BNB Raised`;
        if (hardCapDisplay) hardCapDisplay.textContent = `Hard Cap: ${hardCapBNB} BNB`;
        if (progressBarFill) progressBarFill.style.width = `${(Number(totalRaisedBNB) / Number(hardCapBNB)) * 100}%`;
        
        // Calcula a taxa: Quantos LNR você recebe por 1 BNB
        const oneBNB = ethers.parseEther("1");
        tokenRate = oneBNB / price;
        console.log(`Token Rate (LNR per 1 BNB): ${tokenRate}`);
        console.log(`Sale Status (isSaleActive): ${isSaleActive}`); // <<< LOG DE BATALHA

        // ATIVA OS BOTÕES SE A VENDA ESTIVER ATIVA E A CARTEIRA CONECTADA
        if (isSaleActive && userAddress) {
            enablePurchaseButtons();
        } else if (!isSaleActive) {
            disablePurchaseButtons("Sale is not active");
        }

    } catch (err) { 
        console.error("Could not fetch presale data. O contrato foi inicializado?", err); 
        if (totalRaisedDisplay) totalRaisedDisplay.textContent = "Erro ao carregar dados";
        disablePurchaseButtons("Error fetching data");
    }
}

// --- LÓGICA DE COMPRA (BNB Direto) ---
async function buyLunaro() {
    if (!contract) return alert("Please connect your wallet first.");
    const amount = currencyAmountInput.value;
    if (!amount || amount <= 0) return alert("Please enter a valid BNB amount.");
    
    buyButton.disabled = true;
    buyButton.textContent = "PROCESSING...";

    try {
        const value = ethers.parseEther(amount);
        // <<< CORREÇÃO: USANDO callStatic PARA PREVER O ERRO
        // Isso simula a transação sem custo de gás. Se ela falhar, ela vai
        // nos dar o motivo real do "revert" do contrato!
        await contract.buy.staticCall({ value });

        // Se o callStatic passou, a transação real pode ir.
        const tx = await contract.buy({ value });
        alert("Transaction sent! Awaiting confirmation...");
        await tx.wait();
        showFeedback(purchaseSuccessModal);
        await updatePresaleData();

    } catch (err) {
        console.error(err);
        // Tenta extrair a mensagem de erro "Revert" do contrato
        const reason = err.reason || err.data?.message || err.message;
        alert(`Transaction Failed: ${reason}`); // <<< AGORA VAI MOSTRAR O ERRO REAL
        showFeedback(purchaseFailureModal);
    } finally {
        buyButton.disabled = false;
        if (isSaleActive) {
            buyButton.textContent = "BUY WITH BNB";
        } else {
            disablePurchaseButtons("Sale is not active");
        }
        currencyAmountInput.value = '';
        if (lnrToReceiveEl) lnrToReceiveEl.textContent = '0 LNR';
    }
}

// ========================================================================
// FUNÇÃO DE GUERRA: O COMANDO DO BASTIÃO (COMPRA COM TOKENS)
// ========================================================================
async function buyWithTokens() {
    if (!contract || !signer) return alert("Please connect your wallet first.");
    const amount = usdtAmountInput.value;
    if (!amount || amount <= 0) return alert("Please enter a valid USDT amount.");

    buyWithUsdtButton.disabled = true;
    buyWithUsdtButton.textContent = "1. PREPARING SWAP...";

    const fromToken = tokens.USDT; 
    const amountInWei = ethers.parseUnits(amount, fromToken.decimals).toString();

const body = {
    fromTokenAddress: String(fromToken.address),
    toTokenAddress: String(contractAddress),
    amount: String(amountInWei), // <<< GARANTE QUE A QUANTIA É UMA STRING
    fromAddress: String(userAddress),
    destReceiver: String(userAddress) 
};
    try {
        buyWithUsdtButton.textContent = "2. GETTING QUOTE...";
        const response = await fetch('/api/swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const swapData = await response.json();

        if (!response.ok) {
            // <<< CORREÇÃO: Tenta pegar o erro do Bastião
            let errorMsg = swapData.details || swapData.error || 'Failed to get swap data from 1inch';
            if (errorMsg.includes("Invalid API key")) { // <<< CORREÇÃO: ERRO ESPECÍFICO
                errorMsg = "API Key error. Contact support.";
                console.error("ERRO FATAL: A CHAVE DA API DA 1INCH ESTÁ INVÁLIDA OU FALTANDO NA VERCEL!");
            }
            throw new Error(errorMsg);
        }

        const spenderAddress = swapData.tx.to;
        const allowance = await checkAllowance(fromToken.address, spenderAddress);
        
        if (BigInt(allowance) < BigInt(amountInWei)) {
            buyWithUsdtButton.textContent = "3. APPROVE USDT...";
            await approveToken(fromToken.address, spenderAddress, amountInWei);
        }

        buyWithUsdtButton.textContent = "4. EXECUTING SWAP...";
        
        const tx = {
            from: userAddress,
            to: spenderAddress, 
            data: swapData.tx.data,
            value: swapData.tx.value
        };

        const transaction = await signer.sendTransaction(tx);
        alert("Swap sent! Awaiting confirmation...");
        await transaction.wait();
        
        showFeedback(purchaseSuccessModal);
        await updatePresaleData(); 

    } catch (err) {
        console.error("Swap failed:", err);
        alert(`Swap failed: ${err.message}`);
        showFeedback(purchaseFailureModal);
    } finally {
        buyWithUsdtButton.disabled = false;
        if (isSaleActive) {
            buyWithUsdtButton.textContent = "BUY WITH USDT";
        } else {
            disablePurchaseButtons("Sale is not active");
        }
        if (usdtAmountInput) usdtAmountInput.value = '';
    }
}

// --- FUNÇÕES AUXILIARES PARA O SWAP ---
async function checkAllowance(tokenAddress, spenderAddress) {
    const minABI = ["function allowance(address owner, address spender) view returns (uint256)"];
    const tokenContract = new ethers.Contract(tokenAddress, minABI, provider);
    return await tokenContract.allowance(userAddress, spenderAddress);
}

async function approveToken(tokenAddress, spenderAddress, amount) {
    const minABI = ["function approve(address spender, uint256 amount) returns (bool)"];
    const tokenContract = new ethers.Contract(tokenAddress, minABI, signer);
    const approveTx = await tokenContract.approve(spenderAddress, amount);
    await approveTx.wait();
}

// --- LÓGICA DE CÁLCULO DAS ABAS (SIMULAÇÃO) ---
function calculateLNR(inputValue, pricePerBNB) {
    if (Number(tokenRate) === 0) return 0;
    
    const valueInUSD = parseFloat(inputValue) || 0;
    const valueInBNB = valueInUSD / BNB_PRICE_IN_USD;
    const lnrValue = valueInBNB * Number(tokenRate);
    
    return lnrValue.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// --- FEED DE COMPRAS AO VIVO (Leitura de Eventos) ---
function listenForPurchases() {
    const publicProvider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
    const readOnlyContract = new ethers.Contract(contractAddress, contractABI, publicProvider);
    
    readOnlyContract.on("TokensPurchased", (buyer, amount) => {
        if (!liveFeedList) return;
        const item = document.createElement('div');
        item.className = 'live-purchase-item';
        const formattedAmount = parseFloat(ethers.formatEther(amount)).toLocaleString('en-US');
        const shortAddress = `${buyer.substring(0, 6)}...${buyer.substring(buyer.length - 4)}`;
        item.innerHTML = `✅ <span class="neon-text-blue">${shortAddress}</span> just bought <span class="neon-text-green">${formattedAmount} LNR</span>`;
        
        if (liveFeedList.children.length > 4) {
            liveFeedList.lastChild.remove();
        }
        liveFeedList.prepend(item);
    });
}

// --- COUNTDOWN ---
function startCountdown() {
    const interval = setInterval(() => {
        if (!countdownEl) { clearInterval(interval); return; }
        
        const distance = new Date(COUNTDOWN_END_DATE).getTime() - new Date().getTime();
        if (distance < 0) {
            clearInterval(interval);
            countdownEl.innerHTML = "<span class='neon-text-green'>PRESALE ENDED</span>";
            disablePurchaseButtons("Sale has ended");
            return;
        }
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        countdownEl.innerHTML = `<div><span>${String(days).padStart(2,'0')}</span><br><span class="text-base text-gray-500">DAYS</span></div> <div><span>${String(hours).padStart(2,'0')}</span><br><span class="text-base text-gray-500">HOURS</span></div> <div><span>${String(minutes).padStart(2,'0')}</span><br><span class="text-base text-gray-500">MINUTES</span></div> <div><span>${String(seconds).padStart(2,'0')}</span><br><span class="text-base text-gray-500">SECONDS</span></div>`;
    }, 1000);
}

// --- INICIALIZAÇÃO IMPERIAL (Event Listeners) ---
document.addEventListener('DOMContentLoaded', () => {
    AOS.init({ duration: 800, once: true });
    
    // Conexão
    if (connectWalletBtn) connectWalletBtn.addEventListener('click', () => userAddress ? disconnect() : connectWallet());
    
    // Compra com BNB
    if (buyButton) buyButton.addEventListener('click', buyLunaro);
    if (currencyAmountInput) {
        currencyAmountInput.addEventListener('input', (e) => {
            const bnbValue = parseFloat(e.target.value) || 0;
            if(Number(tokenRate) > 0) {
                const lnrValue = bnbValue * Number(tokenRate);
                if (lnrToReceiveEl) lnrToReceiveEl.textContent = `${lnrValue.toLocaleString('en-US', {maximumFractionDigits: 0})} LNR`;
            }
        });
    }

    // Compra com USDT (AGORA É REAL)
    if (usdtAmountInput) usdtAmountInput.addEventListener('input', (e) => {
        if (usdtLnrToReceiveEl) usdtLnrToReceiveEl.textContent = calculateLNR(e.target.value, USDT_PRICE_IN_USD) + ' LNR';
    });
    if (buyWithUsdtButton) buyWithUsdtButton.addEventListener('click', buyWithTokens); 

    // Compra com Cartão (Simulação)
    if (cardAmountInput) cardAmountInput.addEventListener('input', (e) => {
        if (cardLnrToReceiveEl) cardLnrToReceiveEl.textContent = calculateLNR(e.target.value, 1) + ' LNR'; // 1 para 1 USD
    });
    if (buyWithCardButton) buyWithCardButton.addEventListener('click', () => {
        alert("SIMULAÇÃO: Abrindo o widget de pagamento... \n\n(FASE 3: O desenvolvedor irá integrar o SDK do MoonPay aqui assim que sua conta for aprovada.)");
    });
    
    // Funções de inicialização
    startCountdown();
    updatePresaleData();
    // listenForPurchases(); // MANTENHA COMENTADO
    setInterval(updatePresaleData, 30000); // Atualiza os dados a cada 30 seg
    
    // Tenta reconectar se já estava logado
    if (web3Modal.cachedProvider) {
        connectWallet();
    }
});