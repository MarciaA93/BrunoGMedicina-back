import express from 'express';
import fetch from 'node-fetch'; // Para Node <18
import dotenv from 'dotenv';
import Turno from '../models/Turno.js';
import TurnoConfirmado from '../models/TurnoConfirmado.js';
import nodemailer from 'nodemailer';

dotenv.config();
const router = express.Router();

router.post('/webhook', express.json(), async (req, res) => {
  try {
    const topic = req.query.topic || req.body.type;
    let paymentId = req.body.data?.id || req.body.data?.payment_id || req.body.id;

    // 🔹 Manejo de merchant_order
    if (topic === 'merchant_order' && !paymentId) {
      const resourceUrl = req.body.resource;
      const orderId = resourceUrl?.split("/").pop();
      if (!orderId) return res.sendStatus(200);

      const orderResponse = await fetch(`https://api.mercadopago.com/merchant_orders/${orderId}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      });
      const order = await orderResponse.json();
      const aprobado = (order.payments || []).find(p => p.status === 'approved');
      if (!aprobado) return res.sendStatus(200);

      paymentId = aprobado.id;
    }

    // 🔹 Solo procesamos pagos aprobados
    if (!['payment', 'merchant_order'].includes(topic) || !paymentId) return res.sendStatus(200);

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    if (!response.ok) return res.sendStatus(500);

    const payment = await response.json();
    const metadata = payment.metadata;

    if (payment.status !== 'approved' || !metadata?.date || !metadata?.time || !metadata?.email || !metadata?.nombre || !metadata?.tipo) {
      return res.sendStatus(200);
    }

    // 🔹 Reservar horario directamente en Mongo
    const turno = await Turno.findOne({ date: metadata.date });
    if (turno) {
      const slot = turno.timeSlots.find(s => s.time === metadata.time);
      if (slot && slot.available) {
        slot.available = false;
        await turno.save();
      }
    }

    // 🔹 Guardar turno confirmado directamente en Mongo
    const nuevoConfirmado = new TurnoConfirmado({
      nombre: metadata.nombre,
      email: metadata.email,
      tipo: metadata.tipo,
      date: metadata.date,
      time: metadata.time,
      fechaCompra: new Date(),
      metodo: 'Mercado Pago',
    });
    await nuevoConfirmado.save();

    // 🔹 Enviar emails (opcional: se puede hacer en background con un queue)
   const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_FROM,
    pass: process.env.EMAIL_PASSWORD,
  },
   tls: { rejectUnauthorized: false } // a veces ayuda en cloud
    });

    await transporter.sendMail({
      from: `"Bruno G Medicina China" <${process.env.EMAIL_FROM}>`,
      to: metadata.email,
      subject: 'Confirmación de tu turno',
      html: `
        <p>Hola ${metadata.nombre},</p>
        <p>Tu turno fue confirmado para el día <strong>${metadata.date}</strong> a las <strong>${metadata.time}</strong>.</p>
        <p>Tipo de masaje: <strong>${metadata.tipo}</strong></p>
        <p>Gracias por confiar en nosotros 🙌</p>
        <p>📱 WhatsApp: +5492617242768</p>
        <p>📍 Ubicación: Paraná 1132, GC, MDZ</p>
      `,
    });

    await transporter.sendMail({
      from: `"Bruno G Medicina China" <${process.env.EMAIL_FROM}>`,
      to: process.env.EMAIL_FROM,
      subject: 'Nuevo turno confirmado',
      html: `
        <p>Nuevo turno confirmado:</p>
        <ul>
          <li><strong>Nombre:</strong> ${metadata.nombre}</li>
          <li><strong>Email:</strong> ${metadata.email}</li>
          <li><strong>Tipo:</strong> ${metadata.tipo}</li>
          <li><strong>Fecha:</strong> ${metadata.date}</li>
          <li><strong>Hora:</strong> ${metadata.time}</li>
        </ul>
      `,
    });

    return res.status(200).json({ message: 'Turno confirmado correctamente' });

  } catch (error) {
    console.error('❌ Error en webhook:', error);
    return res.sendStatus(500);
  }
});

export default router;
