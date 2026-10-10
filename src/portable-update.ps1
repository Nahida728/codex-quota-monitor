param([Parameter(Mandatory=$true)][string]$ConfigPath)
$ErrorActionPreference = 'Stop'
$updateReplaced = $false
function Get-UpdateChecksum([string]$UpdateFile) {
  $updateStream = [IO.File]::OpenRead($UpdateFile)
  $updateHasher = [Security.Cryptography.SHA256]::Create()
  try { return [BitConverter]::ToString($updateHasher.ComputeHash($updateStream)).Replace('-', '').ToLowerInvariant() }
  finally { $updateStream.Dispose(); $updateHasher.Dispose() }
}
function Get-UpdateProcess([int]$UpdatePid) {
  try { return [Diagnostics.Process]::GetProcessById($UpdatePid) } catch { return $null }
}
function Start-UpdateExecutable([string]$UpdateFile) {
  $updateLaunch = New-Object Diagnostics.ProcessStartInfo
  $updateLaunch.FileName = $UpdateFile
  $updateLaunch.UseShellExecute = $true
  $updateLaunch.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
  [void][Diagnostics.Process]::Start($updateLaunch)
}
try {
  $updateConfig = [IO.File]::ReadAllText($ConfigPath) | ConvertFrom-Json
  $updateTarget = [IO.Path]::GetFullPath($updateConfig.target)
  $updateStaged = [IO.Path]::GetFullPath($updateConfig.staged)
  $updateRoot = [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($ConfigPath))
  if ([IO.Path]::GetDirectoryName($updateStaged) -ne $updateRoot -or [IO.Path]::GetExtension($updateTarget) -ne '.exe') { throw 'Invalid update paths' }
  if ((Get-UpdateChecksum $updateStaged) -ne $updateConfig.sha256) { throw 'Invalid update checksum' }
  $updateDeadline = [DateTime]::UtcNow.AddSeconds(120)
  do {
    $updateMain = Get-UpdateProcess $updateConfig.pid
    $updateParent = Get-UpdateProcess $updateConfig.parentPid
    $updateBootstrap = $updateParent -and $updateParent.MainModule.FileName -eq $updateTarget
    if (-not $updateMain -and -not $updateBootstrap) { break }
    Start-Sleep -Milliseconds 250
  } while ([DateTime]::UtcNow -lt $updateDeadline)
  if ($updateMain -or $updateBootstrap) { throw 'Monitor did not exit' }
  $updateCandidate = $updateTarget + '.pending.exe'
  $updateBackup = $updateTarget + '.previous.exe'
  [IO.File]::Copy($updateStaged, $updateCandidate, $true)
  if ((Get-UpdateChecksum $updateCandidate) -ne $updateConfig.sha256) { throw 'Invalid copied checksum' }
  [IO.File]::Replace($updateCandidate, $updateTarget, $updateBackup, $true)
  $updateReplaced = $true
  Start-UpdateExecutable $updateTarget
} catch {
  # Static diagnostics only; do not persist private filesystem paths or exception text.
  [IO.File]::WriteAllText([IO.Path]::Combine([IO.Path]::GetDirectoryName($ConfigPath), 'handover-status.txt'), 'Update could not be applied. The previous executable is retained.')
  if ($updateReplaced -and [IO.File]::Exists($updateBackup)) {
    try { [IO.File]::Replace($updateBackup, $updateTarget, $updateCandidate, $true) } catch {}
  }
  if ($updateTarget -and [IO.File]::Exists($updateTarget) -and -not (Get-UpdateProcess $updateConfig.pid)) {
    try { Start-UpdateExecutable $updateTarget } catch {}
  }
}
