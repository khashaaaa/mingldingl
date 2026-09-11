#!/bin/bash
# mk <Name> <bg> : wraps stdin body into Name.dc.html with the shared head
name="$1"; bg="${2:-#0A0B10}"
{
cat <<H
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Yeseva+One&family=Alegreya:ital,wght@0,400;0,500;1,400&family=UnifrakturMaguntia&display=swap">
  <style>
    body { margin: 0; background: $bg; }
    a { color: #D97F1F; } a:hover { color: #F5A83C; }
  </style>
</helmet>
H
cat
cat <<T
</x-dc>
</body>
</html>
T
} > "$name.dc.html"
echo "wrote $name"
