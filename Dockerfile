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

# Install runtime dependencies including openssl for SSL
RUN apt-get update && apt-get install -y \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    openssl \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Generate self-signed certificate
RUN openssl req -x509 -newkey rsa:4096 -nodes -out /app/cert.pem -keyout /app/key.pem -days 365 \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=aiverse-ml.eastus.azurecontainer.io"

# Copy Python dependencies from builder
COPY --from=builder /root/.local /root/.local

# Copy application code
COPY model_prediction/ ./model_prediction/

# Make startup script executable
RUN chmod +x ./model_prediction/startup.sh

# Set PATH for Python packages
ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Expose port
EXPOSE 8000

# Run the application with SSL/TLS via startup script
CMD ["bash", "./model_prediction/startup.sh"]
