# Changelog

## v1.1.0 - 2026-02-22

### Added
- 新增双人对战模式下的同步计时控制（双方同时开始/暂停/重置）。
- 新增对战计时区域的“本题建议用时”提示。
- 新增 AI Provider 配置管理（Django Admin）与 AI 回评能力。
- 新增题目笔记 Markdown 预览与自动保存。
- 新增用户视角切换与双人统计对比图表。

### Changed
- 计时器改为基于真实时间戳计算，切换标签页后回到页面可保持准确计时。
- 后端 AI 调用流程优化，优先 `/responses`，失败自动降级 `/chat/completions`。
- 访问 `http://localhost:10001/` 时自动重定向到前端主页。

### Infra
- 补充一键启动脚本 `run.sh`，支持 `--build`。
- 默认开启 Django Admin 自动登录，可通过环境变量关闭。
