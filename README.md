# Algorithm Trainer - LeetCode Hot 100 刷题训练系统

两人协作刷 LeetCode Hot 100，计时做题 + 笔记记录 + 统计对比。

## 快速启动

### Docker 一键启动（推荐）

```bash
docker-compose up --build
```

- 前端：http://localhost:3000
- 后端 API：http://localhost:8000/api/
- Django Admin：http://localhost:8000/admin/（需先 `python manage.py createsuperuser` 创建管理员）

### 本地开发

**后端：**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py init_users
python manage.py load_hot100
python manage.py createsuperuser  # 或用 entrypoint.sh 自动创建
python manage.py runserver
```

**前端：**
```bash
cd frontend
npm install
npm run dev
```

## 功能

- **计时做题**：精确计时，根据难度自动评估用时（优秀/合格/需加强）
- **代码提交**：记录每次提交的代码、通过情况、用时
- **笔记系统**：每道题独立笔记，1.5秒自动保存
- **后台管理**：Django Admin 管理题目和预存 Java 参考答案
- **双人对比**：完成率、平均用时、通过率、各难度统计图表
- **用户切换**：顶部一键切换当前用户

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Django 4.2 + DRF |
| 前端 | React 18 + Vite + Ant Design 5 |
| 图表 | ECharts |
| 数据库 | SQLite |
| 容器 | Docker Compose |
