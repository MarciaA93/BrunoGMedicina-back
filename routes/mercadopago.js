import express from 'express';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

const preference = new Preference(client);

// URL del webhook unificado
const NOTIFICATION_URL =
  'https://brunogmedicina-back-production.up.railway.app/api/webhook';

/* ==============================
   📌 CREAR PREFERENCIA PARA TURNOS
   ============================== */
router.post('/create_preference', async (req, res) => {
  console.log('📥 Datos recibidos en body:', req.body);
  const { title, unit_price, quantity, nombre, email, date, time } = req.body;

  if (!title || !unit_price || !quantity || !nombre || !email || !date || !time) {
    console.error('❌ Faltan datos obligatorios para turno');
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
            currency_id: 'ARS',
          },
        ],
        payer: { email: String(email) },
        back_urls: {
          success: 'https://brunomtch.com/success',
          failure: 'https://brunomtch.com/failure',
          pending: 'https://brunomtch.com/pending',
        },
        auto_return: 'approved',
        notification_url: NOTIFICATION_URL,
        metadata: {
          nombre: String(nombre),
          email: String(email),
          tipo: 'turno',
          date: String(date),
          time: String(time),
        },
      },
    });

    console.log('✅ Preferencia creada:', result);
    res.status(200).json({ init_point: result.init_point });
  } catch (error) {
    console.error('❌ Error al crear preferencia:', error.message || error);
    res.status(500).json({ error: 'Error al generar preferencia' });
  }
});

/* ==============================
   📌 CREAR PREFERENCIA PARA CURSOS
   ============================== */
router.post('/create_course_preference', async (req, res) => {
  console.log('📥 Datos recibidos para CURSO:', req.body);

  const { title, unit_price, quantity, nombre, email } = req.body;

  if (!title || !unit_price || !quantity || !nombre || !email) {
    console.error('❌ Faltan datos para la preferencia del curso');
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
            currency_id: 'ARS',
          },
        ],
        payer: { email: String(email) },
        back_urls: {
          success: 'https://brunomtch.com/success-curso',
          failure: 'https://brunomtch.com/failure-curso',
          pending: 'https://brunomtch.com/pending',
        },
        auto_return: 'approved',
        notification_url: NOTIFICATION_URL,
        metadata: {
          nombre: String(nombre),
          email: String(email),
          tipo: 'curso',
          nombre_curso: String(title),
        },
      },
    });

    console.log('✅ Preferencia de CURSO creada:', result);
    res.status(200).json({ init_point: result.init_point });
  } catch (error) {
    console.error('❌ Error al crear preferencia de CURSO:', error.message || error);
    res.status(500).json({ error: 'Error al generar preferencia para el curso' });
  }
});

/* =================================================================
   EL WEBHOOK, LOS TURNOS CONFIRMADOS Y CURSOS CONFIRMADOS 
   SE ELIMINAN DE ESTE ARCHIVO PORQUE YA ESTÁN CENTRALIZADOS
   EN routes/webhook.js
   ================================================================= */

export default router;