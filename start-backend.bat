@echo off
cd /d "%~dp0backend"
echo Installing backend dependencies...
pip install -r requirements.txt
echo.
echo Starting FastAPI backend on http://localhost:8000
echo API docs available at http://localhost:8000/docs
echo.
uvicorn main:app --reload --host 0.0.0.0 --port 8000
pause
