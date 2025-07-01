import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import turnoRoutes from './routes/turnos.routes.js';
import adminRoutes from './routes/admin.routes.js';
import priceRoutes from './routes/price.routes.js';
import mercadopagoRoutes from './routes/mercadopago.js'; 
import compraRoutes from './routes/compra.routes.js';

console.log('🌍 FRONTEND_URL:', process.env.FRONTEND_URL);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware para parsear JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ CORS con whitelist
const whitelist = [
  'http://localhost:5173',
  'https://brunograttonni.netlify.app',
  'https://www.brunograttonni.netlify.app'
];

const corsOptions = {
  origin: function (origin, callback) {
    console.log('CORS origin:', origin);
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});
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

    // Solo se levanta si DB está OK
    app.use('/api/turnos', turnoRoutes);

    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('❌ Error al conectar con MongoDB:', error);
  });

// Ruta raíz
app.get('/', (req, res) => {
  res.send('Servidor funcionando!');
});





