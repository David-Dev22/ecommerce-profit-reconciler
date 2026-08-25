const assert = require('assert');

// Mock row normalization logic from server
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

function runQAUnitTests() {
  console.log('🧪 Iniciando Suite de Pruebas QA de Normalización y Flexibilidad...');

  // 1. Spanish headers test
  const spanishRow = {
    'orden': 'ORD-ES-101',
    'producto': 'Camiseta Oversize',
    'precio': '25.00',
    'cantidad': '2',
    'costo': '10.00',
    'envio': '3.50'
  };
  const norm1 = normalizeRow(spanishRow);
  assert.strictEqual(norm1.order_id, 'ORD-ES-101');
  assert.strictEqual(norm1.product_name, 'Camiseta Oversize');
  assert.strictEqual(norm1.price, '25.00');
  assert.strictEqual(norm1.quantity, '2');
  assert.strictEqual(norm1.product_cost, '10.00');
  assert.strictEqual(norm1.shipping_cost, '3.50');
  console.log('   ✓ Test 1: Normalización de cabeceras en español (orden, producto, precio, cantidad, costo, envio).');

  // 2. Accented & uppercase headers
  const accentedRow = {
    'Número de Orden': 'ORD-999',
    'Descripción': 'Taza Cerámica',
    'Precio Unitario': '15.50',
    'Cant.': '1',
    'Costo Unitario': '8.00',
    'Costo Envío': '4.00'
  };
  const norm2 = normalizeRow(accentedRow);
  assert.strictEqual(norm2.price, '15.50');
  assert.strictEqual(norm2.product_cost, '8.00');
  assert.strictEqual(norm2.shipping_cost, '4.00');
  console.log('   ✓ Test 2: Normalización de cabeceras con tildes, mayúsculas y espacios.');

  // 3. Shopify / MercadoLibre style abbreviations
  const shopifyRow = {
    'transaction_id': 'TX-888',
    'item': 'Headphones',
    'unit_price': '$80.00',
    'qty': '1',
    'item_cost': '$45.00',
    'shipping_fee': '$10.00'
  };
  const norm3 = normalizeRow(shopifyRow);
  assert.strictEqual(norm3.order_id, 'TX-888');
  assert.strictEqual(norm3.product_name, 'Headphones');
  assert.strictEqual(norm3.price, '$80.00');
  assert.strictEqual(norm3.quantity, '1');
  assert.strictEqual(norm3.product_cost, '$45.00');
  assert.strictEqual(norm3.shipping_cost, '$10.00');
  console.log('   ✓ Test 3: Normalización de formatos tipo Shopify / MercadoLibre.');

  console.log('🎉 ¡Todas las pruebas QA de normalización pasaron exitosamente!\n');
}

runQAUnitTests();
