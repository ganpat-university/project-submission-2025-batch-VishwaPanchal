@echo off
REM This script helps execute JavaScript files when Node.js is installed but not in PATH

REM Try common Node.js installation paths
set "COMMON_PATHS=C:\Program Files\nodejs\node.exe;C:\Program Files (x86)\nodejs\node.exe;%USERPROFILE%\AppData\Roaming\nvm\current\node.exe;%LOCALAPPDATA%\Programs\nodejs\node.exe"

set NODE_EXE=

REM Check if node is in PATH
where node > nul 2>&1
if %ERRORLEVEL% EQU 0 (
  set NODE_EXE=node
  goto :execute
)

REM Check common paths
for %%p in (%COMMON_PATHS:;= %) do (
  if exist "%%p" (
    set "NODE_EXE=%%p"
    goto :execute
  )
)

REM Node not found
echo Node.js was not found on this system.
echo Please install Node.js from https://nodejs.org/
exit /b 1

:execute
echo Using Node.js at: %NODE_EXE%
"%NODE_EXE%" %* 