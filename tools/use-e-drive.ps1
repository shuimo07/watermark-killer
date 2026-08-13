# E 盘重定向：C 盘空间紧张，所有缓存/临时文件指向 E 盘
# 用法：每条命令前 dot-source：. E:\AI\tools\use-e-drive.ps1
$env:TMP = 'E:\AI\.tmp'
$env:TEMP = 'E:\AI\.tmp'
$env:npm_config_cache = 'E:\AI\.npm-cache'
$env:COREPACK_HOME = 'E:\AI\.corepack'
$env:CHROME_USER_DATA = 'E:\AI\.chrome-test'
