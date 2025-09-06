import express from "express";
import fetch from "node-fetch";
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

// Inicializar Resend
const resend = new Resend(process.env.RESEND_API_KEY);

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

    const nombre = metadata.nombre;
    const email = metadata.email;
    const tipo = metadata.tipo;
    const nombre_curso = metadata.nombre_curso || null;
    const fecha = metadata.date || null;
    const hora = metadata.time || null;

    // --- 5) Flujo curso
    if (tipo === "curso") {
      console.log("📚 Confirmando curso:", nombre_curso);

      const guardadoResponse = await fetch(
        `https://brunogmedicina-back-production.up.railway.app/api/turnos-confirmados`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre,
            email,
            tipo,
            nombre_curso,
          }),
        }
      );

      const texto = await guardadoResponse.text();
      console.log("📨 Respuesta guardado curso:", texto);

      // Enviar emails
      await resend.emails.send({
        from: "Bruno G Medicina China <onboarding@resend.dev>",
        to: email,
        subject: "Confirmación de tu curso",
        html: `<p>Hola ${nombre},</p>
               <p>Tu inscripción al curso <strong>${nombre_curso}</strong> fue confirmada ✅</p>
               <p>Gracias por confiar en nosotros 🙌</p>
               <p>📱 WhatsApp de contacto:+5492617242768</p>
               <p>📍 Ubicación:Paraná 1132, GC, MDZ.</p>`,
               
      });

      await resend.emails.send({
        from: "Bruno G Medicina China <onboarding@resend.dev>",
        to: process.env.EMAIL_FROM,
        subject: "Nuevo curso confirmado",
        html: `<p>Nuevo curso confirmado:</p>
               <ul><li><strong>Nombre:</strong> ${nombre}</li>
                   <li><strong>Email:</strong> ${email}</li>
                   <li><strong>Curso:</strong> ${nombre_curso}</li></ul>`,
      });

      console.log("✅ Curso confirmado correctamente");
      return res.status(200).json({ message: "Curso confirmado" });
    }

    // --- 6) Flujo turno
    if (!fecha || !hora) {
      console.error("❌ Faltan fecha/hora en metadata para turno");
      return res.status(400).json({ error: "Faltan fecha u hora para turno" });
    }

    const fechaEncoded = encodeURIComponent(fecha);
    const horaEncoded = encodeURIComponent(hora);

    console.log("📅 Reservando turno:", fecha, hora);
    const reservaResponse = await fetch(
      `https://brunogmedicina-back-production.up.railway.app/api/turnos/${fechaEncoded}/${horaEncoded}`,
      { method: "PUT" }
    );

    if (!reservaResponse.ok) {
      console.error(
        `❌ Error reservando turno: ${reservaResponse.statusText}`
      );
      return res.sendStatus(500);
    }

    console.log("💾 Guardando turno confirmado...");
    const guardadoResponse = await fetch(
      `https://brunogmedicina-back-production.up.railway.app/api/turnos-confirmados`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          email,
          tipo,
          date: fecha,
          time: hora,
        }),
      }
    );

    const texto = await guardadoResponse.text();
    console.log("📨 Respuesta de guardado turno:", texto);

    // Enviar emails
    await resend.emails.send({
      from: "Bruno G Medicina China <onboarding@resend.dev>",
      to: email,
      subject: "Confirmación de tu turno",
      html: `<p>Hola ${nombre},</p>
             <p>Tu turno fue confirmado para el día <strong>${fecha}</strong> a las <strong>${hora}</strong>.</p>
             <p>Tipo de masaje: <strong>${tipo}</strong></p>
             <p>📱 WhatsApp de contacto:+5492617242768</p>
             <p>📍 Ubicación:Paraná 1132, GC, MDZ.</p>`,
    });

    await resend.emails.send({
      from: "Bruno G Medicina China <onboarding@resend.dev>",
      to: process.env.EMAIL_FROM,
      subject: "Nuevo turno confirmado",
      html: `<p>Nuevo turno confirmado:</p>
             <ul><li><strong>Nombre:</strong> ${nombre}</li>
                 <li><strong>Email:</strong> ${email}</li>
                 <li><strong>Tipo:</strong> ${tipo}</li>
                 <li><strong>Fecha:</strong> ${fecha}</li>
                 <li><strong>Hora:</strong> ${hora}</li></ul>
                 <p>📱 WhatsApp de contacto:+5492617242768</p>
             <p>📍 Ubicación:Paraná 1132, GC, MDZ.</p`,
    });

    console.log("✅ Turno confirmado correctamente");
    res.status(200).json({ message: "Turno confirmado" });
  } catch (error) {
    console.error("❌ Error general en webhook:", error);
    res.status(500).json({ error: "Error procesando webhook" });
  }
});

export default router;
