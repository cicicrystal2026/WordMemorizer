<#
.SYNOPSIS
    把 Claude 产出的 git bundle 导入本地仓库，并推送到 GitHub。

.DESCRIPTION
    远程会话没有仓库写权限，成果以 git bundle 形式交付。
    bundle 完整保留了提交历史，导入后与正常 push 上去的效果一致。

    脚本会：
      1. 校验 bundle 完整性
      2. 把 bundle 里的分支取到本地
      3. 切到该分支
      4. 询问后推送到 GitHub（你的机器有写权限）

.EXAMPLE
    .\import-bundle.ps1 -BundlePath D:\Downloads\wordmemorizer-work.bundle
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$BundlePath,

    [string]$RepoPath = 'D:\codex-project\beidancishenqi',
    [string]$Branch   = 'claude/word-memorizer-product-design-b63tz4',
    [switch]$NoPush
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$OutputEncoding = [Console]::OutputEncoding = [Text.Encoding]::UTF8

function Write-Step ($Message) { Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Write-Ok   ($Message) { Write-Host "    $Message" -ForegroundColor Green }

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "找不到 git。请先安装 Git for Windows：https://git-scm.com/download/win"
}
if (-not (Test-Path -LiteralPath $BundlePath)) {
    throw "找不到 bundle 文件：$BundlePath"
}
if (-not (Test-Path -LiteralPath (Join-Path $RepoPath '.git'))) {
    throw "$RepoPath 不是 git 仓库。请先运行 sync-from-github.ps1 克隆下来。"
}

$BundleFull = (Resolve-Path -LiteralPath $BundlePath).Path

Push-Location -LiteralPath $RepoPath
try {
    Write-Step '校验 bundle'
    git bundle verify $BundleFull
    if ($LASTEXITCODE -ne 0) {
        throw "bundle 校验失败。可能是下载不完整，或本地缺少它依赖的基础提交（需要先有 main 分支的历史）。"
    }
    Write-Ok '校验通过'

    Write-Step '检查工作区状态'
    $dirty = git status --porcelain
    if ($dirty) {
        Write-Host $dirty
        throw "工作区有未提交的改动。请先 git commit 或 git stash。"
    }
    Write-Ok '工作区干净'

    Write-Step "从 bundle 取出分支 $Branch"
    git fetch $BundleFull "${Branch}:${Branch}"
    if ($LASTEXITCODE -ne 0) { throw "从 bundle 取分支失败。" }
    Write-Ok '取出成功'

    git checkout $Branch
    Write-Step '导入的提交'
    git log --oneline main..$Branch

    if ($NoPush) {
        Write-Step '按 -NoPush 参数跳过推送'
        Write-Host "    手动推送：git push -u origin $Branch"
        return
    }

    Write-Step '推送到 GitHub'
    $answer = Read-Host "    确认推送分支 $Branch 到 origin？(y/N)"
    if ($answer -notmatch '^[Yy]') {
        Write-Host "    已跳过。稍后可手动执行：git push -u origin $Branch"
        return
    }

    git push -u origin $Branch
    if ($LASTEXITCODE -ne 0) {
        throw "推送失败。确认你的 git 凭据有该仓库的写权限。"
    }
    Write-Ok "推送完成：https://github.com/cicicrystal2026/wordmemorizer/tree/$Branch"
}
finally {
    Pop-Location
}
