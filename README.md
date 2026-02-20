# AI Smart Posture & Crowd Monitoring System

Full-stack AI-powered monitoring web application with posture detection (MediaPipe) and crowd detection (simulated; YOLO-ready), JWT auth, and role-based dashboards.

## Tech Stack

- **Frontend:** React 18, Vite, Bootstrap 5, Axios, React Router, Context API (Auth), Framer Motion
- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT, bcrypt, Socket.io
- **AI/CV:** MediaPipe (posture), TensorFlow.js COCO-SSD (person/crowd detection in browser), alert siren (Web Audio API)

## Project Structure

```
pojecthackthon/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # LogoutButton, ProtectedRoute, PostureMonitor, CrowdDetector
│   │   ├── context/       # AuthContext
│   │   ├── pages/         # Landing, Login, Register, EmployeeDashboard, HeadDashboard
│   │   ├── services/     # api.js
│   │   ├── styles/        # global.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/                 # Node backend
│   ├── controllers/
│   ├── middleware/        # auth.js, socketHandlers.js
│   ├── models/            # User, PostureLog, CrowdLog
│   ├── routes/
│   ├── server.js
│   ├── package.json
│   └── .env.example
└── README.md
```

## Setup

### 1. MongoDB

Install and run MongoDB locally, or use MongoDB Atlas and set `MONGODB_URI` in server `.env`.

### 2. (Recommended) Python OpenCV + YOLO detector

This enables **real YOLO + OpenCV** crowd/person detection.

```bash
cd python_detector
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The detector runs at `http://localhost:5001` and is proxied by Vite as `/detector/*`.

### 3. Backend

```bash
cd server
npm install
cp .env.example .env
# Edit .env: MONGODB_URI, JWT_SECRET, PORT (optional)
npm run dev
```

Server runs at `http://localhost:5000`.

### 4. Frontend

```bash
cd client
npm install
npm run dev
```

Client runs at `http://localhost:3000`. Vite proxies `/api`, `/socket.io`, and `/detector` (Python YOLO) to the backend.

### 5. Production build

```bash
# Backend
cd server && npm start

# Frontend
cd client && npm run build
# Serve client/build with any static server or point backend to it
```

## Environment (server/.env)

| Variable       | Description                    | Default (dev)              |
|----------------|--------------------------------|----------------------------|
| PORT           | Server port                    | 5000                       |
| MONGODB_URI    | MongoDB connection string      | mongodb://localhost:27017/ai-smart-monitoring |
| JWT_SECRET     | Secret for JWT signing         | (set in production)        |
| CLIENT_URL     | CORS / Socket.io origin        | http://localhost:3000     |

## Features

- **Landing:** Two buttons — Employee, Head Employee (Server).
- **Auth:** Login (Employee ID + Password), Register (employeeId, name, password, role). JWT + bcrypt.
- **Employee Dashboard:** Overview (daily score, badge, good/bad counts). **Posture Correction** page: Start / End monitoring; live webcam, posture status (Good/Bad), score, badge, history chart; alert popup + blur after 10 min bad posture; logs to API.
- **Head Dashboard:** Live camera, **person/crowd detection** in order: (1) **OpenCV + YOLO** (Python service on port 5001) if running, (2) TensorFlow.js COCO-SSD in browser, (3) simulated count; restricted-area violation, **audible alert siren**, red alert banner, **Crowd Analytics**, alert history; logs to API.
- **Alert Siren:** Web Audio API siren plays on posture alert (>10 min bad) and on crowd violation; stops when user dismisses or stops camera.
- **UI:** Black background (#000000), red borders (#FF0000), white text, red outline buttons with hover glow; responsive; Framer Motion animations.

## API Summary

| Method | Route                | Auth   | Description        |
|--------|----------------------|--------|--------------------|
| POST   | /api/auth/register    | No     | Register user      |
| POST   | /api/auth/login      | No     | Login, get JWT     |
| GET    | /api/auth/me         | Yes    | Current user       |
| GET    | /api/posture/data    | Yes    | Employee posture   |
| POST   | /api/posture/log     | Yes    | Log posture event  |
| GET    | /api/crowd/data      | Yes    | Head crowd logs    |
| POST   | /api/crowd/log       | Yes    | Log crowd event    |

## Database (MongoDB)

- **Users:** employeeId, name, password (hashed), role (employee | head).
- **PostureLogs:** employeeId, postureStatus, duration, score, eventType, timestamps.
- **CrowdLogs:** detectedCount, restrictedViolation, alertTriggered, recordedBy, timestamps.

## Notes

- Posture monitoring runs only when the employee is on the **Posture Correction** page and has clicked **Start**; **End** stops it.
- MediaPipe Pose is loaded dynamically; if it fails (e.g. CORS/ESM), a simulated posture (random good/bad) is used.
- **Crowd detection:** If the **Python OpenCV + YOLO** service is running (`python_detector/app.py` on port 5001), the frontend uses it for accurate person detection. Otherwise it uses TensorFlow.js COCO-SSD in the browser, then simulated count. Install Python deps: `cd python_detector && pip install -r requirements.txt` (first run downloads YOLOv8 weights).
- **Alert siren:** Plays automatically on posture alert and crowd violation; allow browser audio if prompted.

# hckthon
 Full-stack AI-powered monitoring web application with posture detection (MediaPipe) and crowd detection (simulated; YOLO-ready), JWT auth, and role-based dashboards.
