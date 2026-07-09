#!/usr/bin/env bash
#
# deploy.sh — Deploy LizaAlert Searcher Map to Yandex Cloud Object Storage
#
# Usage:
#   ./deploy.sh              # Deploy using .env file
#   ./deploy.sh --dry-run    # Preview what will be uploaded
#   ./deploy.sh --help       # Show help
#
# Prerequisites:
#   - aws-cli installed (pip install awscli or apt install awscli)
#   - .env file with Yandex Cloud Object Storage credentials
#   - The bucket must already exist in Yandex Cloud
#
# After deployment, configure the bucket for static website hosting:
#   yc storage bucket update <bucket-name> \
#     --website-index index.html \
#     --website-error index.html
#
# Or via Yandex Cloud Console → Object Storage → <bucket> → Website.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ─── Colors ────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ─── Help ──────────────────────────────────────────────────────────────────
show_help() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Deploy the LizaAlert Searcher Map to Yandex Cloud Object Storage.

Options:
  --dry-run    List files that would be uploaded without actually uploading
  --help       Show this help message and exit

Environment variables (can be set in .env file):
  YC_STORAGE_ACCESS_KEY_ID       Service account static access key
  YC_STORAGE_SECRET_ACCESS_KEY   Service account static secret key
  YC_STORAGE_BUCKET              Object Storage bucket name
  YC_STORAGE_ENDPOINT            S3 endpoint (default: https://storage.yandexcloud.net)
  YC_STORAGE_REGION              Region (default: us-east-1)
  SOURCE_DIR                     Local directory to upload (default: ./src)

Example:
  # Create .env from template and fill in credentials
  cp .env.example .env
  vi .env

  # Deploy
  ./deploy.sh

  # Dry run first
  ./deploy.sh --dry-run
EOF
    exit 0
}

# ─── Parse arguments ───────────────────────────────────────────────────────
DRY_RUN=false
for arg in "$@"; do
    case "$arg" in
        --help) show_help ;;
        --dry-run) DRY_RUN=true ;;
        *)
            echo -e "${RED}Unknown option: $arg${NC}"
            show_help
            ;;
    esac
done

# ─── Load .env ─────────────────────────────────────────────────────────────
if [ -f "$SCRIPT_DIR/.env" ]; then
    echo -e "${CYAN}Loading .env file...${NC}"
    set -a
    # shellcheck source=/dev/null
    source "$SCRIPT_DIR/.env"
    set +a
else
    echo -e "${YELLOW}Warning: .env file not found. Using environment variables or defaults.${NC}"
fi

# ─── Validate required variables ───────────────────────────────────────────
: "${YC_STORAGE_ACCESS_KEY_ID:?Missing YC_STORAGE_ACCESS_KEY_ID — set in .env}"
: "${YC_STORAGE_SECRET_ACCESS_KEY:?Missing YC_STORAGE_SECRET_ACCESS_KEY — set in .env}"
: "${YC_STORAGE_BUCKET:?Missing YC_STORAGE_BUCKET — set in .env}"

YC_STORAGE_ENDPOINT="${YC_STORAGE_ENDPOINT:-https://storage.yandexcloud.net}"
YC_STORAGE_REGION="${YC_STORAGE_REGION:-us-east-1}"
SOURCE_DIR="${SOURCE_DIR:-$SCRIPT_DIR/src}"

# ─── Check source directory ────────────────────────────────────────────────
if [ ! -d "$SOURCE_DIR" ]; then
    echo -e "${RED}Error: Source directory '$SOURCE_DIR' does not exist.${NC}"
    exit 1
fi

# ─── Check aws-cli ─────────────────────────────────────────────────────────
if ! command -v aws &>/dev/null; then
    echo -e "${RED}Error: aws-cli is not installed.${NC}"
    echo "Install it: pip install awscli  or  apt install awscli"
    exit 1
fi

# ─── Sync to Yandex Object Storage ─────────────────────────────────────────
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Deploying to Yandex Cloud Object Storage${NC}"
echo -e "${CYAN}  Bucket:   ${YC_STORAGE_BUCKET}${NC}"
echo -e "${CYAN}  Source:   ${SOURCE_DIR}${NC}"
echo -e "${CYAN}  Endpoint: ${YC_STORAGE_ENDPOINT}${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo ""

# Build the AWS CLI command
AWS_CMD=(
    aws s3 sync
    "$SOURCE_DIR"
    "s3://${YC_STORAGE_BUCKET}/"
    --endpoint-url "$YC_STORAGE_ENDPOINT"
    --region "$YC_STORAGE_REGION"
    --delete
    --exact-timestamps
    --acl "public-read"
)

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}── Dry run — showing what would be uploaded ──${NC}"
    "${AWS_CMD[@]}" --dryrun
    echo ""
    echo -e "${GREEN}Dry run complete. Run without --dry-run to deploy.${NC}"
else
    echo -e "${YELLOW}Uploading files...${NC}"
    "${AWS_CMD[@]}"
    echo ""
    echo -e "${GREEN}✅ Deployment complete!${NC}"
    echo ""
    echo -e "Your site should be available at:"
    echo -e "  ${CYAN}https://${YC_STORAGE_BUCKET}.storage.yandexcloud.net/${NC}"
    echo ""
    echo -e "${YELLOW}Note:${NC} Make sure the bucket has static website hosting enabled:"
    echo -e "  Index page: index.html"
    echo -e "  Error page: index.html (for SPA routing)"
    echo ""
    echo -e "To configure via Yandex Cloud CLI:"
    echo -e "  ${CYAN}yc storage bucket update ${YC_STORAGE_BUCKET} \\${NC}"
    echo -e "  ${CYAN}  --website-index index.html \\${NC}"
    echo -e "  ${CYAN}  --website-error index.html${NC}"
fi
