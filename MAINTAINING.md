# 2.0 正式版维护入口（2026-11-11）

当前正式产品版本为 **2.0**（扩展清单使用规范版本号 2.0.0，工作台显示 2.0），来源为测试仓库 1.4.5-test.25，提交 7e779dfd79b6a620926c91e211a6e1e31a15016c。正式整理只变更产品版本、正式仓库标识与文档；功能实现沿用该验证基线。下方旧版说明保留为历史，其中 1.4.4 / local / test 的“当前”状态不代表本次版本。

- 设置命名空间仍为 extensionSettings.iosLiquidGlass，设置迁移版本仍为 9；产品版本 2.0 不要求重置设置。
- 御风性能引擎与棱光折射引擎是显示名，physical / legacy、glassStyle 及 readingStyle 的存储值保留。
- 当前已移除 cardSolid 开关及强制实色底路径，保留卡片作者原有背景和透明度；阅读滤镜限定在消息背景。不要按下方旧说明恢复已删除开关。
- 正式 install/ 安装器、配套主题与相关资源逐字节保留；不要用测试副本覆盖安装边界。
- 离线入口：node dev/verify/*-regression.mjs；浏览器夹具使用隔离页面或拦截写入的宿主测试，不触碰聊天、卡片、预设、主题与账号配置。
- 最近验证、性能场景和物理手机限制见 VALIDATION.json 的正式发布记录及 test.25 followup。桌面模拟不等于真机验收，预设夹具不等于实际第三方脚本验收。
- 备份 / 恢复在独立副本中进行；旧的正式与测试记录是历史，不是未来自动发布授权。

---

## 以下为保留的历史维护记录

# Current local maintenance · 1.4.4-local.9

Date: 2026-11-05. Development started: 2026-11-04. Baseline: local.8. Local-only installation; no GitHub publishing. Older sections below are historical contracts.

- Streaming performance (2026-11-05, measured with st-verify/perf2.mjs: 40 messages, 200 innerHTML rewrites of the last .mes_text under body[data-generating]): frame 36 -> 21 ms, style recalc per update 28 -> 12.5 ms (extension off: 9 ms / 6 ms). Rules learned, keep them:
  - No :has() on anything that matches chat content. Every chat mutation re-checks it. Plain-paragraph styling uses .ilg-prose / .ilg-indentable stamped by markProse() in a MutationObserver (runs before style recalc, so no flash); world-info "nothing selected" uses .ilg-wi-empty from an observer scoped to #WorldInfo.
  - No global ::selection rules with long selectors (each cost ~3 ms per update). Only #send_textarea and #ilg-appearance-panel keep their own selection colour.
  - Before adding chat-facing CSS, measure with st-verify/csscat.mjs (cost per rule category) and cssbisect.mjs (single expensive rules).
- settings-panel.js owns the independent native dialog: a frosted sheet with a left rail (brand, four tabs, master switch; on phones a top bar + tab capsule), each page a stack of titled .ilg-group cards, one control per row; tone tiles show wallpaper thumbnails, Web presets show refraction/thickness meters; warm amber accent; no edge highlights. The user said it need not be iOS-style, just good-looking. modal focus/escape/tab navigation, black/white theme, jelly switches, launcher and TXT download lifecycle. settings-panel.css is loaded by the first CSS import. Keep input IDs, namespace and settings ownership in index.js. No duplicate setting controls. The dialog stays usable when beautification is disabled.
- Appearance controls are integrated; the toolbar icon cycles directly through day/night/custom without a popover. The custom icon is a palette. Preserve the last host-selected custom wallpaper, and do not open the picker automatically when none exists.
- web-presets.js declares four recipes with upstream's five fields (ref, edge, rad, tint, blur), normalized by a whitelist. clear equals the upstream default; the others are NVWA adjustments, not claimed upstream presets. Preset names and the webPreset key are unchanged, so no settings migration. Web maps are bounded, keyed by rounded size/preset/strength, and rebuilt only on resize or island press, never by mouse/pose events. Its fallback blur is recipe-owned, not original barBlur.
- Web filters have a distinct -web ID and webFilter slot; releasing them cannot clear the Original filter. Original physical maps/cache remain owned by glass2.js, unchanged from local.7. Restore only exact stock local.8 geometry via materialRevision=1; preserve custom fields, light/color tuning and S.v=9.
- Original custom-wallpaper composer uses saved low tint instead of 42/64 percent backing. Local contrast changes foreground colors. A directional rim works even for the natural lens preset whose physical specular remains zero.
- Shared pointer/opt-in pose light is direct feedback under reduced motion. Reduced motion still disables interpolation, press springs and CSS transitions. Follow off, hidden documents, no-blur and explicit sensor authorization keep authority. No continuous loop, compass use, telemetry or sensor persistence.
- Compatibility diagnostics download UTF-8 TXT through a short-lived Blob URL. Never copy to clipboard automatically or include chat/draft/name/URL/account data. Keep the raw diagnostic text available internally for verification, not rendered by default.
- Real desktop acceptance must cover installed version, custom-wallpaper tint, mouse response under the actual reduced-motion preference, Original/Web independence, workbench navigation and TXT export. Synthetic sensors and desktop iOS identities do not prove iPhone/WebKit rendering or sustained mobile performance.

---

# 当前本机维护记录 · 1.4.4-local.8

Date: 2026-11-04. Baseline: 1.4.4-local.7. Local only; no GitHub publish. Historical sections below describe older releases and must not be treated as the current parameter contract.

- Keep Original and Liquid Glass Web as independent glassStyle values. Preserve the approved homepage, reading palettes, host font size, native card contents and iframe boundaries. No new prose backing surfaces.
- liquid-glass-web.js ports the upstream fragment on whole-element normalized coordinates (flat centre, strongly bent ring, peak halved, scale = peak * ref; long capsules capped by END_ASPECT = 3, the user asked to soften the ends; the input pill passes bendY 1.5 for a slightly thicker top/bottom ring) and upstream's filter chain, tint, shadow and jelly press (islands only: scale(1.1,.955) held, strength 1.3, 500 ms spring). No light, glow or rim code: the final no-highlight block in style.css must keep winning. Keep bounded textures/cache. Details in LIQUID-GLASS-WEB.md. Upstream attribution stays in LICENSE-liquid-glass.txt.
- glass-lighting.js owns event-driven mouse and opt-in inverse DeviceOrientation lighting. mobileTilt defaults false. requestPermission must execute directly in a user click/change handler; never prompt on startup/reload. Explicit permission rejection and unsupported/insecure contexts fail closed. Calibrate at current grip, remap screen angle and retain sensor values only in memory. Pause on hidden/reduced-motion/no-blur; detach on disable. No permanent animation loop or sensor telemetry.
- One shared source drives original SVG light matrices and CSS rim/glint variables. Input and icon containers retain their geometry and transform:none. Do not use a full white outline. CSS specificity must preserve focus, noShadows, iOS material-off and experiment gates.
- Six original presets share barBlur=.25, mesBlur=.5, panelBlur=1.5, mesTint=.12, tint=.05, highlight=.28, scrim=.12. They differ through curvature, thickness and restrained highlights/shadows. The natural lens preset remains intentionally without specular/sheens. Manual slider values retain authority.
- optics-settings.js applies opticsRevision=1 without changing S.v=9. Only complete recognized previous stock optical combinations migrate. Common values upgrade only while equal to old defaults. Arbitrary custom optics, manually changed blur/tint, unknown settings and the legacy engine are preserved. Reapplying a preset is an explicit full-preset action.
- dev/verify/clear-optics-regression.mjs proves bounded local geometry/positive sampling Jacobian and migration preservation. clear-optics-browser.mjs covers six presets at 402/1280 light/dark, shared mouse lighting, opt-in grant/denial/missing sensor, portrait/landscape/recenter/reload/reduced-motion cleanup. Sensors are simulated in desktop Edge; real iPhone permission, physical response, WebKit, keyboard/safe-area and sustained performance remain unaccepted.
- Final machine-readable evidence is in VALIDATION.json and the task outputs. Install only into the user-authorized desktop instance after verifying its local.7 receipt; private settings backups stay outside outputs. Do not overwrite private settings or publish either repository.

---

﻿# 维护说明（给接手的人和模型）

先读这一份，再动代码。更新记录在 `CHANGELOG.md`。

## 当前正式版：1.4.4

发布基线为测试仓库 1.4.4-test.8（462a6dfabecdb7b85d8fef688bf66cd37fbd8d2c）。用户于 2026-11-01 明确授权晋升正式版并准备社区更新报告。运行代码沿用该测试提交，只有正式界面名称和诊断版本字符串不同；style.css、glass2.js、card-clarity.js、orb.js 与测试基线一致。保留正式安装器、配套主题、字体素材及全部既有文件。

本轮新增聊天背景 glass / transparent，默认 glass；透明档保留边缘、圆角、折射与阴影，不改写用户的 mesBlur。自绘卡片滤镜应用于独立 .ilg-message-glass 背景层，父消息不设置滤镜以保护固定浮窗定位。messageSurface() 复用背景层；卡片移除、模式变化或 untrack() 时正确清理。

cardSolid 默认 true，但只能用卡片可识别的自身颜色补底；未知 iframe 或图片不能用统一深 / 浅色兜底。保留对旧 var(--ilg-card-fallback) 标记的清理，防止透明留白被补成矩形。用户已确认 TT 原卡黑框消失；其他卡片全量兼容和所有真机性能未据此验收。

新增 chatBackground / cardSolid / justifyText 字段通过既有默认值合并路径加载，保留其他字段；产品版本 1.4.4 不改变设置版本 S.v=9。诊断按钮不采集正文、角色名和链接地址，visible 仅代表有布局尺寸；解读滤镜时要同时核对视口位置，屏幕外消息暂停物理折射是既有优化。

### 当前验证入口

- 入口语法与 manifest；运行全部 dev/verify/*-regression.mjs。settings-regression.mjs 在独立源码目录运行时通过 NVWA_HOST_POWER_USER 指向目标宿主的 public/scripts/power-user.js，只读取并隔离执行函数，不调用导入 / 保存 API。
- 隔离浏览器：fold-menu-font-browser、shared-performance-browser、panel-transitions-browser、home-avatar-browser、host-interaction-browser、interaction-scope-browser。使用现有 Playwright 与浏览器，不安装新依赖。
- 本轮玻璃材质、透明留白和固定浮窗的真实本机页面验证使用隔离浏览器，导航前拦截保存请求；不写真实主题、聊天、预设或角色卡。桌面分支覆盖不能替代 TT / iOS 真机。
- 发布前核对与 test.8 的运行代码一致性及正式 install/ 文件 blob 不变；发布后回读远端 main、manifest 与完整文件树。

card-clarity.js 管理消息/浮层 iframe 和通用外部浮层的自动字影处理。外部候选按固定定位或 dialog/menu/listbox/popover 语义识别，排除宿主核心树，不得添加卡片名称或专用 ID 白名单。卡内面板标记由 index.js 管理。

主文档规则由 html.ilg 控制；iframe 内的独立样式由美化总开关负责注入和撤回，不能要求 iframe 自带 html.ilg。用户要求自动处理，不增加字影开关；卡内显式文字阴影也会去掉，关闭美化后恢复。不得扩大为全站清字影、修改源卡、清理用户设置或解除来源隔离。

新增环境字段按默认值合并，继续使用 iosLiquidGlass 和 S.v=9，保留未知字段及备份。compatibilityMode 默认 auto；旧安卓勾选字段保留但不再决定路径；iosSvgTrial 默认 false。后续迁移必须另行验证。

## 这是什么

SillyTavern（酒馆）1.18 的 UI 扩展，纯前端：`manifest.json` 只加载 `index.js`（ES 模块）和 `style.css`。没有构建步骤，改完刷新酒馆页面就生效。

| 文件 | 作用 |
|---|---|
| `index.js` | 设置面板、玻璃跟踪（给元素挂折射滤镜）、深浅切换、顶栏折叠菜单、快捷回复折叠、首页问候、思考小球、卡片小面板识别、弹窗样式让行、角色卡的世界书小标、配套主题准备状态检查（只读）。设置存在 `extensionSettings.iosLiquidGlass`，`S.v` 是设置版本号（现在是 9），改默认值要加一段迁移 |
| `card-clarity.js` | 通用浮层识别及可访问 iframe 的文字样式、来源检查和生命周期清理 |
| `glass2.js` | 新版物理折射引擎（斯涅尔折射查找表、九宫格贴图） |
| `orb.js` | 思考时的点阵小球（canvas，所有小球共用一个 rAF 循环） |
| `style.css` | 全部样式。按 `/* ---------- 标题 ---------- */` 分段，越往后越新；后面的段会覆盖前面的 |
| `icons.css` | 生成出来的图标，**不要手改**，改生成器 `gen-icons.mjs` |
| `install/` | 酒馆助手一键安装脚本：改 `installer.js` 后跑 `node install/build.mjs` 生成 JSON |
| `walls/` | 瓷白 / 墨黑两张壁纸，第一次运行时由 `ensureWalls()` 上传 |
| `dev/verify/` | 无头 Edge 检查脚本（见下文） |

## 规矩（用户明确要求过的）

1. **NVWA 预设是朋友的，只适配不修改。** 不要改 `data/default-user/OpenAI Settings/NVWA-Chaos4-ST.json` 和它的脚本。`#nvwa-panel`、`#nvwa-memory` 只能从本扩展的 CSS / JS 套样式。测试面板时用“取消”或右上角 × 关，不要点“保存”“恢复默认”。
2. **玻璃保留清透折射，并用有方向的反光衬出厚度。** 用户于 2026-11-08 最新要求增加质感高光，已覆盖早先“不加高光”的偏好。原版 / Web 与悬浮球使用同一套轮廓法线反光：弧面细亮峰、内侧柔反射和克制的背光回亮，中心不加白膜。主光固定，仅按压时局部提亮，减少动态效果时停用按压反光；不要重开旧滤镜灯光或叠整圈白描边。用户已授权增加可选手机姿态微光：默认关闭，显式开启 / 点击授权后监听，以当前握姿居中；只更新反光层坐标，不重绘折射，不移动玻璃或文字，不启用鼠标追光。切后台、关闭模糊、关闭扩展和减少动态效果均暂停姿态监听。悬浮球高光沿融合距离场绘制，颈部不留双重接缝。
3. **可读层保持轻，弧边保持清透。** 空输入框与折叠顶栏保持高透；实际文字或 IME 预编辑出现时，输入框才启用中心 3px 柔化和 .11 底色，清空即恢复。展开顶栏与楼层保持原来一致的材质。不要用整块重磨砂或厚实底板抹掉折射弧边。
4. 所有选择器都以 `html.ilg` 开头，关掉扩展时一条都不生效。
5. 设置面板控件的 id 一律 `ilg-opt-*`。不要用 `ilg-<设置名>`，曾经和首页的 `#ilg-home` 撞过。
6. 产品名 NVWA，默认问候里的名字是“NVWA 用户”。作者署名 zytteell8698。
7. 用户主要在**手机**上用（Termux 跑酒馆，从 GitHub 装扩展）。改完要按手机尺寸检查，推到 GitHub 后手机才拿得到。
8. **改完不许自己上传。** 代码、样式、版本号、CHANGELOG 改完，先跟用户说改了什么，等用户确认“可以了 / 上传吧”，才 `git commit` + `git push`。用户要自己在手机上先看效果，没确认就推，等于跳过他的测试。就算改的只是一个字、一份说明，也一样要等。

## 踩过的坑

- **酒馆给所有元素都加了字影**：`* { text-shadow: 0 0 2px var(--SmartThemeShadowColor) }`。深色模式下这个颜色更浓，浅色纸面的卡片上字会发糊。要去掉某一块的字影，就在那一块上把 `--SmartThemeShadowColor` 设成 `transparent`（变量会往下继承）。直接写 `text-shadow: none` 会顺带覆盖卡片自己写的字影。
- **酒馆手机样式把 `#leftSendForm` / `#rightSendForm` 定死成 1.15em 宽**，原本靠换行竖着摆。我们改成一行后必须同时设 `width: auto`，不然按钮会溢出到输入框底下点不到。
- **停止键 `#mes_stop` 不是普通按钮**：酒馆只给它 34px 圆底 + `padding-right: 2px`，里面的 `<i class="fa-solid fa-circle-stop">` 是 `::before` 的 `inline-block`，落在基线上，所以红点总是偏右下、圆底顶到胶囊圆角外。要覆盖 `icons.css` 里的 `html.ilg.ilg-icons #mes_stop`，规则得加 `body #nonQRFormItems` 并写在 `style.css` 末尾；图标要 `display: flex` 居中，别用字号撑盒子。
- **预设的时间栏会画到框外**：`NVWA 前端美化` 的「凝嘤嘤」把像素爱心画在 SVG 的 viewBox 外面（靠 `overflow: visible`），而酒馆的 `.mes_block` 是 `overflow-x: hidden`。用 `.mes:has(.nvt-bar) .mes_block { overflow: visible }` 只放开这类消息，别全局放开。
- **`--mes-right-spacing`（30px）** 是给翻页箭头留的，但箭头在气泡最底下一行。手机上已经把正文右边这块去掉，最后一条消息底下单独让出 38px 给箭头。
- 酒馆有些按钮是用样式表 `display:none` 藏的（比如 `#mes_stop`），**不要给它们设 `display`**。
- **弹窗只处理原生外壳**：通过 ctx.Popup.util.popups 中的真实 DOM 引用确认宿主所有权；仅 data-id 或 .popup 类不够。排除 transparent_dialogue_popup。不注入关闭按钮、不隐藏原生按钮、不派发取消事件；原生关闭/取消/保存由宿主管理。
- **卡片小面板识别**（`tagCard`）以 `<html>` 上的 `ilg-light` class 为准，不是 JS 里的 `lightBg`，因为 CSS 也是按 class 配色的。
- `applyTone()` 在模块初始化时会先于后面的代码执行，在里面调后面才定义的 `let` / `const` 会碰到暂时性死区报错。现在用 `setTimeout(() => queueCards(true))` 推迟到下一拍。
- **第三方浮窗边界**：不扫描或标记第三方弹窗。共享控件样式限定在宿主区域及原生弹窗按钮行，避开自建 dialog / .popup / role=dialog 和 popup-content 内容区；独立 body / movingDivs 浮层不在接管范围。第三方若使用原生 Popup，通用外壳仍走玻璃，内容区不强制换肤。
- 角色卡用 iframe 渲染的前端（酒馆助手的状态栏等）样式进不去，本扩展管不到里面。
- **角色列表那些行自带 `.flex-container` / `.alignitemsflexstart`**：前者 `flex-wrap: wrap`，后者 `align-items: flex-start !important`。不覆盖的话头像和文字会各自换行、卡片被撑成一坨。改这一块的选择器都挂在 `#rm_print_characters_block` 上，并用 `body:not(.charListGrid)` 放过网格视图。
- **`#world_popup` 在酒馆 1.18 里是抽屉的一部分**（`#WorldInfo` 里面），它本身也在 `PANEL_SEL` 里。两层折射叠在一起，世界书编辑区会整块发灰。`index.js` 的 `trackable()` 就是干这个的：`#world_popup` 在抽屉里时不单独当玻璃。以后酒馆要是把它挪出去成独立弹窗，这个判断会自动不管它。
- **世界书条目的四个字段是按位置类型显隐的**：不适用的输入框是 `visibility: hidden` 而不是 `display: none`，留着会多一格空白。CSS 用 `.world_entry_form_control:has(> input[style*="visibility: hidden"])` 整格隐藏。
- **别给 `.world_entry_thin_controls` 设 `align-items: center`**：那一行的高度由右边的标题 + 字段撑起来，居中的话折叠箭头和开关会跑到中间那条线的位置。
- **条目展开区（`.inline-drawer-content` 里的 `.world_entry_edit`）是酒馆最杂的一张表单**：套着 `.world_entry_form_control`（标签 + 控件）、`[name=keywordsAndLogicBlock]`、`[name=perEntryOverridesBlock]`、`[name=contentAndCharFilterBlock]` 几层。正文框的 id 是 `world_entry_content_<uid>`，酒馆用行内 `rows`/高度写死，必须 `!important` 才盖得住。内容那行的四个勾选框不是正文的兄弟节点，是躲在标签行 `span.flexnowrap` 里的 `.flexFlowColumn`，所以要按那个层级改。
- **配套主题安装合同**：用户先导出旧主题，再导入并选中 install/ 下「NVWA 液态玻璃」主题，最后安装插件。主题 custom_css 明确为空，会清空当前自定义 CSS，因此必须事先备份。只导入不等于所有设置已实际应用，必须手动在下拉框选择。
- **插件只检查，不强制切主题**：companionThemeStatus() 读取 #themes 与关键 powerUserSettings，区分 pending / missing / inactive / modified / ready。移除了 autoCleanForeign/defaultThemeName/applyLook 等旧路径和 cssReset 控件，不回写其他主题，也不清空 CSS。
- **旧设置兼容**：保留已存的 cssReset/cssCleaned/cssBackup/cssBackupAt/lookBackup/themeBackup，不自动恢复或清空；恢复本扩展默认参数也保留这些字段。没有手动还原按钮，新用户恢复以安装前导出的主题为准。
- **主题只提供底座**：不放插件 CSS、远程 @import 或脚本，不接触 API/模型/角色/世界书设置。reduced_motion 故意不设置，尊重用户的减少动态效果偏好；其他未列出的非主题选项维持宿主行为。
- **旧版同名主题**：酒馆 1.18 拒绝重复主题名。先导出旧版作备份，退出到另一主题，再由用户删除旧的同名配套主题、重新导入新版并选中；插件不自动删除或覆盖主题文件。
- 主题切换会把 `noShadows` 一起带成主题里的值（Dark Lite 是 true），玻璃投影就交给 `body.noShadows` 那条规则让掉——这是酒馆的设置，别硬顶。
- **楼层胶囊与输入框同材质**：paintFloor() 用 track(floorChip, 'bar')，同一套低模糊/折射倍率与 var(--ilg-tint) 染色；不复用滤镜 ID，尺寸不同必须生成各自贴图。关闭再开启时重新跟踪；保留滚动短暂显示。不要在 CSS 硬写 backdrop-filter。
- **世界书抽屉那颗 select2 多重选择框**：`#world_info` 被 select2 换成 `.select2-selection--multiple`，空着也 63px 高。原因是它把占位内容拆成了两块：一个上下各 15px margin 的空 `ul.select2-selection__rendered`，加一个 `.select2-search--inline`（占位文字其实是这个搜索框的 `placeholder`）。没选中世界书时把空 ul 收掉、搜索框整行撑满 38px 才压得下去；`li.select2-selection__placeholder` 在酒馆 1.18 里根本不出场。
- **select2 的下拉面板挂在 `body` 上**，宽度跟着容器走。容器给窄了（比如之前的 76px），展开的列表一项只放得下一个字。现在 `#world_popup` 里的容器 150px 起，`.select2-container--open .select2-dropdown` 有 `min-width: 240px`。改宽度时两处一起改。
- **下拉里那个勾是酒馆自己画的**（`.select2-results__option::before`，位置由 `padding-left: 30px` 让出来）。给选项写 `padding` 时必须保留这 30px，不然勾会盖在字上。
- **角色卡上的「世界书」小标**（`tagWorlds()`）按头像文件名匹配 `ctx.characters`，匹配不到才退回 `data-chid`。列表是分页渲染的，所以观察器挂在 `#rm_print_characters_block` 上（`watchCharList()`），别挂 body。网格视图用 CSS 隐藏。
- **删除键 `.red_button` 带 `!important` 的实心酒红**，覆盖时必须也带 `!important`、且选择器里要有 id（`#delete_button.red_button`）。
- `settings.json` 只能在酒馆停着的时候改，不然会被覆盖。

## 2026-10-25 世界书与主题保护补充

- 世界书名称灰底来自宿主 `.select2_choice_clickable_buttonstyle` 给 `.__choice__display` 加的背景，不能只清外层 `.__choice`。名称仍须可点击和键盘聚焦。
- 顶部 `span > small` 不要嵌套设置 opacity；次要文字用 `--ilg-wi-secondary` 明确深浅色，正文 15px / 1.8。
- “恢复默认参数”保留 `cssReset/cssCleaned/cssBackup/cssBackupAt/lookBackup/themeBackup`，不等于恢复用户主题。当前没有手动还原按钮。
- 已取消自动清理/主题归默认；插件不关闭其他扩展，同时启用多款整页美化仍可能冲突。

## NVWA 预设 / 记忆面板定点适配（2026-10-26）

- 这两个面板是用户明确要求保留的兼容例外，不代表恢复通用第三方内容换肤。`adaptedPanel()` 必须先通过原生 Popup 注册表，再匹配 `:scope > .popup-body > .popup-content > :is(#nvwa-panel, #nvwa-memory)`；不能仅凭 id 或相似结构接管。
- 外壳 `clearPanel` 和标签栏 `panelTab` 使用低模糊折射；CSS 以 `html.ilg body dialog.popup.ilg-adapted > .popup-body > .popup-content > :is(#nvwa-panel, #nvwa-memory)` 定点覆盖，浅色槽不再使用宿主黑色底。
- 不适配其他记忆插件，不注入关闭键，不操作预设保存/恢复默认。扩展开关和关闭弹窗必须清理 `ilg-adapted` 及内外两层滤镜。
- `node dev/verify/preset-glass-runtime.mjs` 与 `node dev/verify/memory-glass-runtime.mjs` 使用真实已安装脚本；只取消/关闭及切换页签。测试页临时模拟 settings/save 响应，避免记录测试视图和主题选项；不保存业务选项，不打开真实聊天记忆。

## 弹窗让行回归

- 不运行旧 mem/xclose 夹具来证明新合同；旧脚本部分会点确认按钮或模拟过时叉号，不能在真实用户数据上批跑。
- node dev/verify/popup-boundary-regression.mjs 为隔离回归；node dev/verify/popup-native-runtime.mjs 为本地 8090 宿主验证（仅打开、取消临时弹窗，不点业务保存）。真实第三方组合仍需用户验收。
- 配色和字体不再从 body 覆盖 SmartTheme 变量，而限定到酒馆外壳根，避免独立浮窗继承污染；嵌套在外壳里的弹窗仍可能继承父容器值，不承诺未知插件完全隔离。

## 怎么检查

### 抽屉首次打开性能（1.4.1）

- 物理滤镜以贴图对象和材质参数判定复用；几何变化只更新地图坐标及滤镜边界。贴图或材质变化才重建节点，旧引擎路径必须清除物理缓存。不要只按宽高缓存，否则切换材质后会沿用旧效果。
- 隐藏且零尺寸的面板保留上次有效滤镜，不为空尺寸构建。这里没有预先展开抽屉、降低贴图精度或关闭折射。
- 顶栏重新分组只响应顶层抽屉/按钮结构变化，抽屉内部内容变化不参与。仍保留原生抽屉开关和 API 状态图标的同步。
- 先运行 `node dev/verify/filter-reuse-regression.mjs`，再运行设置、弹窗边界及真实宿主回归。离线检查覆盖滤镜几何等价、节点复用、材质失效和观察范围，不等于真机性能验收。
- 无头浏览器测试必须在导航前拦截 `/api/settings/save` 和 `/api/presets/save`，同时关闭测试浏览器的自动恢复聊天；取消面板也可能自动保存上次页签。测试前后核对预设与设置文件哈希，不允许提示词、记忆数据或 UI 页签状态落盘。旧的 preset/memory 检查脚本单独运行时只拦设置保存，需先加上述测试专用保护，不能直接当成零写入测试。
- 用户已查看本地界面并授权发布 1.4.1。桌面 Edge 的手机尺寸与 CPU 限速只作初筛，安卓真机性能仍未测量，不承诺已彻底消除首次停顿。配套主题与安装脚本未改变，无需重新导入主题。
- 若真实酒馆页面同时打开，记忆脚本的 nvwa_panel_memory.at 心跳会自行更新。需先独立确认该字段在无测试浏览器时也变化，再只排除这一个时间戳比较设置；不覆盖用户页面产生的新设置，也不将排除时间戳后的比较描述成原文件哈希完全一致。
- firstLineIndent 默认关闭，使用原设置命名空间保存。仅切换 ilg-indent 根标记，不走 applyRoot 的整页重绘；CSS 只命中普通正文直接段落，带 class/style 的自定义段落、交互和媒体内容不接管。验证脚本为 dev/verify/first-line-indent-regression.mjs。

历史宿主回归使用本地酒馆端口 8090，安装根目录以实际环境为准。从别的目录启动必须带路径参数，不然会在当前目录生成一份默认配置并改用 8000 端口：

```
node server.js --configPath "<ST_ROOT>/config.yaml" --dataRoot "<ST_ROOT>/data"
```

`dev/verify/` 里的脚本用无头 Edge 打开正在跑的酒馆，截图放到 `dev/verify/out/`（不进仓库）。共用部分在 `lib.mjs`。手机尺寸用 `390 844`。

| 脚本 | 查什么 |
|---|---|
| `mob.mjs` | 手机输入框按钮能不能点到、聊天区左右留白、仿状态栏卡片字色、预设面板字色 |
| `mob2.mjs` | 手机排版回归：正文左右留白（两种头像排版都量）、停止键和左边按钮同尺寸且同心、时间栏溢出、正文字号 |
| `overflow.mjs` | 时间栏两侧装饰有没有被 `.mes_block` 裁掉（插一条假消息，数框外的像素） |
| `typo.mjs` | 挑一个带正文的聊天截手机版排版，量字号 / 行高 / 段距 |
| `typo2.mjs` | 同一件事，但气泡 / 非气泡两种聊天样式各量一遍（左右留白必须都不偏） |
| `swipe.mjs` | 最后一条消息的翻页箭头是否压在正文上 |
| `dim.mjs` | 浅色模式里的深色小面板会不会被识别并换字色 |
| `mem.mjs` | 记忆窗口、预设面板、确认框的截图和 × 的位置 |
| `xclose.mjs` | 点 × 后弹窗是否关闭、返回值是否为取消；body 浮窗是否标成 `.ilg-foreign` |
| `memlight.mjs` | 浅色背景下的记忆窗口和确认框 |
| `chat2.mjs` | 台词 / 心里话 / 引用 / 用户消息的样式（只改 DOM，不写进聊天） |
| `chars.mjs` | 角色列表的卡片：手机尺寸下浅 / 深各一张截图，量头像、名字、简介、版本胶囊的位置 |
| `grid.mjs` | 角色卡网格视图：点小方格键，浅色和加 `big-avatars` 各一张，量格子会不会被头像撑破 |
| `cform.mjs` | 新建 / 编辑角色表单（`#form_create`）：一张截图 + 名字 / 描述 / 开场白 / Token 计数的框 |
| `light.mjs`、`dark.mjs`、`tone.mjs` | 深浅模式的面板和控件 |
| `think.mjs` | 思考小球的几种状态（假 DOM） |

注意：`ilg-light` class 会被深浅切换逻辑按时间改回来。要看真的浅色效果，得换壁纸或者在设置里把深浅固定成浅色，只切 class 不算数。

## 发布

1. 改 `manifest.json` 的 `version`，在 `CHANGELOG.md` 最上面写一段。
2. **停下来，等用户确认。** 把改了什么、影响哪些地方讲清楚（最好带一张 380×872 的截图），用户说“可以了 / 推吧”，再往下走。用户没发话就不要 commit、更不要 push。
3. 提交、推到 `main`（https://github.com/jjing8235-afk/NVWA-Liquid-Glass）。
4. 这台电脑上 git 全局配置里写着 `http.https://github.com.proxy=http://127.0.0.1:7890`，但那个端口经常没开（7892 也一样）。直连 github 是通的，所以推送时把这个键清空即可，不需要等代理：
   ```
   git -c "http.https://github.com.proxy=" -c credential.helper= -c "credential.helper=!gh auth git-credential" push
   ```
   注意是 `http.https://github.com.proxy=`（空值覆盖），只写 `-c http.proxy=` 覆盖不掉，git 还会去连 127.0.0.1。
   Windows 自带的凭据管理器会弹窗卡住，所以用 gh 当凭据助手。
5. 用户更新的方式：酒馆助手脚本的“检查更新”按钮，或者 扩展 → 管理扩展 → 更新。更新后要强制刷新一次，不然旧的 `style.css` 还在缓存里。

## 还没验证 / 已知问题

- 酒馆助手一键安装脚本没有完整走过一遍（只在一个临时酒馆上验证过手动安装）。
- 反馈人物册已在真实电脑酒馆完成只读 DOM 定位：body 独立浮层受宿主 2px 全局字影影响。通用识别能命中；用户随后验收测试版通过并授权正式发布。不要把这两项证据混写成自动化已在该旧版宿主完成新版安装/刷新验收。
- 思考小球没在真实流式输出的模型上看过。
- 阻塞弹窗的关闭行为由宿主管理，插件不新增强制关闭入口。
- 卡片小面板的识别只看元素自己的底色；底色写在伪元素（`::before`）或背景图片上的面板识别不到。

## 1.4.2 验证入口

node dev/verify/tt-compat-regression.mjs 覆盖自动适配与回退；settings-regression、popup-boundary-regression、filter-reuse-regression、first-line-indent-regression 保留隔离检查。通用浮层及 iframe 浏览器记录见 VALIDATION.json。跨域、未知无语义绝对定位层和 iOS 真机折射仍需单独确认。

## Local typography 1.4.4-local.3

- This version changes typography only. Existing glass/transparent chat backgrounds and user blur/tint settings remain authoritative; there are no added prose backgrounds or layout observers.
- Custom-photo welcome titles use pearl white with actual 500 weight and restrained text shadow. The approved local caption backdrop is preserved. Body, secondary, dialogue and link colors have distinct neutral roles.
- Native prose styling is CSS-only: direct paragraphs/lists without authored classes/styles/interactive or media content. It does not add data attributes, move paragraphs, wrap cards, or change iframe/fixed-position behavior.
- Narrow native-prose color overrides handle older forced host user.css colors while retaining that stylesheet and authored card colors.
- The prior reading-surface experiment has been withdrawn. index.js no longer imports it; removal from the installed directory preserves a copy outside runtime.
- appearance-browser.mjs verifies computed title weights/colors, three wallpaper modes and persistence, native typography in both polarities, absence of additional surfaces/markers, unchanged glass/transparent preference, and original card handlers/fixed geometry. Optional NVWA_HOST_USER_CSS includes a private local copy of the served host stylesheet. Do not distribute private settings or styles.
- Browser checks are isolated headless Edge evidence. Physical mobile/iOS, long-session performance, and subjective acceptance remain separate.

## Local appearance and reading 1.4.4-local.4

- Adds persisted iosLiquidGlass.readingStyle: warm (default) or classic. Unknown imported values normalize to warm. S.v remains 9; existing and unknown settings are retained.
- The appearance popover uses a consistent sliders icon for custom mode, grouped radio controls, a palette-bound text preview, keyboard focus, short-screen scrolling and reduced-motion support. Theme changes leave the panel open for comparison.
- Warm native prose uses warm ink/pearl with amber dialogue, fine underlines, restrained tracking and distinct emphasis. Classic restores the official 1.4.4 white/orange roles and subtle dialogue highlighter, including their original alpha values. Classic secondary text retains its historical contrast limitations.
- Both palettes have separate light and dark tokens. Only plain native paragraphs/lists are affected; authored classes/styles, media, interactive content and embedded cards are excluded. The shared font family, user font-size and chat geometry remain authoritative.
- No paragraph backdrop, wrappers or reading-surface controller is added. Existing glass/transparent mode, blur and tint remain user-owned. The approved homepage rules remain byte-identical.
- appearance-browser.mjs covers both palettes in both polarities, preview parity, reload persistence, keyboard selection, disable cleanup, card palette/classes/handlers and fixed geometry. Its authored-markup comparison strips only pre-existing renderer tags ilg-card-surface / ilg-lit / ilg-dim; authored classes and declarations are checked separately.
- Isolated headless Edge and actual local-host acceptance are separate evidence. Physical iOS/mobile and subjective visual acceptance remain open.

## Local iOS compatibility material 1.4.4-local.5

- Adds iosLiquidGlass.iosMaterial (boolean true by default, invalid imported values fail closed); S.v stays 9. Desktop/Android do not enter this material route.
- Detects TauriTavern's explicit __TAURITAVERN_HOST__.platform === 'ios' in addition to existing iPhone/iPad identity. The source contract was read from Canary 0a7e7a55e3acfdee4ba1b829719607c1ae57370b, src/scripts/util/host-identity.js. No native invocation or new dependency is introduced.
- A standard or WebKit blur capability is required. Compatibility light uses CSS masks/gradients/shadows on tracked #top-bar, #nonQRFormItems, #ilg-floor and .ilg-island only; no message prose/background/card changes, transforms, layout wrappers, animations or new observers are added.
- no-blur suppresses the new light layers and system backdrop filter; noShadows suppresses its shadow. Existing setting controls retain their values. Active SVG requests remove the compatibility class; explicit blur overrides the SVG request. Material off restores the previous fallback appearance.
- The diagnostics report BUILD_VERSION, TT identity, material intent versus active state, non-bubble meaning and CSS-parse versus rendered-displacement limits. It does not read or include chat/draft/account data.
- ios-material-browser.mjs loads the real extension under desktop Edge with simulated iOS identity. It tests the user's refract=false logs, appearance/persistence, privacy, card event/color and fixed geometry, plus platform/capability failure paths. These results are not Apple WebKit/iPhone evidence.
- IOS-TESTING.md describes the real-device handoff and the unverified mobile installation/keyboard/safe-area/performance boundary. Keep source ZIP and install-by-Git channels distinct; no automatic publish is authorized.

## 外观存档与阅读细修

- `appearance-bookmark.js` 只按 DEFAULTS 中的外观字段复制与校验，排除主开关、宿主壁纸、主题 / CSS 备份和迁移状态；不要把聊天、API 或整个宿主 settings 塞进存档。未知版本和无效字段不可部分恢复。
- `savedAppearance` 是本扩展设置中的单份存档；初始化时只在字段不存在时保存初始配置。保存替换该存档；恢复前暂存当前配置供立即撤销，手动继续调整后结束撤销。恢复走现有 applyRoot / sync，不替用户申请传感器权限。
- 消息轮廓反光使用 .36，工具栏保持原强度；折叠菜单仅减弱其自身放大 / 位移，清透底色与空输入区状态规则保持。作者卡片自己的显式排版与阴影不由这一轮覆盖。
- 多行输入的左右按钮底部对齐；高度、底部留白与自动增长继续复用宿主及既有 ResizeObserver，不叠加第二套键盘视口补偿。


### 2026-11-08 设置入口收整

映卿 / 漾卿仅替换显示名，内部值仍为 original / liquid-web。settings-panel.js 通过 ilg-switch-policy 把手动壁纸与 time / system 整合，隐藏但保留 ilg-opt-tone 及原回调；sync() 负责白天时段、手动缩略图和存档恢复后的状态。低频基础开关移入高级与兼容的 details，既有 false 值必须保留。两套预设各自独立成组；映卿七档不折叠，data-preset 不变，继续由入口模块统一绑定。漾卿预设组保留在 appearancePanel 内以维持入口查询，sync() 同时控制组标题和内容显隐。不要通过新增默认值或迁移强制开启传感器、折射或小球子项。来源许可与技术说明继续使用上游名称。


### 通用仿液态玻璃（2026-11-08）

compatibilityMode 的 blur 值升级为 CSS 材质，不修改存储格式、默认值与旧存档。cssGlassActive() 统一判定，applyRoot() 设置 ilg-css-glass 并停用 Web / reflection 实例，paint() 在纹理路径前返回；untrack() 清理 ilg-css-surface。设置中的渲染方式移到外观页，CSS 模式下隐藏原材质预设但保留参数。不要只隐藏 SVG 显示却继续生成贴图。CSS 对消息和控件使用明确的优先级，需同时核对伪元素 background / mask，避免旧 conic-gradient 未被覆盖而出现放射纹。来源与性能边界见 CSS-GLASS.md。


### 2026-11-09 阅读风格与显示名

随境 = auto，澄卿 = blur，仅改显示名与说明。readingStyle 枚举新增 moon（笺月）、sunny（晴笺），index.js 的 normalizeReadingStyle 与 appearance-bookmark.js 的枚举必须同步；warm / classic 继续有效，无设置迁移。新字体通过 --ilg-prose-font 应用于既有 .ilg-prose 及阅读预览，新段距只对新增两种风格生效。不要把 font-family 施加到 .mes_text 全子树、代码或角色卡自绘内容。样例卡片有自己的字体变量，不随当前选中风格串改。使用系统字体回退，不打包商业字体或增加远程字库。


### 2026-11-09 阅读细修

classic 仅改显示名为栖暖，不迁移设置或外观存档。栖暖 palette 更新为柔琥珀对白与正体心声；青瓷 / 晴笺对白字重使用 450，笺月保留宋体与疏朗节奏。段距、引文细线及链接细修限定在既有 .ilg-prose 边界；引文只用 1px 线。设置卡片用独立 --s-reading-* 变量展示四种配色，不继承当前选中主题而串色；浅色选中标记用白色勾，深色用深色勾以保证对比。预览标题及 aria-label 通过 syncAppearancePanel() 显示当前名称。无新增字体资产、定时器或渲染循环。


### 2026-11-09 字体细修与手机流畅

- 字体：text-spacing-trim / text-autospace 只加在 .ilg-prose 上；笺月心声用 --ilg-prose-em-font（楷体，回退宋体）。不要把“Source Han Serif SC”加回字体列表：Windows 上常常只装了 Heavy 字重，会把整段正文变粗。窄屏（≤600px）行距是 leading − .1，reading-elegance-browser.mjs 的断言已按宽度区分。
- orb.js：可见性交给 IntersectionObserver，尺寸和颜色每 15 帧才读一次，每秒 30 帧。循环里不要再读 offsetParent / clientWidth / getComputedStyle，每帧读一次就会逼浏览器重算一次整页样式。
- 消息玻璃的 ResizeObserver：生成期间（body[data-generating]）kind=mes 的表面放进 mesLate，最多 250ms 重建一次；data-generating 移除时立刻补画。st-verify/late2.mjs 会核对贴图高度最终跟上。
- scheduleAdapt：生成期间间隔至少 1200ms。
- 测量：st-verify/perf-mobile.mjs（THROTTLE=4、MODE=blur 可选；拦截写入，测完核对设置未变）、perf-calls.mjs（统计生成期间各处读取布局的次数）、csscat-m.mjs（手机尺寸下各类 CSS 规则的成本）。手机尺寸下，样式表本身每次重算只多 3.4ms，剩下的开销主要来自酒馆本体和正文排版。

### 1.4.5-test.13 手机专项（2026-11-09）

- viewport.js 是窗口尺寸的唯一入口：onViewportChange(fn) 把 resize / orientationchange / visualViewport.resize 合并到一帧，fn 收到 { widthChanged, heightChanged }。不要再在别处直接监听 window resize。repaintAll 只在宽度变化时调用；高度变化（键盘开合）靠各表面自己的 ResizeObserver 重画。
- 键盘：酒馆的 meta viewport 写了 interactive-widget=resizes-content，安卓 Chrome 会自己缩小布局视口，此时 keyboardInset() 恒为 0。只有 visualViewport 底边比布局视口底边高出 80px 以上、缩放为 1、输入框聚焦时，才写 --ilg-kb 和 html.ilg-kb-open。不要用 innerHeight 差值判断键盘。
- 阅读锚点：createReadingAnchor 只在用户不在底部时记住顶部那条 .mes。酒馆 RossAscends-mods.js 的 ResizeObserver 会在不在底部时按高度差改 scrollTop（保持底边不动），所以我们等下一帧再按锚点复位，并在 250ms 内忽略它引起的 scroll，免得误把那次滚动当成用户在翻。在底部时什么都不做，交给酒馆的 scrollLock / scrollChatToBottom。
- 触摸区域只在 @media (pointer: coarse) 下扩大，用 ::after inset:-2px 或 min-width/height，不改图标大小。
- proseLeading（0 = 跟随风格，1.4–2.6）和 proseInset（0 = 跟随风格，1–48px）写成 --ilg-prose-leading-user 和 --ilg-prose-inset。留白只在 html.ilg-prose-inset-on 时生效：段落用 padding-inline，引文用 margin-inline，保留引文原有的 .85em 内边距。窄屏行距用 --ilg-prose-leading-eff（leading − .1），用户设了值就以用户为准。
- 工作台记忆存在 sessionStorage 的 ilg-studio-memo 里，不进设置文件，也不进外观存档。
- 修好的旧测试：card-solid（夹具缺 MutationObserver）、chat-background（paint 现在先 measure，还会调用 CSS / Web / 反光的判断）、filter-reuse（glass2.js 的 ES import 改成在 vm 里内联 control-material.js；只保留弧度后，换光源角度不再重建）、first-line-indent（缩进早已改成 .ilg-indentable）、mobile-performance（楼层表改成两个窄监听，消息需要 getClientRects）。
- 验证脚本：st-verify/mobile13.mjs（键盘、锚点、触摸、行距、工作台记忆、高度变化不重画，拦截写入，测完核对设置未变）。
