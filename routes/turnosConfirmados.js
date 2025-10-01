import express from 'express';
import TurnoConfirmado from '../models/TurnoConfirmado.js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

// Obtener todos los turnos confirmados (PARA USO ADMINISTRATIVO)
// Esta ruta es útil para que puedas ver desde un panel de admin o similar
// todos los turnos que se han confirmado a través del webhook.
router.get('/', async (req, res) => {
  try {
    const confirmados = await TurnoConfirmado.find().sort({ fechaCompra: -1 });
    res.json(confirmados);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// SE HA ELIMINADO LA RUTA POST DE ESTE ARCHIVO.
// La creación de un TurnoConfirmado y el envío de emails ahora
// son responsabilidad exclusiva del webhook.js para evitar duplicados
// y asegurar que solo se procesen turnos pagados.


export default router;