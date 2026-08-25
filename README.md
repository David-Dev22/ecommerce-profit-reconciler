# 📊 E-Commerce Profit Reconciler

> **High-performance financial reconciliation tool designed to uncover hidden losses, payment gateway fees, and real net margins per item.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Render-46E3B7.svg?logo=render)](https://conciliador-de-ganancias.onrender.com)
[![Node.js Version](https://img.shields.io/badge/Node.js-v20%2B-brightgreen.svg?logo=node.js)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-WebAssembly%20(sql.js)-blue.svg?logo=sqlite)](https://www.sqlite.org/)
[![UI](https://img.shields.io/badge/UI-Pico.css%20v2-pink.svg)](https://picocss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 💡 Overview

Many sellers on **Shopify, Stripe, MercadoLibre, Amazon, or WooCommerce** calculate profits simply by subtracting product acquisition cost from sales price. However, they frequently overlook critical factors:
- **Fixed & percentage payment gateway fees** (e.g., $2.9\% + \$0.30$ USD per transaction).
- **Shipping & fulfillment expenses** assumed on lower-ticket products.
- **Cumulative micro-losses:** Orders where margin looks positive on paper, but ends up in the **red** once the fixed fee is deducted.

**E-Commerce Profit Reconciler** ingests sales CSV reports, performs strict mathematical reconciliation, isolates private sessions per visitor, and immediately flags every loss-making transaction.

🚀 **Try the live tool here:** [https://conciliador-de-ganancias.onrender.com](https://conciliador-de-ganancias.onrender.com)

---

## ✨ Key Features

- 🔒 **Full Multi-User Isolation (UUID Sessions):** Each visitor receives a dedicated private session (`session_id`). Multiple users can reconcile simultaneously without data crossover or overwriting.
- 🌐 **Bilingual Support (i18n):** Full interface in English and Spanish with auto-detection of browser language and manual switcher in the navigation bar.
- 📊 **Native Excel Export (.xlsx) & UTF-8 BOM CSV:**
  - Styled Excel spreadsheets featuring custom navy headers, cell gridlines, currency formatting (`$#,##0.00`), and soft green/red conditional highlighting.
  - CSV files encoded with UTF-8 BOM (`\uFEFF`) ensuring columns open separated cleanly in Excel on Windows/Mac without grouping into a single column.
  - Dynamically localized filenames (`reconciled_sales_report.xlsx` / `reporte_conciliado.xlsx`).
- ⚡ **Lightning-Fast Streaming Ingestion:** Memory-efficient stream parsing using `multer` and `csv-parser` with atomic SQLite transactions.
- 🧠 **Smart Header Normalization:** Automatically recognizes common column aliases exported by Shopify, MercadoLibre, WooCommerce, and Stripe in both English and Spanish (`price`/`precio`, `cost`/`costo`, `shipping`/`envio`, `quantity`/`cantidad`).
- 📄 **1-Click CSV & Excel Templates:** Downloadable templates pre-formatted to match expected structures.
- 🧮 **Standard Financial Calculation Engine:**
  - $\text{Gross Revenue} = \text{Price} \times \text{Quantity}$
  - $\text{Platform Fee} = (\text{Gross Revenue} \times 0.029) + 0.30$
  - $\text{Total Cost} = \text{Product Cost} + \text{Shipping Cost}$
  - $\text{Net Profit} = \text{Gross Revenue} - \text{Platform Fee} - \text{Total Cost}$
  - $\text{Net Margin (\%)} = \left(\frac{\text{Net Profit}}{\text{Gross Revenue}}\right) \times 100$
- 🚨 **Automated Loss Detection (`is_loss`):** Instant visual alerts with colored status badges (`⚠️ LOSS` vs `✓ PROFITABLE`).
- 🔍 **Live Search & "Losses Only" Filter:** Filter negative-margin items instantly without scrolling through hundreds of rows.
- 📈 **Real-Time KPI Dashboard:** Total Gross Revenue, Total Platform Fees Paid, and Real Consolidated Net Profit.
- 💾 **WebAssembly SQLite Engine (`sql.js`):** Pure WebAssembly relational database engine for 100% universal compatibility across Linux, Render, Docker, and Windows without native C++ compilation issues.
- 🌓 **Semantic Responsive UI:** Built with **Pico.css v2** with automatic Dark / Light mode switching.
- 🎯 **1-Click Demo Mode:** Instant sample dataset loading containing both profitable and deliberate loss scenarios for quick auditing.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend** | Node.js + Express.js | Fast REST API and processing middleware. |
| **Database** | SQLite WebAssembly (`sql.js`) | Universal relational engine with file persistence and session-level isolation. |
| **Data Ingestion** | `multer` + `csv-parser` | In-memory stream processing of uploaded CSV files. |
| **Export Engines** | `exceljs` + `json2csv` | Generating formatted `.xlsx` workbooks and UTF-8 BOM `.csv` exports. |
| **Frontend** | HTML5 + Pico.css v2 + Vanilla JS | Semantic, lightweight, accessible, and reactive UI without heavy dependencies. |

---

## 📡 REST API Specification

| Method | Endpoint | Description | Query / Headers |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/template-csv` | Download CSV template | `lang=en` or `lang=es` |
| `GET` | `/api/template-excel` | Download styled Excel (.xlsx) template | `lang=en` or `lang=es` |
| `POST` | `/api/upload-csv` | Upload and reconcile a CSV file | `x-session-id`, `FormData` with `file` |
| `POST` / `GET` | `/api/load-demo` | Load demo dataset for the active session | `x-session-id` |
| `GET` | `/api/records` | Retrieve all processed records for the session | `x-session-id` |
| `GET` | `/api/summary` | Retrieve consolidated KPIs and loss count | `x-session-id` |
| `GET` | `/api/export-excel` | Download styled Excel report (.xlsx) | `sessionId`, `lang` |
| `GET` | `/api/export-csv` | Download CSV report with UTF-8 BOM | `sessionId`, `lang` |
| `DELETE` | `/api/clear` | Clear session records | `x-session-id` |

---

## 🚀 Local Installation

### Prerequisites
- **Node.js:** Version 18.0.0 or higher.
- **npm:** Package manager included with Node.js.

### 1. Clone the repository
```bash
git clone https://github.com/David-Dev22/ecommerce-profit-reconciler.git
cd ecommerce-profit-reconciler
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run automated tests
```bash
npm test
```
*Executes unit math tests, header normalization tests, end-to-end API tests, and concurrent multi-user isolation validation.*

### 4. Start the server
```bash
npm start
```
Open your browser at **`http://localhost:3000`**.

---

## 🤝 Custom Integrations & Automation Scripts

Do you run e-commerce operations on **Shopify, MercadoLibre, Amazon, Stripe, or custom databases** and need custom tooling for reconciliation, automated invoicing, scraping, or margin auditing?

I build **tailored micro-tools, backend APIs, scrapers, and automation scripts** for e-commerce workflows.

- 📨 **Reddit:** [u/Dear_David_2026](https://reddit.com/user/Dear_David_2026)
- 📧 **Email:** `maildavid22@proton.me` *(or via direct GitHub message)*

---

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.
