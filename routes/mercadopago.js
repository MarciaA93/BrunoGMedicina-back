// routes/mercadopago.js
import express from 'express';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Configurar Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// Ruta para Checkout API
router.post('/pagar', async (req, res) => {
  const { token, description, amount, email, installments, payment_method_id, issuer_id } = req.body;

  console.log('🧾 Pago recibido:', req.body);

  try {
    const payment = new Payment(client);
    const result = await payment.create({
      body: {
        token,
        description,
        transaction_amount: Number(amount),
        installments: Number(installments),
        payment_method_id,
        issuer_id,
        payer: {
          email,
        },
      },
    });

    console.log('✅ Pago procesado:', result);
    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error al procesar pago:', error);
    res.status(500).json({ error: 'Fallo en el procesamiento del pago' });
  }
});

export default router;