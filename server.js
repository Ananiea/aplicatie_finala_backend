require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Configurare conexiune PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Test conexiune DB
pool.connect()
  .then(() => console.log("✅ Conectat la PostgreSQL!"))
  .catch(err => console.error("❌ Eroare la conectare:", err));

// Login cu ID
app.post("/login", async (req, res) => {
  const { id } = req.body;

  try {
    const result = await pool.query("SELECT * FROM users WHERE unique_id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "ID invalid!" });
    }

    const token = jwt.sign({ id: result.rows[0].id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.json({ token, name: result.rows[0].name });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Eroare la autentificare!" });
  }
});

// Înregistrare tură
app.post("/add-shift", async (req, res) => {
  const { user_id, shift_number, kunde, auto, datum, start_time, end_time } = req.body;

  if (!user_id || !shift_number || !kunde || !auto || !datum || !start_time || !end_time) {
    return res.status(400).json({ message: "Alle Felder sind erforderlich!" });
  }

  try {
    await pool.query(
      "INSERT INTO shifts (user_id, shift_number, kunde, auto, datum, start_time, end_time) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [user_id, shift_number, kunde, auto, datum, start_time, end_time]
    );
    res.json({ message: "Schicht erfolgreich hinzugefügt!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Fehler beim Hinzufügen der Schicht!" });
  }
});

// Obținere ture curier
app.get("/shifts/:user_id", async (req, res) => {
  const { user_id } = req.params;

  try {
    const result = await pool.query("SELECT * FROM shifts WHERE user_id = $1", [user_id]);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Fehler beim Abrufen der Schichten!" });
  }
});

app.listen(port, () => {
  console.log(`🚀 Serverul rulează pe portul ${port}`);
});
