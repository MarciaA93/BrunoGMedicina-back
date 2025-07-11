import express from 'express';
import fetch from 'node-fetch'; // Para Node <18
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

router.post('/webhook', express.json(), async (req, res) => {
  console.log("📩 Webhook recibido:");
  console.log(JSON.stringify(req.body, null, 2));

  const topic = req.query.topic || req.body.type;
  let paymentId = req.body.data?.id || req.body.data?.payment_id || req.body.id;

  console.log(`🔍 Topic: ${topic}`);
  console.log(`🧾 paymentId detectado: ${paymentId}`);

  // 🔸 Si topic = merchant_order, buscar el paymentId desde la orden
 if (topic === 'merchant_order' && !paymentId) {
  const resourceUrl = req.body.resource;
  const orderId = resourceUrl?.split("/").pop(); // ✅ EXTRAEMOS el ID

  console.log(`🛒 Es merchant_order, ID de orden extraído: ${orderId}`);

  if (!orderId) {
    console.error("❌ No se pudo extraer el ID de orden desde resource");
    return res.sendStatus(200);
  }

  try {
    const orderResponse = await fetch(`https://api.mercadopago.com/merchant_orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
    });

    const order = await orderResponse.json();
    const pagos = order.payments || [];
    const aprobado = pagos.find(p => p.status === 'approved');

    if (!aprobado) {
      console.log('⏳ No hay pagos aprobados aún en la orden.');
      return res.sendStatus(200);
    }

    paymentId = aprobado.id;
    console.log(`✅ paymentId obtenido desde merchant_order: ${paymentId}`);
  } catch (error) {
    console.error('❌ Error al consultar merchant_order:', error);
    return res.sendStatus(500);
  }
}

  // Si no hay paymentId o no es un topic válido, ignorar
  if (topic !== 'payment' && topic !== 'merchant_order') {
    console.log(`📭 Topic no relevante (${topic}), ignorando.`);
    return res.sendStatus(200);
  }

  if (!paymentId) {
    console.log('⚠️ No se pudo determinar el paymentId, ignorando.');
    return res.sendStatus(200);
  }

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
    });

    if (!response.ok) {
      console.error(`❌ Error al consultar pago ${paymentId}: ${response.status} ${response.statusText}`);
      return res.sendStatus(500);
    }

    const payment = await response.json();

    console.log("🧾 Pago recibido:", JSON.stringify(payment, null, 2));
    const metadata = payment.metadata;

    if (payment.status !== 'approved') {
      console.log('🕒 Pago aún no aprobado:', payment.status);
      return res.sendStatus(200);
    }

    // Validar metadata
    if (!metadata?.date || !metadata?.time || !metadata?.email || !metadata?.nombre || !metadata?.tipo) {
      console.error('⚠️ Faltan datos en metadata:', metadata);
      return res.status(400).json({ error: 'Datos incompletos en metadata' });
    }

    // 🔄 Reservar turno
    console.log('📅 Reservando turno:', metadata.date, metadata.time);
    const reservaResponse = await fetch(`https://brunogmedicina-back-production.up.railway.app/api/turnos/${metadata.date}/${metadata.time}`, {

      method: 'PUT',
    });

    if (!reservaResponse.ok) {
      console.error(`❌ Error reservando turno: ${reservaResponse.statusText}`);
      return res.sendStatus(500);
    }

    // 💾 Guardar turno confirmado
    console.log('💾 Guardando turno confirmado...');
    const guardadoResponse = await fetch(`https://brunogmedicina-back-production.up.railway.app/api/turnos-confirmados`, {

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

    const texto = await guardadoResponse.text();
    console.log('📨 Respuesta de guardado:', texto);

    if (!guardadoResponse.ok) {
      console.error('❌ Error guardando turno confirmado:', guardadoResponse.statusText);
      return res.sendStatus(500);
    }

    console.log('✅ Turno confirmado correctamente');
    res.status(200).json({ message: 'Turno confirmado' });

  } catch (error) {
    console.error('❌ Error general en webhook:', error);
    res.status(500).json({ error: 'Error procesando webhook' });
  }
});

export default router;
