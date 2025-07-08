import express from 'express';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

router.post('/test_preference', async (req, res) => {
  try {
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            title: 'Masaje Test',
            unit_price: 25000,
            quantity: 1,
            currency_id: 'ARS',
          }
        ],
        payer: {
          name: 'Cliente Test',
          email: 'cliente@test.com',
        },
        back_urls: {
          success: `${process.env.FRONTEND_URL}/success`,
          failure: `${process.env.FRONTEND_URL}/failure`,
          pending: `${process.env.FRONTEND_URL}/pending`,
        },
        auto_return: 'approved',
        notification_url: `${process.env.BACKEND_URL}/api/mercadopago/webhook`,
      },
    });

    res.status(200).json({ init_point: result.init_point });
  } catch (error) {
    console.error('❌ Error al crear preferencia de prueba:', error);
    res.status(500).json({ error: 'Error al generar preferencia de prueba' });
  }
});

export default router;
