// backend/src/controllers/coinbaseController.js
import axios from "axios";
import { coinbaseConfig } from "../config/coinbaseConfig.js";
import { generateCdpToken } from "../utils/coinbaseAuth.js";
import { v4 as uuidv4 } from "uuid";

export async function createOnrampOrder(req, res) {
  try {
    const {
      destinationAddress,
      amountInfo,
      userInfo,
      network = "base",
    } = req.body;

    if (!destinationAddress || !amountInfo?.amount || !amountInfo?.currency) {
      return res.status(400).json({
        message: "destinationAddress e amountInfo (amount, currency) são obrigatórios.",
      });
    }

    const nowIso = new Date().toISOString();
    const partnerUserRef = `sandbox-user-${crypto.randomUUID()}`;

    const payload = {
      purchaseCurrency: "USDC",
      paymentCurrency: amountInfo.currency || "USD",
      paymentAmount: amountInfo.amount,
      destinationAddress,
      destinationNetwork: network,
      paymentMethod: "GUEST_CHECKOUT_APPLE_PAY",
      email: userInfo?.email || "user@example.com",
      phoneNumber: userInfo?.phone || "+15555555555",
      acceptedTerms: nowIso,
      phoneNumberVerifiedAt: nowIso,
      agreementAcceptedAt: nowIso,
      partnerUserRef,
    };

    console.log("📡 Criando Ordem Onramp:", payload);

    const client = await getCoinbaseClient();
    const response = await client.post("/onramp-orders", payload);
    const data = response.data;

    console.log("✅ Ordem Onramp criada:", data);

    // Se vier um onrampUrl ou parecido, já devolve pro front
    if (data && (data.onrampUrl || data.url)) {
      return res.json({
        onrampUrl: data.onrampUrl || data.url,
        raw: data,
      });
    }

    // Se vier um sessionToken para o widget cbpay-js
    if (data && data.sessionToken) {
      return res.json({
        sessionToken: data.sessionToken,
        raw: data,
      });
    }

    // Fallback: devolve tudo que veio
    return res.json({
      message: "Ordem Onramp criada, mas sem sessionToken/onrampUrl explícitos.",
      raw: data,
    });
    } catch (error) {
    const apiError = error?.response?.data;
    console.error("❌ Erro Onramp:", apiError || error.message);

    // 🚫 Caso 1: Coinbase bloqueou guest checkout na sua região
    if (apiError?.errorType === "guest_region_forbidden") {
      // URL base do provedor alternativo (Transak / Ramp / etc.)
      // Coloque no .env algo como:
      // LUNARO_FIAT_FALLBACK_URL="https://global.transak.com/?fiatCurrency=USD&cryptoCurrencyCode=BNB&network=BNB_MAINNET&walletAddress={ADDRESS}"
      const baseFallback = process.env.LUNARO_FIAT_FALLBACK_URL || "https://global.transak.com";

      const destinationAddress = req.body?.destinationAddress;
      const fallbackUrl = destinationAddress
        ? baseFallback.replace("{ADDRESS}", destinationAddress)
        : baseFallback;

      // ✅ Em vez de erro, devolvemos 200 com URL de fallback
      return res.json({
        error: "COINBASE_REGION_BLOCKED",
        message: apiError.errorMessage,
        onrampUrl: fallbackUrl,
      });
    }

    // ❌ Outros erros reais (token inválido, config errada, etc.)
    return res.status(error?.response?.status || 500).json({
      error: "Erro ao criar ordem Onramp",
      details: apiError || error.message,
    });
  }
}
