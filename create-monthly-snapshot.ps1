# PowerShell script สำหรับสร้าง snapshot อัตโนมัติทุกสิ้นเดือน
# ตั้งค่า Scheduled Task: รันทุกวันแรกของเดือน เวลา 00:00

# Configuration
$API_URL = $env:API_URL
if (-not $API_URL) {
    $API_URL = "http://localhost:3000"
}

$SECRET_KEY = $env:SNAPSHOT_SECRET_KEY
if (-not $SECRET_KEY) {
    $SECRET_KEY = "default-secret-key-change-in-production"
}

# สร้าง snapshot สำหรับเดือนก่อนหน้า
Write-Host "Creating snapshot for previous month..." -ForegroundColor Green

try {
    $response = Invoke-WebRequest -Uri "${API_URL}/api/admin/inventory-snapshot/auto-create?secret=${SECRET_KEY}" `
        -Method POST `
        -ContentType "application/json" `
        -UseBasicParsing
    
    Write-Host "HTTP Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Green
    Write-Host "Snapshot creation completed at $(Get-Date)" -ForegroundColor Green
}
catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

