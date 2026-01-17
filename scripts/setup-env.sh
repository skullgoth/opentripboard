#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Function to print colored output
print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_header() {
  echo ""
  echo -e "${BOLD}━━━ $1 ━━━${NC}"
}

# Show usage information
show_usage() {
  echo "Usage: ./scripts/setup-env.sh <dev|prod>"
  echo ""
  echo "Setup environment files for OpenTripBoard Docker environments."
  echo ""
  echo "Commands:"
  echo "  dev     Setup for local development (uses .env.dev files)"
  echo "  prod    Setup for production (uses .env.prod files)"
  echo ""
  echo "Examples:"
  echo "  ./scripts/setup-env.sh dev    # Setup for local development"
  echo "  ./scripts/setup-env.sh prod   # Setup for production"
  echo ""
  echo "After setup, start the application with:"
  echo "  Development: docker compose -f docker-compose.yml -f docker-compose.dev.yml up"
  echo "  Production:  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
}

# Check if environment argument is provided
if [ -z "$1" ]; then
  print_error "Missing environment argument"
  echo ""
  show_usage
  exit 1
fi

# Handle help flag
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  show_usage
  exit 0
fi

ENV=$1

# Validate environment argument
if [ "$ENV" != "dev" ] && [ "$ENV" != "prod" ]; then
  print_error "Invalid environment: $ENV"
  echo ""
  echo "Valid environments are: dev, prod"
  echo ""
  echo "Run './scripts/setup-env.sh --help' for more information."
  exit 1
fi

# Change to project root
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

# Verify we're in the correct directory
if [ ! -f "docker-compose.yml" ]; then
  print_error "Cannot find docker-compose.yml"
  print_info "Please run this script from the project root or via ./scripts/setup-env.sh"
  exit 1
fi

echo ""
echo -e "${BOLD}OpenTripBoard Environment Setup${NC}"
echo -e "Environment: ${GREEN}$ENV${NC}"
echo -e "Project root: ${BLUE}$PROJECT_ROOT${NC}"

# Track files created for summary
FILES_CREATED=()
WARNINGS=()

# Function to safely copy env file with backup
copy_env_file() {
  local source=$1
  local dest=$2
  local description=$3

  # Check if source exists
  if [ ! -f "$source" ]; then
    print_error "Source file not found: $source"
    return 1
  fi

  # Backup existing file if it exists
  if [ -f "$dest" ]; then
    print_info "Backing up existing $dest to ${dest}.bak"
    cp "$dest" "${dest}.bak"
  fi

  # Copy the file
  cp "$source" "$dest"
  print_success "$description"
  FILES_CREATED+=("$dest")
  return 0
}

# Validate required source files exist before proceeding
print_header "Validating Source Files"

MISSING_FILES=()

if [ "$ENV" = "dev" ]; then
  [ ! -f ".env.dev" ] && MISSING_FILES+=(".env.dev")
  [ ! -f "backend/.env.dev" ] && MISSING_FILES+=("backend/.env.dev")
  [ ! -f "frontend/.env.dev" ] && MISSING_FILES+=("frontend/.env.dev")
  [ ! -f "docker-compose.dev.yml" ] && MISSING_FILES+=("docker-compose.dev.yml")
  [ ! -f "nginx.dev.conf" ] && MISSING_FILES+=("nginx.dev.conf")
else
  [ ! -f ".env.prod" ] && MISSING_FILES+=(".env.prod")
  [ ! -f "backend/.env.prod" ] && MISSING_FILES+=("backend/.env.prod")
  [ ! -f "frontend/.env.prod" ] && MISSING_FILES+=("frontend/.env.prod")
  [ ! -f "docker-compose.prod.yml" ] && MISSING_FILES+=("docker-compose.prod.yml")
  [ ! -f "nginx.prod.conf" ] && MISSING_FILES+=("nginx.prod.conf")
fi

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
  print_error "Missing required source files:"
  for file in "${MISSING_FILES[@]}"; do
    echo "  - $file"
  done
  echo ""
  print_info "Please ensure all template files exist before running setup."
  exit 1
fi

print_success "All required source files found"

# Setup root environment (database credentials)
print_header "Root Environment (.env)"

if copy_env_file ".env.$ENV" ".env" "Created .env from .env.$ENV"; then
  if [ "$ENV" = "prod" ]; then
    WARNINGS+=("Edit .env and set a secure DB_PASSWORD")
  fi
fi

# Setup backend environment
print_header "Backend Environment (backend/.env)"

if copy_env_file "backend/.env.$ENV" "backend/.env" "Created backend/.env from backend/.env.$ENV"; then
  if [ "$ENV" = "prod" ]; then
    WARNINGS+=("Edit backend/.env with production values:")
    WARNINGS+=("  - PEXELS_API_KEY (your API key)")
    WARNINGS+=("  - DATABASE_URL (update password)")
    WARNINGS+=("  - JWT_SECRET (generate a strong random value)")
    WARNINGS+=("  - CORS_ORIGIN (your production domain)")
  fi
fi

# Setup frontend environment
print_header "Frontend Environment (frontend/.env)"

if copy_env_file "frontend/.env.$ENV" "frontend/.env" "Created frontend/.env from frontend/.env.$ENV"; then
  if [ "$ENV" = "prod" ]; then
    WARNINGS+=("Edit frontend/.env with production domain:")
    WARNINGS+=("  - VITE_API_URL (https://your-domain.com/api/v1)")
    WARNINGS+=("  - VITE_WS_URL (wss://your-domain.com/ws)")
  fi
fi

# Summary
print_header "Setup Complete"

echo ""
echo -e "${GREEN}Files created:${NC}"
for file in "${FILES_CREATED[@]}"; do
  echo "  ✓ $file"
done

# Show warnings for production
if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}Important (Production Setup):${NC}"
  for warning in "${WARNINGS[@]}"; do
    echo "  $warning"
  done
fi

# Docker compose command info
echo ""
print_header "Next Steps"

if [ "$ENV" = "dev" ]; then
  echo ""
  echo "1. Start the development environment:"
  echo -e "   ${BLUE}docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build${NC}"
  echo ""
  echo "2. Open in browser:"
  echo -e "   ${BLUE}http://localhost${NC}"
  echo ""
  echo "3. (Optional) Direct service access:"
  echo "   - Frontend (Vite): http://localhost:5173"
  echo "   - Backend API:     http://localhost:3000"
  echo "   - Database:        localhost:5432"
  echo ""
  print_info "Hot reload is enabled - changes to code will automatically refresh."
else
  echo ""
  echo "1. Edit the environment files with your production values:"
  echo "   - .env (database password)"
  echo "   - backend/.env (API keys, JWT secret, CORS)"
  echo "   - frontend/.env (production domain URLs)"
  echo ""
  echo "2. Build and start the production environment:"
  echo -e "   ${BLUE}docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build${NC}"
  echo ""
  echo "3. Open in browser:"
  echo -e "   ${BLUE}http://localhost${NC} (or your production domain)"
  echo ""
  print_warning "Never commit production .env files to version control!"
fi

echo ""
