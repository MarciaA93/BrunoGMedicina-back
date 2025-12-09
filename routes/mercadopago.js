import express from 'express';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import dotenv from 'dotenv';
import { handleWebhook } from './webhook.routes.js';
import Turno from '../models/Turno.js';
import TurnoConfirmado from '../models/TurnoConfirmado.js';

dotenv.config();
const router = express.Router();

// Inicialización de MP
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});
const preference = new Preference(client);

// -------------------------
// RUTA TURNOS
// -------------------------
router.post('/create_preference', async (req, res) => {
  const requestId = `${req.body.email}-${req.body.date}-${req.body.time}`;
  console.log(`🆔 Nueva petición /create_preference (${requestId})`);
  console.log("📥 Datos recibidos en body (Turno):", req.body);

  const { title, unit_price, quantity, nombre, email, date, time } = req.body;

  if (!title || !unit_price || !quantity || !nombre || !email || !date || !time) {
    console.error("❌ Faltan datos obligatorios para el turno");
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  try {
    // ----------------------------
    // 🔒 VALIDACIÓN CLAVE #1:
    // el turno debe estar disponible antes de crear preferencia
    // ----------------------------
    const turno = await Turno.findOne({ date });
    if (!turno) {
      return res.status(400).json({ error: 'La fecha seleccionada no existe.' });
    }

    const slot = turno.timeSlots.find(s => s.time === time);
    if (!slot || !slot.available) {
      return res.status(400).json({ error: 'Ese horario ya fue reservado.' });
    }

    // ----------------------------
    // 🔒 VALIDACIÓN CLAVE #2:
    // que NO exista TurnoConfirmado (ya pagado)
    // ----------------------------
    const confirmado = await TurnoConfirmado.findOne({ date, time });
    if (confirmado) {
      return res.status(400).json({ error: 'Ese turno ya fue confirmado previamente.' });
    }
    
    // Crear preferencia
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
        notification_url: process.env.MP_NOTIFICATION_URL,
        metadata: {
          nombre: String(nombre),
          email: String(email),
          tipo: String(title),
          date: String(date),
          time: String(time)
        }
      }
    });

    const initPoint = result.init_point || result.response?.init_point;
    if (!initPoint) {
      console.error("⚠️ No se encontró init_point");
      return res.status(500).json({ error: 'No se pudo obtener el link de pago.' });
    }

    console.log("✅ Preferencia creada:", initPoint);
    res.status(200).json({ init_point: initPoint });

  } catch (error) {
    console.error("❌ Error al crear preferencia:", error.message || error);
    res.status(500).json({ error: 'Error al generar preferencia' });
  }
});

// -------------------------
// RUTA CURSOS
// -------------------------
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
        notification_url: process.env.MP_NOTIFICATION_URL,
        metadata: {
          producto: 'curso',
          nombre: String(nombre),
          email: String(email),
          tipo: String(title)
        }
      }
    });

    const initPoint = result.init_point || result.response?.init_point;

    if (!initPoint) {
      console.error("⚠️ No se encontró init_point", result);
      return res.status(500).json({ error: 'No se pudo obtener el link de pago' });
    }

    console.log("✅ Preferencia de curso creada:", initPoint);
    res.status(200).json({ init_point: initPoint });

  } catch (error) {
    console.error("❌ Error al crear preferencia de CURSO:", error);
    res.status(500).json({ error: 'Error al generar preferencia para el curso' });
  }
});

// -------------------------
// WEBHOOK
// -------------------------
router.post("/webhook", handleWebhook);

export default router;
