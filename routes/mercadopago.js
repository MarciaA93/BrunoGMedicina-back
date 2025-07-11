// routes/mercadopago.js
import express from 'express';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

const preference = new Preference(client);

router.post('/create_preference', async (req, res) => {
  const { title, unit_price, quantity, nombre, email, date, time } = req.body;

  // Validación fuerte
  if (!title || !unit_price || !quantity || !nombre || !email || !date || !time) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  try {
    const result = await preference.create({
      body: {
        items: [
          {
            title: String(title),
            unit_price: Number(unit_price),
            quantity: Number(quantity),
            currency_id: 'ARS'
          }
        ],
        payer: {
          email: String(email),
        },
        back_urls: {
          success: `${process.env.FRONTEND_URL}/success`,
          failure: `${process.env.FRONTEND_URL}/failure`,
          pending: `${process.env.FRONTEND_URL}/pending`
        },
        auto_return: 'approved',
        notification_url: `${process.env.BACKEND_URL}/api/mercadopago/webhook`,
        metadata: {
          nombre: String(nombre),
          email: String(email),
          tipo: String(title),
          date: String(date),
          time: String(time),
        }
      }
    });

    console.log('👉 Resultado de preferencia:', result);

    res.status(200).json({ init_point: result.init_point });

  } catch (error) {
    console.error('❌ Error al crear preferencia:', error.message || error);
    res.status(500).json({ error: 'Error al generar preferencia' });
  }
});

export default router;
