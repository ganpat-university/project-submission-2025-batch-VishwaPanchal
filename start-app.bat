@echo off
echo Starting CodeCollab server and client...
echo.
echo NOTE: Server will run on port 5001

:: Start the server in its own window
start cmd /k "cd /d %~dp0 && npm run server"

:: Wait a moment for server to initialize
timeout /t 2 > nul

:: Start the client in a separate window
start cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo Started both processes in separate windows.
echo Close the windows to stop the application. 