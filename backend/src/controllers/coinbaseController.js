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
    console.error("❌ Erro Onramp:", error?.response?.data || error);

    const status = error.response?.status || 500;
    const errorData = error.response?.data || {};
    const errorType =
      errorData.errorType || errorData.error || errorData.code;

    // 🔥 CASO ESPECÍFICO: região não permitida pra guest onramp
    if (errorType === "guest_region_forbidden") {
      return res.status(403).json({
        code: "GUEST_REGION_FORBIDDEN",
        message:
          "Guest onramp transactions are not allowed in the user's region.",
        docs: errorData.errorLink,
      });
    }

    // Outros erros genéricos
    return res.status(status).json({
      code: errorType || "ONRAMP_ERROR",
      message: "Erro ao criar ordem Onramp na Coinbase.",
      details: errorData,
    });
  }
}
