@echo off
setlocal
set PORT=8761
cd /d "%~dp0"
start "PinpointLab Server" python -m http.server %PORT% --bind 127.0.0.1 --directory "%~dp0."
timeout /t 2 >nul
start "" "http://127.0.0.1:%PORT%/index.html"
