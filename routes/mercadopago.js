router.post('/create_preference', async (req, res) => {
  const { title, unit_price, nombre, email, tipo } = req.body;
  const { date, time } = req.query;

  console.log('📦 Body recibido:', req.body);
  console.log('📅 Fecha:', date, '⏰ Hora:', time);

  try {
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            title,
            unit_price: Number(unit_price),
            quantity: 1
          }
        ],
        back_urls: {
          success: `${process.env.FRONTEND_URL}?pago=exitoso`,
          failure: `${process.env.FRONTEND_URL}?pago=fallo`,
          pending: `${process.env.FRONTEND_URL}?pago=pendiente`
        },
        notification_url: `${process.env.BACKEND_URL}/api/mercadopago/webhook`,
        auto_return: 'approved',

        metadata: {
          nombre,
          email,
          tipo,
          date,
          time
        }
      }
    });

    console.log('🔗 Init point generado:', result.init_point);
    res.json({ init_point: result.init_point });

  } catch (err) {
    console.error('❌ Error al crear preferencia:\n', err);
    res.status(500).json({ error: 'No se pudo crear la preferencia de pago' });
  }
});
