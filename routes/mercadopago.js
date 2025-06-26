// routes/mercadopago.js
import express from 'express';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import dotenv from 'dotenv';


dotenv.config();

const router = express.Router();
console.log('🔑 MP_ACCESS_TOKEN:', process.env.MP_ACCESS_TOKEN);

// Configurar Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

router.post('/create_preference', async (req, res) => {
  const { title, unit_price } = req.body;
  const { date, time } = req.query;

  
  console.log('📦 Body recibido:', req.body);
  console.log('📅 Fecha:', date, '⏰ Hora:', time);

  try {
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            title,
            unit_price: Number(unit_price),
            quantity: 1
          }
        ],
        back_urls: {
          success: `${process.env.FRONTEND_URL}?pago=exitoso`,
          failure: `${process.env.FRONTEND_URL}?pago=fallo`,
          pending: `${process.env.FRONTEND_URL}?pago=pendiente`
        },
        notification_url: `${process.env.BACKEND_URL}/api/mercadopago/webhook?date=${date}&time=${time}`,
        auto_return: 'approved'
      }
    });

    console.log('🔗 Init point generado:', result.init_point);
    res.json({ init_point: result.init_point });

  } catch (err) {
    console.error('❌ Error al crear preferencia:\n', err);
    res.status(500).json({ error: 'No se pudo crear la preferencia de pago' });
  }
});

export default router;
