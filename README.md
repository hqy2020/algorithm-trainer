# Algorithm Trainer - LeetCode Hot 100 刷题训练系统

两人协作刷 LeetCode Hot 100，计时做题 + 笔记记录 + 统计对比。

当前版本：`v1.1.0`  
发布记录见：`CHANGELOG.md`

## 快速启动

### Docker 一键启动（推荐）

```bash
./run.sh --build   # 首次构建
# 或
./run.sh           # 日常启动
```

- 前端：http://localhost:10000
- 后端 API：http://localhost:10001/api/
- Django Admin：http://localhost:10001/admin/

默认已开启 Django Admin 免密自动登录（进入后台无需用户名密码）。
如需关闭，设置环境变量 `ADMIN_AUTO_LOGIN=0` 后重启容器。

### 本地开发

**后端：**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
export DB_PATH=$PWD/db.sqlite3
python manage.py migrate
python manage.py init_users
python manage.py load_hot100
python manage.py runserver
```

**前端：**
```bash
cd frontend
npm install
npm run dev
```

## 功能

- **Hot100 固定顺序**：题目严格按官方学习计划顺序展示（非题号排序）
- **计时做题**：精确计时，根据难度自动评估用时（优秀/合格/需加强）
- **代码提交**：记录每次提交的代码、通过情况、用时，支持“破个人记录”提示
- **个人记录**：每个用户可查看每题历史最佳与历史完成时间
- **AI 评估**：通过后给优化建议，未通过给错误原因与修复建议
- **笔记系统**：每道题独立笔记，1.5秒自动保存
- **后台管理**：Django Admin 管理题目、参考答案与 AI 提示词（通过/未通过两套）
- **后台入口**：侧边栏底部固定 `Django 后台` 入口按钮
- **后台免密**：开发环境默认自动登录 Django Admin（可配置关闭）
- **用户选择**：前端不再有登录页，直接使用后台已创建用户
- **对战模式**：题目详情支持单人/双人模式，双人下可设置用户 A/B 并排做题
- **视角切换**：仪表盘与题目列表标题旁可切换“视角用户”
- **双人对比**：完成率、平均用时、通过率、各难度统计图表
- **双人同步计时**：对战模式支持双方同时开始/暂停/重置
- **建议时间提示**：双人对战计时区域显示本题建议用时
- **根路径跳转**：访问后端根路径会自动跳转回前端

## AI 配置

后端使用 OpenAI 兼容接口（默认模型：`gpt-5.1-codex-mini`，默认基地址：`https://api.modelverse.cn/v1`）。
默认从 Django Admin 读取配置（明文存储）：

- 路径：`/admin/submissions/aiproviderconfig/`
- 可配置：`api_key`、`api_base_url`、`model_name`、`timeout_seconds`
- 如果 Admin 未配置 `api_key`，会自动回退到环境变量 `AI_API_KEY`

## 数据持久化

Docker 使用命名卷 `backend_data` 持久化 SQLite 数据库（路径 `/data/db.sqlite3`）。
即使 `docker compose down` 后再启动，用户、提交记录、AI 提示词和 AI Provider 配置都会保留。

可通过环境变量配置：

```bash
DB_PATH=/data/db.sqlite3
AI_API_KEY=你的key
AI_API_BASE_URL=https://api.modelverse.cn/v1
AI_API_MODEL=gpt-5.1-codex-mini
AI_API_TIMEOUT_SECONDS=45
ADMIN_AUTO_LOGIN=1
ADMIN_AUTO_LOGIN_USERNAME=autoadmin
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Django 4.2 + DRF |
| 前端 | React 18 + Vite + Ant Design 5 |
| 图表 | ECharts |
| 数据库 | SQLite |
| 容器 | Docker Compose |
