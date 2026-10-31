# 关于 WikitDB

**WikitDB** 是面向 Wikidot 社区生态的开源项目，基于 **Wikit API** 的数据接口，致力于把散落在各个 Wikidot 站点的页面、作者和评分数据串联起来，为读者和作者提供统一的检索、追踪与分析体验。

**WikitDB** 企划最初由 lestday233 提出，由 Laimu_slime 主持开发和架构，由 OxygenNine 进行全面的视觉升级；数据接口由 **Wikit API** 提供强力支持。

---

## 核心能力

### 页面归档
- 自动同步来自 Wikit API 的各分站页面元数据
- 支持按站点、标签、评分区间、发布时间等多要素筛选数据
- 通过增量更新，保留已从原站点移除的页面（`--keep-removed`）

### 作者追踪
- 收录作者在不同分站的创作与评分走势
- 可按标签、站点、时间范围细化分析
- 绑定账号后可订阅作者动态

### 虚拟股市（作者概念股）
- 把创作产出、评分变化、互动数据转化为波动曲线
- 在充满博弈的虚拟市场中挖掘被低估的潜力新星

### 文章讨论
- 在文章页面查看关联讨论区
- 支持匿名回复

### 多样工具
- 盲盒抽取、交易市场、战力雷达等娱乐玩法
- FTML编辑器、代发页面、删帖公示等实用工具集

---

## 收录站点（当前 {WIKIS_COUNT} 个）

{WIKIS_TABLE}

> 如需申请收录更多站点，请联系 WikitDB 团队职员。

---

## 技术栈一览

- **前端框架**：Next.js Pages Router + React 18 + Tailwind CSS
- **后端存储**：PostgreSQL via Prisma ORM
- **抓取与同步**：kakushi-w/wikit CLI，Wikit GraphQL API
- **Wikidot 文本渲染**：FTML (Wikidot 文本标记语言) WASM 内核
- **安全与基础设施**：JWT (HS256)、bcrypt、CSRF Origin 校验、IP 双层限速

---

## 开发团队

- **Kakushi** - Wikit创始人，Wikit API运维
- **Laimu_slime** — 主要开发者/维护者
- **lestday233** — 概念提出者/初步构建者
- **umou** — 项目贡献者/测试站运维
- **OxygenNine** - UI-redesign
