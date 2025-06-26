import express from 'express';
import fetch from 'node-fetch'; // si no usás Node.js 18+

const router = express.Router();

router.post('/webhook', express.json(), async (req, res) => {
  console.log('📥 Webhook recibido');
  console.log('Query:', req.query);
  console.log('Body:', req.body);

  const topic = req.query.topic || req.body.type;
  const { date, time } = req.query;

  if (!date || !time) {
    console.error('Faltan parámetros date o time en webhook');
    return res.status(400).json({ error: 'Faltan parámetros date o time' });
  }

  if (topic === 'payment' || topic === 'merchant_order') {
    try {
      const response = await fetch(`${process.env.BACKEND_URL}/api/turnos/${date}/${time}`, {
        method: 'PUT'
      });

      if (!response.ok) {
        throw new Error(`Error en la reserva del turno: ${response.statusText}`);
      }

      res.status(200).json({ message: 'Webhook procesado con éxito' });
    } catch (err) {
      console.error('Error al procesar el webhook:', err);
      res.status(500).json({ error: err.message });
    }
  } else {
    res.sendStatus(400); // No es un topic que te interese
  }
});

export default router;
