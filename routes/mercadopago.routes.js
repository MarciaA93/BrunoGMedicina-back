import express from 'express';
import fetch from 'node-fetch'; // Si usás Node <18
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

router.post('/webhook', express.json(), async (req, res) => {
  console.log("📩 Webhook recibido:", JSON.stringify(req.body, null, 2));
  const paymentId = req.body.data?.id;
  const topic = req.query.topic || req.body.type;

  if (topic !== 'payment' || !paymentId) {
     console.log("🔍 topic:", topic, "paymentId:", req.body.data?.id);
    console.log(`Webhook recibido con topic=${topic} y paymentId=${paymentId}, ignorando.`);
    return res.sendStatus(200); // ignorar otros eventos
  }

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
    });

    if (!response.ok) {
      console.error(`Error al consultar pago ${paymentId}: ${response.status} ${response.statusText}`);
      return res.sendStatus(500);
    }

    const payment = await response.json();

    console.log("🧾 Pago recibido en Webhook:", JSON.stringify(payment, null, 2));
    console.log("📦 Metadata recibida:", payment.metadata);

    if (payment.status !== 'approved') {
      console.log('🕒 Pago no aprobado aún:', payment.status);
      return res.sendStatus(200);
    }

    const metadata = payment.metadata;

    if (!metadata?.date || !metadata?.time || !metadata?.email || !metadata?.nombre || !metadata?.tipo) {
      console.error('⚠️ Faltan datos en metadata del pago:', metadata);
      return res.status(400).json({ error: 'Datos incompletos en metadata' });
    }

    // Reservar turno
    console.log('🔄 Reservando turno:', metadata.date, metadata.time);
    const reservaResponse = await fetch(`${process.env.BACKEND_URL}/api/turnos/${metadata.date}/${metadata.time}`, {
      method: 'PUT',
    });
    console.log('✅ Reserva response status:', reservaResponse.status);

    if (!reservaResponse.ok) {
      console.error(`Error reservando turno ${metadata.date} ${metadata.time}:`, reservaResponse.statusText);
      return res.sendStatus(500);
    }

    // Guardar turno confirmado
    console.log('💾 Guardando turno confirmado...');
    const guardadoResponse = await fetch(`${process.env.BACKEND_URL}/api/turnos-confirmados`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: metadata.nombre,
        email: metadata.email,
        tipo: metadata.tipo,
        date: metadata.date,
        time: metadata.time,
      })
      
    }
  );
  console.log('🕵️ Revisando respuesta del guardado...');
const texto = await guardadoResponse.text();
console.log('📨 Respuesta completa del servidor turnos-confirmados:', texto);
    

    if (!guardadoResponse.ok) {
      console.error(`Error guardando turno confirmado:`, guardadoResponse.statusText);
      return res.sendStatus(500);
    }

    console.log('✅ Turno confirmado automáticamente');
    res.status(200).json({ message: 'Turno confirmado' });

  } catch (error) {
    console.error('❌ Error en webhook:', error);
    res.status(500).json({ error: 'Error procesando webhook' });
  }
});

export default router;
