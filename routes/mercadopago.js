// routes/mercadopago.js
import express from 'express';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import dotenv from 'dotenv';
import webhookHandler from './webhook.routes.js'; // Importamos tu webhook existente

dotenv.config();
const router = express.Router();

// Inicialización del cliente de Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

const preference = new Preference(client);

// -------------------
// RUTA PARA TURNOS
// -------------------
router.post('/create_preference', async (req, res) => {
  console.log("📥 Datos recibidos en body (Turno):", req.body);

  const { title, unit_price, quantity, nombre, email, date, time } = req.body;

  if (!title || !unit_price || !quantity || !nombre || !email || !date || !time) {
    console.error("❌ Faltan datos obligatorios para el turno");
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  try {
    const result = await preference.create({
      body: {
        items: [{
          title: String(title),
          unit_price: Number(unit_price),
          quantity: Number(quantity),
          currency_id: 'ARS'
        }],
        payer: { email: String(email) },
        back_urls: {
          success: `${process.env.FRONTEND_URL}/success`,
          failure: `${process.env.FRONTEND_URL}/failure`,
          pending: `${process.env.FRONTEND_URL}/pending`
        },
        auto_return: "approved",
        notification_url: process.env.MP_NOTIFICATION_URL || 'https://brunogmedicina-back-production.up.railway.app/api/webhook',
        metadata: {
          nombre: String(nombre),
          email: String(email),
          tipo: String(title),
          date: String(date),
          time: String(time)
        }
      }
    });

    console.log('✅ Preferencia de Turno creada:', result);
    res.status(200).json({ init_point: result.init_point });

  } catch (error) {
    console.error('❌ Error al crear preferencia de Turno:', error.message || error);
    res.status(500).json({ error: 'Error al generar preferencia' });
  }
});

// -------------------
// RUTA PARA CURSOS
// -------------------
router.post('/create_course_preference', async (req, res) => {
  console.log("📥 Datos recibidos para CURSO:", req.body);

  const { title, unit_price, quantity, nombre, email } = req.body;

  if (!title || !unit_price || !quantity || !nombre || !email) {
    console.error("❌ Faltan datos para la preferencia del curso");
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  try {
    const result = await preference.create({
      body: {
        items: [{
          title: String(title),
          unit_price: Number(unit_price),
          quantity: Number(quantity),
          currency_id: 'ARS'
        }],
        payer: { email: String(email) },
        back_urls: {
          success: `${process.env.FRONTEND_URL}/success`,
          failure: `${process.env.FRONTEND_URL}/failure`,
          pending: `${process.env.FRONTEND_URL}/pending`
        },
        auto_return: "approved",
        notification_url: process.env.MP_NOTIFICATION_URL || 'https://brunogmedicina-back-production.up.railway.app/api/webhook',
        metadata: {
          producto: 'curso',
          nombre: String(nombre),
          email: String(email),
          tipo: String(title)
        }
      }
    });

    console.log('✅ Preferencia de CURSO creada:', result);
    res.status(200).json({ init_point: result.init_point });

  } catch (error) {
    console.error('❌ Error al crear preferencia de CURSO:', error.message || error);
    res.status(500).json({ error: 'Error al generar preferencia para el curso' });
  }
});

// -------------------
// WEBHOOK DE MERCADO PAGO
// -------------------
router.post("/webhook", webhookHandler);

export default router;
