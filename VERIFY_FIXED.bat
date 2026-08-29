@echo off
cd /d "%~dp0"
echo Checking JavaScript syntax...
node --check app.js
if errorlevel 1 goto fail
node --check server.js
if errorlevel 1 goto fail
node --check db.js
if errorlevel 1 goto fail
echo.
echo Syntax check PASSED.
pause
exit /b 0
:fail
echo.
echo Syntax check FAILED.
pause
exit /b 1
