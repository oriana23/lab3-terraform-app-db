const express = require('express');
const path = require('path');
const { initDB, isReady } = require('./src/config/db');
const notasRouter = require('./src/routes/notas');
   
const app = express();
const PORT = process.env.PORT || 3000;
   
// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
  
// Serve static files (CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));
 
// Liveness: responde 200 mientras el proceso este vivo, sin tocar la DB.
// Es el path que chequea el ALB. Deliberadamente NO depende de MySQL: si lo
// hiciera, un hipo de la DB tumbaria el target group y haria fallar el deploy
// blue/green, que es exactamente lo que queremos evitar.
//
// Tiene que ir ANTES de montar notasRouter: ese router esta montado en '/' y
// su guarda de "DB no lista" devuelve 503 para todo lo que le llegue, health
// incluido.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Readiness: si depende de la DB. Sirve para diagnostico y para saber si la
// app ya puede atender trafico util. No lo apuntes desde el health check del
// target group (ver comentario de arriba).
app.get('/ready', (req, res) => {
  if (isReady()) {
    return res.status(200).json({ status: 'ready', db: 'up' });
  }
  res.status(503).json({ status: 'not-ready', db: 'down' });
});

// Routes
app.use('/', notasRouter);

// Reintenta para siempre con backoff exponencial (5s -> 30s tope). El proceso
// nunca se mata por no alcanzar la DB: se queda sirviendo /health y se
// reconecta solo cuando MySQL vuelve. Que MySQL tarde en levantar pasa a ser
// un arranque degradado y temporal en vez de un deploy fallido.
const connectWithRetry = async (initialDelay = 5000, maxDelay = 30000) => {
  let delay = initialDelay;
  for (let intento = 1; ; intento++) {
    try {
      await initDB();
      console.log(`Conectado a MySQL (intento ${intento}).`);
      return;
    } catch (err) {
      console.error(`Intento ${intento} fallido: ${err.message}`);
      console.log(`Reintentando en ${delay / 1000}s...`);
      await new Promise(res => setTimeout(res, delay));
      delay = Math.min(delay * 2, maxDelay);
    }
  }
};

app.listen(PORT, '0.0.0.0', () => {
  console.log(`App corriendo en http://localhost:${PORT}`);
});
connectWithRetry();
