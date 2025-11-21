import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import coinbaseRoutes from "./routes/coinbaseRoutes.js";

dotenv.config();

const app = express();

// Middlewares
app.use(cors({
  origin: [
    "http://localhost:5173",   // Vite
    "https://lunarocoin.com"  // produção – ajusta pro seu domínio
  ],
  credentials: true
}));
app.use(express.json());

// Rotas
app.use("/api/coinbase", coinbaseRoutes);

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Lunaro backend online" });
});

export default app;