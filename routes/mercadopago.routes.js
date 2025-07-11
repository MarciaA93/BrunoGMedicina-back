import express from 'express';
import fetch from 'node-fetch'; // Si usás Node <18
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

router.post('/webhook', express.json(), async (req, res) => {
  const paymentId = req.body.data?.id;
  const topic = req.query.topic || req.body.type;

  if (topic !== 'payment' || !paymentId) return res.sendStatus(200); // ignorar otros eventos

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
    });

    const payment = await response.json();
    console.log("🧾 Pago recibido en Webhook:", JSON.stringify(payment, null, 2));
console.log("📦 Metadata recibida:", payment.metadata);

    if (payment.status !== 'approved') {
      console.log('🕒 Pago no aprobado aún:', payment.status);
      return res.sendStatus(200); // ignorar si aún no está aprobado
    }

    const metadata = payment.metadata;

    if (!metadata?.date || !metadata?.time || !metadata?.email || !metadata?.nombre || !metadata?.tipo) {
      console.error('⚠️ Faltan datos en metadata del pago');
      return res.status(400).json({ error: 'Datos incompletos en metadata' });
    }

    // 1. Reservar turno (marcarlo como no disponible)
    await fetch(`${process.env.BACKEND_URL}/api/turnos/${metadata.date}/${metadata.time}`, {
      method: 'PUT',
    });

    // 2. Guardar el turno confirmado
    await fetch(`${process.env.BACKEND_URL}/api/turnos-confirmados`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: metadata.nombre,
        email: metadata.email,
        tipo: metadata.tipo,
        date: metadata.date,
        time: metadata.time,
      }),
    });

    console.log('✅ Turno confirmado automáticamente');
    res.status(200).json({ message: 'Turno confirmado' });

  } catch (error) {
    console.error('❌ Error en webhook:', error);
    res.status(500).json({ error: 'Error procesando webhook' });
  }
});

export default router;
