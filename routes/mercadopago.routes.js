import express from 'express';
import fetch from 'node-fetch'; // Si usás Node <18
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

router.post('/webhook', express.json(), async (req, res) => {
  const paymentId = req.body.data?.id;
  const topic = req.query.topic || req.body.type;

  if (topic !== 'payment' || !paymentId) return res.sendStatus(200);

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
    });

    const payment = await response.json();
    const metadata = payment.metadata;

    if (!metadata?.date || !metadata?.time) {
      console.error('Faltan datos en metadata');
      return res.status(400).json({ error: 'Datos incompletos en metadata' });
    }

    // Reservar turno
    await fetch(`${process.env.BACKEND_URL}/api/turnos/${metadata.date}/${metadata.time}`, {
      method: 'PUT'
    });

    // Guardar turno confirmado
    await fetch(`${process.env.BACKEND_URL}/api/turnos-confirmados`, {
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

    res.status(200).json({ message: 'Turno confirmado' });
  } catch (err) {
    console.error('❌ Error en webhook:', err);
    res.status(500).json({ error: 'Fallo el procesamiento del webhook' });
  }
});
export default router;