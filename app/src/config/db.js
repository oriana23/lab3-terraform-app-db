const mysql = require('mysql2/promise');

// Configuración de conexión — variables inyectadas por la task definition de ECS
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mi_base',
  ssl: process.env.MYSQL_SSL === 'false' ? false : { rejectUnauthorized: false },
};

let pool;
let ready = false;

async function initDB() {
  // Si un intento anterior fallo a mitad de camino, cerramos ese pool antes de
  // crear uno nuevo: si no, cada reintento deja sockets colgando.
  if (pool) {
    try {
      await pool.end();
    } catch (e) {
      // El pool ya podia estar roto; no hay nada que rescatar.
    }
    pool = undefined;
  }

  ready = false;
  pool = mysql.createPool(dbConfig);

  // Crear la tabla si no existe — with pinned and category columns
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS notas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      titulo VARCHAR(255) NOT NULL,
      contenido TEXT,
      pinned BOOLEAN DEFAULT FALSE,
      category VARCHAR(20) DEFAULT 'nebula',
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add columns if upgrading from old schema
  try {
    await pool.execute(`ALTER TABLE notas ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT FALSE`);
    await pool.execute(`ALTER TABLE notas ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT 'nebula'`);
  } catch (e) {
    // Columns might already exist — ignore
  }

  ready = true;
  console.log('Tabla "notas" lista.');
}

function getPool() {
  return pool;
}

// true solo cuando initDB completo, incluida la creacion de la tabla.
function isReady() {
  return ready;
}

module.exports = { dbConfig, initDB, getPool, isReady };
