@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Dependencies not installed. Run INSTALL_AND_START.bat first.
  pause
  exit /b 1
)
echo Starting SANGAM NEXUS...
npm start
pause
