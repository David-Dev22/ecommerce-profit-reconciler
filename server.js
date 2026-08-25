const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const initSqlJs = require('sql.js');
const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');
let json2csv;
try {
  json2csv = require('json2csv');
} catch (e) {
  json2csv = null;
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer Storage in Memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// SQLite WebAssembly Database Instance
let SQL;
let db;
const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');

/**
 * Extracts session ID from header, query, or body
 */
function getSessionId(req) {
  return String(
    req.headers['x-session-id'] || 
    req.query.sessionId || 
    req.query.session_id || 
    (req.body && (req.body.sessionId || req.body.session_id)) || 
    'default-session'
  ).trim();
}

async function initDatabase() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  if (fs.existsSync(dbPath)) {
    try {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } catch (e) {
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS sales_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      product_name TEXT DEFAULT 'Sin Nombre',
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      product_cost REAL NOT NULL,
      shipping_cost REAL NOT NULL,
      gross_income REAL NOT NULL,
      platform_fee REAL NOT NULL,
      total_cost REAL NOT NULL,
      net_profit REAL NOT NULL,
      net_margin REAL NOT NULL,
      is_loss INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_sales_session ON sales_records (session_id);`);
}

function persistDatabase() {
  if (!db) return;
  try {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (err) {
    console.error('Error persistiendo base de datos:', err);
  }
}

/**
 * Cleanup routine for expired records (> 24 hours)
 */
function cleanupOldSessions() {
  if (!db) return;
  try {
    db.run("DELETE FROM sales_records WHERE created_at < datetime('now', '-24 hours');");
    persistDatabase();
  } catch (e) {
    console.warn('Error durante purga de sesiones antiguas:', e.message);
  }
}

// Auto-cleanup every 1 hour
setInterval(cleanupOldSessions, 60 * 60 * 1000);

/**
 * Normalizes synonyms for CSV headers in Spanish and English
 */
function normalizeRow(rawRow) {
  const normalized = {};
  for (const [key, val] of Object.entries(rawRow)) {
    if (!key) continue;
    const cleanKey = key
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s_-]+/g, '');

    if (['orderid', 'orden', 'id', 'pedido', 'invoice', 'transaccion', 'transactionid'].includes(cleanKey)) {
      normalized.order_id = val;
    } else if (['productname', 'producto', 'product', 'item', 'nombre', 'descripcion', 'description', 'titulo', 'title'].includes(cleanKey)) {
      normalized.product_name = val;
    } else if (['price', 'precio', 'preciounitario', 'unitprice', 'monto', 'valor'].includes(cleanKey)) {
      normalized.price = val;
    } else if (['quantity', 'cantidad', 'qty', 'cant', 'unidades', 'count'].includes(cleanKey)) {
      normalized.quantity = val;
    } else if (['productcost', 'cost', 'costo', 'costounitario', 'unitcost', 'costoproducto', 'itemcost'].includes(cleanKey)) {
      normalized.product_cost = val;
    } else if (['shippingcost', 'shipping', 'envio', 'costoenvio', 'flete', 'shippingfee'].includes(cleanKey)) {
      normalized.shipping_cost = val;
    } else {
      normalized[cleanKey] = val;
    }
  }
  return normalized;
}

/**
 * Mathematical calculations per transaction row
 */
function calculateFinancials(rawRow, index = 1) {
  const row = normalizeRow(rawRow);

  const order_id = row.order_id ? String(row.order_id).trim() : `ORD-${String(index).padStart(4, '0')}`;
  const product_name = row.product_name ? String(row.product_name).trim() : 'Producto General';
  
  const cleanNum = (v) => {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const str = String(v).replace(/[^0-9.-]/g, '');
    return parseFloat(str) || 0;
  };

  const price = cleanNum(row.price);
  const quantity = parseInt(cleanNum(row.quantity), 10) || (price > 0 ? 1 : 0);
  const product_cost = cleanNum(row.product_cost !== undefined ? row.product_cost : (row.cost || 0));
  const shipping_cost = cleanNum(row.shipping_cost);

  // 1. Ingreso Bruto = price * quantity
  const gross_income = Math.round(((price * quantity) + Number.EPSILON) * 100) / 100;

  // 2. Comisión = (Ingreso Bruto * 0.029) + 0.30
  const platform_fee = gross_income > 0
    ? Math.round((((gross_income * 0.029) + 0.30) + Number.EPSILON) * 100) / 100
    : 0;

  // 3. Costo Total = product_cost + shipping_cost
  const total_cost = Math.round(((product_cost + shipping_cost) + Number.EPSILON) * 100) / 100;

  // 4. Ganancia Neta = Ingreso Bruto - Comisión - Costo Total
  const net_profit = Math.round(((gross_income - platform_fee - total_cost) + Number.EPSILON) * 100) / 100;

  // 5. Margen Neto (%) = (Ganancia Neta / Ingreso Bruto) * 100
  const net_margin = gross_income > 0
    ? Math.round((((net_profit / gross_income) * 100) + Number.EPSILON) * 100) / 100
    : 0;

  // 6. Alerta Pérdida: is_loss = 1 si Ganancia Neta < 0, de lo contrario 0
  const is_loss = net_profit < 0 ? 1 : 0;

  return {
    order_id,
    product_name,
    price,
    quantity,
    product_cost,
    shipping_cost,
    gross_income,
    platform_fee,
    total_cost,
    net_profit,
    net_margin,
    is_loss
  };
}

/**
 * Stream parsing of CSV buffer
 */
function parseCsvStream(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(buffer);
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

/**
 * Helper to get records filtered by sessionId
 */
function getAllRecords(sessionId) {
  const stmt = db.prepare('SELECT * FROM sales_records WHERE session_id = ? ORDER BY id ASC');
  stmt.bind([sessionId]);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * Helper to get summary statistics filtered by sessionId
 */
function getSummaryMetrics(sessionId) {
  const stmt = db.prepare(`
    SELECT 
      COALESCE(SUM(gross_income), 0) AS gross_total,
      COALESCE(SUM(platform_fee), 0) AS fee_total,
      COALESCE(SUM(net_profit), 0) AS net_total,
      COUNT(*) AS total_records,
      COALESCE(SUM(is_loss), 0) AS loss_count
    FROM sales_records
    WHERE session_id = ?
  `);
  stmt.bind([sessionId]);
  let summary = { gross_total: 0, fee_total: 0, net_total: 0, total_records: 0, loss_count: 0 };
  if (stmt.step()) {
    const obj = stmt.getAsObject();
    summary = {
      gross_total: Math.round(((obj.gross_total || 0) + Number.EPSILON) * 100) / 100,
      fee_total: Math.round(((obj.fee_total || 0) + Number.EPSILON) * 100) / 100,
      net_total: Math.round(((obj.net_total || 0) + Number.EPSILON) * 100) / 100,
      total_records: obj.total_records || 0,
      loss_count: obj.loss_count || 0
    };
  }
  stmt.free();
  return summary;
}

/**
 * Helper to save processed records for a specific session in a database transaction
 */
function saveRecordsTransaction(sessionId, records) {
  db.run('BEGIN TRANSACTION;');
  
  // Clear only current session records
  const delStmt = db.prepare('DELETE FROM sales_records WHERE session_id = ?');
  delStmt.run([sessionId]);
  delStmt.free();

  const insertStmt = db.prepare(`
    INSERT INTO sales_records (
      session_id, order_id, product_name, price, quantity, product_cost, shipping_cost,
      gross_income, platform_fee, total_cost, net_profit, net_margin, is_loss
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of records) {
    insertStmt.run([
      sessionId,
      item.order_id,
      item.product_name,
      item.price,
      item.quantity,
      item.product_cost,
      item.shipping_cost,
      item.gross_income,
      item.platform_fee,
      item.total_cost,
      item.net_profit,
      item.net_margin,
      item.is_loss
    ]);
  }
  insertStmt.free();
  db.run('COMMIT;');
  persistDatabase();
}

// -------------------------------------------------------------
// REST API Endpoints
// -------------------------------------------------------------

/**
 * GET /api/template-csv
 */
app.get('/api/template-csv', (req, res) => {
  const templateCsv = `order_id,product_name,price,quantity,product_cost,shipping_cost
ORD-1001,Ejemplo Producto Rentable,49.99,2,30.00,5.50
ORD-1002,Ejemplo Producto en Pérdida,4.50,1,5.00,2.50`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_ventas.csv"');
  return res.status(200).send(templateCsv);
});

/**
 * POST /api/upload-csv
 */
app.post('/api/upload-csv', upload.single('file'), async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se ha subido ningún archivo CSV válido.' 
      });
    }

    const parsedRows = await parseCsvStream(req.file.buffer);
    if (!parsedRows || parsedRows.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'El archivo CSV está vacío o no contiene filas legibles.' 
      });
    }

    const firstRowNorm = normalizeRow(parsedRows[0]);
    if (firstRowNorm.price === undefined && firstRowNorm.product_cost === undefined && firstRowNorm.quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'El archivo CSV no contiene columnas reconocibles de precio o costo. Por favor descarga la plantilla CSV para verificar el formato.'
      });
    }

    const calculatedRecords = parsedRows.map((row, idx) => calculateFinancials(row, idx + 1));
    saveRecordsTransaction(sessionId, calculatedRecords);

    const summary = getSummaryMetrics(sessionId);
    const records = getAllRecords(sessionId);

    res.json({
      success: true,
      message: `Se procesaron e ingresaron ${records.length} transacciones correctamente.`,
      count: records.length,
      summary,
      records
    });
  } catch (error) {
    console.error('Error en /api/upload-csv:', error);
    res.status(500).json({ success: false, message: 'Error al procesar el archivo CSV: ' + error.message });
  }
});

/**
 * POST or GET /api/load-demo
 */
const handleLoadDemo = async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const demoPath = path.join(__dirname, 'demo_sales.csv');
    if (!fs.existsSync(demoPath)) {
      return res.status(404).json({ success: false, message: 'Archivo demo_sales.csv no encontrado en el servidor.' });
    }

    const fileBuffer = fs.readFileSync(demoPath);
    const parsedRows = await parseCsvStream(fileBuffer);
    const calculatedRecords = parsedRows.map((row, idx) => calculateFinancials(row, idx + 1));

    saveRecordsTransaction(sessionId, calculatedRecords);

    const summary = getSummaryMetrics(sessionId);
    const records = getAllRecords(sessionId);

    res.json({
      success: true,
      message: `Dataset demo cargado con éxito (${records.length} transacciones).`,
      count: records.length,
      summary,
      records
    });
  } catch (error) {
    console.error('Error en /api/load-demo:', error);
    res.status(500).json({ success: false, message: 'Error al cargar datos demo: ' + error.message });
  }
};

app.post('/api/load-demo', handleLoadDemo);
app.get('/api/load-demo', handleLoadDemo);

/**
 * GET /api/records
 */
app.get('/api/records', (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const records = getAllRecords(sessionId);
    res.json(records);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/summary
 */
app.get('/api/summary', (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const summary = getSummaryMetrics(sessionId);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/export-csv
 */
app.get('/api/export-csv', (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const records = getAllRecords(sessionId);
    if (records.length === 0) {
      return res.status(400).json({ success: false, message: 'No hay datos registrados para exportar.' });
    }

    const fields = [
      'id',
      'order_id',
      'product_name',
      'price',
      'quantity',
      'product_cost',
      'shipping_cost',
      'gross_income',
      'platform_fee',
      'total_cost',
      'net_profit',
      'net_margin',
      'is_loss',
      'created_at'
    ];

    let csvOutput = '';
    if (json2csv && (json2csv.Parser || json2csv.parse)) {
      if (json2csv.Parser) {
        const parser = new json2csv.Parser({ fields });
        csvOutput = parser.parse(records);
      } else {
        csvOutput = json2csv.parse(records, { fields });
      }
    } else {
      const headers = fields.join(',');
      const rows = records.map(r => fields.map(f => `"${String(r[f] !== undefined ? r[f] : '').replace(/"/g, '""')}"`).join(','));
      csvOutput = [headers, ...rows].join('\n');
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte_conciliado.csv"');
    return res.status(200).send(csvOutput);
  } catch (error) {
    console.error('Error en /api/export-csv:', error);
    res.status(500).json({ success: false, message: 'Error al exportar CSV: ' + error.message });
  }
});

/**
 * DELETE /api/clear
 */
app.delete('/api/clear', (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const stmt = db.prepare('DELETE FROM sales_records WHERE session_id = ?');
    stmt.run([sessionId]);
    stmt.free();
    persistDatabase();
    res.json({ success: true, message: 'Tus registros han sido eliminados con éxito.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Initialize database and start server
let serverInstance;
const startPromise = initDatabase().then(() => {
  serverInstance = app.listen(PORT, () => {
    console.log(`🚀 Servidor Conciliador de Ganancias ejecutándose en http://localhost:${PORT}`);
  });
  return serverInstance;
});

module.exports = { app, startPromise, initDatabase };
