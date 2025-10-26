// /api/swap.js (VERSÃO IMPERIAL KYBERSWAP - SEM API KEY!)
import axios from 'axios';

export default async function handler(request, response) {
    // 1. OBTER OS DADOS DO PEDIDO DO 'main.js'
    // (fromAddress = Carteira do Usuário)
    // (toTokenAddress = Seu Contrato)
    // (destReceiver = Carteira do Usuário, para o contrato saber quem creditar)
    const { fromTokenAddress, toTokenAddress, amount, fromAddress, destReceiver } = request.body;

    if (!fromTokenAddress || !toTokenAddress || !amount || !fromAddress || !destReceiver) {
        return response.status(400).json({ error: 'Parâmetros inválidos.' });
    }

    const chainId = 56; // BNB Chain

    // ==========================================================
    // FASE 1: OBTER A ROTA (GET QUOTE) DO KYBERSWAP
    // ==========================================================
    let routeSummary;
    try {
        const routeUrl = `https://aggregator-api.kyberswap.com/bsc/api/v1/routes`;
        const routeParams = {
            tokenIn: fromTokenAddress, // Moeda que o usuário paga (ex: USDT)
            tokenOut: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeE", // Moeda que o contrato recebe (BNB Nativo)
            amountIn: amount,
        };
        const { data: routeData } = await axios.get(routeUrl, { params: routeParams });
        routeSummary = routeData.data.routeSummary;
        
        if (!routeSummary) {
            throw new Error('KyberSwap: Nenhuma rota de liquidez encontrada.');
        }

    } catch (error) {
        console.error("Erro KyberSwap (FASE 1 - ROTA):", error.response?.data || error.message);
        return response.status(500).json({ 
            error: 'KyberSwap falhou ao encontrar uma rota.', 
            details: error.response?.data?.message || error.message 
        });
    }

    // ==========================================================
    // FASE 2: CONSTRUIR A TRANSAÇÃO (GET SWAP DATA)
    // ==========================================================
    try {
        const buildUrl = `https://aggregator-api.kyberswap.com/bsc/api/v1/route/build`;
        const buildBody = {
            routeSummary: routeSummary,
            recipient: toTokenAddress, // O BNB vai para o seu CONTRATO (toTokenAddress)
            sender: fromAddress, // A carteira do usuário (fromAddress)
            slippageTolerance: 100, // 1% (100 = 1%)
            deadline: Math.floor(Date.now() / 1000) + 1200, // 20 minutos
        };

        const { data: buildData } = await axios.post(buildUrl, buildBody, {
             // Este 'x-client-id' é público, NÃO é uma chave secreta!
             headers: { 'x-client-id': 'lunaro-presale-dapp' } 
        });

        // O KyberSwap retorna o "tx.data" dentro de "data.data"
        // Vamos formatar para o 'main.js' entender (mesmo formato da 1inch)
        const swapTxData = {
            tx: {
                from: buildData.data.sender,
                to: buildData.data.routerAddress, // O "Spender" (Roteador do Kyber)
                data: buildData.data.data,
                value: buildData.data.value
            }
        };
        
        // Retorna as instruções da transação para o 'main.js'
        response.status(200).json(swapTxData);

    } catch (error) {
        console.error("Erro KyberSwap (FASE 2 - BUILD):", error.response?.data || error.message);
        return response.status(500).json({ 
            error: 'KyberSwap falhou ao construir a transação.', 
            details: error.response?.data?.message || error.message 
        });
    }
}