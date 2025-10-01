// routes/webhook.js
import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import Turno from '../models/Turno.js';
import TurnoConfirmado from '../models/TurnoConfirmado.js';
import Compra from '../models/Compra.js';
import { Resend } from 'resend';

dotenv.config();
const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

async function enviarEmail(opciones, contexto = '') {
  try {
    await resend.emails.send(opciones);
    console.log(`✅ Email enviado con éxito (${contexto}) → ${opciones.to}`);
  } catch (error) {
    console.error(`❌ Error al enviar email (${contexto}) → ${opciones.to}:`, error.message);
  }
}

async function procesarTurno(metadata, paymentId) {
  // Control de idempotencia
  const existente = await TurnoConfirmado.findOne({ paymentId });
  if (existente) {
    console.log(`⚠️ Turno ya procesado para paymentId=${paymentId}, ignorando.`);
    return;
  }

  // Bloquear turno
  await Turno.findOneAndUpdate(
    { date: metadata.date, "timeSlots.time": metadata.time },
    { $set: { "timeSlots.$.available": false } }
  );

  // Guardar turno confirmado
  const nuevoConfirmado = new TurnoConfirmado({
    nombre: metadata.nombre,
    email: metadata.email,
    tipo: metadata.tipo,
    date: metadata.date,
    time: metadata.time,
    fechaCompra: new Date(),
    metodo: 'Mercado Pago',
    paymentId
  });
  await nuevoConfirmado.save();

  // Email al paciente
  await enviarEmail({
    from: 'Bruno G. Medicina China <confirmacion@brunomtch.com>',
    to: metadata.email,
    subject: 'Confirmación de tu turno',
    html: `
      <p>Hola ${metadata.nombre}, tu turno ha sido confirmado.</p>
      <p>Día: <strong>${metadata.date}</strong> - Hora: <strong>${metadata.time}</strong></p>
      <p>Tipo de masaje: <strong>${metadata.tipo}</strong></p>
      <p>📱 WhatsApp: +5492617242768</p>
      <p>📍 Ubicación: Paraná 1132, Godoy Cruz, Mendoza.</p>
    `
  }, 'Turno - Paciente');

  // Email al dueño
  await enviarEmail({
    from: 'Notificación de Turno <notificaciones@brunomtch.com>',
    to: process.env.EMAIL_FROM,
    subject: `Nuevo Turno Confirmado: ${metadata.tipo}`,
    html: `<p>Se confirmó un turno para ${metadata.nombre} (${metadata.email}).</p>`
  }, 'Turno - Cliente');
}

async function procesarCurso(metadata, payment) {
  // Control de idempotencia
  const existente = await Compra.findOne({ paymentId: payment.id });
  if (existente) {
    console.log(`⚠️ Curso ya procesado para paymentId=${payment.id}, ignorando.`);
    return;
  }

  // Guardar compra
  const nuevaCompra = new Compra({
    nombre: metadata.nombre,
    email: metadata.email,
    producto: metadata.tipo, // nombre del curso
    precio: payment.transaction_amount,
    fechaCompra: new Date(),
    paymentId: payment.id
  });
  await nuevaCompra.save();

  // Email al alumno
  await enviarEmail({
    from: 'Bruno G. Medicina China <confirmacion@brunomtch.com>',
    to: metadata.email,
    subject: 'Confirmación de tu inscripción al curso',
    html: `
      <p>Hola ${metadata.nombre}, tu inscripción al curso "<strong>${metadata.tipo}</strong>" ha sido confirmada.</p>
      <p>Recibirás más información a la brevedad.</p>
      <p>¡Muchas gracias por tu compra!</p>
    `
  }, 'Curso - Alumno');

  // Email al dueño
  await enviarEmail({
    from: 'Notificación de Curso <notificaciones@brunomtch.com>',
    to: process.env.EMAIL_FROM,
    subject: `Nueva Venta de Curso: ${metadata.tipo}`,
    html: `<p>${metadata.nombre} (${metadata.email}) se ha inscrito al curso "${metadata.tipo}".</p>`
  }, 'Curso - Cliente');
}

router.post('/webhook', express.json(), async (req, res) => {
  try {
    console.log('📩 Webhook recibido:', req.body);

    const topic = req.body.type || req.query.topic;
    if (topic !== 'payment') {
      console.log(`Webhook de tipo '${topic}' ignorado.`);
      return res.sendStatus(200);
    }

    const paymentId = req.body.data?.id;
    if (!paymentId) {
      console.log('⚠️ Webhook sin paymentId, ignorando.');
      return res.sendStatus(200);
    }

    // Consultar pago en MP
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });

    if (!response.ok) {
      console.error('❌ Error al obtener pago de MP:', await response.text());
      return res.sendStatus(500);
    }

    const payment = await response.json();
    if (payment.status !== 'approved') {
      console.log(`⚠️ Pago ${paymentId} no aprobado (estado: ${payment.status}).`);
      return res.sendStatus(200);
    }

    const metadata = payment.metadata || {};
    if (metadata.date && metadata.time) {
      await procesarTurno(metadata, paymentId);
    } else if (metadata.producto) {
      await procesarCurso(metadata, payment);
    } else {
      console.log('⚠️ Pago aprobado sin metadatos reconocidos.', metadata);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Error general en webhook:', error);
    if (!res.headersSent) res.sendStatus(500);
  }
});

export default router;
