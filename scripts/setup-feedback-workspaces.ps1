param(
    [ValidateSet('karosserie','licht','ui','leuchten','felgen')]
    [string[]]$Roles = @('karosserie','licht')
)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$workspaceParent = Join-Path $projectRoot '.feedback-workspaces'
$baselineFiles = @('package.json','package-lock.json','index.html','tsconfig.json','vite.config.ts','HANDOFF-0.12.md','UMSETZUNG-0.12.md')
$baselineFolders = @('src','public','scripts')
$dependencyTarget = (Resolve-Path -LiteralPath (Join-Path $projectRoot 'node_modules')).Path
$report = @()
$ports = @{ karosserie = 5271; licht = 5272; ui = 5273; leuchten = 5274; felgen = 5275 }
foreach ($role in $Roles) {
    $destination = Join-Path $workspaceParent $role
    if (Test-Path -LiteralPath $destination) { throw "Arbeitskopie existiert bereits; keine vorhandene Arbeit wird ersetzt: $destination" }
}
foreach ($role in $Roles) {
    $destination = Join-Path $workspaceParent $role
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    foreach ($name in $baselineFiles) {
        Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination (Join-Path $destination $name)
    }
    foreach ($name in $baselineFolders) {
        Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination (Join-Path $destination $name) -Recurse
    }
    $vitePath = Join-Path $destination 'vite.config.ts'
    $viteSource = Get-Content -LiteralPath $vitePath -Raw
    if ($viteSource -notmatch 'cacheDir\s*:') {
        $viteSource = $viteSource.Replace('export default defineConfig({', "export default defineConfig({`n  cacheDir: `".vite-local`",")
    }
    $viteSource = $viteSource -replace 'port:\s*5268', ('port: ' + $ports[$role])
    $viteSource | Set-Content -LiteralPath $vitePath -Encoding utf8
    $evidenceDestination = Join-Path $destination 'proofs/2026-10-24'
    New-Item -ItemType Directory -Path $evidenceDestination -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectRoot 'proofs/2026-10-24/fidelity') -Destination (Join-Path $evidenceDestination 'fidelity') -Recurse
    New-Item -ItemType Junction -Path (Join-Path $destination 'node_modules') -Value $dependencyTarget | Out-Null
    $manifest = foreach ($folder in @('src','public','scripts')) {
        Get-ChildItem -LiteralPath (Join-Path $destination $folder) -File -Recurse | ForEach-Object {
            [pscustomobject]@{ path = $_.FullName.Substring($destination.Length + 1).Replace('\','/'); sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
        }
    }
    $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $destination 'BASELINE-SHA256.json') -Encoding utf8
    $report += [pscustomobject]@{ role = $role; path = $destination; port = $ports[$role]; files = @($manifest).Count; model = (Get-Content -LiteralPath (Join-Path $destination 'src/model-version.ts') -Raw).Trim() }
}
$report | ConvertTo-Json -Depth 4
