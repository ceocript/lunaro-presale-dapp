// backend/src/config/kamoneyConfig.js
import axios from "axios";

const KAMONEY_BASE_URL = process.env.KAMONEY_BASE_URL;

export const kamoneyApi = axios.create({
  baseURL: KAMONEY_BASE_URL,
  timeout: 15000,
});

// Interceptor para autenticação
kamoneyApi.interceptors.request.use((config) => {
  const publicKey = process.env.KAMONEY_PUBLIC_KEY;
  const secretKey = process.env.KAMONEY_SECRET_KEY;

  // ⚠️ Ajusta esses headers de acordo com a documentação oficial da Kamoney
  config.headers["X-API-KEY"] = publicKey;
  config.headers["X-API-SECRET"] = secretKey;
  config.headers["Content-Type"] = "application/json";

  return config;
});
