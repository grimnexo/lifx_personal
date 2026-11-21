FROM node:22-alpine AS frontend
WORKDIR /build/web
COPY web/package*.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    LIFX_DATA_DIR=/data \
    LIFX_REQUIRE_ADMIN=1 \
    PORT=8080
WORKDIR /app
COPY hl_lifx_control.py lifx_db.py ./
COPY scripts/bootstrap_user.py ./scripts/bootstrap_user.py
COPY --from=frontend /build/web/dist ./web/dist
EXPOSE 8080/tcp
CMD ["python3", "hl_lifx_control.py"]
