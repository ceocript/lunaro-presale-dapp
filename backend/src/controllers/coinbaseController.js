// backend/src/controllers/coinbaseController.js
import axios from "axios";
import { coinbaseConfig } from "../config/coinbaseConfig.js";
import { generateCdpToken } from "../utils/coinbaseAuth.js";
import { v4 as uuidv4 } from "uuid";

export async function createOnrampOrder(req, res) {
  try {
    const {
      destinationAddress,
      amountInfo, // { amount: "100", currency: "USD" }
      userInfo,   // { email: "...", phone: "...", country?: "BR" }
      network = "base",
    } = req.body;

    if (!destinationAddress || !amountInfo || !userInfo) {
      return res.status(400).json({ error: "Dados incompletos." });
    }

    const requestPath = coinbaseConfig.ordersPath || "/platform/v2/onramp/orders";
    const url = `${coinbaseConfig.baseUrl}${requestPath}`;

    const nowISO = new Date().toISOString();

    // 🔥 AGORA EM camelCase, como a API pede
 const body = {
  purchaseCurrency: "USDC",
  paymentCurrency: amountInfo.currency || "USD",
  paymentAmount: amountInfo.amount,

  destinationAddress,
  destinationNetwork: network,

  paymentMethod: "GUEST_CHECKOUT_APPLE_PAY",

  email: userInfo.email,
  phoneNumber: userInfo.phone,

  acceptedTerms: nowISO,
  phoneNumberVerifiedAt: nowISO,
  agreementAcceptedAt: nowISO,

  // 👇 Campo que o schema está pedindo
  partnerUserRef: `sandbox-user-${uuidv4()}`,
};


    console.log("📡 Criando Ordem Onramp:", body);

    const token = await generateCdpToken("POST", requestPath);

    const response = await axios.post(url, body, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("✅ Ordem Onramp Criada:", response.data);
    return res.json(response.data);
  } catch (error) {
    console.error("❌ Erro Onramp:", error?.response?.data || error.message);
    return res.status(error?.response?.status || 500).json({
      error: "Erro ao criar ordem Onramp",
      details: error?.response?.data || error.message,
    });
  }
}
