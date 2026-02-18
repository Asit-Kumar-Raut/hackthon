# Run AI Smart Monitoring: Python detector, Node server, Vite client
# Usage: .\run-all.ps1
# Ensure MongoDB is running first.

$root = $PSScriptRoot

Write-Host "Starting Python OpenCV+YOLO detector on port 5001..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\python_detector'; if (Test-Path .venv) { .\.venv\Scripts\Activate.ps1 } else { python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r requirements.txt }; python app.py"

Start-Sleep -Seconds 3

Write-Host "Starting Node server on port 5000..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\server'; node server.js"

Start-Sleep -Seconds 2

Write-Host "Starting Vite client on port 3000..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\client'; npm run dev"

Write-Host "Done. Open http://localhost:3000"
