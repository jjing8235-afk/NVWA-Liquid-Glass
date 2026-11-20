/* NVWA 液态玻璃 · 边缘折射引擎 + 悬浮布局 + 设置面板
   完整折射依赖 backdrop-filter: url(#svg)；安卓 WebView 按能力自动选择兼容路径，iOS 实验独立保留，其他环境降级
   折射引擎有两套：新版物理折射（glass2.js，实验台 v2 移植）和旧版（本文件里的 makeMap / buildFilter） */
import { getMaps, clearMaps, physicalFilter, resizePhysicalFilter } from './glass2.js';
import { makeOrb } from './orb.js';
import { createIOSWallpaperRefraction } from './ios-wallpaper-refraction.js';
import { createBundledWallpapers } from './bundled-wallpapers.js';
import { largeWebViewMessage } from './surface-policy.js';
import { createInteractionDiagnostics } from './interaction-diagnostics.js';
import { armFlickerCapture, takeFlickerArm, createFlickerCapture, filterFamily } from './flicker-diagnostics.js';
import { externalMessageRendering, externalScrollControl } from './chat-compat.js';
import { positionFixed } from './fixed-position.js';
import { createMessageRendering } from './message-rendering.js';
import { createHostInteractionState } from './host-interaction-state.js';
import { createComposerTools } from './composer-tools.js';
import { normalizeComposerLayout, composerLayoutPicker, syncComposerLayout } from './composer-layout.js';
import { migrateClearOptics, restoreOriginalRefraction } from './optics-settings.js';
import { WEB_PRESETS, normalizeWebPreset, webPresetOf } from './web-presets.js';
import { createBallGlass } from './ball-glass.js';
import { installMessageIcons } from './mes-icons.js';
import { createSettingsPanel, downloadDiagnostic } from './settings-panel.js';
import { createLiquidGlassWeb } from './liquid-glass-web.js';
import { createCardTextClarity } from './card-clarity.js';
import { createGlassReflections } from './glass-reflections.js';
import { createGlassLighting } from './glass-lighting.js';
import { createLightScope } from './light-scope.js';
import { wallpaperLayout, wallpaperPoint, topTone } from './wallpaper-sampling.js';
import { createAppearanceBookmark } from './appearance-bookmark.js';
import { createTypographyStudio, migrateProseSpacing } from './typography.js';
import { onViewportChange, createKeyboard, createReadingAnchor } from './viewport.js';

// 同一个酒馆里装了两份（比如手动拷的一份 + 从 GitHub 装的一份）时只跑先加载的那份，不然顶栏、面板会出两套
if (window.__ilgLoaded) throw new Error('[NVWA 液态玻璃] 已经有一份在运行，这份跳过');
window.__ilgLoaded = new URL('.', import.meta.url).pathname;

let studioUI = null;
let flickerCapture = null, flickerReport = null;
const MODULE = 'iosLiquidGlass';
const BUILD_VERSION = '2.0.6';
const ENGINE_NAMES = Object.freeze({performance:'御风性能引擎',refraction:'棱光折射引擎'});
const NS = 'http://www.w3.org/2000/svg';
const ctx = SillyTavern.getContext();

// 新版引擎的一键预设，数值和实验台一致（p 开头的参数只给新版用，旧版的参数不受影响）
// 自然弧度：保留原始放大截面，不叠加物理高光；方向性细反光由独立表面层处理（用户给的 iOS 锁屏参考图就是这样）。
// 用户要的是“边缘不扭曲，只放大”：所以用放大镜截面（lens），边缘内容放大 3 倍，往里 40px 内平滑恢复原样，不翻转、不折叠。
// 物理折射截面在弧带里会把内容翻过来（看着像扭曲的镜像），只给其他预设用。放大镜截面的折射强度由引擎封顶，调再大也不会折叠
const NATURAL_V4 = { pStrength: 1.2, pThickness: 50, pBezel: 28, pIor: 1.5, pAberration: 4, pSaturate: 1.15, pBrightness: 1.02, pContrast: 1, pSpecular: 0, pSharp: 4, pEdgeShade: 0, pFresnel: 0, pCaustic: 0, pShadow: 0.5, pSheen: 0 };
const PRESETS = {
    "natural": [
        "自然弧度（边缘放大）",
        {
            "profile": "lens",
            "pMagnify": 3,
            "pStrength": 1,
            "pBezel": 40,
            "pAberration": 3,
            "pSaturate": 1.08,
            "pBrightness": 1.01,
            "pContrast": 1,
            "pSpecular": 0,
            "pEdgeShade": 0,
            "pFresnel": 0,
            "pCaustic": 0,
            "pShadow": 0.34,
            "pSheen": 0,
            "barBlur": 0.25,
            "mesBlur": 0.5,
            "panelBlur": 1.5,
            "mesTint": 0.12,
            "tint": 0.05,
            "highlight": 0.28,
            "scrim": 0.12,
            "saturate": 1.1,
            "brightness": 1.02
        }
    ],
    "ultra": [
        "超清透",
        {
            "profile": "squircle",
            "pStrength": 1.1,
            "pThickness": 22,
            "pBezel": 14,
            "pIor": 1.5,
            "pAberration": 0,
            "pSaturate": 1.06,
            "pBrightness": 1,
            "pContrast": 1,
            "pSpecular": 0.28,
            "pSharp": 7,
            "pEdgeShade": 0.025,
            "pFresnel": 0.012,
            "pCaustic": 0.07,
            "pShadow": 0.3,
            "pSheen": 0.02,
            "barBlur": 0.25,
            "mesBlur": 0.5,
            "panelBlur": 1.5,
            "mesTint": 0.12,
            "tint": 0.05,
            "highlight": 0.28,
            "scrim": 0.12,
            "saturate": 1.1,
            "brightness": 1.02
        }
    ],
    "depth": [
        "清透立体",
        {
            "profile": "squircle",
            "pStrength": 1.3,
            "pThickness": 36,
            "pBezel": 17,
            "pIor": 1.5,
            "pAberration": 0,
            "pSaturate": 1.1,
            "pBrightness": 1.015,
            "pContrast": 1.01,
            "pSpecular": 0.42,
            "pSharp": 6,
            "pEdgeShade": 0.055,
            "pFresnel": 0.025,
            "pCaustic": 0.15,
            "pShadow": 0.5,
            "pSheen": 0.035,
            "barBlur": 0.25,
            "mesBlur": 0.5,
            "panelBlur": 1.5,
            "mesTint": 0.12,
            "tint": 0.05,
            "highlight": 0.28,
            "scrim": 0.12,
            "saturate": 1.1,
            "brightness": 1.02
        }
    ],
    "thin": [
        "轻薄",
        {
            "profile": "squircle",
            "pStrength": 0.8,
            "pThickness": 20,
            "pBezel": 18,
            "pIor": 1.45,
            "pAberration": 0,
            "pSaturate": 1.06,
            "pBrightness": 1.01,
            "pContrast": 1,
            "pSpecular": 0.24,
            "pSharp": 7,
            "pEdgeShade": 0.018,
            "pFresnel": 0.01,
            "pCaustic": 0.05,
            "pShadow": 0.25,
            "pSheen": 0.015,
            "barBlur": 0.25,
            "mesBlur": 0.5,
            "panelBlur": 1.5,
            "mesTint": 0.12,
            "tint": 0.05,
            "highlight": 0.28,
            "scrim": 0.12,
            "saturate": 1.1,
            "brightness": 1.02
        }
    ],
    "standard": [
        "标准",
        {
            "profile": "squircle",
            "pStrength": 1,
            "pThickness": 30,
            "pBezel": 24,
            "pIor": 1.5,
            "pAberration": 0,
            "pSaturate": 1.1,
            "pBrightness": 1.01,
            "pContrast": 1.01,
            "pSpecular": 0.38,
            "pSharp": 6,
            "pEdgeShade": 0.04,
            "pFresnel": 0.02,
            "pCaustic": 0.12,
            "pShadow": 0.4,
            "pSheen": 0.025,
            "barBlur": 0.25,
            "mesBlur": 0.5,
            "panelBlur": 1.5,
            "mesTint": 0.12,
            "tint": 0.05,
            "highlight": 0.28,
            "scrim": 0.12,
            "saturate": 1.1,
            "brightness": 1.02
        }
    ],
    "thick": [
        "厚玻璃",
        {
            "profile": "squircle",
            "pStrength": 1.4,
            "pThickness": 55,
            "pBezel": 34,
            "pIor": 1.6,
            "pAberration": 4,
            "pSaturate": 1.11,
            "pBrightness": 1.015,
            "pContrast": 1.01,
            "pSpecular": 0.5,
            "pSharp": 5,
            "pEdgeShade": 0.08,
            "pFresnel": 0.035,
            "pCaustic": 0.22,
            "pShadow": 0.6,
            "pSheen": 0.04,
            "barBlur": 0.25,
            "mesBlur": 0.5,
            "panelBlur": 1.5,
            "mesTint": 0.12,
            "tint": 0.05,
            "highlight": 0.28,
            "scrim": 0.12,
            "saturate": 1.1,
            "brightness": 1.02
        }
    ],
    "extreme": [
        "夸张",
        {
            "profile": "squircle",
            "pStrength": 1.8,
            "pThickness": 80,
            "pBezel": 44,
            "pIor": 1.8,
            "pAberration": 10,
            "pSaturate": 1.13,
            "pBrightness": 1.02,
            "pContrast": 1.015,
            "pSpecular": 0.62,
            "pSharp": 5,
            "pEdgeShade": 0.1,
            "pFresnel": 0.045,
            "pCaustic": 0.3,
            "pShadow": 0.7,
            "pSheen": 0.05,
            "barBlur": 0.25,
            "mesBlur": 0.5,
            "panelBlur": 1.5,
            "mesTint": 0.12,
            "tint": 0.05,
            "highlight": 0.28,
            "scrim": 0.12,
            "saturate": 1.1,
            "brightness": 1.02
        }
    ]
};
const CLEAR_OPTICS_PREVIOUS = {
    "natural": [
        "自然弧度（清透折射）",
        {
            "profile": "lens",
            "pMagnify": 1.7,
            "pStrength": 0.8,
            "pBezel": 14,
            "pAberration": 0,
            "pSaturate": 1.08,
            "pBrightness": 1.01,
            "pContrast": 1,
            "pSpecular": 0,
            "pEdgeShade": 0,
            "pFresnel": 0,
            "pCaustic": 0,
            "pShadow": 0.34,
            "pSheen": 0,
            "barBlur": 0.25,
            "mesBlur": 0.5,
            "panelBlur": 1.5,
            "mesTint": 0.12,
            "tint": 0.05,
            "highlight": 0.28,
            "scrim": 0.12,
            "saturate": 1.1,
            "brightness": 1.02
        }
    ],
    "ultra": [
        "超清透",
        {
            "profile": "squircle",
            "pStrength": 0.65,
            "pThickness": 12,
            "pBezel": 10,
            "pIor": 1.45,
            "pAberration": 0,
            "pSaturate": 1.06,
            "pBrightness": 1,
            "pContrast": 1,
            "pSpecular": 0.28,
            "pSharp": 7,
            "pEdgeShade": 0.025,
            "pFresnel": 0.012,
            "pCaustic": 0.07,
            "pShadow": 0.3,
            "pSheen": 0.02,
            "barBlur": 0.25,
            "mesBlur": 0.5,
            "panelBlur": 1.5,
            "mesTint": 0.12,
            "tint": 0.05,
            "highlight": 0.28,
            "scrim": 0.12,
            "saturate": 1.1,
            "brightness": 1.02
        }
    ],
    "depth": [
        "清透立体",
        {
            "profile": "squircle",
            "pStrength": 0.85,
            "pThickness": 24,
            "pBezel": 15,
            "pIor": 1.48,
            "pAberration": 0,
            "pSaturate": 1.1,
            "pBrightness": 1.015,
            "pContrast": 1.01,
            "pSpecular": 0.42,
            "pSharp": 6,
            "pEdgeShade": 0.055,
            "pFresnel": 0.025,
            "pCaustic": 0.15,
            "pShadow": 0.5,
            "pSheen": 0.035,
            "barBlur": 0.25,
            "mesBlur": 0.5,
            "panelBlur": 1.5,
            "mesTint": 0.12,
            "tint": 0.05,
            "highlight": 0.28,
            "scrim": 0.12,
            "saturate": 1.1,
            "brightness": 1.02
        }
    ],
    "thin": [
        "轻薄",
        {
            "profile": "squircle",
            "pStrength": 0.5,
            "pThickness": 10,
            "pBezel": 9,
            "pIor": 1.42,
            "pAberration": 0,
            "pSaturate": 1.06,
            "pBrightness": 1.01,
            "pContrast": 1,
            "pSpecular": 0.24,
            "pSharp": 7,
            "pEdgeShade": 0.018,
            "pFresnel": 0.01,
            "pCaustic": 0.05,
            "pShadow": 0.25,
            "pSheen": 0.015,
            "barBlur": 0.25,
            "mesBlur": 0.5,
            "panelBlur": 1.5,
            "mesTint": 0.12,
            "tint": 0.05,
            "highlight": 0.28,
            "scrim": 0.12,
            "saturate": 1.1,
            "brightness": 1.02
        }
    ],
    "standard": [
        "标准",
        {
            "profile": "squircle",
            "pStrength": 0.9,
            "pThickness": 22,
            "pBezel": 14,
            "pIor": 1.5,
            "pAberration": 0,
            "pSaturate": 1.1,
            "pBrightness": 1.01,
            "pContrast": 1.01,
            "pSpecular": 0.38,
            "pSharp": 6,
            "pEdgeShade": 0.04,
            "pFresnel": 0.02,
            "pCaustic": 0.12,
            "pShadow": 0.4,
            "pSheen": 0.025,
            "barBlur": 0.25,
            "mesBlur": 0.5,
            "panelBlur": 1.5,
            "mesTint": 0.12,
            "tint": 0.05,
            "highlight": 0.28,
            "scrim": 0.12,
            "saturate": 1.1,
            "brightness": 1.02
        }
    ],
    "thick": [
        "厚玻璃",
        {
            "profile": "squircle",
            "pStrength": 1,
            "pThickness": 34,
            "pBezel": 19,
            "pIor": 1.52,
            "pAberration": 0.35,
            "pSaturate": 1.11,
            "pBrightness": 1.015,
            "pContrast": 1.01,
            "pSpecular": 0.5,
            "pSharp": 5,
            "pEdgeShade": 0.08,
            "pFresnel": 0.035,
            "pCaustic": 0.22,
            "pShadow": 0.6,
            "pSheen": 0.04,
            "barBlur": 0.25,
            "mesBlur": 0.5,
            "panelBlur": 1.5,
            "mesTint": 0.12,
            "tint": 0.05,
            "highlight": 0.28,
            "scrim": 0.12,
            "saturate": 1.1,
            "brightness": 1.02
        }
    ],
    "extreme": [
        "夸张",
        {
            "profile": "squircle",
            "pStrength": 1.15,
            "pThickness": 44,
            "pBezel": 23,
            "pIor": 1.55,
            "pAberration": 0.7,
            "pSaturate": 1.13,
            "pBrightness": 1.02,
            "pContrast": 1.015,
            "pSpecular": 0.62,
            "pSharp": 5,
            "pEdgeShade": 0.1,
            "pFresnel": 0.045,
            "pCaustic": 0.3,
            "pShadow": 0.7,
            "pSheen": 0.05,
            "barBlur": 0.25,
            "mesBlur": 0.5,
            "panelBlur": 1.5,
            "mesTint": 0.12,
            "tint": 0.05,
            "highlight": 0.28,
            "scrim": 0.12,
            "saturate": 1.1,
            "brightness": 1.02
        }
    ]
};
const PRESETS_PREVIOUS = {
    "natural": [
        "自然弧度（清透折射）",
        {
            "profile": "lens",
            "pMagnify": 3,
            "pStrength": 1,
            "pBezel": 40,
            "pAberration": 3,
            "pSaturate": 1.15,
            "pBrightness": 1.02,
            "pContrast": 1,
            "pSpecular": 0,
            "pEdgeShade": 0,
            "pFresnel": 0,
            "pCaustic": 0,
            "pShadow": 0.6,
            "pSheen": 0
        }
    ],
    "ultra": [
        "超清透",
        {
            "profile": "squircle",
            "pStrength": 1.1,
            "pThickness": 22,
            "pBezel": 14,
            "pIor": 1.5,
            "pAberration": 0,
            "pSaturate": 1.08,
            "pBrightness": 1,
            "pContrast": 1,
            "pSpecular": 0.75,
            "pSharp": 5,
            "pEdgeShade": 0,
            "pFresnel": 0,
            "pCaustic": 0,
            "pShadow": 0.5,
            "pSheen": 0
        }
    ],
    "depth": [
        "清透立体",
        {
            "profile": "squircle",
            "pStrength": 1.3,
            "pThickness": 36,
            "pBezel": 17,
            "pIor": 1.5,
            "pAberration": 0,
            "pSaturate": 1.25,
            "pBrightness": 1.03,
            "pContrast": 1.05,
            "pSpecular": 1,
            "pSharp": 4,
            "pEdgeShade": 0.2,
            "pFresnel": 0.12,
            "pCaustic": 0.6,
            "pShadow": 0.85,
            "pSheen": 0.45
        }
    ],
    "thin": [
        "轻薄",
        {
            "profile": "squircle",
            "pStrength": 0.8,
            "pThickness": 20,
            "pBezel": 18,
            "pIor": 1.45,
            "pAberration": 0,
            "pSaturate": 1.3,
            "pBrightness": 1.02,
            "pContrast": 1,
            "pSpecular": 0.6,
            "pSharp": 4,
            "pEdgeShade": 0.1,
            "pFresnel": 0.15,
            "pCaustic": 0.25,
            "pShadow": 0.55,
            "pSheen": 0.25
        }
    ],
    "standard": [
        "标准",
        {
            "profile": "squircle",
            "pStrength": 1,
            "pThickness": 30,
            "pBezel": 24,
            "pIor": 1.5,
            "pAberration": 0,
            "pSaturate": 1.5,
            "pBrightness": 1.02,
            "pContrast": 1,
            "pSpecular": 0.9,
            "pSharp": 3,
            "pEdgeShade": 0,
            "pFresnel": 0,
            "pCaustic": 0,
            "pShadow": 0.7,
            "pSheen": 0
        }
    ],
    "thick": [
        "厚玻璃",
        {
            "profile": "squircle",
            "pStrength": 1.4,
            "pThickness": 55,
            "pBezel": 34,
            "pIor": 1.6,
            "pAberration": 4,
            "pSaturate": 1.6,
            "pBrightness": 1.04,
            "pContrast": 1.04,
            "pSpecular": 1.25,
            "pSharp": 2.5,
            "pEdgeShade": 0.4,
            "pFresnel": 0.4,
            "pCaustic": 0.7,
            "pShadow": 1,
            "pSheen": 0.5
        }
    ],
    "extreme": [
        "夸张",
        {
            "profile": "squircle",
            "pStrength": 1.8,
            "pThickness": 80,
            "pBezel": 44,
            "pIor": 1.8,
            "pAberration": 10,
            "pSaturate": 1.85,
            "pBrightness": 1.06,
            "pContrast": 1.08,
            "pSpecular": 1.7,
            "pSharp": 2,
            "pEdgeShade": 0.5,
            "pFresnel": 0.55,
            "pCaustic": 0.9,
            "pShadow": 1.3,
            "pSheen": 0.6
        }
    ]
};
const DEFAULTS = {
    chatBackground: 'glass', chatVeil: 45, chatFontSize: 0, firstLineIndent: false, justifyText: false, compatibilityMode: 'auto', androidWebViewRefract: false, iosSvgTrial: false, iosMaterial: true,
    enabled: true, float: true, islands: true, fold: true, topShortcut1: '', topShortcut2: '', qrFold: true, composerLayout: 'split', home: true, toneBtn: true, homeName: 'NVWA 用户', icons: true, refract: true, refractMes: true, font: true, tone: 'time', dayStart: 7, dayEnd: 19, avatar: 'line', orb: true, panelRead: true, dock: false, floatBall: true, ballSnap: true, ballFuse: true, ballSide: 'right', ballY: 0.62, ballFx: 0.92, ballFy: 0.6, ballDock: false,
    webPreset: 'clear', mobileTilt: false, glassStyle: 'original', engine: 'physical', follow: true, pLight: 135, customTextTone: 'auto', customWallpaper: '', readingStyle: 'warm', proseLeading: 0, proseInset: 0, typography: null,
    // 自然弧度没写的参数（厚度、折射率等，只给物理折射截面用）沿用清透立体的
    ...PRESETS.depth[1], ...PRESETS.natural[1],
    scale: 95, bevel: 30, curve: 2.2, aberration: 8,
    barBlur: .25, mesBlur: .5, panelBlur: 1.5, mesTint: .12, scrim: .12,
    saturate: 1.1, brightness: 1.02, tint: .05, highlight: .28, radius: 22,
    // 旧版备份字段继续保留；新流程不再自动切主题或清空自定义 CSS。
    cssCleaned: false, cssBackup: '', cssBackupAt: '', lookBackup: '', themeBackup: '',
};
// [键, 名称, 最小, 最大, 步长, 单位, 只对哪个引擎显示, 只对哪种截面显示（lens 放大镜 / snell 物理折射）]
const SLIDERS = [
    ['pMagnify', '边缘放大倍数', 1, 6, 0.1, '×', 'physical', 'lens'],
    ['pStrength', '折射强度', 0, 5, 0.05, '×', 'physical'],
    ['pThickness', '玻璃厚度', 4, 150, 1, 'px', 'physical', 'snell'],
    ['pBezel', '边缘弧面宽度', 4, 100, 1, 'px', 'physical'],
    ['pIor', '折射率', 1, 3, 0.01, '', 'physical', 'snell'],
    ['pAberration', '色散彩边', 0, 40, 0.05, '%', 'physical'],
    ['pSaturate', '饱和度', 0, 3, 0.01, '', 'physical'],
    ['pBrightness', '亮度', 0.6, 1.6, 0.01, '', 'physical'],
    ['pContrast', '对比度', 0.6, 1.6, 0.005, '', 'physical'],
    // 旧版光照参数仍保存在 S 中以兼容预设；表面高光由统一反射层绘制，不再重复应用滤镜光照。
    ['pShadow', '悬浮投影', 0, 2, 0.05, '', 'physical'],
    ['scale', '折射强度', 0, 200, 1, '', 'legacy'],
    ['bevel', '边缘弧度宽度', 4, 60, 1, 'px', 'legacy'],
    ['curve', '弧面形状', 0.6, 5, 0.1, '', 'legacy'],
    ['aberration', '色散彩边', 0, 30, 1, '', 'legacy'],
    ['saturate', '饱和度', 0.5, 3, 0.05, '', 'legacy'],
    ['brightness', '亮度', 0.6, 1.5, 0.01, '', 'legacy'],
    ['barBlur', '顶栏/输入框模糊', 0, 30, 0.25, 'px'],
    ['mesBlur', '消息卡片模糊', 0, 30, 0.25, 'px'],
    ['mesTint', '消息卡片底色浓度（越高字越清楚）', 0, 1, 0.01, ''],
    ['scrim', '顶栏/输入框后的渐暗（防止字和图标叠在一起）', 0, 1, 0.01, ''],
    ['panelBlur', '抽屉/弹窗模糊', 0, 40, 0.25, 'px'],
    ['tint', '顶栏/输入框底色', 0, 0.6, 0.01, ''],
    ['radius', '消息卡片圆角', 0, 40, 1, 'px'],
];
const TOGGLES = [
    ['enabled', '启用液态玻璃美化'],
    ['float', '顶栏和输入框悬浮在聊天内容上方'],
    ['icons', 'iOS 风格图标'],
    ['refract', '边缘折射（取决于当前渲染环境）'],
    ['iosSvgTrial', 'iOS WebKit SVG 折射实验（可能无效；关闭可回退）'],
    ['iosMaterial', 'iOS 兼容玻璃（推荐）'],
    ['refractMes', '消息卡片也折射（长聊天卡顿时关掉）'],
    ['mobileTilt', '手机姿态高光'],
    ['font', '统一字体：安卓用系统字体，其他设备用思源黑体或苹方'],
    ['firstLineIndent', '普通正文首行缩进两个汉字（不影响列表、代码和自带样式面板）'],
    ['justifyText', '正文两端对齐（右边不参差；关掉是左对齐，右边缘会自然留白）'],
    ['islands', '顶栏拆成三个分组的悬浮岛'],
    ['fold', '顶栏折叠：设置类图标收进左上角菜单'],
    ['qrFold', '快捷回复收进输入框左边的按钮'],
    ['toneBtn', '顶栏显示白天 / 黑夜 / 自定义选择'],
    ['home', '首页只显示问候语（按手机时间：早上好 / 晚上好）'],
    ['orb', '模型思考时显示旋转的点阵小球'],
    ['panelRead', '抽屉、弹窗用更厚的底色和模糊，花壁纸上也看得清字'],
    ['floatBall', '屏幕上放一颗液态玻璃小球，点一下打开玻璃设置（可拖动）'],
    ['ballSnap', '松手后小球吸回最近的左 / 右边（关掉就停在松手的地方）'],
    ['ballFuse', '小球拖到顶栏或输入框旁边时和那块玻璃边缘融合'],
];

// Apply platform defaults before merging saved preferences. Explicit saved choices win.
if (window.__TAURITAVERN_HOST__?.platform === 'ios' || /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) DEFAULTS.glassStyle = 'liquid-web';
ctx.extensionSettings[MODULE] = Object.assign({}, DEFAULTS, ctx.extensionSettings[MODULE]);
const S = ctx.extensionSettings[MODULE];
// Retired option: authored card colors and transparency always remain in control.
if (Object.hasOwn(S, 'cardSolid')) { delete S.cardSolid; ctx.saveSettingsDebounced(); }
S.chatVeil = normalizeChatVeil(S.chatVeil);
S.chatFontSize = normalizeChatFontSize(S.chatFontSize);
migrateProseSpacing(S);
S.chatBackground = S.chatBackground === 'transparent' ? 'transparent' : 'glass';
S.readingStyle = normalizeReadingStyle(S.readingStyle);
S.iosMaterial = S.iosMaterial === true;
S.glassStyle = S.glassStyle === 'liquid-web' ? 'liquid-web' : 'original';
S.composerLayout = normalizeComposerLayout(S.composerLayout);
// Folded toolbar is the sole layout; retain legacy fields for saved looks.
function normalizeTopStyleSettings(settings) {
    const values = [settings.topShortcut1, settings.topShortcut2].map(value =>
        typeof value === 'string' && /^[A-Za-z][\w:.-]{0,119}$/.test(value) &&
        !['ilg-fold-button', 'ilg-tone-button', 'persona-management-button', 'rightNavHolder'].includes(value) ? value : '');
    if (values[0] === values[1]) values[1] = '';
    const next = { islands: true, dock: false, fold: true, topShortcut1: values[0], topShortcut2: values[1] };
    const changed = Object.entries(next).some(([key, value]) => settings[key] !== value);
    Object.assign(settings, next);
    return changed;
}
if (normalizeTopStyleSettings(S)) ctx.saveSettingsDebounced();
// v2：玻璃改得更厚、更透。只迁移还停在旧默认值的参数，用户自己调过的不动
if (!S.v || S.v < 2) {
    const OLD = { scale: 70, bevel: 22, aberration: 6, barBlur: 2, mesBlur: 6, panelBlur: 18, tint: 0.08 };
    for (const [k, v] of Object.entries(OLD)) if (S[k] === v) S[k] = DEFAULTS[k];
    S.v = 2;
    ctx.saveSettingsDebounced();
}
// v3：清透立体预设的边缘反光、厚度阴影调低。同样只改还停在旧默认值的
if (S.v < 3) {
    if (S.pFresnel === 0.32) S.pFresnel = PRESETS.depth[1].pFresnel;
    if (S.pEdgeShade === 0.32) S.pEdgeShade = PRESETS.depth[1].pEdgeShade;
    S.v = 3;
    ctx.saveSettingsDebounced();
}
// v4：默认改成“自然弧度”（不要边缘高光，用户给了参考图）。还停在清透立体默认值上的整组换掉，自己调过的不动
if (S.v < 4) {
    if (Object.entries(PRESETS.depth[1]).every(([k, v]) => S[k] === v)) Object.assign(S, PRESETS.natural[1]);
    S.v = 4;
    ctx.saveSettingsDebounced();
}
// v5：自然弧度改成放大镜截面（用户：边缘不扭曲，只放大）。还停在 v4 自然弧度数值上的整组换掉
if (S.v < 5) {
    if (S.profile === 'squircle' && Object.entries(NATURAL_V4).every(([k, v]) => S[k] === v)) Object.assign(S, PRESETS.natural[1]);
    S.v = 5;
    ctx.saveSettingsDebounced();
}
// v7：v6 把消息卡片模糊调到 6，用户反馈看不出液态玻璃了（模糊太重，边缘弧度里没有清楚的内容可折射），改回 3
if (S.v < 7) {
    if (S.mesBlur === 6) S.mesBlur = DEFAULTS.mesBlur;
    S.v = 7;
    ctx.saveSettingsDebounced();
}
// v9（v8 在开发中途存过一次，所以用新号）：明暗默认改成“按时间”（白天瓷白、晚上墨黑，和首页问候一致）。
// 旧版的太阳 / 月亮键每点一次都会把设置写成浅 / 深，存着的浅 / 深多半是点键留下的，不是专门选的，所以一起换过去；想固定的话设置里还能选“一直浅色 / 深色”
if (S.v < 9) {
    S.tone = 'time';
    S.v = 9;
    ctx.saveSettingsDebounced();
}

const opticsMigration = migrateClearOptics(S, PRESETS_PREVIOUS, PRESETS);
S.mobileTilt = S.mobileTilt === true;
S.webPreset = normalizeWebPreset(S.webPreset);
const materialMigration = restoreOriginalRefraction(S, CLEAR_OPTICS_PREVIOUS, PRESETS_PREVIOUS);
if (opticsMigration.changed || materialMigration.changed) ctx.saveSettingsDebounced();

const ua = navigator.userAgent;
const isIOS = window.__TAURITAVERN_HOST__?.platform === 'ios'
    || /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const supportsFilter = value => { try { return CSS.supports('backdrop-filter', value); } catch { return false; } };
const canFull = !isIOS && !!window.chrome && !/Firefox\//.test(ua) && supportsFilter('blur(1px)');
const androidHost = !isIOS && /Android/i.test(ua);
const fontActivity = { loadingCycles: 0, loadedFaces: 0, failedFaces: 0 };
for (const type of ['loading', 'loadingdone', 'loadingerror']) document.fonts?.addEventListener(type, event => {
    if (type === 'loading') fontActivity.loadingCycles++;
    else if (type === 'loadingdone') fontActivity.loadedFaces += event.fontfaces?.length || 0;
    else fontActivity.failedFaces += event.fontfaces?.length || 0;
});
const androidWebView = androidHost && /\bwv\b/.test(ua) && /Chrome\//.test(ua) && !/Firefox\//.test(ua);
const androidWebViewEligible = androidWebView && supportsFilter('blur(1px)') && supportsFilter('url(#ilg-capability-probe)');
const supportsPrefixedFilter = value => { try { return CSS.supports('-webkit-backdrop-filter', value); } catch { return false; } };
const iosBlurEligible = isIOS && (supportsFilter('blur(1px)') || supportsPrefixedFilter('blur(1px)'));
const iosSvgEligible = iosBlurEligible
    && (supportsFilter('url(#ilg-capability-probe)') || supportsPrefixedFilter('url(#ilg-capability-probe)'));
function iosTrialRequested() { return iosSvgEligible && S.iosSvgTrial === true; }
// Auto selects a capability path; CSS syntax acceptance is not a rendering result.
function cssGlassActive() { return S.enabled && S.compatibilityMode === 'blur'; }
function canRefract() {
    if (S.compatibilityMode === 'blur') return false;
    return canFull || androidWebViewEligible || iosTrialRequested();
}
// This material uses CSS blur and light, never background pixel displacement.
function iosMaterialActive() {
    return S.enabled && !cssGlassActive() && iosBlurEligible && S.iosMaterial === true
        && !document.body.classList.contains('no-blur') && (!(S.refract && canRefract()) || S.glassStyle==='liquid-web');
}
function compatibilityHint() {
    return cssGlassActive()
        ? '澄卿以 CSS 轻模糊、细亮边与柔影呈现；映卿与漾卿的参数保留，切回随境即可恢复。'
        : '随境自动使用当前设备支持的玻璃效果；出现卡顿时，可切换轻量的澄卿。';
}

// 每类表面的模糊来源和折射强度倍率；bezelK / thickK 是新版引擎在全局弧面宽度、厚度上乘的倍数（大块玻璃更厚，小块更薄）
const KIND = {
    bar: { blur: () => S.barBlur, k: 1, bezelK: 1, thickK: 1 },
    mes: { blur: () => S.mesBlur, k: 0.8, bezelK: 1, thickK: 1 },
    // 面板加厚（panelRead）开着时模糊至少 10px：壁纸花的时候，面板里的字不至于和背景搅在一起
    panel: { blur: () => S.panelRead ? Math.max(S.panelBlur, 10) : S.panelBlur, k: 0.7, bezelK: 1.1, thickK: 1.5 },
    // 用户明确指定的 NVWA 预设 / 记忆面板使用清透材质；其他第三方内容不接管。
    clearPanel: { blur: () => S.barBlur + 1, k: 0.9, bezelK: 1.1, thickK: 1.5 },
    // 右上角提示：文字压在玻璃上，比顶栏多一点模糊保证可读
    toast: { blur: () => Math.max(S.barBlur, 10), k: 0.6, bezelK: 0.75, thickK: 0.8 },
};
// 输入区的玻璃画在 #nonQRFormItems（只有输入框那一行）上，快捷回复按钮单独浮在胶囊上方
const PILL_SEL = '#nonQRFormItems';
const BAR_SEL = `#top-bar, ${PILL_SEL}`;
// 只处理酒馆 Popup 注册表里的标准外壳；不扫描、标记或改造第三方浮窗。
const NATIVE_POPUP_SEL = 'dialog.popup[data-id]:not(.transparent_dialogue_popup)';
const HOST_MENU_SEL = '#options .options-content, #extensionsMenu';
const composerGlassSurface = el => el.matches(HOST_MENU_SEL)
    || (S.qrFold && el.matches('#form_sheld #qr--bar') && !el.closest('[data-nvwa-style="author"], #catgod-oracle-qrbar'));
const PANEL_SEL = '#top-settings-holder > .drawer > .drawer-content, #character_popup, #world_popup, #options .options-content, #extensionsMenu, ' + NATIVE_POPUP_SEL;
const HOST_UI_SEL = '#top-settings-holder, #sheld, #options, #extensionsMenu, #ilg-fold-menu';
// 世界书编辑器在抽屉里时，不再叠第二层玻璃。
const inDrawer = el => !!el.closest('.drawer-content');
function isNativePopup(el) {
    return el.matches(NATIVE_POPUP_SEL)
        && !!ctx.Popup?.util?.popups?.some(popup => popup.dlg === el);
}
// 仅对原生 Popup 内固定内容根做定点适配，不通过标题、类名或相似结构猜测所有权。
const ADAPTED_PANEL_SEL = ':scope > .popup-body > .popup-content > :is(#nvwa-panel, #nvwa-memory)';
function popupOwnsStyle(el) {
    if (adaptedPanel(el)) return false;
    const content = el.querySelector?.(':scope > .popup-body > .popup-content');
    return !!content?.matches?.('[data-nvwa-style="author"]') || !!content?.querySelector?.('style, link[rel~="stylesheet"], iframe, [data-v-app], [data-reactroot], [data-nvwa-style="author"]');
}
function adaptedPanel(el) {
    return isNativePopup(el) ? el.querySelector(ADAPTED_PANEL_SEL) : null;
}
function trackable(el) {
    const popup = el.closest('dialog, .popup, [role="dialog"]:not(.ilg-recent)');
    return (!popup || isNativePopup(popup) && !popupOwnsStyle(popup)) && !(el.id === 'world_popup' && inDrawer(el));
}
const MES_SEL = '.mes:not(.smallSysMes)';

const root = document.documentElement;
const composerTools = createComposerTools({root});
const lightScope = createLightScope(root);
const webGlass = createLiquidGlassWeb();
const reflections = createGlassReflections();
const lighting = createGlassLighting({
    onPoint(point) {
        lightScope.update(point);
    },
    onStatus(text) { const status = document.getElementById('ilg-tilt-state'); if (status) status.textContent = text; },
});
function syncMobileTilt() { lighting.sync(S.enabled, S.mobileTilt); }
function requestMobileTilt() {
    S.mobileTilt = true;
    const checkbox = document.getElementById('ilg-opt-mobileTilt'); if (checkbox) checkbox.checked = true;
    syncMobileTilt();
    lighting.requestTilt();
    ctx.saveSettingsDebounced();
}
const webStyleEnabled = () => S.enabled && !cssGlassActive() && S.glassStyle === 'liquid-web'
    && (supportsFilter('blur(1px)') || supportsPrefixedFilter('blur(1px)'))
    && (!isIOS || S.iosMaterial === true);
const svg = document.createElementNS(NS, 'svg');
svg.setAttribute('aria-hidden', 'true');
// Nonzero SVG resource bounds are an iOS compatibility experiment.
svg.style.cssText = isIOS
    ? 'position:absolute;left:-10000px;top:0;width:1px;height:1px;overflow:visible;pointer-events:none'
    : 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
svg.innerHTML = '<defs></defs>';
document.body.appendChild(svg);
const defs = svg.firstChild;

const iosWallpaper=createIOSWallpaperRefraction({background:()=>{
    for(const id of ['bg_custom','bg1']){const el=document.getElementById(id);if(el&&/^url\(/.test(getComputedStyle(el).backgroundImage))return el;}
    return null;
},onReady:()=>requestAnimationFrame(()=>{repaintVisible('wallpaper');const status=document.getElementById('ilg-status');if(status)status.textContent=statusText();})});
const iosWallpaperRequested=()=>isIOS&&S.refract&&S.compatibilityMode!=='blur'&&webStyleEnabled()&&!document.body.classList.contains('no-blur');
const items = new Map();
// Host UI state changes only need surfaces near the viewport; other messages update on intersection.
const visibleItems = new Set();
const cache = new Map();
let uid = 0;
function radiusOf(el, w, h) {
    const r = getComputedStyle(el).borderTopLeftRadius || '0';
    let v = parseFloat(r) || 0;
    if (r.includes('%')) v = v / 100 * Math.min(w, h);
    return Math.min(v, w / 2, h / 2);
}

// 位移贴图：中心灰色=不动；越靠近圆角矩形边缘越向内取样（R=水平，G=垂直）
function makeMap(w, h, r, bevel) {
    const key = [w, h, Math.round(r), bevel, S.curve].join('|');
    if (cache.has(key)) { const value = cache.get(key); cache.delete(key); cache.set(key, value); return value; }
    const area = w * h;
    const k = area > 400000 ? 0.33 : area > 120000 ? 0.5 : 1;
    const cw = Math.max(2, Math.round(w * k)), ch = Math.max(2, Math.round(h * k));
    const R = r * k, B = Math.max(1, Math.min(bevel * k, Math.min(cw, ch) / 2));
    const hw = cw / 2, hh = ch / 2, Rn = Math.max(R, B), curve = S.curve;
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const c2 = cv.getContext('2d');
    const img = c2.createImageData(cw, ch), d = img.data;
    for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
            const px = x + 0.5 - hw, py = y + 0.5 - hh;
            const ax = Math.abs(px), ay = Math.abs(py);
            const qx = ax - hw + R, qy = ay - hh + R;
            const depth = -(Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - R);
            const i = (y * cw + x) * 4;
            let dx = 0, dy = 0;
            if (depth > 0 && depth < B) {
                let nx, ny;
                const cx = ax - (hw - Rn), cy = ay - (hh - Rn);
                if (cx > 0 && cy > 0) { const L = Math.hypot(cx, cy) || 1; nx = cx / L; ny = cy / L; }
                else if (cx > cy) { nx = 1; ny = 0; } else { nx = 0; ny = 1; }
                if (px < 0) nx = -nx;
                if (py < 0) ny = -ny;
                const m = Math.pow(1 - depth / B, curve);
                dx = -nx * m; dy = -ny * m;
            }
            d[i] = 128 + dx * 127; d[i + 1] = 128 + dy * 127; d[i + 2] = 128; d[i + 3] = 255;
        }
    }
    c2.putImageData(img, 0, 0);
    const url = cv.toDataURL('image/png');
    if (cache.size >= 120) cache.delete(cache.keys().next().value);
    cache.set(key, url);
    return url;
}

const disp = (scale, res) => `<feDisplacementMap in="SourceGraphic" in2="map" scale="${scale.toFixed(1)}" xChannelSelector="R" yChannelSelector="G"${res ? ` result="${res}"` : ''}/>`;

function filterOf(it, w, h, slot = 'filter') {
    const f = it[slot] || (it[slot] = defs.appendChild(document.createElementNS(NS, 'filter')));
    f.setAttribute('id', slot === 'webFilter' ? it.id + '-web' : it.id);
    f.setAttribute('filterUnits', 'userSpaceOnUse');
    f.setAttribute('primitiveUnits', 'userSpaceOnUse');
    f.setAttribute('color-interpolation-filters', 'sRGB');
    f.setAttribute('x', '0'); f.setAttribute('y', '0');
    // Only streaming messages need growth headroom. A 54px input must not
    // allocate a 254px SVG surface over the scrolling chat behind it.
    f.setAttribute('width', w); f.setAttribute('height', h + (it.kind === 'mes' ? 200 : 0));
    return f;
}

// 滤镜只负责折射；两种材质的表面反光统一在 CSS / 融合距离场中绘制，避免重复叠亮。
const ARC_ONLY = Object.freeze({ specular: 0, sharp: 4, edgeShade: 0, fresnel: 0, caustic: 0 });
// 统一玻璃表面；折叠顶栏与空输入区保持高透，仅有内容的输入区启用可读层。
const inputGlass = el => el.matches('#nonQRFormItems, #ilg-composer-input-glass');
const controlSurface = el => el.matches('.ilg-island, #nonQRFormItems, #ilg-floor, .ilg-composer-glass');
let inputMaterialReadable = false, inputCompositionText = '';
const foldedMenuSurface = el => S.fold && el.classList.contains('ilg-island') && el.icons?.some(icon => icon.id === 'ilg-fold-button');
const controlReadable = el => controlSurface(el) && (inputGlass(el) ? inputMaterialReadable : el.id === 'ilg-composer-plus-glass' ? false : S.islands && S.dock);
function syncInputMaterial(repaint = true) {
    const value = document.getElementById('send_textarea')?.value || '';
    const next = value.trim().length > 0 || inputCompositionText.trim().length > 0;
    const shown = S.enabled && next;
    if (root.classList.contains('ilg-has-draft') !== shown) root.classList.toggle('ilg-has-draft', shown);
    if (next === inputMaterialReadable) return;
    inputMaterialReadable = next;
    const bar = document.getElementById(S.composerLayout === 'split' ? 'ilg-composer-input-glass' : 'nonQRFormItems');
    if (repaint && S.enabled && bar && items.has(bar)) paint(bar);
}
// 发送清空、恢复草稿与粘贴都走同一个 input 入口；只在空 / 有文字切换时重建材质。
document.addEventListener('input', e => {
    if (e.target.id !== 'send_textarea') return;
    if (!e.isComposing) inputCompositionText = '';
    syncInputMaterial();
    scheduleAdapt();
}, true);
for (const type of ['compositionstart', 'compositionupdate', 'compositionend']) document.addEventListener(type, e => {
    if (e.target.id !== 'send_textarea') return;
    inputCompositionText = type === 'compositionupdate' ? e.data || '' : '';
    syncInputMaterial();
}, true);
document.addEventListener('focusin', e => { if (e.target.id === 'send_textarea') syncInputMaterial(); });
function surfaceBlur(it, el) {
    if (el.matches(HOST_MENU_SEL)) return 10;
    if (composerGlassSurface(el)) return 6;
    if (it.kind === 'mes' && S.chatBackground === 'transparent') return 0;
    const blur = KIND[it.kind].blur();
    // Native input menus sit over message text; keep that text from competing with their labels.
    if (it.kind === 'panel' && el.matches(HOST_MENU_SEL)) return Math.max(10, blur);
    return controlReadable(el) ? Math.max(1.1, blur) : blur;
}
// 新版：模糊、调色、折射全在一个 SVG 滤镜里，所以 backdrop-filter 只写 url()
function buildPhysical(it, el, w, h, r) {
    const kind = KIND[it.kind], control = controlReadable(el);
    const baseBezel = Math.max(2, S.pBezel * kind.bezelK);
    const bezel = control ? Math.max(2, Math.min(baseBezel, Math.min(w, h) * .2)) : baseBezel;
    const o = {
        profile: S.profile, ior: S.pIor, magnify: foldedMenuSurface(el) ? 1 + (S.pMagnify - 1) * .45 : control ? 1 + (S.pMagnify - 1) * .6 : S.pMagnify, bezel,
        thickness: S.pThickness * kind.thickK * (control ? bezel / baseBezel : 1),
        controlCore: control, controlRadius: r, controlBlur: inputGlass(el) ? 3 : 5.5,
        // 中心遮罩随尺寸变化，不能只复用九宫格边缘的尺寸更新。
        controlGeometry: control ? [w, h, r].join(':') : '',
        strength: S.pStrength * kind.k * (foldedMenuSurface(el) ? .82 : 1), aberration: S.pAberration, blur: surfaceBlur(it, el),
        saturate: S.pSaturate, brightness: S.pBrightness, contrast: S.pContrast,
        // 只留弧度：滤镜里不画高光、边缘反光、厚度阴影和聚光。法线贴图和光照节点因此不再生成，GPU 也少算几层。
        ...ARC_ONLY,
    };
    // Compact clear lens for composer sheets, using the existing physical map cache.
    if (it.kind === 'panel' && composerGlassSurface(el)) Object.assign(o, {
        profile: 'lens', ior: 1.45, magnify: 1.35, bezel: Math.min(14, r * .65),
        thickness: 28, strength: .9, aberration: .15, blur: 6,
        saturate: 1.15, brightness: 1.02, contrast: 1,
    });
    const maps = getMaps(w, h, r, o), key = JSON.stringify(o);
    const previous = it.physical;
    // Nine-slice maps already share their pixels. Keep the filter nodes too when only its bounds change.
    if (previous?.maps === maps && previous.key === key && it.filter) {
        if (previous.w !== w || previous.h !== h) {
            filterOf(it, w, h);
            resizePhysicalFilter(it.filter, maps, w, h);
            previous.w = w; previous.h = h;
        }
    } else {
        const f = filterOf(it, w, h);
        f.innerHTML = physicalFilter(maps, o, w, h, S.pLight);
        it.physical = { maps, key, w, h };
    }
}

function buildFilter(it, w, h, r, el) {
    it.physical = null;
    const sc = S.scale * KIND[it.kind].k * (el && foldedMenuSurface(el) ? .82 : 1), a = S.aberration * KIND[it.kind].k;
    const f = filterOf(it, w, h);
    let html = `<feFlood flood-color="rgb(128,128,128)" result="neutral"/>` +
        `<feImage href="${makeMap(w, h, r, S.bevel * (it.kind === 'bar' ? 1.3 : 1))}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="img"/>` +
        `<feComposite in="img" in2="neutral" operator="over" result="map"/>`;
    if (a > 0.5) {
        html += disp(sc + a, 'dr') + disp(sc, 'dg') + disp(Math.max(0, sc - a), 'db') +
            '<feColorMatrix in="dr" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/>' +
            '<feColorMatrix in="dg" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g"/>' +
            '<feColorMatrix in="db" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b"/>' +
            '<feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen"/>';
    } else {
        html += disp(sc);
    }
    f.innerHTML = html;
}

function refractAllowed(it) {
    if (!S.enabled || !S.refract || !canRefract() || document.body.classList.contains('no-blur')) return false;
    if(isIOS&&iosWallpaperRequested())return false;
    if (it.kind === 'mes') return S.refractMes && it.visible;
    return true;
}

// Cards keep their fixed-position descendants outside the filter's containing block.
// The independent layer uses the same filter builder as ordinary message and input glass.
function messageSurface(el, it) {
    // Prepare the owned wrapper before folding. CSS switches at the width breakpoint,
    // so an expanded frame does not wait for a resize callback to bound its backdrop.
    const viewportReady = androidHost && it.largeWebView && CSS.supports('overflow', 'clip');
    // The wide Android split needs the preset marker on its very first paint,
    // not after the debounced color pass changes the message's stacking context.
    if (viewportReady && !it.widePresetPrepared && innerWidth >= 600) {
        it.widePresetPrepared = true;
        const text = el.querySelector('.mes_text');
        if (!el.classList.contains('ilg-card-renderer') && text?.querySelector(CARD_RENDERER_CANDIDATES)) applyCardMarkers([text]);
    }
    const separate = viewportReady || el.classList.contains('ilg-content-overlay') || el.classList.contains('ilg-card-renderer');
    el.classList.toggle('ilg-message-backdrop', separate);
    el.classList.toggle('ilg-message-viewport', viewportReady);
    if (!separate) {
        it.backdrop?.remove(); it.backdropClip?.remove();
        it.backdrop = it.backdropClip = null;
        return el;
    }
    if (!it.backdrop) {
        it.backdrop = document.createElement('div');
        it.backdrop.className = 'ilg-message-glass';
        it.backdrop.setAttribute('aria-hidden', 'true');
    }
    if (viewportReady && !it.backdropClip) {
        it.backdropClip = document.createElement('div');
        it.backdropClip.className = 'ilg-message-clip';
        it.backdropClip.setAttribute('aria-hidden', 'true');
        el.prepend(it.backdropClip);
    }
    const parent = viewportReady ? it.backdropClip : el;
    if (it.backdrop.parentElement !== parent) parent.prepend(it.backdrop);
    if (!viewportReady && it.backdropClip) { it.backdropClip.remove(); it.backdropClip = null; }
    el.style.backdropFilter = 'none';
    el.style.webkitBackdropFilter = 'none';
    return it.backdrop;
}

// 先量后写：一批表面一起量完尺寸和圆角再统一写样式。边量边写时，每量一个都要让浏览器把整页样式重算一遍（长聊天滚动卡顿的主因）。
function measure(el) {
    const w = el.offsetWidth, h = el.offsetHeight;
    return { w, h, r: w && h ? radiusOf(el, w, h) : 0 };
}
function paintMany(list, reason, measured = null) {
    const jobs = [];
    for (const el of list) {
        const it = items.get(el);
        if (!it) continue;
        if (!el.isConnected || !trackable(el)) { untrack(el); continue; }
        if (it.kind === 'panel' || it.kind === 'clearPanel') {
            const panel = adaptedPanel(el);
            it.kind = panel ? 'clearPanel' : 'panel';
            el.classList.toggle('ilg-adapted', !!panel);
        }
        jobs.push(el);
    }
    if (flickerCapture) flickerCapture.messagePaints(reason, jobs.filter(el => items.get(el).kind === 'mes').length);
    const geo = jobs.map(el => measured?.get(el) || measure(el));
    jobs.forEach((el, i) => paint(el, geo[i]));
}
function paint(el, geo) {
    const it = items.get(el);
    if (!it) return;
    if (it.kind === 'panel' && el.matches(HOST_MENU_SEL)) mountTrayHeading(el);
    if (!geo) {
        if (!el.isConnected) { untrack(el); return; }
        if (!trackable(el)) { untrack(el); return; }
        if (it.kind === 'panel' || it.kind === 'clearPanel') {
            const panel = adaptedPanel(el);
            it.kind = panel ? 'clearPanel' : 'panel';
            el.classList.toggle('ilg-adapted', !!panel);
        }
        geo = measure(el);
    }
    if (it.kind !== 'mes') {
        it.visible = !!geo.w && !!geo.h;
        lightScope.visibility(el, it.visible);
        if (it.visible) visibleItems.add(el);
        else {
            visibleItems.delete(el); iosWallpaper.release(el);
            if (it.kind === 'panel' || it.kind === 'clearPanel') {
                reflections.release(el); webGlass.release(el);
                it.filter?.remove(); it.filter = null; it.physical = null;
                el.style.backdropFilter = ''; el.style.webkitBackdropFilter = '';
                setPhys(el, it, false); it.renderPath = 'hidden';
            }
            return;
        }
    }
    it.largeWebView = largeWebViewMessage({webView:androidHost,kind:it.kind,width:geo.w,height:geo.h,dpr:devicePixelRatio,previous:it.largeWebView});
    const surface = it.kind === 'mes' ? messageSurface(el, it) : el;
    // Keep only the empty composer glass planes on stable compositor layers.
    // Never transform the message/form ancestors of authored fixed-position UI.
    el.classList.toggle('ilg-stable-composer', androidHost && el.classList.contains('ilg-composer-glass'));
    const control = it.kind === 'bar' && controlSurface(el);
    el.classList.toggle('ilg-control-surface', control);
    el.classList.toggle('ilg-control-readable', control && controlReadable(el));
    it.renderPath = 'pending'; it.fallbackReason = '';
    const composer = it.kind === 'panel' && composerGlassSurface(el);
    el.classList.toggle('ilg-composer-liquid', composer);
    const cssMode = cssGlassActive();
    el.classList.toggle('ilg-css-surface', cssMode);
    // Scrollable Android panels share the compositor with chat; avoid retaining an SVG backdrop across popup transitions.
    const stablePanel = androidHost && (it.kind === 'panel' || it.kind === 'clearPanel');
    const useWeb = !stablePanel && (it.kind === 'bar' || composer) && webStyleEnabled();
    if (!useWeb) webGlass.release(el);
    if (!useWeb||!iosWallpaperRequested()) iosWallpaper.release(el);
    if (document.body.classList.contains('no-blur')) {
        it.renderPath = 'no-blur';
        reflections.release(el);
        setPhys(el, it, false);
        surface.style.backdropFilter = 'none';
        surface.style.webkitBackdropFilter = 'none';
        return;
    }
    const blur = surfaceBlur(it, el);
    const reading = it.kind === 'mes' ? ' var(--ilg-reading-filter, blur(0px))' : '';
    const tail = `blur(${blur}px) saturate(${S.saturate}) brightness(${S.brightness})` + reading;
    const { w, h, r } = geo;
    // A closed drawer has no pixels to update; retain its last valid filter for reopening.
    if (!w || !h) return;
    if (cssMode) {
        it.renderPath = 'css';
        // CSS material owns its rim; skip displacement maps and canvas reflections.
        setPhys(el, it, false);
        let lightBlur;
        if (it.kind === 'mes') lightBlur = S.chatBackground === 'transparent' ? 0 : Math.max(1.5, Math.min(6, blur));
        else if (control) lightBlur = controlReadable(el) ? (inputGlass(el) ? 3.5 : 4) : Math.max(.75, Math.min(1.5, blur));
        else lightBlur = Math.max(1, Math.min(it.kind === 'panel' || it.kind === 'toast' ? 8 : 3, blur));
        const filter = (lightBlur ? `blur(${lightBlur}px) saturate(${Math.max(1, Math.min(1.35, S.saturate))})` : reading ? 'blur(0px)' : 'none') + reading;
        surface.style.backdropFilter = filter;
        surface.style.webkitBackdropFilter = filter;
        return;
    }
    // Apply the large-surface budget before allocating either reflections or SVG maps.
    const guarded = it.largeWebView || stablePanel;
    // Offscreen and guarded Android messages retain their CSS material.
    const stableMessage = it.kind === 'mes' && !androidHost && !isIOS && canRefract() && S.engine === 'physical';
    if (stableMessage) reflections.paintMessage(el, w, h, r, it.visible);
    else if (composer || guarded || (it.kind === 'mes' && !it.visible)) reflections.release(el);
    else reflections.paint(el, w, h, r);
    if (useWeb) {
        it.renderPath = 'web-compatible';
        setPhys(el, it, false);
        webGlass.paint(el, it, { width: w, height: h,
            refract: S.refract && (canRefract() || iosWallpaperRequested()),
            sourcePlane: iosWallpaperRequested()?value=>iosWallpaper.paint(el,value):null,
            filter: () => filterOf(it, w, h, 'webFilter'), radius: r, preset: S.webPreset, refractionScale: foldedMenuSurface(el) ? .82 : 1, controlCore: control && controlReadable(el), controlBlur: inputGlass(el) ? 3 : 5.5,
            // 输入胶囊上下两条边的折射圈加厚一点（用户 2026-11-05 要求），岛保持上游原样
            bendY: inputGlass(el) ? 1.5 : 1 });
        if(iosWallpaperRequested()&&el.querySelector(':scope > .ilg-ios-wallpaper-plane'))it.renderPath='web-wallpaper';
        return;
    }
    const phys = refractAllowed(it) && S.engine === 'physical' && !guarded;
    if (guarded && refractAllowed(it)) {
        it.fallbackReason = stablePanel ? 'webview-panel' : 'large-android-message';
        // Legacy displacement still allocates a full-size filtered surface. Release it as well.
        it.filter?.remove(); it.filter = null; it.physical = null;
    }
    setPhys(el, it, phys);
    if (stableMessage) {
        // Blink can invalidate the whole chat for a descendant's style attribute
        // change (host :has() rules). Bind both filters once; only the material
        // class changes when a message crosses the existing visibility band.
        const near = `url(#${it.id})` + reading;
        if (el.style.getPropertyValue('--ilg-message-near-filter') !== near) el.style.setProperty('--ilg-message-near-filter', near);
        if (el.style.getPropertyValue('--ilg-message-away-filter') !== tail) el.style.setProperty('--ilg-message-away-filter', tail);
        if (phys) buildPhysical(it, el, w, h, r);
        const filter = 'var(--ilg-message-active-filter)';
        if (surface.style.backdropFilter !== filter) surface.style.backdropFilter = filter;
        it.renderPath = phys ? 'physical' : 'blur';
        return;
    }
    if (canRefract() && !isIOS) surface.style.webkitBackdropFilter = '';
    if (phys) {
        it.renderPath = 'physical';
        buildPhysical(it, el, w, h, r);
        surface.style.backdropFilter = `url(#${it.id})` + reading;
        if (isIOS) surface.style.webkitBackdropFilter = `url(#${it.id})` + reading;
    } else if (!guarded && refractAllowed(it)) {
        it.renderPath = 'legacy';
        buildFilter(it, w, h, r, el);
        surface.style.backdropFilter = `url(#${it.id}) ${tail}`;
        if (isIOS) surface.style.webkitBackdropFilter = `url(#${it.id}) ${tail}`;
    } else {
        it.renderPath = iosMaterialActive() ? 'ios-compatible' : 'blur';
        const fallback = control && controlReadable(el) ? `blur(${Math.max(3.5, blur)}px) saturate(${S.saturate}) brightness(${S.brightness})` : tail;
        surface.style.backdropFilter = fallback;
        if (isIOS || !canRefract()) surface.style.webkitBackdropFilter = fallback;
    }
}
// .ilg-phys：CSS 那套亮边/内阴影要让开（见 style.css 的新版引擎部分）
function setPhys(el, it, on) {
    el.classList.toggle('ilg-phys', on);
}

// 光源保持稳定，不跟随鼠标 / 手机姿态；只在按压时亮起局部反光，
// 而每次移动鼠标都要给全部可见玻璃量一遍位置、写一遍样式，电脑上一帧要几百毫秒。
// 尺寸变化在绘制前同步重建滤镜，避免一帧错位。
// 例外：流式输出时最后一条消息每吐一个字就长高一点，每次都重建它的折射贴图是手机上最重的一块
// （4 倍降速模拟里每次 8ms 以上，还逼着整页重算布局）。生成期间消息玻璃最多 250ms 重建一次，生成结束补一次。
const MES_STREAM_GAP = 250;
const mesLate = new Set();
let mesLateTimer = 0;
const flushMesLate = () => { mesLateTimer = 0; const list = [...mesLate]; mesLate.clear(); if (list.length) paintMany(list, 'stream'); };
const ro = new ResizeObserver(entries => {
    const now = [], measured = new Map();
    const streaming = document.body.dataset.generating === 'true';
    // Read before messageRendering changes containment. ResizeObserver already
    // supplies border dimensions, so reading offsetWidth again would force layout.
    for (const e of entries) {
        if (streaming && items.get(e.target)?.kind === 'mes') continue;
        const box = e.borderBoxSize?.length === 1 ? e.borderBoxSize[0] : null;
        if (box && getComputedStyle(e.target).writingMode === 'horizontal-tb') {
            const w = Math.round(box.inlineSize), h = Math.round(box.blockSize);
            measured.set(e.target, { w, h, r: w && h ? radiusOf(e.target, w, h) : 0 });
        } else measured.set(e.target, measure(e.target));
    }
    for (const e of entries) {
        messageRendering.resize(e.target, e.contentRect.height, e.contentRect.width);
        if (streaming && items.get(e.target)?.kind === 'mes') { mesLate.add(e.target); continue; }
        now.push(e.target);
    }
    if (now.length) paintMany(now, 'resize', measured);
    flickerCapture?.geometry(measured);
    if (mesLate.size && !mesLateTimer) mesLateTimer = setTimeout(flushMesLate, MES_STREAM_GAP);
});
new MutationObserver(() => { if (document.body.dataset.generating !== 'true' && mesLate.size) { clearTimeout(mesLateTimer); flushMesLate(); } })
    .observe(document.body, { attributes: true, attributeFilter: ['data-generating'] });
const io = new IntersectionObserver(entries => {
    const changed = [];
    for (const e of entries) {
        const it = items.get(e.target);
        messageRendering.visibility(e.target, e.isIntersecting);
        if (!it || it.visible === e.isIntersecting) continue;
        it.visible = e.isIntersecting;
        if (it.visible) visibleItems.add(e.target);
        else visibleItems.delete(e.target);
        changed.push(e.target);
    }
    if (changed.length) paintMany(changed, 'intersection');
    flickerCapture?.intersections(entries);
}, { root: document.getElementById('chat'), rootMargin: '200px 0px' });

// Match the same prewarm margin as the message IntersectionObserver.
function nearMessageViewport(rect, viewport) {
    return rect.width > 0 && rect.height > 0 && viewport.width > 0 && viewport.height > 0
        && rect.bottom > viewport.top - 200 && rect.top < viewport.bottom + 200
        && rect.right > viewport.left && rect.left < viewport.right;
}
function registerSurface(el, kind, visible) {
    const it = { id: `ilg-f${++uid}`, kind, visible };
    items.set(el, it);
    if (visible) visibleItems.add(el);
    el.classList.add('ilg-glass');
    // 表面光泽只给不会内部滚动的表面，抽屉这类会滚的容器里光泽会跟着内容跑
    if (kind === 'bar' || kind === 'mes' || kind === 'toast') el.classList.add('ilg-sheen');
    return it;
}
function positionSurface(el, it) {
    el.style.position = 'relative';
    it.posFixed = true;
}
function observeSurface(el, it) {
    if (isNativePopup(el)) {
        const content = el.querySelector(':scope > .popup-body > .popup-content');
        if (content) {
            it.contentObserver = new MutationObserver(() => {
                if (popupOwnsStyle(el)) { untrack(el); return; }
                if (el.classList.contains('ilg-adapted') !== !!adaptedPanel(el)) paint(el);
            });
            it.contentObserver.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-nvwa-style'] });
        }
    }
    ro.observe(el);
    if (it.kind === 'mes') {
        messageRendering.track(el); io.observe(el);
        flickerCapture?.messagePaints('mount', 1);
    }
}
function track(el, kind) {
    if (items.has(el) || !trackable(el)) return;
    const viewport = kind === 'mes' ? document.getElementById('chat')?.getBoundingClientRect() : null;
    const visible = kind !== 'mes' || !!viewport && nearMessageViewport(el.getBoundingClientRect(), viewport);
    const it = registerSurface(el, kind, visible);
    if (getComputedStyle(el).position === 'static') positionSurface(el, it);
    observeSurface(el, it);
    paint(el);
}
function trackMessages(elements) {
    // Chat history can arrive in one DOM mutation. Install material classes and
    // positioning as groups, then measure and paint without a forced layout per row.
    const list = [...new Set(elements)].filter(el => !items.has(el) && trackable(el));
    if (list.length < 2) {
        if (list.length) track(list[0], 'mes');
        return;
    }
    const states = list.map(el => registerSurface(el, 'mes', false));
    const staticRows = list.map(el => getComputedStyle(el).position === 'static');
    list.forEach((el, i) => { if (staticRows[i]) positionSurface(el, states[i]); });
    const viewport = document.getElementById('chat').getBoundingClientRect();
    const geometries = list.map((el, i) => {
        const it = states[i];
        it.visible = nearMessageViewport(el.getBoundingClientRect(), viewport);
        if (it.visible) visibleItems.add(el);
        return measure(el);
    });
    list.forEach((el, i) => {
        observeSurface(el, states[i]);
        paint(el, geometries[i]);
    });
}

function untrack(el) {
    composerTools.release(el);
    releaseTrayHeading(el);
    lightScope.release(el);
    messageRendering.release(el);
    reflections.release(el);
    webGlass.release(el);
    iosWallpaper.release(el);
    const it = items.get(el);
    if (!it) return;
    it.contentObserver?.disconnect();
    it.filter?.remove();
    it.backdrop?.remove();
    it.backdropClip?.remove();
    ro.unobserve(el);
    io.unobserve(el);
    el.classList.remove('ilg-glass', 'ilg-sheen', 'ilg-clear', 'ilg-phys', 'ilg-adapted', 'ilg-message-backdrop', 'ilg-message-viewport', 'ilg-bounded-hit', 'ilg-control-surface', 'ilg-control-readable', 'ilg-css-surface', 'ilg-composer-liquid', 'ilg-stable-composer');
    if (el.id === 'nonQRFormItems') el.querySelectorAll('[data-ilg-input-tone]').forEach(action => delete action.dataset.ilgInputTone);
    el.style.backdropFilter = '';
    el.style.webkitBackdropFilter = '';
    if (it.kind === 'mes') {
        el.style.removeProperty('--ilg-message-near-filter');
        el.style.removeProperty('--ilg-message-away-filter');
    }
    if (it.posFixed) el.style.position = '';
    visibleItems.delete(el);
    items.delete(el);
}

function scan() {
    if (!S.enabled) return;
    const inputSurfaces = S.composerLayout === 'split' ? '#nonQRFormItems > .ilg-composer-glass' : PILL_SEL;
    document.querySelectorAll(S.islands ? inputSurfaces : '#top-bar, ' + inputSurfaces).forEach(el => track(el, 'bar'));
    document.querySelectorAll(PANEL_SEL).forEach(el => track(el, 'panel'));
    const bubble = document.body.classList.contains('bubblechat');
    const messages = document.querySelectorAll(`#chat ${MES_SEL}`);
    if (bubble) trackMessages(messages);
    else messages.forEach(untrack);
}

// 悬浮小球的融合玻璃不走 items，由它自己的钩子重画（小球那段代码在后面，这里只留个空位）
let ballRefresh = null;
function repaintAll() { paintMany([...items.keys()], 'global'); ballRefresh?.(); }
function repaintVisible(reason) { paintMany([...visibleItems], reason); ballRefresh?.(); }
function clearAll() { [...items.keys()].forEach(untrack); cache.clear(); clearMaps(); }

// 顶栏分组悬浮岛：图标按功能分三组，每组后面画一块独立的玻璃。图标和抽屉面板都不动，抽屉是按整个图标区定位的
const holder = document.getElementById('top-settings-holder');
const GROUP_START = ['user-settings-button', 'persona-management-button'];
const islands = [];
let islandLayoutFrame = 0;
const islandRO = new ResizeObserver(scheduleIslandLayout);
function scheduleIslandLayout() {
    if (!S.enabled || !S.islands || islandLayoutFrame) return;
    islandLayoutFrame = requestAnimationFrame(() => {
        islandLayoutFrame = 0;
        layoutIslands();
    });
}
function cancelIslandLayout() {
    if (!islandLayoutFrame) return;
    cancelAnimationFrame(islandLayoutFrame);
    islandLayoutFrame = 0;
}
function iconGroups() {
    // 全部铺开：所有图标一座岛
    if (dockOn()) return [[...holder.children]];
    if (S.fold) {
        const shortcuts = [S.topShortcut1, S.topShortcut2].map(id => [...holder.children].find(d => d.id === id && d.classList.contains('ilg-fold-shortcut'))).filter(Boolean);
        return [[foldBtn, ...shortcuts], [...holder.children].filter(d => FOLD_KEEP.includes(d.id) && !d.classList.contains('ilg-folded'))].filter(g => g.length);
    }
    const groups = [[]];
    for (const d of holder.children) {
        // 折叠时：菜单键自己一座岛，剩下没收起来的图标一座岛
        const start = d.classList.contains('ilg-fold-keep') ? d.id === FOLD_KEEP[0] : GROUP_START.includes(d.id);
        if (start && groups[groups.length - 1].length) groups.push([]);
        groups[groups.length - 1].push(d);
    }
    return groups.filter(g => !S.fold || g.some(d => !d.classList.contains('ilg-folded')));
}
function layoutIslands() {
    // 视口回调已在帧内；设置变更仍即时落位，不再补跑排队的测量。
    cancelIslandLayout();
    if (!S.enabled || !S.islands) return;
    const bar = document.getElementById('top-bar');
    const groups = iconGroups();
    // 先更新分组留白，再一次读完各组边界，避免玻璃写入打断下一组测量。
    const dock = dockOn(), seps = dock ? dockSeparators() : [];
    const starts = new Set(groups.slice(1).map(g => g[0]));
    for (const d of holder.children) {
        d.classList.toggle('ilg-dock-sep', seps.includes(d));
        d.classList.toggle('ilg-group-start', starts.has(d));
        islandRO.observe(d);
    }
    const barLeft = bar.getBoundingClientRect().left;
    const borderLeft = bar.clientLeft;
    const bounds = groups.map(g => {
        const rects = g.map(d => d.getBoundingClientRect()).filter(r => r.width > 0);
        if (!rects.length) return null;
        const left = Math.min(...rects.map(r => r.left)) - 6;
        const right = Math.max(...rects.map(r => r.right)) + 6;
        return { left: `${left - barLeft - borderLeft}px`, width: `${right - left}px` };
    });
    groups.forEach((g, i) => {
        let isl = islands[i];
        if (!isl) {
            isl = islands[i] = document.createElement('div');
            isl.className = 'ilg-island';
            isl.style.position = 'absolute';
            bar.appendChild(isl);
        }
        isl.icons = g;
        const box = bounds[i];
        if (isl.hidden !== !box) isl.hidden = !box;
        if (!box) return;
        if (isl.style.left !== box.left) isl.style.left = box.left;
        if (isl.style.width !== box.width) isl.style.width = box.width;
    });
    bounds.forEach((box, i) => { if (box && !items.has(islands[i])) track(islands[i], 'bar'); });
    for (let i = groups.length; i < islands.length; i++) { untrack(islands[i]); islands[i].remove(); }
    islands.length = groups.length;
    if (dock) layoutDock(); else clearDock();
    scheduleAdapt();
}
function removeIslands() {
    cancelIslandLayout();
    islandRO.disconnect();
    clearDock();
    islands.forEach(isl => { untrack(isl); isl.remove(); });
    islands.length = 0;
    holder.querySelectorAll(':scope > .ilg-group-start, :scope > .ilg-icon-over-light')
        .forEach(d => d.classList.remove('ilg-group-start', 'ilg-icon-over-light'));
}

// ---------- 顶栏“全部铺开”：用留白分组，选中态留在当前按钮内 ----------
// 玻璃沿用一座悬浮岛；不移动原生抽屉、图标或事件绑定。
const dockOn = () => S.enabled && S.islands && S.dock;
const DOCK_GROUPS = [['ai-config-button', 'sys-settings-button', 'advanced-formatting-button'], ['WI-SP-button'],
    ['user-settings-button', 'backgrounds-button', 'extensions-settings-button'], ['ilg-tone-button', 'persona-management-button', 'rightNavHolder']];
const DOCK_LABELS = { 'ai-config-button': 'AI 回复设置', 'sys-settings-button': 'API 连接', 'advanced-formatting-button': '高级格式',
    'WI-SP-button': '世界书', 'user-settings-button': '用户设置', 'backgrounds-button': '背景', 'extensions-settings-button': '扩展',
    'persona-management-button': '用户人设', rightNavHolder: '角色卡', 'ilg-tone-button': '白天 / 黑夜' };
function dockSeparators() {
    const out = [];
    let last = -1;
    for (const d of holder.children) {
        if (!d.offsetWidth) continue;
        const group = DOCK_GROUPS.findIndex(g => g.includes(d.id));
        if (group < 0) continue;
        if (last >= 0 && group !== last) out.push(d);
        last = group;
    }
    return out;
}
const dockRO = new MutationObserver(syncDockSelection);
function layoutDock() {
    holder.style.setProperty('--ilg-dock-count', [...holder.children].filter(d => d.offsetWidth).length || 10);
    dockRO.disconnect();
    for (const d of holder.children) {
        const icon = d.querySelector('.drawer-icon');
        if (icon && DOCK_LABELS[d.id] && !icon.title) icon.title = DOCK_LABELS[d.id];
        d.querySelectorAll(':scope > .drawer-toggle > .drawer-icon, :scope > .drawer-content').forEach(el =>
            dockRO.observe(el, { attributes: true, attributeFilter: ['class'] }));
    }
    syncDockSelection();
}
function syncDockSelection() {
    if (!dockOn()) return;
    for (const d of holder.children) {
        const open = !!d.querySelector(':scope > .drawer-toggle > .drawer-icon.openIcon, :scope > .drawer-content.openDrawer');
        if (d.classList.contains('ilg-dock-active') !== open) d.classList.toggle('ilg-dock-active', open);
    }
}
function clearDock() {
    dockRO.disconnect();
    holder.style.removeProperty('--ilg-dock-count');
    holder.querySelectorAll(':scope > .ilg-dock-sep, :scope > .ilg-dock-active').forEach(d => d.classList.remove('ilg-dock-sep', 'ilg-dock-active'));
}
// 顶栏折叠（参考支付宝 AI 对话页）：左上角一个菜单键，设置类图标收进它弹出的玻璃菜单；角色卡、人设留在右边。
// 原来的图标和抽屉都不挪位置（抽屉的开关事件绑在原元素上），只是把图标隐藏，菜单里的按钮替它点一下
const FOLD_KEEP = ['ilg-tone-button', 'persona-management-button', 'rightNavHolder'];
const FOLD_LABELS = {
    'ai-config-button': 'AI 回复设置', 'sys-settings-button': 'API 连接', 'advanced-formatting-button': '高级格式',
    'WI-SP-button': '世界书', 'user-settings-button': '用户设置', 'backgrounds-button': '背景', 'extensions-settings-button': '扩展',
};
// Read native icon metadata only when toolbar/settings state changes.
function topShortcutChoices() {
    return [...holder.querySelectorAll(':scope > .drawer')].flatMap(drawer => {
        const icon = drawer.querySelector(':scope > .drawer-toggle .drawer-icon');
        if (!icon || !drawer.id || FOLD_KEEP.includes(drawer.id)) return [];
        return [{ id: drawer.id, label: FOLD_LABELS[drawer.id] || icon.title || drawer.id,
            mask: S.icons ? getComputedStyle(icon).getPropertyValue('--ilg-icon').trim() : '',
            fa: [...icon.classList].filter(c => c.startsWith('fa')).join(' ') }];
    });
}
function shortcutGlyph(entry) {
    const glyph = document.createElement('span');
    glyph.className = 'ilg-shortcut-glyph';
    glyph.setAttribute('aria-hidden', 'true');
    if (entry?.mask) glyph.style.setProperty('--ilg-shortcut-icon', entry.mask);
    else glyph.classList.add('ilg-shortcut-fa', ...(entry?.fa || 'fa-solid fa-puzzle-piece').split(' ').filter(Boolean));
    return glyph;
}
function syncTopShortcuts() {
    const picker = document.getElementById('ilg-opt-topShortcuts');
    if (!picker) return;
    const selected = [S.topShortcut1, S.topShortcut2].filter(Boolean);
    const choices = topShortcutChoices();
    for (const id of selected) if (!choices.some(c => c.id === id)) choices.push({ id, label: (FOLD_LABELS[id] || id) + '（暂不可用）', unavailable: true });
    const grid = picker.querySelector('.ilg-shortcut-grid');
    const signature = JSON.stringify(choices);
    if (grid.dataset.choices !== signature) {
        const focused = grid.contains(document.activeElement) ? document.activeElement.dataset.shortcutId : '';
        grid.replaceChildren(...choices.map(entry => {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'ilg-shortcut-tile';
            button.dataset.shortcutId = entry.id;
            button.title = entry.label; button.setAttribute('aria-label', entry.label);
            button.classList.toggle('is-unavailable', !!entry.unavailable);
            button.append(shortcutGlyph(entry));
            return button;
        }));
        grid.dataset.choices = signature;
        if (focused) [...grid.children].find(b => b.dataset.shortcutId === focused)?.focus({preventScroll:true});
    }
    for (const button of grid.children) {
        const order = selected.indexOf(button.dataset.shortcutId);
        button.setAttribute('aria-pressed', String(order >= 0));
        button.setAttribute('aria-disabled', String(order < 0 && selected.length === 2));
        button.dataset.order = order >= 0 ? String(order + 1) : '';
    }
    picker.querySelector('.ilg-shortcut-count').textContent = selected.length + ' / 2';
    picker.querySelector('.ilg-shortcut-status').textContent = selected.length === 2 ? '已选两个，点亮的图标可取消。' : '点选图标，留在顶栏左侧；再次点选可取消。';
    const preview = picker.querySelector('.ilg-shortcut-preview-left');
    preview.replaceChildren(...[0, 1].map(i => {
        const slot = document.createElement('span'); slot.className = 'ilg-shortcut-slot';
        const entry = choices.find(c => c.id === selected[i]);
        if (entry) { slot.classList.add('is-filled'); slot.append(shortcutGlyph(entry)); }
        return slot;
    }));
}
// “玻璃设置”图标：一滴水珠，里面一道折射弧。线宽和 Ionicons 轮廓图标一致（512 画布，描边 40）
const GLASS_ICON = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none" stroke="#000" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"><path d="M256 56C256 56 120 210 120 318a136 136 0 0 0 272 0C392 210 256 56 256 56Z"/><path d="M190 322a68 68 0 0 0 58 64"/></svg>')}")`;
const foldBtn = document.createElement('div');
foldBtn.id = 'ilg-fold-button';
foldBtn.innerHTML = '<div class="drawer-icon ilg-fold-icon" role="button" tabindex="0" aria-haspopup="menu" aria-expanded="false" aria-controls="ilg-fold-menu" title="菜单"></div>';
const foldIcon = foldBtn.firstChild;
const foldMenu = document.createElement('div');
foldMenu.id = 'ilg-fold-menu';
foldMenu.setAttribute('role', 'menu');
foldMenu.setAttribute('aria-label', '设置菜单');
foldMenu.hidden = true;
document.body.appendChild(foldMenu);

const foldedDrawers = () => [...holder.querySelectorAll(':scope > .drawer.ilg-folded')];
const openFolded = () => foldedDrawers().find(d => d.querySelector(':scope > .drawer-content.openDrawer:not(.pinnedOpen)'));
const apiAlert = () => !!document.querySelector('#API-status-top.redOverlayGlow');

function applyFold() {
    // 全部铺开时不折叠（菜单键也不要）
    const on = S.enabled && S.fold && !dockOn();
    root.classList.toggle('ilg-fold', on);
    if (!on) {
        closeFoldMenu();
        foldBtn.remove();
        holder.querySelectorAll(':scope > .ilg-folded, :scope > .ilg-fold-keep').forEach(d => d.classList.remove('ilg-folded', 'ilg-fold-keep', 'ilg-fold-shortcut', 'ilg-fold-second'));
        if (items.has(foldMenu)) untrack(foldMenu);
        syncSheetHeads();
        return;
    }
    if (holder.firstElementChild !== foldBtn) holder.prepend(foldBtn);
    for (const d of holder.children) {
        if (d === foldBtn) continue;
        const keep = FOLD_KEEP.includes(d.id) || [S.topShortcut1, S.topShortcut2].includes(d.id) && !!d.id && !!d.querySelector(':scope > .drawer-toggle .drawer-icon');
        d.classList.toggle('ilg-fold-keep', keep);
        d.classList.toggle('ilg-fold-shortcut', keep && !FOLD_KEEP.includes(d.id));
        d.classList.toggle('ilg-fold-second', !!d.id && d.id === S.topShortcut2);
        d.classList.toggle('ilg-folded', !keep);
    }
    syncSheetHeads();
    syncFold();
    syncTopShortcuts();
    if (!foldMenu.hidden) buildFoldTiles();
}
// 菜单打开、或者收起来的某个抽屉开着时，菜单键变成蓝色的 ×，再点一下就关掉
function syncFold() {
    const open = !foldMenu.hidden || !!openFolded();
    foldBtn.classList.toggle('ilg-open', open);
    foldIcon.setAttribute('aria-expanded', String(!foldMenu.hidden));
    foldBtn.classList.toggle('ilg-alert', apiAlert());
}
let foldTiles = [], foldRowHelp = null;
function buildFoldTiles() {
    // Collect live drawer metadata before any menu writes. Reuse controls while their identity is unchanged.
    const next = foldedDrawers().flatMap(drawer => {
        const toggle = drawer.querySelector(':scope > .drawer-toggle');
        const icon = toggle?.querySelector('.drawer-icon');
        if (!icon || getComputedStyle(drawer).display === 'none') return [];
        const mask = S.icons ? getComputedStyle(icon).getPropertyValue('--ilg-icon').trim() : '';
        return [{ drawer, toggle, mask, fa: [...icon.classList].filter(c => c.startsWith('fa')).join(' '),
            label: FOLD_LABELS[drawer.id] || icon.title || drawer.id,
            alert: icon.classList.contains('redOverlayGlow'),
            open: !!drawer.querySelector(':scope > .drawer-content.openDrawer') }];
    });
    const changed = next.length !== foldTiles.length || !foldRowHelp || next.some((entry, i) =>
        ['drawer', 'toggle', 'mask', 'fa', 'label'].some(key => entry[key] !== foldTiles[i][key]));
    if (changed) {
        const fragment = document.createDocumentFragment();
        // 第一行：整行宽的“聊天记录”，下面一行小标题，再下面才是设置图标宫格
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'ilg-fold-row';
        row.setAttribute('role', 'menuitem');
        row.innerHTML = '<span class="ilg-fold-row-icon" aria-hidden="true"></span><span class="ilg-fold-row-text"><b>聊天记录</b><small></small></span><span class="ilg-fold-row-chev" aria-hidden="true"></span>';
        foldRowHelp = row.querySelector('small');
        row.addEventListener('click', () => { closeFoldMenu(); showRecent(); });
        const cap = document.createElement('div');
        cap.className = 'ilg-fold-cap';
        cap.setAttribute('role', 'presentation');
        cap.textContent = '设置';
        fragment.append(row, cap);
        const studioTile = document.createElement('button');
        studioTile.type = 'button'; studioTile.id = 'ilg-open-studio-menu'; studioTile.className = 'ilg-fold-tile';
        studioTile.setAttribute('role', 'menuitem'); studioTile.setAttribute('aria-haspopup', 'dialog');
        // 和其它宫格图标一样走 --ilg-icon 遮罩（之前缺了这个变量，::before 被涂成一整块黑方块）
        studioTile.innerHTML = '<span class="ilg-fold-glyph" aria-hidden="true"></span><span class="ilg-fold-label">玻璃设置</span>';
        studioTile.firstChild.style.setProperty('--ilg-icon', GLASS_ICON);
        studioTile.addEventListener('click', openAppearancePanel); fragment.append(studioTile);
        foldTiles = next.map(entry => {
            const { toggle, mask, fa, label: title } = entry;
            const tile = document.createElement('button');
            tile.type = 'button';
            tile.className = 'ilg-fold-tile';
            tile.setAttribute('role', 'menuitem');
            const glyph = document.createElement('span');
            glyph.className = 'ilg-fold-glyph';
            glyph.setAttribute('aria-hidden', 'true');
            if (mask) glyph.style.setProperty('--ilg-icon', mask);
            else glyph.classList.add('ilg-fa', ...fa.split(' ').filter(Boolean));
            const label = document.createElement('span');
            label.className = 'ilg-fold-label';
            label.textContent = title;
            tile.append(glyph, label);
            tile.addEventListener('click', () => {
                closeFoldMenu();
                toggle.click();
            });
            fragment.appendChild(tile);
            return { ...entry, tile };
        });
        foldMenu.replaceChildren(fragment);
    }
    const help = homeOn ? '最近和谁聊过，点一下接着聊' : '回到首页，看看最近的聊天';
    if (foldRowHelp.textContent !== help) foldRowHelp.textContent = help;
    next.forEach((entry, i) => {
        foldTiles[i].tile.classList.toggle('ilg-alert', entry.alert);
        foldTiles[i].tile.classList.toggle('ilg-on', entry.open);
    });
}
function openFoldMenu(viaKeyboard) {
    const r = foldIcon.getBoundingClientRect();
    buildFoldTiles();
    foldMenu.style.top = `${r.bottom + 12}px`;
    // Width and viewport clamping share one CSS value; opening does not synchronously measure the menu.
    foldMenu.style.left = `clamp(8px, ${r.left - 6}px, max(8px, calc(100vw - var(--ilg-fold-menu-width) - 8px)))`;
    foldMenu.hidden = false;
    syncFold();
    if (viaKeyboard) foldMenu.querySelector('button')?.focus();
}
function closeFoldMenu(refocus) {
    if (foldMenu.hidden) return;
    foldMenu.hidden = true;
    syncFold();
    if (refocus) foldIcon.focus();
}
function onFoldPress(viaKeyboard) {
    const open = openFolded();
    if (open) { closeFoldMenu(); open.querySelector(':scope > .drawer-toggle').click(); return; }
    if (foldMenu.hidden) openFoldMenu(viaKeyboard); else closeFoldMenu();
}
foldIcon.addEventListener('click', () => onFoldPress(false));
foldIcon.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onFoldPress(true); }
});
foldMenu.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); closeFoldMenu(true); return; }
    // 第 0 个是整行的“聊天记录”，后面是四列宫格：从第一行宫格往上回到它，从它往下进第一个图标
    const tiles = [...foldMenu.querySelectorAll('button')];
    const i = tiles.indexOf(document.activeElement);
    if (i < 0) return;
    let j = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i === 0 ? 1 : i + 4, ArrowUp: i <= 4 ? 0 : i - 4 }[e.key];
    if (j === undefined) return;
    e.preventDefault();
    tiles[Math.max(0, Math.min(tiles.length - 1, j))].focus();
});

// 从菜单打开的抽屉（二级页面）：顶上加一条吸顶的标题栏，左边“‹ 菜单”回到菜单，中间是名字，右边 × 关掉
const sheetHeads = new WeakMap();
function sheetHead(d) {
    const panel = d.querySelector(':scope > .drawer-content');
    if (!panel) return;
    let head = sheetHeads.get(panel);
    if (!head) {
        head = document.createElement('div');
        head.className = 'ilg-sheet-head';
        head.innerHTML = '<button type="button" class="ilg-sheet-back"><span aria-hidden="true"></span>菜单</button><h2 class="ilg-sheet-title"></h2>' +
            '<button type="button" class="ilg-sheet-close" title="关闭" aria-label="关闭"></button>';
        const toggle = () => d.querySelector(':scope > .drawer-toggle')?.click();
        head.querySelector('.ilg-sheet-back').addEventListener('click', () => { toggle(); setTimeout(() => openFoldMenu(true), 0); });
        head.querySelector('.ilg-sheet-close').addEventListener('click', toggle);
        sheetHeads.set(panel, head);
    }
    // 只在变了的时候写：改 textContent 也算子节点变化，会再触发顶栏的 MutationObserver，形成死循环
    const title = head.querySelector('.ilg-sheet-title'), label = FOLD_LABELS[d.id] || '';
    if (title.textContent !== label) title.textContent = label;
    if (panel.firstElementChild !== head) panel.prepend(head);
}
function syncSheetHeads() {
    // 全部铺开时不折叠（菜单键也不要）
    const on = S.enabled && S.fold && !dockOn();
    for (const d of holder.querySelectorAll(':scope > .drawer')) {
        const panel = d.querySelector(':scope > .drawer-content');
        const head = panel && sheetHeads.get(panel);
        if (on && d.classList.contains('ilg-folded')) sheetHead(d);
        else head?.remove();
    }
}
// 点菜单外面就收起
document.addEventListener('pointerdown', e => {
    if (!foldMenu.hidden && !foldMenu.contains(e.target) && !foldBtn.contains(e.target)) closeFoldMenu();
}, true);
// 抽屉开关、API 连接状态变化时同步菜单键；扩展往顶栏里加了新图标时重新分组
new MutationObserver(muts => {
    if (!S.enabled || !S.fold || dockOn()) return;
    const structure = muts.some(m => m.type === 'childList' &&
        (m.target === holder || (m.target.parentElement === holder && m.target.classList.contains('drawer'))));
    if (structure) { applyFold(); scheduleIslandLayout(); return; }
    if (muts.some(m => m.type === 'attributes' &&
        (m.target.parentElement?.parentElement === holder || m.target.closest('.drawer-toggle')?.parentElement?.parentElement === holder))) syncFold();
}).observe(holder, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
// 窗口尺寸统一由 viewport.js 合并到一帧再分发；键盘弹出只改高度，不关菜单
onViewportChange(v => { if (v.widthChanged) closeFoldMenu(); });

// 滚动边缘渐隐：顶栏、输入框后面各垫一层渐变的模糊 + 暗色，文字滚到图标下面之前先淡出，不会和图标叠在一起
const sheld = document.getElementById('sheld');
for (const pos of ['top', 'bottom']) {
    const s = document.createElement('div');
    s.className = `ilg-scrim ilg-scrim-${pos}`;
    s.setAttribute('aria-hidden', 'true');
    sheld.insertBefore(s, document.getElementById('form_sheld'));
}

// Appearance choices use the native background thumbnails so chat background locks keep their host behavior.
const TONE_WALLS = { light: 'liquid glass porcelain.png', dark: 'liquid glass ink.png' };
const APPEARANCE_ICONS = {
    light: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
    dark: '<path d="M20.5 14.4A8.7 8.7 0 0 1 9.6 3.5 8.8 8.8 0 1 0 20.5 14.4Z"/>',
    custom: '<path d="M12 3a9 9 0 1 0 0 18h1.3a2.2 2.2 0 0 0 1.5-3.8 1.4 1.4 0 0 1 1-2.4H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z"/><circle cx="7.5" cy="11.5" r=".75"/><circle cx="10" cy="7.5" r=".75"/><circle cx="14.5" cy="7.5" r=".75"/>',
};
const appearanceSvg = name => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${APPEARANCE_ICONS[name]}</svg>`;
const toneBtn = document.createElement('div');
toneBtn.id = 'ilg-tone-button';
toneBtn.className = 'ilg-tone-holder';
toneBtn.innerHTML = '<button type="button" class="drawer-icon ilg-tone-icon" ></button>';
const toneIcon = toneBtn.firstChild;
const appearancePanel = document.createElement('section');
appearancePanel.id = 'ilg-appearance-panel';
appearancePanel.hidden = true;
appearancePanel.setAttribute('aria-label', '外观与阅读');
appearancePanel.innerHTML = `<div class="ilg-appearance-heading"><div><strong>外观与阅读</strong><p>明暗、壁纸与文字风格</p></div><button type="button" class="ilg-appearance-close" aria-label="关闭外观面板"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg></button></div>
  <fieldset class="ilg-appearance-modes"><legend class="ilg-sr-only">界面外观</legend>${[['light','白天'],['dark','黑夜'],['custom','自定义']].map(([value,label]) => `<label><input type="radio" name="ilg-appearance-mode" value="${value}"><span>${appearanceSvg(value)}<span>${label}</span></span></label>`).join('')}</fieldset>
  <fieldset class="ilg-glass-choice"><legend>玻璃材质</legend><label><input type="radio" name="ilg-glass-style" value="original"><span><strong>映卿</strong><small>清透弧面 · 安静轻盈</small></span></label><label><input type="radio" name="ilg-glass-style" value="liquid-web"><span><strong>漾卿</strong><small>柔润折射 · 轻弹流动</small></span></label></fieldset><p class="ilg-web-style-hint"></p><fieldset class="ilg-glass-choice ilg-web-presets"><legend>漾卿 · 质感</legend>${Object.entries(WEB_PRESETS).map(([value,p]) => `<label><input type="radio" name="ilg-web-preset" value="${value}"><span><strong>${p.label}</strong><small>${p.detail}</small></span></label>`).join('')}</fieldset>
  ${composerLayoutPicker()}
  <div class="ilg-appearance-custom"><fieldset class="ilg-text-choice"><legend>自定义壁纸字色</legend>${[['auto','自动'],['dark','深色'],['light','浅色']].map(([value,label]) => `<label><input type="radio" name="ilg-custom-text" value="${value}"><span>${label}</span></label>`).join('')}</fieldset><p class="ilg-appearance-hint">自动按壁纸选字色；首页保留柔白效果。</p><button type="button" class="ilg-choose-wallpaper"><span><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 3-3 5 5"/></svg>更换壁纸</span><svg class="ilg-wallpaper-arrow" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></button></div>
  <p class="ilg-appearance-status" role="status"></p>`;
document.body.appendChild(appearancePanel);
function appearanceMode() { return onToneWall() ? (decodeURIComponent(wallpaperUrl()).includes(TONE_WALLS.light) ? 'light' : 'dark') : 'custom'; }
function normalizeReadingStyle(value) { return ['warm', 'classic', 'moon', 'sunny'].includes(value) ? value : 'warm'; }
function applyReadingStyle() {
    S.readingStyle = normalizeReadingStyle(S.readingStyle);
    if (S.enabled) root.dataset.ilgReadingStyle = S.readingStyle;
    else root.removeAttribute('data-ilg-reading-style');
}
function normalizeCustomTextTone(value) { return ['auto', 'dark', 'light'].includes(value) ? value : 'auto'; }
function wallpaperKey(value) {
    try { return decodeURIComponent(new URL(value, location.href).pathname); } catch { return ''; }
}
function rememberCustomWallpaper(url) {
    if (!url || onToneWall() || S.customWallpaper === url) return;
    // Only preserve a background already selected by the host; do not fetch or interpolate user content into HTML.
    S.customWallpaper = url;
    ctx.saveSettingsDebounced();
}
function syncAppearancePanel() {
    appearancePanel.querySelectorAll('[name="ilg-glass-style"]').forEach(el => { el.checked = el.value === S.glassStyle; });
    document.querySelectorAll('[name="ilg-composer-layout"]').forEach(el => { el.checked = el.value === S.composerLayout; });
    const hint = appearancePanel.querySelector('.ilg-web-style-hint');
    if (hint) hint.textContent = cssGlassActive() ? '通用仿液态玻璃正在使用 CSS 材质；映卿与漾卿的参数会保留。' : S.glassStyle === 'liquid-web'
        ? (!webStyleEnabled() ? '当前环境暂不支持漾卿，已使用兼容材质。' : iosWallpaperRequested() ? 'iOS 壁纸折射：仅折射壁纸，不包含聊天正文；关闭边缘折射可恢复兼容模糊。' : isIOS ? 'iOS 当前使用兼容模糊；开启边缘折射可尝试壁纸折射。' : !S.refract || !canRefract() ? '当前只用模糊与调色；开启可用的边缘折射后可见弯曲效果。' : '漾卿用于顶栏、输入区与悬浮小球。')
        : '映卿保留独立弧度；两种材质可随时切换。';
    appearancePanel.querySelector('.ilg-web-presets').hidden = S.glassStyle !== 'liquid-web';
    appearancePanel.querySelectorAll('[name="ilg-web-preset"]').forEach(el => { el.checked = el.value === S.webPreset; });
    const mode = appearanceMode();
    appearancePanel.querySelectorAll('[name="ilg-appearance-mode"]').forEach(el => { el.checked = el.value === mode; });
appearancePanel.querySelectorAll('[name="ilg-custom-text"]').forEach(el => { el.checked = el.value === normalizeCustomTextTone(S.customTextTone); });
    appearancePanel.querySelector('.ilg-appearance-custom').hidden = mode !== 'custom';
    appearancePanel.querySelector('.ilg-appearance-status').textContent = '即时生效，自动保存';
    typographyStudio.sync();
    studioUI?.sync();
}
function syncToneBtn() {
    const mode = appearanceMode();
    toneBtn.classList.toggle('ilg-is-light', lightBg);
    const name = { light: '白天', dark: '黑夜', custom: '自定义' }[mode];
    const nextName = { light: '白天', dark: '黑夜', custom: '自定义' }[nextAppearanceMode()];
    const label = `外观：${name}，点击切换${nextName}`;
    toneIcon.title = label;
    toneIcon.setAttribute('aria-label', label);
    if (toneIcon.dataset.mode !== mode) { toneIcon.dataset.mode = mode; toneIcon.innerHTML = appearanceSvg(mode); }
    syncAppearancePanel();
}
function closeAppearancePanel(focus = false) { studioUI?.close(focus); }

// 原版预设做成和 Web 预设一样的卡片：名字、一句说明、折射 / 厚度两条五格刻度（相对最强那档）。
// 按钮本身和 data-preset / aria-pressed 不变，点击和“当前是哪档”的判断照旧。
const PRESET_NOTES = {
    natural: ['自然弧度', '边缘只放大，不扭曲'], ultra: ['超清透', '最薄的边，几乎看不见'], depth: ['清透立体', '清透，带一点厚度'],
    thin: ['轻薄', '折射轻，玻璃更薄'], standard: ['标准', '中等折射和厚度'], thick: ['厚玻璃', '更厚，边缘更明显'], extreme: ['夸张', '最强折射和色散'],
};
function presetCards() {
    // 放大镜截面没有厚度参数，用弧面宽度折一个；放大倍数折成折射强度
    const refOf = p => (p.pStrength || 0) * (p.pMagnify ? p.pMagnify / 2.2 : 1);
    const edgeOf = p => p.pThickness || (p.pBezel || 0) * 0.6;
    const list = Object.values(PRESETS).map(([, p]) => p);
    const maxRef = Math.max(...list.map(refOf)), maxEdge = Math.max(...list.map(edgeOf));
    const meter = (label, v, max) => {
        const n = Math.max(1, Math.round(v / max * 5));
        const cells = Array.from({ length: 5 }, (_, i) => (i < n ? '<i class="on"></i>' : '<i></i>')).join('');
        return `<span class="ilg-meter" aria-hidden="true"><em>${label}</em>${cells}</span>`;
    };
    return Object.entries(PRESETS).map(([k, [label, p]]) => {
        const [name, note] = PRESET_NOTES[k] || [label, ''];
        return `<button type="button" class="ilg-preset-card" data-preset="${k}" aria-pressed="false" aria-label="${label}"><strong>${name}</strong><small>${note}</small><span class="ilg-meters">${meter('折射', refOf(p), maxRef)}${meter('厚度', edgeOf(p), maxEdge)}</span></button>`;
    }).join('');
}

// 悬浮小球：一颗液态玻璃圆球，点一下打开玻璃设置。走和输入框一样的 bar 材质（原版 / Web 都跟着切），没有高光，只靠折射弧和投影。
// 层级 2990：盖在聊天上，抽屉和侧栏一开就把它压住。工作台 → 界面布局 → 悬浮小球 里三个开关：
//   floatBall 显示小球；ballSnap 松手吸回最近的左 / 右边（关掉就停在松手的地方）；
//   ballFuse 拖到顶栏岛 / 输入框旁边时，两块玻璃之间长出一段液体颈部，松手就贴着那块玻璃停下。
// 位置按屏幕比例存：贴边用 ballSide + ballY，其余用球心 ballFx / ballFy，ballDock 记“上次是贴着别的玻璃停的”。
const ball = document.createElement('button');
ball.type = 'button';
ball.id = 'ilg-ball';
ball.title = '玻璃设置（可拖动）';
ball.setAttribute('aria-label', '打开玻璃设置');
ball.setAttribute('aria-haspopup', 'dialog');
ball.innerHTML = '<span class="ilg-ball-glyph" aria-hidden="true"><span></span></span>';
ball.querySelector('.ilg-ball-glyph > span').style.setProperty('--ilg-icon', GLASS_ICON);
// 液体颈部：一块只盖住两块玻璃“之间”那段的玻璃（不和两边重叠，重叠处会叠两层模糊发灰），下面再垫一层同形状的柔影，
// 两块玻璃的影子就连成一片。颈部本身没有折射圈（那要把两块玻璃合成一个形状重算贴图），融合感靠形状、底色和连起来的影子。
const bridge = document.createElement('div');
bridge.id = 'ilg-ball-bridge';
bridge.setAttribute('aria-hidden', 'true');
bridge.hidden = true;
const SVG_NS = 'http://www.w3.org/2000/svg';
const neckShade = document.createElementNS(SVG_NS, 'svg');
neckShade.id = 'ilg-ball-shade';
neckShade.setAttribute('aria-hidden', 'true');
const shadePath = document.createElementNS(SVG_NS, 'path');
neckShade.append(shadePath);
neckShade.style.display = 'none';

const BALL_GAP = 10, FUSE_REACH = 30, DOCK_GAP = 6, FLAT_R = 4000, SHADE_PAD = 16;
const clampTo = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ballSize = () => ball.offsetWidth || 52;
let ballPos = { x: 0, y: 0 };
// 能停的范围。edge：贴边模式，躲开顶栏和输入区；否则只躲顶栏（要能停到输入框旁边去融合）
function ballBounds(edge) {
    const size = ballSize(), inset = edge ? BALL_GAP : 2;
    const top = Math.max(document.getElementById('top-bar')?.getBoundingClientRect().bottom || 0, 0) + inset;
    let bottom = innerHeight - BALL_GAP - size;
    if (edge) {
        const formTop = document.getElementById('form_sheld')?.getBoundingClientRect().top;
        if (formTop > top + size) bottom = formTop - BALL_GAP - size;
    }
    return { size, minX: inset, maxX: Math.max(inset, innerWidth - inset - size), minY: top, maxY: Math.max(top, bottom) };
}
function setBall(x, y) {
    ballPos = { x, y };
    const firstTranslate = 'translate' in ball.style && !ball.style.translate;
    if (firstTranslate) ball.style.transition = 'none';
    positionFixed(ball, Math.round(x), Math.round(y));
    if (firstTranslate) { ball.getBoundingClientRect(); ball.style.transition = ''; }
}
const clampFree = (x, y) => { const b = ballBounds(false); return { x: clampTo(x, b.minX, b.maxX), y: clampTo(y, b.minY, b.maxY) }; };
// 自由停放：不压在输入区上，压到了就挪到它上面
function freeSpot(x, y) {
    const p = clampFree(x, y), size = ballSize(), f = document.getElementById('form_sheld')?.getBoundingClientRect();
    if (f && f.width && p.x < f.right && p.x + size > f.left && p.y + size > f.top - BALL_GAP) p.y = Math.max(ballBounds(false).minY, f.top - BALL_GAP - size);
    return p;
}
// 可以融合的玻璃：顶栏岛、输入胶囊（没拆岛时是整条顶栏）。楼层提示一闪而过，不算
function fuseCandidates() {
    const list = [];
    for (const [el, it] of items) {
        if (it.kind !== 'bar' || el === ball || el.id === 'ilg-floor' || el.hidden || !el.isConnected) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8 || getComputedStyle(el).visibility === 'hidden') continue;
        list.push({ el, r, rad: radiusOf(el, r.width, r.height) });
    }
    return list;
}
// 圆角矩形上离球心最近的一点和朝外的法线。转角处用转角那个圆，直边处用一个很大的圆近似直线
function nearestOn(t, cx, cy) {
    const { r, rad } = t;
    const x0 = r.left + rad, x1 = r.right - rad, y0 = r.top + rad, y1 = r.bottom - rad;
    const ox = cx < x0 || cx > x1, oy = cy < y0 || cy > y1;
    let nx, ny, dist;
    if (ox || oy) {
        const dx = cx - clampTo(cx, x0, x1), dy = cy - clampTo(cy, y0, y1), l = Math.hypot(dx, dy) || 1;
        nx = dx / l; ny = dy / l; dist = l - rad;
    } else {
        let m = [cx - r.left, -1, 0];
        for (const o of [[r.right - cx, 1, 0], [cy - r.top, 0, -1], [r.bottom - cy, 0, 1]]) if (o[0] < m[0]) m = o;
        nx = m[1]; ny = m[2]; dist = -m[0];
    }
    const sx = cx - nx * dist, sy = cy - ny * dist, r2 = ox && oy && rad > 1 ? rad : FLAT_R;
    return { nx, ny, dist, sx, sy, r2, c2x: sx - nx * r2, c2y: sy - ny * r2 };
}
function nearestTarget(cx, cy, list = fuseCandidates()) {
    let best = null;
    for (const t of list) { const n = nearestOn(t, cx, cy); n.t = t; if (!best || n.dist < best.dist) best = n; }
    return best;
}
// 两个圆之间的颈部（metaball 连接）：越近脚越宽、腰越粗；快拉开时腰捏成一点，超出 FUSE_REACH 就断开
function neckGeometry(x1, y1, R, n) {
    const k = clampTo(1 - (n.dist - R) / FUSE_REACH, 0, 1);
    if (k <= 0) return null;
    const r2 = n.r2, ex = n.c2x - x1, ey = n.c2y - y1, d = Math.hypot(ex, ey);
    if (d <= Math.abs(r2 - R) + 1) return null;
    const ux = ex / d, uy = ey / d;
    const P = (a, b) => [x1 + a * ux - b * uy, y1 + a * uy + b * ux];
    const s1 = 0.38 + 0.5 * k, b1 = R * Math.sin(s1), a1 = R * Math.cos(s1);
    const s2 = Math.asin(Math.min(0.95, b1 * (0.9 + 0.35 * k) / r2)), b3 = r2 * Math.sin(s2), a3 = d - r2 * Math.cos(s2);
    const span = a3 - a1;
    if (span < 1) return null;
    // 控制柄沿两边圆的切线方向伸出，长度按想要的腰宽倒推；再限住，保证不越过中轴、不打结
    const wm = 0.72 * Math.min(b1, b3) * Math.pow(k, 1.3);
    let L = (0.5 * (b1 + b3) - wm) / 0.375 / (Math.cos(s1) + Math.cos(s2));
    L = Math.max(0, Math.min(L, span * 0.9 / (Math.sin(s1) + Math.sin(s2)), b1 / Math.cos(s1), b3 / Math.cos(s2)));
    const c1a = a1 + L * Math.sin(s1), c1b = b1 - L * Math.cos(s1), c2a = a3 - L * Math.sin(s2), c2b = b3 - L * Math.cos(s2);
    const pts = { p1: P(a1, b1), p2: P(a1, -b1), p3: P(a3, b3), p4: P(a3, -b3), c1: P(c1a, c1b), c2: P(c2a, c2b),
        c1m: P(c1a, -c1b), c2m: P(c2a, -c2b), tipB: P(R, 0), tipT: P(d - r2, 0) };
    const xs = Object.values(pts).map(p => p[0]), ys = Object.values(pts).map(p => p[1]);
    const box = { x: Math.floor(Math.min(...xs)) - 2, y: Math.floor(Math.min(...ys)) - 2 };
    box.w = Math.ceil(Math.max(...xs)) + 2 - box.x; box.h = Math.ceil(Math.max(...ys)) + 2 - box.y;
    const path = (ox, oy) => {
        const f = p => `${(p[0] - ox).toFixed(1)} ${(p[1] - oy).toFixed(1)}`;
        return `M${f(pts.p1)}C${f(pts.c1)} ${f(pts.c2)} ${f(pts.p3)}A${r2} ${r2} 0 0 1 ${f(pts.p4)}C${f(pts.c2m)} ${f(pts.c1m)} ${f(pts.p2)}A${R} ${R} 0 0 1 ${f(pts.p1)}Z`;
    };
    return { k, box, path };
}
let fuseList = null, bridgeTint = '', ballMat = null, ballSdfFailed = false;
// 融合半径：两块玻璃的空隙小于它的一半时开始长颈部
const SMIN_K = 30;
const ballGlass = createBallGlass({ onSurface(el, visible) {
    if (visible === null) lightScope.release(el); else lightScope.visibility(el, visible);
}, onError(error) {
    console.warn('[NVWA] 悬浮小球绘制失败，恢复兼容绘制。', error);
    ballSdfFailed = true; applyBall();
} });
// 一整块融合玻璃：要能做 SVG 背景折射，并且用新版物理引擎或 Web 材质；iOS、仅模糊、旧版引擎退回颈部补片
function ballSdfOn() {
    return S.enabled && S.floatBall && !ballSdfFailed && S.refract && canRefract() && !isIOS
        && !document.body.classList.contains('no-blur') && (webStyleEnabled() || S.engine === 'physical');
}
// 小球的材质参数：和输入框（bar）完全一样，这样单独一颗球时看起来和原来没差别
function ballMaterial() {
    const R0 = ballSize() / 2, web = webStyleEnabled();
    const key = [web ? 'w' : 'p', R0, web ? normalizeWebPreset(S.webPreset)
        : [S.profile, S.pIor, S.pMagnify, S.pBezel, S.pThickness, S.pStrength, S.pAberration, S.barBlur, S.pSaturate, S.pBrightness, S.pContrast].join(',')].join('|');
    if (ballMat?.key === key) return ballMat;
    if (web) {
        const preset = normalizeWebPreset(S.webPreset);
        ballMat = { key, kind: 'web', R0, preset, recipe: webPresetOf(preset) };
    } else {
        const k = KIND.bar;
        ballMat = { key, kind: 'phys', R0, angle: S.pLight, o: {
            profile: S.profile, ior: S.pIor, magnify: S.pMagnify, bezel: S.pBezel * k.bezelK, thickness: S.pThickness * k.thickK,
            strength: S.pStrength * k.k, aberration: S.pAberration, blur: k.blur(), saturate: S.pSaturate, brightness: S.pBrightness, contrast: S.pContrast, ...ARC_ONLY } };
    }
    return ballMat;
}
function hideBridge() {
    bridge.hidden = true;
    neckShade.style.display = 'none';
    ball.classList.remove('ilg-ball-fused');
}
// 按小球此刻真实的位置和大小（含拖动放大 / 按下缩小）画玻璃
function updateFuse(geometry) {
    if (!(S.enabled && S.floatBall) || !ball.isConnected) { hideBridge(); ballGlass.hide(); return; }
    const r = geometry || ball.getBoundingClientRect(), R = r.width / 2, cx = r.left + R, cy = r.top + R;
    const list = fuseList || (fuseList = fuseCandidates());
    if (ballSdfOn()) {
        hideBridge();
        const n = S.ballFuse ? nearestTarget(cx, cy, list) : null;
        const near = n && n.dist - R < SMIN_K / 2 + 2 ? n : null;
        try {
            ballGlass.paint({ cx, cy, R }, near && { el: near.t.el, l: near.t.r.left, t: near.t.r.top, r: near.t.r.right, b: near.t.r.bottom, rad: near.t.rad,
                sx: near.sx, sy: near.sy, nx: near.nx, ny: near.ny }, ballDrag?.material || ballMaterial(), SMIN_K, !!ballDrag?.moved || !!followRaf);
        } catch (error) {
            // 贴图生成失败（画布受限等）：这次会话里退回颈部补片
            console.warn('[NVWA] 悬浮小球融合玻璃不可用，退回颈部补片。', error);
            ballSdfFailed = true;
            applyBall();
            return;
        }
        ball.classList.toggle('ilg-ball-fused', !!near);
        return;
    }
    ballGlass.hide();
    if (!S.ballFuse) { hideBridge(); return; }
    const n = nearestTarget(cx, cy, list);
    const g = n && neckGeometry(cx, cy, R, n);
    if (!g) { hideBridge(); return; }
    if (!bridge.isConnected) document.body.append(neckShade, bridge);
    // 拖动时用按下那一刻取的底色（省得每帧算样式）；其余时候每次重取，换明暗后颈部跟着变
    if (!bridgeTint || !ballDrag) bridgeTint = getComputedStyle(ball).backgroundColor;
    const { x, y, w, h } = g.box;
    positionFixed(bridge, x, y);
    Object.assign(bridge.style, { width: `${w}px`, height: `${h}px`, clipPath: `path('${g.path(x, y)}')`, backgroundColor: bridgeTint });
    bridge.style.setProperty('--ilg-neck-k', g.k.toFixed(3));
    bridge.hidden = false;
    positionFixed(neckShade, x - SHADE_PAD, y - SHADE_PAD);
    Object.assign(neckShade.style, { display: '', width: `${w + SHADE_PAD * 2}px`, height: `${h + SHADE_PAD * 2}px` });
    neckShade.setAttribute('viewBox', `0 0 ${w + SHADE_PAD * 2} ${h + SHADE_PAD * 2}`);
    shadePath.setAttribute('d', g.path(x - SHADE_PAD, y - SHADE_PAD));
    ball.classList.add('ilg-ball-fused');
}
// 预设 / 滑块改了：小球的贴图跟着重算（repaintAll / repaintVisible 调它）
ballRefresh = () => { if (ball.isConnected && ballSdfOn()) { ballMat = null; if (ballDrag) { ballDrag.material = null; ballDrag.rect = null; } updateFuse(); } };
// 松手后的吸边 / 贴靠、按下缩放都是 CSS 过渡，这期间每帧按小球实际位置跟着画（拉开时颈部会自己捏断）；最后一帧用全分辨率
let followRaf = 0;
function followFuse(ms = 420) {
    cancelAnimationFrame(followRaf);
    const end = performance.now() + ms;
    const step = () => {
        updateFuse();
        followRaf = performance.now() < end ? requestAnimationFrame(step) : 0;
        if (!followRaf) updateFuse();
    };
    followRaf = requestAnimationFrame(step);
}
// 贴着某块玻璃停：沿法线放到它边上，留 DOCK_GAP 的缝让颈部露出来
function dockSpot(cx, cy, reach = FUSE_REACH) {
    if (!S.ballFuse) return null;
    const R = ballSize() / 2, n = nearestTarget(cx, cy);
    if (!n || n.dist - R > reach) return null;
    return clampFree(n.sx + n.nx * (R + DOCK_GAP) - R, n.sy + n.ny * (R + DOCK_GAP) - R);
}
function edgeSpot() {
    const b = ballBounds(true);
    return { x: S.ballSide === 'left' ? b.minX : b.maxX, y: b.minY + (b.maxY - b.minY) * clampTo(Number(S.ballY) || 0, 0, 1) };
}
function restoreBall(animate = false) {
    fuseList = null;
    const R = ballSize() / 2, fx = clampTo(Number(S.ballFx) || 0.92, 0, 1) * innerWidth, fy = clampTo(Number(S.ballFy) || 0.6, 0, 1) * innerHeight;
    const p = (S.ballDock && dockSpot(fx, fy, FUSE_REACH * 2)) || (S.ballSnap ? edgeSpot() : freeSpot(fx - R, fy - R));
    setBall(p.x, p.y);
    if (animate) followFuse(); else updateFuse();
}
let ballDrag = null, ballDraggedAt = 0, dragRaf = 0;
ball.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    const r = ball.getBoundingClientRect();
    ballDrag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false, x: r.left, y: r.top, bounds: ballBounds(false), material: ballSdfOn() ? ballMaterial() : null };
    // 按下就抓住指针：手快一下甩出球外，后面的移动事件也还归它
    try { ball.setPointerCapture(e.pointerId); } catch { /* 指针已经不在了 */ }
    if (ballSdfOn()) followFuse(220);
});
ball.addEventListener('pointermove', e => {
    if (!ballDrag || ballDrag.id !== e.pointerId) return;
    if (!ballDrag.moved) {
        if (Math.hypot(e.clientX - ballDrag.sx, e.clientY - ballDrag.sy) < 6) return;
        ballDrag.moved = true;
        ballDrag.measureUntil = performance.now() + 220;
        ballDrag.rect = null;
        fuseList = fuseCandidates();
        bridgeTint = getComputedStyle(ball).backgroundColor;
        cancelAnimationFrame(followRaf);
        ball.classList.add('ilg-ball-drag');
    }
    ballDrag.x = e.clientX - ballDrag.dx; ballDrag.y = e.clientY - ballDrag.dy;
    if (!dragRaf) dragRaf = requestAnimationFrame(() => {
        dragRaf = 0;
        if (!ballDrag) return;
        // Read before writing the position. The fusion renderer must not force a second layout.
        const bounds = ballDrag.bounds;
        // Once the press/drag scale settles, translation cannot change its bounds.
        // Capture one final rectangle after the transition, then reuse its local offset.
        if (!ballDrag.rect?.settled) {
            const r = ball.getBoundingClientRect();
            ballDrag.rect = { ox: r.left - Math.round(ballPos.x), oy: r.top - Math.round(ballPos.y), width: r.width, height: r.height, settled: performance.now() >= ballDrag.measureUntil };
        }
        const cached = ballDrag.rect, r = { left: Math.round(ballPos.x) + cached.ox, top: Math.round(ballPos.y) + cached.oy, width: cached.width, height: cached.height };
        if (!fuseList) fuseList = fuseCandidates();
        if (!ballDrag.material && ballSdfOn()) ballDrag.material = ballMaterial();
        const p = {x: clampTo(ballDrag.x, bounds.minX, bounds.maxX), y: clampTo(ballDrag.y, bounds.minY, bounds.maxY)};
        const geometry = {left:r.left + Math.round(p.x) - Math.round(ballPos.x), top:r.top + Math.round(p.y) - Math.round(ballPos.y), width:r.width, height:r.height};
        setBall(p.x, p.y);
        updateFuse(geometry);
    });
});
function endBallDrag(e) {
    if (!ballDrag || ballDrag.id !== e.pointerId) return;
    const moved = ballDrag.moved, last = clampFree(ballDrag.x, ballDrag.y);
    ballDrag = null;
    cancelAnimationFrame(dragRaf); dragRaf = 0;
    ball.classList.remove('ilg-ball-drag');
    if (!moved) { if (ballSdfOn()) followFuse(260); return; }
    ballDraggedAt = performance.now();
    const R = ballSize() / 2, p0 = last, cx = p0.x + R, cy = p0.y + R;
    const dock = dockSpot(cx, cy);
    S.ballDock = !!dock;
    S.ballSide = cx < innerWidth / 2 ? 'left' : 'right';
    const b = ballBounds(true);
    S.ballY = b.maxY > b.minY ? clampTo((p0.y - b.minY) / (b.maxY - b.minY), 0, 1) : 0;
    const p = dock || (S.ballSnap ? edgeSpot() : freeSpot(p0.x, p0.y));
    S.ballFx = (p.x + R) / innerWidth; S.ballFy = (p.y + R) / innerHeight;
    setBall(p.x, p.y);
    followFuse();
    ctx.saveSettingsDebounced();
}
ball.addEventListener('pointerup', endBallDrag);
ball.addEventListener('pointercancel', endBallDrag);
// 拖完松手浏览器还会补一次 click，350 毫秒内的那次不算点
ball.addEventListener('click', () => { if (performance.now() - ballDraggedAt > 350) openAppearancePanel(); });
onViewportChange(() => { if (ballDrag) { ballDrag.bounds = ballBounds(false); ballDrag.material = null; ballDrag.rect = null; fuseList = null; } else if (ball.isConnected) restoreBall(true); });
// 输入框打字变高、顶栏换行时，贴着它的小球跟着挪
const ballRO = new ResizeObserver(() => { if (ball.isConnected && !ballDrag) restoreBall(true); });
function applyBall() {
    if (!(S.enabled && S.floatBall)) {
        cancelAnimationFrame(dragRaf); dragRaf = 0;
        cancelAnimationFrame(followRaf); followRaf = 0;
        const pointer = ballDrag?.id; ballDrag = null;
        ball.classList.remove('ilg-ball-drag');
        if (pointer !== undefined && ball.hasPointerCapture(pointer)) ball.releasePointerCapture(pointer);
        if (items.has(ball)) untrack(ball);
        ballRO.disconnect();
        ball.remove(); bridge.remove(); neckShade.remove(); ballGlass.remove();
        hideBridge();
        return;
    }
    if (!ball.isConnected) document.body.append(ball);
    // 融合玻璃模式：小球本身透明，玻璃由 ball-glass.js 画；否则照旧走 bar 材质
    const sdf = ballSdfOn();
    ball.classList.toggle('ilg-ball-sdf', sdf);
    if (sdf) { if (items.has(ball)) untrack(ball); }
    else { ballGlass.remove(); if (!items.has(ball)) track(ball, 'bar'); }
    bridgeTint = ''; ballMat = null;
    if (ballDrag) ballDrag.material = null;
    ['form_sheld', 'top-bar'].forEach(id => { const el = document.getElementById(id); if (el) ballRO.observe(el); });
    restoreBall();
}
function openAppearancePanel() { closeFoldMenu(); syncAppearancePanel(); studioUI?.open('glass'); }
function applyToneBtn() {
    if (!S.enabled || !S.toneBtn) { toneBtn.remove(); return; }
    const before = document.getElementById('persona-management-button');
    if (toneBtn.nextElementSibling !== before) holder.insertBefore(toneBtn, before);
    syncToneBtn();
}
const wallThumb = tone => [...document.querySelectorAll('#bg_menu_content .bg_example, .bg_example')]
    .find(n => n.getAttribute('bgfile') === TONE_WALLS[tone]);
function customWallThumb() {
    const key = wallpaperKey(S.customWallpaper || '');
    return key && [...document.querySelectorAll('.bg_example')].find(el => {
        const file = el.getAttribute('bgfile') || '';
        return file && (wallpaperKey(file) === key || key.endsWith('/' + file));
    });
}
function nextAppearanceMode() {
    const mode = appearanceMode();
    return mode === 'light' ? 'dark' : mode === 'dark' && customWallThumb() ? 'custom' : 'light';
}
function openWallpaperPicker() {
    closeAppearancePanel();
    const button = document.getElementById('backgrounds-button');
    const icon = button?.querySelector('.drawer-icon');
    if (icon) icon.click();
    else toastr.info('请从菜单 → 背景中选择一张壁纸。', '选择自定义壁纸');
}
let appearanceSelection = 0;
let lastAppearanceAction = null;
function finishAppearance(outcome, mode, details={}) {
    lastAppearanceAction = {mode, outcome, ...details};
    interactionDiagnostics.mark('appearance-result', {mode, outcome, ...details});
}
// ST's exported settings loader saves through the host even when its gallery is filtered or absent.
// Clone every existing background preference and change only the selected owned file.
async function selectVerifiedBundledWallpaper(mode, selection) {
    try {
        const backgrounds=await import('/scripts/backgrounds.js');
        if(selection!==appearanceSelection||!S.enabled)return {ok:false,code:'superseded'};
        if(chatBgLocked())return {ok:false,code:'chat-background-locked'};
        if(typeof backgrounds.loadBackgroundSettings!=='function'||!backgrounds.background_settings||typeof backgrounds.background_settings!=='object')return {ok:false,code:'native-api-unavailable'};
        const file=TONE_WALLS[mode];if(!file)return {ok:false,code:'native-api-unavailable'};
        const url=typeof backgrounds.getBackgroundPath==='function'?backgrounds.getBackgroundPath(file):'backgrounds/'+encodeURIComponent(file);
        backgrounds.loadBackgroundSettings({background:{...backgrounds.background_settings,name:file,url:'url('+JSON.stringify(url)+')'}});
        if(wallpaperKey(wallpaperUrl()).split('/').pop()!==file)return {ok:false,code:'background-not-applied'};
        return {ok:true};
    } catch {return {ok:false,code:'native-selection-failed'};}
}
async function selectAppearance(mode) {
    const selection = ++appearanceSelection;
    lastAppearanceAction = {mode, outcome:'requested'};
    interactionDiagnostics.mark('appearance-request', {mode});
    const current = wallpaperUrl();
    if (current && !onToneWall()) rememberCustomWallpaper(current);
    let thumb, nativeApplied=false;
    if (mode === 'custom') {
        thumb = customWallThumb();
        if (!thumb && appearanceMode() !== 'custom') {
            finishAppearance('unavailable', mode);
            syncAppearancePanel();
            openWallpaperPicker();
            return;
        }
    } else {
        thumb = wallThumb(mode);
        if (!thumb) {
            toastr.info('正在检查并恢复配套壁纸…','NVWA 液态玻璃');
            const result=await ensureWalls();
            if(selection!==appearanceSelection||!S.enabled){interactionDiagnostics.mark('appearance-result',{mode,outcome:'superseded'});return;}
            if(!result.ok){finishAppearance('unavailable',mode);toastr.warning('配套壁纸恢复未完成，请检查网络或宿主的背景上传功能，再点一次重试。','NVWA 液态玻璃');return;}
            thumb=wallThumb(mode);
            if(!thumb){
                const selected=await selectVerifiedBundledWallpaper(mode,selection);
                if(selection!==appearanceSelection||!S.enabled)return;
                if(!selected.ok){finishAppearance('unavailable',mode,{route:'host-settings',code:selected.code});toastr.warning(selected.code==='chat-background-locked'?'当前聊天的背景已锁定，请在酒馆背景面板中切换或先解除锁定。':'配套壁纸已在背景库，但当前宿主未完成切换，请导出兼容诊断。','NVWA 液态玻璃');return;}
                nativeApplied=true;
            }
        }
    }
    S.tone = mode === 'custom' ? 'auto' : mode;
    toneOverride = null;
    thumb?.click();
    finishAppearance('dispatched', mode, {route:nativeApplied?'host-settings':'thumbnail'});
    void applyTone();
    const select = document.getElementById('ilg-opt-tone');
    if (select) select.value = S.tone;
    document.querySelectorAll('.ilg-settings [data-tone]').forEach(el => { el.hidden = el.dataset.tone !== S.tone; });
    ctx.saveSettingsDebounced();
}
toneIcon.addEventListener('click', () => { void selectAppearance(nextAppearanceMode()); });
appearancePanel.querySelector('.ilg-choose-wallpaper').addEventListener('click', openWallpaperPicker);
appearancePanel.querySelectorAll('[name="ilg-appearance-mode"]').forEach(el => el.addEventListener('change', () => selectAppearance(el.value)));
appearancePanel.querySelectorAll('[name="ilg-composer-layout"]').forEach(el => el.addEventListener('change', () => {
    if (!el.checked) return;
    S.composerLayout = normalizeComposerLayout(el.value);
    clearAll(); applyRoot(); syncAppearancePanel(); ctx.saveSettingsDebounced();
}));
appearancePanel.querySelectorAll('[name="ilg-glass-style"]').forEach(el => el.addEventListener('change', () => {
    if (!el.checked || !['original', 'liquid-web'].includes(el.value)) return;
    S.glassStyle = el.value;
    applyRoot();
    ctx.saveSettingsDebounced();
}));
appearancePanel.querySelectorAll('[name="ilg-web-preset"]').forEach(el => el.addEventListener('change', () => {
    if (!el.checked) return;
    S.webPreset = normalizeWebPreset(el.value);
    repaintAll(); syncAppearancePanel(); ctx.saveSettingsDebounced();
}));
appearancePanel.querySelectorAll('[name="ilg-custom-text"]').forEach(el => el.addEventListener('change', () => {
    S.customTextTone = normalizeCustomTextTone(el.value);
    void applyTone();
    ctx.saveSettingsDebounced();
}));
// 快捷回复折叠：输入框左边一个按钮，点开后快捷回复按钮浮在输入胶囊上方的一块玻璃里，点了某个按钮就收起
const qrBar = () => document.getElementById('qr--bar');

// A single owned heading per tray; never replace or clone host action nodes.
const trayHeadings = new Map();
function mountTrayHeading(el) {
    if (el.closest('[data-nvwa-style="author"], #catgod-oracle-qrbar')) return;
    const title = el.id === 'extensionsMenu' ? '扩展工具'
        : el.id === 'qr--bar' ? '快捷面板'
        : el.matches('#options .options-content') ? '聊天操作' : null;
    if (!title) return;
    let heading = trayHeadings.get(el);
    if (!heading) {
        heading = document.createElement('span');
        heading.className = 'ilg-tray-heading';
        heading.setAttribute('role', 'heading');
        heading.setAttribute('aria-level', '2');
        heading.textContent = title;
        trayHeadings.set(el, heading);
    }
    if (heading.parentElement !== el) el.prepend(heading);
    composerTools.decorate(el);
}
function releaseTrayHeading(el) {
    trayHeadings.get(el)?.remove();
    trayHeadings.delete(el);
}

// Decorate the two NVWA launchers in place; host quick-reply handlers stay on their original nodes.
const qrEntryUi = new Map();
function clearQrEntry(button, state) {
    state.icon.remove(); state.caption.remove();
    button.removeAttribute('data-ilg-entry');
    if (state.roleAdded && button.getAttribute('role') === 'button') button.removeAttribute('role');
    if (state.tabAdded && button.getAttribute('tabindex') === '0') button.removeAttribute('tabindex');
    qrEntryUi.delete(button);
}
function clearQrPresentation(bar = null) {
    for (const el of trayHeadings.keys()) {
        if (el.id === 'qr--bar' && (!bar || bar === el)) releaseTrayHeading(el);
    }
    for (const [button, state] of qrEntryUi) {
        if (!bar || bar.contains(button)) clearQrEntry(button, state);
    }
}
function decorateQrEntries(bar) {
    const found = new Set();
    for (const button of bar.querySelectorAll('.qr--button')) {
        if (button.closest('#catgod-oracle-qrbar, [data-nvwa-style="author"]')) continue;
        const label = (button.querySelector('.qr--button-label')?.textContent
            || [...button.childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join('')).replace(/^\s*NVWA\s*/i, '').trim();
        const entry = label === '预设面板' ? 'preset' : label === '记忆' ? 'memory' : null;
        if (!entry) continue;
        found.add(button);
        let state = qrEntryUi.get(button);
        if (!state) {
            const icon = document.createElement('span'), caption = document.createElement('span');
            icon.className = 'ilg-quick-icon'; icon.setAttribute('aria-hidden', 'true');
            caption.className = 'ilg-quick-caption';
            state = { icon, caption, roleAdded: !button.hasAttribute('role'), tabAdded: !button.hasAttribute('tabindex') };
            qrEntryUi.set(button, state);
            button.prepend(icon); button.append(caption);
            if (state.roleAdded) button.setAttribute('role', 'button');
            if (state.tabAdded) button.setAttribute('tabindex', '0');
        }
        if (button.dataset.ilgEntry !== entry) button.dataset.ilgEntry = entry;
        const caption = entry === 'preset' ? '提示词与风格' : '剧情与状态';
        if (state.caption.textContent !== caption) state.caption.textContent = caption;
    }
    for (const [button, state] of qrEntryUi) {
        if (!found.has(button)) clearQrEntry(button, state);
    }
}
const qrMenuUiObserver = new MutationObserver(() => syncQrPresentation(true));
function syncQrPresentation(open) {
    qrMenuUiObserver.disconnect();
    const bar = qrBar();
    if (!S.enabled || !S.qrFold) { clearQrPresentation(); return; }
    if (!open || !bar || !document.getElementById('form_sheld').contains(bar)) return;
    mountTrayHeading(bar);
    decorateQrEntries(bar);
    qrMenuUiObserver.observe(bar, { childList: true, subtree: true, characterData: true });
}

const qrToggle = document.createElement('div');
qrToggle.id = 'ilg-qr-toggle';
qrToggle.className = 'interactable';
qrToggle.setAttribute('role', 'button');
qrToggle.setAttribute('tabindex', '0');
qrToggle.setAttribute('title', '快捷回复');
qrToggle.setAttribute('aria-label', '快捷回复');
qrToggle.setAttribute('aria-expanded', 'false');
function applyQrFold() {
    const on = S.enabled && S.qrFold;
    root.classList.toggle('ilg-qrfold', on);
    if (!on) { setQrOpen(false); syncQrPresentation(false); const bar=qrBar();if(bar&&items.has(bar))untrack(bar);qrToggle.remove();return; }
    const left = document.getElementById('leftSendForm');
    if (left && qrToggle.parentElement !== left) left.appendChild(qrToggle);
}
function setQrOpen(open) {
    const bar = qrBar();
    open = open && !!bar;
    if (root.classList.contains('ilg-qr-open') === open) return;
    root.classList.toggle('ilg-qr-open', open);
    qrToggle.setAttribute('aria-expanded', String(open));
    syncQrPresentation(open);
    if (!bar) return;
    if (open) {
        if (!items.has(bar)) track(bar, 'panel');
        else { const it=items.get(bar);it.visible=true;visibleItems.add(bar);paint(bar); }
    } else { const it=items.get(bar);if(it)it.visible=false;visibleItems.delete(bar); if (bar.contains(document.activeElement)) { if(root.classList.contains('ilg-merged-tools'))composerTools.focusLauncher();else qrToggle.focus({ preventScroll: true }); } }
}
qrToggle.addEventListener('click', () => setQrOpen(!root.classList.contains('ilg-qr-open')));
qrToggle.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setQrOpen(!root.classList.contains('ilg-qr-open')); }
    if (e.key === 'Escape') setQrOpen(false);
});

document.getElementById('form_sheld').addEventListener('keydown', e => {
    if (e.defaultPrevented || !S.enabled || !root.classList.contains('ilg-qr-open') || !['Enter', ' '].includes(e.key)) return;
    const state = qrEntryUi.get(e.target);
    if (!state?.roleAdded || e.target.matches('button, a[href], input, [disabled], [aria-disabled="true"], .disabled')) return;
    e.preventDefault(); e.target.click();
});

// 点了某个快捷回复（不是它旁边的小箭头）就收起；点外面也收起
document.getElementById('form_sheld').addEventListener('click', e => {
    if (!root.classList.contains('ilg-qr-open')) return;
    const b = e.target.closest?.('.qr--button');
    if (b && !e.target.closest('.qr--button-expander')) setTimeout(() => setQrOpen(false), 0);
});
document.addEventListener('pointerdown', e => {
    if (!root.classList.contains('ilg-qr-open')) return;
    if ((root.classList.contains('ilg-merged-tools') && document.getElementById('options_button')?.contains(e.target)) || qrBar()?.contains(e.target) || qrToggle.contains(e.target) || e.target.closest?.('.ctx-menu, .list-group')) return;
    setQrOpen(false);
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') setQrOpen(false); });

// 首页（还没打开任何聊天时）：把酒馆的欢迎面板、助手消息藏起来，正中间只留一颗玻璃水滴和一句按手机时间变化的问候。
// 只藏欢迎页那几条（打上 .ilg-home-hide），用户在首页直接发消息后马上退出首页模式，不会把真正的聊天藏掉
const GREETINGS = [
    [5, '早上好', '新的一天，从哪个故事开始？'],
    [11, '中午好', '歇一会儿，听个故事吧。'],
    [14, '下午好', '故事还在原地等你。'],
    [18, '晚上好', '今晚，想走进谁的故事？'],
    [23, '夜深了', '夜还长，故事也是。'],
];
function greetingNow() {
    const h = new Date().getHours();
    let g = GREETINGS[GREETINGS.length - 1];
    for (const x of GREETINGS) if (h >= x[0]) g = x;
    return h < 5 ? GREETINGS[GREETINGS.length - 1] : g;
}
// logo 是透明底的银河图（st-verify/logo-crop.mjs 裁成 512 方图），深色壁纸原样显示，浅色壁纸 CSS 反相
root.style.setProperty('--ilg-logo', `url("${new URL('./home-logo-mark.svg', import.meta.url).href}")`);
const home = document.createElement('div');
home.id = 'ilg-home';
home.innerHTML = '<div class="ilg-home-logo" role="img" aria-label="NVWA"></div><div class="ilg-home-caption"><h1 class="ilg-home-title" aria-live="polite"></h1><p class="ilg-home-sub"></p></div>' +
    '<button type="button" class="ilg-home-recent" aria-haspopup="dialog" aria-expanded="false"><span class="ilg-home-recent-icon" aria-hidden="true"></span><span>聊天记录</span></button>';
const recentBtn = home.querySelector('.ilg-home-recent');
document.getElementById('sheld').insertBefore(home, document.getElementById('form_sheld'));
function paintGreeting() {
    const [, hello, sub] = greetingNow();
    const name = (S.homeName || '').trim();
    home.querySelector('.ilg-home-title').textContent = name ? `${hello}，${name}` : hello;
    home.querySelector('.ilg-home-sub').textContent = sub;
}
let homeOn = false, homeDismissed = false, homeTimer = 0;
const onWelcome = () => {
    const chat = document.getElementById('chat');
    return ctx.getCurrentChatId() === undefined && !!chat?.querySelector(':scope > .welcomePanel');
};
function setHome(on) {
    const chat = document.getElementById('chat');
    if (on === homeOn) return;
    homeOn = on;
    root.classList.toggle('ilg-home', on);
    clearInterval(homeTimer);
    if (on) {
        for (const n of chat.children) n.classList.add('ilg-home-hide');
        paintGreeting();
        homeTimer = setInterval(paintGreeting, 60000);
        if (wantRecent) { wantRecent = false; requestAnimationFrame(() => setRecent(true)); }
    } else {
        setRecent(false);
        releaseRecent();
        chat.querySelectorAll(':scope > .ilg-home-hide').forEach(n => n.classList.remove('ilg-home-hide'));
    }
}
const hostInteractionState = createHostInteractionState({ holder, form: document.getElementById('form_sheld'), home, qrToggle,
    onQrBar(previous,next){
        composerTools.refresh();
        if(previous){clearQrPresentation(previous);if(items.has(previous))untrack(previous);}
        syncQrPresentation(root.classList.contains('ilg-qr-open'));
        if(next&&S.enabled&&root.classList.contains('ilg-qr-open'))track(next,'panel');
        if(!next&&root.classList.contains('ilg-qr-open'))setQrOpen(false);
    },
});
function syncHome() { setHome(S.enabled && S.home && !homeDismissed && onWelcome()); }
new MutationObserver(muts => {
    if (!S.enabled || !S.home) return;
    for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        // 重新回到欢迎页：允许再次进入首页模式
        if (n.classList.contains('welcomePanel')) homeDismissed = false;
        // 在首页直接发了消息（临时聊天）：退出首页模式，后面的消息正常显示
        else if (homeOn && n.matches('.mes[is_user="true"]')) { homeDismissed = true; setHome(false); return; }
        if (homeOn) n.classList.add('ilg-home-hide');
    }
    // 置顶、改名、删除后酒馆会重画整个欢迎面板：聊天记录开着的话，给新面板补上标题栏和玻璃
    if (recentPanel) {
        const panel = welcomePanel();
        if (panel !== recentPanel) { releaseRecent(); if (recentOn && panel) mountRecent(panel); }
    }
    syncHome();
}).observe(document.getElementById('chat'), { childList: true });

// 聊天记录：首页的醒目按钮 / 菜单第一行点开。直接把酒馆欢迎面板里的“最近聊天”列表当成一块浮起来的玻璃卡片显示，
// 打开、置顶、改名、删除、显示更多都还是酒馆自己的按钮和逻辑，这里只负责摆位置、加标题栏
let recentOn = false, recentPanel = null, recentAttrs = null, wantRecent = false;
const welcomePanel = () => document.querySelector('#chat > .welcomePanel');
const recentHead = document.createElement('div');
recentHead.className = 'ilg-recent-head';
recentHead.innerHTML = '<h2 class="ilg-recent-title" id="ilg-recent-title">聊天记录</h2>' +
    '<button type="button" class="ilg-recent-settings" title="最近聊天记录设置">记录设置</button>' +
    '<button type="button" class="ilg-recent-close" title="关闭" aria-label="关闭聊天记录"></button>';
recentHead.querySelector('.ilg-recent-close').addEventListener('click', () => setRecent(false, true));
const recentSettings = recentHead.querySelector('.ilg-recent-settings');
recentSettings.addEventListener('click', () => recentPanel?.querySelector('.recentChatsSettings')?.click());
const recentStatus = document.createElement('p');
recentStatus.className = 'ilg-recent-status';
recentStatus.setAttribute('role', 'status');
recentStatus.hidden = true;
function releaseRecent() {
    if (!recentPanel) return;
    untrack(recentPanel);
    recentPanel.classList.remove('ilg-recent');
    for (const [name, value] of recentAttrs) {
        if (value === null) recentPanel.removeAttribute(name);
        else recentPanel.setAttribute(name, value);
    }
    recentHead.remove();
    recentStatus.remove();
    recentPanel = recentAttrs = null;
}
function mountRecent(panel) {
    if (panel === recentPanel) return;
    releaseRecent();
    recentPanel = panel;
    recentAttrs = ['role', 'aria-labelledby', 'aria-hidden'].map(name => [name, panel.getAttribute(name)]);
    panel.classList.add('ilg-recent');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-labelledby', 'ilg-recent-title');
    panel.setAttribute('aria-hidden', String(!recentOn));
    recentStatus.hidden = !!panel.querySelector('.recentChat');
    recentSettings.hidden = !panel.querySelector('.recentChatsSettings');
    recentStatus.textContent = recentSettings.hidden ? '当前客户端未返回最近聊天记录，请重新打开首页或核对客户端版本。' : '当前酒馆未返回最近聊天记录，可检查“记录设置”后重新打开首页。';
    panel.prepend(recentHead, recentStatus);
    track(panel, 'panel');
}
function setRecent(on, refocus) {
    const panel = welcomePanel();
    on = on && homeOn && !!panel;
    if (on === recentOn) return;
    recentOn = on;
    // Measure with the final display state, before focus or the first visible frame.
    root.classList.toggle('ilg-recent-open', on);
    if (on) {
        const mounted = recentPanel === panel && items.has(panel);
        mountRecent(panel);
        if (mounted) paint(panel);
    }
    recentBtn.setAttribute('aria-expanded', String(on));
    if (recentPanel) {
        recentPanel.setAttribute('aria-hidden', String(!on));
    }
    if (on) {
        closeFoldMenu();
        panel.scrollTop = 0;
        (panel.querySelector('.recentChat:not(.hidden)') || recentHead.querySelector('.ilg-recent-close')).focus({ preventScroll: true });
        recentStatus.hidden = !!panel.querySelector('.recentChat');
    } else if (refocus && homeOn) recentBtn.focus();
}
// 在聊天里点“聊天记录”：先关掉当前聊天（酒馆会自动保存，回到欢迎页），首页出现后自动展开列表
function showRecent() {
    if (homeOn) { setRecent(!recentOn); return; }
    const close = document.getElementById('option_close_chat');
    if (!close || !S.home) { document.getElementById('option_select_chat')?.click(); return; }
    homeDismissed = false;
    wantRecent = true;
    close.click();
    setTimeout(() => { wantRecent = false; }, 5000);
}
recentBtn.addEventListener('click', () => setRecent(!recentOn));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && recentOn) setRecent(false, true); });
// 点卡片外面收起（弹窗、右键菜单、顶栏里的操作不算）
document.addEventListener('pointerdown', e => {
    if (!recentOn || recentPanel?.contains(e.target) || recentBtn.contains(e.target)) return;
    if (e.target.closest?.('.popup, dialog, #top-settings-holder, #ilg-fold-menu, .ctx-menu, #toast-container')) return;
    setRecent(false);
}, true);

new ResizeObserver(scheduleIslandLayout).observe(holder);
onViewportChange(layoutIslands);

// 明暗判定：浅色壁纸配白字会看不清，所以按壁纸平均亮度切换
let lightBg = false, cardTone = null;
function sampleLuminance(url) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            try {
                const c = document.createElement('canvas');
                c.width = 32; c.height = 32;
                const g = c.getContext('2d', { willReadFrequently: true });
                g.drawImage(img, 0, 0, 32, 32);
                const d = g.getImageData(0, 0, 32, 32).data;
                let sum = 0;
                for (let i = 0; i < d.length; i += 4) sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
                resolve(sum / (d.length / 4));
            } catch { resolve(0); }
        };
        img.onerror = () => resolve(0);
        img.src = url;
    });
}

const wallpaperToneCache = new Map();
let currentWallpaperSample = null;
function sampleCustomWallpaper(url) {
    if (wallpaperToneCache.has(url)) return wallpaperToneCache.get(url);
    const sample = new Promise(resolve => {
        const img = new Image();
        let settled = false;
        const finish = value => { if (!settled) { settled = true; clearTimeout(timeout); resolve(value); } };
        const timeout = setTimeout(() => finish(null), 6000);
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas'); canvas.width = canvas.height = 48;
                const g = canvas.getContext('2d', { willReadFrequently: true });
                g.drawImage(img, 0, 0, 48, 48);
                const data = g.getImageData(0, 0, 48, 48).data, dark = [], light = [];
                const linear = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
                const luminance = (r,g,b) => .2126 * linear(r) + .7152 * linear(g) + .0722 * linear(b);
                const ink = luminance(43,52,58), pearl = luminance(233,229,220);
                const contrast = (a,b) => (Math.max(a,b) + .05) / (Math.min(a,b) + .05);
                for (let y=6;y<42;y++) for (let x=8;x<40;x++) {
                    const i=(y*48+x)*4, l=luminance(data[i],data[i+1],data[i+2]);
                    dark.push(contrast(ink,l)); light.push(contrast(pearl,l));
                }
                dark.sort((a,b)=>a-b); light.sort((a,b)=>a-b);
                const index=Math.floor(dark.length*.25);
                finish({ dark:dark[index], light:light[index], raster:{pixels:data,size:48,width:img.naturalWidth,height:img.naturalHeight} });
            } catch { finish(null); }
        };
        img.onerror = () => finish(null); img.src = url;
    });
    wallpaperToneCache.set(url, sample);
    if (wallpaperToneCache.size > 8) wallpaperToneCache.delete(wallpaperToneCache.keys().next().value);
    return sample;
}
let toneRequest = 0;

function wallpaperUrl() {
    for (const id of ['bg_custom', 'bg1']) {
        const el = document.getElementById(id);
        // 先读行内样式：酒馆给壁纸切换加了 0.375s 渐变，渐变期间 computed 值还是旧图
        const m = el && /url\(["']?(.*?)["']?\)/.exec(el.style.backgroundImage || getComputedStyle(el).backgroundImage || '');
        if (m) return m[1];
    }
    return '';
}
// 自动明暗：默认“按时间”（白天 dayStart–dayEnd 点用瓷白，其余用墨黑），也可以“跟随系统”。
// 只在当前壁纸本来就是瓷白 / 墨黑这两张之一时才替你换壁纸；用的是自己的壁纸，或者本聊天锁定了背景（点缩略图会改写聊天里存的背景），就不碰，明暗照旧按壁纸亮度判断
const sysDark = matchMedia('(prefers-color-scheme: dark)');
let toneOverride = null; // 手动临时换过：{ tone, base }，base 是当时的自动结果，自动结果一变就作废
function wantTone() {
    if (S.tone === 'system') return sysDark.matches ? 'dark' : 'light';
    if (S.tone === 'time') {
        const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
        return h >= S.dayStart && h < S.dayEnd ? 'light' : 'dark';
    }
    return null;
}
function onToneWall() {
    let name = wallpaperUrl().split('/').pop() || '';
    try { name = decodeURIComponent(name); } catch { /* 文件名里有怪字符就按原样比 */ }
    return Object.values(TONE_WALLS).includes(name);
}
// 酒馆每次换聊天都会换一个新的 chat_metadata 对象，开头缓存的 ctx 里那份是旧的，所以每次现取
const chatBgLocked = () => !!SillyTavern.getContext().chatMetadata?.custom_background;
function followTone() {
    const want = wantTone();
    if (!want || !S.enabled) { toneOverride = null; return; }
    if (toneOverride) {
        if (toneOverride.base === want) return;
        toneOverride = null;
    }
    if ((lightBg ? 'light' : 'dark') === want || !onToneWall() || chatBgLocked()) return;
    wallThumb(want)?.click();
}
async function applyTone() {
    const request = ++toneRequest, url = wallpaperUrl(), custom = !!url && !onToneWall();
    if(iosWallpaperRequested())iosWallpaper.refresh();
    if (currentWallpaperSample?.url !== url) currentWallpaperSample = null;
    let sampled = null;
    root.classList.toggle('ilg-custom-wallpaper', S.enabled && custom);
    if (S.enabled && custom) rememberCustomWallpaper(url);
    let nextLight;
    if (custom) {
        S.customTextTone = normalizeCustomTextTone(S.customTextTone);
        const sample = await sampleCustomWallpaper(url);
        sampled = sample?.raster ? {url,raster:sample.raster} : null;
        nextLight = S.customTextTone === 'dark' ? true : S.customTextTone === 'light' ? false : sample ? sample.dark >= sample.light : lightBg;
    } else if (S.tone === 'light' || S.tone === 'dark') nextLight = S.tone === 'light';
    else nextLight = url ? (await sampleLuminance(url)) > 0.6 : false;
    if (request !== toneRequest || url !== wallpaperUrl()) return;
    currentWallpaperSample = sampled;
    lightBg = nextLight;
    root.classList.toggle('ilg-light', S.enabled && lightBg);
    syncToneBtn();
    root.style.setProperty('--ilg-control-a', Math.min(.22, .035 + S.tint * .45));
    root.style.setProperty('--ilg-tint', `rgba(255, 255, 255, ${lightBg ? Math.min(.7, S.tint + .08) : S.tint})`);
    const st = document.getElementById('ilg-status');
    if (st) st.textContent = statusText();
    scheduleAdapt();
    // 深浅一换，正文里卡片小面板的“反色”判断要重来（推到下一拍：模块初始化时这里会先于 queueCards 那段代码执行）
    const nextCardTone = S.enabled ? (lightBg ? 'light' : 'dark') : null;
    if (nextCardTone !== cardTone) {
        cardTone = nextCardTone;
        if (S.enabled) setTimeout(() => queueCards(true));
    }
    followTone();
}
setInterval(followTone, 60000);
sysDark.addEventListener('change', followTone);

function normalizeChatVeil(value) {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 45;
}
function normalizeChatFontSize(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? Math.min(32, Math.max(12, Math.round(numeric))) : 0;
}
function applyChatFontSize() {
    const size = normalizeChatFontSize(S.chatFontSize);
    S.chatFontSize = size;
    const active = S.enabled && size > 0;
    chatEl.classList.toggle('ilg-chat-font', active);
    if (active) chatEl.style.setProperty('--ilg-chat-font-size', size + 'px');
    else chatEl.style.removeProperty('--ilg-chat-font-size');
}

let glassSettingsRaf = 0;
function applySurfaceSettings() {
    // Keep the first Android glyphs: downloading CJK subsets must not replace visible text.
    root.style.setProperty('--ilg-unified-font', androidHost ? 'system-ui, sans-serif' : '-apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC Variable", "Microsoft YaHei", sans-serif');
    root.style.setProperty('--ilg-panel-filter', `blur(${KIND.panel.blur()}px) saturate(${S.saturate}) brightness(${S.brightness})`);
    root.style.setProperty('--ilg-menu-filter', `blur(10px) saturate(${S.saturate}) brightness(${S.brightness})`);
    root.style.setProperty('--ilg-hl', S.highlight);
    root.style.setProperty('--ilg-radius', `${S.radius}px`);
    root.style.setProperty('--ilg-shadow-k', S.pShadow);
    root.style.setProperty('--ilg-sheen-k', S.pSheen);
    root.style.setProperty('--ilg-mes-a', S.mesTint);
    root.classList.toggle('ilg-chat-transparent', S.enabled && S.chatBackground === 'transparent');
    S.chatVeil = normalizeChatVeil(S.chatVeil);
    root.style.setProperty('--ilg-reading-level', S.chatVeil / 100);
    const reading = S.enabled && S.chatBackground !== 'transparent' ? S.chatVeil / 100 : 0;
    root.style.setProperty('--ilg-reading-filter', `blur(${reading * 4}px) saturate(${1 - reading * .4}) brightness(calc(1 - ${reading * .4} * var(--ilg-reading-dark, 1)))`);
    root.classList.toggle('ilg-chat-reading', S.enabled && S.chatBackground !== 'transparent' && S.chatVeil > 0);
    root.style.setProperty('--ilg-scrim-a', S.scrim);
    root.style.setProperty('--ilg-tint', `rgba(255, 255, 255, ${lightBg ? Math.min(.7, S.tint + .08) : S.tint})`);
}
function queueGlassSettings() {
    if (!S.enabled || glassSettingsRaf) return;
    glassSettingsRaf = requestAnimationFrame(() => {
        glassSettingsRaf = 0;
        if (!S.enabled) return;
        applySurfaceSettings();
        repaintVisible('settings');
    });
}

function applyRoot() {
    if (!S.enabled) hideRangeValue();
    if (!S.enabled) {
        interactionDiagnostics.stop('disabled');
        flickerCapture?.finish('disabled');
    }
    hostInteractionState.setEnabled(S.enabled);
    normalizeTopStyleSettings(S);
    syncInputMaterial(false);
    if (glassSettingsRaf) { cancelAnimationFrame(glassSettingsRaf); glassSettingsRaf = 0; }
    if (!S.enabled) { cardTone = null; clearTopTones(); }
    applyChatFontSize();
    root.classList.toggle('ilg', S.enabled);
    S.composerLayout = normalizeComposerLayout(S.composerLayout);
    composerTools.setEnabled(S.enabled && S.composerLayout !== 'classic');
    syncComposerLayout({root, enabled:S.enabled, layout:S.composerLayout, release:untrack});
    root.classList.toggle('ilg-clear-optics', S.enabled);
    root.classList.toggle('ilg-css-glass', cssGlassActive());
    root.classList.toggle('ilg-liquid-web', webStyleEnabled());
    webGlass.setEnabled(webStyleEnabled());
    iosWallpaper.setEnabled(iosWallpaperRequested());
    reflections.setEnabled(S.enabled && !cssGlassActive());
    syncMobileTilt();
    root.classList.toggle('ilg-ios-experiment', S.enabled && isIOS);
    root.classList.toggle('ilg-ios-material', S.enabled && iosBlurEligible && S.iosMaterial === true && !(S.refract && canRefract()));
    root.classList.toggle('ilg-indent', S.enabled && !!S.firstLineIndent);
    root.classList.toggle('ilg-justify', S.enabled && !!S.justifyText);
    root.classList.toggle('ilg-float', S.enabled && S.float);
    root.classList.toggle('ilg-icons', S.enabled && S.icons);
    root.classList.toggle('ilg-font', S.enabled && S.font);
    cardClarity.setEnabled(S.enabled);
    applyReadingStyle();
    typographyStudio.sync();
    root.classList.toggle('ilg-islands', S.enabled && S.islands);
    root.classList.toggle('ilg-dock', dockOn());
    root.classList.toggle('ilg-avline', S.enabled && S.avatar === 'line');
    root.classList.toggle('ilg-orb-on', S.enabled && S.orb);
    root.classList.toggle('ilg-panel-read', S.enabled && S.panelRead);
    installMessageIcons();
    applyTone();
    applySurfaceSettings();
    applyToneBtn();
    applyFold();
    applyQrFold();
    syncHome();
    queueThink();
    requestAnimationFrame(scheduleFloor);
    if (!S.enabled) { clearAll(); removeIslands(); applyBall(); return; }
    scan();
    if (S.fold && !items.has(foldMenu)) track(foldMenu, 'panel');
    // 开关切换时 clearAll 会把这两块玻璃也摘掉，补回来
    if (root.classList.contains('ilg-qr-open') && qrBar()) track(qrBar(), 'panel');
    if (recentOn && recentPanel && !items.has(recentPanel)) track(recentPanel, 'panel');
    applyBall();
    if (S.islands) {
        const topBar = document.getElementById('top-bar');
        untrack(topBar);
        topBar.classList.remove('ilg-over-light', 'ilg-over-dark');
        layoutIslands();
    } else {
        removeIslands();
    }
    requestAnimationFrame(repaintAll);
}

// 输入框高度变化时同步底部留白；仅在扩展启用且宿主允许自动滚动时保持贴底
const form = document.getElementById('form_sheld');
const chatEl = document.getElementById('chat');
const messageRendering = createMessageRendering(chatEl, {
    onReset(el) { if (items.has(el)) { ro.unobserve(el); ro.observe(el); } },
    onWidthFeedback(reason) { flickerCapture?.widthFeedback(reason); },
});
const cardClarity = createCardTextClarity(chatEl);
let formResizeRaf = 0;
function updateFormSpace() {
    formResizeRaf = 0;
    const height = `${form.offsetHeight}px`;
    if (root.style.getPropertyValue('--ilg-form-h') === height) return;
    const atBottom = chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight < 40;
    root.style.setProperty('--ilg-form-h', height);
    if (S.enabled && ctx.powerUserSettings?.auto_scroll_chat_to_bottom && atBottom) chatEl.scrollTop = chatEl.scrollHeight;
}
// Changing chat geometry inside this observer can re-trigger a shallower host observer.
new ResizeObserver(() => {
    if (!formResizeRaf) formResizeRaf = requestAnimationFrame(updateFormSpace);
}).observe(form);
const keyboard = createKeyboard({ root, enabled: () => S.enabled && S.float, input: () => document.getElementById('send_textarea') });
const readingAnchor = createReadingAnchor({ chat: chatEl, enabled: () => S.enabled });
const typographyStudio = createTypographyStudio({root, chat:chatEl, settings:S, save:()=>ctx.saveSettingsDebounced(),
    setBase:()=>{ applyReadingStyle(); syncAppearancePanel(); typographyStudio.ui.dispatchEvent(new Event('ilg-type-applied',{bubbles:true})); }});

// 新消息、删除消息、切换聊天
// 切换聊天后 1.5 秒内不加入场动画：酒馆是一条条插入消息的，那段时间插进来的都是旧消息
let riseQuietUntil = performance.now() + 4000;
new MutationObserver(muts => {
    if (!S.enabled) return;
    const bubble = document.body.classList.contains('bubblechat');
    const added = [];
    for (const m of muts) {
        m.removedNodes.forEach(n => n.nodeType === 1 && (items.has(n) ? untrack(n) : n.querySelectorAll?.('.ilg-glass').forEach(untrack)));
        if (bubble) m.addedNodes.forEach(n => n.nodeType === 1 && n.matches(MES_SEL) && added.push(n));
    }
    trackMessages(added);
    if (!androidHost && added.length > 0 && added.length <= 2 && performance.now() > riseQuietUntil) {
        added.forEach(n => {
            n.classList.add('ilg-rise');
            n.addEventListener('animationend', () => n.classList.remove('ilg-rise'), { once: true });
        });
    }
}).observe(chatEl, { childList: true });

// 弹窗是动态插入 body 的；只在气泡模式变化时重扫消息，其他状态只重画屏幕附近的表面。
let bodyBubbleMode = document.body.classList.contains('bubblechat');
new MutationObserver(muts => {
    const bubble = document.body.classList.contains('bubblechat');
    const bubbleChanged = bubble !== bodyBubbleMode;
    bodyBubbleMode = bubble;
    if (!S.enabled) return;
    let rescan = false;
    for (const m of muts) {
        if (m.type === 'attributes') rescan = true;
        m.addedNodes.forEach(n => {
            if (n.nodeType !== 1) return;
            if (n.matches?.(PANEL_SEL)) track(n, 'panel');
            if (n.id === 'toast-container') watchToasts(n);
        });
        m.removedNodes.forEach(n => {
            if (n.nodeType !== 1) return;
            untrack(n);
            n.querySelectorAll?.('.ilg-glass').forEach(untrack);
        });
    }
    if (rescan) {
        if (isIOS) { const status = document.getElementById('ilg-status'); if (status) status.textContent = statusText(); }
        if (bubbleChanged) scan();
        repaintVisible('bodyClass');
    }
}).observe(document.body, { childList: true, attributes: true, attributeFilter: ['class'] });
// 第三方弹窗不参与扫描：这里只监听酒馆核心弹窗和本扩展自己的宿主节点。
function fmt(step, unit, v) {
    return (step < 1 ? Number(v).toFixed(step < 0.1 ? 2 : 1) : v) + unit;
}

/* ---------- 配套主题：先导入并选中主题，再安装扩展 ----------
   只检查、不改写主题和自定义 CSS；旧版备份留在设置中，不迁移、不清空。 */
const COMPANION_THEME = 'NVWA 液态玻璃';
function companionThemeStatus() {
    const select = document.getElementById('themes');
    if (!select) return 'pending';
    if (![...select.options].some(o => o.value === COMPANION_THEME)) return 'missing';
    if (select.value !== COMPANION_THEME) return 'inactive';
    const pu = ctx.powerUserSettings || {};
    if (pu.chat_display !== 1 || pu.avatar_style !== 3 || pu.fast_ui_mode !== false
        || pu.noShadows !== false || pu.waifuMode !== false || pu.font_scale !== 1
        || pu.blur_strength !== 14 || (pu.custom_css || '').trim()) return 'modified';
    return 'ready';
}
function companionThemeText(state) {
    return {
        pending: '正在等待酒馆载入主题。',
        missing: '尚未导入配套主题。请先导出旧主题作备份，再到用户设置 → UI 主题导入并选中「NVWA 液态玻璃」。',
        inactive: '配套主题已导入但未选中。请到用户设置 → UI 主题选择「NVWA 液态玻璃」。插件不会自动替换当前主题。',
        modified: '配套主题的关键选项或自定义 CSS 已改变。可重新选择配套主题；旧版文件请按安装说明更新。',
        ready: '配套主题已选中。插件负责折射、布局和深浅切换；请勿叠加其他整页美化扩展。',
    }[state];
}
function refreshCompanionTheme() {
    const node = document.getElementById('ilg-opt-themeStatus');
    if (node) node.textContent = companionThemeText(companionThemeStatus());
}
ctx.eventSource.on(ctx.eventTypes.APP_READY, () => {
    refreshCompanionTheme();
    const select = document.getElementById('themes');
    select?.addEventListener('change', () => setTimeout(refreshCompanionTheme, 0));
    document.getElementById('customCSS')?.addEventListener('input', () => setTimeout(refreshCompanionTheme, 0));
    if (S.enabled && companionThemeStatus() !== 'ready' && typeof toastr !== 'undefined') {
        toastr.warning(companionThemeText(companionThemeStatus()), 'NVWA 配套主题', { timeOut: 12000 });
    }
});

function statusText() {
    if (!S.enabled) return '美化已关闭。';
    if (document.body.classList.contains('no-blur')) return '你开了酒馆的“关闭模糊”，所以玻璃和折射都暂停了。';
    if (cssGlassActive()) return '澄卿 · 通用仿液态玻璃：CSS 轻模糊、细亮边与柔和投影；SVG 折射与轮廓贴图已停用。';
    if (S.glassStyle === 'liquid-web') return '漾卿 · 顶栏与输入区。' + (iosWallpaperRequested() ? (iosWallpaper.status().surfaces>0?'iOS 壁纸折射图层已启用：仅壁纸，不包含聊天正文；实际位移仍需真机确认。':iosWallpaper.status().reason==='loading-wallpaper'?'iOS 壁纸图层准备中，暂用兼容模糊。':iosWallpaper.status().reason==='image-unavailable'?'iOS 壁纸图层加载失败，已保留兼容模糊。':'iOS 壁纸折射尚未就绪，暂用兼容模糊。') : isIOS ? 'iOS 使用模糊与光感，不宣称真实折射。' : S.refract && canRefract() ? '已请求弯曲背景折射。' : '当前使用模糊与光感。');
    if (iosMaterialActive()) return 'iOS 兼容玻璃：系统模糊与边缘光感已启用，此模式不包含真实背景折射。';
    if (!S.refract) return '边缘折射已关闭，现在只有模糊。';
    if (isIOS && iosTrialRequested()) return 'iOS SVG 折射实验已请求；不代表背景位移已显示，请对比画面确认。关闭实验开关即可恢复模糊。';
    if (!canRefract()) {
        if (isIOS && S.iosSvgTrial === true) return 'iOS 模糊或 SVG URL 语法门槛未通过，保留模糊回退。';
        if (isIOS) return 'iOS 清透降级样式；可手动开启独立的 SVG 折射实验，实际效果待设备确认。';
        if (androidWebView) return '当前 WebView 的模糊或 SVG URL 语法检测未通过，保留模糊回退。';
        return '当前环境未通过自动折射门槛，保留模糊回退；不凭浏览器名称保证渲染能力。';
    }
    const how = { time: '，按时间自动', system: '，跟随系统' }[S.tone] || '';
    const tone = `${S.engine === 'physical' ? '物理折射' : '旧版折射'} · ${lightBg ? '浅色' : '深色'}模式${how}`;
    const route = !canFull ? '安卓 WebView 兼容路径' : '自动路径';
    return `已请求折射（${route}，${tone}），实际画面以当前设备为准。${document.body.classList.contains('bubblechat') ? '' : '消息卡片玻璃只在“气泡”样式下生效。'}`;
}

function viewportDiagnostic() {
    const vv=window.visualViewport;
    const rect=id=>{const el=document.getElementById(id);if(!el)return null;const r=el.getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)};};
    const paths={},surfaces=[];let large=0,bounded=0;
    for(const [el,it] of items){const path=it.renderPath||'pending';paths[path]=(paths[path]||0)+1;if(it.fallbackReason==='large-android-message'||it.fallbackReason==='large-webview-message')large++;
        if(it.backdropClip&&innerWidth>=600)bounded++;
        if(surfaces.length<3&&it.visible&&el.matches('.mes')){const r=el.getBoundingClientRect(),b=(it.backdrop||el).getBoundingClientRect();surfaces.push({width:Math.round(r.width),height:Math.round(r.height),backdropWidth:Math.round(b.width),backdropHeight:Math.round(b.height),boundedBackdrop:!!it.backdropClip&&innerWidth>=600,path,fallbackReason:it.fallbackReason||''});}}
    return{layout:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},visual:vv?{width:vv.width,height:vv.height,offsetTop:vv.offsetTop,offsetLeft:vv.offsetLeft,scale:vv.scale}:null,
        composerFocused:document.activeElement===document.getElementById('send_textarea'),keyboard:keyboard.status(),chat:{scrollTop:chatEl.scrollTop,scrollHeight:chatEl.scrollHeight,clientHeight:chatEl.clientHeight,readingAnchor:readingAnchor.status()},composer:rect('nonQRFormItems'),form:rect('form_sheld'),ball:{shown:S.enabled&&S.floatBall,keyboardHidden:root.classList.contains('ilg-kb-open'),rect:rect('ilg-ball')},
        rendering:{iosCompatible:iosMaterialActive(),engineRequested:S.engine,largeWebViewMessages:large,largeAndroidMessages:large,boundedMessageBackdrops:bounded,paths,surfaces},
        typography:{mode:!S.enabled||!S.font?'host':androidHost?'system':'unified',status:document.fonts?.status||'unavailable',...fontActivity},
        appearance:{requested:S.tone,actual:appearanceMode(),lightThumbnail:!!wallThumb('light'),darkThumbnail:!!wallThumb('dark'),customThumbnail:!!customWallThumb(),chatBackgroundLocked:chatBgLocked(),lastAction:lastAppearanceAction},
        wallpapers:bundledWallpapers.status(),wallpaperRefraction:iosWallpaper.status(),workers:{reflections:reflections.status(),ball:((({mode,reason,suspended,pending,failures})=>({mode,reason,suspended,pending,failures}))(ballGlass.status()))},lighting:lighting.status(),captureNote:'Frame intervals describe page callbacks, not display flicker detection'};
}
const CAPTURE_SCENARIOS = {
    general: ['综合交互', ['上下滑动聊天几次，停一下，再来回滑动。', '拖动悬浮小球几次，观察是否跟手；未开启小球时可跳过。', '点输入框打几个字，收起键盘，再拖动一次小球。']],
    menus: ['输入框菜单 / 卡顿', ['若通常用久才变慢，先正常使用到变慢，再点击开始采集。', '点击输入框左侧的“＋”，等菜单显示后关闭，重复两三次。', '再点击魔法棒图标，打开、关闭两三次，尽量在 15 秒内完成。', '采集结束后点击提示条的“导出诊断”，把下载的 TXT 文件发回。']],
    appearance: ['黑白切换 / 壁纸', ['点击右上角的太阳、月亮或调色盘图标。', '连续切换两三次；如提示正在恢复壁纸，留在页面等待结果。', '观察壁纸和文字颜色是否变化，以及有没有错误提示。']],
    rendering: ['屏闪 / 折射', ['停在原来会闪的卡片处，先静止约 3 秒，观察静止时是否也闪。', '上下滑动这张卡片几次，再停住，观察屏闪或卡顿出现的时机。', '方便时另录约 10 秒视频；反馈时说明静止、滚动或打字时是否闪。']],
    keyboard: ['键盘 / 拖动', ['拖动悬浮小球几次，观察是否跟手；先确认小球已开启。', '点输入框打几个字，观察输入框有没有被键盘挡住。', '收起键盘，再拖动小球，观察位置和跟手是否恢复。']],
};
function updateCaptureInstructions() {
    const controls=document.getElementById('ilg-interaction-diagnostics');if(!controls)return;
    const scenario=controls.querySelector('select').value;
    controls.querySelector('#ilg-capture-steps').replaceChildren(...CAPTURE_SCENARIOS[scenario][1].map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
}

function exportCompatibilityDiagnostic() {
    if(interactionDiagnostics.status().recording)interactionDiagnostics.stop('exported');
    const text=iosTrialReport()+'\n\n'+cardDisplayReport({includeCapture:false});
    const field=document.getElementById('ilg-opt-iosReport');if(field)field.value=text;
    downloadDiagnostic(text);
}
function captureBadge() {
    let badge=document.getElementById('ilg-capture-badge');if(badge)return badge;
    badge=document.createElement('aside');badge.id='ilg-capture-badge';badge.setAttribute('aria-label','交互诊断采集');
    badge.innerHTML='<span role="status" aria-live="polite"></span><button type="button" data-action="main">提前结束</button><button type="button" data-action="close" aria-label="收起采集提示" hidden>×</button>';
    badge.querySelector('[data-action="main"]').addEventListener('click',()=>{if(interactionDiagnostics.status().recording)interactionDiagnostics.stop('manual');else exportCompatibilityDiagnostic();});
    badge.querySelector('[data-action="close"]').addEventListener('click',()=>badge.remove());document.body.append(badge);return badge;
}
const interactionDiagnostics=createInteractionDiagnostics({snapshot:viewportDiagnostic,onProgress(progress){
    const badge=captureBadge();badge.querySelector('span').textContent='采集中 · '+Math.ceil(progress.remainingMs/1000)+' 秒';badge.querySelector('[data-action="main"]').textContent='提前结束';badge.querySelector('[data-action="close"]').hidden=true;
},onFinish(result){
    const missing=result.coverage.missing.length;
    const labels={optionsMenu:'打开加号菜单',extensionsMenu:'打开魔法棒菜单',chatScroll:'滚动聊天',ballDrag:'拖动小球',composerInput:'输入文字',visualViewportChange:'视口变化',appearanceAttempt:'外观切换'};
    const reason=result.quality.fullDuration?'15 秒采集完成':({manual:'已手动提前结束',hidden:'切到后台，采集已中断',pagehide:'离开页面，采集已中断',disabled:'美化已关闭，采集已停止',exported:'已在导出时提前结束'}[result.reason]||'采集已提前结束');
    const text=reason+'（实际 '+(result.durationMs/1000).toFixed(1)+' 秒）。'+(missing?'未记录到：'+result.coverage.missing.map(key=>labels[key]||key).join('、')+'。建议按上方步骤重新采集；如果已复现问题，也可导出这次结果。':'点击屏幕提示条的“导出诊断”，把下载的 TXT 文件发回即可。');
    const scenario=document.getElementById('ilg-capture-scenario');if(scenario)scenario.disabled=false;
    const status=document.getElementById('ilg-capture-state');if(status)status.textContent=text;
    const button=document.getElementById('ilg-capture-start');if(button)button.textContent='重新采集 15 秒';
    const badge=captureBadge();badge.querySelector('span').textContent=missing?'采集结束 · 有未测操作':'采集结束';badge.querySelector('[data-action="main"]').textContent='导出诊断';badge.querySelector('[data-action="close"]').hidden=false;
}});

function describeFlickerState(nodeNumber, sizeOf, intersectionOf) {
    function surface(el, it) {
        const plane = it?.backdrop || el;
        return {node:nodeNumber(el), path:it?.renderPath || 'untracked', filter:filterFamily(plane.style),
            size:sizeOf(el) || null, layer:it?.backdropClip ? 'clipped-plane' : it?.backdrop ? 'separate-plane' : 'root'};
    }
    const messages = [], poses = [];
    for (const el of visibleItems) {
        const it = items.get(el);
        if (!el.isConnected || it.kind !== 'mes') continue;
        const card = el.classList.contains('ilg-card-renderer'), view = intersectionOf(el) || 'unmeasured';
        poses.push({el,it,card,view});
        if (poses.length === 24) break;
    }
    // Prefer messages actually intersecting the chat and authored / large surfaces.
    const priority = row => (row.view === 'visible' ? 4 : 0) + (row.card ? 2 : 0) + (row.it.largeWebView ? 1 : 0);
    poses.sort((a,b) => priority(b) - priority(a));
    for (const {el,it,card,view} of poses.slice(0,6)) {
        messages.push({...surface(el,it), lastIntersection:view, guarded:!!it.largeWebView, card,
            presetSplit:innerWidth >= 600 && card && el.classList.contains('ilg-message-viewport'),
            fixedChild:el.classList.contains('ilg-content-overlay'), culled:el.classList.contains('ilg-render-away'),
            iframe:!!el.querySelector('.mes_text iframe'), hidden:el.hidden || el.style.display === 'none'});
    }
    const controls = {};
    for (const [key,id] of [['composer','nonQRFormItems'],['input','ilg-composer-input-glass'],['plus','ilg-composer-plus-glass'],['bar','top-bar']]) {
        const el = document.getElementById(id);
        if (el) controls[key] = surface(el,items.get(el));
    }
    return {chat:{children:chatEl.childElementCount, size:sizeOf(chatEl) || null, bubble:document.body.classList.contains('bubblechat'),
            noBlur:document.body.classList.contains('no-blur'), home:homeOn, owner:externalMessageRendering(chatEl) ? 'baibai' : 'nvwa',
            externalScroll:externalScrollControl(chatEl), readingAnchor:readingAnchor.status()},
        formSize:sizeOf(form) || null, fontsLoading:document.fonts?.status === 'loading', messages, controls};
}
function startFlickerCapture() {
    const badge = document.createElement('aside');
    badge.id = 'ilg-flicker-badge'; badge.setAttribute('aria-label', '内屏闪烁对照');
    badge.innerHTML = '<span role="status" aria-live="polite">① 首次进入并滑动</span><div><button type="button" data-action="mark">刚才闪了</button><button type="button" data-action="next">② 去重进</button><button type="button" data-action="export">导出</button><button type="button" data-action="dismiss" aria-label="关闭诊断提示" hidden>×</button></div>';
    const label = badge.querySelector('span');
    const button = name => badge.querySelector('[data-action="'+name+'"]');
    flickerReport = null;
    const ownPath = new URL('.',import.meta.url).pathname;
    flickerCapture = createFlickerCapture({chat:chatEl, form, describe:describeFlickerState, currentChat:() => ctx.getCurrentChatId(),
        scriptOwner(source) {
            if (!source) return 'unknown';
            let url;
            try { url = new URL(source,location.href); } catch { return 'unknown'; }
            if (url.origin !== location.origin) return 'external';
            if (url.pathname.startsWith(ownPath)) return 'nvwa';
            const extension = /^\/scripts\/extensions\/third-party\/([^/]+)\//.exec(url.pathname);
            if (extension) return /^st-baibai-tools$/i.test(extension[1]) ? 'baibai' : 'other-extension';
            return /^\/(?:script\.js$|scripts\/|lib\/)/.test(url.pathname) ? 'host' : 'unknown';
        },
        environment:{version:BUILD_VERSION, android:androidHost, webview:androidWebView,
            edgeAndroid:/\bEdgA\//.test(ua), browserMajor:Number(ua.match(/\b(?:EdgA|Chrome)\/(\d+)/)?.[1]) || null,
            floating:!!S.float, refraction:!!S.refract, messageRefraction:!!S.refractMes, cssGlass:cssGlassActive(),
            physical:S.engine === 'physical', clearChat:S.chatBackground === 'transparent'},
        onFinish(report) {
            flickerReport = report; flickerCapture = null;
            label.textContent = report.coverage[1]?.scrolled ? '对照已结束'
                : report.coverage[0].scrolled ? '首进采集已结束 · 可导出' : '采集已结束 · 未记录到聊天滑动';
            button('mark').hidden = button('next').hidden = true;
            button('dismiss').hidden = false;
        }});
    button('mark').addEventListener('click', () => {
        if (!flickerCapture) return;
        flickerCapture.mark(); button('mark').textContent = '已标记 · 再闪可点';
    });
    button('next').addEventListener('click', () => {
        if (!flickerCapture?.next()) return;
        label.textContent = '② 返回后重进同一聊天';
        button('next').hidden = true; button('mark').textContent = '刚才闪了';
    });
    button('export').addEventListener('click', () => {
        flickerCapture?.finish();
        if (flickerReport) downloadDiagnostic(JSON.stringify(flickerReport,null,2), '内屏闪烁对照');
    });
    button('dismiss').addEventListener('click', () => { badge.remove(); flickerReport = null; });
    document.body.append(badge);
}
function createFlickerControls() {
    const controls = document.createElement('div');
    controls.id = 'ilg-flicker-controls';
    controls.innerHTML = '<p>用折叠机内屏采集。点击后会刷新本页；不会改玻璃设置。若有未发送的文字，先自行保存。</p><ol id="ilg-flicker-steps"><li>刷新后第一次打开问题聊天并滑动；若自动进入，直接滑动。看到闪就点「刚才闪了」。</li><li>只测首次进入，可以直接导出；若要对照，再点「② 去重进」，返回并重开同一聊天滑动。</li><li>点「导出」，发送这份 TXT。两轮合计最多 60 秒。若方便，可在开始前打开系统录屏。</li></ol><button type="button" id="ilg-flicker-start" aria-describedby="ilg-flicker-steps ilg-flicker-hint">刷新并采集首进 / 重进</button><p id="ilg-flicker-hint" role="status">只记时间、尺寸与绘制状态，不采集正文、聊天标识、链接或画面。</p>';
    controls.querySelector('button').addEventListener('click', () => {
        if (flickerCapture || interactionDiagnostics.status().recording || !S.enabled) {
            controls.querySelector('#ilg-flicker-hint').textContent = S.enabled ? '请先结束正在进行的采集。' : '请先开启液态玻璃，再开始对照。';
            return;
        }
        if (!armFlickerCapture(window)) controls.querySelector('#ilg-flicker-hint').textContent = '浏览器禁止页面暂存，无法跨刷新开始采集。';
    });
    return controls;
}

function iosTrialReport() {
    const rows = [
        'NVWA 液态玻璃 ' + BUILD_VERSION + ' · 兼容诊断',
        'UA: ' + navigator.userAgent,
        '平台 / 触摸点: ' + navigator.platform + ' / ' + navigator.maxTouchPoints,
        '视口 / DPR: ' + innerWidth + ' × ' + innerHeight + ' / ' + devicePixelRatio,
        '环境适配: ' + (S.compatibilityMode === 'blur' ? '澄卿 · 通用仿液态玻璃（CSS）' : '随境 · 自动'),
        'iOS 识别: ' + isIOS,
        'TT 宿主平台: ' + (window.__TAURITAVERN_HOST__?.platform || '未识别到 TT 平台接口'),
        'iOS 兼容玻璃 / 当前生效: ' + !!S.iosMaterial + ' / ' + iosMaterialActive(),
        '标准 / WebKit SVG URL 语法（非渲染证明）: ' + supportsFilter('url(#ilg-ios-probe)') + ' / ' + supportsPrefixedFilter('url(#ilg-ios-probe)'),
        '美化 / 折射 / iOS 实验: ' + !!S.enabled + ' / ' + !!S.refract + ' / ' + !!S.iosSvgTrial,
        '关闭模糊 / 气泡 / 浅色: ' + document.body.classList.contains('no-blur') + ' / ' + document.body.classList.contains('bubblechat') + ' / ' + root.classList.contains('ilg-light'),
        '引擎: ' + S.engine,
        '性能引擎: ' + ENGINE_NAMES.performance,
        '折射引擎: ' + ENGINE_NAMES.refraction,
        '界面轮廓计算: ' + JSON.stringify(reflections.status()),
        '消息渲染: ' + JSON.stringify(messageRendering.status()),
        '悬浮球计算: ' + JSON.stringify((({mode, reason, suspended, active, pending, workerFrames, syncFrames, coalesced, failures, cacheEntries}) => ({mode, reason, suspended, active, pending, workerFrames, syncFrames, coalesced, failures, cacheEntries}))(ballGlass.status())),
        '配套壁纸恢复: ' + JSON.stringify(bundledWallpapers.status()),
        '视口与键盘: ' + JSON.stringify(viewportDiagnostic()),
        '短时交互采集: ' + JSON.stringify(interactionDiagnostics.report()),
        '控件材质: ' + S.glassStyle,
        'Web 预设: ' + WEB_PRESETS[S.webPreset].label,
        '状态: ' + statusText(),
        '消息玻璃: ' + (document.body.classList.contains('bubblechat') ? '按气泡消息及背景设置绘制' : '未使用气泡样式；不影响顶栏和输入框'),
    ];
    for (const id of ['nonQRFormItems', 'ilg-floor']) {
        const el = document.getElementById(id);
        rows.push(id + ': ' + (el ? el.offsetWidth + ' × ' + el.offsetHeight
            + '; 标准=' + getComputedStyle(el).getPropertyValue('backdrop-filter')
            + '; WebKit=' + getComputedStyle(el).getPropertyValue('-webkit-backdrop-filter')
            + '; 兼容边缘=' + getComputedStyle(el, '::before').getPropertyValue('content') : '未找到'));
    }
    rows.push('真实背景折射: ' + (iosMaterialActive() ? '兼容材质不做像素位移；不可记为真实折射成功。' : '未确认，需用背景格线位移对照。'));
    rows.push('TT 构建号: 请附上关于页版本；UA 与 CSS 语法无法代替版本和实机画面。');
    return rows.join('\n');
}

function buildPanel() {
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!host) return;
    const wrap = document.createElement('div');
    wrap.className = 'ilg-settings';
    wrap.innerHTML = `
<div class="inline-drawer">
  <div class="inline-drawer-toggle inline-drawer-header">
    <b>NVWA 液态玻璃</b>
    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
  </div>
  <div class="inline-drawer-content">
    <div class="ilg-status" id="ilg-status" role="status"></div>
    <p class="ilg-status" id="ilg-opt-themeStatus" role="status"></p>
    <p class="ilg-hint" id="ilg-compat-hint"></p>
    <div id="ilg-opt-iosReportWrap" hidden>
      <button type="button" class="menu_button" id="ilg-opt-iosReportCopy">复制 iOS 测试记录</button>
      <textarea id="ilg-opt-iosReport" readonly hidden aria-label="iOS 测试记录"></textarea>
    </div>
    <div class="ilg-row"><label for="ilg-opt-compatibilityMode"><span>玻璃效果</span></label>
      <select id="ilg-opt-compatibilityMode" class="text_pole" aria-describedby="ilg-compat-hint">
        <option value="auto">随境 · 自动适配（推荐）</option>
        <option value="blur">澄卿 · 轻量 CSS 玻璃</option>
      </select></div>
    <div id="ilg-ios-material-setting" hidden><label class="checkbox_label" for="ilg-opt-iosMaterial"><input type="checkbox" id="ilg-opt-iosMaterial"><span>iOS 兼容玻璃（推荐）</span></label><p class="ilg-hint">为顶栏、输入框与楼层提示添加边缘光感，使用系统模糊，不依赖 SVG 折射。关闭可恢复基础模糊。</p></div>
    ${TOGGLES.filter(([k]) => k !== 'iosSvgTrial' && k !== 'iosMaterial').map(([k, label]) => `<label class="checkbox_label" for="ilg-opt-${k}"><input type="checkbox" id="ilg-opt-${k}"><span>${label}</span></label>`).join('')}
    <div class="ilg-row"><label for="ilg-opt-chatBackground"><span>聊天背景</span></label>
      <select id="ilg-opt-chatBackground" class="text_pole" aria-describedby="ilg-chat-background-hint">
        <option value="glass">柔光玻璃（阅读滤镜）</option>
        <option value="transparent">透明玻璃（保留边缘与圆角）</option>
      </select>
      <p class="ilg-hint" id="ilg-chat-background-hint">柔光档只在每条消息框内柔化背景，框外壁纸保持原样；透明档保留原图与玻璃边缘。卡片按原样显示。</p>
    </div>
    <div class="ilg-row ilg-reading-filter-row">
      <label for="ilg-opt-chatVeil"><span>消息背景滤镜强度</span><output id="ilg-opt-chatVeil-v" for="ilg-opt-chatVeil">45%</output></label>
      <input type="range" id="ilg-opt-chatVeil" min="0" max="100" step="1" aria-describedby="ilg-chat-background-hint">
    </div>
    <div class="ilg-row">
      <button type="button" id="ilg-card-report-copy" class="menu_button">复制卡片显示诊断</button>
      <p class="ilg-hint" id="ilg-card-report-hint" role="status">TT 卡片仍有透明异常时，在出问题的聊天里复制。不含聊天正文、角色名和链接地址。</p>
      <textarea id="ilg-card-report" class="text_pole" rows="8" readonly hidden aria-label="卡片显示诊断记录" aria-describedby="ilg-card-report-hint"></textarea>
    </div>
    <div class="ilg-row ilg-chat-font-row">
      <label for="ilg-opt-chatFontSize"><span>聊天正文字号</span><output id="ilg-opt-chatFontSize-v" for="ilg-opt-chatFontSize ilg-opt-chatFontSize-number">跟随酒馆</output></label>
      <div class="ilg-chat-font-controls">
        <input type="range" id="ilg-opt-chatFontSize" min="12" max="32" step="1" aria-describedby="ilg-chat-font-hint">
        <input type="number" id="ilg-opt-chatFontSize-number" class="text_pole" min="12" max="32" step="1" inputmode="numeric" aria-label="聊天正文字号，单位像素" aria-describedby="ilg-chat-font-hint">
        <button type="button" id="ilg-chat-font-reset" class="menu_button">跟随酒馆</button>
      </div>
      <p class="ilg-hint" id="ilg-chat-font-hint">12–32 像素，自动保存。只调整聊天正文；菜单、输入框及 iframe 内的字号不变，自带固定字号的卡片样式不强制改动。</p>
    </div>
    <div class="ilg-row"><label for="ilg-opt-homeName"><span>首页问候里的称呼</span></label>
      <input type="text" id="ilg-opt-homeName" class="text_pole" maxlength="20" placeholder="留空就只显示“晚上好”"></div>
    <div class="ilg-row"><label for="ilg-opt-tone"><span>明暗</span></label>
      <select id="ilg-opt-tone" class="text_pole">
        <option value="time">按时间（白天瓷白，晚上墨黑）</option>
        <option value="system">跟随系统深浅色</option>
        <option value="auto">按壁纸亮度（不自动换壁纸）</option>
        <option value="light">一直浅色（深色文字）</option>
        <option value="dark">一直深色（白色文字）</option>
      </select></div>
    <div class="ilg-row" data-tone="time"><label for="ilg-opt-dayStart"><span>白天时段</span></label>
      <span class="ilg-hours"><input type="number" id="ilg-opt-dayStart" class="text_pole" min="0" max="23" step="1" aria-label="白天从几点开始"> 点到
      <input type="number" id="ilg-opt-dayEnd" class="text_pole" min="1" max="24" step="1" aria-label="白天到几点结束"> 点</span></div>
    <div id="ilg-opt-topStyle" class="ilg-top-summary"><strong>折叠菜单</strong><p class="ilg-hint">设置收进左上角。可以再选最多两个常用入口，显示在顶栏左侧。</p></div>
    <div id="ilg-opt-topShortcuts" class="ilg-shortcut-picker">
      <div class="ilg-shortcut-preview" aria-hidden="true"><div class="ilg-shortcut-preview-start"><span class="ilg-shortcut-menu"><i></i><i></i></span><div class="ilg-shortcut-preview-left"></div></div><div class="ilg-shortcut-preview-end"><i></i><i></i><i></i></div></div>
      <div class="ilg-shortcut-heading"><span>常用入口</span><span class="ilg-shortcut-count">0 / 2</span></div>
      <div class="ilg-shortcut-grid" role="group" aria-label="选择最多两个顶栏入口" aria-describedby="ilg-top-shortcuts-hint"></div>
      <p id="ilg-top-shortcuts-hint" class="ilg-shortcut-status" role="status" aria-live="polite">点选图标，留在顶栏左侧；再次点选可取消。</p>
    </div>
    <div class="ilg-row"><label for="ilg-opt-avatar"><span>聊天头像</span></label>
      <select id="ilg-opt-avatar" class="text_pole">
        <option value="line">名片式：小头像放进名字那一行，正文占满气泡</option>
        <option value="side">经典：头像在左边单独一列</option>
      </select></div>
    <div class="ilg-row"><label for="ilg-opt-engine"><span>${ENGINE_NAMES.refraction}</span></label>
      <select id="ilg-opt-engine" class="text_pole">
        <option value="physical">新版：物理折射（实验）</option>
        <option value="legacy">旧版：之前一直用的这套</option>
      </select></div>
    <details class="ilg-fine-tuning" id="ilg-fine-tuning">
      <summary>玻璃细调参数<span class="ilg-hint">需要调整或试用 iOS 折射时展开</span></summary>
      <label class="checkbox_label" for="ilg-opt-iosSvgTrial"><input type="checkbox" id="ilg-opt-iosSvgTrial"><span>iOS WebKit SVG 折射实验（可能无效；关闭可回退）</span></label>
    <div data-engine="physical">
      <div class="ilg-sub">一键预设（从清到重，点完再用下面的滑块细调）</div>
      <div class="ilg-presets">${presetCards()}</div>
      <div class="ilg-row"><label for="ilg-opt-profile"><span>边缘截面</span></label>
        <select id="ilg-opt-profile" class="text_pole">
          <option value="lens">放大镜（边缘只放大，不扭曲）</option>
          <option value="squircle">超椭圆（苹果式，边上陡、里面平）</option>
          <option value="circle">正圆弧（最强的边缘弯折）</option>
          <option value="soft">缓坡（弯折更宽更柔）</option>
        </select></div>
    </div>
    ${SLIDERS.map(([k, label, min, max, step, , engine, prof]) => `<div class="ilg-row"${engine ? ` data-engine="${engine}"` : ''}${prof ? ` data-profile="${prof}"` : ''}><label for="ilg-opt-${k}"><span>${label}</span><output id="ilg-opt-${k}-v"></output></label><input type="range" id="ilg-opt-${k}" min="${min}" max="${max}" step="${step}"></div>`).join('')}
    <div class="ilg-hint">参数自动保存。新旧两套引擎的参数分开存，切回旧版就是原来的样子。关掉“启用液态玻璃美化”会撤去插件效果；恢复旧主题请手动选择安装前备份的主题。</div>

    </details>
    <div class="menu_button" id="ilg-reset" role="button" tabindex="0">恢复默认参数</div>
  </div>
</div>`;
    const bookmark = createAppearanceBookmark(DEFAULTS, SLIDERS);
    // Capture the current configuration once, before any trial edits in the settings UI.
    if (!Object.hasOwn(S, 'savedAppearance')) { S.savedAppearance = bookmark.capture(S, 'initial'); ctx.saveSettingsDebounced(); }
    const savedLook = document.createElement('div'); savedLook.id = 'ilg-opt-savedAppearance'; savedLook.className = 'ilg-saved-appearance';
    savedLook.innerHTML = '<p class="ilg-saved-summary">保存材质、文字、布局、小球与动态效果，试调后可以找回。</p><div class="ilg-saved-actions"><button type="button" id="ilg-opt-saveAppearance">保存当前外观</button><button type="button" id="ilg-opt-restoreAppearance">恢复已存外观</button><button type="button" id="ilg-opt-undoAppearance" hidden>撤销这次恢复</button></div><p id="ilg-opt-savedAppearanceStatus" role="status" aria-live="polite"></p>';
    wrap.querySelector('.inline-drawer-content').append(savedLook);
    let undoAppearance = null, bookmarkNotice = '';
    const saveLookButton = savedLook.querySelector('#ilg-opt-saveAppearance'), restoreLookButton = savedLook.querySelector('#ilg-opt-restoreAppearance'), undoLookButton = savedLook.querySelector('#ilg-opt-undoAppearance');
    function syncSavedAppearance() {
        const patch = bookmark.read(S.savedAppearance), status = savedLook.querySelector('#ilg-opt-savedAppearanceStatus');
        restoreLookButton.disabled = !patch; undoLookButton.hidden = !undoAppearance;
        if (!patch) { status.textContent = '存档暂不可用，可以重新保存当前外观。'; return; }
        const date = new Intl.DateTimeFormat('zh-CN', {year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(S.savedAppearance.savedAt));
        const origin = S.savedAppearance.source === 'initial' ? '已保留初始外观' : '已保存外观';
        status.textContent = bookmarkNotice || origin + ' · ' + date + (bookmark.same(S, patch) ? ' · 正在使用' : ' · 当前有调整');
    }
    for (const type of ['input','change']) wrap.addEventListener(type, () => {
        bookmarkNotice = ''; undoAppearance = null; queueMicrotask(syncSavedAppearance);
    });
    function applySavedAppearance(patch) {
        Object.assign(S, patch); normalizeTopStyleSettings(S); clearAll(); applyRoot(); typographyStudio.sync({reset:true}); syncAppearancePanel(); sync(); queueCards(true); ctx.saveSettingsDebounced();
    }
    saveLookButton.addEventListener('click', () => {
        S.savedAppearance = bookmark.capture(S); undoAppearance = null; bookmarkNotice = ''; syncSavedAppearance(); ctx.saveSettingsDebounced();
    });
    restoreLookButton.addEventListener('click', () => {
        const patch = bookmark.read(S.savedAppearance); if (!patch) return;
        if (bookmark.same(S, patch)) { bookmarkNotice = '当前已是存档中的外观。'; syncSavedAppearance(); return; }
        undoAppearance = bookmark.capture(S); bookmarkNotice = '已恢复外观，需要时可以撤销这次恢复。'; applySavedAppearance(patch);
    });
    undoLookButton.addEventListener('click', () => {
        const patch = bookmark.read(undoAppearance); if (!patch) return;
        undoAppearance = null; bookmarkNotice = '已回到恢复前的外观，存档仍保留。'; applySavedAppearance(patch);
    });
    const tiltControls = document.createElement('div');
    tiltControls.id = 'ilg-tilt-controls'; tiltControls.className = 'ilg-tilt-controls';
    tiltControls.innerHTML = '<button type="button" id="ilg-tilt-calibrate">以当前握姿居中</button><p id="ilg-tilt-state" role="status" aria-live="polite"></p><p class="ilg-tilt-hint">开启即自动申请，之后自动恢复；轻微倾斜只改变边缘反光；文字与玻璃位置保持稳定。</p>';
    wrap.querySelector('.inline-drawer-content').append(tiltControls);
    tiltControls.querySelector('#ilg-tilt-state').textContent = lighting.status();
    tiltControls.querySelector('#ilg-tilt-calibrate').addEventListener('click', requestMobileTilt);
    const captureControls=document.createElement('div');captureControls.id='ilg-interaction-diagnostics';captureControls.className='ilg-tilt-controls';
    captureControls.innerHTML='<label for="ilg-capture-scenario">这次要复测什么？</label><select id="ilg-capture-scenario" class="text_pole">'+Object.entries(CAPTURE_SCENARIOS).map(([key,[label]])=>'<option value="'+key+'">'+label+'</option>').join('')+'</select><p class="ilg-capture-instruction-title">点击开始后，回到聊天按顺序操作：</p><ol id="ilg-capture-steps"></ol><p class="ilg-capture-export-help">采集中请留在酒馆页面，不要刷新或切后台。15 秒后自动结束，点击屏幕提示条的“导出诊断”，把下载的 TXT 发回即可。</p><button type="button" id="ilg-capture-start" aria-describedby="ilg-capture-steps ilg-capture-state">开始 15 秒采集</button><p id="ilg-capture-state" role="status" aria-live="polite">准备好后点击开始，设置面板会自动收起。想采满 15 秒，请不要重复点击“提前结束”。</p><p class="ilg-capture-privacy">仅手动采集，不记录聊天正文、输入内容或私人壁纸地址，不自动上传。</p>';
    captureControls.querySelector('select').addEventListener('change',updateCaptureInstructions);
    captureControls.querySelector('button').addEventListener('click',()=>{
        if(interactionDiagnostics.status().recording){interactionDiagnostics.stop('manual');return;}
        if(!S.enabled || flickerCapture)return;
        if(interactionDiagnostics.start({scenario:captureControls.querySelector('select').value})){
            captureControls.querySelector('select').disabled=true;
            captureControls.querySelector('button').textContent='提前结束采集';
            captureControls.querySelector('#ilg-capture-state').textContent='正在采集。请按上方步骤操作，15 秒后自动结束；结束后点击屏幕提示条的“导出诊断”。';
            studioUI?.close(false);
        }
    });
    wrap.querySelector('.inline-drawer-content').append(createFlickerControls(), captureControls);
    typographyStudio.ui.addEventListener('ilg-type-applied', () => { bookmarkNotice = ''; undoAppearance = null; syncSavedAppearance(); });
    studioUI = createSettingsPanel({ host, content: wrap, appearance: appearancePanel, typography: typographyStudio.ui, version: BUILD_VERSION, settings: S, engines: ENGINE_NAMES });
    updateCaptureInstructions();

    document.getElementById('ilg-opt-iosReportCopy').textContent = '导出兼容诊断 TXT';
    document.getElementById('ilg-opt-iosReportCopy').addEventListener('click', exportCompatibilityDiagnostic);
    document.getElementById('ilg-card-report-copy').textContent = '导出卡片显示诊断 TXT';
    document.getElementById('ilg-card-report-copy').addEventListener('click', () => {
        const text = cardDisplayReport();
        document.getElementById('ilg-card-report').value = text;
        downloadDiagnostic(text, '卡片显示诊断');
        document.getElementById('ilg-card-report-hint').textContent = '诊断已导出为 TXT，可发给维护者。';
    });

    // 当前数值正好等于某一档预设时，那个按钮显示为按下
    const markPresets = () => wrap.querySelectorAll('[data-preset]').forEach(b => {
        const p = PRESETS[b.dataset.preset][1];
        b.setAttribute('aria-pressed', String(Object.keys(p).every(k => S[k] === p[k] || Math.abs(S[k] - p[k]) < 1e-6)));
    });
    const fontRange = document.getElementById('ilg-opt-chatFontSize');
    const fontNumber = document.getElementById('ilg-opt-chatFontSize-number');
    const syncChatFont = () => {
        const size = S.chatFontSize;
        const inherited = parseFloat(getComputedStyle(chatEl).getPropertyValue('--mainFontSize')) || 16;
        fontRange.value = size || Math.min(32, Math.max(12, Math.round(inherited)));
        fontNumber.value = size || '';
        fontNumber.placeholder = '自动';
        document.getElementById('ilg-opt-chatFontSize-v').textContent = size ? size + ' px' : '跟随酒馆';
        fontRange.setAttribute('aria-valuetext', size ? size + ' 像素' : '跟随酒馆');
    };
    const saveChatFont = value => {
        S.chatFontSize = value;
        applyChatFontSize();
        typographyStudio.sync();
        syncChatFont();
        ctx.saveSettingsDebounced();
    };
    fontRange.addEventListener('input', () => saveChatFont(Number(fontRange.value)));
    fontNumber.addEventListener('change', () => {
        if (fontNumber.value.trim() === '') { saveChatFont(0); return; }
        const value = Number(fontNumber.value);
        if (!Number.isFinite(value)) { syncChatFont(); return; }
        saveChatFont(Math.min(32, Math.max(12, Math.round(value))));
    });
    document.getElementById('ilg-chat-font-reset').addEventListener('click', () => saveChatFont(0));
    const veilRange = document.getElementById('ilg-opt-chatVeil');
    const syncChatVeil = () => {
        veilRange.value = S.chatVeil;
        document.getElementById('ilg-opt-chatVeil-v').textContent = S.chatVeil + '%';
        veilRange.setAttribute('aria-valuetext', S.chatVeil === 0 ? '关闭背景滤镜' : S.chatVeil + '%');
        veilRange.disabled = S.chatBackground === 'transparent';
        veilRange.closest('.ilg-row').hidden = veilRange.disabled;
    };
    veilRange.addEventListener('input', () => {
        S.chatVeil = normalizeChatVeil(Number(veilRange.value));
        applySurfaceSettings(); syncChatVeil(); scheduleAdapt(); ctx.saveSettingsDebounced();
    });
    const sync = () => {
        syncChatVeil();
        syncChatFont();
        document.getElementById('ilg-opt-chatBackground').value = S.chatBackground;
        TOGGLES.forEach(([k]) => { document.getElementById(`ilg-opt-${k}`).checked = !!S[k]; });
        // 小球关着时，吸边 / 融合两个子开关变灰
        ['ballSnap', 'ballFuse'].forEach(k => { const i = document.getElementById(`ilg-opt-${k}`); i.disabled = !S.floatBall; i.closest('label')?.classList.toggle('ilg-row-off', !S.floatBall); });
        syncTopShortcuts();
        SLIDERS.forEach(([k, , , , step, unit]) => {
            document.getElementById(`ilg-opt-${k}`).value = S[k];
            document.getElementById(`ilg-opt-${k}-v`).textContent = fmt(step, unit, S[k]);
        });
        // 这里的 .value 是脚本直接改的，不会触发 input 事件，所以蓝色进度条要自己重画一遍。
        // 少了这一步，点“一键预设”或“恢复默认”之后圆点会跳到新位置，蓝条还停在上一次的进度上。
        wrap.querySelectorAll('input[type="range"]').forEach(paintRange);
        document.getElementById('ilg-opt-tone').value = S.tone;
        document.getElementById('ilg-opt-dayStart').value = S.dayStart;
        document.getElementById('ilg-opt-dayEnd').value = S.dayEnd;
        wrap.querySelectorAll('[data-tone]').forEach(n => { n.hidden = n.dataset.tone !== S.tone; });
        document.getElementById('ilg-opt-engine').value = S.engine;
        document.getElementById('ilg-opt-avatar').value = S.avatar;
        document.getElementById('ilg-opt-profile').value = S.profile;
        document.getElementById('ilg-opt-homeName').value = S.homeName || '';
        wrap.querySelectorAll('[data-engine]').forEach(n => { n.hidden = n.dataset.engine !== S.engine; });
        // 放大镜截面不用厚度、折射率；物理折射截面不用放大倍数
        wrap.querySelectorAll('[data-profile]').forEach(n => {
            if (n.dataset.profile !== (S.profile === 'lens' ? 'lens' : 'snell')) n.hidden = true;
        });
        markPresets();
        const iosControl = document.getElementById('ilg-opt-iosSvgTrial');
        iosControl.closest('label').hidden = !isIOS;
        iosControl.disabled = !iosSvgEligible;
        document.getElementById('ilg-opt-iosReportWrap').hidden = false;
        document.getElementById('ilg-ios-material-setting').hidden = !isIOS;
        document.getElementById('ilg-opt-compatibilityMode').value = S.compatibilityMode === 'blur' ? 'blur' : 'auto';
        document.getElementById('ilg-compat-hint').textContent = compatibilityHint();
        document.getElementById('ilg-status').textContent = statusText();
        refreshCompanionTheme();
        studioUI?.sync();
        syncSavedAppearance();
    };
    document.getElementById('ilg-opt-chatBackground').addEventListener('change', e => {
        if (!['glass', 'transparent'].includes(e.target.value)) { sync(); return; }
        S.chatBackground = e.target.value;
        syncChatVeil();
        applySurfaceSettings();
        scheduleAdapt();
        repaintAll();
        ctx.saveSettingsDebounced();
    });
    document.getElementById('ilg-opt-compatibilityMode').addEventListener('change', e => {
        if (!['auto', 'blur'].includes(e.target.value)) { sync(); return; }
        S.compatibilityMode = e.target.value;
        clearAll(); applyRoot(); sync(); ctx.saveSettingsDebounced();
    });
    document.getElementById('ilg-opt-tone').addEventListener('change', e => {
        S.tone = e.target.value;
        toneOverride = null;
        wrap.querySelectorAll('[data-tone]').forEach(n => { n.hidden = n.dataset.tone !== S.tone; });
        applyTone(); ctx.saveSettingsDebounced();
    });
    ['dayStart', 'dayEnd'].forEach(k => document.getElementById(`ilg-opt-${k}`).addEventListener('change', e => {
        const v = Math.round(Number(e.target.value));
        if (!Number.isFinite(v) || e.target.value === '') { e.target.value = S[k]; return; }
        S[k] = k === 'dayStart' ? Math.min(23, Math.max(0, v)) : Math.min(24, Math.max(1, v));
        // 开始不能晚于结束，否则整天都算晚上
        if (S.dayStart >= S.dayEnd) {
            if (k === 'dayStart') S.dayEnd = S.dayStart + 1; else S.dayStart = S.dayEnd - 1;
        }
        document.getElementById('ilg-opt-dayStart').value = S.dayStart;
        document.getElementById('ilg-opt-dayEnd').value = S.dayEnd;
        toneOverride = null;
        followTone(); ctx.saveSettingsDebounced();
    }));
    document.getElementById('ilg-opt-avatar').addEventListener('change', e => {
        S.avatar = e.target.value;
        applyRoot(); ctx.saveSettingsDebounced();
    });
    document.getElementById('ilg-opt-engine').addEventListener('change', e => {
        S.engine = e.target.value;
        clearAll(); applyRoot(); sync(); ctx.saveSettingsDebounced();
    });
    document.getElementById('ilg-opt-profile').addEventListener('change', e => {
        S.profile = e.target.value;
        queueGlassSettings(); sync(); ctx.saveSettingsDebounced();
    });
    document.getElementById('ilg-opt-homeName').addEventListener('input', e => {
        S.homeName = e.target.value;
        paintGreeting(); ctx.saveSettingsDebounced();
    });
    wrap.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
        Object.assign(S, PRESETS[b.dataset.preset][1]);
        queueGlassSettings(); sync(); ctx.saveSettingsDebounced();
    }));
    document.getElementById('ilg-opt-topShortcuts').addEventListener('click', e => {
        const button = e.target.closest('.ilg-shortcut-tile');
        if (!button) return;
        const id = button.dataset.shortcutId;
        const selected = [S.topShortcut1, S.topShortcut2].filter(Boolean);
        const index = selected.indexOf(id);
        if (index >= 0) selected.splice(index, 1);
        else {
            if (!topShortcutChoices().some(c => c.id === id)) return;
            if (selected.length === 2) {
                document.querySelector('#ilg-opt-topShortcuts .ilg-shortcut-status').textContent = '最多选择两个；先点一下已选图标，把位置空出来。';
                return;
            }
            selected.push(id);
        }
        [S.topShortcut1, S.topShortcut2] = [selected[0] || '', selected[1] || ''];
        normalizeTopStyleSettings(S);
        closeFoldMenu(); applyFold(); layoutIslands(); sync(); ctx.saveSettingsDebounced();
    });
    TOGGLES.forEach(([k]) => document.getElementById(`ilg-opt-${k}`).addEventListener('change', e => {
        if (k === 'iosSvgTrial' && !iosSvgEligible) { e.target.checked = !!S[k]; return; }
        S[k] = e.target.checked;
        if (k === 'mobileTilt') {
            if (S.mobileTilt) requestMobileTilt();
            else { syncMobileTilt(); ctx.saveSettingsDebounced(); }
            return;
        }
        if (k === 'firstLineIndent') {
            root.classList.toggle('ilg-indent', S.enabled && !!S.firstLineIndent);
            typographyStudio.sync();
            ctx.saveSettingsDebounced();
            return;
        }
        // Text alignment does not require rebuilding glass.
        if (k === 'justifyText') {
            root.classList.toggle('ilg-justify', S.enabled && !!S.justifyText);
            typographyStudio.sync();
            ctx.saveSettingsDebounced();
            return;
        }
        // 面板加厚：只改根节点 class 和面板模糊，重画一遍面板就行
        if (k === 'panelRead') { root.classList.toggle('ilg-panel-read', S.enabled && S.panelRead); repaintAll(); ctx.saveSettingsDebounced(); return; }
        if (!S.enabled || k === 'iosSvgTrial' || k === 'enabled' || k === 'refract' || k === 'refractMes' || k === 'islands' || k === 'fold') clearAll();
        applyRoot(); sync(); ctx.saveSettingsDebounced();
    }));
    SLIDERS.forEach(([k, , , , step, unit]) => document.getElementById(`ilg-opt-${k}`).addEventListener('input', e => {
        S[k] = parseFloat(e.target.value);
        document.getElementById(`ilg-opt-${k}-v`).textContent = fmt(step, unit, S[k]);
        queueGlassSettings(); markPresets(); ctx.saveSettingsDebounced();
    }));
    const reset = () => {
        // 只重置本扩展的外观参数，保留原主题备份和首次清理记录。
        const retained = Object.fromEntries(['cssReset', 'cssCleaned', 'cssBackup', 'cssBackupAt', 'lookBackup', 'themeBackup']
            .map(k => [k, S[k]]));
        Object.assign(S, DEFAULTS, retained);
        clearAll(); applyRoot(); typographyStudio.sync({reset:true}); syncAppearancePanel(); sync(); ctx.saveSettingsDebounced();
    };
    const btn = document.getElementById('ilg-reset');
    btn.addEventListener('click', reset);
    btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reset(); } });

    sync();

}

// Top controls sample visible card surfaces first, then the cached wallpaper crop.
const isTopSurface = bar => bar.id === 'top-bar' || bar.id === 'ilg-floor' || bar.classList.contains('ilg-island');
function readWallpaperBackdrop() {
    if (!currentWallpaperSample) return null;
    for (const id of ['bg_custom','bg1']) {
        const el = document.getElementById(id); if (!el) continue;
        const cs = getComputedStyle(el);
        const match = /url\(["']?(.*?)["']?\)/.exec(el.style.backgroundImage || cs.backgroundImage || '');
        if (!match || match[1] !== currentWallpaperSample.url || cs.display === 'none' || +cs.opacity < .98) continue;
        const layout = wallpaperLayout(currentWallpaperSample.raster, el.getBoundingClientRect(), cs.backgroundSize, cs.backgroundPosition);
        return layout;
    }
    return null;
}
function applyTopTone(el, appearance) {
    if (!appearance) { if (el.dataset?.ilgTopTone) delete el.dataset.ilgTopTone; return; }
    if (el.dataset.ilgTopTone !== appearance.tone) el.dataset.ilgTopTone = appearance.tone;
}
function topIconTones(bars, lumAt) {
    const result = [], noBlur = document.body.classList.contains('no-blur');
    for (const bar of bars) for (const wrapper of bar?.icons || []) {
        const icon = wrapper.querySelector('.drawer-icon'); if (!icon) continue;
        const r = icon.getBoundingClientRect();
        if (!r.width || !r.height) { result.push({el:wrapper,top:null}); continue; }
        if (noBlur) { result.push({el:wrapper,top:{tone:lightBg?'dark':'light'}}); continue; }
        const colors = []; let sum = 0, count = 0;
        for (const f of [.3,.7]) { const l = lumAt(r.left+r.width*f,r.top+r.height*.5,bar,c=>colors.push(c)); if (l !== null) {sum+=l;count++;} }
        result.push({el:wrapper,top:count?topTone(sum/count,wrapper.dataset.ilgTopTone,colors):null});
    }
    return result;
}
function clearTopTones() { document.querySelectorAll('[data-ilg-top-tone]').forEach(el => applyTopTone(el,null)); }
// A pass reads all surfaces before any tone writes. Reuse only within that pass:
// a subsequent sample must see new scroll positions, iframe geometry and authored colors.
function createBackdropSampler(wallpaper) {
    const surfaces = new WeakMap(), frameRects = new WeakMap(), chrome = new WeakMap();
    function surfaceColor(el) {
        let color = null, path = null;
        for (let n = el; n; n = n.parentElement) {
            const cached = surfaces.get(n);
            if (cached !== undefined) { color = cached; break; }
            if (n === document.body || n.id === 'chat' || n.id === 'sheld') break;
            const m = /rgba?\(([^)]+)\)/.exec(n.ownerDocument.defaultView.getComputedStyle(n).backgroundColor);
            if (m) {
                const [r, g, b, a = 1] = m[1].split(',').map(Number);
                if (!(a < .5)) {
                    color = { rgb:[r,g,b], luminance:(0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 };
                    surfaces.set(n,color);
                    break;
                }
            }
            (path ??= []).push(n);
        }
        if (path) for (const n of path) surfaces.set(n,color);
        return color;
    }
    function luminance(color, onColor) {
        if (!color) return null;
        onColor?.(color.rgb);
        return color.luminance;
    }
    return function lumAt(x, y, bar, onColor) {
        for (const el of document.elementsFromPoint(x, y)) {
            if (bar.contains(el)) continue;
            let isChrome = chrome.get(el);
            if (isChrome === undefined) {
                isChrome = !!el.closest('#top-bar, #top-settings-holder, #form_sheld');
                chrome.set(el,isChrome);
            }
            if (isChrome) continue;
            if (el.tagName === 'IFRAME') {
                let rect = frameRects.get(el);
                if (!rect) { rect = el.getBoundingClientRect(); frameRects.set(el,rect); }
                const inner = el.contentDocument?.elementFromPoint(x - rect.left, y - rect.top);
                // Cross-origin or empty frames remain unknown, never borrow an underlying card's color.
                return inner ? luminance(surfaceColor(inner),onColor) : null;
            }
            const color = surfaceColor(el);
            if (color) return luminance(color,onColor);
        }
        const point = isTopSurface(bar) ? wallpaperPoint(wallpaper,x,y) : null;
        if (point) onColor?.([point.r,point.g,point.b]);
        return point?.luminance ?? null;
    };
}
function backdropPassesThreshold(bar, r, xs, ys, lumAt, threshold, brighter, fallback) {
    let sum = 0, count = 0, remaining = xs.length * ys.length;
    for (const x of xs) for (const y of ys) {
        const sample = lumAt(r.left + r.width * x, r.top + r.height * y, bar);
        remaining--;
        if (sample !== null) { sum += sample; count++; }
        if (!count || !remaining) continue;
        // CSS RGB and wallpaper samples are in [0, 1]. Even if every unread
        // point is present and all-black/all-white, the decision may be fixed.
        // Null samples fall inside these bounds; close ties take the full pass.
        const worstCount = count + remaining;
        if (sum > (threshold + 1e-9) * worstCount) return brighter;
        if (sum + remaining < (threshold - 1e-9) * worstCount) return !brighter;
    }
    if (!count) return fallback;
    const avg = sum / count;
    return brighter ? avg > threshold : avg < threshold;
}
function adaptBar(bar, lumAt) {
    if (!bar || bar.hidden) return null;
    const top = isTopSurface(bar);
    if (top && bar.id !== 'ilg-floor') return {bar,light:false,dark:false,top:null};
    if (top && document.body.classList.contains('no-blur')) return { bar, light: false, dark: false, top: { tone: lightBg ? 'dark' : 'light' } };
    const r = bar.getBoundingClientRect();
    if (!top) {
        const contrasting = backdropPassesThreshold(bar, r, [.15, .38, .62, .85], [.35, .7], lumAt, lightBg ? .38 : .62, !lightBg, false);
        return { bar, light: !lightBg && contrasting, dark: lightBg && contrasting, top: null };
    }
    let sum = 0, n = 0;
    const colors = [];
    for (const f of [.2, .5, .8]) {
        const l = lumAt(r.left + r.width * f, r.top + r.height * .5, bar, c => colors.push(c));
        if (l !== null) { sum += l; n++; }
    }
    return { bar, light: false, dark: false, top: topTone(n ? sum / n : null, bar.dataset?.ilgTopTone, colors) };
}
// Each input action reads its own backdrop: a bright card in the text area must
// not turn icons over dark wallpaper dark as well. Unknown pixels use the page tone.
const INPUT_ACTIONS = '#leftSendForm > div, #rightSendForm > div:not(#mes_stop):not(.mes_stop):not(.stscript_btn)';
function inputActionTones(bar, lumAt) {
    if (!bar) return [];
    return [...bar.querySelectorAll(INPUT_ACTIONS)].map(el => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return { el, tone: null };
        if (document.body.classList.contains('no-blur')) return { el, tone: lightBg ? 'dark' : 'light' };
        const previous = el.dataset.ilgInputTone;
        // A small dead band keeps text/edge crossings from flickering between tones.
        const threshold = previous === 'dark' ? .46 : previous === 'light' ? .58 : .52;
        const darkInk = backdropPassesThreshold(bar, r, [.3, .5, .7], [.35, .65], lumAt, threshold, true, lightBg);
        return { el, tone: darkInk ? 'dark' : 'light' };
    });
}
// 合并滚动与流式输出的采样；最后一次请求仍会补采，先读完所有表面再更新样式。
const ADAPT_INTERVAL = 100;
let adaptRaf = 0, adaptTimer = 0, adaptLast = -Infinity;
// 滚动时 100ms 采一次；流式输出合并补采。按钮只量可见项，所有采样完成后再批量写入。
function scheduleAdapt(interval) {
    if (adaptRaf || adaptTimer || !S.enabled) return;
    // 流式输出时酒馆每吐一段字都会自动滚一下，按 100ms 采样就等于不停逼浏览器重算整页样式；
    // 生成期间顶栏下面的内容几乎不会突然变色，放宽到 1.2 秒一次，生成结束后的下一次滚动恢复正常节奏
    const gap = Math.max(typeof interval === 'number' ? interval : ADAPT_INTERVAL, document.body.dataset.generating === 'true' ? 1200 : 0);
    const queue = () => {
        adaptTimer = 0;
        adaptRaf = requestAnimationFrame(() => {
            adaptRaf = 0;
            if (!S.enabled) return;
            adaptLast = performance.now();
            const bars = S.islands && islands.length ? islands : [document.getElementById('top-bar')];
            const input = document.querySelector(PILL_SEL);
            const lumAt = createBackdropSampler(readWallpaperBackdrop());
            const floor = document.getElementById('ilg-floor');
            const samples = [...bars, ...(floor && !floor.hidden ? [floor] : []), input].map(bar => adaptBar(bar,lumAt));
            const actionTones = inputActionTones(input,lumAt), iconTones = topIconTones(bars,lumAt);
            for (const sample of samples) {
                if (!sample) continue;
                const { bar, light, dark, top } = sample;
                applyTopTone(bar, top);
                bar.classList.toggle('ilg-over-light', light);
                bar.classList.toggle('ilg-over-dark', dark);
                (bar.icons || []).forEach(d => d.classList.toggle('ilg-icon-over-light', light));
            }
            for (const { el, top } of iconTones) applyTopTone(el,top);
            for (const { el, tone } of actionTones) {
                if (tone === null) delete el.dataset.ilgInputTone;
                else if (el.dataset.ilgInputTone !== tone) el.dataset.ilgInputTone = tone;
            }
        });
    };
    const delay = Math.max(0, gap - (performance.now() - adaptLast));
    if (delay) adaptTimer = setTimeout(queue, delay);
    else queue();
}
chatEl.addEventListener('scroll', scheduleAdapt, { passive: true });
new MutationObserver(() => scheduleAdapt(600)).observe(chatEl, { childList: true, subtree: true });
onViewportChange(() => scheduleAdapt());

/* ---------- 楼层：顶栏中间显示「现在读到第几楼」 ----------
   编号用酒馆的 mesid（和 NVWA 记忆面板里的「第 N 楼」、召回里的楼层号是同一个数，从 0 起），
   所以记忆面板写「第 12 楼」，这里也是 12。跟着滚动走，显示的是屏幕最上面那一楼；点一下回最新。 */
const floorChip = document.createElement('div');
floorChip.id = 'ilg-floor';
floorChip.className = 'ilg-floor';
floorChip.setAttribute('role', 'button');
floorChip.tabIndex = 0;
floorChip.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); floorChip.click(); }
});
floorChip.title = '现在读到第几楼（和 NVWA 记忆里的 refs 同一个编号）。点一下回最新一楼';
floorChip.addEventListener('click', () => {
    const c = document.getElementById('chat');
    if (c) c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' });
});
let floorRaf = 0;
let floorHide = 0;
let floorMessages = [], floorDirty = true;
function flashFloor() {
    floorChip.classList.add('is-on');
    clearTimeout(floorHide);
    floorHide = setTimeout(() => floorChip.classList.remove('is-on'), 1600);
}
function visibleFloor() {
    const bar = document.getElementById('top-bar');
    const chat = document.getElementById('chat');
    if (floorDirty) {
        // 隐藏的楼层（首页、文档模式或插件隐藏）没有坐标，建表时一次筛掉，二分时就不必逐条回退
        floorMessages = chat ? [...chat.querySelectorAll('.mes[mesid]')].filter(m => m.getClientRects().length) : [];
        floorDirty = false;
    }
    const mes = floorMessages;
    if (!mes.length) return null;
    const last = Number(mes[mes.length - 1].getAttribute('mesid'));
    // 已经滚到底：直接显示最后一楼。
    if (chat && chat.scrollTop + chat.clientHeight >= chat.scrollHeight - 8) return last;
    // 全部铺开时，楼层占据栏下独立一行，按这行下方计算当前阅读位置。
    const barBottom = bar ? bar.getBoundingClientRect().bottom : 43;
    const top = (dockOn() && !floorChip.hidden ? Math.max(barBottom, floorChip.getBoundingClientRect().bottom) : barBottom) + 6;
    // 消息按楼层顺序纵向排列；二分定位第一条仍露在顶栏下方的消息。
    let low = 0, high = mes.length;
    while (low < high) {
        const mid = (low + high) >>> 1;
        const rect = mes[mid].getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
            // 建表后才被隐藏的楼层：这一次按原来的线性语义找，下一次重建表
            floorDirty = true;
            low = mes.findIndex(m => m.getBoundingClientRect().bottom > top);
            if (low < 0) low = mes.length - 1;
            break;
        }
        if (rect.bottom > top) high = mid;
        else low = mid + 1;
    }
    const cur = mes[Math.min(low, mes.length - 1)];
    const id = Number(cur.getAttribute('mesid'));
    return Number.isFinite(id) ? id : null;
}
function paintFloor() {
    floorRaf = 0;
    const bar = document.getElementById('top-bar');
    if (!bar) return;
    if (floorChip.parentElement !== bar) bar.appendChild(floorChip);
    // 与输入框共用 bar 材质，按各自几何尺寸生成贴图，不走通知 toast 的高模糊参数
    if (!S.enabled) { untrack(floorChip); floorChip.hidden = true; root.classList.remove('ilg-dock-floor'); return; }
    track(floorChip, 'bar');
    const id = visibleFloor();
    root.classList.toggle('ilg-dock-floor', dockOn() && id !== null);
    if (floorChip.hidden !== (id === null)) floorChip.hidden = id === null;
    if (id === null) return;
    const label = `第 ${id} 楼`;
    if (floorChip.textContent !== label) {
        floorChip.setAttribute('aria-label', `当前读到第 ${id} 楼，点击回到最新一楼`);
        floorChip.textContent = label;
        flashFloor();
    }
}
function scheduleFloor() { if (!floorRaf) floorRaf = requestAnimationFrame(paintFloor); }
// 滚动时才亮出来（1.6 秒后自己淡下去）：常驻会正好压在消息头上那行名字和日期上
chatEl.addEventListener('scroll', () => { scheduleFloor(); flashFloor(); }, { passive: true });
// 只看楼层增删和编号变化。以前连正文里的每个字也一起盯着，流式输出时每帧都要重新量一遍全部楼层（电脑上一次可达 2 秒）。
// 正文变长不会改变“最上面是第几楼”；真要变，滚动事件会补上。
const markFloors = () => { floorDirty = true; scheduleFloor(); };
new MutationObserver(markFloors).observe(chatEl, { childList: true });
new MutationObserver(markFloors).observe(chatEl, { subtree: true, attributes: true, attributeFilter: ['mesid'] });

onViewportChange(scheduleFloor);
scheduleFloor();

// 右上角提示：toastr 弹出时才创建容器、最后一条消失就删掉，所以盯着容器给每条提示挂上玻璃
const toastWatched = new WeakSet();
function watchToasts(box) {
    if (toastWatched.has(box)) return;
    toastWatched.add(box);
    const glass = n => { if (S.enabled && n.nodeType === 1 && n.classList.contains('toast')) track(n, 'toast'); };
    box.querySelectorAll(':scope > .toast').forEach(glass);
    new MutationObserver(muts => muts.forEach(m => {
        m.addedNodes.forEach(glass);
        m.removedNodes.forEach(n => n.nodeType === 1 && untrack(n));
    })).observe(box, { childList: true });
}
const existingToasts = document.getElementById('toast-container');
if (existingToasts) watchToasts(existingToasts);

const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = new URL('./fonts/fonts.css', import.meta.url).href;
document.head.appendChild(fontLink);

const iconLink = document.createElement('link');
iconLink.rel = 'stylesheet';
iconLink.href = new URL('./icons.css', import.meta.url).href;
document.head.appendChild(iconLink);

// Keep the filled track aligned with the native 20px thumb, including the workbench dialog.
const RANGE_THUMB = 20; // Match the CSS grip width; its height is independent.
const AUTHORED_CONTROL_SEL = '.mes_text, .mes_reasoning, .popup-content, dialog, .popup, [role="dialog"]:not(.ilg-recent), [role="alertdialog"], [data-nvwa-style="author"], #catgod-oracle-qrbar';
function ownsHostControl(el) {
    return !!el.closest('#ilg-studio') || !!el.closest(HOST_UI_SEL) && !el.closest(AUTHORED_CONTROL_SEL);
}
function paintRange(el) {
    if (!ownsHostControl(el)) return;
    const min = Number(el.min || 0), max = Number(el.max || 100), v = Number(el.value);
    const p = max > min ? Math.min(1, Math.max(0, (v - min) / (max - min))) : 0;
    const fill = `calc(${p.toFixed(4)} * (100% - ${RANGE_THUMB}px) + ${RANGE_THUMB / 2}px)`;
    if (el.style.getPropertyValue('--ilg-fill') !== fill) el.style.setProperty('--ilg-fill', fill);
}
const paintRanges = () => document.querySelectorAll('input[type="range"]').forEach(paintRange);

// One shared value label; geometry is read once on activation, never on drag updates.
const rangeValue = document.createElement('output');
rangeValue.id = 'ilg-range-value'; rangeValue.hidden = true;
rangeValue.setAttribute('aria-hidden', 'true'); rangeValue.setAttribute('popover', 'manual');
document.body.append(rangeValue);
let rangeValueInput = null, rangeValueGeometry = null, rangeValuePopover = false;
function hideRangeValue() {
    if (rangeValuePopover) { try { rangeValue.hidePopover(); } catch { /* The browser may already have closed it. */ } }
    rangeValue.hidden = true; rangeValueInput = null; rangeValueGeometry = null; rangeValuePopover = false;
}
function updateRangeValue(el) {
    if (rangeValueInput !== el || !rangeValueGeometry) return;
    const {rect, originX, originY} = rangeValueGeometry;
    const min = Number(el.min || 0), max = Number(el.max || 100);
    const ratio = max > min ? Math.max(0, Math.min(1, (Number(el.value) - min) / (max - min))) : 0;
    const x = Math.max(64, Math.min(innerWidth - 64, rect.left + RANGE_THUMB / 2 + ratio * (rect.width - RANGE_THUMB)));
    rangeValue.style.left = (x - originX) + 'px';
    const output = el.id && document.getElementById(el.id + '-v');
    const label = (output?.textContent || el.value).slice(0, 24);
    if (rangeValue.textContent !== label) rangeValue.textContent = label;
    rangeValue.dataset.target = el.id;
}
function showRangeValue(el) {
    if (!S.enabled || el.disabled || !ownsHostControl(el)) return;
    if (rangeValueInput === el) { updateRangeValue(el); return; }
    hideRangeValue();
    const rect = el.getBoundingClientRect(), dialog = el.closest('dialog');
    let originX = 0, originY = 0;
    if (rangeValue.parentElement !== document.body) document.body.append(rangeValue);
    rangeValue.hidden = false;
    try { if (typeof rangeValue.showPopover === 'function') { rangeValue.showPopover(); rangeValuePopover = true; } } catch { /* Use the local positioning fallback. */ }
    if (!rangeValuePopover && dialog) {
        dialog.append(rangeValue);
        const outer = dialog.getBoundingClientRect(); originX = outer.left; originY = outer.top;
    }
    rangeValue.style.position = !rangeValuePopover && dialog ? 'absolute' : 'fixed';
    const above = rect.top + rect.height / 2 - 29;
    rangeValue.dataset.side = above > 45 ? 'top' : 'bottom';
    rangeValue.style.top = ((above > 45 ? above : rect.bottom + 12) - originY) + 'px';
    rangeValue.dataset.tone = root.classList.contains('ilg-light') ? 'light' : 'dark';
    rangeValueInput = el; rangeValueGeometry = {rect, originX, originY};
    updateRangeValue(el);
}
// 手机上一扒拉就改值：原生滑块只要手指落在轨道任何位置就立刻跳值，滚动聊天/抽屉时蹭到就中招。
// 改成「只有按在圆点附近才算拖动」：按在轨道别处、或者按在圆点上却是竖着划，值一律还原。
// 电脑上用鼠标的不受影响（鼠标点轨道还是照常跳，那是精确调节的便利）。
const coarsePointer = matchMedia('(pointer: coarse)');
const rangeGuards = new WeakMap();
const thumbCenter = el => {
    const r = el.getBoundingClientRect();
    const min = Number(el.min || 0), max = Number(el.max || 100);
    const p = max > min ? Math.min(1, Math.max(0, (Number(el.value) - min) / (max - min))) : 0;
    return r.left + RANGE_THUMB / 2 + p * (r.width - RANGE_THUMB);
};
document.addEventListener('pointerdown', e => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || el.type !== 'range' || !S.enabled || !ownsHostControl(el)) return;
    // 按下去这一刻 value 还没被浏览器改，用它算圆点位置
    const nearThumb = Math.abs(e.clientX - thumbCenter(el)) <= RANGE_THUMB * 0.9;
    rangeGuards.set(el, { value: el.value, skip: coarsePointer.matches && !nearThumb });
    if (!rangeGuards.get(el).skip) showRangeValue(el);
}, true);
['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, e => {
    if (e.target instanceof HTMLInputElement && e.target.type === 'range') rangeGuards.delete(e.target);
    hideRangeValue();
}, true));
['input', 'change'].forEach(t => document.addEventListener(t, e => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || el.type !== 'range' || !S.enabled || !ownsHostControl(el)) return;
    const guard = rangeGuards.get(el);
    if (guard?.skip) {
        // 还原成按下之前的值，并且在捕获阶段截住，别让设置面板把这次误触存进 S
        if (el.value !== guard.value) {
            el.value = guard.value;
            paintRange(el);
        }
        e.stopPropagation();
        return;
    }
    paintRange(el);
}, true));
// Bubble after the target's setting handler so the formatted value is current.
for (const type of ['input', 'change']) document.addEventListener(type, e => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || el.type !== 'range' || !S.enabled || !ownsHostControl(el)) return;
    if (e.type === 'input' && document.activeElement === el && !rangeValueInput) showRangeValue(el);
    else updateRangeValue(el);
});
document.addEventListener('focusin', e => {
    if (e.target instanceof HTMLInputElement && e.target.type === 'range' && !rangeGuards.get(e.target)?.skip) showRangeValue(e.target);
}, true);
document.addEventListener('focusout', e => { if (e.target === rangeValueInput) hideRangeValue(); }, true);
document.addEventListener('scroll', e => {
    if (rangeValueInput && (e.target === document || e.target instanceof Element && e.target !== rangeValue && e.target.contains(rangeValueInput))) hideRangeValue();
}, true);
window.addEventListener('resize', hideRangeValue);
document.addEventListener('visibilitychange', () => { if (document.hidden) hideRangeValue(); });
// 酒馆读预设时是直接改 value（不发 input 事件），所以打开抽屉、切预设之后再统一刷一遍
document.addEventListener('click', e => { if (e.target.closest?.('.drawer-toggle, .inline-drawer-toggle') && ownsHostControl(e.target)) requestAnimationFrame(paintRanges); }, true);
['APP_READY', 'SETTINGS_LOADED', 'OAI_PRESET_CHANGED_AFTER', 'PRESET_CHANGED'].forEach(t => {
    if (ctx.eventTypes[t]) ctx.eventSource.on(ctx.eventTypes[t], () => setTimeout(paintRanges, 50));
});

// 思考小球：三种“模型在想”的时刻都换成一颗转动的点阵球
// 1. 推理模型在吐思维链：消息带 data-reasoning-state="thinking"，球塞进酒馆自己的“思考中……”标题里，点开照样能看思维链
// 2. 流式回复还没出第一个字：酒馆先插一条正文是“...”的空消息，把那串点换成“思考中 · 3s”的胶囊
// 3. 其余时候（拼提示词、等服务器回第一个包、非流式整段回来）聊天里还没有占位消息，胶囊浮在输入框上方；开头等 0.9 秒，秒回的就不闪了
const thinkPill = () => {
    const p = document.createElement('div');
    p.className = 'ilg-think';
    p.setAttribute('role', 'status');
    p.append(makeOrb(), Object.assign(document.createElement('span'), { className: 'ilg-think-label', textContent: '思考中' }),
        Object.assign(document.createElement('span'), { className: 'ilg-think-t' }));
    return p;
};
// sawReply：这次生成里已经出现过占位 / 思维链 / 正文，之后就算短暂对不上（流刚结束、酒馆还没收尾）也不再弹浮动胶囊
let genSince = 0, sawReply = false, floatPill = null, thinkTimer = 0, thinkQueued = false;
const dotsOnly = m => {
    const text = m.querySelector('.mes_text');
    return !!text && !text.querySelector('iframe, details, summary, img, video, audio, svg, canvas, table, button, input, select, textarea, [class]:not(.ilg-prose):not(.ilg-indentable), [style], [role]')
        && !(text.textContent || '').replace(/[.…]/g, '').trim();
};
const genOn = () => S.enabled && S.orb && document.body.dataset.generating === 'true';
function syncThink() {
    thinkQueued = false;
    const on = S.enabled && S.orb, gen = genOn();
    // 1. 思维链标题
    // 只看正在想的和已经挂了球的，长聊天里不用把每条消息都翻一遍
    chatEl.querySelectorAll('.mes[data-reasoning-state="thinking"] .mes_reasoning_header, .mes_reasoning_header:has(> .ilg-orb)').forEach(head => {
        if (head.closest('.mes_text, .mes_reasoning, [data-nvwa-style="author"]')) return;
        const want = on && head.closest('.mes').dataset.reasoningState === 'thinking';
        const orb = head.querySelector(':scope > .ilg-orb');
        if (want && !orb) head.prepend(makeOrb());
        else if (!want && orb) orb.remove();
    });
    // 2. 流式占位消息
    const last = chatEl.querySelector('.mes.last_mes') || [...chatEl.querySelectorAll('.mes')].pop();
    // 思维链被模型藏起来（内容为空）时酒馆不显示那个标题，球也就看不见，这种也当占位处理
    const shownThinking = m => m.dataset.reasoningState === 'thinking' && !!m.querySelector('.mes_reasoning')?.textContent.trim();
    const placeholder = gen && last && last.getAttribute('is_user') !== 'true' && !shownThinking(last)
        && dotsOnly(last) ? last : null;
    chatEl.querySelectorAll('.mes.ilg-await').forEach(m => { if (m !== placeholder) { m.classList.remove('ilg-await'); m.querySelector(':scope .ilg-think')?.remove(); } });
    if (placeholder && !placeholder.querySelector('.ilg-think')) {
        placeholder.classList.add('ilg-await');
        placeholder.querySelector('.mes_text')?.before(thinkPill());
    }
    // 思维链在流的时候正文还是那串“...”，藏掉
    chatEl.querySelectorAll('.mes.ilg-dots').forEach(m => { if (!(gen && shownThinking(m) && dotsOnly(m))) m.classList.remove('ilg-dots'); });
    if (gen && last && shownThinking(last) && dotsOnly(last)) last.classList.add('ilg-dots');
    // 3. 聊天里既没占位也没在显示思维链，并且字还没开始往消息里流（续写时没有占位，字直接接在上一条后面）
    const sp = SillyTavern.getContext().streamingProcessor;
    const busy = placeholder || [...chatEl.querySelectorAll('.mes[data-reasoning-state="thinking"]')].some(shownThinking) || (sp && sp.messageId >= 0);
    if (busy) sawReply = true;
    const wantFloat = gen && !busy && !sawReply && performance.now() - genSince > 900;
    if (wantFloat && !floatPill) {
        floatPill = thinkPill();
        floatPill.id = 'ilg-think-float';
        form.append(floatPill);
    } else if (!wantFloat && floatPill) {
        floatPill.remove();
        floatPill = null;
    }
    tickThink();
}
// 胶囊里的秒数从这次生成开始算
function tickThink() {
    const pills = document.querySelectorAll('.ilg-think-t');
    const s = Math.floor((performance.now() - genSince) / 1000);
    pills.forEach(t => { const v = genOn() && s >= 1 ? `${s}s` : ''; if (t.textContent !== v) t.textContent = v; });
    clearTimeout(thinkTimer);
    if (genOn()) thinkTimer = setTimeout(() => { syncThink(); }, 1000 - ((performance.now() - genSince) % 1000) + 20);
}
// 用函数声明：applyRoot（开关切换时）也要调它
function queueThink() { if (!thinkQueued) { thinkQueued = true; requestAnimationFrame(syncThink); } }
new MutationObserver(() => {
    if (genOn() && !genSince) genSince = performance.now();
    if (!genOn()) { genSince = 0; sawReply = false; }
    queueThink();
}).observe(document.body, { attributes: true, attributeFilter: ['data-generating'] });
new MutationObserver(muts => {
    if (!S.enabled || !S.orb) return;
    // 自己插胶囊 / 小球引起的变化不用再处理，不然会自己触发自己
    const own = n => n.nodeType === 1 && n.matches('.ilg-think, .ilg-orb');
    if (muts.every(m => m.target.closest?.('.ilg-think') || (m.type === 'childList' && [...m.addedNodes, ...m.removedNodes].every(own)))) return;
    queueThink();
}).observe(chatEl, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-reasoning-state'] });

// 角色卡状态栏：正文里自带底色的小面板，底色和当前深浅反着（深色模式里的白卡片、浅色模式里的黑卡片）时，
// 标上 .ilg-lit / .ilg-dim，CSS 把那一块的字色变量和酒馆的字影换成配它底色的一套。
// 半透明的底按叠加亮度判断；可访问消息 iframe 的字影由 card-clarity.js 独立处理。
const cardDirty = new Set();
let cardTimer = 0;
const parseRgba = s => { const m = s && s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
const lumOf = c => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
// Computed display metadata only: never include message text, frame URLs or settings payloads.
function cardDisplayReport({includeCapture=true}={}) {
    const describe = el => {
        const win = el.ownerDocument.defaultView;
        const cs = win.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const style = nodeStyle => ({
            color: nodeStyle.backgroundColor,
            image: /url\(/i.test(nodeStyle.backgroundImage) ? '[image URL omitted]' : nodeStyle.backgroundImage,
            opacity: nodeStyle.opacity,
            filter: nodeStyle.backdropFilter || nodeStyle.webkitBackdropFilter || 'none',
        });
        const result = {
            tag: el.tagName.toLowerCase(),
            classes: [...el.classList].slice(0, 8).map(c => c.slice(0, 80)),
            size: [Math.round(rect.width), Math.round(rect.height)],
            intersectsViewport: rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < win.innerHeight && rect.left < win.innerWidth,
            visible: !!rect.width && !!rect.height && cs.display !== 'none' && cs.visibility !== 'hidden',
            position: cs.position,
            background: style(cs),
            before: style(win.getComputedStyle(el, '::before')),
            after: style(win.getComputedStyle(el, '::after')),
            solid: el.classList.contains('ilg-solid'),
        };
        if (el.matches('.mes')) { const it=items.get(el); result.glass = style(win.getComputedStyle(it?.backdrop || el.querySelector(':scope > .ilg-message-glass') || el));result.rendering={path:it?.renderPath||'not-tracked',fallbackReason:it?.fallbackReason||'',nearViewport:it?.visible===true}; }
        if (el.tagName === 'IFRAME') {
            try {
                const doc = el.contentDocument;
                result.frameAccess = doc?.body ? 'same-origin' : 'unavailable';
                if (doc?.body) result.frameBackground = { html: style(win.getComputedStyle(doc.documentElement)), body: style(win.getComputedStyle(doc.body)) };
            } catch { result.frameAccess = 'cross-origin'; }
        }
        return result;
    };
    const messages = [...chatEl.querySelectorAll('.mes')];
    // Include the opening and the visible messages first; keep reports bounded in long chats.
    const visible = messages.filter(m => { const r = m.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
    const selected = [...new Set([...messages.slice(0, 1), ...visible, ...messages.slice(-3)])].slice(0, 8);
    let remaining = 100;
    const details = selected.map(message => {
        const elements = [...message.querySelectorAll('.mes_text, .mes_text :is(div, section, article, aside, details, iframe, button)')];
        const candidates = elements.filter(el => {
            const cs = getComputedStyle(el);
            return el.matches('.mes_text, iframe, .ilg-card-surface') || cs.backgroundImage !== 'none' || cs.position === 'fixed';
        });
        const sampled = candidates.slice(0, remaining);
        remaining -= sampled.length;
        return { message: describe(message), candidates: candidates.length, sampled: sampled.map(describe), truncated: sampled.length < candidates.length };
    });
    return JSON.stringify({
        format: 'nvwa-card-display-1', version: BUILD_VERSION,
        environment: {isIOS,androidWebView,iosCompatible:iosMaterialActive(),trueRefractionConfirmed:false},
        viewportState: viewportDiagnostic(), ...(includeCapture ? {interactionCapture: interactionDiagnostics.report()} : {}),
        bundledWallpapers: bundledWallpapers.status(),
        viewport: [innerWidth, innerHeight, devicePixelRatio],
        userAgent: navigator.userAgent,
        enabled: !!S.enabled, chatBackground: S.chatBackground, chatVeil: S.chatVeil,
        compatibilityMode: S.compatibilityMode, engine: S.engine, engineNames: ENGINE_NAMES,
        bubble: document.body.classList.contains('bubblechat'), noBlur: document.body.classList.contains('no-blur'),
        messageCount: messages.length, sampledMessages: details,
    }, null, 2);
}

function blockBg(el, cs = getComputedStyle(el)) {
    let c = parseRgba(cs.backgroundColor);
    // 渐变底：取第一个颜色当近似
    if ((!c || c.a < 0.05) && cs.backgroundImage.includes('gradient')) c = parseRgba(cs.backgroundImage);
    return c && c.a >= 0.05 ? c : null;
}
// Inspect authored colors, including pseudo-element panels, without replacing their backgrounds.
const cardColors = (el, cs) => {
    const layers = [
        [el.style.backgroundColor, 'color'],
        [cs.backgroundColor, 'color'],
        [el.style.backgroundImage || el.style.background, 'image'],
        [cs.backgroundImage, 'image'],
    ];
    for (const p of ['::before', '::after']) {
        const ps = getComputedStyle(el, p);
        if (ps.content === 'none' || ps.display === 'none') continue;
        layers.push([ps.backgroundColor, 'color'], [ps.backgroundImage, 'image']);
    }
    let best = null;
    for (const [src] of layers) {
        if (!src || src === 'none') continue;
        const list = String(src).match(/rgba?\([^)]+\)/g);
        if (!list || !list.length) continue;
        for (const s of list) {
            const c = parseRgba(s);
            if (!c) continue;
            if (c.a >= 0.35 && (!best || c.a > best.a)) best = c;
        }
    }
    return { best };
};
const CARD_PANELS = 'div, section, article, aside, details, summary, dialog, button, [role="dialog"], [role="button"], [role="menu"], [role="listbox"], [role="option"]';
const CARD_CHOICES = 'button, select, option, input[type="button"], input[type="submit"], [role="button"], [role="option"]';
const CARD_RENDERER_CANDIDATES = 'iframe, ' + CARD_PANELS + ', ' + CARD_CHOICES;
function applyCardMarkers(texts) {
    // Read one whole level, then write its markers. Children still see their
    // parent's resolved colors, without forcing style/layout once per card.
    const light = root.classList.contains('ilg-light');
    const messages = texts.map(text => ({ message: text.closest('.mes'), fixedOverlay: false, cardRenderer: false }));
    let level = texts.map((text, i) => ({ parent: text, base: light ? 0.95 : 0.08, state: messages[i] }));
    while (level.length) {
        const updates = [], next = [];
        for (const { parent, base, state } of level) for (const k of parent.children) {
            const cs = getComputedStyle(k);
            const visible = cs.display !== 'none' && cs.visibility !== 'hidden';
            if (cs.position === 'fixed' && visible && k.getClientRects().length) state.fixedOverlay = true;
            const frame = k.matches('iframe');
            if (frame && visible) {
                const { width, height } = k.getBoundingClientRect();
                if (width > 0 && height > 0) state.cardRenderer = true;
            }
            if (k.matches('img, video, svg, canvas, q, em, i, b, strong, br')) continue;
            const c = blockBg(k, cs);
            const panel = frame || k.matches(CARD_PANELS);
            const renderer = k.matches(CARD_CHOICES) || (panel && (!!c || cs.backgroundImage !== 'none' || cs.position === 'fixed'));
            // A pseudo-element may provide the apparent color. It alone does
            // not opt ordinary paragraphs into the separate glass path.
            const surface = frame || renderer || (panel && !!cardColors(k, cs).best);
            if (renderer && visible && k.getClientRects().length) state.cardRenderer = true;
            const lum = c ? lumOf(c) * c.a + base * (1 - c.a) : base;
            updates.push({ element: k, surface, lit: !!c && lum > 0.62 && !light, dim: !!c && lum < 0.38 && light });
            if (k.children.length) next.push({ parent: k, base: lum, state });
        }
        for (const { element, surface, lit, dim } of updates) {
            element.classList.toggle('ilg-card-surface', surface);
            element.classList.toggle('ilg-lit', lit);
            element.classList.toggle('ilg-dim', dim);
            // Remove markers from older builds without changing authored inline backgrounds.
            if (element.style.getPropertyValue('--ilg-card-solid')) element.style.removeProperty('--ilg-card-solid');
            element.classList.toggle('ilg-solid', false);
        }
        level = next;
    }
    const repaint = [];
    for (const { message, fixedOverlay, cardRenderer } of messages) {
        if (!message || (message.classList.contains('ilg-content-overlay') === fixedOverlay && message.classList.contains('ilg-card-renderer') === cardRenderer)) continue;
        message.classList.toggle('ilg-content-overlay', fixedOverlay);
        message.classList.toggle('ilg-card-renderer', cardRenderer);
        repaint.push(message);
    }
    return repaint;
}
// The full native hit stack is still authoritative. On a demonstrably flat,
// static panel, give Blink a distant-row boundary so it can skip traversing
// its positioned paint layers. Never contain the author's layout or iframe.
const BOUNDED_PANEL_TAGS = new Set('div section article aside p br span q em i b strong s del u ul ol li'.split(' '));
// Host decoration may overhang slightly; the CSS boundary has a wider reserve.
const HIT_GEOMETRY_SLOP = 20;
// In small chats the extra paint boundaries cost more than a short native walk.
const MIN_HIT_ROWS = 64, MIN_HIT_LAYERS = 2;
const HIT_SHELL = '.mes_block, .mesAvatarWrapper, .for_checkbox, .del_checkbox, .swipe_left, .swipeRightBlock, .ilg-message-glass';
const HIT_BLOCK_SHELL = '.mes_text, .ch_name, .mes_reasoning_details, .mes_media_wrapper, .mes_file_wrapper, .mes_bias';
function boundedCardHit(row, text) {
    if (!row.matches('#chat > .mes.ilg-message-backdrop:not(.ilg-content-overlay):not(.last_mes)')) return false;
    // Only the normal in-flow message shell, an opaque/colored panel and its sibling prose.
    const block = text.parentElement;
    if (block.parentElement !== row || !block.classList.contains('mes_block') || !text.querySelector('.ilg-card-surface')) return false;
    if ([...row.children].some(el => !el.matches(HIT_SHELL)) || [...block.children].some(el => !el.matches(HIT_BLOCK_SHELL))) return false;
    if (text.querySelectorAll(':is(div, span):empty').length < MIN_HIT_LAYERS) return false;
    if (text.querySelector('[contenteditable], [tabindex], [role], [id], [popover], [data-nvwa-style="author"]')) return false;
    if (row.querySelector('iframe, dialog, [popover], [contenteditable], .edit_textarea, .reasoning_edit_textarea')) return false;
    // Scope this to an intact native shell; themes with an unbounded message
    // block or their own row clip keep the original path.
    const blockStyle = getComputedStyle(block);
    const clipped = value => value === 'hidden' || value === 'clip';
    if (!clipped(blockStyle.overflowX) || !clipped(blockStyle.overflowY)) return false;
    const box = row.getBoundingClientRect();
    if (!box.width || !box.height) return false;
    let layers = 0;
    const within = el => {
        const rect = el.getBoundingClientRect();
        return rect.top >= box.top - HIT_GEOMETRY_SLOP && rect.bottom <= box.bottom + HIT_GEOMETRY_SLOP;
    };
    const local = cs => cs.transform === 'none' && cs.translate === 'none' && cs.rotate === 'none'
        && cs.scale === 'none' && cs.offsetPath === 'none' && cs.filter === 'none' && cs.perspective === 'none'
        && cs.backdropFilter === 'none' && cs.clipPath === 'none' && cs.animationName === 'none'
        && cs.transitionDuration === '0s' && cs.boxShadow === 'none' && cs.outlineStyle === 'none'
        && cs.mixBlendMode === 'normal';
    const zero = v => v === '0px' || v === 'auto';
    const rowStyle = getComputedStyle(row);
    if (rowStyle.position !== 'relative' || rowStyle.isolation !== 'isolate' || rowStyle.transform !== 'none'
        || rowStyle.clipPath !== 'none') return false;
    for (const el of [text, ...text.querySelectorAll('*')]) {
        if (!BOUNDED_PANEL_TAGS.has(el.localName) || [...el.attributes].some(a => a.name.startsWith('on'))) return false;
        const cs = getComputedStyle(el);
        if (!local(cs) || !within(el)) return false;
        if (cs.position === 'absolute') {
            if (el.childNodes.length || [cs.top, cs.right, cs.bottom, cs.left].some(v => v !== '0px')) return false;
            const parent = el.offsetParent;
            if (!text.contains(parent) || !within(parent)) return false;
            layers++;
        } else if (cs.position !== 'static' && !(cs.position === 'relative' && [cs.top, cs.right, cs.bottom, cs.left].every(zero))) return false;
        for (const pseudo of ['::before', '::after']) {
            const part = getComputedStyle(el, pseudo);
            if (part.content !== 'none' && part.content !== 'normal' && !(el.localName === 'q'
                && part.position === 'static' && local(part) && /^".{0,3}"$/u.test(part.content))) return false;
        }
    }
    if (layers < MIN_HIT_LAYERS) return false;
    // Check the native controls too; fixed/sticky or overflowing chrome is
    // not a candidate. The owned glass is tied to the row rectangle in CSS.
    for (const host of row.querySelectorAll(':scope :not(.mes_text, .mes_text *, .ilg-message-glass)')) {
        const { position } = getComputedStyle(host);
        if (position === 'fixed' || position === 'sticky' || (host.getClientRects().length && !within(host))) return false;
    }
    return true;
}
// 普通正文段落标记：阅读配色（.ilg-prose）和首行缩进（.ilg-indentable）只给“没有自带 class/style、里面没有图片/控件/div 等”的直接段落。
// 原来 CSS 用 :not(:has(...)) 现场判断，可 :has() 让流式输出每次改字都要重查（每次约 3ms 样式重算）。
// 改为在 MutationObserver 里打标记：它在本次脚本改完 DOM 后、页面重算样式前执行，标记和新文字同一帧生效，不会闪。
const PROSE_MARKS = ['ilg-prose', 'ilg-indentable', 'ilg-type-prose'];
const PROSE_SEL = ':scope > :is(p, ul, ol, blockquote)';
const RICH_PROSE = 'img, iframe, video, audio, svg, canvas, button, input, select, textarea, table, details, div, [class], [style], [role]';
const RICH_INDENT = 'img, iframe, video, audio, svg, canvas, button, input, select, textarea, table, details, div, [role="button"]';
const ownClassesOnly = el => [...el.classList].every(c => PROSE_MARKS.includes(c));
function markProse(text) {
    for (const el of text.querySelectorAll(PROSE_SEL)) {
        const bare = ownClassesOnly(el) && !el.hasAttribute('style');
        const prose = bare && !el.querySelector(RICH_PROSE);
        const indent = bare && el.localName === 'p' && !el.querySelector(RICH_INDENT);
        if (el.classList.contains('ilg-prose') !== prose) el.classList.toggle('ilg-prose', prose);
        const typeset = prose && !el.hasAttribute('id') && !el.hasAttribute('role') && !el.querySelector('code, pre, kbd, samp, [id]');
        if (el.classList.contains('ilg-type-prose') !== typeset) el.classList.toggle('ilg-type-prose', typeset);
        if (el.classList.contains('ilg-indentable') !== indent) el.classList.toggle('ilg-indentable', indent);
        // 我们的标记都去掉后，把空的 class 属性也拿掉，和原来一样
        if (!el.classList.length && el.hasAttribute('class')) el.removeAttribute('class');
    }
}
new MutationObserver(muts => {
    const dirty = new Set();
    for (const m of muts) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
            const clean = value => (value || '').split(/\s+/).filter(c => c && !PROSE_MARKS.includes(c)).sort().join(' ');
            if (clean(m.oldValue) === clean(m.target.getAttribute('class'))) continue;
        }
        const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        const text = el?.closest?.('.mes_text');
        if (text) { dirty.add(text); continue; }
        m.addedNodes.forEach(n => { if (n.nodeType === 1) (n.matches('.mes_text') ? [n] : n.querySelectorAll('.mes_text')).forEach(t => dirty.add(t)); });
    }
    dirty.forEach(text => { markProse(text); messageRendering.invalidate(text.closest('.mes')); });
}).observe(chatEl, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'role', 'id'], attributeOldValue: true });
chatEl.querySelectorAll('.mes_text').forEach(markProse);
const CARD_MARK_CLASSES = new Set(['ilg-lit', 'ilg-dim', 'ilg-card-surface', ...PROSE_MARKS]);
const ROW_HIT_CLASSES = new Set(['ilg-bounded-hit', 'ilg-phys', 'ilg-reflection']);
function queueCards(all) {
    if (!S.enabled) { clearTimeout(cardTimer); cardDirty.clear(); return; }
    if (all) {
        chatEl.querySelectorAll('.ilg-bounded-hit').forEach(row => row.classList.remove('ilg-bounded-hit'));
        chatEl.querySelectorAll('.mes_text').forEach(t => cardDirty.add(t));
    }
    clearTimeout(cardTimer);
    cardTimer = setTimeout(() => {
        const texts = [...cardDirty].filter(t => t.isConnected);
        cardDirty.clear();
        if (!S.enabled) return;
        // Don't measure a new glass surface between every pair of card scans.
        // Repaint the entire batch after all author markers have been resolved.
        const repaint = applyCardMarkers(texts);
        if (repaint.length) paintMany(repaint, 'card');
        // Read all candidate boundaries before committing any new styles.
        if (!isIOS && !androidHost && S.refract && S.refractMes && S.engine === 'physical' && canRefract() && chatEl.childElementCount >= MIN_HIT_ROWS) {
            const rows = texts.map(text => text.closest('.mes'));
            const bounded = rows.map((row, i) => row && boundedCardHit(row, texts[i]));
            rows.forEach((row, i) => row?.classList.toggle('ilg-bounded-hit', !!bounded[i]));
        }
    }, 200);
}
new MutationObserver(muts => {
    if (!S.enabled) return;
    let hit = false;
    for (const m of muts) {
        const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        // Scrolling only toggles our material classes. A real author or host
        // change on the row itself must retire the old geometry boundary too.
        if (m.type === 'attributes' && m.attributeName === 'class') {
            const rowTarget = el.matches('.mes');
            const clean = value => (value || '').split(/\s+/).filter(c => c && !CARD_MARK_CLASSES.has(c)
                && !(rowTarget && ROW_HIT_CLASSES.has(c))).sort().join(' ');
            if (clean(m.oldValue) === clean(el.getAttribute('class'))) continue;
        }
        const t = el?.closest('.mes_text');
        if (t) {
            t.closest('.ilg-bounded-hit')?.classList.remove('ilg-bounded-hit');
            cardDirty.add(t); hit = true; continue;
        }
        const row = el?.closest('.ilg-bounded-hit');
        if (row && !el.classList.contains('ilg-message-glass')) {
            row.classList.remove('ilg-bounded-hit');
            const text = row.querySelector('.mes_text');
            if (text) { cardDirty.add(text); hit = true; }
        }
        m.addedNodes.forEach(n => { if (n.nodeType === 1) (n.matches('.mes_text') ? [n] : n.querySelectorAll('.mes_text')).forEach(x => { cardDirty.add(x); hit = true; }); });
    }
    if (hit) queueCards(false);
}).observe(chatEl, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'open', 'contenteditable', 'tabindex', 'role', 'id', 'popover'], attributeOldValue: true });
// Discard geometry certificates when the viewport or stylesheet inputs change.
function refreshBoundedCards() {
    if (chatEl.querySelector('.ilg-bounded-hit')) queueCards(true);
}
if (canFull && !androidHost) {
    onViewportChange(v => { if (v.widthChanged || v.heightChanged) refreshBoundedCards(); });
    document.fonts?.addEventListener('loadingdone', refreshBoundedCards);
    new MutationObserver(records => {
        if (records.some(record => record.target.parentElement?.matches('style') || record.target.matches?.('style, link[rel="stylesheet"]')
            || [...record.addedNodes, ...record.removedNodes].some(node => node.matches?.('style, link[rel="stylesheet"]')))) refreshBoundedCards();
    }).observe(document.head, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['href', 'media', 'disabled'] });
}

// 世界书多选框“还没选任何一本”：原来 CSS 用 :not(:has(.select2-selection__choice)) 判断，
// 但 :has() 让聊天里每次改字都要重查一遍（流式输出时每次更新约多 3ms 样式重算）。改为只盯 #WorldInfo 里的变化打标记。
function markEmptyWorldPickers() {
    document.querySelectorAll('#WorldInfo .select2-selection--multiple').forEach(box => {
        const empty = !box.querySelector('.select2-selection__choice');
        if (box.classList.contains('ilg-wi-empty') !== empty) box.classList.toggle('ilg-wi-empty', empty);
    });
}
const worldInfoEl = document.getElementById('WorldInfo');
if (worldInfoEl) new MutationObserver(markEmptyWorldPickers).observe(worldInfoEl, { childList: true, subtree: true });
markEmptyWorldPickers();
ctx.eventSource.on(ctx.eventTypes.APP_READY, markEmptyWorldPickers);

buildPanel();
refreshCompanionTheme();
/* ---------- 角色卡上的「世界书」小标 ----------
   酒馆的角色列表不带世界书信息，但每个角色可以在 data.extensions.world 里绑一本。
   这里按头像文件名跟 ctx.characters 对上，把世界书名补在简介下面；列表重排 / 翻页时跟着重新贴。 */
function characterOfRow(row) {
    const img = row.querySelector('.avatar img');
    const src = img?.getAttribute('src') || '';
    let file = src.split('/').pop()?.split('?')[0] || '';
    try { file = decodeURIComponent(file); } catch { /* 文件名里有怪字符就按原样比 */ }
    const list = ctx.characters || [];
    if (file) {
        const hit = list.find(c => c.avatar === file);
        if (hit) return hit;
    }
    const chid = Number(row.dataset?.chid ?? row.getAttribute('chid'));
    return Number.isFinite(chid) ? list[chid] : null;
}
function tagWorlds() {
    if (!S.enabled) return;
    document.querySelectorAll('#rm_print_characters_block .character_select').forEach(row => {
        const world = characterOfRow(row)?.data?.extensions?.world || '';
        const cont = row.querySelector(':scope > .character_select_container');
        if (!cont) return;
        const chip = cont.querySelector(':scope > .ilg-world');
        if (!world) { chip?.remove(); return; }
        let node = chip;
        if (!node) {
            node = document.createElement('div');
            node.className = 'ilg-world';
            node.innerHTML = '<span class="ilg-world-k">世界书</span><span class="ilg-world-v"></span>';
            cont.appendChild(node);
        }
        const val = node.querySelector('.ilg-world-v');
        if (val && val.textContent !== world) val.textContent = world;
        const title = `绑定世界书：${world}`;
        if (node.title !== title) node.title = title;
    });
}
let worldRaf = 0;
function queueWorlds() {
    if (worldRaf) return;
    worldRaf = requestAnimationFrame(() => { worldRaf = 0; tagWorlds(); });
}
function watchCharList() {
    const block = document.getElementById('rm_print_characters_block');
    if (!block || block.dataset.ilgWorlds === '1') return;
    block.dataset.ilgWorlds = '1';
    new MutationObserver(queueWorlds).observe(block, { childList: true, subtree: true });
    queueWorlds();
}
watchCharList();
ctx.eventSource.on(ctx.eventTypes.APP_READY, watchCharList);

if (takeFlickerArm(window) && S.enabled) startFlickerCapture();
applyRoot();
paintRanges();
ctx.eventSource.on(ctx.eventTypes.APP_READY, applyRoot);
ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, () => flickerCapture?.chatChanged());

// Check the real library on startup and when an explicit appearance selection needs repair.
// The old wallsReady flag survives reinstalling the extension, so it is not proof of file presence.
const bundledWallpapers=createBundledWallpapers({
    files:Object.values(TONE_WALLS),getHeaders:options=>ctx.getRequestHeaders(options),
    assetURL:file=>new URL('./walls/'+encodeURIComponent(file),import.meta.url),
    async refresh(){const backgrounds=await import('/scripts/backgrounds.js');if(typeof backgrounds.getBackgrounds!=='function')throw new Error('refresh-unavailable');await backgrounds.getBackgrounds();},
    onReady(){if(!S.wallsReady){S.wallsReady=true;ctx.saveSettingsDebounced();}},
});
async function ensureWalls() {
    interactionDiagnostics.mark('wallpaper-recovery', {phase:'checking'});
    const result = await bundledWallpapers.ensure();
    interactionDiagnostics.mark('wallpaper-recovery', {phase:result.phase,code:result.error});
    return result;
}
let wallsStartupQueued=false;
function queueEnsureWalls(){if(wallsStartupQueued)return;wallsStartupQueued=true;setTimeout(()=>{if(S.enabled)void ensureWalls();},1500);}
ctx.eventSource.on(ctx.eventTypes.APP_READY,queueEnsureWalls);
queueEnsureWalls();
ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, () => {
    inputCompositionText = '';
    riseQuietUntil = performance.now() + 1500;
    requestAnimationFrame(() => {
        if (!S.enabled) return;
        // A chat change does not change the global material or toolbar layout.
        syncInputMaterial(); syncHome(); scan();
        applyTone(); queueThink(); scheduleFloor();
    });
});
// 只有宽度变了才整页重画：手机键盘弹出/收起只改高度，靠 ResizeObserver 重画真正变了尺寸的玻璃就够了
onViewportChange(v => { if (v.widthChanged) repaintAll(); });
['bg1', 'bg_custom'].forEach(id => {
    const el = document.getElementById(id);
    if (el) new MutationObserver(() => S.enabled && applyTone()).observe(el, { attributes: true, attributeFilter: ['style'] });
});
