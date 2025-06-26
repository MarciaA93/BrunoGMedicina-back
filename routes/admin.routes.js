// routes/admin.routes.js
import express from 'express';
import { loginAdmin } from '../controllers/adminController.js';

const router = express.Router();

router.post('/login', loginAdmin);

// POST /api/admin/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const admin = await admin.findOne({ username });
    if (!admin) return res.status(401).json({ message: 'Usuario no encontrado' });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ message: 'Contraseña incorrecta' });

    // Podés usar JWT más adelante, por ahora devolvemos un simple ok
    res.json({ message: 'Login exitoso', admin: { id: admin._id, username: admin.username } });
  } catch (err) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
  });

export default router;

