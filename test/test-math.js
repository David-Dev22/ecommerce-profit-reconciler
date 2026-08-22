const assert = require('assert');

/**
 * Mathematical calculations per transaction row (Mirroring server.js logic)
 */
function calculateFinancials(price, quantity, product_cost, shipping_cost) {
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

  // 6. Flag Alerta Pérdida
  const is_loss = net_profit < 0 ? 1 : 0;

  return { gross_income, platform_fee, total_cost, net_profit, net_margin, is_loss };
}

console.log('🧪 Iniciando Suite de Pruebas Matemáticas QA...\n');

// Test 1: Operación con Ganancia Positiva Estándar
// price=49.99, quantity=2, product_cost=30.00, shipping_cost=5.50
// gross = 99.98
// platform_fee = 99.98 * 0.029 + 0.30 = 2.89942 + 0.30 = 3.19942 -> 3.20
// total_cost = 35.50
// net_profit = 99.98 - 3.20 - 35.50 = 61.28
// net_margin = (61.28 / 99.98) * 100 = 61.29%
// is_loss = 0
const t1 = calculateFinancials(49.99, 2, 30.00, 5.50);
assert.strictEqual(t1.gross_income, 99.98, 'T1: Gross income mismatch');
assert.strictEqual(t1.platform_fee, 3.20, 'T1: Platform fee mismatch');
assert.strictEqual(t1.total_cost, 35.50, 'T1: Total cost mismatch');
assert.strictEqual(t1.net_profit, 61.28, 'T1: Net profit mismatch');
assert.strictEqual(t1.net_margin, 61.29, 'T1: Net margin mismatch');
assert.strictEqual(t1.is_loss, 0, 'T1: Expected profitable transaction (is_loss = 0)');
console.log('✅ Test 1 Superado: Transacción estándar rentable calculada con precisión.');

// Test 2: Operación en Pérdida (Costo del producto + envío superan el precio de venta)
// price=4.50, quantity=1, product_cost=5.00, shipping_cost=2.50
// gross = 4.50
// platform_fee = 4.50 * 0.029 + 0.30 = 0.1305 + 0.30 = 0.4305 -> 0.43
// total_cost = 7.50
// net_profit = 4.50 - 0.43 - 7.50 = -3.43
// net_margin = (-3.43 / 4.50) * 100 = -76.22%
// is_loss = 1
const t2 = calculateFinancials(4.50, 1, 5.00, 2.50);
assert.strictEqual(t2.gross_income, 4.50, 'T2: Gross income mismatch');
assert.strictEqual(t2.platform_fee, 0.43, 'T2: Platform fee mismatch');
assert.strictEqual(t2.total_cost, 7.50, 'T2: Total cost mismatch');
assert.strictEqual(t2.net_profit, -3.43, 'T2: Net profit mismatch');
assert.strictEqual(t2.net_margin, -76.22, 'T2: Net margin mismatch');
assert.strictEqual(t2.is_loss, 1, 'T2: Expected loss transaction (is_loss = 1)');
console.log('✅ Test 2 Superado: Detección precisa de transacción con pérdida por costos.');

// Test 3: Operación en Pérdida por Impacto de Tarifa Fija de Pasarela ($0.30 + %)
// price=2.99, quantity=1, product_cost=2.80, shipping_cost=1.50
// gross = 2.99
// platform_fee = 2.99 * 0.029 + 0.30 = 0.08671 + 0.30 = 0.38671 -> 0.39
// total_cost = 4.30
// net_profit = 2.99 - 0.39 - 4.30 = -1.70
// is_loss = 1
const t3 = calculateFinancials(2.99, 1, 2.80, 1.50);
assert.strictEqual(t3.net_profit, -1.70, 'T3: Net profit mismatch');
assert.strictEqual(t3.is_loss, 1, 'T3: Expected loss transaction (is_loss = 1)');
console.log('✅ Test 3 Superado: Detección de pérdida inducida por comisiones de pasarela.');

// Test 4: Caso Borde - Ingreso Bruto 0
const t4 = calculateFinancials(0, 0, 0, 0);
assert.strictEqual(t4.gross_income, 0, 'T4: Gross should be 0');
assert.strictEqual(t4.platform_fee, 0, 'T4: Fee should be 0');
assert.strictEqual(t4.net_margin, 0, 'T4: Margin should avoid division by zero and return 0');
assert.strictEqual(t4.is_loss, 0, 'T4: is_loss should be 0 for zero transaction');
console.log('✅ Test 4 Superado: Protección contra división por cero en margen porcentual.');

console.log('\n🎉 ¡Todos los 4 casos de prueba matemática pasaron con 100% de éxito!');
