function isHttpUrl(value) {
    if (!value) return false;
    try {
        const u = new URL(String(value).trim());
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) {
        return false;
    }
}

/** 校验并规范化一个站点对象，返回 { site } 或 { error } */
function validateSite(input) {
    input = input || {};

    const site = { DESCRIPTION: '', ImgURL: '', GQL_API: '', AUTHOR_TAG: '', ATTRIBUTION_PAGE: '' };

    site.NAME = String(input.NAME || '').trim();
    if (!site.NAME) return { error: '站点名称 (NAME) 不能为空' };
    if (site.NAME.length > 100) return { error: '站点名称不能超过 100 个字符' };

    site.URL = String(input.URL || '').trim();
    if (!isHttpUrl(site.URL)) return { error: '站点 URL 必须是有效的 http(s) 链接' };

    site.PARAM = String(input.PARAM || '').trim();
    if (!/^[A-Za-z0-9_-]{1,30}$/.test(site.PARAM)) {
        return { error: 'PARAM 只能包含字母、数字、下划线和连字符（1-30 位），如 dfc' };
    }

    site.WIKIT_ID = String(input.WIKIT_ID || '').trim();
    if (!/^[A-Za-z0-9_.-]{1,80}$/.test(site.WIKIT_ID)) {
        return { error: 'WIKIT_ID 只能包含字母、数字、点、下划线和连字符（1-80 位）' };
    }

    // 可选字段
    if (input.DESCRIPTION !== undefined) {
        if (typeof input.DESCRIPTION !== 'string') return { error: '站点说明必须是文本' };
        site.DESCRIPTION = input.DESCRIPTION.trim();
    }
    if (input.ImgURL) {
        const imgUrl = String(input.ImgURL).trim();
        if (!isHttpUrl(imgUrl)) return { error: 'Logo 链接 (ImgURL) 必须是有效的 http(s) 链接' };
        site.ImgURL = imgUrl;
    }
    if (input.GQL_API) {
        const gql = String(input.GQL_API).trim();
        if (!isHttpUrl(gql)) return { error: 'GraphQL 端点 (GQL_API) 必须是有效的 http(s) 链接' };
        site.GQL_API = gql;
    }
    if (input.AUTHOR_TAG) site.AUTHOR_TAG = String(input.AUTHOR_TAG).trim();
    if (input.ATTRIBUTION_PAGE) {
        const attrPage = String(input.ATTRIBUTION_PAGE).trim().slice(0, 100);
        if (!/^[A-Za-z0-9_.:-]{1,100}$/.test(attrPage)) {
            return { error: '归属资料页面 (ATTRIBUTION_PAGE) 只能包含字母、数字、点、下划线、冒号和连字符' };
        }
        site.ATTRIBUTION_PAGE = attrPage;
    }

    return { site };
}

module.exports = { validateSite };
