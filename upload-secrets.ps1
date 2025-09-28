# This script reads key=value pairs from the SPECIFIED PATH and creates/updates
# them as Repository Secrets using the GitHub CLI (gh).
$EnvFilePath = "C:\Users\user\Downloads\.env.local"
$RepoName = (git remote get-url origin).Replace("https://github.com/", "").Replace(".git", "")
Write-Host "--- Starting Secret Upload Automation ---"
Write-Host "Target Repository: $RepoName"

if (-not (Test-Path $EnvFilePath)) { Write-Error "Error: The file '$EnvFilePath' was not found at the specified path."; exit 1 }

$EnvLines = Get-Content $EnvFilePath | Where-Object { $_ -notmatch '^#' -and $_ -match '=' }

$SuccessCount = 0; $ErrorCount = 0;

foreach ($Line in $EnvLines) {
    $TrimmedLine = $Line.Trim()
    if ($TrimmedLine -match '^#' -or -not $TrimmedLine) { continue }
    
    $Key = $TrimmedLine.Split('=', 2)[0]
    $Value = $TrimmedLine.Split('=', 2)[1].Trim('"')

    Write-Host "Processing key: $Key"
    $Result = gh secret set $Key --body $Value --repo $RepoName 2>&1

    if ($LASTEXITCODE -eq 0) { Write-Host "Success: Secret '$Key' was set." -ForegroundColor Green; $SuccessCount++ } 
    else { Write-Host "Failed to set secret '$Key'. Output: $Result" -ForegroundColor Red; $ErrorCount++ }
}
Write-Host "--- Automation Complete ---"
Write-Host "Total Secrets Processed: $($SuccessCount + $ErrorCount)"
Write-Host "Successfully Created/Updated: $SuccessCount" -ForegroundColor Green
Write-Host "Failed: $ErrorCount" -ForegroundColor Red