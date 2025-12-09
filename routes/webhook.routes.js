// routes/webhook.js (VERSIÓN FINAL - con control de duplicados REAL)
import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import Turno from '../models/Turno.js';
import TurnoConfirmado from '../models/TurnoConfirmado.js';
import Compra from '../models/Compra.js';
import { Resend } from 'resend';

dotenv.config();
// Bloqueo temporal en memoria para evitar doble procesamiento simultáneo
const procesandoPagos = new Set();
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

  // 🔒 Evitar doble procesamiento simultáneo
  if (procesandoPagos.has(paymentId)) {
    console.log(`⏳ Pago ${paymentId} ya se está procesando (turno), ignorando duplicado.`);
    return;
  }
  procesandoPagos.add(paymentId);

  try {
    // ------------------------------------------
    // FIX 1 — Verificación estricta:
    // NO procesar si ya existe un turno confirmado para ese día/hora.
    // (evita reenviar mails por webhooks repetidos)
    // ------------------------------------------
    const turnoExistente = await TurnoConfirmado.findOne({
      date: metadata.date,
      time: metadata.time
    });

    if (turnoExistente) {
      console.log(`⚠️ Ya existe un turno confirmado en ${metadata.date} ${metadata.time}, ignorando reenvío.`);
      return;
    }

    // 🔹 Verificar duplicado por paymentId también
    const existePayment = await TurnoConfirmado.findOne({ paymentId });
    if (existePayment) {
      console.log(`⚠️ Turno ya procesado para paymentId=${paymentId}`);
      return;
    }

    // ------------------------------------------
    // FIX 2 — No bloquear si ya hay un TurnoConfirmado
    // (bloqueo extra de seguridad)
    // ------------------------------------------

    // 🔹 Bloqueo atómico: solo bloquea si estaba disponible
    const resultado = await Turno.findOneAndUpdate(
      { date: metadata.date, "timeSlots.time": metadata.time, "timeSlots.available": true },
      { $set: { "timeSlots.$.available": false } },
      { new: true }
    );

    if (!resultado) {
      console.log(`⚠️ Turno ya estaba bloqueado o no existe.`);
      return;
    } else {
      console.log(`✅ Turno bloqueado correctamente.`);
    }

    // ------------------------------------------
    // Guardar turno confirmado
    // FIX 3 — Esta escritura garantiza idempotencia real.
    // ------------------------------------------
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

    // 🔹 Enviar emails
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

    console.log(`✅ Proceso completado correctamente para paymentId=${paymentId}`);
  } catch (error) {
    console.error('💥 Error procesando turno:', error);
  } finally {
    // 🔓 Liberar bloqueo aunque haya error
    procesandoPagos.delete(paymentId);
  }
}

// ------------------------------------------
// Procesar curso (compra) — con control anti-doble
// ------------------------------------------
async function procesarCurso(metadata, payment) {
  try {
    const paymentId = payment.id;
    console.log(`⚙️ Procesando compra de curso... PaymentID=${paymentId}`);
    console.log('🧠 Metadata recibida:', metadata);

    // 🔒 Evitar doble procesamiento simultáneo
    if (procesandoPagos.has(paymentId)) {
      console.log(`⏳ Pago ${paymentId} ya se está procesando, ignorando duplicado.`);
      return;
    }
    procesandoPagos.add(paymentId);

    // 🔹 Evitar reprocesar si ya existe en BD
    const existente = await Compra.findOne({ paymentId });
    if (existente) {
      console.log(`⚠️ Curso ya procesado previamente para paymentId=${paymentId}`);
      return;
    }

    // 🔹 Guardar compra
    const nuevaCompra = new Compra({
      nombre: metadata.nombre,
      email: metadata.email,
      producto: metadata.tipo || metadata.producto,
      precio: payment.transaction_amount,
      estado: payment.status_detail,
      fechaCompra: new Date(),
      paymentId
    });

    await nuevaCompra.save();
    console.log(`💾 Compra guardada correctamente en la BD.`);

    // 🔹 Enviar emails
    await enviarEmail({
      from: 'Bruno G. Medicina China <confirmacion@brunomtch.com>',
      to: metadata.email,
      subject: `✅ Confirmación de tu inscripción: ${metadata.tipo || metadata.producto}`,
      html: `
      <div style="font-family: Arial, sans-serif; background-color: #f6f8fa; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <h2 style="color: #00796b; text-align: center;">¡Inscripción confirmada! 🎉</h2>

          <p style="font-size: 16px; color: #333;">
            Hola <strong>${metadata.nombre}</strong>,
          </p>

          <p style="font-size: 15px; color: #333; line-height: 1.5;">
            Tu inscripción al curso <strong>${metadata.tipo || metadata.producto}</strong> ha sido confirmada con éxito.
          </p>

          <p style="font-size: 15px; color: #333; line-height: 1.5;">
            Ya podés acceder al material y recursos desde el siguiente enlace:
          </p>

          <div style="text-align: center; margin: 25px 0;">
            <a href="https://drive.google.com/drive/folders/1fiQhOllmw8k7YE89UXzPucigUM5wUoqp?usp=drive_link"
              style="background-color: #00796b; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">
              Acceder al material de la capacitacion
            </a>
          </div>

          <p style="font-size: 15px; line-height: 1.6;">
      Si tenés alguna duda o querés comunicarte con nosotros, podés responder a este correo 
      <strong>o escribirnos al WhatsApp 
      <a href="https://wa.me/5492617242768" style="color: #00695c; text-decoration: none;">+54 9 261 724 2768</a></strong>.
    </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="font-size: 13px; color: #999; text-align: center;">
            © ${new Date().getFullYear()} Bruno G. Medicina China — Todos los derechos reservados.
          </p>
        </div>
      </div>
      `
    }, 'Capacitacion - Alumno');

    await enviarEmail({
      from: 'Notificación de Curso <notificaciones@brunomtch.com>',
      to: EMAIL_BRUNO,
      subject: `💰 Nueva Venta de Curso`,
      html: `<p>Venta confirmada: ${metadata.nombre} (${metadata.email})</p>`
    }, 'Curso - Cliente');

    console.log(`✅ Proceso completado correctamente para paymentId=${paymentId}`);
  } catch (error) {
    console.error('💥 Error procesando curso:', error);
  } finally {
    // 🔓 Liberar bloqueo aunque haya error
    procesandoPagos.delete(payment.id);
  }
};

// ------------------------------------------
// Handler principal
// ------------------------------------------
export const handleWebhook = async (req) => {
  try {
    const { topic } = req.body;
    
    if (topic === 'merchant_order') {
      console.log(`⚠️ Webhook ignorado: topic=${topic}`);
      return; // ¡Nada de bloqueos ni envíos!
    }

    const paymentId = req.body.data?.id || req.query.id;
    if (!paymentId) {
      console.log(`⚠️ Webhook ignorado: id faltante`);
      return;
    }

    console.log(`🔍 Consultando pago ${paymentId} en Mercado Pago...`);
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error al obtener pago:`, errorText);
      return;
    }

    const payment = await response.json();
    console.log(`✅ Pago consultado: ${payment.status} (${payment.status_detail})`);
    const metadata = payment.metadata || {};

    if (metadata.date && metadata.time) {
      await procesarTurno(metadata, paymentId);
    } else if (metadata.producto || metadata.tipo) {
      await procesarCurso(metadata, payment);
    } else {
      console.log('⚠️ Pago sin metadatos reconocidos:', metadata);
    }
  } catch (error) {
    console.error('💥 Error general en webhook:', error);
  }
};

// ------------------------------------------
// Ruta del webhook
// ------------------------------------------
router.post('/', express.json(), (req, res) => {
  const requestId = Date.now() + '-' + Math.floor(Math.random() * 1000);
  console.log(`📥 Webhook recibido [${requestId}]`, JSON.stringify(req.body));

  res.sendStatus(200);

  // Procesamos el webhook async
  handleWebhook(req).catch(err => console.error('💥 Error en handleWebhook:', err));
});

export default router;
