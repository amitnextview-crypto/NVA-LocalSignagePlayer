$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$preferredLetters = @("R", "S", "T", "U", "V", "W", "X", "Y", "Z")
$driveLetter = $null

foreach ($letter in $preferredLetters) {
    $existing = Get-PSDrive -Name $letter -ErrorAction SilentlyContinue
    if (-not $existing) {
        $driveLetter = $letter
        break
    }
}

if (-not $driveLetter) {
    throw "No free drive letter available for temporary short-path build."
}

$mappedRoot = "${driveLetter}:"

try {
    Write-Host "Mapping $mappedRoot to $repoRoot for a shorter Windows build path..."
    subst $mappedRoot $repoRoot | Out-Null

    if (-not (Test-Path "$mappedRoot\")) {
        throw "Failed to map $mappedRoot to the repository."
    }

    Push-Location "$mappedRoot\"
    & npx react-native run-android @args
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}
finally {
    Pop-Location -ErrorAction SilentlyContinue
    subst $mappedRoot /d | Out-Null
}
