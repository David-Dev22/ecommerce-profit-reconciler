# 📊 Conciliador de Ganancias E-commerce

> **Herramienta de conciliación financiera de alto rendimiento para identificar pérdidas ocultas, comisiones de pasarela y márgenes netos reales por producto.**

[![Node.js Version](https://img.shields.io/badge/Node.js-v20%2B-brightgreen.svg?logo=node.js)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL%20Mode-blue.svg?logo=sqlite)](https://www.sqlite.org/)
[![Pico.css v2](https://img.shields.io/badge/UI-Pico.css%20v2-pink.svg)](https://picocss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Deploy on Render](https://img.shields.io/badge/Render-Live%20Demo-46E3B7.svg?logo=render)](https://render.com)

---

## 💡 El Problema de Negocio

Muchos vendedores en **Shopify, Stripe, MercadoLibre, Amazon o WooCommerce** calculan sus ganancias restando únicamente el costo de adquisición del producto al precio de venta. Sin embargo, ignoran factores críticos:
- **Comisiones fijas y porcentuales de pasarelas de pago** (ej. $2.9\% + \$0.30$ USD por transacción).
- **Costos de envío y logística** asumidos en ventas de bajo valor unitario.
- **Micro-pérdidas acumulativas:** Transacciones donde el margen parece positivo en papel, pero termina en **saldo negativo** tras deducir la tarifa fija de la pasarela.

**Conciliador de Ganancias** resuelve esto ingiriendo tus reportes de ventas CSV, aplicando conciliación matemática estricta y alertando inmediatamente sobre cada transacción en pérdida.

---

## ✨ Características Principales

- 🔒 **Aislamiento Total Multi-Usuario (UUID):** Cada visitante cuenta con su propio entorno y sesión privada (`session_id`). Múltiples usuarios pueden conciliar simultáneamente sin ver ni sobreescribir los datos de otros.
- 🌐 **Soporte Bilingüe (i18n):** Interfaz completa en Español e Inglés con detección automática del idioma del navegador y selector manual en barra de navegación.
- ⚡ **Ingesta Ultra Rápida con Drag & Drop:** Procesamiento en *streaming* con `multer` y `csv-parser` mediante transacciones atómicas en SQLite.
- 🧠 **Normalización Inteligente de Cabeceras:** Acepta automáticamente sinónimos en inglés y español exportados por Shopify, MercadoLibre, WooCommerce y Stripe (`precio`/`price`, `costo`/`cost`, `envio`/`shipping`, etc.).
- 📄 **Plantilla / Molde CSV en 1 Clic:** Endpoint `/api/template-csv` y botón interactivo para descargar la plantilla con formato validado.
- 🧮 **Motor Matemático Financiero Oficial:**
  - $\text{Ingreso Bruto} = \text{Precio} \times \text{Cantidad}$
  - $\text{Comisión Pasarela} = (\text{Ingreso Bruto} \times 0.029) + 0.30$
  - $\text{Costo Total} = \text{Costo Producto} + \text{Costo Envío}$
  - $\text{Ganancia Neta} = \text{Ingreso Bruto} - \text{Comisión} - \text{Costo Total}$
  - $\text{Margen Neto (\%)} = \left(\frac{\text{Ganancia Neta}}{\text{Ingreso Bruto}}\right) \times 100$
- 🚨 **Detección Automática de Pérdidas (`is_loss`):** Resaltado visual instantáneo en rojo con badges semánticos (`⚠️ PÉRDIDA` vs `✓ RENTABLE`).
- 🔍 **Buscador en Vivo y Filtro "Solo Pérdidas":** Aísla de inmediato las operaciones en saldo negativo sin navegar fila por fila.
- 📈 **Tarjetas de KPIs Globales:** Facturación Total Bruta, Comisiones Totales Pagadas y Ganancia Neta Real consolidada.
- 💾 **Persistencia WebAssembly SQLite (`sql.js`):** Motor SQLite compilado a WebAssembly para compatibilidad 100% universal en Linux, Render, Docker y Windows sin dependencias binarias en C++.
- 📤 **Exportación de Reportes Conciliados:** Descarga en 1 clic del archivo `reporte_conciliado.csv` con todas las métricas calculadas.
- 🌓 **Interfaz Semántica Ligera:** Construida con **Pico.css v2** vía CDN (cero CSS manual) con selector de tema Claro / Oscuro automático.
- 🎯 **Modo Demo en 1 Clic:** Carga instantánea de un dataset de prueba con casos rentables y de pérdida deliberados para auditoría rápida.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Propósito |
| :--- | :--- | :--- |
| **Backend** | Node.js + Express.js | API REST rápida y middleware de procesamiento. |
| **Base de Datos** | SQLite WebAssembly (`sql.js`) | Motor relacional universal con persistencia en archivo y aislamiento por sesión. |
| **Ingesta de Datos** | `multer` + `csv-parser` | Procesamiento seguro en memoria y streaming de archivos CSV. |
| **Exportación** | `json2csv` | Generación dinámica de reportes descargables. |
| **Frontend** | HTML5 + Pico.css v2 + Vanilla JS | UI semántica, minimalista, accesible y reactiva sin frameworks pesados. |
| **Despliegue** | Render.com | Web Service con configuración `render.yaml` lista para producción. |

---

## 🚀 Inicio Rápido (Instalación Local)

### Requisitos Previos
- **Node.js:** Versión 18.0.0 o superior instalada.
- **npm:** Gestor de paquetes incluido con Node.js.

### 1. Clonar o descargar el repositorio
```bash
git clone https://github.com/David-Dev22/conciliador-de-ganancias.git
cd conciliador-de-ganancias
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Ejecutar las pruebas automatizadas
```bash
npm test
```
*Valida la suite matemática unitaria y las pruebas de integración End-to-End de todos los endpoints.*

### 4. Iniciar la aplicación
```bash
npm start
```
Abre en tu navegador: **`http://localhost:3000`**

---

## 📡 Especificación de la API REST

| Método | Endpoint | Descripción | Parámetros / Payload |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/template-csv` | Descarga el archivo de plantilla `plantilla_ventas.csv` | Ninguno |
| `POST` | `/api/upload-csv` | Sube y concilia un archivo CSV | FormData con campo `file` |
| `POST` / `GET` | `/api/load-demo` | Carga el dataset de prueba `demo_sales.csv` | Ninguno |
| `GET` | `/api/records` | Lista todas las transacciones procesadas | Ninguno |
| `GET` | `/api/summary` | Obtiene los 3 KPIs consolidados y conteo de pérdidas | Ninguno |
| `GET` | `/api/export-csv` | Descarga el archivo `reporte_conciliado.csv` | Ninguno |
| `DELETE` | `/api/clear` | Limpia los registros para reiniciar pruebas | Ninguno |

---

## 🌐 Despliegue en Render.com (Gratuito)

El repositorio incluye el archivo Infrastructure-as-Code [`render.yaml`](./render.yaml):

1. Sube este repositorio a tu cuenta de **GitHub**.
2. Ingresa a [Render.com](https://render.com/) y haz clic en **New +** -> **Blueprint**.
3. Conecta tu repositorio de GitHub.
4. Render detectará automáticamente `render.yaml` y desplegará el servicio web en minutos.

---

## 🤝 ¿Necesitas Scripts Personalizados o Integraciones?

¿Manejas flujos de venta en **Shopify, MercadoLibre, Amazon, Stripe o bases de datos custom** y necesitas automatizar la conciliación de márgenes, impuestos o facturación?

Desarrollo **micro-herramientas, APIs a medida, scrapers y bots de automatización** para e-commerce.

- 💬 **Discord:** `@david_dev22`
- 📨 **Reddit:** `u/david-dev22`
- 📧 **Email:** `maildavid22@proton.me` *(o vía mensaje directo en GitHub)*

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` para más detalles.
