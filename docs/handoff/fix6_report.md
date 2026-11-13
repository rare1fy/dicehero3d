# FIX6 第一轮修补报告

日期：2026-11-13。范围：修补单第 1～7 条的可审核首版。第 8、9 条没有在本轮展开；使用当前核心接口，未重写规则。

已完成源码与构建，等待审核方截图。本报告中的“已实现”指代码与自动检查完成，不代表画面已经截图验收。

## 逐条修补

| 条目 | 本轮实现 | 待截图确认 |
|---|---|---|
| 1 扣血时机 | 新增显示快照；命中才提交血量、护甲及伤害数字。飞弹必须到达后才进入命中事件。敌人牌与首领条即时扣血并保留约 0.4 秒浅色残影，血瓶同样处理。状态飞行约 0.32 秒后才提交图标。死亡动画完整结束才移牌；每批事件结束对账。斩杀线用显示血量，经核心克隆预演取实际掉血。 | 同次出手 0.1 秒、命中、命中后 0.6 秒；状态飞入；死亡留牌。 |
| 2 当前目标 | 红色分段体素圈呼吸、牌边提亮及小红标。完整模型投影和敌人牌均可点，小模型/牌热区至少 88 参考像素。点击、Tab、拖拽松手更新目标、头像和预览；死亡后优先盾卫自动换目标。 | 多敌切换时圈、牌、头像、伤害和斩杀段同步。 |
| 3 嘲讽 | 接入当前核心 canTarget；群体与弹射按核心技能效果放行。盾卫蓝盾环、盾叹号，受保护敌人小锁。非法点击闪盾、晃被点敌牌和“先打盾卫”；非法拖拽灰箭头带锁，松手取消。每局首次盾卫入场提示“嘲讽”，包含召唤入场。 | 默认切片节点没有盾卫，截图 B/C 通过运行时替换测试阵容覆盖，不修改敌人表。 |
| 4 站位与镜头 | 移除距离位移和“逼近”显示，最近敌人与英雄约 3.5 单位。入场错开 0.15 秒、走约 0.75 秒，到位才亮意图。镜头常规 40°，高模型 45°；按实际模型包围盒、头牌及英雄职业标记求安全区。重取景约 0.6 秒，仅用于入场、新波、召唤或大怪死亡。选骰、瞄准及骰子留场时锁镜头，取景后反算骰弧。 | 普通、狼人精英、巫妖首领、召唤后各一张；确认主次和英雄/敌人比例。 |
| 5 环境发光 | 仅战斗 showStage 实例使用新处理：青色发光物降至约 1.35，偏青绿/冷紫；前景 HUD 带和右侧按钮对应区域去环境发光及对应灯。职业选择、场景查看等实例不启用这个开关。 | 同镜头背景前后对比，确认青色 UI 从场景中分离。 |
| 6 通用结束回合 | 三职业同位置右侧石钮，参考 y=400、尺寸 104、可点区域约 116，右外沿至少 64。魔导保留吟唱环与风险色；狂战/刺客沙漏无吟唱环。保留自动结束逻辑，无法出手且无重投时提示。激活图标限制高度并留出纵向间距。 | 三职业点击能结束；四颗同点高冰晶与结束钮不相压。 |
| 7 刀尽、屏障、首领骰子 | 刀鞘读当前 maxStrikes；用演出中的 strikesUsed/phase，刀尽保持灰虚槽及“刀尽”，新 turnStart 才补满。魔导改为贴地青色透明体素半球，光流缓动，随骰数加厚。骰子落定时按屏幕比例缩放到约 76 参考像素，保留至少 72 的目标。 | 真实末刀事件、敌方回合、下回合三时点；半球轮廓及厚度；首领战实际骰子像素测量。 |

### 已查明的时序问题

当前代码的 syncLive 原本已经放在批次末尾，因此没有机械照搬修补单里估计的行号。实际复现到：presentPlay 发射飞弹后未等待飞弹到达，后续 hit 就继续播放；已用实际 presentPlay 的受控飞弹 Promise 先复现失败，再验证修复。同时隔离状态/职业标记对最终引擎值的提前读取，并修正玩家 DoT 同时经过 statusTick 和 playerHit 导致的重复扣血风险。

旧刺客逻辑在 phase 不是 player 时直接显示满刀，且读取的是同步结算后的核心状态，确有逻辑错误。旧 09 截图使用注入 strikesUsed 加固定延时，仅凭图片不能认定当时处于哪个事件。本轮截图请求用真实 rowPlay 和显示 phase 定位时点，并保存读回值；当前核心开局上限已经变为 2，表现层没有写死 5。

### 镜头取舍

为兼顾“召唤不裁切”和“留场骰期间镜头不动”，首领开场就把三个召唤阵位纳入取景。若后续还有取景需求，在骰子/选骰/瞄准存在时延后到无骰时处理。三职业 × 五种阵容 × 两种尺寸的实际模型包围盒计算全部有解；这只证明几何安全区，不替代截图对构图和观感的判断。

## 文件清单

- `src/present/v2/hpDisplay.ts`：新增：事件驱动显示快照与血条残影。
- `src/present/v2/targeting.ts`：新增：显示目标、模型热区、核心嘲讽接口、显示血量预览。
- `src/present/v2/statusFlight.ts`：新增：状态图标飞入与落位。
- `src/present/v2/battleCamera.ts`：新增：近距离阵位、包围盒自动取景。
- `src/present/v2/barrierDome.ts`：新增：体素半球屏障。
- `src/present/v2/show2.ts`：编排接线、命中等待、入场/死亡/切目标/镜头锁定/结束回合。
- `src/present/v2/heroFx.ts`：职业状态改读显示快照、刀尽、半球接线。
- `src/present/v2/hud/plates.ts`：目标圈与牌、嘲讽反馈、残影、斩杀线、首领血条。
- `src/present/v2/hud/status.ts`：玩家状态图标落点。
- `src/present/v2/hud/draw.ts`：锁图标。
- `src/present/v2/hud/arrow.ts`：受嘲讽拦截的灰箭头与锁。
- `src/present/v2/hud/skillBar.ts`：拖拽拦截状态传递。
- `src/present/v2/hud/slot3d.ts`：目标头像同步、激活图标高度限制。
- `src/present/v2/hud/chant.ts`：三职业石钮、非魔导沙漏、魔导环与风险。
- `src/present/v2/hud/hud.ts`：结束钮位置与通用显示、骰弧安全区。
- `src/present/v2/hud/diceArc.ts`：按屏幕比例放大落定骰子。
- `src/present/ui3d/flask.ts`：命中即时液面与0.4秒残影。
- `src/present/scenes/battleGlow.ts`：新增：仅战斗实例的环境发光过滤。
- `src/present/scenes/stage.ts`：战斗实例开关、发光强度与环境灯颜色。

新增文件均低于 400 行；原有长编排器 show2.ts 只做接线及已有流程修正，新增独立逻辑拆至上述模块。正式构建交付为 `dist/fix6/index.html`。

本轮没有写入 core、bestiary、look（含 uiLook.ts）、工具或工程配置；未操作 git，未启停服务器，未杀进程。工作区哈希对比也看到了 core、bestiary、look 的并发变化，这些不属于本轮修改，未回退或覆盖。临时检查脚本放在工作区外 scratchpad，收尾清理；仅保留用户指定的报告与正式构建。

## 检查结果

- `npx.cmd tsc --noEmit -p .`：零错误。
- 全套 Vitest：13 个测试文件通过，134 项通过，1 项原有待办。
- 专项检查：飞弹到达时序 2 项通过；三职业 × 五阵容 × 两尺寸的 30 个包围盒取景用例通过；热区、残影、显示快照、嘲讽及刀尽对账等 10 项检查通过。
- 构建：VITE_ENTRY=v2，输出 `dist/fix6`，213 个模块成功打包。
- 沙箱限制说明：原始 vitest/vite 命令在自动加载 vite.config.ts 时，原生 esbuild 扫描父目录报 Access denied。使用临时 Node 脚本在内存转译并加载**同一份**配置，再调用 Vitest/Vite API 完成检查与构建；未改工程配置，也未启动监听服务。npx.ps1 被执行策略拦截时使用 npx.cmd，未修改执行策略。

尚未完成：浏览器实际播放、截图视觉验收、手机触控手感、骰子最终像素测量、环境前后画面对比。本轮按约定停在交付截图请求处。第 8 条狂战散骰双选项和第 9 条职业介绍文案留在后续范围。

## 截图请求

请审核方使用现有服务，截图根目录：

`C:/Users/LIUFEN~1/AppData/Local/Temp/claude/c07b67a416d9093a/e37cf6a1-c153-4c67-a425-40ff475cca1f/scratchpad/agents/impl/shots_fix6/`

此目录目前没有本轮截图，不将“待生成路径”当作已验收证据。现有服务沿用旧报告的 dist 映射时，新地址为 `http://127.0.0.1:8812/fix6/index.html#v2`；本轮没有启停或探测服务。

下面每组动作分别保存为**工作区外临时 JSON**，每组跑两遍：**1672x941、844x390**，DPR=1，使用 **vt**。输出按尺寸/组名分目录，防止覆盖 log.txt。命令示例：

```powershell
node tools/cap.mjs 'http://127.0.0.1:8812/fix6/index.html#v2' 'C:/Users/LIUFEN~1/AppData/Local/Temp/claude/c07b67a416d9093a/e37cf6a1-c153-4c67-a425-40ff475cca1f/scratchpad/agents/impl/shots_fix6/1672x941/A_命中时序' '<临时动作JSON绝对路径>' 1672x941 1 vt
node tools/cap.mjs 'http://127.0.0.1:8812/fix6/index.html#v2' 'C:/Users/LIUFEN~1/AppData/Local/Temp/claude/c07b67a416d9093a/e37cf6a1-c153-4c67-a425-40ff475cca1f/scratchpad/agents/impl/shots_fix6/844x390/A_命中时序' '<临时动作JSON绝对路径>' 844x390 1 vt
```

A 的死亡目标改为 1 HP；B/C 替换运行时阵容；C 提高敌人 HP、固定四骰同点；E 把已用刀数设到末刀前。以上都是截图测试夹具，不是自然战斗证据，不写配置文件。其余优先使用真实核心行动与演出事件。若 waitFor 超时、eval 报错、log 出现异常，保留日志并标记该张未通过，不用后续截图冒充对应时点。

G 在旧构建 `/r5b/index.html#v2` 和新构建 `/fix6/index.html#v2` 各跑一次，分别放 `G_场景固定镜头_前`、`G_场景固定镜头_后`。用相同相机和种子比较背景发光；英雄阵位、HUD及其他代理的并发修改可能不同，避免把这些差异归因于发光调整。

### A：同次出手的三帧与死亡留牌

输出子目录：`<尺寸>/A_命中时序/`。

```json
[
  {"waitFor":"window.__dhready && !!__dh.show2()","ms":30000},
  {"eval":"__dh.pick('mage',7)"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"wait":200},
  {"shot":"01_普通战斗"},
  {"eval":"(()=>{const S=__dh.show2();window.hitUid=S.targetUid;window.oldHp=S.disp.get(hitUid).hp;S.selectUids([S.b.dice()[0].uid]);return true})()"},
  {"wait":350},
  {"shot":"02_选择与预览"},
  {"eval":"(()=>{const S=__dh.show2();S.playSlot(0);return true})()"},
  {"wait":100},
  {"shot":"03_松手后010秒"},
  {"json":"(()=>{const S=__dh.show2();return {beat:S.beatName,busy:S.busy,errors:S.errors,target:S.targetUid,shownPlayer:S.pd,shownState:S.display.state,shownFoes:[...S.disp],engine:S.b.s,buttons:S.cardsPx(),endButton:{x:S.hud.chant.x,y:S.hud.chant.y,size:S.hud.chant.sizePx},dice:[...S.dice].map(([uid,d])=>({uid,home:d.home.toArray(),scale:d.root.scale.toArray(),pixel:S.diePx(uid)}))}})()","file":"03_时序读回.json"},
  {"waitFor":"__dh.show2().disp.get(hitUid).hp < oldHp","ms":30000},
  {"wait":17},
  {"shot":"04_命中与残影"},
  {"json":"(()=>{const S=__dh.show2();return {beat:S.beatName,busy:S.busy,errors:S.errors,target:S.targetUid,shownPlayer:S.pd,shownState:S.display.state,shownFoes:[...S.disp],engine:S.b.s,buttons:S.cardsPx(),endButton:{x:S.hud.chant.x,y:S.hud.chant.y,size:S.hud.chant.sizePx},dice:[...S.dice].map(([uid,d])=>({uid,home:d.home.toArray(),scale:d.root.scale.toArray(),pixel:S.diePx(uid)}))}})()","file":"04_时序读回.json"},
  {"wait":600},
  {"shot":"05_命中后060秒"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"json":"(()=>{const S=__dh.show2();return {beat:S.beatName,busy:S.busy,errors:S.errors,target:S.targetUid,shownPlayer:S.pd,shownState:S.display.state,shownFoes:[...S.disp],engine:S.b.s,buttons:S.cardsPx(),endButton:{x:S.hud.chant.x,y:S.hud.chant.y,size:S.hud.chant.sizePx},dice:[...S.dice].map(([uid,d])=>({uid,home:d.home.toArray(),scale:d.root.scale.toArray(),pixel:S.diePx(uid)}))}})()","file":"05_批次对账.json"},
  {"eval":"(()=>{const S=__dh.show2();const e=S.b.alive()[0];e.hp=1;S.syncLive();S.selectUids([S.b.dice()[0].uid]);window.deadUid=e.uid;return true})()"},
  {"wait":250},
  {"eval":"(()=>{const S=__dh.show2();S.playSlot(0);return true})()"},
  {"waitFor":"__dh.show2().disp.get(deadUid)?.dying","ms":30000},
  {"wait":100},
  {"shot":"06_死亡动画留牌"},
  {"waitFor":"__dh.show2().disp.get(deadUid)?.gone","ms":30000},
  {"shot":"07_死亡结束移牌"}
]
```

### B：点击、拖拽目标与盾卫拦截

输出子目录：`<尺寸>/B_目标与嘲讽/`。

```json
[
  {"waitFor":"window.__dhready && !!__dh.show2()","ms":30000},
  {"eval":"__dh.pick('mage',7)"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"wait":200},
  {"eval":"(()=>{const S=__dh.show2();S.run.s.nodes[0].waves=[['forest_ghoul','forest_banshee']];S.goto('normal');return true})()"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"eval":"(()=>{const S=__dh.show2();window.otherUid=S.b.alive()[1].uid;S.selectUids([S.b.dice()[0].uid]);return true})()"},
  {"wait":300},
  {"shot":"10_切换前"},
  {"tapEval":"__dh.show2().foePx(otherUid)"},
  {"wait":150},
  {"shot":"11_点击模型切换"},
  {"tapEval":"(()=>{const S=__dh.show2(),p=S.hud.plates.plates.get(S.b.alive()[0].uid);return [p.x,p.y-p.p.h*S.hud.k/2]})()"},
  {"wait":150},
  {"shot":"12_点击敌牌切回"},
  {"eval":"window.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true}))"},
  {"wait":150},
  {"shot":"13_Tab切换"},
  {"json":"(()=>{const S=__dh.show2();return {beat:S.beatName,busy:S.busy,errors:S.errors,target:S.targetUid,shownPlayer:S.pd,shownState:S.display.state,shownFoes:[...S.disp],engine:S.b.s,buttons:S.cardsPx(),endButton:{x:S.hud.chant.x,y:S.hud.chant.y,size:S.hud.chant.sizePx},dice:[...S.dice].map(([uid,d])=>({uid,home:d.home.toArray(),scale:d.root.scale.toArray(),pixel:S.diePx(uid)}))}})()","file":"13_目标读回.json"},
  {"eval":"(()=>{const S=__dh.show2();const c=S.cardsPx()[0],p=S.foePx(S.b.alive()[0].uid);S.pointer('down',c.x,c.y);S.pointer('move',p[0],p[1]);window.dropPx=p;return true})()"},
  {"wait":150},
  {"shot":"14_拖拽另一个目标"},
  {"eval":"(()=>{const S=__dh.show2();S.pointer('up',dropPx[0],dropPx[1]);return true})()"},
  {"wait":100},
  {"shot":"15_松手目标切换"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"eval":"(()=>{const S=__dh.show2();S.run.s.nodes[0].waves=[['forest_treant','forest_banshee','forest_ghoul']];S.goto('normal');return true})()"},
  {"waitFor":"[...__dh.show2().disp.values()].some(d=>d.ct==='guardian' && d.ready)","ms":60000},
  {"wait":17},
  {"shot":"16_首次嘲讽"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"eval":"(()=>{const S=__dh.show2();window.guardUid=S.b.alive().find(e=>e.ct==='guardian').uid;window.protectedUid=S.b.alive().find(e=>e.ct!=='guardian').uid;return true})()"},
  {"shot":"17_盾环与保护锁"},
  {"tapEval":"__dh.show2().foePx(protectedUid)"},
  {"wait":100},
  {"shot":"18_拒绝切换与闪盾"},
  {"json":"(()=>{const S=__dh.show2();return {beat:S.beatName,busy:S.busy,errors:S.errors,target:S.targetUid,shownPlayer:S.pd,shownState:S.display.state,shownFoes:[...S.disp],engine:S.b.s,buttons:S.cardsPx(),endButton:{x:S.hud.chant.x,y:S.hud.chant.y,size:S.hud.chant.sizePx},dice:[...S.dice].map(([uid,d])=>({uid,home:d.home.toArray(),scale:d.root.scale.toArray(),pixel:S.diePx(uid)}))}})()","file":"18_目标应仍为盾卫.json"},
  {"eval":"(()=>{const S=__dh.show2();S.selectUids([S.b.dice()[0].uid]);return true})()"},
  {"wait":300},
  {"eval":"(()=>{const S=__dh.show2();const c=S.cardsPx().find(c=>c.slot===0),p=S.foePx(protectedUid);S.pointer('down',c.x,c.y);S.pointer('move',p[0],p[1]);window.dropPx=p;return true})()"},
  {"wait":120},
  {"shot":"19_灰箭头与锁"},
  {"eval":"(()=>{const S=__dh.show2();S.pointer('up',dropPx[0],dropPx[1]);return true})()"},
  {"wait":100},
  {"shot":"20_无效松手取消"},
  {"json":"(()=>{const S=__dh.show2();return {beat:S.beatName,busy:S.busy,errors:S.errors,target:S.targetUid,shownPlayer:S.pd,shownState:S.display.state,shownFoes:[...S.disp],engine:S.b.s,buttons:S.cardsPx(),endButton:{x:S.hud.chant.x,y:S.hud.chant.y,size:S.hud.chant.sizePx},dice:[...S.dice].map(([uid,d])=>({uid,home:d.home.toArray(),scale:d.root.scale.toArray(),pixel:S.diePx(uid)}))}})()","file":"20_未消耗骰子.json"}
]
```

### C：高阶冰晶、群体绕过嘲讽与状态落位

输出子目录：`<尺寸>/C_群体与状态/`。

```json
[
  {"waitFor":"window.__dhready && !!__dh.show2()","ms":30000},
  {"eval":"__dh.pick('mage',7)"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"wait":200},
  {"eval":"(()=>{const S=__dh.show2();S.run.s.nodes[0].waves=[['forest_treant','forest_banshee','forest_ghoul']];S.goto('normal');return true})()"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"eval":"(()=>{const S=__dh.show2();for(const e of S.b.alive())e.hp=e.maxHp=300;S.syncLive();S.hud.chant.tap();return true})()"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"eval":"(()=>{const S=__dh.show2();const ds=S.b.dice().slice(0,4);if(ds.length!==4)throw Error('需要4颗骰子');for(const d of ds){d.face.value=4;const v=S.dice.get(d.uid);v.setValue(4,v.topIdx,v.topTurns)}S.syncLive();S.selectUids(ds.map(d=>d.uid));window.protectedUid=S.b.alive().find(e=>e.ct!=='guardian').uid;return true})()"},
  {"wait":450},
  {"shot":"30_三档冰晶与结束钮间距"},
  {"eval":"(()=>{const S=__dh.show2();const c=S.cardsPx().find(c=>c.all);if(!c)throw Error('没有群体出牌按钮');window.aoeSlot=c.slot;const p=S.foePx(protectedUid);S.pointer('down',c.x,c.y);S.pointer('move',p[0],p[1]);window.dropPx=p;return true})()"},
  {"wait":150},
  {"shot":"31_群体可瞄准受保护者"},
  {"eval":"(()=>{const S=__dh.show2();S.pointer('up',dropPx[0],dropPx[1]);return true})()"},
  {"waitFor":"__dh.show2().beatName==='statusAdd'","ms":30000},
  {"wait":100},
  {"shot":"32_状态图标飞入中"},
  {"json":"(()=>{const S=__dh.show2();return {beat:S.beatName,busy:S.busy,errors:S.errors,target:S.targetUid,shownPlayer:S.pd,shownState:S.display.state,shownFoes:[...S.disp],engine:S.b.s,buttons:S.cardsPx(),endButton:{x:S.hud.chant.x,y:S.hud.chant.y,size:S.hud.chant.sizePx},dice:[...S.dice].map(([uid,d])=>({uid,home:d.home.toArray(),scale:d.root.scale.toArray(),pixel:S.diePx(uid)}))}})()","file":"32_尚未提交图标.json"},
  {"wait":300},
  {"shot":"33_状态落位"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"json":"(()=>{const S=__dh.show2();return {beat:S.beatName,busy:S.busy,errors:S.errors,target:S.targetUid,shownPlayer:S.pd,shownState:S.display.state,shownFoes:[...S.disp],engine:S.b.s,buttons:S.cardsPx(),endButton:{x:S.hud.chant.x,y:S.hud.chant.y,size:S.hud.chant.sizePx},dice:[...S.dice].map(([uid,d])=>({uid,home:d.home.toArray(),scale:d.root.scale.toArray(),pixel:S.diePx(uid)}))}})()","file":"33_批次对账.json"}
]
```

### D：普通、精英、大首领与召唤构图

输出子目录：`<尺寸>/D_自动取景/`。

```json
[
  {"waitFor":"window.__dhready && !!__dh.show2()","ms":30000},
  {"eval":"__dh.pick('mage',7)"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"wait":200},
  {"shot":"40_普通完整构图"},
  {"eval":"(()=>{const S=__dh.show2();S.goto('elite');return true})()"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"wait":200},
  {"shot":"41_狼人精英完整构图"},
  {"eval":"(()=>{const S=__dh.show2();S.goto('boss');return true})()"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"wait":200},
  {"shot":"42_巫妖首领完整构图"},
  {"json":"(()=>{const S=__dh.show2();return {beat:S.beatName,busy:S.busy,errors:S.errors,target:S.targetUid,shownPlayer:S.pd,shownState:S.display.state,shownFoes:[...S.disp],engine:S.b.s,buttons:S.cardsPx(),endButton:{x:S.hud.chant.x,y:S.hud.chant.y,size:S.hud.chant.sizePx},dice:[...S.dice].map(([uid,d])=>({uid,home:d.home.toArray(),scale:d.root.scale.toArray(),pixel:S.diePx(uid)}))}})()","file":"42_首领初始.json"},
  {"eval":"(()=>{const S=__dh.show2();S.hud.chant.tap();return true})()"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"eval":"(()=>{const S=__dh.show2();S.hud.chant.tap();return true})()"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"eval":"(()=>{const S=__dh.show2();S.hud.chant.tap();return true})()"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"waitFor":"__dh.show2().b.alive().length>1","ms":30000},
  {"wait":200},
  {"shot":"43_首领召唤后完整构图"},
  {"json":"(()=>{const S=__dh.show2();return {beat:S.beatName,busy:S.busy,errors:S.errors,target:S.targetUid,shownPlayer:S.pd,shownState:S.display.state,shownFoes:[...S.disp],engine:S.b.s,buttons:S.cardsPx(),endButton:{x:S.hud.chant.x,y:S.hud.chant.y,size:S.hud.chant.sizePx},dice:[...S.dice].map(([uid,d])=>({uid,home:d.home.toArray(),scale:d.root.scale.toArray(),pixel:S.diePx(uid)}))}})()","file":"43_召唤后.json"}
]
```

### E：刀尽真实事件、当前刀鞘上限与三职业结束钮

输出子目录：`<尺寸>/E_职业按钮与刀鞘/`。

```json
[
  {"waitFor":"window.__dhready && !!__dh.show2()","ms":30000},
  {"eval":"__dh.pick('rogue',7)"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"wait":200},
  {"shot":"50_刺客结束钮与当前上限"},
  {"eval":"(()=>{const S=__dh.show2();for(const e of S.b.alive())e.hp=e.maxHp=300;S.b.s.strikesUsed=S.b.s.maxStrikes-1;S.syncLive();S.refresh();S.selectUids([S.b.dice()[0].uid]);return true})()"},
  {"wait":250},
  {"shot":"51_剩最后一刀"},
  {"eval":"(()=>{const S=__dh.show2();S.playSlot(0);return true})()"},
  {"waitFor":"(()=>{const S=__dh.show2();return S.busy && S.display.state.strikesUsed===S.display.state.maxStrikes})()","ms":30000},
  {"wait":17},
  {"shot":"52_末刀用尽灰槽"},
  {"json":"(()=>{const S=__dh.show2();return {beat:S.beatName,busy:S.busy,errors:S.errors,target:S.targetUid,shownPlayer:S.pd,shownState:S.display.state,shownFoes:[...S.disp],engine:S.b.s,buttons:S.cardsPx(),endButton:{x:S.hud.chant.x,y:S.hud.chant.y,size:S.hud.chant.sizePx},dice:[...S.dice].map(([uid,d])=>({uid,home:d.home.toArray(),scale:d.root.scale.toArray(),pixel:S.diePx(uid)}))}})()","file":"52_刀尽读回.json"},
  {"waitFor":"__dh.show2().display.state.phase==='enemy'","ms":30000},
  {"wait":17},
  {"shot":"53_敌方回合仍刀尽"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"wait":200},
  {"shot":"54_新回合才补满"},
  {"eval":"__dh.pick('warrior',7)"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"wait":200},
  {"shot":"55_狂战结束钮"},
  {"tapEval":"(()=>{const b=__dh.show2().hud.chant;return [b.x,b.y]})()"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"json":"(()=>{const S=__dh.show2();return {beat:S.beatName,busy:S.busy,errors:S.errors,target:S.targetUid,shownPlayer:S.pd,shownState:S.display.state,shownFoes:[...S.disp],engine:S.b.s,buttons:S.cardsPx(),endButton:{x:S.hud.chant.x,y:S.hud.chant.y,size:S.hud.chant.sizePx},dice:[...S.dice].map(([uid,d])=>({uid,home:d.home.toArray(),scale:d.root.scale.toArray(),pixel:S.diePx(uid)}))}})()","file":"55_结束回合读回.json"},
  {"eval":"__dh.pick('mage',7)"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"wait":200},
  {"shot":"56_魔导吟唱钮"}
]
```

### F：半球屏障厚度与场景发光对比

输出子目录：`<尺寸>/F_屏障与场景/`。

```json
[
  {"waitFor":"window.__dhready && !!__dh.show2()","ms":30000},
  {"eval":"__dh.pick('mage',7)"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"wait":200},
  {"shot":"60_战斗场景降光"},
  {"eval":"(()=>{const S=__dh.show2();window.barrierBeat=S.beats.barrier||0;S.hud.chant.tap();return true})()"},
  {"waitFor":"(()=>{const S=__dh.show2();return S.pd.barrier>0 && (S.beats.barrier||0)>barrierBeat})()","ms":30000},
  {"wait":17},
  {"shot":"61_三骰半球屏障"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"eval":"(()=>{const S=__dh.show2();window.barrierBeat=S.beats.barrier||0;S.hud.chant.tap();return true})()"},
  {"waitFor":"(()=>{const S=__dh.show2();return S.pd.barrier>0 && (S.beats.barrier||0)>barrierBeat})()","ms":30000},
  {"wait":17},
  {"shot":"62_四骰屏障增厚"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"json":"(()=>{const S=__dh.show2();return {beat:S.beatName,busy:S.busy,errors:S.errors,target:S.targetUid,shownPlayer:S.pd,shownState:S.display.state,shownFoes:[...S.disp],engine:S.b.s,buttons:S.cardsPx(),endButton:{x:S.hud.chant.x,y:S.hud.chant.y,size:S.hud.chant.sizePx},dice:[...S.dice].map(([uid,d])=>({uid,home:d.home.toArray(),scale:d.root.scale.toArray(),pixel:S.diePx(uid)}))}})()","file":"62_屏障读回.json"}
]
```

### G：同镜头的场景前后对比（旧、新构建各跑一次）

输出子目录：`<尺寸>/G_场景固定镜头/`。

```json
[
  {"waitFor":"window.__dhready && !!__dh.show2()","ms":30000},
  {"eval":"__dh.pick('mage',7)"},
  {"waitFor":"__dh.show2().idle()","ms":60000},
  {"wait":200},
  {"eval":"(()=>{const S=__dh.show2();S.cam([0.72,11.29,11.15],[0.72,1.135,-0.952],36);return true})()"},
  {"wait":100},
  {"shot":"70_同镜头场景对比"}
]
```

请回传上述目录、log.txt 和读回 JSON。重点标记：血条提前变化、死亡移牌过早、保护目标仍可单体出手、头牌越界、骰子偏小、结束钮/高冰晶重叠，以及屏障看成冰冻罩的情况。

