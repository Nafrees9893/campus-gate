@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    where py >nul 2>nul
    if errorlevel 1 (
        python -m venv .venv
    ) else (
        py -3 -m venv .venv
    )
    if errorlevel 1 goto failed
)
if not exist ".venv\campus-deps-v1" (
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt
    if errorlevel 1 goto failed
    echo ready>".venv\campus-deps-v1"
)
".venv\Scripts\python.exe" run.py --demo
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo Setup or startup did not finish. See the error above and the README.
pause
exit /b 1
