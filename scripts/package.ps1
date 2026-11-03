$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outputDirectory = Join-Path $projectRoot 'artifacts'
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$extensionVersion = (Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'extension/manifest.json') | ConvertFrom-Json).version
$outputZip = Join-Path $outputDirectory ('microbit-classroom-keepalive-' + $extensionVersion + '.zip')
# Explicit allowlist: never package reference captures, browser profiles, or credentials.
$packageInputs = @(
    (Join-Path $projectRoot 'extension'),
    (Join-Path $projectRoot 'README.md'),
    (Join-Path $projectRoot 'docs')
)
Compress-Archive -LiteralPath $packageInputs -DestinationPath $outputZip -Force
Write-Output $outputZip
