// backend/src/routes/kamoneyRoutes.js
import express from "express";
import { createPaymentLink } from "../controllers/kamoneyController.js";

const router = express.Router();

// POST /api/kamoney/paymentlink
router.post("/paymentlink", createPaymentLink);

export default router;
