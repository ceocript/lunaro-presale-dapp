import express from "express";
import cors from "cors";

import coinbaseRoutes from "./routes/coinbaseRoutes.js";
import kamoneyRoutes from "./routes/kamoneyRoutes.js"; // 👈 NOVO

const app = express();

app.use(cors());
app.use(express.json());

// rotas já existentes
app.use("/api/coinbase", coinbaseRoutes);

// 👇 nova rota Kamoney
app.use("/api/kamoney", kamoneyRoutes);

export default app;
