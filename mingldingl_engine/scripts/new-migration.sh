#!/usr/bin/env bash
# Stage 2 keeps ONE initial migration: regenerate it after every model change.
set -euo pipefail
cd "$(dirname "$0")/.."
export DOTNET_ROOT="${DOTNET_ROOT:-$HOME/.dotnet}" PATH="$HOME/.dotnet:$PATH" DOTNET_NOLOGO=1
M=src/MinglDingl.Engine/Kernel/Persistence/Migrations
# The regenerated migration keeps the old one's id: a database that already applied "Initial" (the
# server's, the dev one) must not see a new id, or it tries to create every table again and the
# engine cannot boot. New columns reach such a database through DatabaseBootstrap's ADD COLUMN IF
# NOT EXISTS steps.
OLD=$(ls "$M" 2>/dev/null | sed -n 's/^\([0-9]*_Initial\)\.cs$/\1/p' | head -1)
rm -rf "$M"
dotnet ef migrations add Initial --project src/MinglDingl.Engine --output-dir Kernel/Persistence/Migrations -- --environment Development >/dev/null
if [ -n "$OLD" ]; then
  NEW=$(ls "$M" | sed -n 's/^\([0-9]*_Initial\)\.cs$/\1/p' | head -1)
  mv "$M/$NEW.cs" "$M/$OLD.cs"
  mv "$M/$NEW.Designer.cs" "$M/$OLD.Designer.cs"
  sed -i "s/$NEW/$OLD/g" "$M/$OLD.cs" "$M/$OLD.Designer.cs"
fi
echo "Initial migration regenerated (id ${OLD:-new})"
