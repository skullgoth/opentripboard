#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
  echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if environment argument is provided
if [ -z "$1" ]; then
  print_error "Usage: ./scripts/setup-env.sh <dev|prod>"
  echo ""
  echo "Examples:"
  echo "  ./scripts/setup-env.sh dev    # Setup for local development"
  echo "  ./scripts/setup-env.sh prod   # Setup for production"
  exit 1
fi

ENV=$1

# Validate environment argument
if [ "$ENV" != "dev" ] && [ "$ENV" != "prod" ]; then
  print_error "Invalid environment: $ENV"
  print_info "Must be either 'dev' or 'prod'"
  exit 1
fi

# Change to project root
cd "$(dirname "$0")/.."

print_info "Setting up OpenTripBoard for $ENV environment..."
echo ""

# Setup root environment (database credentials)
print_info "Setting up root environment..."
if [ "$ENV" = "dev" ]; then
  cp -v .env.dev .env
  print_success "Root .env created from .env.dev"
else
  if [ ! -f .env.prod ]; then
    print_error ".env.prod not found"
    exit 1
  fi
  cp -v .env.prod .env
  print_success "Root .env created from .env.prod"
  print_error "⚠️  IMPORTANT: Edit .env with your production database password"
fi

# Setup backend environment
print_info "Setting up backend..."
if [ "$ENV" = "dev" ]; then
  cp -v backend/.env.dev backend/.env
  print_success "Backend .env created from .env.dev"
else
  if [ ! -f backend/.env.prod ]; then
    print_error "backend/.env.prod not found"
    exit 1
  fi
  cp -v backend/.env.prod backend/.env
  print_success "Backend .env created from .env.prod"
  print_error "⚠️  IMPORTANT: Edit backend/.env with your production values:"
  echo "    - PEXELS_API_KEY"
  echo "    - DATABASE_URL (password)"
  echo "    - JWT_SECRET (strong random value)"
  echo "    - CORS_ORIGIN"
fi

# Setup frontend environment
print_info "Setting up frontend..."
if [ "$ENV" = "dev" ]; then
  cp -v frontend/.env.dev frontend/.env
  print_success "Frontend .env created from .env.dev"
else
  if [ ! -f frontend/.env.prod ]; then
    print_error "frontend/.env.prod not found"
    exit 1
  fi
  cp -v frontend/.env.prod frontend/.env
  print_success "Frontend .env created from .env.prod"
  print_error "⚠️  IMPORTANT: Edit frontend/.env with your production domain:"
  echo "    - VITE_API_URL (update your-domain.com)"
  echo "    - VITE_WS_URL (update your-domain.com)"
fi

# Setup docker-compose files
print_info "Setting up docker-compose..."
if [ "$ENV" = "dev" ]; then
  # For dev, we need the main file + dev overrides
  print_success "Use: docker compose -f docker-compose.yml -f docker-compose.dev.yml up"
else
  # For prod, we need the main file + prod overrides
  print_success "Use: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
fi

echo ""
print_success "Setup complete!"
echo ""

if [ "$ENV" = "dev" ]; then
  print_info "Next steps:"
  echo "  1. (Optional) Edit backend/.env and frontend/.env if needed"
  echo "  2. Run: docker compose -f docker-compose.yml -f docker-compose.dev.yml up"
else
  print_info "Next steps:"
  echo "  1. Edit backend/.env with your production secrets"
  echo "  2. Edit frontend/.env with your production domain"
  echo "  3. Run: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
fi
