// pages/api/quote.js
// BACK-END SEGURO (Oráculo) - Apenas para preview de cotação

import axios from 'axios';

const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY;
const ONEINCH_BASE_URL = "https://api.1inch.dev/swap/v6.0/56"; // Chain ID 56

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  if (!ONEINCH_API_KEY) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
  }

  try {
    const { fromTokenAddress, toTokenAddress, amount } = req.body;

    const config = {
      headers: { 'Authorization': `Bearer ${ONEINCH_API_KEY}` },
      params: { fromTokenAddress, toTokenAddress, amount }
    };

    const response = await axios.get(`${ONEINCH_BASE_URL}/quote`, config);
    
    // Retorna APENAS o valor
    res.status(200).json({ toAmount: response.data.toAmount });

  } catch (err) {
    const errorData = err.response?.data || { message: err.message };
    res.status(500).json({ error: 'Falha ao obter cotação', details: errorData });
  }
}