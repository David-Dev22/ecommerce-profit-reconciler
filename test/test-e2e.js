const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { runIsolationTest } = require('./test-isolation.js');

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
        let data = [];
        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: buffer.toString('utf-8'),
            rawBuffer: buffer
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

  const testSession = 'test-session-e2e';

  // 1. Test GET /api/template-csv (con UTF-8 BOM)
  console.log('1. Probando GET /api/template-csv (Descarga de Plantilla CSV con UTF-8 BOM)...');
  const templateRes = await request('GET', '/api/template-csv');
  assert.strictEqual(templateRes.statusCode, 200, 'Template status code should be 200');
  assert(templateRes.headers['content-type'].includes('text/csv'));
  assert(templateRes.body.includes('order_id,product_name,price,quantity,product_cost,shipping_cost'));
  console.log('   ✓ Plantilla CSV servida correctamente con cabeceras estándar y BOM.');

  // 2. Test GET /api/template-excel (.xlsx)
  console.log('2. Probando GET /api/template-excel (Descarga de Plantilla Excel)...');
  const templateExcelRes = await request('GET', '/api/template-excel');
  assert.strictEqual(templateExcelRes.statusCode, 200);
  assert(templateExcelRes.headers['content-type'].includes('spreadsheetml.sheet'));
  assert(templateExcelRes.rawBuffer.length > 1000, 'Buffer de Excel debe ser válido');
  console.log('   ✓ Plantilla Excel (.xlsx) generada con estilos y cuadrícula.');

  // 3. Test POST /api/load-demo con Session ID
  console.log('3. Probando POST /api/load-demo...');
  const demoRes = await request('POST', '/api/load-demo', { 'x-session-id': testSession });
  assert.strictEqual(demoRes.statusCode, 200, 'Status code should be 200');
  const demoData = JSON.parse(demoRes.body);
  assert.strictEqual(demoData.success, true);
  assert.strictEqual(demoData.count, 12, 'Should load 12 demo rows');
  assert(demoData.summary.loss_count >= 3, 'Should have at least 3 loss operations');
  console.log(`   ✓ Demo cargada: ${demoData.count} transacciones, ${demoData.summary.loss_count} pérdidas.`);

  // 4. Test GET /api/summary con Session ID
  console.log('4. Probando GET /api/summary...');
  const sumRes = await request('GET', '/api/summary', { 'x-session-id': testSession });
  assert.strictEqual(sumRes.statusCode, 200);
  const sumData = JSON.parse(sumRes.body);
  assert.strictEqual(sumData.total_records, 12);
  assert(sumData.gross_total > 0);
  assert(sumData.fee_total > 0);
  console.log(`   ✓ Resumen verificado: Facturado $${sumData.gross_total}, Comisiones $${sumData.fee_total}, Ganancia $${sumData.net_total}`);

  // 5. Test GET /api/records con Session ID
  console.log('5. Probando GET /api/records...');
  const recRes = await request('GET', '/api/records', { 'x-session-id': testSession });
  assert.strictEqual(recRes.statusCode, 200);
  const records = JSON.parse(recRes.body);
  assert.strictEqual(records.length, 12);
  assert.strictEqual(records[0].order_id, 'ORD-1001');
  console.log('   ✓ Registros listados correctamente.');

  // 6. Test GET /api/export-csv con Session ID
  console.log('6. Probando GET /api/export-csv...');
  const exportRes = await request('GET', `/api/export-csv?sessionId=${testSession}`);
  assert.strictEqual(exportRes.statusCode, 200);
  assert(exportRes.headers['content-type'].includes('text/csv'));
  assert(exportRes.body.includes('order_id'));
  assert(exportRes.body.includes('ORD-1001'));
  console.log('   ✓ Exportación CSV generada y validada con UTF-8 BOM y cabeceras.');

  // 7. Test GET /api/export-excel con Session ID
  console.log('7. Probando GET /api/export-excel...');
  const exportExcelRes = await request('GET', `/api/export-excel?sessionId=${testSession}`);
  assert.strictEqual(exportExcelRes.statusCode, 200);
  assert(exportExcelRes.headers['content-type'].includes('spreadsheetml.sheet'));
  assert(exportExcelRes.rawBuffer.length > 2000, 'Buffer de reporte Excel debe ser válido');
  console.log('   ✓ Exportación Excel (.xlsx) generada con cuadrícula, colores y formato.');

  // 8. Test DELETE /api/clear con Session ID
  console.log('8. Probando DELETE /api/clear...');
  const clearRes = await request('DELETE', '/api/clear', { 'x-session-id': testSession });
  assert.strictEqual(clearRes.statusCode, 200);
  const clearData = JSON.parse(clearRes.body);
  assert.strictEqual(clearData.success, true);

  const emptyRecRes = await request('GET', '/api/records', { 'x-session-id': testSession });
  const emptyRecords = JSON.parse(emptyRecRes.body);
  assert.strictEqual(emptyRecords.length, 0, 'Database should be empty for this session after clear');
  console.log('   ✓ Base de datos de sesión reiniciada correctamente.');

  // 9. Test Frontend Static serving
  console.log('9. Probando carga de interfaz estática GET /...');
  const htmlRes = await request('GET', '/');
  assert.strictEqual(htmlRes.statusCode, 200);
  assert(htmlRes.body.includes('Conciliador de Ganancias'));
  assert(htmlRes.body.includes('btn-export-excel'));
  assert(htmlRes.body.includes('btn-download-template-excel'));
  assert(htmlRes.body.includes('pico.min.css'));
  console.log('   ✓ Frontend servido en / con soporte i18n, exportación Excel y Pico.css v2 CDN.');

  // 10. Test Isolation across concurrent users
  await runIsolationTest();

  console.log('🎉 ¡Todas las pruebas End-to-End se completaron satisfactoriamente!');

  // Cleanup test database
  try {
    fs.unlinkSync(path.join(__dirname, 'test_database.db'));
  } catch (e) {}

  process.exit(0);
}

// Give server 500ms to listen then run
setTimeout(runE2E, 500);
