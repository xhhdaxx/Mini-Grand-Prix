#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"
echo "Project directory: $PROJECT_DIR"

echo "Installing dependencies..."
pnpm install

echo "Starting development server..."

trap 'kill 0' INT TERM

pnpm dev &

wait
