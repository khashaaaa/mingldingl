"""Uploads an Android App Bundle straight to Google Play and releases it to a track (internal by
default), with the service account in ~/.config/mingldingl/play-service-account.json. Faster than
`eas submit`, which relays the 130 MB file through EAS's own queue.
  ~/.venvs/play/bin/python scripts/play-upload.py <file.aab> [track]
That venv holds google-api-python-client, google-auth and google-auth-httplib2 (pip)."""
import os, sys
import google_auth_httplib2, httplib2
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

PACKAGE = "com.mingldingl.app"
KEY = os.path.expanduser("~/.config/mingldingl/play-service-account.json")

aab, track = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "internal")
creds = service_account.Credentials.from_service_account_file(KEY, scopes=["https://www.googleapis.com/auth/androidpublisher"])
# Google takes minutes to process a large bundle after the last byte: wait up to ten.
raw = httplib2.Http(timeout=600)
raw.redirect_codes = raw.redirect_codes - {308}  # 308 is the resumable upload's "keep going", not a redirect
http = google_auth_httplib2.AuthorizedHttp(creds, http=raw)
play = build("androidpublisher", "v3", http=http, cache_discovery=False)
edit = play.edits().insert(packageName=PACKAGE, body={}).execute()["id"]
media = MediaFileUpload(aab, mimetype="application/octet-stream", chunksize=8 * 1024 * 1024, resumable=True)
req = play.edits().bundles().upload(packageName=PACKAGE, editId=edit, media_body=media)
done = None
while done is None:
    status, done = req.next_chunk()
    if status: print(f"uploaded {int(status.progress() * 100)}%", flush=True)
code = done["versionCode"]
play.edits().tracks().update(packageName=PACKAGE, editId=edit, track=track,
    body={"track": track, "releases": [{"versionCodes": [str(code)], "status": "completed"}]}).execute()
play.edits().commit(packageName=PACKAGE, editId=edit).execute()
print(f"version {code} released to {track}")
