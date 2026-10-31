const path = require('path');
require('@next/env').loadEnvConfig(path.join(__dirname, '../..'), process.env.NODE_ENV !== 'production');
const prisma = require('@wikitdb/shared/prisma');
const { validateSite } = require('../utils/siteConfig');

const INITIAL_SITES = [
    {
        NAME: '深林文学部',
        DESCRIPTION: '文学创作导向',
        URL: 'https://deep-forest-club.wikidot.com/',
        ImgURL: 'https://deep-forest-club.wdfiles.com/local--files/component%3Atheme/logo.png',
        PARAM: 'dfc',
        WIKIT_ID: 'deep-forest-club',
        AUTHOR_TAG: '作者',
    },
    {
        NAME: '后室IF分站',
        DESCRIPTION: 'Backrooms 衍生',
        URL: 'https://if-backrooms.wikidot.com/',
        ImgURL: 'https://if-backrooms.wdfiles.com/local--files/start/Logo',
        PARAM: 'if',
        WIKIT_ID: 'if-backrooms',
        AUTHOR_TAG: '作者',
    },
    {
        NAME: '地下黑市',
        DESCRIPTION: '原创创作社区',
        URL: 'https://ubmh.wikidot.com/',
        ImgURL: 'https://ubmh.wdfiles.com/local--files/admin%3Atheme/ubmh.webp',
        PARAM: 'ubmh',
        WIKIT_ID: 'ubmh',
        AUTHOR_TAG: '作者',
    },
    {
        NAME: 'SCP基金会云国分部',
        DESCRIPTION: 'SCP 同人',
        URL: 'https://scp-wiki-cloud.wikidot.com/',
        ImgURL: 'https://scp-wiki-cloud.wdfiles.com/local--files/start/scp-cloud-logo.png',
        PARAM: 'scp-wiki-cloud',
        WIKIT_ID: 'scp-wiki-cloud',
        AUTHOR_TAG: '作者',
    },
    {
        NAME: '规则怪谈档案馆',
        DESCRIPTION: '规则怪谈专题',
        URL: 'https://rule-wiki.wikidot.com/',
        ImgURL: 'https://rule-wiki.wdfiles.com/local--files/component%3Atheme/rule-wiki-new.svg',
        PARAM: 'rule',
        WIKIT_ID: 'rule-wiki',
        AUTHOR_TAG: '作者',
    },
    {
        NAME: '纸上书',
        DESCRIPTION: '纸笔主题创作',
        URL: 'https://write-on-paper.wikidot.com/',
        ImgURL: 'https://woptheme.pages.dev/images/penlogoround_l_command.png',
        PARAM: 'wop',
        WIKIT_ID: 'write-on-paper',
    },
    {
        NAME: 'The Backrooms X层群',
        DESCRIPTION: 'Backrooms 衍生',
        URL: 'https://backrooms-x-cn.wikidot.com/',
        ImgURL: 'http://backrooms-x-cn.wikidot.com/local--files/start/xlogo',
        PARAM: 'x',
        WIKIT_ID: 'backrooms-x-cn',
    },
    {
        NAME: '世界机构联合体',
        DESCRIPTION: '世界观共创',
        URL: 'https://pin-wiki.wikidot.com/',
        ImgURL: 'https://odilpin.wikidot.com/local--files/system%3Astart/pin-LOGO',
        PARAM: 'pin',
        WIKIT_ID: 'pin-wiki',
    },
    {
        NAME: 'SCP基金会Minecraft分部',
        DESCRIPTION: 'SCP + MC 融合',
        URL: 'https://scp-wiki-mc.wikidot.com/',
        ImgURL: 'https://scp-wiki-mc.wikidot.com/local--files/theme:black-highlighter-theme/mclogo2.svg',
        PARAM: 'scp-wiki-mc',
        WIKIT_ID: 'scp-wiki-mc',
    },
    {
        NAME: 'The Bsckrooms中文维基',
        DESCRIPTION: 'Backrooms 主分社区',
        URL: 'https://backrooms-wiki-cn.wikidot.com/',
        ImgURL: 'https://7bye.com/hoah/i/2023/12/31/5hsx3.svg',
        PARAM: 'brcn',
        WIKIT_ID: 'backrooms-wiki-cn',
        GQL_API: 'https://wikit.unitreaty.org/backrooms/apiv1/graphql',
        ATTRIBUTION_PAGE: 'attribution-metadata',
    },
];

/** 仅在站点表为空时，原子导入初始列表并保留其顺序。 */
async function importSites() {
    const site_rows = INITIAL_SITES.map((input, sort_order) => {
        const result = validateSite(input);
        if (result.error) throw new Error(`${input.PARAM}: ${result.error}`);
        return { ...result.site, sort_order };
    });
    // 串行化隔离使并发初始化不能覆盖或合并出重复列表。
    const imported = await prisma.$transaction(async (transaction) => {
        if (await transaction.site.count() > 0) return false;
        await transaction.site.createMany({ data: site_rows });
        return true;
    }, { isolationLevel: 'Serializable' });
    console.log(imported ? `已导入 ${site_rows.length} 个站点。` : '站点表已有数据，未执行导入。');
}

importSites().finally(async () => {
    await prisma.$disconnect();
}).catch((error) => {
    console.error('[站点导入] 失败:', error.message);
    process.exitCode = 1;
});
