// routes/mercadopago.js
import express from 'express';
import { MercadoPagoConfig, Preference , recibirWebhook } from 'mercadopago';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

// 1. Inicialización del cliente de Mercado Pago (¡Correcto!)
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

const preference = new Preference(client);

// RUTA PARA TURNOS (con back_urls dinámicas)
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
        payer: {
          email: String(email),
        },
        // --- CAMBIO: Usamos una variable de entorno para las URLs de redirección ---
        back_urls: {
          success: `${process.env.FRONTEND_URL}/success`,
          failure: `${process.env.FRONTEND_URL}/failure`, // Asegúrate de tener esta página en tu frontend si la necesitas
          pending: `${process.env.FRONTEND_URL}/pending`  // Opcional
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

// ✅ ESTE es el endpoint que te falta
router.post("/webhook", recibirWebhook);

// RUTA PARA CURSOS (Corregida y con back_urls dinámicas)
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
        payer: {
          email: String(email),
        },
        // --- CAMBIO: Usamos la misma variable de entorno y la página /success existente ---
        back_urls: {
          success: `${process.env.FRONTEND_URL}/success`,
          failure: `${process.env.FRONTEND_URL}/failure`,
          pending: `${process.env.FRONTEND_URL}/pending`
        },
        auto_return: "approved",
        notification_url: process.env.MP_NOTIFICATION_URL || 'https://brunogmedicina-back-production.up.railway.app/api/webhook',


        // --- CAMBIO CLAVE: Ajustamos los metadatos para que coincidan con el webhook ---
        metadata: {
          producto: 'curso', // Esta es la clave que tu webhook busca para identificar un curso
          nombre: String(nombre),
          email: String(email),
          tipo: String(title) // Aquí va el nombre del curso, que el webhook guardará
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

export default router;
