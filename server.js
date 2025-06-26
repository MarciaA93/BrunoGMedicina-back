
import dotenv from 'dotenv';

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import turnoRoutes from './routes/turnos.routes.js';
import adminRoutes from './routes/admin.routes.js';
import priceRoutes from './routes/price.routes.js';
import mercadopagoRoutes from './routes/mercadopago.js'; 
import compraRoutes from './routes/compra.routes.js';

console.log('🌍 FRONTEND_URL:', process.env.FRONTEND_URL);
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

// Rutas
app.use('/api/admin', adminRoutes);
app.use('/api/precios', priceRoutes);
app.use('/api/mercadopago', mercadopagoRoutes);
app.use('/api', compraRoutes);

// Conexión a MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('🟢 Conectado a MongoDB Atlas');

    // 🔗 Rutas protegidas o dependientes de la DB
    app.use('/api/turnos', turnoRoutes);

    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('❌ Error al conectar con MongoDB:', error);
    console.log("MONGO_URI:", process.env.MONGO_URI);
  });

// Ruta raíz de prueba
app.get('/', (req, res) => {
  res.send('Servidor funcionando!');
});




