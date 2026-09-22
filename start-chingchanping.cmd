@echo off
setlocal
cd /d "%~dp0"
echo CHINGCHANPING - http://localhost:5173
echo Keep this window open while using the local service.
echo.
where node >nul 2>nul
if not errorlevel 1 (
  node scripts/run-framework.mjs dev
) else (
  "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts/run-framework.mjs dev
)
if errorlevel 1 (
  echo.
  echo The server could not start. Check whether CHINGCHANPING is already running.
  pause
)
