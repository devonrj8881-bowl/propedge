#!/bin/bash
# Backward-compatible wrapper. The old deploy-prod.sh hid CLI output and could
# look like it was hanging. Use the fixed streaming deploy instead.

set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/deploy-with-token.sh"
