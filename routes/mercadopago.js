// routes/mercadopago.js
import express from 'express';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

router.post('/create_preference', async (req, res) => {
  const { title, unit_price, quantity, nombre, email } = req.body;
  const { date, time } = req.query;

  if (!date || !time) {
    return res.status(400).json({ error: 'Falta fecha u hora' });
  }

  try {
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            title,
            unit_price: Number(unit_price),
            quantity,
          }
        ],
        payer: {
          name: nombre,
          email,
        },
        back_urls: {
          success: `${process.env.FRONTEND_URL}/success`,
          failure: `${process.env.FRONTEND_URL}/failure`,
          pending: `${process.env.FRONTEND_URL}/pending`,
        },
        auto_return: 'approved',
        notification_url: `${process.env.BACKEND_URL}/api/mercadopago/webhook`,
        metadata: {
          nombre,
          email,
          tipo: title,
          date,
          time,
        },
      },
    });

    res.status(200).json({ init_point: result.init_point });
  } catch (error) {
    console.error('❌ Error al crear preferencia:', error);
    res.status(500).json({ error: 'Error al generar preferencia' });
  }
});

export default router;
