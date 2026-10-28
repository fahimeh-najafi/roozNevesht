param([switch]$Remove)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$StartupDirectory = [Environment]::GetFolderPath('Startup')
$ShortcutPath = Join-Path $StartupDirectory 'Daybook.lnk'
$Shell = New-Object -ComObject WScript.Shell

if ($Remove) {
    $Shortcut = $Shell.CreateShortcut($ShortcutPath)
    if ((Test-Path $ShortcutPath) -and $Shortcut.Arguments -like "*$ProjectRoot*") {
        Remove-Item $ShortcutPath
    }
    $PidFile = Join-Path $ProjectRoot 'data\background.pid'
    if (Test-Path $PidFile) {
        $BackgroundId = [int](Get-Content $PidFile)
        $Process = Get-CimInstance Win32_Process -Filter "ProcessId = $BackgroundId"
        if ($Process -and $Process.CommandLine -like "*$(Join-Path $ProjectRoot 'server\supervisor.js')*") {
            Get-CimInstance Win32_Process -Filter "ParentProcessId = $BackgroundId" |
                Where-Object { $_.CommandLine -like "*$(Join-Path $ProjectRoot 'server\index.js')*" } |
                ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
            Stop-Process -Id $BackgroundId -Force -ErrorAction SilentlyContinue
            Remove-Item $PidFile -ErrorAction SilentlyContinue
        }
    }
    Write-Output 'Daybook automatic startup removed.'
    exit
}

if (-not (Test-Path (Join-Path $ProjectRoot 'dist\index.html'))) {
    throw 'Build Daybook first with npm.cmd run build.'
}
$Node = (Get-Command node.exe -ErrorAction Stop).Source
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $Node
$Shortcut.Arguments = '"' + (Join-Path $ProjectRoot 'server\supervisor.js') + '"'
$Shortcut.WorkingDirectory = $ProjectRoot
$Shortcut.WindowStyle = 7
$Shortcut.Description = 'Private Daybook calendar and SQLite server'
$Shortcut.Save()
Write-Output "Automatic startup installed: $ShortcutPath"
Write-Output 'Daybook will start when you sign in to Windows. No administrator access is required.'