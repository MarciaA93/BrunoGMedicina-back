import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

router.post("/webhook", express.json(), async (req, res) => {
  console.log("📩 Webhook recibido:");
  console.log(JSON.stringify(req.body, null, 2));

  const topic = req.query.topic || req.body.type;
  let paymentId = req.body.data?.id || req.body.data?.payment_id || req.body.id;

  console.log(`🔍 Topic: ${topic}`);
  console.log(`🧾 paymentId detectado: ${paymentId}`);

  // --- 1) Caso merchant_order → buscar el paymentId
  if (topic === "merchant_order" && !paymentId) {
    const resourceUrl = req.body.resource;
    const orderId = resourceUrl?.split("/").pop();

    if (!orderId) {
      console.error("❌ No se pudo extraer el ID de orden");
      return res.sendStatus(200);
    }

    try {
      const orderResponse = await fetch(
        `https://api.mercadopago.com/merchant_orders/${orderId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          },
        }
      );

      const order = await orderResponse.json();
      const pagos = order.payments || [];
      const aprobado = pagos.find((p) => p.status === "approved");

      if (!aprobado) {
        console.log("⏳ No hay pagos aprobados aún en la orden.");
        return res.sendStatus(200);
      }

      paymentId = aprobado.id;
      console.log(`✅ paymentId obtenido desde merchant_order: ${paymentId}`);
    } catch (error) {
      console.error("❌ Error al consultar merchant_order:", error);
      return res.sendStatus(500);
    }
  }

  // --- 2) Validar topic y paymentId
  if (topic !== "payment" && topic !== "merchant_order") {
    console.log(`📭 Topic no relevante (${topic}), ignorando.`);
    return res.sendStatus(200);
  }

  if (!paymentId) {
    console.log("⚠️ No se pudo determinar el paymentId, ignorando.");
    return res.sendStatus(200);
  }

  try {
    // --- 3) Consultar el pago
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      console.error(
        `❌ Error al consultar pago ${paymentId}: ${response.status} ${response.statusText}`
      );
      return res.sendStatus(500);
    }

    const payment = await response.json();
    console.log("🧾 Pago recibido:", JSON.stringify(payment, null, 2));
    const metadata = payment.metadata;

    if (payment.status !== "approved") {
      console.log("🕒 Pago aún no aprobado:", payment.status);
      return res.sendStatus(200);
    }

    // --- 4) Validar metadata básica
    if (!metadata?.email || !metadata?.nombre || !metadata?.tipo) {
      console.error("⚠️ Faltan datos obligatorios en metadata:", metadata);
      return res.status(400).json({ error: "Datos incompletos en metadata" });
    }

    const payload = {
      nombre: metadata.nombre,
      email: metadata.email,
      tipo: metadata.tipo,
      nombre_curso: metadata.nombre_curso || null,
      date: metadata.date || null,
      time: metadata.time || null,
    };

    console.log("💾 Guardando confirmación en /turnos-confirmados...");
    const guardadoResponse = await fetch(
      `https://brunogmedicina-back-production.up.railway.app/api/turnos-confirmados`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const texto = await guardadoResponse.text();
    console.log("📨 Respuesta de /turnos-confirmados:", texto);

    res.status(200).json({ message: "Confirmación procesada" });
  } catch (error) {
    console.error("❌ Error general en webhook:", error);
    res.status(500).json({ error: "Error procesando webhook" });
  }
});

export default router;
