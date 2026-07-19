# ⚡ Smart Electricity Complaint Assistant (SECA)

**SECA** is a highly polished, production-grade AI web application designed to help Indian electricity consumers report power outages, hazard events (sparking transformers, broken poles, hanging wires), and billing discrepancies directly to regional utility control boards. 

Powered by **Gemini 2.5 Flash**, SECA features automated Hindi/English multi-lingual voice transcriptions, visual hazard image diagnostics, automatic duplicates detection, dynamic GPS radar feeds, real-time workload-dispatch systems, and interactive power-grid analytics.

---

## 🎨 Architectural Design & Technical Stack

The application employs a robust **Vite + Express Full-Stack** single-container model built for high availability and low latency.

```
+------------------------------------------------------------------------+
|                              REACT SPA (VITE)                          |
|  - Modern Indian Utility Accent UI (Saffron, Navy Blue, Ash Green)     |
|  - VoiceRecorder (Visual Audio Waveforms, Multilingual Ingestion)      |
|  - ImageViewer (Visual Damage Lightboxes)                              |
|  - LocationPicker (Browser GPS Ingestion & Coordinate Radar)           |
|  - AnalyticsCharts (Responsive Recharts)                               |
+------------------------------------------------------------------------+
                                   | (JSON / API Calls)
                                   v
+------------------------------------------------------------------------+
|                            EXPRESS BACKEND                             |
|  - Server-Side Gemini API Proxy (Keeps API keys strictly hidden)       |
|  - Relational Database Controllers (CRUD for grid complaints)          |
|  - Role-Based Middlewares (Consumer, Engineer, Admin Access)           |
+------------------------------------------------------------------------+
                                   | (Persistent Storage)
                                   v
+------------------------------------------------------------------------+
|                          POSTGRESQL / SUPABASE                         |
|  - Users, Engineers, Complaints, Logs, Notifications, Analytics       |
|  - Row-Level Security (RLS) & Audit Change Trigger Logging             |
+------------------------------------------------------------------------+
```

### ⚡ Key Features

1. **Voice Complaint Ingestion (`/src/components/VoiceRecorder.tsx`)**
   * Capture speech dynamically. Renders high-fidelity audio waves and communicates with Gemini to transcribe Hindi, English, and regional dialects instantly.
2. **AI Vision Damage Diagnostics (`/src/components/ImageViewer.tsx`)**
   * Seamless drag-and-drop imagery of burnt meters, fallen tree branches, or transformer sparks. Performs structural analysis to output damage severity index, responses priority, and dispatch department.
3. **Emergency safety Protocols**
   * Automatically displays custom, immediate safety steps for citizens based on AI findings (e.g. *“Maintain a 10-meter clearance from wet, conductive hanging wires!”*).
4. **Interactive GIS Radar (`/src/components/LocationPicker.tsx`)**
   * Captures precise latitudinal and longitudinal coordinates using standard GPS, displaying location division markers and active lineman circles.
5. **Role-Based Workloads (Consumer / Lineman / Admin)**
   * **Consumers** can track past logs, file reports, and view audit timelines.
   * **Field Linemen** are assigned to tasks nearby and update action logs directly.
   * **Admins** manage workloads, delete tickets, assign technicians, and evaluate analytics.

---

## 📂 Project Directory Structure

```
├── .env.example                # Standard environment variables reference
├── Dockerfile                  # Multi-stage production container instructions
├── docker-compose.yml          # Container orchestration (Node app, Postgres, Redis)
├── vercel.json                 # Serverless deployment configuration
├── package.json                # Project dependencies and deployment scripts
├── server.ts                   # Express server entrypoint & API Controllers
├── src/
│   ├── main.tsx                # Client entrypoint
│   ├── App.tsx                 # Core Router, State Engine, and Layout Views
│   ├── types.ts                # TypeScript interfaces, enums, and types
│   ├── index.css               # Global tailwind styles, fonts, and animation specs
│   ├── components/
│   │   ├── Navbar.tsx          # Dynamic notification hub & theme toggles
│   │   ├── Sidebar.tsx         # Role-based workspace drawer navigation
│   │   ├── VoiceRecorder.tsx   # Waveform voice visualizer & transcript recorder
│   │   ├── ImageViewer.tsx     # Damage image dropzone & lightbox popup
│   │   ├── LocationPicker.tsx  # GPS coordinate locking & GIS vector radar
│   │   ├── AnalyticsCharts.tsx # High-fidelity Recharts graphs
│   │   ├── ComplaintCard.tsx   # Grid complaint summaries & hazard priority rings
│   │   └── ComplaintTimeline.tsx # Vertical, real-time audit checkpoint logs
│   └── db/
│       ├── dbStore.ts          # In-memory mock engine with seeds for local testing
│       └── supabase-schema.sql # Complete PostgreSQL DDL, index, RLS, & trigger rules
```

---

## 🚀 Getting Started

### 1. Local Development
First, verify you have **Node.js (v18+)** installed.

```bash
# Clone the workspace and install packages
npm install

# Set up your environment credentials
cp .env.example .env
# Edit .env and supply your GEMINI_API_KEY

# Boot the Express + Vite full-stack dev server
npm run dev
```
Open **`http://localhost:3000`** in your browser. The server handles both React HMR and Backend API endpoints in a unified loop.

### 2. Multi-Container Orchestration (Docker Compose)
To run the full production grid locally (including the Express app, a persistent PostgreSQL database, and a Redis queue broker):

```bash
# Spin up the container cluster
docker-compose up --build
```
This loads your database, deploys the PostgreSQL database tables, and exposes the entrypoint at `http://localhost:3000`.

### 3. Manual Production Compilation
To compile, package, and start the applet manually in production:

```bash
# Bundles client assets and compiles server.ts to dist/server.cjs
npm run build

# Runs the compiled CommonJS server via standalone Node
npm run start
```

---

## 🗄️ Relational Database Schema (`/src/db/supabase-schema.sql`)
SECA uses a highly structured relational database schema built for high volume.
* **`users`**: Customer data, connection IDs, and regional district.
* **`complaints`**: Primary ticket registry storing descriptions, GPS cords, category, and AI audits.
* **`engineers`**: Assigned lineman database with active task loads.
* **`status_logs`**: Action-audit logs created dynamically by a **PostgreSQL trigger** on status change.
* **`notifications`**: Targeted alerts regarding engineer dispatch and resolutions.

---

## ⚡ Role-Based Quick Testing (AI Studio Sandbox)
To make previewing and evaluating simple for engineers, the login screen includes **one-click role logins** that auto-fill authenticated sessions:
* 👤 **Rajesh Kumar (Consumer View)**: File power outage complaints, speak detailed descriptions, and monitor logs.
* 🛠️ **Amit Sharma (Lineman View)**: Inspect assigned overhead tasks, write fix summaries, and update status.
* 🏢 **Er. Sanjay Patil (Executive Admin View)**: Track team capacity, review real-time KPI graphs, and dispatch field technicians.
