"""
OpenCV + YOLO person/crowd detection API for AI Smart Monitoring.
Accepts image (base64 or multipart), returns person count and bounding boxes.
"""

import base64
import io
import os
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
from PIL import Image
import threading

try:
    import winsound
except ImportError:
    winsound = None

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"])

# YOLO model (person detection) - loaded once
model = None
CONFIDENCE_THRESHOLD = 0.5
PERSON_CLASS_ID = 0  # COCO person class in YOLO

# State tracking for zones
zone_state = {
    1: {"start_time": None, "last_count": 0},
    2: {"start_time": None, "last_count": 0},
    3: {"start_time": None, "last_count": 0},
    4: {"start_time": None, "last_count": 0},
}

is_alarm_playing = False

def get_model():
    global model
    if model is None:
        try:
            from ultralytics import YOLO
            model = YOLO("yolov8n.pt")
        except Exception as e:
            print("YOLO load error (install: pip install ultralytics):", e)
            model = False
    return model

def decode_image(data):
    if isinstance(data, str):
        if "," in data:
            data = data.split(",", 1)[1]
        raw = base64.b64decode(data)
    else:
        raw = data
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        pil = Image.open(io.BytesIO(raw))
        img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    return img

def get_zone(x, y, w, h):
    """Determine which of the 4 zones (2x2 grid) a point (x,y) belongs to."""
    if x < w / 2:
        if y < h / 2:
            return 1 # Top-Left
        else:
            return 3 # Bottom-Left
    else:
        if y < h / 2:
            return 2 # Top-Right
        else:
            return 4 # Bottom-Right

def play_alarm():
    global is_alarm_playing
    if not is_alarm_playing:
        is_alarm_playing = True
        if winsound:
            # Play a looping alarm sound
            threading.Thread(target=lambda: winsound.PlaySound("SystemHand", winsound.SND_ALIAS | winsound.SND_ASYNC | winsound.SND_LOOP), daemon=True).start()

def stop_alarm():
    global is_alarm_playing
    if is_alarm_playing:
        is_alarm_playing = False
        if winsound:
            winsound.PlaySound(None, winsound.SND_PURGE)

def process_frame_zones(img, boxes):
    """Divides frame into 4 zones, counts people, handles alert logic, and draws overlay."""
    h, w = img.shape[:2]
    zone_counts = {1: 0, 2: 0, 3: 0, 4: 0}
    
    # Assign each detected person to a zone based on centroid
    for box in boxes:
        x1, y1, bw, bh = box["bbox"]
        cx = x1 + bw / 2
        cy = y1 + bh / 2
        zone_id = get_zone(cx, cy, w, h)
        zone_counts[zone_id] += 1
        
        # Draw bounding boxes (Red)
        cv2.rectangle(img, (int(x1), int(y1)), (int(x1+bw), int(y1+bh)), (0, 0, 255), 2)
        cv2.circle(img, (int(cx), int(cy)), 4, (0, 0, 255), -1)

    # Alert Escalation Logic
    current_time = time.time()
    highest_status_val = 0 # 0=SAFE, 1=WARNING, 2=RED ALERT
    
    zone_colors = {}
    zone_status_texts = {}
    
    for z in range(1, 5):
        count = zone_counts[z]
        if count >= 2:
            # Start timer if not already started
            if zone_state[z]["start_time"] is None:
                zone_state[z]["start_time"] = current_time
            
            elapsed = current_time - zone_state[z]["start_time"]
            
            if elapsed >= 5:
                # Stage 3
                zone_colors[z] = (0, 0, 255) # Red in BGR
                zone_status_texts[z] = "RED ALERT"
                highest_status_val = max(highest_status_val, 2)
            elif elapsed >= 3:
                # Stage 2
                zone_colors[z] = (0, 0, 255) # Red Wait, user says stage 3 alarm is 5 sec, stage 2 is 3 sec
                zone_status_texts[z] = "RED ALERT"
                highest_status_val = max(highest_status_val, 2)
            else:
                # Stage 1
                zone_colors[z] = (0, 255, 255) # Yellow
                zone_status_texts[z] = "WARNING"
                highest_status_val = max(highest_status_val, 1)
        else:
            # Safe condition: less than 2
            zone_state[z]["start_time"] = None
            zone_colors[z] = (0, 255, 0) # Green
            zone_status_texts[z] = "SAFE"
    
    # Check for Stage 3 alarm conditions
    any_stage3 = any((count >= 2 and zone_state[z]["start_time"] is not None and (current_time - zone_state[z]["start_time"] >= 5)) for z, count in zone_counts.items())
    
    if any_stage3:
        play_alarm()
    else:
        # Safe overall or just warnings -> stop alarm
        stop_alarm()
        
    # Global status
    global_status = "SAFE"
    global_color = (0, 255, 0)
    if highest_status_val == 2:
        global_status = "RED ALERT"
        global_color = (0, 0, 255)
    elif highest_status_val == 1:
        global_status = "WARNING"
        global_color = (0, 255, 255)
        
    # Overlay creation
    overlay = img.copy()
    
    zones_rects = {
        1: (0, 0, int(w/2), int(h/2)),
        2: (int(w/2), 0, w, int(h/2)),
        3: (0, int(h/2), int(w/2), h),
        4: (int(w/2), int(h/2), w, h)
    }
    
    for z, (zx1, zy1, zx2, zy2) in zones_rects.items():
        color = zone_colors[z]
        cv2.rectangle(overlay, (zx1, zy1), (zx2, zy2), color, -1)
        
    # Blend overlay containing zone fill colors
    alpha = 0.25
    cv2.addWeighted(overlay, alpha, img, 1 - alpha, 0, img)
    
    # Draw Grid Lines
    cv2.line(img, (int(w/2), 0), (int(w/2), h), (255, 255, 255), 2)
    cv2.line(img, (0, int(h/2)), (w, int(h/2)), (255, 255, 255), 2)
    
    # Draw texts for each zone
    for z, (zx1, zy1, zx2, zy2) in zones_rects.items():
        cx, cy = zx1 + 10, zy1 + 30
        cv2.putText(img, f"Zone {z}", (cx, cy), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        cv2.putText(img, f"Count: {zone_counts[z]}", (cx, cy + 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        cv2.putText(img, zone_status_texts[z], (cx, cy + 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, zone_colors[z], 2)
        
    cv2.putText(img, f"STATUS: {global_status}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, global_color, 2)
    
    return img

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "detector": "opencv-yolo"})

@app.route("/detect", methods=["POST"])
def detect():
    try:
        img = None
        if request.is_json:
            data = request.get_json()
            if data and "image" in data:
                img = decode_image(data["image"])
        if img is None and request.files:
            f = request.files.get("image") or request.files.get("file")
            if f:
                img = decode_image(f.read())
        if img is None:
            return jsonify({"error": "No image provided"}), 400

        h, w = img.shape[:2]
        yolo_model = get_model()
        if yolo_model is False:
            return jsonify({"error": "YOLO model not available", "count": 0, "boxes": []}), 500

        results = yolo_model(img, conf=CONFIDENCE_THRESHOLD, verbose=False)
        count = 0
        boxes = []
        for r in results:
            if r.boxes is None:
                continue
            for box in r.boxes:
                cls_id = int(box.cls[0])
                if cls_id != PERSON_CLASS_ID:
                    continue
                count += 1
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                boxes.append({
                    "bbox": [round(x1, 1), round(y1, 1), round(x2 - x1, 1), round(y2 - y1, 1)],
                    "confidence": round(conf, 2),
                })
        
        # Process visual zones
        img = process_frame_zones(img, boxes)
        
        # Show image in an OpenCV window on the server machine
        cv2.imshow("Smart Monitoring System Focus Zones", img)
        cv2.waitKey(1)

        return jsonify({
            "count": count,
            "boxes": boxes,
            "width": w,
            "height": h,
        })
    except Exception as e:
        return jsonify({"error": str(e), "count": 0, "boxes": []}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    print(f"OpenCV+YOLO detector with 4-zone alert running on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, threaded=True)
