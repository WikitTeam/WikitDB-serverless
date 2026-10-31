const prisma = require('./prisma');

/** 按维护顺序读取站点配置；空表需先执行一次性导入。 */
async function getSites(database = prisma) {
    const sites = await database.site.findMany({
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
        select: {
            NAME: true,
            DESCRIPTION: true,
            URL: true,
            PARAM: true,
            WIKIT_ID: true,
            ImgURL: true,
            GQL_API: true,
            AUTHOR_TAG: true,
            ATTRIBUTION_PAGE: true,
        },
    });
    if (sites.length === 0) {
        const error = new Error('站点配置尚未初始化，请执行 node web/scripts/import-sites.js');
        error.code = 'SITES_NOT_INITIALIZED';
        throw error;
    }
    return sites;
}

module.exports = { getSites };
