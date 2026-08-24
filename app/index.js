const express = require('express');
const path = require('path');
const { initDB } = require('./src/config/db');
const notasRouter = require('./src/routes/notas');
  
const app = express();
const PORT = process.env.PORT || 3000;
 
// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files (CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));
 
// Routes
app.use('/', notasRouter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Iniciar
const connectWithRetry = async (retries = 5, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      await initDB();
      return;
    } catch (err) {
      console.error(`Intento ${i + 1}/${retries} fallido: ${err.message}`);
      if (i < retries - 1) {
        console.log(`Reintentando en ${delay / 1000}s...`);
        await new Promise(res => setTimeout(res, delay));
      } else {
        console.error('No se pudo conectar a MySQL después de varios intentos.');
        process.exit(1);
      }
    }
  }
};

app.listen(PORT, '0.0.0.0', () => {
  console.log(`App corriendo en http://localhost:${PORT}`);
});
connectWithRetry();
