#!/usr/bin/env bash
# Generate a self-signed TLS certificate for local HTTPS.
# Outputs nginx/ssl/cert.pem and nginx/ssl/key.pem
# Usage: ./scripts/generate-ssl.sh [hostname]
set -euo pipefail

HOSTNAME="${1:-localhost}"
SSL_DIR="$(cd "$(dirname "$0")/.." && pwd)/nginx/ssl"
mkdir -p "$SSL_DIR"

echo "Generating self-signed cert for: $HOSTNAME"
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$SSL_DIR/key.pem" \
  -out "$SSL_DIR/cert.pem" \
  -subj "/C=VN/ST=HCM/L=HoChiMinh/O=Homestay/CN=$HOSTNAME" \
  -addext "subjectAltName=DNS:$HOSTNAME,DNS:localhost,IP:127.0.0.1"

echo "Certificate: $SSL_DIR/cert.pem"
echo "Private key: $SSL_DIR/key.pem"
echo ""
echo "Next steps:"
echo "  1. Switch to nginx/nginx-ssl.conf (update docker-compose.yml nginx volumes)"
echo "  2. docker compose restart nginx"
echo "  3. Open https://$HOSTNAME:8443 (browsers will warn — add exception for self-signed)"
