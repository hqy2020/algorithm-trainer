# Algorithm Trainer

LeetCode Hot 100 双人刷题训练系统。

## 技术栈

- 后端：Django 4.2 + DRF，SQLite
- 前端：React 18 + Vite + TypeScript + Ant Design 5 + ECharts
- 容器：Docker Compose

## 项目结构

```
backend/
├── config/          # Django 配置（settings/urls/wsgi）
├── users/           # Profile 模型（用户档案）
├── problems/        # Problem 模型 + Django Admin + load_hot100 命令
├── submissions/     # Submission 模型 + 统计/对比 API
├── notes/           # Note 模型（upsert 语义）
└── entrypoint.sh    # Docker 入口：migrate + init_users + load_hot100

frontend/src/
├── api/index.ts     # Axios 封装 + 类型定义
├── pages/           # Dashboard / ProblemList / ProblemDetail / Statistics
├── components/      # Timer / CodeEditor / UserSwitcher / StatsChart
└── App.tsx          # 路由 + Layout + 用户状态
```

## 开发命令

```bash
# Docker 一键启动
docker-compose up --build

# 本地后端
cd backend && source venv/bin/activate && python manage.py runserver

# 本地前端
cd frontend && npm run dev

# 数据初始化
python manage.py migrate
python manage.py init_users
python manage.py load_hot100

# 创建 Admin 账号
python manage.py createsuperuser
```

## 关键设计

- Note 使用 `update_or_create` 实现 upsert，前端只需 POST 不区分新建/更新
- Submission.time_rating 是 property，根据题目难度动态计算时间评价
- 前端笔记 1.5s 防抖自动保存
- 前端 vite proxy 转发 `/api` 到后端，Docker 环境通过 `API_URL` 环境变量指向 backend 容器
