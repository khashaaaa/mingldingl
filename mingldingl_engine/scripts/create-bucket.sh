#!/usr/bin/env bash
# Creates the private "portraits" bucket in Supabase Storage (once). Reads the URL and key from appsettings.Development.json.
set -euo pipefail
cd "$(dirname "$0")/.."
cfg=src/MinglDingl.Engine/appsettings.Development.json
url=$(python3 -c "import json;print(json.load(open('$cfg'))['Supabase']['ProjectUrl'].rstrip('/'))")
key=$(python3 -c "import json;print(json.load(open('$cfg'))['Supabase']['SecretKey'])")
curl -sS -X POST "$url/storage/v1/bucket" -H "Authorization: Bearer $key" -H "apikey: $key" -H "Content-Type: application/json" \
  -d '{"id":"portraits","name":"portraits","public":false,"file_size_limit":5242880,"allowed_mime_types":["image/jpeg"]}'
echo
