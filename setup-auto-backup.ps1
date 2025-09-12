# PowerShell Script to Setup Auto Backup for Next Inventory
# Run as Administrator

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Inventory Auto Backup Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Please right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Set project path
$ProjectPath = "C:\Users\USER\Desktop\next-inventory"
$BatchFilePath = "$ProjectPath\backup_migration\auto-backup.bat"

# Check if project exists
if (-not (Test-Path $ProjectPath)) {
    Write-Host "ERROR: Project path not found: $ProjectPath" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if batch file exists
if (-not (Test-Path $BatchFilePath)) {
    Write-Host "ERROR: Backup batch file not found: $BatchFilePath" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Creating scheduled task..." -ForegroundColor Green

# Create scheduled task
$TaskName = "NextInventory-AutoBackup"
$Description = "Daily backup for Next Inventory system at 2:00 AM"

# Create action
$Action = New-ScheduledTaskAction -Execute $BatchFilePath

# Create trigger (daily at 2:00 AM)
$Trigger = New-ScheduledTaskTrigger -Daily -At "2:00AM"

# Create settings
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Create principal (run as SYSTEM)
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# Register the task
try {
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description $Description -Force
    Write-Host "✅ Scheduled task created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Task Details:" -ForegroundColor Cyan
    Write-Host "  Name: $TaskName" -ForegroundColor White
    Write-Host "  Schedule: Daily at 2:00 AM" -ForegroundColor White
    Write-Host "  Command: $BatchFilePath" -ForegroundColor White
    Write-Host ""
    Write-Host "You can manage this task in:" -ForegroundColor Yellow
    Write-Host "  Task Scheduler > Task Scheduler Library > $TaskName" -ForegroundColor White
    Write-Host ""
    Write-Host "To test the backup manually, run:" -ForegroundColor Yellow
    Write-Host "  cd `"$ProjectPath`"" -ForegroundColor White
    Write-Host "  npm run backup" -ForegroundColor White
    
} catch {
    Write-Host "❌ Failed to create scheduled task: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

Read-Host "Press Enter to exit"
