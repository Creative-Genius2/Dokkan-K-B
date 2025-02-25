@echo off
setlocal enabledelayedexpansion

echo ===== Claude Desktop Restart Utility =====
echo.

echo Step 1: Killing any running Claude Desktop processes...
taskkill /IM Claude.exe /F 2>NUL
if %ERRORLEVEL% EQU 0 (
    echo Successfully terminated Claude Desktop.
) else (
    echo Claude Desktop was not running.
)
timeout /t 3 /nobreak > nul

echo Step 2: Clearing port 3000...
call node restart.js
echo.

echo Step 3: Checking for Claude shortcut locations...
set CLAUDE_FOUND=0

set SHORTCUT_PATHS=^
"%APPDATA%\Microsoft\Windows\Start Menu\Programs\Anthropic\Claude.lnk"^
"C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Anthropic\Claude.lnk"^
"%APPDATA%\Roaming\Microsoft\Windows\Start Menu\Programs\Anthropic\Claude.lnk"^
"%USERPROFILE%\Desktop\Claude.lnk"^
"%PUBLIC%\Desktop\Claude.lnk"

set EXE_PATHS=^
"%LOCALAPPDATA%\Programs\Claude\Claude.exe"^
"C:\Program Files\Claude\Claude.exe"^
"C:\Program Files (x86)\Claude\Claude.exe"

echo Checking shortcut paths...
for %%p in (%SHORTCUT_PATHS%) do (
    if exist "%%~p" (
        echo Found shortcut: %%~p
        start "" "%%~p"
        set CLAUDE_FOUND=1
        goto :claude_started
    )
)

echo Checking executable paths...
for %%p in (%EXE_PATHS%) do (
    if exist "%%~p" (
        echo Found executable: %%~p
        start "" "%%~p"
        set CLAUDE_FOUND=1
        goto :claude_started
    )
)

echo Searching entire system for Claude.exe...
for /f "tokens=*" %%i in ('where /r C:\ Claude.exe 2^>nul') do (
    if exist "%%i" (
        echo Found Claude.exe at: %%i
        start "" "%%i"
        set CLAUDE_FOUND=1
        goto :claude_started
    )
)

:claude_started
if "!CLAUDE_FOUND!"=="1" (
    echo.
    echo Claude Desktop started successfully.
) else (
    echo.
    echo [ERROR] Could not find Claude Desktop.
    echo Please start Claude Desktop manually.
)

echo.
echo ===== Restart Complete =====
echo.
pause
endlocal