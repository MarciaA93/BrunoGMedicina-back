// routes/webhook.js
import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import Turno from '../models/Turno.js';
import TurnoConfirmado from '../models/TurnoConfirmado.js';
import Compra from '../models/Compra.js'; // Importamos tu modelo Compra
import nodemailer from 'nodemailer';

dotenv.config();
const router = express.Router();

// Función de email sin cambios, ¡ya estaba bien!
async function enviarEmailsConGmail(mailOptions) {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_FROM,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Email para el cliente
    await transporter.sendMail({
      from: `"Bruno G Medicina China" <${process.env.EMAIL_FROM}>`,
      to: mailOptions.to,
      subject: mailOptions.subject,
      html: mailOptions.html,
    });

    // Email para ti
    await transporter.sendMail({
      from: `"Notificación" <${process.env.EMAIL_FROM}>`,
      to: process.env.EMAIL_FROM,
      subject: `Nuevo ${mailOptions.productType} confirmado`,
      html: `<p>Se confirmó un nuevo ${mailOptions.productType} para ${mailOptions.nombre} (${mailOptions.to}).</p>`,
    });
    console.log(`🚀 Emails para ${mailOptions.to} enviados con éxito.`);
  } catch (error) {
    console.error(`❌ Falló el envío de emails para ${mailOptions.to}:`, error);
  }
}


router.post('/webhook', express.json(), async (req, res) => {
  try {
    console.log('Webhook recibido:', req.body);
    
    // Lógica para obtener el ID del pago (sin cambios)
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
      console.log('No se encontró paymentId, ignorando webhook.');
      return res.sendStatus(200);
    }

    // Obtenemos los detalles del pago desde Mercado Pago
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });

    if (!response.ok) {
        console.error('Error al obtener el pago de Mercado Pago:', await response.text());
        return res.sendStatus(500);
    }

    const payment = await response.json();
    const metadata = payment.metadata;

    // Solo continuamos si el pago fue aprobado
    if (payment.status !== 'approved') {
      console.log(`Pago ${paymentId} no aprobado (estado: ${payment.status}).`);
      return res.sendStatus(200);
    }
    
    // --- ✅ LÓGICA CORREGIDA Y MEJORADA ---
    
    // Primero, respondemos a Mercado Pago para evitar timeouts.
    res.status(200).send('ok');

    // Ahora, procesamos la lógica de negocio en segundo plano.

    // CASO 1: Es la compra de un TURNO (identificado por la presencia de 'date' y 'time')
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

      // Enviamos el email del turno
      enviarEmailsConGmail({
          to: metadata.email,
          nombre: metadata.nombre,
          productType: 'turno',
          subject: 'Confirmación de tu turno',
          html: `<p>Hola ${metadata.nombre}, tu turno para el ${metadata.date} a las ${metadata.time} ha sido confirmado. ¡Muchas gracias!</p>`
      });

    // CASO 2: Es la compra de un CURSO (identificado por la presencia de 'producto')
    } else if (metadata && metadata.producto) {
      console.log('Procesando webhook para un CURSO.');
      
      // Usamos tu modelo 'Compra'
      const nuevaCompra = new Compra({
        nombre: metadata.nombre,
        email: metadata.email,
        producto: metadata.tipo, // 'tipo' contiene el nombre del curso, ej: "Curso online: Masaje TuiNa"
        precio: payment.transaction_amount, // Obtenemos el precio desde el objeto de pago
        metodo: 'Mercado Pago',
        paymentId: paymentId,
        fechaCompra: new Date()
      });
      await nuevaCompra.save();

      // Enviamos el email del curso
      enviarEmailsConGmail({
          to: metadata.email,
          nombre: metadata.nombre,
          productType: 'curso',
          subject: 'Confirmación de tu inscripción al curso',
          html: `<p>Hola ${metadata.nombre}, tu inscripción al curso "${metadata.tipo}" ha sido confirmada. ¡Muchas gracias!</p>`
      });

    } else {
      console.log('Webhook recibido para un pago aprobado sin metadata reconocible:', metadata);
    }
    
  } catch (error) {
    console.error('❌ Error general en webhook:', error);
    // Si ya enviamos una respuesta, no intentamos enviar otra.
    if (!res.headersSent) {
      res.sendStatus(500);
    }
  }
});

export default router;