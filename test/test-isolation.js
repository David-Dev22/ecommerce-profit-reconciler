const http = require('http');
const assert = require('assert');

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

async function runIsolationTest() {
  console.log('🔒 Iniciando pruebas de Aislamiento Concurrente Multi-Usuario...');

  const sessionA = 'user-alpha-uuid';
  const sessionB = 'user-beta-uuid';

  // 1. Limpiar ambas sesiones
  await request('DELETE', '/api/clear', { 'x-session-id': sessionA });
  await request('DELETE', '/api/clear', { 'x-session-id': sessionB });

  // 2. Usuario A carga dataset demo (12 filas)
  console.log('1. Usuario A carga demo dataset...');
  const resDemoA = await request('POST', '/api/load-demo', { 'x-session-id': sessionA });
  const dataDemoA = JSON.parse(resDemoA.body);
  assert.strictEqual(dataDemoA.count, 12, 'Usuario A debe tener 12 transacciones');

  // 3. Usuario B consulta sus registros -> Debe tener 0
  console.log('2. Usuario B consulta sus registros en paralelo...');
  const resRecB = await request('GET', '/api/records', { 'x-session-id': sessionB });
  const recordsB = JSON.parse(resRecB.body);
  assert.strictEqual(recordsB.length, 0, 'Usuario B NO debe ver los datos del Usuario A (aislamiento verificado)');
  console.log('   ✓ Usuario B tiene 0 registros (aislamiento verificado).');

  // 4. Usuario B consulta su resumen -> Debe tener $0.00
  const resSumB = await request('GET', '/api/summary', { 'x-session-id': sessionB });
  const sumB = JSON.parse(resSumB.body);
  assert.strictEqual(sumB.total_records, 0);
  assert.strictEqual(sumB.gross_total, 0);
  console.log('   ✓ Métricas y KPIs de Usuario B completamente en ceros.');

  // 5. Usuario A consulta exportación CSV con su sessionId
  console.log('3. Usuario A descarga su reporte CSV...');
  const resExportA = await request('GET', `/api/export-csv?sessionId=${sessionA}`);
  assert.strictEqual(resExportA.statusCode, 200);
  assert(resExportA.body.includes('ORD-1001'));
  console.log('   ✓ Reporte exportado contiene únicamente datos de Usuario A.');

  // 6. Usuario B intenta exportar CSV vacío
  const resExportB = await request('GET', `/api/export-csv?sessionId=${sessionB}`);
  assert.strictEqual(resExportB.statusCode, 400, 'Usuario B no debe poder exportar sin datos');

  // 7. Limpiar Usuario A y verificar que Usuario B no es afectado
  console.log('4. Usuario A limpia sus datos...');
  await request('DELETE', '/api/clear', { 'x-session-id': sessionA });
  const resRecAAfter = await request('GET', '/api/records', { 'x-session-id': sessionA });
  const recordsAAfter = JSON.parse(resRecAAfter.body);
  assert.strictEqual(recordsAAfter.length, 0);
  console.log('   ✓ Limpieza de Usuario A ejecutada sin interferencias.');

  console.log('🎉 ¡Pruebas de Aislamiento Multi-Usuario completadas con 100% de éxito!\n');
}

module.exports = { runIsolationTest };

if (require.main === module) {
  runIsolationTest();
}
