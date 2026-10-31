const { spawn } = require('child_process');
const path = require('path');
require('@next/env').loadEnvConfig(path.join(__dirname, '..'), process.env.NODE_ENV !== 'production');
const prisma = require('@wikitdb/shared/prisma');
const { getSites } = require('@wikitdb/shared/sites');
const { buildBackupArgs, getWikiName } = require('./utils/wikitBackup');

/** 备份所有配置站点，并以子进程的执行结果结束本轮任务。 */
async function runWikitBackup() {
    const configuredSites = await getSites();
    const wiki_names = configuredSites.map(getWikiName).filter(Boolean);
    if (wiki_names.length === 0) {
        console.log('[备份] 未配置有效站点，跳过。');
        return;
    }

    const args = buildBackupArgs({ wikiNames: wiki_names, keepRemoved: true });
    console.log(`[备份] 开始备份 ${wiki_names.length} 个站点。`);
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
    console.log('[备份] 完成。');
}

runWikitBackup().finally(async () => {
    await prisma.$disconnect();
}).catch((error) => {
    process.exitCode = 1;
    console.log(`[备份] 失败: ${error.message}`);
});
