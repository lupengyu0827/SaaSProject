# 💎 Haute Joaillerie & High-Precision Operations 设计系统规范 (Design System Specs)

> **设计宗旨**：构建兼具**传世高级珠宝殿堂奢华感（C端 VIP 私享）**与**顶级制表级精密工坊感（B端 数字化中枢）**的高端设计语言。严禁廉价渐变、过度发光或未经排版的空洞排版。

---

## 一、双主题色彩与质感规范 (Color Tokens & Theming)

### 1. 🌙 深色主题（Dark Luxury · 殿堂深邃沙龙）
*适用场景：高级珠宝 C 端展厅、B 端暗黑精密控制台、夜间 VIP 私享模式。*

| 维度 | Token 名 | 色值 (HEX / RGBA) | 用途说明 |
| :--- | :--- | :--- | :--- |
| **主背景色** | `--bg-dark-base` | `#080C14` (午夜深蓝黑) | 画布最底层，营造暗室聚光灯氛围 |
| **容器/卡片背景** | `--bg-dark-surface` | `#111622` / `#161D2C` | 一级与二级卡片底色，亮度差严格 ≤ 10% |
| **主金属点缀色** | `--accent-gold-primary`| `#F59E0B` (暖光琥珀金) | 按钮、重点图标、价格强调 |
| **次金属点缀色** | `--accent-gold-light`  | `#FDE68A` / `#FCD34D` | 金色文字高光、标签背景微光 |
| **铂金/冷银高光** | `--accent-platinum`    | `#E2E8F0` / `#94A3B8` | GIA 证书、4C 参数标签、金属规格标识 |
| **主文字色** | `--text-dark-primary` | `#F8FAFC` (95% 白) | 大标题、核心数值、价格 |
| **次文字色** | `--text-dark-secondary`| `#94A3B8` (冷灰) | 副标题、属性描述、小字说明 |
| **分割线/边框** | `--border-dark-subtle` | `rgba(245, 158, 11, 0.15)` | 极细金色微光边框（1px），严禁厚重边框 |
| **阴影/微光** | `--shadow-dark-luxury` | `0 12px 32px -4px rgba(0, 0, 0, 0.6)` | 柔和深邃阴影，无刺眼高饱和霓虹光晕 |

---

### 2. ☀️ 浅色主题（Light Haute · 典雅大理石沙龙）
*适用场景：日间 C 端线上精品店、B 端高对比度财务/审计明亮模式。*

| 维度 | Token 名 | 色值 (HEX / RGBA) | 用途说明 |
| :--- | :--- | :--- | :--- |
| **主背景色** | `--bg-light-base` | `#F8F9FA` (柔和微冷白大理石质感) | 严禁纯白 `#FFFFFF`，杜绝刺眼感 |
| **容器/卡片背景** | `--bg-light-surface` | `#FFFFFF` | 卡片与弹窗纯净承载面，亮度差严格 ≤ 7% |
| **主金属点缀色** | `--accent-gold-light-mode`| `#B45309` / `#D97706` (深萃古董金) | 保障浅色背景下的 WCAG AA 对比度 (≥ 4.5:1) |
| **次点缀/香槟色** | `--accent-champagne`   | `#FEF3C7` / `#FDE68A` | 浅金色徽章背景、优惠标签微底色 |
| **深空冷炭主文字** | `--text-light-primary` | `#0F172A` (深板岩黑) | 主标题、商品名称、重要指标 |
| **次文字色** | `--text-light-secondary`| `#64748B` (中性石板灰) | 辅助说明、规格描述、时间戳 |
| **分割线/边框** | `--border-light-subtle`| `#E2E8F0` / `rgba(180, 83, 9, 0.12)` | 浅冷灰或微淡金质感细线 |
| **阴影** | `--shadow-light-luxury`| `0 8px 24px -4px rgba(15, 23, 42, 0.06)` | 柔和空气感阴影，禁止生硬黑色投影 |

---

## 二、功能语义色彩规范 (Semantic Status Colors)

*深浅两端保持语义一致，但浅色端提高对比度、深色端降低饱和度：*

- **特保押运 / 正常在售 (Emerald)**:
  - 深色: Text `#34D399` | Bg `rgba(16, 185, 129, 0.12)` | Border `rgba(52, 211, 153, 0.3)`
  - 浅色: Text `#047857` | Bg `#ECFDF5` | Border `#A7F3D0`
- **库存告警 / 待质检 (Amber)**:
  - 深色: Text `#FBBF24` | Bg `rgba(245, 158, 11, 0.12)` | Border `rgba(251, 191, 36, 0.3)`
  - 浅色: Text `#B45309` | Bg `#FFFBEB` | Border `#FDE68A`
- **售后审核 / 下架停售 (Rose / Ruby)**:
  - 深色: Text `#FB7185` | Bg `rgba(244, 63, 94, 0.12)` | Border `rgba(251, 113, 133, 0.3)`
  - 浅色: Text `#BE123C` | Bg `#FFF1F2` | Border `#FECDD3`

---

## 三、排版与字体系统规范 (Typography & Scale)

### 1. 字体族（Font Stack）
- **Display 品牌与标题字体**：`Cinzel`, `Playfair Display`, `Didot`, `Noto Serif SC`, `Songti SC`, `serif`
  - *作用*：用于藏品标题、品牌 Slogan、大章节名，彰显殿堂级老钱风范。
- **UI & 正文字体**：`Plus Jakarta Sans`, `Inter`, `PingFang SC`, `system-ui`, `sans-serif`
  - *作用*：用于导航、操作按钮、商品参数，保证移动端与复杂数据的高度易读性。
- **数据与参数字体（Monospace）**：`JetBrains Mono`, `SF Mono`, `monospace`
  - *作用*：用于价格数字（`¥ 1,280,000`）、GIA 证书编号、克拉参数、押运实时 GPS 坐标。

### 2. 字阶比例（Scale Ratio：1.25 Major Third）
- **H1 (Hero/展厅巨幅标题)**: `28px - 32px` | Line-height: `1.2` | 字间距: `tracking-wider` | 衬线体
- **H2 (模块/抽屉大标题)**: `20px - 24px` | Line-height: `1.3` | 衬线体或加粗中文字体
- **H3 (卡片/分类标题)**: `15px - 16px` | Line-height: `1.4` | Medium / Semibold
- **Body (正文描述)**: `13px - 14px` | Line-height: `1.6` | Regular (WCAG 规范，段落最大宽度 `65ch`)
- **Caption (标签/辅助参数)**: `11px - 12px` | Line-height: `1.4` | Monospace / Sans-serif
- **Micro (时间戳/协议声明)**: `9px - 10px` | Line-height: `1.3` | 上下文紧凑单行

---

## 四、间距与几何圆角规范 (Spacing & Geometry)

### 1. 间距法则（8pt Grid）
- **微距 (Micro)**: `4px` (`gap-1`), `8px` (`gap-2`) —— 标签与图标、文字与徽章。
- **组件内间距 (Padding)**: 卡片内部 `12px - 16px` (`p-3` ~ `p-4`)，模态窗 `20px - 24px` (`p-5` ~ `p-6`)。
- **按钮内边距黄金律**: 水平 Padding 必须为垂直 Padding 的 **2倍**（例: `py-2.5 px-5` 或 `py-2 px-4`）。
- **区块外边距 (Section Spacing)**: `20px - 32px` (`space-y-6` ~ `space-y-8`)。

### 2. 圆角体系（Border Radius & Nesting）
- **标准卡片 (Cards)**: `12px - 16px` (`rounded-xl` / `rounded-2xl`)。**禁止超过 20px 的卡片大圆角**。
- **按钮与胶囊标签 (Pills/Buttons)**: `8px` (`rounded-lg`) 或全胶囊 `9999px` (`rounded-full`)。
- **嵌套圆角数学公式**：
  $$\text{Inner Radius} = \text{Outer Radius} - \text{Padding}$$
  *(例：外容器圆角 16px，Padding 4px，则内部图片或子元素圆角必须为 12px，严禁内外圆角不协调)*。

---

## 五、C 端与 B 端界面结构模式 (Layout Patterns)

### 💎 C 端：私享沙龙模式 (Luxury Client Experience)
1. **单列流体瀑布与沉浸式卡片**：商品卡片突出大幅珠宝质感大图（比例 `1:1` 或 `4:5`），图片带精细暗角或大理石映衬。
2. **4C 参数可视化矩阵**：以清晰的刻度线与勋章形式展现克拉（Carat）、颜色（D-F）、净度（FL/VVS1）、切工（3EX）。
3. **GIA 电子防伪证书卡片**：配备二维码微缩预览、激光防伪码与官方验真按钮。
4. **特保押运时间轴**：双人押运员编号、温湿度恒温箱状态、顺丰特保押运实时节点动态高亮。

### ⚙️ B 端：精密仪表中枢 (High-Precision Workbench)
1. **Bento Grid 数据看板**：当日 GMV、客单价、待押运、库存告警卡片平铺，数字采用等宽字体与涨跌指示标。
2. **SKU 实时矩阵编辑器**：平铺展示克拉、金属类型、实时在库数、告警阈值与售价，支持行内一键保存与库存快捷 +/- 增减。
3. **双栏/多状态筛选 Tab**：紧凑单行 Tab，带数量徽章（如 `全部 (12)`、`特保押运中 (3)`、`待质检 (2)`），文字**禁止折行**。
4. **实时同步日志抽屉**：透明显示双端 Event 流（WebSocket / EventBus 模拟状态）。

---

## 六、AI 生成禁令与反模式清单 (Anti-Slop Directives)

其他 AI 在生成此风格代码或设计时，**严厉禁止**以下常见劣质模式：

1. ❌ **严禁高饱和紫蓝渐变与赛博朋克霓虹光**（如 `#6366F1` 到 `#EC4899`、青色发光边框等），严禁廉价玻璃拟态。
2. ❌ **严禁卡片套卡片（Nested Cards）**：禁止在一个大卡片里无脑堆叠多层完全相同的阴影边框小卡片，应利用字阶、留白与单像素浅细线（Divider）拉开层级。
3. ❌ **严禁文字折行截断缺陷**：按钮、胶囊 Badge、Tab 选项卡内的文字必须 `whitespace-nowrap`，禁止出现“特保押-”换行到下一行“-运中”的缺陷。
4. ❌ **严禁在浅色背景上使用低对比度浅灰文字**：浅色模式正文对比度必须 ≥ 4.5:1，重要文字必须是深板岩色（`#0F172A`）。
5. ❌ **严禁假数据与空操作插桩**：所有按钮（改价、发货、下架、加入购物袋、筛选）必须具备真实 React State 驱动与事件反馈，严禁死链接或空 `onClick={() => {}}`。
