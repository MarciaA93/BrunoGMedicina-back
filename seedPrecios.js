// seedPrecios.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Precio from './models/Precio.js';

dotenv.config();

const precios = [
  { masajeType: 'TuiNa Tradicional', price: 25000 },
  { masajeType: 'TuiNa Premium', price: 30000 },
  { masajeType: 'Pack 2 sesiones', price: 45000 },
  { masajeType: 'Pack 4 sesiones', price: 100000 },
];

const seedPrecios = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🟢 Conectado a MongoDB');

    // Opcional: limpiar la colección
    await Precio.deleteMany({});
    console.log('❌ Precios anteriores eliminados');

    // Insertar nuevos precios
    await Precio.insertMany(precios);
    console.log('✅ Precios insertados correctamente');

    process.exit(); // Salir del script
  } catch (err) {
    console.error('❌ Error al hacer seed:', err);
    process.exit(1);
  }
};

seedPrecios();
