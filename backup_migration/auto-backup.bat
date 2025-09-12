@echo off
REM Auto Backup Script for Next Inventory
REM Run daily at 2:00 AM

echo ========================================
echo Next Inventory Auto Backup
echo Started at: %date% %time%
echo ========================================

REM Change to project directory
cd /d "C:\Users\USER\Desktop\next-inventory"

REM Check if Node.js is available
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js not found in PATH
    echo Please install Node.js or add it to PATH
    pause
    exit /b 1
)

REM Run backup script
echo Running backup...
npm run backup

REM Check if backup was successful
if %ERRORLEVEL% EQU 0 (
    echo ========================================
    echo Backup completed successfully!
    echo Completed at: %date% %time%
    echo ========================================
) else (
    echo ========================================
    echo ERROR: Backup failed!
    echo Failed at: %date% %time%
    echo ========================================
)

REM Log the result
echo Backup attempt at %date% %time% - Exit Code: %ERRORLEVEL% >> backup_migration\backup_log.txt

REM Uncomment the line below if you want to see the result when run manually
REM pause
