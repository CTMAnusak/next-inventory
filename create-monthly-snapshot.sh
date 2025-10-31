#!/bin/bash
# Script สำหรับสร้าง snapshot อัตโนมัติทุกสิ้นเดือน
# ตั้งค่า cron job: 0 0 1 * * /path/to/create-monthly-snapshot.sh

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
SECRET_KEY="${SNAPSHOT_SECRET_KEY:-default-secret-key-change-in-production}"

# สร้าง snapshot สำหรับเดือนก่อนหน้า
echo "Creating snapshot for previous month..."
curl -X POST "${API_URL}/api/admin/inventory-snapshot/auto-create?secret=${SECRET_KEY}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"

echo "Snapshot creation completed at $(date)"

