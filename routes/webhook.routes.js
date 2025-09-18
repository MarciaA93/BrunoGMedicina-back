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
  if (!process.env.EMAIL_FROM) {
    console.error('❌ FATAL: La variable de entorno EMAIL_FROM no está definida.');
  }

  try {
    console.log('Webhook recibido:', req.body);
    
    const topic = req.body.type || req.query.topic;

    // --- LA LÍNEA CLAVE DE LA SOLUCIÓN ESTÁ AQUÍ ---
    // Ignoramos la notificación 'merchant_order' para procesar solo 'payment' y evitar duplicados.
    if (topic !== 'payment') {
        console.log(`Webhook de tipo '${topic}' ignorado para evitar duplicados. Respondiendo OK.`);
        return res.sendStatus(200);
    }
    
    const paymentId = req.body.data?.id;

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
      console.log(`Pago ${paymentId} no aprobado (estado: ${payment.status}).`);
      return res.sendStatus(200);
    }
    
    res.status(200).send('ok');
    
    // --- AHORA ESTA LÓGICA SE EJECUTARÁ UNA SOLA VEZ POR COMPRA ---
    
    if (metadata && metadata.date && metadata.time) {
      console.log('Procesando webhook para un TURNO (Ejecución única).');
      
      // ... Lógica de base de datos ...
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

      // Email para el paciente
      try {
        console.log(`Intentando enviar email de confirmación a PACIENTE: ${metadata.email}`);
        await resend.emails.send({
          from: 'Bruno G. Medicina China <confirmacion@brunomtch.com>',
          to: metadata.email,
          subject: 'Confirmación de tu turno',
          html: `<p>Hola ${metadata.nombre}, tu turno ha sido confirmado.</p>`
        });
        console.log(`✅ Email para PACIENTE (${metadata.email}) enviado con éxito.`);
      } catch (error) {
        console.error(`❌ Error al enviar email al PACIENTE (${metadata.email}):`, error.message);
      }

      // Email de notificación para el cliente
      try {
        console.log(`Intentando enviar email de notificación a CLIENTE: ${process.env.EMAIL_FROM}`);
        await resend.emails.send({
          from: 'Notificación de Turno <notificaciones@brunomtch.com>',
          to: process.env.EMAIL_FROM,
          subject: `Nuevo Turno Confirmado: ${metadata.tipo}`,
          html: `<p>Se confirmó un nuevo turno para ${metadata.nombre} (${metadata.email}).</p>`
        });
        console.log(`✅ Email de notificación para CLIENTE enviado con éxito.`);
      } catch (error) {
        console.error(`❌ Error al enviar email de notificación al CLIENTE (${process.env.EMAIL_FROM}):`, error.message);
      }

    } else if (metadata && metadata.producto) {
      console.log('Procesando webhook para un CURSO (Ejecución única).');
      
      // Guardar la compra en la base de datos
      const nuevaCompra = new Compra({
        nombre: metadata.nombre,
        email: metadata.email,
        producto: metadata.tipo, // 'tipo' contiene el nombre del curso
        precio: payment.transaction_amount,
        fechaCompra: new Date()
      });
      await nuevaCompra.save();

      // Email para el comprador del curso
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
          `
        });
        console.log(`✅ Email para ALUMNO (${metadata.email}) enviado con éxito.`);
      } catch (error) {
        console.error(`❌ Error al enviar email al ALUMNO (${metadata.email}):`, error.message);
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
        console.error(`❌ Error al enviar email de notificación al CLIENTE (${process.env.EMAIL_FROM}):`, error.message);
      }
    } else {
      console.log('Webhook de pago aprobado, pero sin metadatos de TURNO o CURSO.');
    }

  } catch (error) {
    console.error('❌ Error general en el procesamiento del webhook:', error);
    if (!res.headersSent) {
      res.status(200).send('error processing');
    }
  }
});

export default router;
