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

router.post('/webhook', express.json(), async (req, res) => {
  // --- INICIO: PUNTOS CLAVE DE DIAGNÓSTICO ---
  // 1. Verificamos que la variable de entorno para el email del cliente esté cargada.
  // Si esto falla, el email de notificación nunca se enviará.
  if (!process.env.EMAIL_FROM) {
    console.error('❌ FATAL: La variable de entorno EMAIL_FROM no está definida. Revisa tu archivo .env');
  } else {
    console.log(`✅ El email para notificaciones se enviará a: ${process.env.EMAIL_FROM}`);
  }
  // --- FIN: PUNTOS CLAVE DE DIAGNÓSTICO ---

  try {
    console.log('Webhook recibido:', req.body);
    
    const topic = req.query.topic || req.body.type;
    let paymentId = req.body.data?.id;

    if (topic === 'merchant_order') {
      const orderResponse = await fetch(`https://api.mercadopago.com/merchant_orders/${req.query.id}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      });
      const order = await orderResponse.json();
      paymentId = order.payments[0]?.id;
    }

    if (!paymentId) {
      console.log('No se encontró paymentId, finalizando proceso.');
      return res.sendStatus(200);
    }

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });

    if (!response.ok) {
      console.error('Error al obtener el pago de Mercado Pago:', await response.text());
      return res.sendStatus(500);
    }

    const payment = await response.json();
    const metadata = payment.metadata;

    if (payment.status !== 'approved') {
      console.log(`Pago ${paymentId} no aprobado (estado: ${payment.status}). No se enviarán correos.`);
      return res.sendStatus(200);
    }
    
    // Respondemos a Mercado Pago inmediatamente para evitar timeouts.
    // La lógica de envío de emails continúa después.
    res.status(200).send('ok');
    
    // --- Lógica de negocio y envío de email ---
    
    // CASO 1: Es un TURNO (identificado por la presencia de 'date' y 'time')
    if (metadata && metadata.date && metadata.time) {
      console.log('Procesando webhook para un TURNO.');

      await Turno.findOneAndUpdate(
        { date: metadata.date, "timeSlots.time": metadata.time },
        { $set: { "timeSlots.$.available": false } }
      );
      
      const nuevoConfirmado = new TurnoConfirmado({
        nombre: metadata.nombre,
        email: metadata.email,
        tipo: metadata.tipo,
        date: metadata.date,
        time: metadata.time,
        fechaCompra: new Date(),
        metodo: 'Mercado Pago',
        paymentId: paymentId
      });
      await nuevoConfirmado.save();

      // --- Envío de Emails para TURNO (con manejo de errores individual) ---

      // Email para el paciente
      try {
        console.log(`Intentando enviar email de confirmación a PACIENTE: ${metadata.email}`);
        await resend.emails.send({
          from: 'Bruno G. Medicina China <confirmacion@brunomtch.com>',
          to: metadata.email,
          subject: 'Confirmación de tu turno',
          html: `
            <p>Hola ${metadata.nombre}, tu turno para <strong>${metadata.tipo}</strong> el día <strong>${metadata.date}</strong> a las <strong>${metadata.time} hs</strong> ha sido confirmado.</p>
            <p>¡Muchas gracias por tu reserva!</p>
            <hr>
            <p><strong>Para consultas, puedes contactarme a través de:</strong></p>
            <p>📧 Correo: brunomedicinachina@gmail.com</p>
            <p>📱 WhatsApp: +5492617242768</p>
            <p>📍 Ubicación: Paraná 1132, Godoy Cruz, Mendoza.</p>
          `
        });
        console.log(`✅ Email para PACIENTE (${metadata.email}) enviado con éxito.`);
      } catch (error) {
        console.error(`❌ Error al enviar email al PACIENTE (${metadata.email}):`, error);
      }

      // Email de notificación para el cliente (dueño)
      try {
        console.log(`Intentando enviar email de notificación a CLIENTE: ${process.env.EMAIL_FROM}`);
        await resend.emails.send({
          from: 'Notificación de Turno <notificaciones@brunomtch.com>',
          to: process.env.EMAIL_FROM,
          subject: `Nuevo Turno Confirmado: ${metadata.tipo}`,
          html: `<p>Se confirmó un nuevo turno para ${metadata.nombre} (${metadata.email}) el día ${metadata.date} a las ${metadata.time}.</p>`
        });
        console.log(`✅ Email de notificación para CLIENTE enviado con éxito.`);
      } catch (error) {
        console.error(`❌ Error al enviar email de notificación al CLIENTE (${process.env.EMAIL_FROM}):`, error);
      }

    // CASO 2: Es un CURSO (identificado por la presencia de 'producto')
    } else if (metadata && metadata.producto) {
      console.log('Procesando webhook para un CURSO.');
      
      const nuevaCompra = new Compra({
        nombre: metadata.nombre,
        email: metadata.email,
        producto: metadata.tipo, // 'tipo' contiene el nombre del curso
        precio: payment.transaction_amount,
        fechaCompra: new Date()
      });
      await nuevaCompra.save();

      // --- Envío de Emails para CURSO (con manejo de errores individual) ---

      // Email para el paciente/alumno
      try {
        console.log(`Intentando enviar email de confirmación a ALUMNO: ${metadata.email}`);
        await resend.emails.send({
          from: 'Bruno G. Medicina China <confirmacion@brunomtch.com>',
          to: metadata.email,
          subject: 'Confirmación de tu inscripción al curso',
          html: `
            <p>Hola ${metadata.nombre}, tu inscripción al curso "<strong>${metadata.tipo}</strong>" ha sido confirmada.</p>
            <p>Recibirás más información sobre el curso a la brevedad.</p>
            <p>¡Muchas gracias por tu compra!</p>
            <hr>
            <p><strong>Para consultas, puedes contactarme a través de:</strong></p>
            <p>📧 Correo: brunomedicinachina@gmail.com</p>
            <p>📱 WhatsApp: +5492617242768</p>
          `
        });
        console.log(`✅ Email para ALUMNO (${metadata.email}) enviado con éxito.`);
      } catch (error) {
        console.error(`❌ Error al enviar email al ALUMNO (${metadata.email}):`, error);
      }
      
      // Email de notificación para el cliente (dueño)
      try {
        console.log(`Intentando enviar email de notificación a CLIENTE: ${process.env.EMAIL_FROM}`);
        await resend.emails.send({
          from: 'Notificación de Curso <notificaciones@brunomtch.com>',
          to: process.env.EMAIL_FROM,
          subject: `Nueva Venta de Curso: ${metadata.tipo}`,
          html: `<p>${metadata.nombre} (${metadata.email}) se ha inscrito al curso "${metadata.tipo}".</p>`
        });
        console.log(`✅ Email de notificación para CLIENTE enviado con éxito.`);
      } catch (error) {
        console.error(`❌ Error al enviar email de notificación al CLIENTE (${process.env.EMAIL_FROM}):`, error);
      }
    } else {
      console.log('Webhook recibido pero los metadatos no corresponden ni a TURNO ni a CURSO.');
    }
  } catch (error) {
    console.error('❌ Error general en el procesamiento del webhook:', error);
    // Aseguramos una respuesta incluso si hay un error no capturado.
    // Evitamos enviar res.status(500) para que MercadoPago no siga reintentando indefinidamente.
    if (!res.headersSent) {
      res.status(200).send('error processing');
    }
  }
});

export default router;
