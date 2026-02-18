"""
OpenCV + YOLO person/crowd detection API for AI Smart Monitoring.
Accepts image (base64 or multipart), returns person count and bounding boxes.
"""

import base64
import io
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
from PIL import Image

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"])

# YOLO model (person detection) - loaded once
model = None
CONFIDENCE_THRESHOLD = 0.5
PERSON_CLASS_ID = 0  # COCO person class in YOLO


def get_model():
    global model
    if model is None:
        try:
            from ultralytics import YOLO
            # YOLOv8n is small and fast; downloads on first run
            model = YOLO("yolov8n.pt")
        except Exception as e:
            print("YOLO load error (install: pip install ultralytics):", e)
            model = False
    return model


def decode_image(data):
    """Decode image from base64 string or bytes."""
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


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "detector": "opencv-yolo"})


@app.route("/detect", methods=["POST"])
def detect():
    """Accept JSON { image: base64 } or form file. Return { count, boxes }."""
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
    print(f"OpenCV+YOLO detector running on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, threaded=True)
