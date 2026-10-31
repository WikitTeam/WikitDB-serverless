/**
 * WikitDB 归属资料单次同步任务
 * 抓取各站点的「归属资料页」和 listpages 页面评分，
 * 同步 author_attributions 表并聚合作者分数（author_score:{site}）。
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
require('@next/env').loadEnvConfig(path.join(__dirname, '..'), process.env.NODE_ENV !== 'production');
const prisma = require('@wikitdb/shared/prisma');
const config = require('@wikitdb/shared/config');
const { fetchAttributionPage, aggregateAuthorScores, normalizePageKey } = require('./utils/attribution');

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 10 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });
const request = require('axios').create({
    httpAgent,
    httpsAgent,
    timeout: 30000,
    validateStatus: (s) => s >= 200 && s < 400
});

const LOG_FILE = path.join(__dirname, '..', 'crawler.log');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function logLine(...args) {
    const line = args.map(String).join(' ');
    console.log(line);
    try {
        fs.appendFileSync(LOG_FILE, `[${new Date().toLocaleString()}] ${line}\n`, 'utf8');
    } catch (e) { /* 忽略 */ }
}

/** 获取站点全部页面及评分（listpages 分页） */
async function fetchAllPages(siteConfig) {
    const actualWikiName = siteConfig.URL.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('.')[0];
    const baseUrl = siteConfig.URL.replace(/\/$/, '');
    const pages = [];
    let pageNum = 1;
    let totalPages = 1;

    while (true) {
        const res = await request.get(`https://wikit.unitreaty.org/listpages?wiki=${actualWikiName}&p=${pageNum}`);
        const lines = String(res.data).split('\n').map(l => l.trim()).filter(Boolean);

        const totalMatch = lines.find(l => l.startsWith('Total Pages:'))?.match(/(\d+)/);
        if (totalMatch) totalPages = parseInt(totalMatch[1], 10) || 1;

        let countThisPage = 0;
        for (const line of lines) {
            if (!line.startsWith('http')) continue;
            const parts = line.split('|').map(s => s.trim());
            if (parts.length < 6) continue;
            const pageSlug = parts[0].split('/').pop();
            pages.push({
                page: pageSlug,
                title: parts[1] || '',
                rating: parseInt(parts[3], 10) || 0,
                upvotes: parseInt(parts[4], 10) || 0,
                downvotes: parseInt(parts[5], 10) || 0
            });
            countThisPage++;
        }

        if (pageNum >= totalPages || countThisPage === 0) break;
        pageNum++;
        await sleep(400);
    }
    return pages;
}

/** 处理单个站点：抓归属页 + 页面评分 + 聚合作者分数 */
async function processSite(siteConfig) {
    const wikiParam = siteConfig.PARAM;
    const attrRecords = await fetchAttributionPage(siteConfig, request);
    if (attrRecords.length === 0) {
        logLine(`[归属] ${wikiParam} 归属资料页无有效数据，跳过`);
        return;
    }

    // 1. 全量同步归属记录
    await prisma.$transaction([
        prisma.authorAttribution.deleteMany({ where: { siteParam: wikiParam } }),
        prisma.authorAttribution.createMany({
            data: attrRecords.map(a => ({ siteParam: wikiParam, page: a.page, username: a.username, type: a.type, date: a.date })),
            skipDuplicates: true
        })
    ]);

    // 2. 获取页面评分（listpages）
    const allPages = await fetchAllPages(siteConfig);

    // 3. 保存页面评分
    const pageScoreRows = allPages.map(p => ({
        page: p.page, title: p.title, rating: p.rating,
        upvotes: p.upvotes, downvotes: p.downvotes
    }));
    await prisma.setting.upsert({
        where: { key: `page_scores:${wikiParam}` },
        update: { value: JSON.stringify(pageScoreRows) },
        create: { key: `page_scores:${wikiParam}`, value: JSON.stringify(pageScoreRows) }
    });

    // 4. 按归属聚合作者分数（每个归属用户获得页面全分）
    const pageRatings = new Map();
    for (const pg of allPages) pageRatings.set(normalizePageKey(pg.page), { rating: pg.rating });
    const authorScores = aggregateAuthorScores(attrRecords, pageRatings);
    await prisma.setting.upsert({
        where: { key: `author_score:${wikiParam}` },
        update: { value: JSON.stringify(authorScores) },
        create: { key: `author_score:${wikiParam}`, value: JSON.stringify(authorScores) }
    });

    logLine(`[归属] ${wikiParam} 归属 ${attrRecords.length} 条 | 页面评分 ${allPages.length} | 作者 ${Object.keys(authorScores).length} 位`);
}

/** 同步一轮归属资料，隔离站点失败并设置整轮退出码。 */
async function runAttribution() {
    const start = Date.now();
    let failedSites = 0;
    // 只同步配置了归属资料页的站点。
    const sites = config.SUPPORT_WIKI.filter(w => w.ATTRIBUTION_PAGE);
    logLine(`[归属] 开始执行（${sites.length} 个站点配置了归属资料页）...`);
    for (const siteConfig of sites) {
        try {
            await processSite(siteConfig);
        } catch (e) {
            failedSites++;
            process.exitCode = 1;
            logLine(`[归属] ${siteConfig.PARAM} 处理失败: ${e.message}`);
        }
    }
    logLine(`[归属] ${failedSites ? '失败' : '完成'}：站点失败 ${failedSites}/${sites.length}，耗时 ${Math.round((Date.now() - start) / 1000)}s`);
}

// 无论同步结果如何，都释放本轮使用的连接。
runAttribution().finally(async () => {
    httpAgent.destroy();
    httpsAgent.destroy();
    await prisma.$disconnect();
}).catch((error) => {
    // 报告未被站点隔离处理的任务或资源释放异常。
    process.exitCode = 1;
    logLine(`[归属] 任务失败: ${error.message}`);
});
