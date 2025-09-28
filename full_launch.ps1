# --- FINAL EXECUTION SEQUENCE (Run this block directly in PowerShell) ---

Write-Host "--- 1. Initializing Git and Linking New Remote ---" -ForegroundColor Yellow

# Clean up old Git state and initialize fresh repository
Remove-Item .git -Force -Recurse -ErrorAction SilentlyContinue 
git init -b main

# Link to the NEW remote repository
git remote add origin https://github.com/gabrielekerete60/bms.git
Write-Host "✅ Git initialized and linked to remote." -ForegroundColor Green

# ---

Write-Host "`n--- 2. Running Local Automation and Push ---" -ForegroundColor Yellow

# Execute cleanup script (Must exist from Step 1)
Write-Host "Running local cleanup script..." -ForegroundColor Cyan
.\clean-secrets.ps1

# Execute upload secrets script (Must exist from Step 1)
Write-Host "Uploading secrets to GitHub..." -ForegroundColor Cyan
.\upload-secrets.ps1

if ($LASTEXITCODE -ne 0) {
    Write-Host "🔴 Secret upload failed. Please check gh auth status. Exiting." -ForegroundColor Red
    exit 1
}

# Add all files (including the build-deploy.yml, which we trust exists)
Write-Host "Staging and committing clean files..." -ForegroundColor Cyan
git add .
git commit -m "Initial clean push with CI/CD workflow"

# Push to remote
Write-Host "Launching app to GitHub..." -ForegroundColor Cyan
git push --force --set-upstream origin main

Write-Host "`n🚀 SETUP COMPLETE. Your project is launched! Check GitHub Actions now." -ForegroundColor Green