// routes/mercadopago.js
import express from 'express';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

router.post('/create_preference', async (req, res) => {
  const { title, unit_price, nombre, email } = req.body;
  const { date, time } = req.query;

  try {
    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: [{
          title,
          unit_price: Number(unit_price),
          quantity: 1
        }],
        back_urls: {
          success: `${process.env.FRONTEND_URL}?pago=exitoso`,
          failure: `${process.env.FRONTEND_URL}?pago=fallo`,
          pending: `${process.env.FRONTEND_URL}?pago=pendiente`
        },
        auto_return: 'approved',
        metadata: { nombre, email, date, time, tipo: title },
        notification_url: `${process.env.BACKEND_URL}/api/mercadopago/webhook`
      }
    });

    res.json({ init_point: result.init_point });
  } catch (error) {
    console.error('❌ Error creando preferencia:', error);
    res.status(500).json({ error: 'Error al generar la preferencia de pago' });
  }
});

export default router;