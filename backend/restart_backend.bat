@echo off
echo Killing old backend processes...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq app.py*" 2>nul
timeout /t 2 /nobreak >nul

echo Starting backend with new routes...
cd /d C:\Users\User\OneDrive\Desktop\ProyectoFinal5toF\SmarkPark\backend
start "SmartPark Backend" cmd /k "python app.py"
echo Backend starting... Wait 3 seconds...
timeout /t 3 /nobreak >nul
echo.
echo Testing routes...
curl -s http://127.0.0.1:5000/api/health
echo.
echo If you see JSON above, backend is working!
pause
