$env:MONGODB_URI = 'mongodb+srv://vsq-admin:vsqWedYykRQQjZtmHX9@cluster0.r3yibxs.mongodb.net/inventory-management?retryWrites=true&w=majority&appName=Cluster0'
Set-Location -Path 'C:\Users\User\Desktop\next-inventory'
npx tsx src/scripts/yearly-archive-cleanup.ts
