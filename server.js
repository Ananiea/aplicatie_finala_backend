require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.use(cors({
  origin: "*", // Permitem accesul de oriunde (poți schimba cu frontend-ul tău)
  methods: "GET,POST",
  allowedHeaders: "Content-Type,Authorization"
}));

// Configurare conexiune PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Test conexiune DB
pool.connect()
  .then(() => console.log("✅ Conectat la PostgreSQL!"))
  .catch(err => console.error("❌ Eroare la conectare:", err));

// Endpoint de test pentru a verifica dacă serverul este online
app.get("/", (req, res) => {
  res.send("✅ Backend-ul funcționează!");
});

// Login cu ID
app.post("/login", async (req, res) => {
  const { id } = req.body;

  console.log(`🔹 Se încearcă login cu ID: ${id}`);

  if (!id) {
    return res.status(400).json({ message: "ID ist erforderlich!" }); // "ID-ul este necesar!"
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE unique_id = $1", [id]);

    if (result.rows.length === 0) {
      console.log("❌ ID invalid!");
      return res.status(401).json({ message: "ID invalid!" });
    }

    const token = jwt.sign({ id: result.rows[0].id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    console.log("✅ Login reușit:", result.rows[0].name);
    res.json({ token, name: result.rows[0].name });
  } catch (error) {
    console.error("❌ Eroare la login:", error);
    res.status(500).json({ message: "Eroare la autentificare!" });
  }
});

// Înregistrare tură
app.post("/add-shift", async (req, res) => {
  const { user_id, shift_number, kunde, auto, datum, start_time, end_time } = req.body;

  console.log(`🔹 Adăugare tură pentru user: ${user_id}`);

  if (!user_id || !shift_number || !kunde || !auto || !datum || !start_time || !end_time) {
    console.log("❌ Un câmp obligatoriu lipsește!");
    return res.status(400).json({ message: "Alle Felder sind erforderlich!" }); // "Toate câmpurile sunt obligatorii!"
  }

  try {
    await pool.query(
      "INSERT INTO shifts (user_id, shift_number, kunde, auto, datum, start_time, end_time) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [user_id, shift_number, kunde, auto, datum, start_time, end_time]
    );

    console.log("✅ Tură adăugată cu succes!");
    res.json({ message: "Schicht erfolgreich hinzugefügt!" }); // "Tură adăugată cu succes!"
  } catch (error) {
    console.error("❌ Eroare la adăugare:", error);
    res.status(500).json({ message: "Fehler beim Hinzufügen der Schicht!" }); // "Eroare la adăugare!"
  }
});

// Obținere ture curier
app.get("/shifts/:user_id", async (req, res) => {
  const { user_id } = req.params;

  console.log(`🔹 Cerere de ture pentru user: ${user_id}`);

  try {
    const result = await pool.query("SELECT * FROM shifts WHERE user_id = $1", [user_id]);

    console.log(`✅ ${result.rows.length} ture găsite pentru user: ${user_id}`);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Eroare la obținerea turelor:", error);
    res.status(500).json({ message: "Fehler beim Abrufen der Schichten!" }); // "Eroare la obținerea turelor!"
  }
});

// Pornim serverul
app.listen(port, () => {
  console.log(`🚀 Serverul rulează pe portul ${port}`);
});
