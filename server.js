require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const ExcelJS = require("exceljs");

const app = express();
const port = process.env.PORT || 3000;

// Configurare CORS pentru a permite frontend-ul de pe Vercel
const corsOptions = {
  origin: "*", // 🔥 TEMPORAR: permite toate originile. După ce verifici că merge, schimbă cu frontend-ul tău!
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(express.json());
app.use(cors(corsOptions));

// Configurare conexiune PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Test conexiune DB
pool.connect()
  .then(() => console.log("✅ Conectat la PostgreSQL!"))
  .catch(err => console.error("❌ Eroare la conectare:", err));

// Middleware pentru verificarea autentificării
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Acces interzis!" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Token invalid!" });

    req.user = user;
    next();
  });
};

// Login cu ID
app.post("/login", async (req, res) => {
  const { id } = req.body;

  try {
    const result = await pool.query("SELECT * FROM users WHERE unique_id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "ID invalid!" });
    }

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.json({ token, name: user.name, role: user.role });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Eroare la autentificare!" });
  }
});

// Înregistrare tură
app.post("/add-shift", authenticateToken, async (req, res) => {
  const { user_id, shift_number, kunde, auto, datum, start_time, end_time } = req.body;

  if (!user_id || !shift_number || !kunde || !auto || !datum || !start_time || !end_time) {
    return res.status(400).json({ message: "Toate câmpurile sunt obligatorii!" });
  }

  try {
    await pool.query(
      "INSERT INTO shifts (user_id, shift_number, kunde, auto, datum, start_time, end_time) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [user_id, shift_number, kunde, auto, datum, start_time, end_time]
    );
    res.json({ message: "Tură adăugată cu succes!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Eroare la adăugare!" });
  }
});

// Obținere ture curier
app.get("/shifts/:user_id", authenticateToken, async (req, res) => {
  const { user_id } = req.params;

  try {
    const result = await pool.query("SELECT * FROM shifts WHERE user_id = $1", [user_id]);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "❌ Eroare la obținerea turelor!" });
  }
});

// Export Excel (doar pentru admini)
app.get("/export", authenticateToken, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Acces interzis! Doar adminii pot exporta datele!" });
  }

  try {
    const result = await pool.query(`
      SELECT u.name, u.unique_id, s.shift_number, s.kunde, s.auto, s.datum, s.start_time, s.end_time 
      FROM shifts s
      JOIN users u ON s.user_id = u.id
      WHERE EXTRACT(MONTH FROM s.datum) = EXTRACT(MONTH FROM CURRENT_DATE)
      ORDER BY s.datum DESC;
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Nu există ture pentru această lună!" });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Ture lunare");

    worksheet.columns = [
      { header: "Nume", key: "name", width: 20 },
      { header: "ID", key: "unique_id", width: 15 },
      { header: "Ture", key: "shift_number", width: 10 },
      { header: "Kunde", key: "kunde", width: 10 },
      { header: "Auto", key: "auto", width: 15 },
      { header: "Datum", key: "datum", width: 15 },
      { header: "Start", key: "start_time", width: 10 },
      { header: "Ende", key: "end_time", width: 10 },
    ];

    result.rows.forEach(row => {
      worksheet.addRow(row);
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=ture.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Eroare la export!" });
  }
});

// Pornim serverul
app.listen(port, () => {
  console.log(`🚀 Serverul rulează pe portul ${port}`);
});
