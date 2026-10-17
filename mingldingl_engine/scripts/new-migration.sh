#!/usr/bin/env bash
# Stage 2 keeps ONE initial migration: regenerate it after every model change.
set -euo pipefail
cd "$(dirname "$0")/.."
export DOTNET_ROOT="${DOTNET_ROOT:-$HOME/.dotnet}" PATH="$HOME/.dotnet:$PATH" DOTNET_NOLOGO=1
rm -rf src/MinglDingl.Engine/Kernel/Persistence/Migrations
dotnet ef migrations add Initial --project src/MinglDingl.Engine --output-dir Kernel/Persistence/Migrations -- --environment Development >/dev/null
echo "Initial migration regenerated"
