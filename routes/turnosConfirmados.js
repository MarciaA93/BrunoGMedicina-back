import express from 'express';
import TurnoConfirmado from '../models/TurnoConfirmado.js';
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

// Inicializar Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Obtener todos los turnos/cursos confirmados
router.get('/', async (req, res) => {
  try {
    const confirmados = await TurnoConfirmado.find().sort({ fechaCompra: -1 });
    res.json(confirmados);
  } catch (error) {
    console.error("❌ Error al obtener confirmaciones:", error);
    res.status(500).json({ error: error.message });
  }
});

// Guardar turno o curso y enviar mails
router.post('/', async (req, res) => {
  const { nombre, email, tipo, date, time, nombre_curso } = req.body;

  if (!nombre || !email || !tipo) {
    return res.status(400).json({ error: 'Faltan datos obligatorios (nombre, email o tipo)' });
  }

  try {
    const nuevo = new TurnoConfirmado({
      nombre,
      email,
      tipo,
      date: tipo === "curso" ? null : date,
      time: tipo === "curso" ? null : time,
      fechaCompra: new Date(),
      metodo: 'Mercado Pago',
    });

    await nuevo.save();
    console.log("💾 Guardado en Mongo:", nuevo._id);

    // --- Construir HTML para mails ---
    let clienteHTML = "";
    let masajistaHTML = "";

    if (tipo === "curso") {
      clienteHTML = `
        <p>Hola ${nombre},</p>
        <p>Tu inscripción al curso <strong>${nombre_curso}</strong> fue confirmada ✅</p>
        <p>Gracias por confiar en nosotros 🙌</p>
        <p>📱 WhatsApp: +5492617242768</p>
        <p>📍 Ubicación: Paraná 1132, GC, MDZ.</p>
      `;

      masajistaHTML = `
        <p>Nuevo curso confirmado:</p>
        <ul>
          <li><strong>Nombre:</strong> ${nombre}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Curso:</strong> ${nombre_curso}</li>
        </ul>
      `;
    } else {
      clienteHTML = `
        <p>Hola ${nombre},</p>
        <p>Tu turno fue confirmado para el día <strong>${date}</strong> a las <strong>${time}</strong>.</p>
        <p>Tipo de masaje: <strong>${tipo}</strong></p>
        <p>Gracias por confiar en nosotros 🙌</p>
        <p>📱 WhatsApp: +5492617242768</p>
        <p>📍 Ubicación: Paraná 1132, GC, MDZ.</p>
      `;

      masajistaHTML = `
        <p>Nuevo turno confirmado:</p>
        <ul>
          <li><strong>Nombre:</strong> ${nombre}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Tipo:</strong> ${tipo}</li>
          <li><strong>Fecha:</strong> ${date}</li>
          <li><strong>Hora:</strong> ${time}</li>
        </ul>
      `;
    }

    // Enviar mails
    await resend.emails.send({
      from: 'Bruno G Medicina China <onboarding@resend.dev>',
      to: email,
      subject: tipo === "curso" ? 'Confirmación de tu curso' : 'Confirmación de tu turno',
      html: clienteHTML,
    });

    await resend.emails.send({
      from: 'Bruno G Medicina China <onboarding@resend.dev>',
      to: process.env.EMAIL_FROM,
      subject: tipo === "curso" ? 'Nuevo curso confirmado' : 'Nuevo turno confirmado',
      html: masajistaHTML,
    });

    res.status(201).json({ message: 'Confirmación guardada y mails enviados', turno: nuevo });
  } catch (error) {
    console.error("❌ Error en /api/turnos-confirmados:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
