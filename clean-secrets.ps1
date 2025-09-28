# This script finds and deletes all .env files in the current directory and subdirectories.
Write-Host "--- Starting local cleanup of .env files ---"
$SearchPath = Get-Location
$Patterns = "*.env", "*.env.local"
foreach ($Pattern in $Patterns) {
    Get-ChildItem -Path $SearchPath -Include $Pattern -Recurse -Force | ForEach-Object {
        Write-Host "Deleting: $($_.FullName)" -ForegroundColor Red
        Remove-Item $_.FullName -Force
    }
}
Write-Host "--- Cleanup complete. No .env files should remain. ---"