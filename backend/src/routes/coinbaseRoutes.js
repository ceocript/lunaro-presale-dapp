import express from "express";
import { createOnrampOrder } from "../controllers/coinbaseController.js";

const router = express.Router();

// Rota antiga (Commerce)
// router.post("/session", createCoinbaseSession); 

// Nova Rota (Onramp Apple Pay)
router.post("/onramp-order", createOnrampOrder);

export default router;