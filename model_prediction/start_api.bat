@echo off
echo ==========================================
echo Starting Focus Monitoring API Server
echo ==========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install requirements
echo.
echo Installing dependencies...
pip install -r requirements-api.txt

REM Start API server
echo.
echo ==========================================
echo API Server Starting on http://localhost:8000
echo ==========================================
echo.
echo Press Ctrl+C to stop the server
echo.

python -m uvicorn api:app --host 0.0.0.0 --port 8000 --reload

pause
