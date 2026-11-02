@echo off
setlocal
cd /d "%~dp0"
set "PYEXE="
for %%V in (3.12 3.11 3.10) do (
  if not defined PYEXE (
    py -%%V -c "import sys" >nul 2>&1
    if not errorlevel 1 set "PYEXE=py -%%V"
  )
)
if not defined PYEXE (
  where python >nul 2>&1 && set "PYEXE=python"
)
if not defined PYEXE (
  echo No Python found. Install Python 3.12 from python.org and re-run.
  exit /b 1
)
echo Using: %PYEXE%
%PYEXE% -m venv .venv
if errorlevel 1 exit /b 1
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 exit /b 1
python -m app.ml.train_model
python -c "from app import db; db.init_db(); print('MongoDB connection OK')" || echo WARNING: MongoDB not reachable - start it before run.bat
echo.
echo Setup complete. Start the API with run.bat
endlocal