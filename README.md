# AI Smart Posture & Crowd Monitoring System

Full-stack AI-powered monitoring web application with posture detection (MediaPipe) and crowd detection (simulated; YOLO-ready), JWT auth, and role-based dashboards.

## Tech Stack

- **Frontend:** React 18, Vite, Bootstrap 5, Axios, React Router, Context API (Auth), Framer Motion
- **Backend:** Node.js, Express, Firebase Firestore (Admin SDK), JWT, bcrypt, Socket.io
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
│   ├── services/          # userService, postureService, crowdService
│   ├── firebase/           # Firebase Admin SDK config
│   ├── routes/
│   ├── server.js
│   ├── package.json
│   └── .env.example
└── README.md
```

## Setup

### 1. Firebase Setup

Create a Firebase project at https://console.firebase.google.com and enable Firestore Database.

**Option A: Service Account Key (Recommended)**
1. Go to Project Settings > Service Accounts
2. Click "Generate New Private Key"
3. Copy the JSON content and set it as `FIREBASE_SERVICE_ACCOUNT_KEY` in server `.env` (as a JSON string)

**Option B: Service Account File**
1. Download the service account JSON file
2. Place it in the `server` directory
3. Set `FIREBASE_SERVICE_ACCOUNT_PATH` in server `.env` to the file path

**Option C: Default Credentials (for GCP/Firebase Emulator)**
- No additional setup needed if using default credentials

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
# Edit .env: FIREBASE_SERVICE_ACCOUNT_KEY (or FIREBASE_SERVICE_ACCOUNT_PATH), JWT_SECRET, PORT (optional)
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

| Variable                      | Description                           | Default (dev)              |
|-------------------------------|---------------------------------------|----------------------------|
| PORT                          | Server port                           | 5000                       |
| JWT_SECRET                    | Secret for JWT signing                | (set in production)        |
| CLIENT_URL                    | CORS / Socket.io origin               | http://localhost:3000      |
| FIREBASE_SERVICE_ACCOUNT_KEY  | Firebase service account JSON (string)| (required)                  |
| FIREBASE_SERVICE_ACCOUNT_PATH | Alternative: path to service account file | (optional)            |

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

## Database (Firebase Firestore)

**Collections:**

- **users:** employeeId (unique), name, passwordHash, role (employee | head), score, badgeLevel, lastUpdated, createdAt
- **postureLogs:** employeeId, postureStatus (good/bad), duration, scoreAfterUpdate, eventType, timestamp
- **crowdLogs:** detectedCount, restrictedViolation, alertTriggered, recordedBy, timestamp

**Important:** User scores are updated in the same user document (not duplicated). Posture logs are separate entries for history tracking.

## Notes

- Posture monitoring runs only when the employee is on the **Posture Correction** page and has clicked **Start**; **End** stops it.
- MediaPipe Pose is loaded dynamically; if it fails (e.g. CORS/ESM), a simulated posture (random good/bad) is used.
- **Crowd detection:** If the **Python OpenCV + YOLO** service is running (`python_detector/app.py` on port 5001), the frontend uses it for accurate person detection. Otherwise it uses TensorFlow.js COCO-SSD in the browser, then simulated count. Install Python deps: `cd python_detector && pip install -r requirements.txt` (first run downloads YOLOv8 weights).
- **Alert siren:** Plays automatically on posture alert and crowd violation; allow browser audio if prompted.

# hckthon
 Full-stack AI-powered monitoring web application with posture detection (MediaPipe) and crowd detection (simulated; YOLO-ready), JWT auth, and role-based dashboards.
