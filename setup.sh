#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <name>"
  echo "Example: ./setup.sh joseon"
  exit 1
fi

SERVER_NAME=$1

DIR="./ssl"
PRIVATE_KEY="$DIR/${SERVER_NAME}.key"
CSR="$DIR/${SERVER_NAME}.pem"
CERTIFICATE="$DIR/${SERVER_NAME}.crt"
HASH_FILE="$DIR/${SERVER_NAME}.hash"

if [ ! -d "$DIR" ]; then
  echo "Creating $DIR directory..."
  mkdir -p "$DIR"
fi

if [ ! -f "$PRIVATE_KEY" ]; then
  echo "Generating EC private key for $SERVER_NAME..."
  openssl ecparam -name prime256v1 -genkey -noout -out "$PRIVATE_KEY"
else
  echo "EC private key for $SERVER_NAME already exists."
fi

if [ ! -f "$CSR" ]; then
  echo "Creating CSR for $SERVER_NAME..."
  openssl req -new -key "$PRIVATE_KEY" -out "$CSR" -subj "/CN=$SERVER_NAME"
else
  echo "CSR for $SERVER_NAME already exists."
fi

if [ ! -f "$CERTIFICATE" ]; then
  echo "Generating self-signed EC certificate for $SERVER_NAME..."
  openssl x509 -req -in "$CSR" -signkey "$PRIVATE_KEY" -out "$CERTIFICATE" -days 365
else
  echo "Certificate for $SERVER_NAME already exists."
fi

if [ ! -f "$HASH_FILE" ]; then
  echo "Computing SHA-256 hash of the certificate..."
  openssl x509 -in "$CERTIFICATE" -noout -sha256 -fingerprint | cut -d'=' -f2 | sed 's/://g' > "$HASH_FILE"
  echo "SHA-256 hash saved to $HASH_FILE"
else
  echo "SHA-256 hash file for $SERVER_NAME already exists."
fi

echo "SSL setup for $SERVER_NAME complete."
echo "Hash is: $(cat $HASH_FILE)"
echo "Add the following TXT record for $SERVER_NAME:"
echo ""
echo "dwc=<CERTIFICATE_HASH><IP>"
echo ""
echo "For example, where the IP is 1.1.1.1:"
echo ""
echo "dwc=$(cat $HASH_FILE)1.1.1.1"
echo ""
echo ""
echo "Finally, place your Bob Node API key to the current folder in a file called 'bob.key'."
echo ""

