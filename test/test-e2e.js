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
  console.log('🚀 Iniciando pruebas End-to-End con soporte de Nombres de Archivo Multilingües (ES / EN)...');

  const testSession = 'test-session-e2e';

  // 1. Test GET /api/template-csv (Español e Inglés)
  console.log('1. Probando GET /api/template-csv multilingüe...');
  const templateEs = await request('GET', '/api/template-csv?lang=es');
  assert.strictEqual(templateEs.statusCode, 200);
  assert(templateEs.headers['content-disposition'].includes('plantilla_ventas.csv'));
  assert(templateEs.body.includes('Ejemplo Producto Rentable'));

  const templateEn = await request('GET', '/api/template-csv?lang=en');
  assert.strictEqual(templateEn.statusCode, 200);
  assert(templateEn.headers['content-disposition'].includes('sales_template.csv'));
  assert(templateEn.body.includes('Sample Profitable Item'));
  console.log('   ✓ Plantillas CSV en ES ("plantilla_ventas.csv") y EN ("sales_template.csv") verificadas.');

  // 2. Test GET /api/template-excel (Español e Inglés)
  console.log('2. Probando GET /api/template-excel multilingüe...');
  const templateExcelEs = await request('GET', '/api/template-excel?lang=es');
  assert.strictEqual(templateExcelEs.statusCode, 200);
  assert(templateExcelEs.headers['content-disposition'].includes('plantilla_ventas.xlsx'));

  const templateExcelEn = await request('GET', '/api/template-excel?lang=en');
  assert.strictEqual(templateExcelEn.statusCode, 200);
  assert(templateExcelEn.headers['content-disposition'].includes('sales_template.xlsx'));
  console.log('   ✓ Plantillas Excel en ES ("plantilla_ventas.xlsx") y EN ("sales_template.xlsx") verificadas.');

  // 3. Test POST /api/load-demo con Session ID
  console.log('3. Probando POST /api/load-demo...');
  const demoRes = await request('POST', '/api/load-demo', { 'x-session-id': testSession });
  assert.strictEqual(demoRes.statusCode, 200);
  const demoData = JSON.parse(demoRes.body);
  assert.strictEqual(demoData.success, true);
  assert.strictEqual(demoData.count, 12);
  console.log(`   ✓ Demo cargada: ${demoData.count} transacciones, ${demoData.summary.loss_count} pérdidas.`);

  // 4. Test GET /api/summary con Session ID
  console.log('4. Probando GET /api/summary...');
  const sumRes = await request('GET', '/api/summary', { 'x-session-id': testSession });
  assert.strictEqual(sumRes.statusCode, 200);
  const sumData = JSON.parse(sumRes.body);
  assert.strictEqual(sumData.total_records, 12);
  console.log(`   ✓ Resumen verificado: Facturado $${sumData.gross_total}, Comisiones $${sumData.fee_total}, Ganancia $${sumData.net_total}`);

  // 5. Test GET /api/records con Session ID
  console.log('5. Probando GET /api/records...');
  const recRes = await request('GET', '/api/records', { 'x-session-id': testSession });
  assert.strictEqual(recRes.statusCode, 200);
  const records = JSON.parse(recRes.body);
  assert.strictEqual(records.length, 12);
  console.log('   ✓ Registros listados correctamente.');

  // 6. Test GET /api/export-csv (Español e Inglés)
  console.log('6. Probando GET /api/export-csv con nombres multilingües...');
  const exportCsvEs = await request('GET', `/api/export-csv?sessionId=${testSession}&lang=es`);
  assert.strictEqual(exportCsvEs.statusCode, 200);
  assert(exportCsvEs.headers['content-disposition'].includes('reporte_conciliado.csv'));

  const exportCsvEn = await request('GET', `/api/export-csv?sessionId=${testSession}&lang=en`);
  assert.strictEqual(exportCsvEn.statusCode, 200);
  assert(exportCsvEn.headers['content-disposition'].includes('reconciled_sales_report.csv'));
  console.log('   ✓ Exportación CSV en ES ("reporte_conciliado.csv") y EN ("reconciled_sales_report.csv") verificadas.');

  // 7. Test GET /api/export-excel (Español e Inglés)
  console.log('7. Probando GET /api/export-excel con nombres y headers multilingües...');
  const exportExcelEs = await request('GET', `/api/export-excel?sessionId=${testSession}&lang=es`);
  assert.strictEqual(exportExcelEs.statusCode, 200);
  assert(exportExcelEs.headers['content-disposition'].includes('reporte_conciliado.xlsx'));

  const exportExcelEn = await request('GET', `/api/export-excel?sessionId=${testSession}&lang=en`);
  assert.strictEqual(exportExcelEn.statusCode, 200);
  assert(exportExcelEn.headers['content-disposition'].includes('reconciled_sales_report.xlsx'));
  console.log('   ✓ Exportación Excel en ES ("reporte_conciliado.xlsx") y EN ("reconciled_sales_report.xlsx") verificadas.');

  // 8. Test DELETE /api/clear con Session ID
  console.log('8. Probando DELETE /api/clear...');
  const clearRes = await request('DELETE', '/api/clear', { 'x-session-id': testSession });
  assert.strictEqual(clearRes.statusCode, 200);
  const emptyRecRes = await request('GET', '/api/records', { 'x-session-id': testSession });
  const emptyRecords = JSON.parse(emptyRecRes.body);
  assert.strictEqual(emptyRecords.length, 0);
  console.log('   ✓ Base de datos de sesión reiniciada correctamente.');

  // 9. Test Frontend Static serving
  console.log('9. Probando carga de interfaz estática GET /...');
  const htmlRes = await request('GET', '/');
  assert.strictEqual(htmlRes.statusCode, 200);
  assert(htmlRes.body.includes('btn-export-excel'));
  assert(htmlRes.body.includes('btn-download-template-excel'));
  console.log('   ✓ Frontend servido en / correctamente.');

  // 10. Test Isolation across concurrent users
  await runIsolationTest();

  console.log('🎉 ¡Todas las pruebas End-to-End con soporte de idioma se completaron con 100% de éxito!');

  // Cleanup test database
  try {
    fs.unlinkSync(path.join(__dirname, 'test_database.db'));
  } catch (e) {}

  process.exit(0);
}

// Give server 500ms to listen then run
setTimeout(runE2E, 500);
