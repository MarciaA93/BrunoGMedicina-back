// routes/webhook.js (con LOGS detallados)

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

// ---------------------------
// Función para enviar correos
// ---------------------------
async function enviarEmail(opciones, contexto = 'General') {
  try {
    console.log(`📤 Intentando enviar email (${contexto}) → ${opciones.to}`);
    await resend.emails.send(opciones);
    console.log(`✅ Email enviado con éxito (${contexto}) → ${opciones.to}`);
  } catch (error) {
    console.error(`❌ Error al enviar email (${contexto}) → ${opciones.to}:`, error.message);
  }
}

// ---------------------------
// Lógica de Turno
// ---------------------------
async function procesarTurno(metadata, paymentId) {
  console.log(`🔹 Entrando a procesarTurno para ${metadata.nombre} (${metadata.email})`);
  console.log('🧩 Metadata recibida:', metadata);

  const existente = await TurnoConfirmado.findOne({ paymentId });
  if (existente) {
    console.log(`⚠️ Turno ya procesado para paymentId=${paymentId}, ignorando.`);
    return;
  }

  console.log('🔍 Buscando y bloqueando turno...');
  const resultadoUpdate = await Turno.findOneAndUpdate(
    { date: metadata.date, "timeSlots.time": metadata.time },
    { $set: { "timeSlots.$.available": false } },
    { new: true }
  );

  if (!resultadoUpdate) {
    console.error(`❌ No se encontró turno para ${metadata.date} ${metadata.time}`);
  } else {
    console.log(`✅ Turno bloqueado correctamente en DB → ${metadata.date} ${metadata.time}`);
  }

  // Guardar turno confirmado
  console.log('💾 Guardando TurnoConfirmado...');
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
  console.log('✅ TurnoConfirmado guardado en la base de datos.');

  // Envío de mails
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
    html: `<p>Se confirmó un turno para ${metadata.nombre} (${metadata.email}).</p>
           <p>📅 ${metadata.date} - 🕒 ${metadata.time}</p>`
  }, 'Turno - Cliente');

  console.log(`✅ Proceso completo de turno finalizado para ${metadata.email}`);
}

// ---------------------------
// Lógica de Curso (sin cambios)
// ---------------------------
async function procesarCurso(metadata, payment) {
  const paymentId = payment.id;
  const nombreCurso = metadata.tipo || metadata.producto;

  console.log(`🔹 Entrando a procesarCurso: ${nombreCurso}`);
  const existente = await Compra.findOne({ paymentId });
  if (existente) {
    console.log(`⚠️ Curso ya procesado para paymentId=${paymentId}, ignorando.`);
    return;
  }

  const nuevaCompra = new Compra({
    nombre: metadata.nombre,
    email: metadata.email,
    producto: nombreCurso,
    precio: payment.transaction_amount,
    estado: payment.status_detail,
    fechaCompra: new Date(),
    paymentId: paymentId
  });
  await nuevaCompra.save();
  console.log(`✅ Compra guardada para ${metadata.email}`);

  await enviarEmail({
    from: 'Bruno G. Medicina China <confirmacion@brunomtch.com>',
    to: metadata.email,
    subject: `✅ Confirmación de tu inscripción: ${nombreCurso}`,
    html: `
      <p>Hola ${metadata.nombre}, tu inscripción al curso <strong>${nombreCurso}</strong> fue confirmada.</p>
    `
  }, 'Curso - Alumno');

  await enviarEmail({
    from: 'Notificación de Curso <notificaciones@brunomtch.com>',
    to: EMAIL_BRUNO,
    subject: `💰 Nueva Venta de Curso: ${nombreCurso}`,
    html: `<p>${metadata.nombre} (${metadata.email}) compró ${nombreCurso}.</p>`
  }, 'Curso - Cliente');
}

// ---------------------------
// Webhook principal
// ---------------------------
router.post('/webhook', express.json(), async (req, res) => {
  try {
    console.log('📩 Webhook recibido:', JSON.stringify(req.body, null, 2));

    const paymentId = req.body.data?.id || req.query.id;
    const topic = req.body.type || req.query.topic;
    console.log(`🔎 Topic: ${topic} | PaymentID: ${paymentId}`);

    if (topic !== 'payment' || !paymentId) {
      console.log(`⚠️ Webhook ignorado (topic: ${topic}, paymentId: ${paymentId})`);
      return res.sendStatus(200);
    }

    console.log(`🔗 Consultando pago ${paymentId} en Mercado Pago...`);
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error al obtener pago ${paymentId}:`, errorText);
      return res.sendStatus(200);
    }

    const payment = await response.json();
    console.log('💳 Pago obtenido de MP:', {
      status: payment.status,
      detail: payment.status_detail,
      email: payment.payer?.email,
      amount: payment.transaction_amount
    });

    if (payment.status !== 'approved' || payment.status_detail !== 'accredited') {
      console.log(`⚠️ Pago ${paymentId} aún no acreditado. Estado: ${payment.status_detail}`);
      return res.sendStatus(200);
    }

    const metadata = payment.metadata || {};
    console.log('🧩 Metadata detectada en pago:', metadata);

    if (metadata.date && metadata.time) {
      console.log('🩺 Detectado tipo: Turno');
      await procesarTurno(metadata, paymentId);
    } else if (metadata.producto || metadata.tipo) {
      console.log('🎓 Detectado tipo: Curso');
      await procesarCurso(metadata, payment);
    } else {
      console.log(`⚠️ Pago ${paymentId} aprobado, pero sin metadatos reconocidos.`);
    }

    console.log(`✅ Webhook finalizado correctamente para pago ${paymentId}`);
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Error general en webhook:', error);
    if (!res.headersSent) res.sendStatus(500);
  }
});

export default router;
