$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $repoRoot 'backend'
$backendEnv = Join-Path $backendDir '.env'
$runner = Join-Path $backendDir 'run_backend.py'

function Test-Python {
    param([string]$PathValue)

    if (-not (Test-Path $PathValue)) {
        return $false
    }

    try {
        $output = & $PathValue -c "print('PY_OK')" 2>&1
        return ($LASTEXITCODE -eq 0 -and ($output -join "`n") -match 'PY_OK')
    }
    catch {
        return $false
    }
}

function Get-PythonExecutable {
    $candidates = @(
        'C:\Users\User\AppData\Local\Programs\Python\Python314\python.exe',
        (Join-Path $backendDir 'venv\Scripts\python.exe'),
        (Join-Path $repoRoot '.venv\Scripts\python.exe')
    )

    foreach ($candidate in $candidates) {
        if (Test-Python -PathValue $candidate) {
            return $candidate
        }
    }

    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCommand -and (Test-Python -PathValue $pythonCommand.Source)) {
        return $pythonCommand.Source
    }

    throw 'No encontré un Python funcional para arrancar el backend.'
}

function Import-EnvFile {
    param([string]$PathValue)

    if (-not (Test-Path $PathValue)) {
        return
    }

    Get-Content $PathValue | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith('#')) {
            return
        }

        $parts = $line.Split('=', 2)
        if ($parts.Count -ne 2) {
            return
        }

        $name = $parts[0].Trim()
        $value = $parts[1].Trim()
        if ($value.Length -ge 2 -and (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        )) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
}

Import-EnvFile -PathValue $backendEnv
$pythonExe = Get-PythonExecutable

Write-Host "Usando Python: $pythonExe"
Write-Host 'Iniciando SmartPark backend en http://127.0.0.1:5000 ...'

Push-Location $repoRoot
try {
    & $pythonExe $runner
}
finally {
    Pop-Location
}
