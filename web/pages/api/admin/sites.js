import { withAdmin } from '#utils/withAdmin';
import { validateSite } from '#utils/siteConfig';
import { runSerializable } from '#utils/transaction';
import prisma from '@wikitdb/shared/prisma';
const { getSites } = require('@wikitdb/shared/sites');

async function handler(req, res) {
    try {
        if (req.method === 'GET') {
            return res.status(200).json({ sites: await getSites() });
        }
        if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const param = String((req.body && req.body.param) || req.query.param || '').trim();
        if (req.method === 'PUT' && !param) {
            return res.status(400).json({ error: '缺少要编辑的站点 PARAM' });
        }
        const result = req.method === 'DELETE' ? null : validateSite(req.body);
        if (result?.error) return res.status(400).json({ error: result.error });

        // 重试事务时仅重做数据库操作，提交成功后再发送 HTTP 响应。
        const response = await runSerializable(prisma, async (tx) => {
            const sites = await getSites(tx);
            if (req.method === 'DELETE') {
                if (sites.length <= 1) {
                    return { status: 400, body: { error: '至少需要保留一个站点，不能删除全部站点' } };
                }
                if (!sites.some(s => s.PARAM === param)) {
                    return { status: 404, body: { error: '未找到该站点' } };
                }
                await tx.site.delete({ where: { PARAM: param } });
            } else {
                if (req.method === 'PUT' && !sites.some(s => s.PARAM === param)) {
                    return { status: 404, body: { error: '未找到该站点' } };
                }
                const otherSites = sites.filter(s => req.method === 'POST' || s.PARAM !== param);
                if (otherSites.some(s => s.PARAM === result.site.PARAM)) {
                    return { status: 400, body: { error: `PARAM "${result.site.PARAM}" 已被使用` } };
                }
                if (otherSites.some(s => s.WIKIT_ID === result.site.WIKIT_ID)) {
                    return { status: 400, body: { error: `WIKIT_ID "${result.site.WIKIT_ID}" 已被使用` } };
                }
                if (req.method === 'POST') {
                    const last = await tx.site.aggregate({ _max: { sort_order: true } });
                    await tx.site.create({ data: { ...result.site, sort_order: last._max.sort_order + 1 } });
                } else {
                    await tx.site.update({ where: { PARAM: param }, data: result.site });
                }
            }
            const body = { success: true, sites: await getSites(tx) };
            if (req.method === 'PUT') body.message = `站点 "${result.site.NAME}" 已更新`;
            return { status: 200, body };
        });
        return res.status(response.status).json(response.body);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'PARAM 或 WIKIT_ID 已被使用' });
        }
        if (error.code === 'P2025') {
            return res.status(404).json({ error: '未找到该站点' });
        }
        if (error.code === 'P2034') {
            return res.status(409).json({ error: '站点配置被同时修改，请刷新后重试' });
        }
        console.error('[sites] 处理失败:', error.message);
        return res.status(500).json({ error: error.code === 'SITES_NOT_INITIALIZED' ? error.message : '站点配置读取或保存失败' });
    }
}

export default withAdmin(handler);
