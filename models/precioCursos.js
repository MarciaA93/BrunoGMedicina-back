import mongoose from 'mongoose';

const precioCursoSchema = new mongoose.Schema({
  nombreCurso: String, // Ej: "Curso online: Masaje TuiNa"
  price: Number,       // Precio en USD
});

export default mongoose.model('PrecioCurso', precioCursoSchema);