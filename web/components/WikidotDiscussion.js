import React, { useState, useEffect } from 'react';

const PostItem = ({ post }) => {
    return (
        <div className="mt-4 first:mt-0">
            <div className="bg-panel border border-line rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3 border-b border-line pb-2">
                    <img
                        src={post.avatarUrl}
                        alt="avatar"
                        className="w-8 h-8 rounded border border-line object-cover"
                        onError={(e) => { e.target.src = 'https://www.wikidot.com/avatar.php?account=default'; }}
                    />
                    <div>
                        <div className="text-sm font-bold text-fg-2">{post.author}</div>
                        <div className="text-xs text-fg-3">{post.timestamp}</div>
                    </div>
                </div>

                <div
                    className="text-fg-2 text-sm leading-relaxed prose prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: post.contentHtml }}
                ></div>
            </div>

            {post.children && post.children.length > 0 && (
                <div className="pl-4 sm:pl-8 mt-2 border-l-2 border-line">
                    {post.children.map(child => (
                        <PostItem key={child.postId} post={child} />
                    ))}
                </div>
            )}
        </div>
    );
};

const WikidotDiscussion = ({ wiki, pageId }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const [anonContent, setAnonContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitMsg, setSubmitMsg] = useState('');
    useEffect(() => {
        if (!wiki || !pageId) return;
        const controller = new AbortController();
        setLoading(true);
        setError('');

        const fetchDiscussion = async () => {
            try {
                const res = await fetch(`/api/wikidot-forum?wiki=${encodeURIComponent(wiki)}&pageId=${encodeURIComponent(pageId)}&p=${currentPage}`, {
                    signal: controller.signal,
                });
                const json = await res.json();

                if (!res.ok) throw new Error(json.error || '请求失败');
                setData(json);
            } catch (err) {
                if (!controller.signal.aborted) setError(err.message);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        fetchDiscussion();
        return () => controller.abort();
    }, [wiki, pageId, currentPage]);

    const handleAnonSubmit = async () => {
        if (!anonContent.trim() || !data || !data.threadId) return;
        setIsSubmitting(true);
        setSubmitMsg('');

        try {
            const username = localStorage.getItem('username');
            if (!username) {
                setSubmitMsg('未检测到本地登录凭证，请先登录');
                setIsSubmitting(false);
                return;
            }

            const res = await fetch('/api/anon-reply', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // 强制携带 Cookie
                body: JSON.stringify({
                    username: username,
                    wiki: wiki,
                    threadId: data.threadId,
                    content: anonContent
                })
            });

            const resData = await res.json();
            if (res.ok) {
                setSubmitMsg('代理发送成功，内容可能需要等待下次刷新才能在本地看到。');
                setAnonContent('');
            } else {
                setSubmitMsg(resData.error || '投递失败');
            }
        } catch (err) {
            setSubmitMsg('网络连接异常');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!wiki || !pageId) return null;

    return (
        <div className="w-full mt-12 pt-8 border-t border-line">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-fg flex items-center gap-2">
                    <i className="fa-brands fa-wikipedia-w text-fg-3"></i> 原站讨论区
                    {data && <span className="text-xs bg-accent-soft text-accent px-2 py-1 rounded-full border border-accent-line">{data.total} 条记录</span>}
                </h3>
                {data && data.url && (
                    <a
                        href={data.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-fg-3 hover:text-fg transition-colors"
                    >
                        去原站查看 <i className="fa-solid fa-arrow-up-right-from-square ml-1"></i>
                    </a>
                )}
            </div>

            {loading && <div className="text-center py-10 text-fg-3 animate-pulse">正在加载讨论数据...</div>}

            {error && (
                <div className="text-center py-8 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {!loading && !error && data && data.threads && data.threads.length === 0 && (
                <div className="text-center py-10 text-fg-3 bg-sunken rounded-xl border border-dashed border-line">
                    这篇文档目前在原站没有任何人评论。
                </div>
            )}

            {!loading && !error && data && data.threads && data.threads.length > 0 && (
                <div className="space-y-4 mb-8">
                    {data.threads.map(post => (
                        <PostItem key={post.postId} post={post} />
                    ))}
                </div>
            )}
            {data && data.maxPage > 1 && (
                <div className="flex items-center justify-center gap-4 my-6">
                    <button
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={loading || currentPage <= 1}
                        aria-label="讨论上一页"
                        title="上一页"
                        className="p-2 text-fg-2 hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <i className="fa-solid fa-chevron-left" aria-hidden="true"></i>
                    </button>
                    <span className="text-sm text-fg-3">{currentPage} / {data.maxPage}</span>
                    <button
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={loading || currentPage >= data.maxPage}
                        aria-label="讨论下一页"
                        title="下一页"
                        className="p-2 text-fg-2 hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
                    </button>
                </div>
            )}

            {data && data.threadId && (
                <div className="bg-panel p-5 rounded-xl border border-line mt-6">
                    <h4 className="text-sm font-bold text-fg-2 mb-3 flex items-center gap-2">
                        发送代理回复
                        <span className="text-xs font-normal text-fg-3 bg-sunken px-2 py-0.5 rounded">消耗 100 余额</span>
                    </h4>
                    <textarea
                        value={anonContent}
                        onChange={(e) => setAnonContent(e.target.value)}
                        placeholder="想说点什么？所有回复将通过系统账号发送至原站，并附带您的实名标记以确保合规。"
                        className="w-full bg-sunken border border-line text-fg rounded-lg p-3 outline-none focus:border-accent resize-none h-24 text-sm"
                        disabled={isSubmitting}
                    />
                    <div className="flex justify-between items-center mt-3">
                        <span className={`text-sm ${submitMsg.includes('成功') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {submitMsg}
                        </span>
                        <button
                            onClick={handleAnonSubmit}
                            disabled={!anonContent.trim() || isSubmitting}
                            className="px-5 py-2 bg-accent-solid hover:bg-accent-solid-hover disabled:opacity-50 text-accent-fg text-sm font-medium rounded-lg transition-colors"
                        >
                            {isSubmitting ? '正在投递...' : '提交回复'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WikidotDiscussion;
