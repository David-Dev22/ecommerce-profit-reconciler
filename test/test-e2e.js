const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Start the server in-process for testing
process.env.PORT = '3099';
process.env.DB_PATH = path.join(__dirname, 'test_database.db');

const server = require('../server.js');

// Helper to make HTTP requests
function request(method, pathName, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3099,
        path: pathName,
        method: method,
        headers: headers
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function runE2E() {
  console.log('🚀 Iniciando pruebas End-to-End de la API REST y Nuevas Funcionalidades...');

  // 1. Test GET /api/template-csv
  console.log('1. Probando GET /api/template-csv (Descarga de Plantilla)...');
  const templateRes = await request('GET', '/api/template-csv');
  assert.strictEqual(templateRes.statusCode, 200, 'Template status code should be 200');
  assert(templateRes.headers['content-type'].includes('text/csv'));
  assert(templateRes.body.includes('order_id,product_name,price,quantity,product_cost,shipping_cost'));
  console.log('   ✓ Plantilla CSV servida correctamente con cabeceras estándar.');

  // 2. Test POST /api/load-demo
  console.log('2. Probando POST /api/load-demo...');
  const demoRes = await request('POST', '/api/load-demo');
  assert.strictEqual(demoRes.statusCode, 200, 'Status code should be 200');
  const demoData = JSON.parse(demoRes.body);
  assert.strictEqual(demoData.success, true);
  assert.strictEqual(demoData.count, 12, 'Should load 12 demo rows');
  assert(demoData.summary.loss_count >= 3, 'Should have at least 3 loss operations');
  console.log(`   ✓ Demo cargada: ${demoData.count} transacciones, ${demoData.summary.loss_count} pérdidas.`);

  // 3. Test GET /api/summary
  console.log('3. Probando GET /api/summary...');
  const sumRes = await request('GET', '/api/summary');
  assert.strictEqual(sumRes.statusCode, 200);
  const sumData = JSON.parse(sumRes.body);
  assert.strictEqual(sumData.total_records, 12);
  assert(sumData.gross_total > 0);
  assert(sumData.fee_total > 0);
  console.log(`   ✓ Resumen verificado: Facturado $${sumData.gross_total}, Comisiones $${sumData.fee_total}, Ganancia $${sumData.net_total}`);

  // 4. Test GET /api/records
  console.log('4. Probando GET /api/records...');
  const recRes = await request('GET', '/api/records');
  assert.strictEqual(recRes.statusCode, 200);
  const records = JSON.parse(recRes.body);
  assert.strictEqual(records.length, 12);
  assert.strictEqual(records[0].order_id, 'ORD-1001');
  console.log('   ✓ Registros listados correctamente.');

  // 5. Test GET /api/export-csv
  console.log('5. Probando GET /api/export-csv...');
  const exportRes = await request('GET', '/api/export-csv');
  assert.strictEqual(exportRes.statusCode, 200);
  assert(exportRes.headers['content-type'].includes('text/csv'));
  assert(exportRes.body.includes('order_id'));
  assert(exportRes.body.includes('ORD-1001'));
  console.log('   ✓ Exportación CSV generada y validada con cabeceras.');

  // 6. Test DELETE /api/clear
  console.log('6. Probando DELETE /api/clear...');
  const clearRes = await request('DELETE', '/api/clear');
  assert.strictEqual(clearRes.statusCode, 200);
  const clearData = JSON.parse(clearRes.body);
  assert.strictEqual(clearData.success, true);

  const emptyRecRes = await request('GET', '/api/records');
  const emptyRecords = JSON.parse(emptyRecRes.body);
  assert.strictEqual(emptyRecords.length, 0, 'Database should be empty after clear');
  console.log('   ✓ Base de datos reiniciada correctamente.');

  // 7. Test Frontend Static serving
  console.log('7. Probando carga de interfaz estática GET /...');
  const htmlRes = await request('GET', '/');
  assert.strictEqual(htmlRes.statusCode, 200);
  assert(htmlRes.body.includes('Conciliador de Ganancias'));
  assert(htmlRes.body.includes('btn-lang-toggle'));
  assert(htmlRes.body.includes('pico.min.css'));
  console.log('   ✓ Frontend servido en / con soporte i18n y Pico.css v2 CDN.');

  console.log('\n🎉 ¡Todas las pruebas End-to-End se completaron satisfactoriamente!');

  // Cleanup test database
  try {
    fs.unlinkSync(path.join(__dirname, 'test_database.db'));
    fs.unlinkSync(path.join(__dirname, 'test_database.db-wal'));
    fs.unlinkSync(path.join(__dirname, 'test_database.db-shm'));
  } catch (e) {}

  process.exit(0);
}

// Give server 500ms to listen then run
setTimeout(runE2E, 500);
