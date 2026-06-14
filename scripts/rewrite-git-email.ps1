param(
    [Parameter(Mandatory = $true)]
    [string] $OldEmail,

    [string] $NewEmail = "",
    [string] $NewName = "",
    [string] $BackupPath = "",
    [switch] $NoBackup,
    [switch] $KeepOriginalRefs,
    [switch] $Force
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
    & git @args
    if ($LASTEXITCODE -ne 0) {
        throw "git $args failed with exit code $LASTEXITCODE"
    }
}

function Get-GitValue {
    param([string[]] $Arguments)
    $value = & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        return ""
    }
    return ($value -join "`n").Trim()
}

$repoRoot = Get-GitValue @("rev-parse", "--show-toplevel")
if (-not $repoRoot) {
    throw "This script must be run inside a Git repository."
}

Set-Location $repoRoot

if (-not $NewEmail) {
    $NewEmail = Get-GitValue @("config", "user.email")
}
if (-not $NewName) {
    $NewName = Get-GitValue @("config", "user.name")
}
if (-not $NewEmail) {
    throw "NewEmail is empty. Set git config user.email or pass -NewEmail."
}
if (-not $NewName) {
    throw "NewName is empty. Set git config user.name or pass -NewName."
}

$dirty = Get-GitValue @("status", "--porcelain")
if ($dirty -and -not $Force) {
    throw "Working tree is not clean. Commit/stash changes first, or pass -Force if you know what you are doing."
}

$matches = Get-GitValue @("log", "--all", "--format=%H %an <%ae> %cn <%ce>")
if ($matches -notmatch [regex]::Escape($OldEmail)) {
    Write-Host "No commits found with email: $OldEmail"
    exit 0
}

if (-not $NoBackup) {
    if (-not $BackupPath) {
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $BackupPath = Join-Path $repoRoot ".git/email-rewrite-backup-$timestamp.bundle"
    }

    if (Test-Path $BackupPath) {
        throw "Backup file already exists: $BackupPath"
    }

    Invoke-Git @("bundle", "create", $BackupPath, "--all")
    Write-Host "Created local backup bundle: $BackupPath"
}

$escapedOldEmail = $OldEmail.Replace("'", "'\''")
$escapedNewEmail = $NewEmail.Replace("'", "'\''")
$escapedNewName = $NewName.Replace("'", "'\''")

$envFilter = @"
OLD_EMAIL='$escapedOldEmail'
NEW_NAME='$escapedNewName'
NEW_EMAIL='$escapedNewEmail'

if [ "`$GIT_COMMITTER_EMAIL" = "`$OLD_EMAIL" ]; then
    export GIT_COMMITTER_NAME="`$NEW_NAME"
    export GIT_COMMITTER_EMAIL="`$NEW_EMAIL"
fi

if [ "`$GIT_AUTHOR_EMAIL" = "`$OLD_EMAIL" ]; then
    export GIT_AUTHOR_NAME="`$NEW_NAME"
    export GIT_AUTHOR_EMAIL="`$NEW_EMAIL"
fi
"@

Write-Host "Rewriting Git history..."
Write-Host "Old email: $OldEmail"
Write-Host "New identity: $NewName <$NewEmail>"

Invoke-Git @(
    "filter-branch",
    "--force",
    "--env-filter",
    $envFilter,
    "--tag-name-filter",
    "cat",
    "--",
    "--branches",
    "--tags"
)

if (-not $KeepOriginalRefs) {
    $originalRefs = & git for-each-ref --format="%(refname)" refs/original/
    if ($LASTEXITCODE -ne 0) {
        throw "git for-each-ref refs/original failed with exit code $LASTEXITCODE"
    }

    foreach ($ref in $originalRefs) {
        if ($ref) {
            Invoke-Git @("update-ref", "-d", $ref)
        }
    }

    Invoke-Git @("reflog", "expire", "--expire=now", "--all")
    Invoke-Git @("gc", "--prune=now")
}

$remaining = Get-GitValue @("log", "--branches", "--tags", "--format=%ae %ce")
if ($remaining -match [regex]::Escape($OldEmail)) {
    throw "Rewrite finished, but the old email is still present in the history."
}

Write-Host "Done. Old email no longer appears in author/committer metadata."
Write-Host "Verify with:"
Write-Host "  git log --all --format='%h %an <%ae> | %cn <%ce>'"
