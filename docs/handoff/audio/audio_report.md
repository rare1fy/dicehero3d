# 音频交付报告（音效 + 人物语音）

> 任务单：`docs/handoff/AUDIO_BRIEF.md`。清单：`docs/handoff/audio/CUES.md`（由 `sfx/make_cues_md.py` 从规格生成）。
> 音频子代理 11-14 00:10 停在生成阶段（音效只处理完 12 / 106 条）。会话 liufengyun-da 接手，03:50 全部生成完。

## 产出
- **音效**：106 条，344 个候选，都在 `sfx/out_dicehero_v2/mp3/`（同名 wav 在 `wav/`）。规格 `sfx/cues_dicehero_v2.json`，清单 `sfx/out_dicehero_v2/manifest.json`。
  - 生成器：Stable Audio 3 small-sfx，SAME-L 解码器。
  - 后处理：单声道 MP3 64 kbps，响度约 −16 LUFS，峰值不超过 −1 dBFS，首尾静音已裁掉。
- **人物语音**：104 条，312 个候选（三职业各一套台词，加狼人、巫妖），在 `voice/out_dicehero_v2/mp3/`。
  - 生成器：Breeze TTS 2，每条用 SenseVoice 回听，读错就重来；巫妖沿用锁定音色。
- 修了一处流水线 bug：`gen_v2.py post` 处理「不许旋律」类循环音（`mag_chant_loop`）时，乐音检查拿到 None 后崩溃。改成循环音也做乐音检查。

## 挑选页
- 启动：在 `sfx` 目录执行 `..\voice\.venv\Scripts\python.exe pick_server.py 8820`。
- 地址：http://127.0.0.1:8820/
- 用法：点候选播放；「选它」定下一条，或「都不要」加备注；最后点右上角「保存选择」，写入 `sfx/out_dicehero_v2/choices.json`（旧文件先备份成 `choices.prev.json`）。语音那几栏每个角色可以整套选一个音色。

## 质量自查（自动检查的黄色标签，挑的时候留意）
- 所有候选都被标记的音效，可能需要换提示词重新生成：
  - `mag_chant_loop`（吟唱持续）：疑似旋律；
  - `mag_release`（释放爆发）：乐音感；
  - `lose_fall`（战败）：疑似旋律；
  - `hit_crit`（暴击）：偏长。
- 部分候选被标记的：`lich_storm`、`lich_death`（2 个像音乐）、`dice_clack`、`mag_chain`、`rog_dart`、`coin_burst`、`relic_trigger`（偏长）。
- 语音有 15 条三个候选都带提示（多为偏长、听写对不上），主要是魔导出手、刺客大招和几条音色总选。

## 下一步（用户选完以后）
- 照 `choices.json` 实装进 `src/audio/audio.ts`：每个 cue 随机挑一个已选候选，音高 ±4%～8%、音量 ±10% 抖动。
- 命中分层：冲击 + 材质 + 尾音。
- **不用和弦或上行音阶**；连续触发的声音（数金币等）不逐次升调，现在 `count` cue 逐次升调，要改掉。
- 「都不要」的 cue 按用户备注改提示词，重跑：`gen_v2.py gen --only <id>`，再执行 `post_ready.sh`。
