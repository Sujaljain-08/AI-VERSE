# Build stage
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libopencv-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY model_prediction/requirements-api.txt .
RUN pip install --user --no-cache-dir -r requirements-api.txt

# Runtime stage
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy Python dependencies from builder
COPY --from=builder /root/.local /root/.local

# Copy application code
COPY model_prediction/ ./model_prediction/

# Set PATH for Python packages
ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Expose port
EXPOSE 8000

# Run the application with simple startup
CMD ["python", "-m", "uvicorn", "model_prediction.api:app", "--host", "0.0.0.0", "--port", "8000"]
