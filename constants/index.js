// ========================================================================
//  LUNARO CONSTANTS - VERSÃO PRO FINAL (CORRIGIDA & LOWERCASE)
//  Rede: BNB Smart Chain (Mainnet)
// ========================================================================

// 1️⃣ ENDEREÇO DO SEU CONTRATO (LOWERCASE)
export const contractAddress = "0xf6963f9d368174d478126b8a3148bb614cfc6c4a";

// 2️⃣ ABI (Interface do Contrato)
export const contractABI = [
  { "inputs": [], "name": "tokenPrice", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "totalRaised", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "saleActive", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "initialized", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "decimals", "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "buy", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "approve", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "buyer", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }], "name": "TokensPurchased", "type": "event" }
];

// 3️⃣ ENDEREÇO DO ROUTER 1INCH (LOWERCASE)
export const oneInchRouter = "0x111111125421ca6dc452d289314280a0f8842a65";

// 4️⃣ SLIPPAGE PADRÃO GLOBAL
export const defaultSlippage = 1.5; // %

// 5️⃣ LISTA DE TOKENS (TODOS EM LOWERCASE PARA EVITAR ERRO DE CHECKSUM)
export const tokens = {
  USDT: {
    address: "0x55d398326f99059ff775485246999027b3197955", // Lowercase
    decimals: 18,
    name: "Tether USD",
    logo: "https://cryptologos.cc/logos/tether-usdt-logo.png?v=029"
  },
  USDC: {
    address: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // Lowercase
    decimals: 18,
    name: "USD Coin",
    logo: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=029"
  },
  ETH: {
    address: "0x2170ed0880ac9a755fd29b2688956bd959f933f8", // Lowercase
    decimals: 18,
    name: "Ethereum",
    logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png?v=029"
  },
  BTCB: {
    address: "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c", // Lowercase
    decimals: 18,
    name: "Bitcoin",
    logo: "https://cryptologos.cc/logos/bitcoin-btc-logo.png?v=029"
  },
  MATIC: {
    address: "0xcc42724c6683b7e57334c4e856f4c9965ed682bd", // Lowercase (Fundamental!)
    decimals: 18,
    name: "Polygon",
    logo: "https://cryptologos.cc/logos/polygon-matic-logo.png?v=029"
  },
  SOL: {
    address: "0x570A5D26f7765Ecb712C0924E4De545B89fD43dF", // Lowercase (Fundamental!)
    decimals: 18,
    name: "Solana",
    logo: "https://cryptologos.cc/logos/solana-sol-logo.png?v=029"
  },
  DAI: {
    address: "0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3", // Lowercase
    decimals: 18,
    name: "DAI Stablecoin",
    logo: "https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png?v=029"
  }
};