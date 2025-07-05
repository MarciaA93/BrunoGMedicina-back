// routes/mercadopago.js
import express from 'express';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import TurnoConfirmado from '../models/TurnoConfirmado.js'; // <- Asegurate de tener este modelo

dotenv.config();

const router = express.Router();

// Configurar cliente de Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// Crear preferencia de pago
router.post('/create_preference', async (req, res) => {
  const { title, unit_price, nombre, email } = req.body;
  const { date, time } = req.query;

  console.log('📦 Datos recibidos:', req.body, '📅 Fecha:', date, '⏰ Hora:', time);

  try {
    const preference = new Preference(client);
    
    console.log('📄 Preferencia a enviar:', {
  title,
  unit_price,
  nombre,
  email,
  date,
  time
});

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
        notification_url: `${process.env.BACKEND_URL}/api/mercadopago/webhook?date=${date}&time=${time}&nombre=${nombre}&email=${email}&producto=${title}`,
        auto_return: 'approved'
      }
    });

    res.json({ init_point: result.init_point });
  } catch (err) {
    console.error('❌ Error al crear preferencia:', err);
    res.status(500).json({ error: 'No se pudo crear la preferencia de pago' });
  }
});

// Webhook
router.post('/webhook', express.json(), async (req, res) => {
  console.log('📥 Webhook recibido');
  console.log('Query:', req.query);
  console.log('Body:', req.body);

  const topic = req.query.topic || req.body.type;
  const { date, time, nombre, email, producto } = req.query;

  if (!date || !time || !nombre || !email || !producto) {
    console.error('Faltan parámetros en webhook');
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  if (topic === 'payment' || topic === 'merchant_order') {
    try {
      // Reservar el turno
      const response = await fetch(`${process.env.BACKEND_URL}/api/turnos/${date}/${time}`, {
        method: 'PUT'
      });

      if (!response.ok) {
        throw new Error(`Error al reservar turno: ${response.statusText}`);
      }

      // Guardar la compra en BD
      const nuevaCompra = new TurnoConfirmado({
        nombre,
        email,
        producto,
        fechaCompra: new Date(),
        metodo: 'Mercado Pago',
        fecha: date,
        hora: time
      });

      await nuevaCompra.save();

      res.status(200).json({ message: 'Webhook procesado y turno confirmado' });
    } catch (err) {
      console.error('❌ Error al procesar webhook:', err);
      res.status(500).json({ error: err.message });
    }
  } else {
    res.sendStatus(400);
  }
});

export default router;
