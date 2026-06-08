#!/bin/bash
set -e

echo "🌐 Cloudflare Tunnel Setup for Ollama"
echo "========================================"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Step 1: Install cloudflared
echo -e "${BLUE}[1/5]${NC} Installing cloudflared..."
if ! command -v cloudflared &> /dev/null; then
  brew install cloudflare/cloudflare/cloudflared
  echo -e "${GREEN}✓ cloudflared installed${NC}"
else
  echo -e "${GREEN}✓ cloudflared already installed${NC}"
fi

# Step 2: Authenticate
echo -e "${BLUE}[2/5]${NC} Authenticating with Cloudflare..."
if [ ! -f ~/.cloudflared/cert.pem ]; then
  cloudflared tunnel login
  echo -e "${GREEN}✓ Authenticated${NC}"
else
  echo -e "${GREEN}✓ Already authenticated${NC}"
fi

# Step 3: Create tunnel
echo -e "${BLUE}[3/5]${NC} Creating tunnel 'ollama'..."
TUNNEL_NAME="ollama"
TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "ollama" | awk '{print $1}' || echo "")

if [ -z "$TUNNEL_ID" ]; then
  cloudflared tunnel create $TUNNEL_NAME
  TUNNEL_ID=$(cloudflared tunnel list | grep "ollama" | awk '{print $1}')
  echo -e "${GREEN}✓ Tunnel created: $TUNNEL_ID${NC}"
else
  echo -e "${GREEN}✓ Tunnel already exists: $TUNNEL_ID${NC}"
fi

# Step 4: Setup config file & DNS
echo -e "${BLUE}[4/5]${NC} Setting up Cloudflare config..."
read -p "Enter your domain (e.g., example.com): " DOMAIN
read -p "Enter subdomain for Ollama (default: ollama): " SUBDOMAIN
SUBDOMAIN=${SUBDOMAIN:-ollama}
OLLAMA_URL="$SUBDOMAIN.$DOMAIN"

CREDS_FILE=$(ls ~/.cloudflared/*.json 2>/dev/null | head -1)
if [ -z "$CREDS_FILE" ]; then
  echo -e "${YELLOW}⚠ Credentials file not found${NC}"
  CREDS_UUID="UUID_FROM_TUNNEL_CREATION"
else
  CREDS_UUID=$(basename $CREDS_FILE .json)
fi

cat > ~/.cloudflared/config.yml <<EOF
tunnel: $TUNNEL_ID
credentials-file: ~/.cloudflared/$CREDS_UUID.json

ingress:
  - hostname: $OLLAMA_URL
    service: http://localhost:11434
  - service: http_status:404
EOF

cloudflared tunnel route dns $TUNNEL_ID $OLLAMA_URL
echo -e "${GREEN}✓ Config created and DNS routed${NC}"

# Step 5: Save tunnel URL for later
echo -e "${BLUE}[5/5]${NC} Saving tunnel URL..."
echo "export OLLAMA_TUNNEL_URL='https://$OLLAMA_URL'" > /tmp/ollama-tunnel-info.sh
echo -e "${GREEN}✓ Tunnel URL saved: https://$OLLAMA_URL${NC}"

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo -e "${BLUE}Your Ollama tunnel URL:${NC} https://$OLLAMA_URL"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Start tunnel in separate terminal:"
echo "   ${BLUE}cloudflared tunnel run ollama${NC}"
echo ""
echo "2. Keep Ollama running in another terminal:"
echo "   ${BLUE}ollama serve${NC}"
echo ""
echo "3. Update serverless function with tunnel URL"
echo "   Run: ${BLUE}./update-serverless-tunnel.sh https://$OLLAMA_URL${NC}"
echo ""
echo "4. Test at: ${BLUE}https://propedgemasters.netlify.app${NC}"
