@echo off
chcp 65001 >nul
echo ===== SMARKPARK RESTART ALL =====
echo.

echo [1/4] Killing old processes...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo.
echo [2/4] Starting BACKEND...
cd /d C:\Users\User\OneDrive\Desktop\ProyectoFinal5toF\SmarkPark\backend
start "Backend" cmd /c "python app.py"
timeout /t 3 /nobreak >nul

echo.
echo [3/4] Starting FRONTEND...
cd /d C:\Users\User\OneDrive\Desktop\ProyectoFinal5toF\SmarkPark\frontend
start "Frontend" cmd /c "npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo [4/4] Testing backend route...
curl -s http://127.0.0.1:5000/api/access-codes/validate >nul 2>&1
if %errorlevel%==0 (
    echo [OK] Backend is responding!
) else (
    echo [WAIT] Backend still starting...
)

echo.
echo ===== DONE =====
echo.
echo Now:
echo  1. Open browser: http://localhost:5173
echo  2. Press Ctrl+Shift+Del - clear cache
echo  3. Reload with Ctrl+F5
echo.
pause
