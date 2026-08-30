# 🌱 Farm Tracker

A fast, touch-friendly, zero-cost web application designed for non-commercial farming and gardening to plan plantings (indoor sow, plant out, expected harvests), manage crop varieties, track beds, and sync seamlessly with Google Sheets.

---

## 🌟 Key Features

- **Dynamic Planting Calendar**:
  - Automatically calculates indoor seed starting dates, outdoor transplanting dates, direct sowing windows, and harvest windows based on your configurable Spring Last Frost and Fall First Frost dates.
- **Mobile-First & Touch-Friendly**:
  - Optimized for phones (e.g. Google Pixel), tablets, and desktops.
  - Large tap targets, bottom navigation bar on mobile, and responsive touch cards.
- **Pre-Seeded with 239 Crop Varieties**:
  - Complete agronomic defaults (days to maturity, in-row spacing, indoor lead weeks, frost tolerance).
  - Add new custom crops on the fly with the in-app **➕ New Crop** creator.
- **Multiple Timeline & Schedule Views**:
  - **📱 Schedule Cards**: 3-phase milestone stepper (Indoor Sow ➔ In-Ground ➔ Harvest Window) designed for mobile screens with zero side-scrolling.
  - **📊 12-Month Gantt Chart**: Full-year bird's-eye view of your growing season.
  - **Sort Selector**: Sort plans by Earliest Start Date, Harvest Date, Crop Name (A-Z), or Garden Bed.
- **Historical Logs Explorer**:
  - Filter and search over 3,200+ historical lifecycle logs by vegetable, variety, event type (Sow, Plant, Harvest), and bed.
- **Zero-Cost Hosting**:
  - Runs 100% free on **GitHub Pages**.
  - Progressive Web App (PWA) support for offline usage in the garden and installation to your mobile home screen.
- **Two-Way Google Sheets Sync**:
  - Built-in serverless Google Apps Script backend (`google_apps_script.js`) for 1-click cloud sync without hosting fees.

---

## 🚀 Getting Started

### Option 1: Open Locally
Double click `index.html` in any browser, or run:
```bash
python -m http.server 8080
```
Visit `http://localhost:8080` (or `http://<your-local-ip>:8080` on your phone).

### Option 2: Deploy to GitHub Pages (Free Cloud Hosting)
1. In this GitHub repository, go to **Settings** $\rightarrow$ **Pages**.
2. Under **Build and deployment** $\rightarrow$ **Branch**, select `main` and `/ (root)`, then click **Save**.
3. Your app will be live at `https://plerminiaux001-dev.github.io/farm-tracker/`.

---

## ☁️ Connecting Google Sheets

1. Create a new Google Sheet in your Google Drive (e.g. named `Farm Tracker DB`).
2. In Google Sheets, go to **Extensions** $\rightarrow$ **Apps Script**.
3. Replace the code in `Code.gs` with the code from [`google_apps_script.js`](./google_apps_script.js).
4. Click **Deploy** $\rightarrow$ **New deployment** $\rightarrow$ Select type **Web app**.
5. Set *Execute as:* **Me**, and *Who has access:* **Anyone**.
6. Copy the Web App URL and paste it into the **Settings** tab in Farm Tracker.

---

## 📁 Repository Structure

```
├── index.html              # Main application shell & touch modals
├── style.css               # Responsive design, theme variables, and mobile cards
├── script.js               # Planting engine, state store, and Google Sheets sync
├── manifest.json           # PWA configuration
├── sw.js                   # Service worker for offline caching
├── google_apps_script.js   # Google Sheets serverless backend template
└── data/
    ├── catalog.js          # 239 Pre-seeded crop varieties with agronomic defaults
    ├── history.js          # 3,264 Historical lifecycle logs
    ├── crops_and_varieties.csv
    ├── planting_lifecycle_logs.csv
    ├── seed_orders.csv
    └── seed_suppliers.csv
```

---

## 📄 License
MIT License
