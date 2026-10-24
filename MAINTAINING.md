# 维护说明（给接手的人和模型）

先读这一份，再动代码。更新记录在 `CHANGELOG.md`。

## 这是什么

SillyTavern（酒馆）1.18 的 UI 扩展，纯前端：`manifest.json` 只加载 `index.js`（ES 模块）和 `style.css`。没有构建步骤，改完刷新酒馆页面就生效。

| 文件 | 作用 |
|---|---|
| `index.js` | 设置面板、玻璃跟踪（给元素挂折射滤镜）、深浅切换、顶栏折叠菜单、快捷回复折叠、首页问候、思考小球、卡片小面板识别、弹窗 ×。设置存在 `extensionSettings.iosLiquidGlass`，`S.v` 是设置版本号（现在是 9），改默认值要加一段迁移 |
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
- **弹窗 ×**（`.ilg-popup-x`）派发 dialog 的 `cancel` 事件，和按 Esc 完全一样，结果是 `null`（取消）。不要改成点 `.popup-button-cancel` 或 `data-result="0"`：在“是 / 否 / 取消”三选一的弹窗里，“否”可能是有后果的选项。
- **卡片小面板识别**（`tagCard`）以 `<html>` 上的 `ilg-light` class 为准，不是 JS 里的 `lightBg`，因为 CSS 也是按 class 配色的。
- `applyTone()` 在模块初始化时会先于后面的代码执行，在里面调后面才定义的 `let` / `const` 会碰到暂时性死区报错。现在用 `setTimeout(() => queueCards(true))` 推迟到下一拍。
- **角色卡挂在 `<body>` 上的浮窗**会被标成 `.ilg-foreign`。酒馆自己挂在 body 上的东西列在 `index.js` 的 `OWN_BODY` 里。酒馆新版本多了别的 body 子节点时，要加进这个列表，不然它的字影会被去掉。
- 角色卡用 iframe 渲染的前端（酒馆助手的状态栏等）样式进不去，本扩展管不到里面。
- `settings.json` 只能在酒馆停着的时候改，不然会被覆盖。

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
- 酒馆标成“不许随手关”的阻塞弹窗，单击 × 关不掉（和 Esc 一样），快速点两下才会弹酒馆自己的强制关闭确认。
- 卡片小面板的识别只看元素自己的底色；底色写在伪元素（`::before`）或背景图片上的面板识别不到。
