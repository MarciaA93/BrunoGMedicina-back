import express from 'express';
import PreciosCursos from '../models/preciosCursos.js';

const router = express.Router();

// Obtener todos los precios de cursos
router.get('/', async (req, res) => {
  const cursos = await PreciosCursos.find();
  res.json(cursos);
});

// Actualizar un precio
router.put('/:nombreCurso', async (req, res) => {
  const { nombreCurso } = req.params;
  const { price } = req.body;
  const curso = await PreciosCursos.findOneAndUpdate(
    { nombreCurso },
    { price },
    { new: true }
  );
  res.json(curso);
});

export default router;
