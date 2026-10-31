const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
require('@next/env').loadEnvConfig(path.join(__dirname, '..'), process.env.NODE_ENV !== 'production');
const config = require('@wikitdb/shared/config');
const { buildBackupArgs, getWikiName } = require('./utils/wikitBackup');

/** 将备份状态同时写入控制台和管理后台使用的日志文件。 */
function logLine(message) {
    console.log(message);
    try {
        fs.appendFileSync(path.join(__dirname, '..', 'crawler.log'), `[${new Date().toLocaleString()}] ${message}\n`, 'utf8');
    } catch (error) { /* 日志文件写入失败不影响备份进程 */ }
}

/** 备份所有配置站点，并以子进程的执行结果结束本轮任务。 */
async function runWikitBackup() {
    const wiki_names = config.SUPPORT_WIKI.map(getWikiName).filter(Boolean);
    if (wiki_names.length === 0) {
        logLine('[备份] 未配置有效站点，跳过。');
        return;
    }

    const args = buildBackupArgs({ wikiNames: wiki_names, keepRemoved: true });
    logLine(`[备份] 开始备份 ${wiki_names.length} 个站点。`);
    // 等待子进程结束，将启动失败、非零退出和信号终止传给任务入口。
    await new Promise((resolve, reject) => {
        const child = spawn('wikit', args, {
            cwd: path.join(__dirname, '..'),
            env: process.env,
            shell: false,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        // 将备份输出转到当前进程的日志流。
        child.stdout.on('data', (chunk) => process.stdout.write(`[wikit] ${chunk}`));
        // 将备份错误输出转到当前进程的错误流。
        child.stderr.on('data', (chunk) => process.stderr.write(`[wikit] ${chunk}`));
        child.once('error', reject);
        // 只有正常的零退出码表示备份成功。
        child.once('close', (code, signal) => {
            if (code === 0 && !signal) resolve();
            else reject(new Error(signal ? `备份被信号 ${signal} 终止` : `备份退出码 ${code}`));
        });
    });
    logLine('[备份] 完成。');
}

// 向调用方报告失败，不强制中断尚未输出的日志。
runWikitBackup().catch((error) => {
    process.exitCode = 1;
    logLine(`[备份] 失败: ${error.message}`);
});
