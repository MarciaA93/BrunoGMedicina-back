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

router.post('/webhook', express.json(), async (req, res) => {
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
      return res.sendStatus(200);
    }
    
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
        tipo: metadata.tipo, // Ahora esto siempre tendrá valor
        date: metadata.date,
        time: metadata.time,
        fechaCompra: new Date(),
        metodo: 'Mercado Pago',
        paymentId: paymentId
      });
      await nuevoConfirmado.save();

      // Email para el cliente
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

      // Email de notificación para ti
       await resend.emails.send({
        from: 'Notificación <notificaciones@brunomtch.com>',
        to: process.env.EMAIL_FROM,
        subject: `Nuevo Turno Confirmado: ${metadata.tipo}`,
        html: `<p>Se confirmó un nuevo turno para ${metadata.nombre} (${metadata.email}) el día ${metadata.date} a las ${metadata.time}.</p>`
      });
      console.log(`Correos para TURNO de ${metadata.email} enviados con éxito.`);

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

      // Email para el cliente
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
      
      // Email de notificación para ti
      await resend.emails.send({
        from: 'Notificación <notificaciones@brunomtch.com>',
        to: process.env.EMAIL_FROM,
        subject: `Nueva Venta de Curso: ${metadata.tipo}`,
        html: `<p>${metadata.nombre} (${metadata.email}) se ha inscrito al curso "${metadata.tipo}".</p>`
      });
       console.log(`Correos para CURSO de ${metadata.email} enviados con éxito.`);
    }
  } catch (error) {
    console.error('❌ Error general en webhook:', error);
  }
});

export default router;