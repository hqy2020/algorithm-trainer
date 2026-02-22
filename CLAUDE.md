# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LeetCode Hot 100 双人刷题训练系统 — Django + React 全栈应用，两个用户计时做题、记笔记、统计对比。

## Development Commands

```bash
# Docker 一键启动（推荐）
docker-compose up --build
# 前端: http://localhost:3000  后端: http://localhost:8000/api/  Admin: http://localhost:8000/admin/

# 本地后端
cd backend && source venv/bin/activate && python manage.py runserver

# 本地前端
cd frontend && npm run dev

# 数据初始化（首次 or 重置）
python manage.py migrate && python manage.py init_users && python manage.py load_hot100

# 前端构建（含 TypeScript 类型检查）
cd frontend && npm run build
```

注意：项目未配置测试框架、linter 或 CI/CD。

## Architecture

### Backend: Django 4.2 + DRF

4 个 Django app，每个 app 内有独立的 `models/serializers/views/urls/admin`：

| App | Model | 关键点 |
|-----|-------|--------|
| `users` | `Profile` (name, color) | `init_users` 命令创建默认用户"启云"和"搭档" |
| `problems` | `Problem` (number, title, difficulty, category, ...) | `load_hot100` 命令导入 100 道题；含 `solution_code`/`solution_explanation` 字段 |
| `submissions` | `Submission` (user→Profile, problem→Problem, code, time_spent, is_passed, ...) | `time_rating` 是 property，按难度阈值返回 excellent/passing/needs_improvement |
| `notes` | `Note` (user→Profile, problem→Problem, content) | `unique_together=('user','problem')`，ViewSet.create 用 `update_or_create` 实现 upsert |

**API 路由**: 各 app 用 DRF `DefaultRouter` 注册 ViewSet，在 `config/urls.py` 汇总到 `/api/` 前缀下。

**自定义 actions**:
- `GET /api/problems/{id}/solution/` — 返回参考答案
- `GET /api/submissions/stats/?user={id}` — 个人统计（按难度/分类/每日）
- `GET /api/submissions/compare/` — 双人对比数据
- `POST /api/notes/` — upsert 语义，前端无需区分新建/更新

**无认证**: DRF 默认 `AllowAny`，所有接口公开。通过 `?user=` 参数区分用户。

### Frontend: React 18 + Vite + TypeScript + Ant Design 5

**状态管理**: 无全局状态库。`App.tsx` 维护 `currentUser` state，通过 props 传递给页面组件。

**API 层**: `src/api/index.ts` 封装 Axios 实例（baseURL: `/api`），导出 `profilesApi`/`problemsApi`/`submissionsApi`/`notesApi` 四组方法 + TypeScript 类型定义。

**页面**: Dashboard（统计概览）、ProblemList（题目表格+搜索过滤）、ProblemDetail（做题页：计时器+代码编辑+笔记+提交历史）、Statistics（ECharts 双人对比图表）

**API 代理**: Vite dev server 将 `/api` 代理到 `process.env.API_URL || 'http://localhost:8000'`。Docker 环境通过 `API_URL=http://backend:8000` 指向后端容器。

## Key Conventions

- **time_rating 阈值**: Easy ≤10min 优秀/≤15min 合格, Medium ≤15min/≤25min, Hard ≤25min/≤40min（前后端同步）
- **笔记自动保存**: 前端 1.5s 防抖，只调用 POST（后端 upsert 处理）
- **中文环境**: Django `LANGUAGE_CODE='zh-hans'`, `TIME_ZONE='Asia/Shanghai'`
- **数据库**: SQLite，文件位于 `backend/db.sqlite3`
- **Docker 入口**: `backend/entrypoint.sh` 按顺序执行 migrate → init_users → load_hot100 → runserver
