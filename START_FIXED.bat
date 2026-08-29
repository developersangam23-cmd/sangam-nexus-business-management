@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo node_modules not found. This fixed package intentionally does not include node_modules.
  echo Use the existing project dependency folder or install the package dependencies once.
  pause
  exit /b 1
)
echo Starting SANGAM NEXUS FIXED...
npm start
pause
