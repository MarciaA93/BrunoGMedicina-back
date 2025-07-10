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
        title: "Masaje prueba",
        unit_price: 1000,
        quantity: 1,
        currency_id: "ARS"
      }
    ],
    payer: {
      email: "cliente@test.com"
    },
    back_urls: {
      success: "https://brunomtch.com/success",
      failure: "https://brunomtch.com/failure",
      pending: "https://brunomtch.com/pending"
    },
    auto_return: "approved"
  }
});
      console.log("👉 Resultado de preferencia:", result);


    res.status(200).json({ init_point: result.init_point });
  } catch (error) {
    console.error('❌ Error al crear preferencia:', error.message || error);
    res.status(500).json({ error: 'Error al generar preferencia' });
  }
});

export default router;
