@echo off
cd /d "%~dp0frontend"
echo Installing frontend dependencies...
npm install
echo.
echo Starting React frontend on http://localhost:5173
echo.
npm run dev
pause
