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
  console.log("📥 Datos recibidos en body:", req.body); // 👈 DEBUG CLAVE

  const { title, unit_price, quantity, nombre, email, date, time } = req.body;

  // Verificamos uno por uno
  if (!title) console.error("❌ Falta title");
  if (!unit_price) console.error("❌ Falta unit_price");
  if (!quantity) console.error("❌ Falta quantity");
  if (!nombre) console.error("❌ Falta nombre");
  if (!email) console.error("❌ Falta email");
  if (!date) console.error("❌ Falta date");
  if (!time) console.error("❌ Falta time");

  // Validación general
  if (!title || !unit_price || !quantity || !nombre || !email || !date || !time) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  try {
    const result = await preference.create({
  body: {
    items: [{
      title: "Test sin metadata",
      unit_price: 10,
      quantity: 1,
      currency_id: 'ARS'
    }],
    payer: { email: "test_user@example.com" },
    back_urls: {
      success: "https://brunomtch.com/success",
      failure: "https://brunomtch.com/failure",
      pending: "https://brunomtch.com/pending"
    },
    auto_return: "approved",
    notification_url: "https://brunogmedicina-back-production.up.railway.app/api/mercadopago/webhook"
  }
});

    console.log('✅ Resultado de preferencia:', result);
    res.status(200).json({ init_point: result.init_point });

  } catch (error) {
    console.error('❌ Error al crear preferencia:', error.message || error);
    res.status(500).json({ error: 'Error al generar preferencia' });
  }
});


export default router;
