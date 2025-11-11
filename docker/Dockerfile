# Stage 1: Build frontend
FROM node:20 AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Setup backend with frontend
FROM python:3.11-slim
WORKDIR /app

# Install backend dependencies
COPY backend/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY backend/ /app/backend

# Copy built frontend
COPY --from=frontend-builder /app/frontend/.next /app/backend/frontend/.next
COPY --from=frontend-builder /app/frontend/public /app/backend/frontend/public
COPY --from=frontend-builder /app/frontend/package.json /app/backend/frontend/package.json

EXPOSE 8000
WORKDIR /app/backend
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
