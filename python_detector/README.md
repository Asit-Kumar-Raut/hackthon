# Python YOLO 4-Zone Crowd Detector

This Python service provides real-time person/crowd detection using OpenCV and YOLOv8. It runs as a Flask API server that the frontend calls for accurate crowd counting, while simultaneously managing a local real-time 4-zone alert escalation monitoring window natively.

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

## Quick Start

### Option 1: Using Virtual Environment (Recommended)

**Windows:**
```powershell
cd python_detector
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

**Mac/Linux:**
```bash
cd python_detector
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

### Option 2: Direct Installation (Not Recommended)

```bash
cd python_detector
pip install -r requirements.txt
python app.py
```

## First Run

On the first run, YOLOv8 will automatically download the model file (`yolov8n.pt`) which is about 6MB. This happens automatically when you run `app.py`.

## Expected Output

When running successfully, you should see:
```
OpenCV+YOLO detector running on http://localhost:5001
 * Running on http://0.0.0.0:5001
```

## Testing the Detector

### Test Health Endpoint

Open a browser or use curl:
```bash
curl http://localhost:5001/health
```

Expected response:
```json
{"status": "ok", "detector": "opencv-yolo"}
```

### Test Detection Endpoint

The detector accepts POST requests with base64-encoded images. The frontend handles this automatically when you start crowd detection.

## Troubleshooting

### Error: "YOLO load error"

**Solution:** Install ultralytics:
```bash
pip install ultralytics
```

### Error: "No module named 'cv2'"

**Solution:** Install OpenCV:
```bash
pip install opencv-python-headless
```

### Error: "Port 5001 already in use"

**Solution:** Either:
1. Stop the process using port 5001
2. Or set a different port:
   ```bash
   set PORT=5002
   python app.py
   ```
   (Then update `vite.config.js` to proxy to port 5002)

### Model Download Issues

If YOLOv8 fails to download the model:
1. Check your internet connection
2. Try manually downloading: https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.pt
3. Place it in the `python_detector` directory

## Dependencies

- **flask**: Web framework for the API
- **flask-cors**: CORS support for frontend requests
- **opencv-python-headless**: Image processing (headless = no GUI dependencies)
- **ultralytics**: YOLOv8 model for person detection
- **Pillow**: Image handling
- **numpy**: Numerical operations

## How It Works

1. Frontend captures video frame from camera
2. Converts frame to base64 image
3. Sends POST request to `/detect` endpoint
4. Python service:
   - Decodes the image
   - Runs YOLOv8 detection
   - Filters for "person" class (class ID 0)
   - Splits rendering view into 4 specific zones using math centroid operations.
   - Monitors each quadrant. Assigns Warning Stage (Yellow) for 2+ people immediately, Red Stage (Danger) for 3 seconds of sustained crowd, and plays an Audio Alarm for 5 seconds.
   - Returns count and bounding boxes to the Web Frontend.
   - Triggers `cv2.imshow` on localhost for raw feed visibility and native `winsound` audio.
5. Frontend displays results and draws similar grid boxes natively on the HTML canvas to mirror the server's findings

## Performance

- **Model**: YOLOv8n (nano) - fastest, smallest model
- **Speed**: ~50-100ms per frame (depends on hardware)
- **Accuracy**: Good for 4-zone restricted area monitoring in typical office/indoor scenes

## Stopping the Detector

Press `Ctrl+C` in the terminal where it's running.

## Integration with Main App

The detector runs independently on port 5001. The Vite dev server (port 3000) proxies `/detector/*` requests to `http://localhost:5001`.

When the Python detector is running:
- Frontend automatically detects it via `/detector/health`
- Uses YOLO detection (most accurate)
- Falls back to TensorFlow.js if Python detector is unavailable
- Falls back to simulated detection if both fail

## Production Deployment

For production, you can:
1. Use a process manager like `pm2` or `supervisor`
2. Run as a systemd service (Linux)
3. Deploy to cloud platforms (Heroku, Railway, etc.)
4. Use Docker containerization

Example with pm2:
```bash
pm2 start app.py --name crowd-detector --interpreter python3
```
