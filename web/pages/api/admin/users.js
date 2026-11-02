import prisma from '@wikitdb/shared/prisma';
import bcrypt from 'bcryptjs';
import { withAdmin } from '#utils/withAdmin';

function parseStaffSites(value) {
    if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean);
    if (typeof value === 'string' && value.trim()) {
        try {
            const arr = JSON.parse(value);
            if (Array.isArray(arr)) return arr.map((s) => String(s).trim()).filter(Boolean);
        } catch (e) { /* 忽略 */ }
        return value.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return [];
}

async function handler(req, res) {
    if (req.method === 'GET') {
        // 增加分页支持，防止大批量读取造成性能瓶颈
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 50, 1), 100);

        const [usersData, total] = await Promise.all([
            prisma.user.findMany({
                orderBy: { balance: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
                select: {
                    username: true,
                    wikidotAccount: true,
                    balance: true,
                    isAdmin: true,
                    isStaff: true,
                    staffSites: true,
                    status: true,
                    createdAt: true
                }
            }),
            prisma.user.count()
        ]);

        const users = usersData.map(u => ({
            username: u.username,
            wikidotAccount: u.wikidotAccount || '',
            balance: u.balance || 0,
            role: u.isAdmin ? 'admin' : 'user',
            isStaff: u.isStaff,
            staffSites: parseStaffSites(u.staffSites),
            status: u.status || 'active',
            createdAt: u.createdAt
        }));

        return res.status(200).json({ 
            users, 
            pagination: {
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    }

    if (req.method === 'POST') {
        const { targetUser, action, staffSites, password } = req.body || {};
        const operator = req.admin.username; // 从 withAdmin 挂载的数据中获取

        if (action === 'create') {
            if (typeof targetUser !== 'string' || targetUser.length < 2 || targetUser.length > 20) {
                return res.status(400).json({ error: '用户名长度必须在 2-20 个字符之间' });
            }
            if (!/^[\w\u4e00-\u9fff-]+$/.test(targetUser)) {
                return res.status(400).json({ error: '用户名只能包含字母、数字、下划线、中文和连字符' });
            }
            if (typeof password !== 'string' || password.length < 8) {
                return res.status(400).json({ error: '密码长度不能少于 8 位' });
            }
            if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
                return res.status(400).json({ error: '密码必须同时包含字母和数字' });
            }

            try {
                const passwordHash = await bcrypt.hash(password, 10);
                await prisma.user.create({
                    data: { username: targetUser, password: passwordHash },
                    select: { id: true }
                });
                return res.status(201).json({ success: true, message: '用户已创建' });
            } catch (error) {
                if (error.code === 'P2002') {
                    return res.status(409).json({ error: '该用户名已被注册' });
                }
                // Prisma 错误可能包含写入参数，不将完整异常交给外层日志。
                console.error('[AdminUsers] 创建用户失败:', error.code || 'UNKNOWN');
                return res.status(500).json({ error: '创建用户失败' });
            }
        }

        if (!targetUser || !action) {
            return res.status(400).json({ error: '参数不完整' });
        }

        if (targetUser === operator && (action === 'ban' || action === 'demote' || action === 'delete' || action === 'unset_staff')) {
            return res.status(403).json({ error: `安全限制：你不能对自己的账号(${targetUser})执行该操作` });
        }

        const user = await prisma.user.findUnique({
            where: { username: targetUser }
        });

        if (!user) {
            return res.status(404).json({ error: '找不到目标用户' });
        }

        switch (action) {
            case 'ban':
                await prisma.user.update({ where: { id: user.id }, data: { status: 'banned' } });
                break;
            case 'unban':
                await prisma.user.update({ where: { id: user.id }, data: { status: 'active' } });
                break;
            case 'promote':
                await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
                break;
            case 'demote':
                await prisma.user.update({ where: { id: user.id }, data: { isAdmin: false } });
                break;
            case 'set_staff':
                // 标记为职员并指定负责站点（staffSites 为 PARAM 数组）
                {
                    const sites = parseStaffSites(staffSites);
                    if (sites.length === 0) {
                        return res.status(400).json({ error: '请至少指定一个负责站点' });
                    }
                    await prisma.user.update({
                        where: { id: user.id },
                        data: { isStaff: true, staffSites: JSON.stringify(sites) }
                    });
                    return res.status(200).json({ success: true, message: `已将 ${targetUser} 设为职员，负责站点：${sites.join('、')}` });
                }
            case 'unset_staff':
                await prisma.user.update({
                    where: { id: user.id },
                    data: { isStaff: false, staffSites: null }
                });
                return res.status(200).json({ success: true, message: `已取消 ${targetUser} 的职员身份` });
            case 'delete':
                await prisma.$transaction(async (tx) => {
                    await tx.trade.deleteMany({ where: { userId: user.id } });
                    await tx.gacha.deleteMany({ where: { userId: user.id } });
                    await tx.image.deleteMany({ where: { uploaderId: user.id } });
                    await tx.user.delete({ where: { id: user.id } });
                });
                return res.status(200).json({ success: true, message: `用户 ${targetUser} 的所有档案已彻底抹除` });
            
            default:
                return res.status(400).json({ error: '未知的操作类型' });
        }

        return res.status(200).json({ success: true, message: `已成功更新 ${targetUser} 的状态` });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

export default withAdmin(handler);
