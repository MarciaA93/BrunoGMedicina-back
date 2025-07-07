import express from 'express';
import PrecioCursos from '../models/PrecioCursos.js';

const router = express.Router();

// Obtener todos los precios de cursos
router.get('/', async (req, res) => {
  const cursos = await PrecioCursos.find();
  res.json(cursos);
});

// Actualizar un precio
router.put('/:nombreCurso', async (req, res) => {
  const { nombreCurso } = req.params;
  const { price } = req.body;
  const curso = await PrecioCursos.findOneAndUpdate(
    { nombreCurso },
    { price },
    { new: true }
  );
  res.json(curso);
});

export default router;
