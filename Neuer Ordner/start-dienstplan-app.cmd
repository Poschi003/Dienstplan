@echo off
cd /d "%~dp0"
start "" "http://localhost:4173"
"C:\Users\Poschi stinkt\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" app\server.js
