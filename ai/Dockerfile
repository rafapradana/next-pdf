# AI Service Dockerfile - Python/FastAPI
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for PyMuPDF and healthcheck
RUN apt-get update && apt-get install -y \
    libmupdf-dev \
    mupdf-tools \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Run with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
