@echo off
setlocal
set PORT=8761
cd /d "%~dp0"
start "PinpointLab Server" powershell -NoExit -Command "Set-Location -LiteralPath '%~dp0'; python -m http.server %PORT%"
timeout /t 2 >nul
start "" "http://127.0.0.1:%PORT%/index.html"
