import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

router.post("/webhook", express.json(), async (req, res) => {
  console.log("📩 Webhook recibido:", JSON.stringify(req.body, null, 2));

  const topic = req.query.topic || req.body.type;
  let paymentId = req.body.data?.id || req.body.data?.payment_id || req.body.id;

  try {
    // --- Caso merchant_order
    if (topic === "merchant_order" && !paymentId) {
      const resourceUrl = req.body.resource;
      const orderId = resourceUrl?.split("/").pop();
      if (!orderId) return res.sendStatus(200);

      const orderResponse = await fetch(`https://api.mercadopago.com/merchant_orders/${orderId}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      });
      const order = await orderResponse.json();
      const aprobado = order.payments?.find(p => p.status === "approved");
      if (!aprobado) return res.sendStatus(200);
      paymentId = aprobado.id;
    }

    if (!["payment", "merchant_order"].includes(topic)) return res.sendStatus(200);
    if (!paymentId) return res.sendStatus(200);

    // --- Consultar pago
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    if (!response.ok) return res.sendStatus(500);

    const payment = await response.json();
    if (payment.status !== "approved") return res.sendStatus(200);

    const metadata = payment.metadata;
    if (!metadata?.email || !metadata?.nombre || !metadata?.tipo) {
      console.error("⚠️ Metadata incompleta:", metadata);
      return res.status(400).json({ error: "Metadata incompleta" });
    }

    // --- Guardar en backend
    const payload = {
      nombre: metadata.nombre,
      email: metadata.email,
      tipo: metadata.tipo,
      nombre_curso: metadata.nombre_curso || null,
      date: metadata.date || null,
      time: metadata.time || null,
    };

    const guardadoResponse = await fetch(
      `${process.env.API_BASE_URL}/api/turnos-confirmados`,
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
    console.error("❌ Error en webhook:", error);
    res.status(500).json({ error: "Error procesando webhook" });
  }
});

export default router;