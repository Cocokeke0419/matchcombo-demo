# 消消鸭技术说明

更新日期：2026-06-23

## 1. 技术栈

| 模块 | 当前方案 |
|---|---|
| 页面结构 | HTML5 |
| 样式和布局 | CSS3 |
| 运行逻辑 | JavaScript ES Modules |
| 类型系统 | 暂未引入 TypeScript |
| 运行环境 | Chrome 浏览器 |
| 本地开发服务器 | Node.js + `frontend/server.mjs` |
| 本地存档 | `localStorage` |
| 动画 | CSS 动画 + Web Animations API |
| 音效 | Web Audio / HTMLAudioElement |
| 私有版本管理 | Git + GitHub private repository |
| 公开部署 | GitHub Pages 静态托管 |

## 2. 仓库和路径

私有开发仓库：

```text
C:\Users\happyelements\Documents\Codex\2026-05-28\royal-match-git
```

公开 demo 仓库：

```text
C:\Users\happyelements\Documents\match combo 2\matchcombo-demo-public-20260622205216
```

私有远端：

```text
https://github.com/Cocokeke0419/matchcombo.git
```

公开远端：

```text
https://github.com/Cocokeke0419/matchcombo-demo.git
```

公开 demo：

```text
https://cocokeke0419.github.io/matchcombo-demo/
```

## 3. 项目目录

```text
frontend/
  index.html
  styles.css
  server.mjs
  src/
    main.js
    audio.js
  assets/
    icons/
    audio/
    source/

shared/
  config.js
  game.js
  README.md

backend/
  README.md

docs/
  *.md

README.md
GAME_DESIGN.md
TODO.md
TECH_SPEC.md
```

## 4. 本地运行

```bash
cd C:\Users\happyelements\Documents\Codex\2026-05-28\royal-match-git
node frontend/server.mjs
```

如果系统 `node` 被沙箱或权限限制，可使用：

```text
C:\Users\happyelements\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
```

浏览器入口：

```text
http://127.0.0.1:5173/frontend/
```

常用参数：

```text
?mode=boxing  直接进入拳击 1v1
?mode=swim    直接进入游泳竞速
?v=xxx        前端模块缓存号，改动后递增避免浏览器缓存旧 main.js
```

当前推荐测试链接：

```text
http://127.0.0.1:5173/frontend/?mode=boxing&v=boxing-ai-2
http://127.0.0.1:5173/frontend/?mode=swim&v=boxing-ai-2
```

## 5. 核心文件

### 5.1 `shared/config.js`

集中配置棋盘、对战、输入、掉落、木箱、特效等数值。

当前关键配置：

```js
battle: {
  maxHp: 300,
  damageChargeMax: 140,
  obstacleChargeMax: 160,
  damagePerAttack: 85,
  aiTurnMs: 2400,
  sideChargeMultiplier: {
    player: { damage: 1, obstacle: 1 },
    ai: { damage: 0.78, obstacle: 0.72 },
  },
}
```

说明：

- `aiTurnMs` 是拳击 AI 出手间隔。
- `sideChargeMultiplier.ai` 用于压低拳击 AI 伤害和障碍充能。
- 游泳 AI 使用前端独立常量，不直接使用拳击 AI 配置。

### 5.2 `shared/game.js`

纯玩法规则，尽量不依赖 DOM。

负责：

- 棋盘创建
- 棋子创建
- 匹配检测
- 特效生成判断
- 掉落、斜向掉落、补棋
- 普通交换
- 无效交换判定
- 特效触发
- 特效组合
- 陀螺目标选择
- 攻击/障碍充能
- 加木箱
- 胜负判断
- AI 选步和行动

重要函数：

```js
createBattleState()
trySwap(board, a, b, resolveOptions)
resolveBoard(board, triggerIndex, options)
activateSpecial(board, index, targetColor, resolveOptions)
findBestMove(board, actor, resolveOptions)
takeAiTurn(state, options)
applyResultToBattle(state, side, result)
```

本轮关键变化：

- `findBestMove` 支持 `resolveOptions`。
- `takeAiTurn` 支持 `options`。
- AI 评估和实际结算可以使用同一套短连锁规则。
- `applySwapAction`、`applySpecialAction` 支持 `deferBattle`，用于前端延迟施加战斗结果。

### 5.3 `frontend/src/main.js`

前端主控，负责 DOM、渲染、输入、动画、AI 循环和游泳模式。

负责：

- 维护当前模式：开始界面 / 拳击 / 游泳
- 渲染棋盘、状态栏、记录、弹窗
- 处理点击、拖动、滑动
- 调用 `shared/game.js` 规则
- 播放动画时间线
- 播放音效
- 管理玩家操作缓冲
- 管理拳击 AI 实时循环
- 管理游泳竞速状态和 AI

拳击 AI 相关重点：

```js
BOXING_AI_RESOLVE_OPTIONS
pendingAiSettlements
playerBoardBusyForAiBattle()
flushPendingAiSettlements()
schedulePendingAiSettlement()
startAiLoop()
```

当前机制：

- 玩家棋盘忙时，AI 仍可在自己的棋盘行动。
- 如果玩家棋盘正在动画/结算，AI 的伤害或木箱结果先进入 `pendingAiSettlements`。
- 玩家这一步结束后再调用 `flushPendingAiSettlements()`。
- AI 自己的棋盘动画不会强制重渲染玩家棋盘，避免打断玩家表现。

游泳模式相关重点：

```js
SWIM_SCREEN_COUNT = 5
SWIM_WAVE_INTERVAL
SWIM_WAVE_PUSH_ROWS = 3
SWIM_AI_TURN_MS
SWIM_RESOLVE_OPTIONS
createSwimState()
seedSwimBoard()
tryMoveSwimDuck()
applySwimGravity()
tickSwimAi()
```

当前机制：

- 鸭子是棋盘内特殊棋子。
- 鸭子可上下左右交换。
- 鸭子可与空格交换。
- 木箱阻挡掉落。
- 空格可移动。
- 支持斜向掉落和后续合成。
- 鸭子到底进入下一屏。
- 浪潮向上推 3 行，但有木箱的列不推。

### 5.4 `frontend/src/audio.js`

负责：

- 音效路径映射
- 音频预热
- 音效播放
- 音量、延迟、速率抖动

当前音效仍是临时版本，后续可替换更高品质 SFX 和 BGM。

## 6. 动画时间线

项目已经从“直接结算跳结果”改为分步时间线：

1. 交换/触发
2. 匹配识别
3. 消除粒子和缩放
4. 特效生成提示
5. 特效范围/飞行/爆炸
6. 掉落和补棋
7. 连锁
8. 战斗结果展示

关键原则：

- 玩家需要看到自己为什么造成伤害。
- 特效组合要分阶段展示。
- AI 对玩家的影响不能在玩家动画中途硬插入。
- 结算可以延迟，但规则状态要保持一致。

## 7. 本地记录

使用 `localStorage`。

Key：

```js
matchComboRecord:v1:${RECORD_HOST}
```

当前记录结构区分模式：

```js
{
  boxing: { games, wins, losses, draws },
  swim: { games, wins, losses, draws }
}
```

## 8. 部署流程

### 8.1 私有仓库提交

在私有仓库：

```bash
git status --short --branch
node --check frontend/src/main.js
node --check shared/game.js
node --check shared/config.js
git diff --check
git add ...
git commit -m "..."
git push origin develop
```

### 8.2 同步公开 demo

公开 demo 仓库是静态 Pages 仓库。通常同步这些路径：

```text
.nojekyll
frontend/
shared/
README.md
GAME_DESIGN.md
TODO.md
TECH_SPEC.md
```

公开仓库提交：

```bash
cd C:\Users\happyelements\Documents\match combo 2\matchcombo-demo-public-20260622205216
git status --short --branch
git add ...
git commit -m "..."
git push origin main
```

Pages 地址：

```text
https://cocokeke0419.github.io/matchcombo-demo/
```

直达链接：

```text
https://cocokeke0419.github.io/matchcombo-demo/frontend/?mode=boxing&v=boxing-ai-2
https://cocokeke0419.github.io/matchcombo-demo/frontend/?mode=swim&v=boxing-ai-2
```

### 8.3 验证公开 demo

推送后等待 GitHub Pages 刷新，再验证：

- 根链接能打开。
- 拳击模式能进入。
- 游泳模式能进入。
- `frontend/index.html` 引用的 `main.js?v=...` 是最新缓存号。
- 控制台没有关键报错。

## 9. Git 注意事项

- 修改前必须看 `git status --short --branch`。
- 不要随意 `git reset --hard`。
- 不要覆盖用户未提交改动。
- 当前主要开发分支是 `develop`。
- 公开 demo 仓库使用 `main`。
- 稳定回退点 `v1.0` 指向 `6c718a9`。
- 每个阶段稳定后及时 commit；重要试玩阶段可打 tag。

## 10. 后端预留

`backend/` 当前未实现。

未来可能包括：

- 同 WiFi 房间
- WebSocket 对战
- 房间号/邀请码
- 客户端输入同步
- 服务端权威校验
- 对局回放
- 断线重连

设计原则：

- `shared/game.js` 尽量保持纯规则，未来可复用到服务端。
- 前端负责展示和输入。
- 服务端未来负责同步、校验和房间状态。
