const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const Database = require('better-sqlite3');
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

// SQLite Database Setup
const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialize sales_records Table
db.exec(`
  CREATE TABLE IF NOT EXISTS sales_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

/**
 * Mathematical calculations per transaction row
 */
function calculateFinancials(row, index = 1) {
  const order_id = row.order_id ? String(row.order_id).trim() : `ORD-${String(index).padStart(4, '0')}`;
  const product_name = row.product_name ? String(row.product_name).trim() : 'Producto General';
  const price = parseFloat(row.price) || 0;
  const quantity = parseInt(row.quantity, 10) || 0;
  
  // Cost breakdown
  const product_cost = parseFloat(row.product_cost !== undefined ? row.product_cost : (row.cost || 0)) || 0;
  const shipping_cost = parseFloat(row.shipping_cost) || 0;

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
 * Helper to get summary statistics from database
 */
function getSummaryMetrics() {
  const summary = db.prepare(`
    SELECT 
      COALESCE(SUM(gross_income), 0) AS gross_total,
      COALESCE(SUM(platform_fee), 0) AS fee_total,
      COALESCE(SUM(net_profit), 0) AS net_total,
      COUNT(*) AS total_records,
      COALESCE(SUM(is_loss), 0) AS loss_count
    FROM sales_records
  `).get();

  return {
    gross_total: Math.round((summary.gross_total + Number.EPSILON) * 100) / 100,
    fee_total: Math.round((summary.fee_total + Number.EPSILON) * 100) / 100,
    net_total: Math.round((summary.net_total + Number.EPSILON) * 100) / 100,
    total_records: summary.total_records,
    loss_count: summary.loss_count
  };
}

/**
 * Helper to save processed records in a database transaction
 */
function saveRecordsTransaction(records) {
  const insertStmt = db.prepare(`
    INSERT INTO sales_records (
      order_id, product_name, price, quantity, product_cost, shipping_cost,
      gross_income, platform_fee, total_cost, net_profit, net_margin, is_loss
    ) VALUES (
      @order_id, @product_name, @price, @quantity, @product_cost, @shipping_cost,
      @gross_income, @platform_fee, @total_cost, @net_profit, @net_margin, @is_loss
    )
  `);

  const insertMany = db.transaction((items) => {
    // Clean old records
    db.prepare('DELETE FROM sales_records').run();
    // Insert new calculated records
    for (const item of items) {
      insertStmt.run(item);
    }
  });

  insertMany(records);
}

// -------------------------------------------------------------
// REST API Endpoints
// -------------------------------------------------------------

/**
 * POST /api/upload-csv
 * Uploads user CSV, cleans database, calculates financials, inserts records, returns summary and records
 */
app.post('/api/upload-csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'No se ha subido ningún archivo CSV válido.' });
    }

    const parsedRows = await parseCsvStream(req.file.buffer);
    if (!parsedRows || parsedRows.length === 0) {
      return res.status(400).json({ success: false, message: 'El archivo CSV está vacío o no contiene filas legibles.' });
    }

    const calculatedRecords = parsedRows.map((row, idx) => calculateFinancials(row, idx + 1));
    saveRecordsTransaction(calculatedRecords);

    const summary = getSummaryMetrics();
    const records = db.prepare('SELECT * FROM sales_records ORDER BY id ASC').all();

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
 * Loads local demo_sales.csv, replaces database records, returns summary and records
 */
const handleLoadDemo = async (req, res) => {
  try {
    const demoPath = path.join(__dirname, 'demo_sales.csv');
    if (!fs.existsSync(demoPath)) {
      return res.status(404).json({ success: false, message: 'Archivo demo_sales.csv no encontrado en el servidor.' });
    }

    const fileBuffer = fs.readFileSync(demoPath);
    const parsedRows = await parseCsvStream(fileBuffer);
    const calculatedRecords = parsedRows.map((row, idx) => calculateFinancials(row, idx + 1));

    saveRecordsTransaction(calculatedRecords);

    const summary = getSummaryMetrics();
    const records = db.prepare('SELECT * FROM sales_records ORDER BY id ASC').all();

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
 * Returns list of stored transaction records
 */
app.get('/api/records', (req, res) => {
  try {
    const records = db.prepare('SELECT * FROM sales_records ORDER BY id ASC').all();
    res.json(records);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/summary
 * Returns global KPI summary metrics
 */
app.get('/api/summary', (req, res) => {
  try {
    const summary = getSummaryMetrics();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/export-csv
 * Generates and downloads reporte_conciliado.csv with all calculated fields
 */
app.get('/api/export-csv', (req, res) => {
  try {
    const records = db.prepare('SELECT * FROM sales_records ORDER BY id ASC').all();
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
      // Direct CSV formatting fallback
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
 * Clears table records for testing purposes
 */
app.delete('/api/clear', (req, res) => {
  try {
    db.prepare('DELETE FROM sales_records').run();
    res.json({ success: true, message: 'Todos los registros han sido eliminados con éxito.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Servidor Conciliador de Ganancias ejecutándose en http://localhost:${PORT}`);
});
