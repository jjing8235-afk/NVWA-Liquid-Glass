# 维护说明（给接手的人和模型）

先读这一份，再动代码。更新记录在 `CHANGELOG.md`。

## 这是什么

SillyTavern（酒馆）1.18 的 UI 扩展，纯前端：`manifest.json` 只加载 `index.js`（ES 模块）和 `style.css`。没有构建步骤，改完刷新酒馆页面就生效。

| 文件 | 作用 |
|---|---|
| `index.js` | 设置面板、玻璃跟踪（给元素挂折射滤镜）、深浅切换、顶栏折叠菜单、快捷回复折叠、首页问候、思考小球、卡片小面板识别、弹窗样式让行、角色卡的世界书小标、配套主题准备状态检查（只读）。设置存在 `extensionSettings.iosLiquidGlass`，`S.v` 是设置版本号（现在是 9），改默认值要加一段迁移 |
| `glass2.js` | 新版物理折射引擎（斯涅尔折射查找表、九宫格贴图） |
| `orb.js` | 思考时的点阵小球（canvas，所有小球共用一个 rAF 循环） |
| `style.css` | 全部样式。按 `/* ---------- 标题 ---------- */` 分段，越往后越新；后面的段会覆盖前面的 |
| `icons.css` | 生成出来的图标，**不要手改**，改生成器 `gen-icons.mjs` |
| `install/` | 酒馆助手一键安装脚本：改 `installer.js` 后跑 `node install/build.mjs` 生成 JSON |
| `walls/` | 瓷白 / 墨黑两张壁纸，第一次运行时由 `ensureWalls()` 上传 |
| `dev/verify/` | 无头 Edge 检查脚本（见下文） |

## 规矩（用户明确要求过的）

1. **NVWA 预设是朋友的，只适配不修改。** 不要改 `data/default-user/OpenAI Settings/NVWA-Chaos4-ST.json` 和它的脚本。`#nvwa-panel`、`#nvwa-memory` 只能从本扩展的 CSS / JS 套样式。测试面板时用“取消”或右上角 × 关，不要点“保存”“恢复默认”。
2. **玻璃不要边缘高光。** 不加白色描边、fresnel、内阴影亮边。玻璃感只靠边缘的折射弧度和一点色散。
3. **为了可读性也不能把玻璃糊掉。** 不要模糊玻璃下面的内容，也不要在玻璃边缘那一圈盖底色。要压暗就只压文字背后的中间部分（比如给内容区垫卡片），边缘保持清透。用户说过一次“体现不出液态玻璃效果了”。
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

酒馆本地在 `D:\SillyTavern`，端口 8090。从别的目录启动必须带路径参数，不然会在当前目录生成一份默认配置并改用 8000 端口：

```
node server.js --configPath D:/SillyTavern/config.yaml --dataRoot D:/SillyTavern/data
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
- 真实的“胭脂盒”人物册（《我不吃牛肉》卡）没在测试环境里跑过，只用仿造的浮窗验证过字影去掉了。
- 思考小球没在真实流式输出的模型上看过。
- 阻塞弹窗的关闭行为由宿主管理，插件不新增强制关闭入口。
- 卡片小面板的识别只看元素自己的底色；底色写在伪元素（`::before`）或背景图片上的面板识别不到。
