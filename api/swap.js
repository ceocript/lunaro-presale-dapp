// /api/swap.js (VERSÃO IMPERIAL CORRIGIDA)
import axios from 'axios';

export default async function handler(request, response) {
    // 1. OBTER A CHAVE SECRETA (Que vamos configurar na Vercel)
    const ONE_INCH_API_KEY = process.env.VITE_1INCH_API_KEY;

    if (!ONE_INCH_API_KEY) {
        return response.status(500).json({ error: 'Chave da API não configurada no servidor.' });
    }

    // 2. OBTER OS DADOS DO PEDIDO DO SITE ('main.js')
    // O 'toTokenAddress' AGORA É O NOSSO CONTRATO
    const { fromTokenAddress, toTokenAddress, amount, fromAddress, destReceiver } = request.body;

    if (!fromTokenAddress || !toTokenAddress || !amount || !fromAddress || !destReceiver) {
        return response.status(400).json({ error: 'Parâmetros inválidos. Faltando: fromTokenAddress, toTokenAddress, amount, fromAddress, destReceiver' });
    }

    // 3. MONTAR A CHAMADA PARA A 1INCH
    const chainId = 56; // BNB Chain
    const url = `https://api.1inch.dev/swap/v6.0/${chainId}/swap`;

    // 4. CONFIGURAR OS PARÂMETROS DA TROCA
    const config = {
        headers: {
            "Authorization": `Bearer ${ONE_INCH_API_KEY}`
        },
        params: {
            "src": fromTokenAddress, // Moeda que o usuário paga (ex: USDT)
            // 'dst' (destino) é o token nativo da rede, BNB.
            "dst": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeE", 
            "amount": amount, // Quantidade de USDT
            "from": fromAddress, // Carteira do usuário
            // 'receiver' é quem recebe o BNB trocado.
            // Nós queremos que o CONTRATO DE PRÉ-VENDA receba o BNB.
            "receiver": toTokenAddress, 
            "slippage": 1, // 1%
            "allowPartialFill": false,
            // 'destReceiver' é quem o *nosso contrato* vai creditar com LNR.
            // Nós passamos o endereço do usuário original aqui.
            "destReceiver": destReceiver 
        }
    };

    // 5. FAZER A MÁGICA: CHAMAR A 1INCH
    try {
        const { data } = await axios.get(url, config);
        // Retorna as instruções da transação para o 'main.js'
        response.status(200).json(data);

    } catch (error) {
        // Se a 1inch der um erro (ex: "não há liquidez"), ele será pego aqui
        console.error("Erro ao chamar a API da 1inch:", error.response?.data?.description || error.message);
        response.status(500).json({ 
            error: 'Falha ao obter dados do swap da 1inch.', 
            details: error.response?.data?.description || error.response?.data 
        });
    }
}