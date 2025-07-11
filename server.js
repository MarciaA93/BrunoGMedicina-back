import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import preciosCursosRoutes from './routes/preciosCursos.routes.js';
import turnoRoutes from './routes/turnos.routes.js';
import adminRoutes from './routes/admin.routes.js';
import preciosRoutes from './routes/preciosRoutes.js';
import mercadopagoRoutes from './routes/mercadopago.js';
import compraRoutes from './routes/compra.routes.js';
import turnosConfirmadosRoutes from './routes/turnosConfirmados.js';
import webhookRoutes from './routes/webhook.routes.js';


console.log('⏳ Iniciando servidor...');
console.log('🔑 MP_ACCESS_TOKEN:', process.env.MP_ACCESS_TOKEN ? '✅ cargado' : '❌ faltante');
console.log('🧪 EMAIL_FROM:', process.env.EMAIL_FROM);
console.log('🌍 FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('🌍 MONGO_URI:', process.env.MONGO_URI ? '✅ cargada' : '❌ faltante');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// CORS con whitelist
const whitelist = [
  'http://localhost:5173',
  'https://brunograttonni.netlify.app',
  'https://www.brunograttonni.netlify.app',
  'https://brunogmedicina-back-production.up.railway.app',
  'https://brunogmedicinachina.netlify.app',
  'https://brunomtch.com'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('⛔ CORS bloqueado:', origin);
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

// Ruta raíz de prueba
app.get('/', (req, res) => {
  res.send('✅ Servidor funcionando en producción!');
});

// Conexión a MongoDB y arranque del servidor
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('🟢 Conectado a MongoDB Atlas');

  // Rutas después de conexión exitosa
  app.use('/api/admin', adminRoutes);
  app.use('/api/precios', preciosRoutes);
  app.use('/api/mercadopago', mercadopagoRoutes);
  app.use('/api', compraRoutes);
  app.use('/api/turnos', turnoRoutes);
  app.use('/api/turnos-confirmados', turnosConfirmadosRoutes);
  app.use('/api/precios-cursos', preciosCursosRoutes);
  app.use('/api/mercadopago', webhookRoutes);

  app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
})
.catch((error) => {
  console.error('❌ Error al conectar con MongoDB:', error.message);
  process.exit(1); // Importante: cortá si no se conecta
});

