import express from "express";
import { MercadoPagoConfig, Preference } from "mercadopago";
import dotenv from "dotenv";
import fetch from "node-fetch"; // 👈 instalar si no lo tenés
import axios from "axios";       // 👈 instalar si no lo tenés

dotenv.config();
const router = express.Router();

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

const preference = new Preference(client);

/* ==============================
   📌 CREAR PREFERENCIA PARA TURNOS
   ============================== */
router.post("/create_preference", async (req, res) => {
  console.log("📥 Datos recibidos en body:", req.body);

  const { title, unit_price, quantity, nombre, email, date, time } = req.body;

  if (!title || !unit_price || !quantity || !nombre || !email || !date || !time) {
    console.error("❌ Faltan datos obligatorios para turno");
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  try {
    const result = await preference.create({
      body: {
        items: [
          {
            title: String(title),
            unit_price: Number(unit_price),
            quantity: Number(quantity),
            currency_id: "ARS",
          },
        ],
        payer: { email: String(email) },
        back_urls: {
          success: "https://brunomtch.com/success",
          failure: "https://brunomtch.com/failure",
          pending: "https://brunomtch.com/pending",
        },
        auto_return: "approved",
        notification_url:
          "https://brunogmedicina-back-production.up.railway.app/api/mercadopago/webhook",
        metadata: {
          nombre: String(nombre),
          email: String(email),
          tipo: "turno",
          date: String(date),
          time: String(time),
        },
      },
    });

    console.log("✅ Preferencia creada:", result);
    res.status(200).json({ init_point: result.init_point });
  } catch (error) {
    console.error("❌ Error al crear preferencia:", error.message || error);
    res.status(500).json({ error: "Error al generar preferencia" });
  }
});

/* ==============================
   📌 CREAR PREFERENCIA PARA CURSOS
   ============================== */
router.post("/create_course_preference", async (req, res) => {
  console.log("📥 Datos recibidos para CURSO:", req.body);

  const { title, unit_price, quantity, nombre, email } = req.body;

  if (!title || !unit_price || !quantity || !nombre || !email) {
    console.error("❌ Faltan datos para la preferencia del curso");
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  try {
    const result = await preference.create({
      body: {
        items: [
          {
            title: String(title),
            unit_price: Number(unit_price),
            quantity: Number(quantity),
            currency_id: "ARS",
          },
        ],
        payer: { email: String(email) },
        back_urls: {
          success: "https://brunomtch.com/success-curso",
          failure: "https://brunomtch.com/failure-curso",
          pending: "https://brunomtch.com/pending",
        },
        auto_return: "approved",
        notification_url:
          "https://brunogmedicina-back-production.up.railway.app/api/mercadopago/webhook",
        metadata: {
          nombre: String(nombre),
          email: String(email),
          tipo: "curso",
          nombre_curso: String(title),
        },
      },
    });

    console.log("✅ Preferencia de CURSO creada:", result);
    res.status(200).json({ init_point: result.init_point });
  } catch (error) {
    console.error("❌ Error al crear preferencia de CURSO:", error.message || error);
    res.status(500).json({ error: "Error al generar preferencia para el curso" });
  }
});

/* ==============================
   📌 WEBHOOK (MercadoPago → tu backend)
   ============================== */
router.post("/webhook", async (req, res) => {
  try {
    console.log("📩 Webhook recibido:", JSON.stringify(req.body, null, 2));

    const { type, data } = req.body;
    if (type === "payment" && data && data.id) {
      const paymentId = data.id;

      // Consultar a MercadoPago el pago completo
      const response = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
        }
      );

      const paymentInfo = await response.json();
      console.log("✅ Pago consultado:", paymentInfo);

      if (paymentInfo.status === "approved") {
        const { nombre, email, tipo, date, time, nombre_curso } =
          paymentInfo.metadata || {};

        if (tipo === "curso") {
          // Confirmar curso
          await axios.post(
            `${process.env.API_BASE_URL}/api/mercadopago/cursos-confirmados`,
            { nombre, email, curso: nombre_curso }
          );
          console.log("🎓 Curso confirmado:", nombre_curso, "para", email);
        } else if (tipo === "turno") {
          // Confirmar turno
          await axios.post(
            `${process.env.API_BASE_URL}/api/mercadopago/turnos-confirmados`,
            { nombre, email, date, time }
          );
          console.log("📅 Turno confirmado:", date, time, "para", email);
        }
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error en webhook:", error.message);
    res.sendStatus(500);
  }
});

/* ==============================
   📌 CONFIRMACIÓN DE TURNOS
   ============================== */
router.post("/turnos-confirmados", async (req, res) => {
  try {
    const { nombre, email, date, time } = req.body;
    console.log("📅 Guardando turno confirmado:", req.body);

    // Aquí guardarías en tu DB
    // Ejemplo: await Turno.create({ nombre, email, date, time });

    // Enviar email (falta integrar nodemailer o SendGrid)
    console.log(`📧 Enviar mail a ${email} confirmando turno en ${date} ${time}`);

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error al guardar turno confirmado:", error.message);
    res.status(500).json({ error: "Error al confirmar turno" });
  }
});

/* ==============================
   📌 CONFIRMACIÓN DE CURSOS
   ============================== */
router.post("/cursos-confirmados", async (req, res) => {
  try {
    const { nombre, email, curso } = req.body;
    console.log("🎓 Guardando curso confirmado:", req.body);

    // Aquí guardarías en tu DB
    // Ejemplo: await CursoInscripto.create({ nombre, email, curso });

    // Enviar email
    console.log(`📧 Enviar mail a ${email} confirmando inscripción a ${curso}`);

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error al guardar curso confirmado:", error.message);
    res.status(500).json({ error: "Error al confirmar curso" });
  }
});

export default router;
