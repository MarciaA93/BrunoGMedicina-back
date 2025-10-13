// routes/webhook.js (CON LOGS DETALLADOS)
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
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const EMAIL_BRUNO = process.env.EMAIL_FROM;

// ------------------------------------------
// Función auxiliar para enviar emails
// ------------------------------------------
async function enviarEmail(opciones, contexto = 'General') {
  try {
    console.log(`📧 Enviando email (${contexto}) → ${opciones.to}`);
    await resend.emails.send(opciones);
    console.log(`✅ Email enviado con éxito (${contexto}) → ${opciones.to}`);
  } catch (error) {
    console.error(`❌ Error al enviar email (${contexto}):`, error.message);
  }
}

// ------------------------------------------
// Procesar turno confirmado
// ------------------------------------------
async function procesarTurno(metadata, paymentId) {
  console.log(`⚙️ Procesando turno... PaymentID=${paymentId}`);
  console.log('🧠 Metadata recibida:', metadata);

  const existente = await TurnoConfirmado.findOne({ paymentId });
  if (existente) {
    console.log(`⚠️ Turno ya procesado para paymentId=${paymentId}`);
    return;
  }

  console.log(`🔒 Bloqueando turno ${metadata.date} ${metadata.time}`);
  const resultado = await Turno.findOneAndUpdate(
    { date: metadata.date, "timeSlots.time": metadata.time },
    { $set: { "timeSlots.$.available": false } }
  );

  if (!resultado) {
    console.log(`⚠️ No se encontró el turno en la base de datos.`);
  } else {
    console.log(`✅ Turno bloqueado correctamente.`);
  }

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
  console.log(`💾 Turno confirmado guardado correctamente en la BD.`);

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

  await enviarEmail({
    from: 'Notificación de Turno <notificaciones@brunomtch.com>',
    to: EMAIL_BRUNO,
    subject: `Nuevo Turno Confirmado: ${metadata.tipo}`,
    html: `<p>Se confirmó un turno para ${metadata.nombre} (${metadata.email}).</p>`
  }, 'Turno - Cliente');
}

// ------------------------------------------
// Procesar curso (compra)
// ------------------------------------------
async function procesarCurso(metadata, payment) {
  console.log(`⚙️ Procesando compra de curso... PaymentID=${payment.id}`);
  console.log('🧠 Metadata recibida:', metadata);

  const existente = await Compra.findOne({ paymentId: payment.id });
  if (existente) {
    console.log(`⚠️ Curso ya procesado para paymentId=${payment.id}`);
    return;
  }

  const nuevaCompra = new Compra({
    nombre: metadata.nombre,
    email: metadata.email,
    producto: metadata.tipo || metadata.producto,
    precio: payment.transaction_amount,
    estado: payment.status_detail,
    fechaCompra: new Date(),
    paymentId: payment.id
  });

  await nuevaCompra.save();
  console.log(`💾 Compra guardada correctamente en la BD.`);

  await enviarEmail({
    from: 'Bruno G. Medicina China <confirmacion@brunomtch.com>',
    to: metadata.email,
    subject: `✅ Confirmación de tu inscripción: ${metadata.tipo || metadata.producto}`,
    html: `<p>Hola ${metadata.nombre}, tu inscripción ha sido confirmada con éxito.</p>`
  }, 'Curso - Alumno');

  await enviarEmail({
    from: 'Notificación de Curso <notificaciones@brunomtch.com>',
    to: EMAIL_BRUNO,
    subject: `💰 Nueva Venta de Curso`,
    html: `<p>Venta confirmada: ${metadata.nombre} (${metadata.email})</p>`
  }, 'Curso - Cliente');
}

// ------------------------------------------
// WEBHOOK PRINCIPAL
// ------------------------------------------
router.post('/webhook', express.json(), async (req, res) => {
  try {
    console.log('📩 Webhook recibido →', JSON.stringify(req.body, null, 2));
    const paymentId = req.body.data?.id || req.query.id;
    const topic = req.body.type || req.query.topic;

    if (topic !== 'payment' || !paymentId) {
      console.log(`⚠️ Webhook ignorado: tipo=${topic}, id=${paymentId}`);
      return res.sendStatus(200);
    }

    console.log(`🔍 Consultando pago ${paymentId} en Mercado Pago...`);
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error al obtener pago:`, errorText);
      return res.sendStatus(200);
    }

    const payment = await response.json();
    console.log(`✅ Pago consultado: ${payment.status} (${payment.status_detail})`);

    if (payment.status !== 'approved' || payment.status_detail !== 'accredited') {
      console.log(`⚠️ Pago aún no acreditado (${payment.status_detail}).`);
      return res.sendStatus(200);
    }

    const metadata = payment.metadata || {};
    if (metadata.date && metadata.time) {
      await procesarTurno(metadata, paymentId);
    } else if (metadata.producto || metadata.tipo) {
      await procesarCurso(metadata, payment);
    } else {
      console.log('⚠️ Pago sin metadatos reconocidos:', metadata);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('💥 Error general en webhook:', error);
    if (!res.headersSent) res.sendStatus(500);
  }
});

export default router;
