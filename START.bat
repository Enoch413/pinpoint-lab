@echo off
setlocal
cd /d "%~dp0"
python -c "import sys; sys.exit(sys.version_info.major != 3)" >nul 2>&1
if errorlevel 1 (
  echo Python 3 is required. Install Python 3 and run START.bat again.
  pause
  exit /b 1
)
python -X utf8 "%~dp0launcher.py"
if errorlevel 1 (
  pause
  exit /b 1
)
