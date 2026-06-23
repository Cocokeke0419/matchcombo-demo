# 消消鸭 Match Combo

《消消鸭》是一个 Chrome 可玩的三消对战 demo。当前包含两个模式：

- 拳击 1v1：玩家和 AI 各自操作一块三消棋盘，通过消除、特效和连锁积累攻击能量与障碍能量，互相造成伤害和木箱压力。
- 游泳竞速：玩家和 4 个 AI 在同一张棋盘规则下推进游泳鸭，鸭子作为可交换棋子向下掉落，穿过 5 屏赛道完成大逃杀式竞速。

当前 demo 目标是提交试玩链接和验证核心玩法，不是完整商业化版本。

## 试玩链接

- 公开 demo：https://cocokeke0419.github.io/matchcombo-demo/
- 通用开始界面：https://cocokeke0419.github.io/matchcombo-demo/frontend/?v=demo-start-1
- 拳击 1v1 直达：https://cocokeke0419.github.io/matchcombo-demo/frontend/?mode=boxing&v=demo-start-1
- 游泳竞速直达：https://cocokeke0419.github.io/matchcombo-demo/frontend/?mode=swim&v=demo-start-1

公开 demo 仓库：

- GitHub：https://github.com/Cocokeke0419/matchcombo-demo
- 本地公开仓库：`C:\Users\happyelements\Documents\match combo 2\matchcombo-demo-public-20260622205216`
- GitHub Pages 使用 `main` 分支 root 部署。

## 本地运行

项目根目录：

```text
C:\Users\happyelements\Documents\Codex\2026-05-28\royal-match-git
```

启动本地服务：

```bash
node frontend/server.mjs
```

如果系统 `node` 不可用，可使用 Codex bundled Node：

```text
C:\Users\happyelements\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
```

浏览器打开：

```text
http://127.0.0.1:5173/frontend/
```

常用直达：

```text
http://127.0.0.1:5173/frontend/?v=demo-start-1
http://127.0.0.1:5173/frontend/?mode=boxing&v=demo-start-1
http://127.0.0.1:5173/frontend/?mode=swim&v=demo-start-1
```

## Git 与版本

- 私有主仓库：https://github.com/Cocokeke0419/matchcombo.git
- 主要开发分支：`develop`
- `develop` 会推送到 `origin/develop`
- 稳定试玩回退点：`v1.0`
- `v1.0` 指向提交 `6c718a9`，是较稳定的可玩动作反馈基线。
- 接管时最新提交为 `f4669bf Tune board feel and add project docs`。

每次修改前先确认状态：

```bash
git status --short --branch
```

不要随意 `reset`、`checkout` 或覆盖未提交改动。

提交前建议检查：

```bash
node --check frontend/src/main.js
node --check shared/game.js
node --check shared/config.js
git diff --check
git status --short --branch
```

## 项目结构

```text
frontend/
  index.html            页面结构和模式入口
  styles.css            UI、棋盘、动效、响应式布局
  server.mjs            本地静态服务器
  src/
    main.js             前端状态、渲染、输入、动画、AI 循环、游泳模式
    audio.js            音效加载和播放
  assets/
    icons/              棋子、特效、木箱、鸭子、UI 贴图
    audio/              临时音效
    source/             源素材和参考素材

shared/
  config.js             数值配置、棋盘配置、特效配置
  game.js               三消、掉落、特效、组合、AI、胜负等核心规则

backend/
  README.md             后续服务端预留，当前未实现

docs/
  旧文档、素材说明、音频说明、策划案备份等

GAME_DESIGN.md          当前玩法设计说明
TODO.md                 开发路线图
TECH_SPEC.md            技术说明和部署说明
```

## 当前重点

1. 拳击 1v1 已支持 AI 实时行动，不再等待玩家整步结束。
2. AI 对玩家造成伤害或木箱时，如果玩家棋盘正在动画/结算，会先缓存，等玩家这一步结束后再施加。
3. 拳击 AI 已下调强度：出手间隔更长，充能倍率降低，并限制 AI 单步连锁爆发。
4. 游泳竞速已做到 5 屏推进、鸭子同棋子交换、木箱阻挡掉落、浪潮上推、空格可移动；当前关闭斜向掉落，使用和拳击一致的直线掉落。
5. 公开 demo 使用 GitHub Pages 部署，适合提交链接试玩。

## 给新对话 Codex 的接管提示

新对话请先阅读：

1. `README.md`
2. `GAME_DESIGN.md`
3. `TODO.md`
4. `TECH_SPEC.md`

然后执行：

```bash
git status --short --branch
```

确认工作区后，再继续开发或部署。
