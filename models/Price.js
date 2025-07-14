// server/models/Price.js
import mongoose from 'mongoose';
const priceSchema = new mongoose.Schema({
  masajeType: { type: String, unique: true },
  price: Number,
  price2: Number,  
});
export default mongoose.model('Price', priceSchema);