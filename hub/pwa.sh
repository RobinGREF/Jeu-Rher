#!/bin/sh
# Rend un jeu installable (icône + manifeste) : ./pwa.sh <dossier du jeu publié> <id d'icône> <nom> <couleur>
set -e
dir="$1"; id="$2"; name="$3"; color="$4"
here="$(cd "$(dirname "$0")" && pwd)"
cp "$here/icons/$id-192.png" "$here/icons/$id-512.png" "$dir/"
cat > "$dir/manifest.webmanifest" <<JSON
{
  "name": "$name",
  "short_name": "$name",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#0f172a",
  "theme_color": "$color",
  "icons": [
    { "src": "$id-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "$id-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
JSON
tags="<link rel=\"manifest\" href=\"manifest.webmanifest\"><link rel=\"apple-touch-icon\" href=\"$id-192.png\"><meta name=\"theme-color\" content=\"$color\"><meta name=\"mobile-web-app-capable\" content=\"yes\"><meta name=\"apple-mobile-web-app-capable\" content=\"yes\">"
# insère avant </head> (une seule fois)
grep -q 'rel="manifest"' "$dir/index.html" || sed -i "s|</head>|$tags</head>|" "$dir/index.html"
