import express from 'express';
import fetch from 'node-fetch'; // Si usás Node <18
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

router.post('/webhook', express.json(), async (req, res) => {
  console.log('📥 Webhook recibido');
  console.log('Query:', req.query);
  console.log('Body:', req.body);

  const topic = req.query.topic || req.body.type;
  const paymentId = req.body.data?.id;

  if (!paymentId) {
    return res.status(400).json({ error: 'Falta el ID del pago' });
  }

  if (topic !== 'payment' && topic !== 'merchant_order') {
    return res.sendStatus(200); // Ignorar otros eventos
  }

  try {
    // 🔍 Obtener datos del pago
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
    });

    const mpData = await mpRes.json();
    const metadata = mpData.metadata;

    if (!metadata || !metadata.date || !metadata.time) {
      console.error('❌ Faltan datos en metadata');
      return res.status(400).json({ error: 'Faltan datos del turno en metadata' });
    }

    // ✅ Paso 1: Marcar el turno como reservado
    const turnoRes = await fetch(`${process.env.BACKEND_URL}/api/turnos/${metadata.date}/${metadata.time}`, {
      method: 'PUT'
    });

    if (!turnoRes.ok) {
      throw new Error(`❌ No se pudo reservar el turno: ${turnoRes.statusText}`);
    }

    // ✅ Paso 2: Guardar el turno confirmado
    const confirmarRes = await fetch(`${process.env.BACKEND_URL}/api/turnos-confirmados`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: metadata.nombre,
        email: metadata.email,
        tipo: metadata.tipo,
        date: metadata.date,
        time: metadata.time
      })
    });

    if (!confirmarRes.ok) {
      throw new Error(`❌ No se pudo guardar el turno confirmado`);
    }

    console.log('✅ Webhook procesado con éxito');
    res.status(200).json({ message: 'Turno reservado y confirmado' });

  } catch (error) {
    console.error('❌ Error al procesar el webhook:', error);
    res.status(500).json({ error: 'Error en el procesamiento del webhook' });
  }
});

export default router;