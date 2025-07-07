import mongoose from 'mongoose';

const precioSchema = new mongoose.Schema({
  masajeType: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
});

export default mongoose.model('Precio', precioSchema);