import mongoose from 'mongoose';

const preciosCursosSchema = new mongoose.Schema({
  nombreCurso: String, // Ej: "Curso online: Masaje TuiNa"
  price: Number,    
  
});

export default mongoose.model('PreciosCursos', preciosCursosSchema);