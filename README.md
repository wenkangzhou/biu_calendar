# Biu Calendar 家庭共享日历

一款面向家庭成员的轻量化共享日程管理小程序。核心价值是**让家庭时间规划变得简单透明**。

---

## 功能特性

- 📅 **月视图日历**：彩色圆点标识不同成员的日程密度
- 👨‍👩‍👧‍👦 **家庭管理**：创建家庭、邀请码加入、成员颜色区分
- 📝 **日程管理**：个人/家庭日程、全天/时段、地点备注
- 🔒 **权限控制**：创建者/管理员/普通成员三级权限
- 🚀 **自建后端**：Node.js + SQLite，零平台绑定，长期成本固定

---

## 技术栈

| 端 | 技术 |
|----|------|
| 小程序 | 微信小程序原生框架 + TypeScript + SCSS |
| 后端 | Node.js + Koa 2 + better-sqlite3 |
| 部署 | PM2 进程守护 + Caddy 反向代理（自动 HTTPS） |

---

## 目录结构

```
├── miniprogram/              # 小程序前端
│   ├── pages/
│   │   ├── index/            # 首页（月视图日历 + 当日日程）
│   │   ├── family/           # 家庭管理（创建/加入/成员列表）
│   │   └── event-edit/       # 日程编辑（新建/修改/删除）
│   ├── utils/
│   │   └── api.ts            # HTTP API 封装
│   ├── app.ts                # 应用入口（微信登录 + JWT）
│   └── app.json              # 页面路由 & 全局配置
│
├── backend/                   # Node.js 后端
│   ├── src/
│   │   ├── app.js            # Koa 主应用
│   │   ├── db.js             # SQLite 数据库初始化
│   │   ├── middleware/
│   │   │   └── auth.js       # JWT 鉴权中间件
│   │   └── routes/
│   │       ├── auth.js       # 微信登录（code2session）
│   │       ├── family.js     # 家庭 CRUD
│   │       └── event.js      # 日程 CRUD
│   ├── ecosystem.config.js   # PM2 配置
│   ├── package.json
│   └── .env.example          # 环境变量模板
│
└── project.config.json        # 微信开发者工具项目配置
```

---

## 本地开发

### 1. 启动后端服务

```bash
cd backend

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的小程序 AppSecret

# 启动服务
npm start
```

服务默认运行在 `http://localhost:3000`，API 基础路径为 `/api`。

**本地测试时，修改小程序 API 地址：**

编辑 `miniprogram/utils/api.ts`，把 `API_BASE` 临时改为：

```ts
const API_BASE = 'http://localhost:3000/api'
```

> ⚠️ 提交代码前务必改回生产域名 `https://biu-api.yiquwei.com/api`。

### 2. 运行小程序

1. 打开微信开发者工具，导入项目根目录
2. 详情 → 本地设置 → 勾选 **"不校验合法域名、web-view..."**
3. 点击编译，即可在模拟器中调试

---

## 生产部署

### 环境要求

- CentOS 7+ / Ubuntu 18+ / Debian 10+
- Node.js 16+
- 已备案域名 + 已配置 Caddy/Nginx

### 部署步骤

```bash
# 1. 服务器安装 Node.js 18（推荐用 nvm）
nvm install 18
nvm use 18

# 2. 克隆项目
git clone https://github.com/wenkangzhou/biu_calendar.git
cd biu_calendar/backend

# 3. 安装依赖
npm install

# 4. 配置环境变量
cp .env.example .env
nano .env
# 填写 WX_APPID、WX_SECRET、JWT_SECRET

# 5. PM2 启动
npm install -g pm2
mkdir -p logs
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

### Caddy 配置示例

```caddy
biu-api.yiquwei.com {
    reverse_proxy localhost:3000
}
```

### 小程序域名配置

微信公众平台 → 开发 → 开发设置 → 服务器域名：

- **request 合法域名**：`https://biu-api.yiquwei.com`

---

## 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `WX_APPID` | 是 | 微信小程序 AppID |
| `WX_SECRET` | 是 | 微信小程序 AppSecret |
| `JWT_SECRET` | 是 | JWT 签名密钥，建议 32 位以上随机字符串 |
| `PORT` | 否 | 服务端口，默认 3000 |
| `NODE_ENV` | 否 | 环境标识，默认 production |

---

## 数据库

后端使用 **SQLite** 单文件数据库，零配置、开箱即用。

数据库文件默认位于 `backend/data/biu_calendar.db`，首次启动自动创建表结构和索引。

**表结构：**

- `users` — 用户（openid、昵称、头像）
- `families` — 家庭（名称、成员 JSON、邀请码）
- `events` — 日程（标题、时间、类型、参与人 JSON 等）

---

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 微信登录，返回 JWT |
| GET | `/api/family` | 获取当前家庭 |
| POST | `/api/family` | 创建家庭 |
| POST | `/api/family/join` | 邀请码加入家庭 |
| POST | `/api/family/refresh-code` | 刷新邀请码 |
| POST | `/api/family/leave` | 退出家庭 |
| GET | `/api/events?year=&month=` | 按月查询日程 |
| GET | `/api/events?date=` | 按日查询日程 |
| GET | `/api/events/:id` | 日程详情 |
| POST | `/api/events` | 创建日程 |
| PUT | `/api/events/:id` | 更新日程 |
| DELETE | `/api/events/:id` | 删除日程 |

所有接口（除登录外）需在 Header 中携带 `Authorization: Bearer <token>`。

---

## License

MIT
