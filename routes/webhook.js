import express from 'express';
import axios from 'axios';
import { Resend } from 'resend';
import dotenv from 'dotenv';
import Compra from '../models/Compra.js';
import TurnoConfirmado from '../models/TurnoConfirmado.js';
import Turno from '../models/Turno.js'; // Importamos el modelo Turno para poder actualizarlo

dotenv.config();
const router = express.Router();

const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_CONTACTO_BRUNO = process.env.EMAIL_FROM || 'tu-email-de-notificacion@ejemplo.com';

/**
 * Función central para procesar un pago aprobado.
 * Es idempotente, lo que significa que si recibe el mismo pago varias veces,
 * solo lo procesará una vez.
 */
async function procesarPagoAprobado(payment) {
  const compraId = payment.external_reference;
  const paymentId = payment.id;

  if (!compraId) {
    console.error('❌ Error Crítico: El pago aprobado no tiene una external_reference. No se puede procesar.');
    return;
  }

  // --- 1. Verificar si este pago ya fue procesado ---
  const turnoYaConfirmado = await TurnoConfirmado.findOne({ paymentId: paymentId });
  if (turnoYaConfirmado) {
    console.log(`⚠️ El pago ${paymentId} ya fue procesado anteriormente. Omitiendo.`);
    return;
  }

  // --- 2. Buscar la compra original en nuestra base de datos ---
  console.log(`Buscando Compra en DB con ID: ${compraId}`);
  const compra = await Compra.findById(compraId);

  if (!compra) {
    console.error(`❌ Error: No se encontró la Compra con ID ${compraId} para el pago ${paymentId}.`);
    return;
  }

  // --- 3. Actualizar el estado de la compra original ---
  compra.status = 'approved';
  compra.paymentId = paymentId;
  compra.paymentDetails = payment; // Guardamos todos los detalles del pago
  await compra.save();
  console.log(`✅ Compra ${compraId} actualizada a estado "approved".`);

  // --- 4. Si es un turno, marcarlo como no disponible y crear el turno confirmado ---
  if (compra.tipo === 'turno') {
    console.log(`📅 Confirmando turno para ${compra.nombre} el ${compra.fecha} a las ${compra.hora}`);

    // Marcamos el horario como no disponible de forma atómica
    await Turno.updateOne(
      { date: compra.fecha, 'timeSlots.time': compra.hora },
      { $set: { 'timeSlots.$.available': false } }
    );
    console.log(`🗓️ Horario ${compra.hora} del ${compra.fecha} marcado como no disponible.`);

    // Creamos el registro del turno confirmado
    const nuevoTurnoConfirmado = new TurnoConfirmado({
      date: compra.fecha,
      time: compra.hora,
      userName: compra.nombre,
      userEmail: compra.email,
      paymentId: paymentId,
      compraId: compra._id,
    });
    await nuevoTurnoConfirmado.save();
    console.log('✅ Turno guardado en la colección de confirmados.');
  }

  // --- 5. Enviar emails de confirmación ---
  if (compra.tipo === 'turno') {
    // Email para el cliente
    await resend.emails.send({
      from: 'Bruno G Medicina China <onboarding@resend.dev>',
      to: compra.email,
      subject: 'Confirmación de tu turno',
      html: `<p>Hola ${compra.nombre},</p><p>Tu turno fue confirmado para el día <strong>${compra.fecha}</strong> a las <strong>${compra.hora}</strong>.</p><p>¡Gracias por tu confianza!</p>`,
    });

    // Email de notificación para Bruno
    await resend.emails.send({
      from: 'Notificación de Turno <onboarding@resend.dev>',
      to: EMAIL_CONTACTO_BRUNO,
      subject: 'Nuevo turno confirmado',
      html: `<p>Nuevo turno confirmado:</p><ul><li><strong>Nombre:</strong> ${compra.nombre}</li><li><strong>Email:</strong> ${compra.email}</li><li><strong>Fecha:</strong> ${compra.fecha}</li><li><strong>Hora:</strong> ${compra.hora}</li></ul>`,
    });

  } else if (compra.tipo === 'curso') {
    // Lógica de email para cursos (si la tienes)
  }

  console.log(`📧 Emails de confirmación enviados para la compra ${compraId}.`);
}


// --- RUTA DEL WEBHOOK ---
router.post('/', express.json(), async (req, res) => {
  console.log('---------- WEBHOOK RECIBIDO ----------');
  const notification = req.body;
  
  // Respondemos inmediatamente a Mercado Pago para evitar timeouts
  res.sendStatus(200);

  try {
    if (notification.type === 'payment') {
      const paymentId = notification.data.id;
      console.log(`Recibida notificación de pago. ID: ${paymentId}`);
      
      const paymentResponse = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      });
      
      if (paymentResponse.data.status === 'approved') {
        await procesarPagoAprobado(paymentResponse.data);
      } else {
        console.log(`Pago ${paymentId} con estado "${paymentResponse.data.status}". No se procesa.`);
      }
    }
  } catch (error) {
    console.error('❌ Error procesando notificación de webhook:', error.response ? error.response.data : error.message);
  }
});

export default router;
