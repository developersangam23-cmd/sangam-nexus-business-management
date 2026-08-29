@echo off
cd /d "%~dp0"
echo Installing dependencies...
npm install
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)
echo Starting SANGAM NEXUS...
npm start
pause
