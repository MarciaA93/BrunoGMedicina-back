// routes/webhook.js (REVISADO Y OPTIMIZADO)

import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import Turno from '../models/Turno.js'; // Asumo que estos modelos existen
import TurnoConfirmado from '../models/TurnoConfirmado.js'; // Asumo que estos modelos existen
import Compra from '../models/Compra.js'; // Modelo para guardar la compra del curso
import { Resend } from 'resend';

dotenv.config();
const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// El Access Token de Mercado Pago DEBE estar en tus variables de entorno de Railway
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
// Dirección de email de Bruno para notificaciones
const EMAIL_BRUNO = process.env.EMAIL_FROM;

// ------------------------------------------
// Lógica Auxiliar (envío de Email)
// ------------------------------------------

async function enviarEmail(opciones, contexto = 'General') {
  try {
    await resend.emails.send(opciones);
    console.log(`✅ Email enviado con éxito (${contexto}) → ${opciones.to}`);
  } catch (error) {
    console.error(`❌ Error al enviar email (${contexto}) → ${opciones.to}:`, error.message);
  }
}

// ------------------------------------------
// Lógica de Procesamiento Específica
// ------------------------------------------

// Lógica de turno (Se mantiene tu código original, aunque está fuera del foco actual)
async function procesarTurno(metadata, paymentId) {
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
    to: EMAIL_BRUNO,
    subject: `Nuevo Turno Confirmado: ${metadata.tipo}`,
    html: `<p>Se confirmó un turno para ${metadata.nombre} (${metadata.email}).</p>
          <p>📱 WhatsApp: +5492617242768</p>
          <p>📍 Ubicación: Paraná 1132, Godoy Cruz, Mendoza.</p>`
  }, 'Turno - Cliente');
}


// Lógica del Curso (Optimizado)
async function procesarCurso(metadata, payment) {
  const paymentId = payment.id;
  const nombreCurso = metadata.tipo || metadata.producto; // Asegura que tome el nombre del producto/tipo
  
  // 1. Control de idempotencia (Buena práctica)
  const existente = await Compra.findOne({ paymentId });
  if (existente) {
    console.log(`⚠️ Curso ya procesado para paymentId=${paymentId}, ignorando.`);
    return;
  }

  // 2. Guardar compra (Asegurar que se guarda la info completa)
  const nuevaCompra = new Compra({
    nombre: metadata.nombre,
    email: metadata.email,
    producto: nombreCurso, 
    precio: payment.transaction_amount, // Usa el monto real de la transacción
    estado: payment.status_detail, // Guarda el detalle del estado, ej: accredited
    fechaCompra: new Date(),
    paymentId: paymentId
  });
  await nuevaCompra.save();
  console.log(`✅ Compra de curso ${nombreCurso} guardada para ${metadata.email}.`);

  // 3. Email al alumno (Entrega del producto)
  await enviarEmail({
    from: 'Bruno G. Medicina China <confirmacion@brunomtch.com>',
    to: metadata.email,
    subject: `✅ Confirmación de tu inscripción: ${nombreCurso}`,
    html: `
      <p>Hola ${metadata.nombre},</p>
      <p>¡Tu inscripción al curso "<strong>${nombreCurso}</strong>" ha sido confirmada con éxito!</p>
      <p>Recibirás el acceso a los materiales y más información relevante en un email separado en las próximas horas.</p>
      <p>¡Muchas gracias por tu compra!</p>
      <br>
      <p>Si tienes alguna duda, responde a este correo brunomedicinachina@gmail.com</p>
    `
  }, 'Curso - Alumno');

  // 4. Email al dueño (Notificación de venta)
  await enviarEmail({
    from: 'Notificación de Curso <notificaciones@brunomtch.com>',
    to: EMAIL_BRUNO,
    subject: `💰 Nueva Venta de Curso: ${nombreCurso}`,
    html: `<p>¡Felicidades! ${metadata.nombre} (${metadata.email}) se ha inscrito al curso "${nombreCurso}" por $${payment.transaction_amount}.</p>`
  }, 'Curso - Cliente');
}

// ------------------------------------------
// Ruta Principal (Webhook)
// ------------------------------------------

router.post('/webhook', express.json(), async (req, res) => {
  try {
    console.log('📩 Webhook recibido:', req.body);
    
    // Mercado Pago puede enviar ID de pago en body.data.id o query.id
    const paymentId = req.body.data?.id || req.query.id;
    const topic = req.body.type || req.query.topic;

    // 1. Filtrar solo notificaciones de 'payment' (Buena práctica)
    if (topic !== 'payment' || !paymentId) {
      console.log(`Webhook de tipo '${topic}' ignorado. ID: ${paymentId || 'N/A'}`);
      return res.sendStatus(200);
    }

    // 2. Consultar pago en MP
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });

    if (!response.ok) {
  const errorText = await response.text();
  console.error(`❌ Error al obtener pago ${paymentId} de MP:`, errorText);
  return res.sendStatus(200);
}


    const payment = await response.json();
    
    // 3. Verificar estado de aprobación
    if (payment.status !== 'approved' || payment.status_detail !== 'accredited') {
  console.log(`⚠️ Pago ${paymentId} aún no acreditado (detalle: ${payment.status_detail}).`);
  return res.sendStatus(200);
}

    // 4. Determinar tipo de producto/servicio
    const metadata = payment.metadata || {};

    if (metadata.date && metadata.time) {
      // Lógica para Turnos (mantiene tu lógica de procesarTurno)
      await procesarTurno(metadata, paymentId);
    } else if (metadata.producto || metadata.tipo) {
      // Lógica para Cursos/Productos (utiliza la lógica procesarCurso optimizada)
      await procesarCurso(metadata, payment);
    } else {
      console.log(`⚠️ Pago ${paymentId} aprobado, pero sin metadatos reconocidos.`, metadata);
    }

    // 5. Respuesta final a Mercado Pago
    res.sendStatus(200);

  } catch (error) {
    console.error('❌ Error general en webhook:', error);
    // Si ocurre un error interno, devolvemos 500 para que MP reintente la notificación
    if (!res.headersSent) res.sendStatus(500); 
  }
});

export default router;