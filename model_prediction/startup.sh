#!/bin/bash
cd /app
python -m uvicorn model_prediction.api:app --host 0.0.0.0 --port 8000 --ssl-keyfile=/app/key.pem --ssl-certfile=/app/cert.pem
