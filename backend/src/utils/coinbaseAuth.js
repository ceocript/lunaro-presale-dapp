// backend/src/utils/coinbaseAuth.js
import { generateJwt } from "@coinbase/cdp-sdk/auth";
import { coinbaseConfig } from "../config/coinbaseConfig.js";

export async function generateCdpToken(method, requestPath) {
  try {
    const jwt = await generateJwt({
      apiKeyId: coinbaseConfig.cdpKeyName,        // COINBASE_CDP_KEY_NAME
      apiKeySecret: coinbaseConfig.cdpPrivateKey, // COINBASE_CDP_PRIVATE_KEY (Ed25519 base64)
      requestMethod: method,                      // "POST"
      requestHost: coinbaseConfig.requestHost,    // "api.cdp.coinbase.com"
      requestPath,                                // "/platform/v2/onramp/orders"
      expiresIn: 120,
    });

    return jwt;
  } catch (error) {
    console.error("Erro ao gerar JWT CDP:", error.message || error);
    throw new Error(`Falha na autenticação CDP: ${error.message}`);
  }
}
