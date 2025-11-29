// backend/src/controllers/kamoneyController.js
import axios from "axios";
import { generateKamoneySignature } from "../utils/kamoneySign.js";

const KAMONEY_BASE_URL = process.env.KAMONEY_BASE_URL;
const KAMONEY_PUBLIC_KEY = process.env.KAMONEY_PUBLIC_KEY;
const KAMONEY_SECRET_KEY = process.env.KAMONEY_SECRET_KEY;

/**
 * Cria um link de pagamento na Kamoney (merchant/paymentlink)
 * Isso vai gerar um link que aceita Pix (e outros meios que você habilitar lá).
 *
 * FRONT envia: { amountBRL, label }
 */
export const createPaymentLink = async (req, res) => {
  try {
    const { amountBRL, label } = req.body;

    if (!amountBRL || !label) {
      return res.status(400).json({
        success: false,
        error: "amountBRL e label são obrigatórios.",
      });
    }

    // sempre incluir nonce (doc recomenda)
    const payload = {
      label: label,
      amount: Number(amountBRL),
      nonce: Date.now(), // timestamp único
    };

    // gera assinatura no padrão Kamoney (querystring + HMAC sha512)
    const { signature } = generateKamoneySignature(payload, KAMONEY_SECRET_KEY);

    const headers = {
      public: KAMONEY_PUBLIC_KEY,
      sign: signature,
      "Content-Type": "application/json",
    };

    const url = `${KAMONEY_BASE_URL}/private/merchant/paymentlink`;

    const response = await axios.post(url, payload, { headers });

    const data = response.data;

    if (!data.success) {
      console.error("Erro Kamoney:", data);
      return res.status(400).json({
        success: false,
        error: data.msg || "Erro ao criar paymentlink na Kamoney",
        raw: data,
      });
    }

    // data.data = { id, created, label, amount, link }
    return res.json({
      success: true,
      id: data.data.id,
      link: data.data.link, // esse é o link que você pode abrir no front
      raw: data.data,
    });
  } catch (err) {
    console.error("Erro createPaymentLink:", err.response?.data || err.message);
    return res.status(500).json({
      success: false,
      error: "Erro interno ao criar paymentlink na Kamoney",
    });
  }
};

