# WikitDB-Serverless

> Wikidot 社区的数据归档站 — 把散落在各个分站的页面、作者和评分数据串起来，让创作者与读者各取所需。

WikitDB 是一个面向 Wikidot 社区生态的**非营利性同人项目**。它聚合多个 Wikidot 分站的页面、作者和评分数据，并提供一套围绕社区互动的工具集（盲盒、悬赏、宾果、虚拟股市等），同时支持基于 [`kakushi-w/wikit`](https://github.com/kakushi-w/wikit) CLI 的站点级备份能力。

## 功能概览

- **页面归档**：实时同步各分站页面元数据，支持按站点、标签、评分区间、发布时间多维筛选
- **作者追踪**：跨站收录作者创作与评分走势，可订阅作者动态
- **虚拟股市**：把创作产出、评分变化、互动数据转化为波动曲线的「作者概念股」
- **文章讨论**：在文章页面查看关联讨论区，支持匿名回复
- **实用工具集**：盲盒抽取、删除公告生成、质量评审、悬赏活动、宾果活动、乱斗竞猜、成员自助管理等
- **站点备份**：通过独立脚本调用 wikit CLI 备份已配置站点

## 技术栈

| 维度 | 选型 |
|------|------|
| 前端框架 | Next.js 15 (Pages Router) + React 18 |
| 样式 | Tailwind CSS 3 |
| 图表 | Chart.js / Recharts / lightweight-charts |
| 后端存储 | PostgreSQL via Prisma ORM 6 |
| 抓取与同步 | Wikit CLI、Wikit GraphQL API |
| Wikidot 文本渲染 | FTML (Wikidot 文本标记语言) WASM 内核 |
| HTML 消毒 | sanitize-html |
| 鉴权 | JWT (HS256) + bcrypt + httpOnly Cookie |
| 邮件 | nodemailer |
| 缓存 | Upstash Redis (可选) |
| 语言 | JavaScript与TypeScript |

## 环境要求

- **Node.js** ≥ 18（生产推荐 20）
- **PostgreSQL** 数据库

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/WikitTeam/WikitDB-serverless.git
cd WikitDB-serverless
```

### 2. 安装依赖

```bash
npm ci
```

### 3. 配置环境变量

在仓库根目录复制 `.env.example` 为 `.env` 并填入所需值。网站、Worker 和 Prisma 命令共用这份配置：

```bash
cp .env.example .env
```

关键环境变量说明见 `.env.example` 内注释，常见项包括：

- `DATABASE_URL` — PostgreSQL 连接字符串
- `JWT_SECRET` — JWT 签名密钥（≥ 32 字符）
- `SITE_ORIGIN` — 站点公网 HTTPS origin
- `TRUST_PROXY` — 是否信任反代头（仅在反代后开启）
- 短信 / 邮件相关凭据（按需）

### 4. 初始化数据库

```bash
npm run prisma:generate
npm run prisma:push
```

### 5. 导入收录站点

首次使用时，在仓库根目录执行：

```bash
node web/scripts/import-sites.js
```

脚本将初始站点列表导入 `sites` 表，表中已有数据时跳过。后续在管理后台的「站点管理」中增删改站点。

### 6. 启动开发服务器

```bash
npm run dev
```

默认监听 `http://localhost:3000`。

## 构建与本地运行

### 构建

```bash
npm run build
npm start
```

### 爬虫与备份 Worker

在仓库根目录执行一轮主爬虫：

```bash
npm run worker
```

归属同步使用独立脚本，执行一轮归属资料和作者评分同步：

```bash
node worker/auto-attribution.js
```

备份使用独立入口，需要在 PATH 中安装 wikit CLI：

```bash
node worker/backup.js
```

备份已配置站点，归档保存到仓库根目录的 `wikit_data/`，并保留已从原站点移除的页面。

任务完成后退出，成功返回 0，失败返回 1。运行日志在控制台查看。

## 项目结构

```
WikitDB-Serverless/
├── web/                    # Next.js 网站
│   ├── pages/              # 页面与 API 路由
│   ├── components/         # 复用组件
│   ├── contexts/           # React 上下文
│   ├── utils/              # 鉴权、安全、渲染及业务工具
│   ├── content/            # 静态内容
│   ├── public/             # 静态资源及 FTML WASM
│   ├── styles/             # 样式
│   ├── scripts/            # 站点导入、开发、SMTP 和 FTML 脚本
│   ├── tests/              # 单元测试
│   ├── middleware.js       # 全局限速 / Honeypot
│   └── next.config.js      # Next.js 配置及安全头
├── worker/
│   ├── auto-crawler.js     # 单轮主爬虫
│   ├── auto-attribution.js # 归属与作者评分同步
│   ├── backup.js           # 单次站点备份
│   └── utils/             # 归属解析、备份参数
├── shared/
│   ├── prisma.js          # Prisma Client 及 Setting 扩展
│   ├── prisma/            # 数据库 schema
│   ├── sites.js           # 站点配置读取
│   └── wikitdb.config.js  # 网站展示配置
├── .github/workflows/      # CI
├── .env.example            # 本地环境配置模板
├── package.json            # workspace 定义及根目录命令
└── package-lock.json       # 统一依赖锁文件
```

## 可用脚本

| 脚本 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm start` | 启动生产服务器 |
| `npm run lint` | ESLint 检查 |
| `npm run typecheck` | TypeScript 类型检查 (`tsc --noEmit`) |
| `npm test` | 运行网站单元测试 |
| `npm run test:ftml` | FTML 运行时测试 |
| `npm run worker` | 执行一轮主爬虫 |
| `npm run prisma:generate` | 生成 Prisma Client |
| `npm run prisma:push` | 同步 schema 到数据库 |
| `npm run prisma:studio` | 打开 Prisma Studio 可视化管理数据库 |

以上命令均在仓库根目录运行。

## TypeScript 渐进式迁移

- 新增或大改的模块优先使用 `.ts` / `.tsx`
- 现有 JavaScript 可按区域逐步迁移
- 提交前执行 `npm run typecheck` 确保无类型错误

## 安全说明

- **`SITE_ORIGIN`** 必须设置为公网 HTTPS origin
- **`TRUST_PROXY=true`** 仅在请求总是经过可信反代（反代会覆写转发头）时开启
- **管理员权限**由数据库 `User.isAdmin` 字段控制
- **运行时数据与凭据**不得提交至 `data/` 或环境文件
- **Wikidot 管理代理工具**仅接受数据库站点配置中声明的 HTTPS origin
- **CSRF 防护**：写操作校验 Origin / Referer
- **限速**：IP + Key 双层（内存 + DB 持久化），middleware 层全局生效
- **Honeypot**：对常见攻击路径返回 800-2000ms 随机延迟并记录行为日志

## 开发规范

- 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/) 风格（如 `feat:`、`fix:`、`security:`、`chore:`）
- 修改后端逻辑前先用 `npm run typecheck` 与 `npm test` 验证
- 新增 API 路由必须用 `withAuth` / `withAdmin` 包装（按需），并通过 CSRF Origin 校验
- 输出 HTML 前必须经过 `sanitizeRichHtml` 消毒
- 编辑说明使用中文书写

## 贡献

欢迎通过 Issue 或 Pull Request 反馈问题与改进建议。提交 PR 前：

1. 确保本地 `npm run typecheck` 与 `npm test` 通过
2. 遵循现有代码风格与提交信息规范
3. 不要在提交中包含运行时数据、凭据或 `data/` 目录内容

## 致谢

- **Laimu_slime** — 主要贡献者/维护者
- **lestday233** — 初版 WikitDB 创始人
- **白然** — WikitDB LOGO 设计师
- **Kakushi** - Wikit创始人，Wikit API运维
- **UMOU** - 贡献者
- **OxygenNine** - ui-redesign
- 每一位为 Wikidot 社区贡献原创内容的创作者

## 许可证

详见 [LICENSE.md](LICENSE.md)。
