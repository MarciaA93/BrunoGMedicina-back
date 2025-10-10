// controllers/cursosController.js
const mercadopago = require('mercadopago');
const Curso = require('../models/Curso'); // ajustá path
const { sendPurchaseEmail } = require('../helpers/mailer'); // tu mailer ya existente

mercadopago.configure({ access_token: process.env.MP_TOKEN });

exports.createPreference = async (req, res) => {
  try {
    const { cursoId, buyer } = req.body; // buyer puede tener email/nombre
    const curso = await Curso.findById(cursoId);
    if (!curso) return res.status(404).json({ error: 'Curso no encontrado' });

    const preference = {
      items: [
        {
          id: curso._id.toString(),
          title: curso.title,
          description: curso.description || 'Capacitación',
          quantity: 1,
          currency_id: 'ARS', // o USD
          unit_price: Number(curso.price),
        }
      ],
      auto_return: 'approved',
      back_urls: {
        success: process.env.FRONT_URL + '/compra/exito',
        pending: process.env.FRONT_URL + '/compra/pendiente',
        failure: process.env.FRONT_URL + '/compra/fallo'
      },
      notification_url: process.env.MP_NOTIFICATION_URL, // ej: https://miapp.up.railway.app/api/mp/webhook
      external_reference: JSON.stringify({ cursoId: curso._id, buyerEmail: buyer?.email })
    };

    const mpRes = await mercadopago.preferences.create(preference);
    // mpRes.body.init_point o mpRes.body.sandbox_init_point
    return res.json({ init_point: mpRes.body.init_point, preference: mpRes.body });
  } catch (err) {
    console.error('createPreference error', err);
    return res.status(500).json({ error: 'Error creando preferencia' });
  }
};