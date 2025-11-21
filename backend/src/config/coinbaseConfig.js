// backend/src/config/coinbaseConfig.js
import dotenv from "dotenv";
dotenv.config();

export const coinbaseConfig = {
  // Host da CDP (v2 /platform)
  baseUrl: "https://api.cdp.coinbase.com",

  // host usado na assinatura do JWT
  requestHost: "api.cdp.coinbase.com",

  // caminho fixo para criar ordem Onramp
  ordersPath: "/platform/v2/onramp/orders",

  // vem do .env
  cdpKeyName: process.env.COINBASE_CDP_KEY_NAME,
  cdpPrivateKey: process.env.COINBASE_CDP_PRIVATE_KEY,
};