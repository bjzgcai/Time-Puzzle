const fs = require("node:fs");
const path = require("node:path");
const PptxGenJS = require("pptxgenjs");

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "OpenAI Codex";
pptx.company = "OpenAI";
pptx.subject = "Light storytelling PPT from ppt.md";
pptx.title = "把 6 小时的重复劳动，变成一条自动化故事线";
pptx.lang = "zh-CN";

const COLORS = {
  bg: "FFF9F2",
  paper: "FFFFFF",
  ink: "1F2A37",
  muted: "677489",
  line: "E8DED0",
  coral: "F47C6C",
  peach: "FFF1E8",
  teal: "8FC9C1",
  mist: "EEF7F5",
  gold: "F4C86B",
  sand: "F8ECDC",
  sage: "DDEEEB",
};

const FONT = {
  title: "Aptos Display",
  body: "Microsoft YaHei",
};

function addBaseSlide(slide, pageNo) {
  slide.background = { color: COLORS.bg };

  slide.addShape(pptx.ShapeType.ellipse, {
    x: 10.8,
    y: -0.25,
    w: 2.4,
    h: 1.7,
    fill: { color: COLORS.gold, transparency: 58 },
    line: { color: COLORS.gold, transparency: 100 },
  });

  slide.addShape(pptx.ShapeType.ellipse, {
    x: -0.35,
    y: 6.0,
    w: 2.2,
    h: 1.4,
    fill: { color: COLORS.teal, transparency: 70 },
    line: { color: COLORS.teal, transparency: 100 },
  });

  slide.addShape(pptx.ShapeType.line, {
    x: 0.75,
    y: 0.65,
    w: 1.3,
    h: 0,
    line: { color: COLORS.coral, pt: 1.6 },
  });

  slide.addText(String(pageNo).padStart(2, "0"), {
    x: 12.35,
    y: 7.0,
    w: 0.45,
    h: 0.2,
    fontFace: FONT.body,
    fontSize: 10,
    color: COLORS.muted,
    align: "right",
    margin: 0,
  });
}

function addKicker(slide, text, x = 0.85, y = 0.78, w = 3.4) {
  slide.addText(text, {
    x,
    y,
    w,
    h: 0.24,
    fontFace: FONT.body,
    fontSize: 10,
    color: COLORS.coral,
    bold: true,
    margin: 0,
  });
}

function addTitle(slide, title, subtitle) {
  slide.addText(title, {
    x: 0.85,
    y: 1.05,
    w: 7.2,
    h: 1.15,
    fontFace: FONT.title,
    fontSize: 24,
    bold: true,
    color: COLORS.ink,
    margin: 0,
    breakLine: false,
    valign: "mid",
  });

  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.85,
      y: 2.06,
      w: 6.8,
      h: 0.58,
      fontFace: FONT.body,
      fontSize: 11.5,
      color: COLORS.muted,
      margin: 0,
      breakLine: false,
    });
  }
}

function addCard(slide, opts) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: opts.x,
    y: opts.y,
    w: opts.w,
    h: opts.h,
    rectRadius: 0.06,
    fill: { color: opts.fill || COLORS.paper },
    line: { color: opts.line || COLORS.line, pt: 1 },
  });
}

function addLabelPill(slide, text, x, y, w, fill = COLORS.paper, color = COLORS.ink) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.38,
    fill: { color: fill },
    line: { color: fill, pt: 1 },
  });
  slide.addText(text, {
    x: x + 0.12,
    y: y + 0.08,
    w: w - 0.24,
    h: 0.18,
    fontFace: FONT.body,
    fontSize: 9.5,
    color,
    bold: true,
    margin: 0,
    align: "center",
  });
}

function addMetric(slide, x, y, w, value, label, fill) {
  addCard(slide, { x, y, w, h: 1.1, fill, line: fill });
  slide.addText(value, {
    x: x + 0.18,
    y: y + 0.16,
    w: w - 0.36,
    h: 0.3,
    fontFace: FONT.title,
    fontSize: 20,
    bold: true,
    color: COLORS.ink,
    margin: 0,
    align: "center",
  });
  slide.addText(label, {
    x: x + 0.14,
    y: y + 0.58,
    w: w - 0.28,
    h: 0.22,
    fontFace: FONT.body,
    fontSize: 9.5,
    color: COLORS.muted,
    margin: 0,
    align: "center",
  });
}

function addStep(slide, index, title, body, x, y, w, h, fill) {
  addCard(slide, { x, y, w, h, fill, line: fill });
  slide.addShape(pptx.ShapeType.ellipse, {
    x: x + 0.18,
    y: y + 0.18,
    w: 0.36,
    h: 0.36,
    fill: { color: COLORS.coral },
    line: { color: COLORS.coral, pt: 1 },
  });
  slide.addText(String(index), {
    x: x + 0.18,
    y: y + 0.25,
    w: 0.36,
    h: 0.12,
    fontFace: FONT.body,
    fontSize: 9.5,
    bold: true,
    color: COLORS.paper,
    align: "center",
    margin: 0,
  });
  slide.addText(title, {
    x: x + 0.64,
    y: y + 0.16,
    w: w - 0.82,
    h: 0.25,
    fontFace: FONT.body,
    fontSize: 11,
    bold: true,
    color: COLORS.ink,
    margin: 0,
  });
  slide.addText(body, {
    x: x + 0.18,
    y: y + 0.58,
    w: w - 0.36,
    h: h - 0.74,
    fontFace: FONT.body,
    fontSize: 9.5,
    color: COLORS.muted,
    margin: 0,
    valign: "top",
  });
}

function addQuoteBar(slide, text, x, y, w) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.76,
    fill: { color: COLORS.paper },
    line: { color: COLORS.line, pt: 1 },
  });
  slide.addShape(pptx.ShapeType.line, {
    x: x + 0.16,
    y: y + 0.16,
    w: 0,
    h: 0.44,
    line: { color: COLORS.coral, pt: 2.5 },
  });
  slide.addText(text, {
    x: x + 0.32,
    y: y + 0.18,
    w: w - 0.48,
    h: 0.32,
    fontFace: FONT.body,
    fontSize: 11,
    color: COLORS.ink,
    italic: true,
    margin: 0,
  });
}

function addCover() {
  const slide = pptx.addSlide();
  addBaseSlide(slide, 1);

  slide.addShape(pptx.ShapeType.ellipse, {
    x: 8.8,
    y: 0.75,
    w: 3.2,
    h: 3.2,
    fill: { color: COLORS.peach },
    line: { color: COLORS.peach, pt: 1 },
  });

  slide.addShape(pptx.ShapeType.ellipse, {
    x: 10.2,
    y: 1.4,
    w: 1.4,
    h: 1.4,
    fill: { color: COLORS.sage },
    line: { color: COLORS.sage, pt: 1 },
  });

  addKicker(slide, "Light Storytelling Deck");
  slide.addText("把 6 小时的重复劳动\n变成一条自动化故事线", {
    x: 0.85,
    y: 1.15,
    w: 6.8,
    h: 1.5,
    fontFace: FONT.title,
    fontSize: 23,
    bold: true,
    color: COLORS.ink,
    margin: 0,
    breakLine: false,
  });
  slide.addText("从 100+ 项目账单确认，到“先把产物做对，再让浏览器接管重复动作”", {
    x: 0.85,
    y: 2.72,
    w: 6.25,
    h: 0.5,
    fontFace: FONT.body,
    fontSize: 11.5,
    color: COLORS.muted,
    margin: 0,
  });

  addMetric(slide, 0.92, 4.35, 1.9, "100+", "项目数量", COLORS.paper);
  addMetric(slide, 3.0, 4.35, 1.9, "4", "重复步骤", COLORS.paper);
  addMetric(slide, 5.08, 4.35, 1.9, "6h+", "第一次总耗时", COLORS.paper);

  addCard(slide, { x: 8.15, y: 4.15, w: 4.3, h: 1.72, fill: COLORS.paper });
  addLabelPill(slide, "故事主线", 8.4, 4.36, 1.0, COLORS.peach, COLORS.coral);
  slide.addText("不是“AI 一次成功”的故事，\n而是把任务拆成可验证、可接力、可审查的流水线。", {
    x: 8.4,
    y: 4.8,
    w: 3.7,
    h: 0.72,
    fontFace: FONT.body,
    fontSize: 12,
    color: COLORS.ink,
    margin: 0,
  });
}

function addSlide2() {
  const slide = pptx.addSlide();
  addBaseSlide(slide, 2);
  addKicker(slide, "Scene Setting");
  addTitle(slide, "故事从一个夜晚开始", "要做的不是一封邮件，而是一两百次结构完全相同、却又不能出错的邮件。");

  addQuoteBar(slide, "难点不在不会做，而在要做一两百次。", 0.85, 2.82, 5.7);

  addMetric(slide, 0.9, 4.0, 1.8, "11-2月", "账单周期", COLORS.paper);
  addMetric(slide, 2.9, 4.0, 1.8, "H-S", "汇总金额列", COLORS.paper);
  addMetric(slide, 4.9, 4.0, 1.8, "A-L", "使用明细列", COLORS.paper);

  addCard(slide, { x: 7.2, y: 2.55, w: 5.15, h: 3.8, fill: COLORS.paper });
  addLabelPill(slide, "手工流程", 7.5, 2.78, 1.1, COLORS.mist, COLORS.teal);

  addStep(slide, 1, "先找项目编号", "在“按月预算编号分析表”里逐个定位项目。", 7.48, 3.18, 4.55, 0.66, COLORS.peach);
  addStep(slide, 2, "再抄汇总金额", "把 H 列到 S 列的表头和数据整理出来。", 7.48, 3.95, 4.55, 0.66, COLORS.sand);
  addStep(slide, 3, "再查使用明细", "去“总表”里拉出 A 列到 L 列的明细信息。", 7.48, 4.72, 4.55, 0.66, COLORS.mist);
  addStep(slide, 4, "最后写邮件发送", "粘贴内容、核对负责人、逐封确认。", 7.48, 5.49, 4.55, 0.66, COLORS.sage);
}

function addSlide3() {
  const slide = pptx.addSlide();
  addBaseSlide(slide, 3);
  addKicker(slide, "Pain Points");
  addTitle(slide, "为什么这件事特别消耗人", "这类任务真正拖垮人的，不是复杂度，而是重复度和错误成本。");

  addStep(slide, 1, "跨 Sheet 查找", "一个项目要在两个 sheet 之间来回跳转。", 0.9, 2.75, 2.78, 1.55, COLORS.paper);
  addStep(slide, 2, "数据必须完整", "不仅要拿到数字，还要带上表头、格式和上下文。", 3.85, 2.75, 2.78, 1.55, COLORS.paper);
  addStep(slide, 3, "邮件格式敏感", "收件人、主题、正文、表格粘贴，任何一点错都很明显。", 6.8, 2.75, 2.78, 1.55, COLORS.paper);
  addStep(slide, 4, "重复 100+ 次", "每一步都不难，但乘上一两百次以后，体力消耗远超脑力。", 9.75, 2.75, 2.78, 1.55, COLORS.paper);

  addCard(slide, { x: 1.2, y: 4.8, w: 10.95, h: 1.15, fill: COLORS.peach, line: COLORS.peach });
  slide.addText("重复性高 + 错误成本高 = 典型的“适合拆成自动化流水线”的工作", {
    x: 1.55,
    y: 5.1,
    w: 10.2,
    h: 0.28,
    fontFace: FONT.body,
    fontSize: 15,
    bold: true,
    color: COLORS.ink,
    align: "center",
    margin: 0,
  });
}

function addSlide4() {
  const slide = pptx.addSlide();
  addBaseSlide(slide, 4);
  addKicker(slide, "Attempt One");
  addTitle(slide, "第一次出击：让 AI 直接替我发邮件", "思路很自然：既然步骤清楚，那就让模型从提取到发送一口气做完。");

  addCard(slide, { x: 0.9, y: 2.7, w: 5.45, h: 3.25, fill: COLORS.paper });
  addLabelPill(slide, "给 AI 的任务", 1.18, 2.96, 1.25, COLORS.mist, COLORS.teal);
  slide.addText("1. 提取项目汇总信息和明细信息\n2. 按项目生成内容\n3. 起草到邮箱草稿箱\n4. 直接进入发送流程", {
    x: 1.18,
    y: 3.42,
    w: 4.75,
    h: 1.7,
    fontFace: FONT.body,
    fontSize: 12,
    color: COLORS.ink,
    margin: 0,
    breakLine: false,
  });

  addCard(slide, { x: 6.75, y: 2.7, w: 5.65, h: 3.25, fill: COLORS.paper });
  addLabelPill(slide, "出现的问题", 7.03, 2.96, 1.25, COLORS.peach, COLORS.coral);
  slide.addText("1. 项目负责人填写有误\n2. 输出没有表格化\n3. 邮箱里出现乱码\n4. 结果无法放心直接发出", {
    x: 7.03,
    y: 3.42,
    w: 4.95,
    h: 1.7,
    fontFace: FONT.body,
    fontSize: 12,
    color: COLORS.ink,
    margin: 0,
    breakLine: false,
  });

  addQuoteBar(slide, "结果：失败。总共耗时 6 个小时以上，熬夜到 12 点。", 1.45, 6.2, 10.15);
}

function addSlide5() {
  const slide = pptx.addSlide();
  addBaseSlide(slide, 5);
  addKicker(slide, "Turning Point");
  addTitle(slide, "转折点：先把产物做对，再谈自动发送", "真正的改变不是换一个更强的提示词，而是重排任务顺序。");

  addCard(slide, { x: 0.95, y: 2.85, w: 3.75, h: 2.3, fill: COLORS.paper });
  addLabelPill(slide, "原则 1", 1.22, 3.1, 0.9, COLORS.peach, COLORS.coral);
  slide.addText("先抽取事实", {
    x: 1.22,
    y: 3.58,
    w: 2.9,
    h: 0.28,
    fontFace: FONT.body,
    fontSize: 16,
    bold: true,
    color: COLORS.ink,
    margin: 0,
  });
  slide.addText("先把项目编号、汇总金额、使用明细拿稳，减少生成阶段的自由发挥。", {
    x: 1.22,
    y: 4.0,
    w: 3.0,
    h: 0.62,
    fontFace: FONT.body,
    fontSize: 11,
    color: COLORS.muted,
    margin: 0,
  });

  addCard(slide, { x: 4.82, y: 2.85, w: 3.75, h: 2.3, fill: COLORS.paper });
  addLabelPill(slide, "原则 2", 5.08, 3.1, 0.9, COLORS.mist, COLORS.teal);
  slide.addText("先生成中间产物", {
    x: 5.08,
    y: 3.58,
    w: 2.9,
    h: 0.28,
    fontFace: FONT.body,
    fontSize: 16,
    bold: true,
    color: COLORS.ink,
    margin: 0,
  });
  slide.addText("让结果先落成可审查的 Markdown 或 HTML，而不是直接发给项目负责人。", {
    x: 5.08,
    y: 4.0,
    w: 3.0,
    h: 0.62,
    fontFace: FONT.body,
    fontSize: 11,
    color: COLORS.muted,
    margin: 0,
  });

  addCard(slide, { x: 8.7, y: 2.85, w: 3.75, h: 2.3, fill: COLORS.paper });
  addLabelPill(slide, "原则 3", 8.97, 3.1, 0.9, COLORS.sand, COLORS.ink);
  slide.addText("最后再接浏览器自动化", {
    x: 8.97,
    y: 3.58,
    w: 3.0,
    h: 0.28,
    fontFace: FONT.body,
    fontSize: 16,
    bold: true,
    color: COLORS.ink,
    margin: 0,
  });
  slide.addText("自动化不直接碰“对外发送”，而是接管重复录入和草稿起草。", {
    x: 8.97,
    y: 4.0,
    w: 3.0,
    h: 0.62,
    fontFace: FONT.body,
    fontSize: 11,
    color: COLORS.muted,
    margin: 0,
  });

  addQuoteBar(slide, "从“让 AI 替我做完”改成“让 AI 和浏览器接力做对”。", 1.15, 5.7, 10.9);
}

function addSlide6() {
  const slide = pptx.addSlide();
  addBaseSlide(slide, 6);
  addKicker(slide, "Attempt Two");
  addTitle(slide, "第二次出击：HTML 成为关键中间产物", "这一步没有直接发送邮件，却一下子吃掉了 80% 的工作量。");

  addCard(slide, { x: 0.92, y: 2.7, w: 7.2, h: 3.2, fill: COLORS.paper });
  addLabelPill(slide, "新的任务拆法", 1.2, 2.95, 1.3, COLORS.mist, COLORS.teal);

  addStep(slide, 1, "抽取项目汇总与明细", "从 Excel 中稳定取出表头和表数据。", 1.18, 3.38, 2.0, 1.66, COLORS.peach);
  addStep(slide, 2, "生成表格化 HTML", "方便直接粘贴到邮箱，同时保留结构。", 3.42, 3.38, 2.0, 1.66, COLORS.sand);
  addStep(slide, 3, "人工挨个粘贴发送", "把“从零编写”变成“最后确认”。", 5.66, 3.38, 2.0, 1.66, COLORS.mist);

  slide.addShape(pptx.ShapeType.chevron, {
    x: 3.12,
    y: 4.0,
    w: 0.2,
    h: 0.36,
    fill: { color: COLORS.coral },
    line: { color: COLORS.coral, pt: 1 },
    rotate: 180,
  });
  slide.addShape(pptx.ShapeType.chevron, {
    x: 5.36,
    y: 4.0,
    w: 0.2,
    h: 0.36,
    fill: { color: COLORS.coral },
    line: { color: COLORS.coral, pt: 1 },
    rotate: 180,
  });

  addCard(slide, { x: 8.5, y: 2.7, w: 3.9, h: 3.2, fill: COLORS.peach, line: COLORS.peach });
  addLabelPill(slide, "阶段性成果", 8.82, 2.98, 1.15, COLORS.paper, COLORS.coral);
  slide.addText("80%", {
    x: 8.88,
    y: 3.55,
    w: 1.65,
    h: 0.45,
    fontFace: FONT.title,
    fontSize: 28,
    bold: true,
    color: COLORS.ink,
    margin: 0,
  });
  slide.addText("的工作量已经被消化。\n剩下的是审核、粘贴和发送。", {
    x: 8.88,
    y: 4.1,
    w: 2.8,
    h: 0.8,
    fontFace: FONT.body,
    fontSize: 12,
    color: COLORS.ink,
    margin: 0,
  });
  slide.addText("额外收获：还能让另一个大模型独立生成 HTML，再做交叉比较，降低错误概率。", {
    x: 8.88,
    y: 5.1,
    w: 2.82,
    h: 0.55,
    fontFace: FONT.body,
    fontSize: 10,
    color: COLORS.muted,
    margin: 0,
  });
}

function addSlide7() {
  const slide = pptx.addSlide();
  addBaseSlide(slide, 7);
  addKicker(slide, "Attempt Three");
  addTitle(slide, "第三次出击：浏览器接管最后一段重复动作", "当中间产物已经可信，浏览器自动化才真正有用。");

  addCard(slide, { x: 0.88, y: 2.75, w: 12.0, h: 3.4, fill: COLORS.paper });
  addLabelPill(slide, "自动化接力", 1.18, 3.0, 1.15, COLORS.mist, COLORS.teal);
  addLabelPill(slide, "Comet", 10.0, 3.0, 0.85, COLORS.peach, COLORS.coral);
  addLabelPill(slide, "Antigravity", 10.98, 3.0, 1.15, COLORS.paper, COLORS.ink);

  addStep(slide, 1, "先试跑前三个项目", "只起草少量草稿，先人工确认是否准确。", 1.18, 3.52, 2.15, 1.8, COLORS.peach);
  addStep(slide, 2, "确认后再批量起草", "把 HTML 内容自动粘贴到钉钉邮箱草稿箱。", 3.52, 3.52, 2.15, 1.8, COLORS.sand);
  addStep(slide, 3, "切换模型再校验", "让另一个模型检查草稿和 HTML 是否一致。", 5.86, 3.52, 2.15, 1.8, COLORS.mist);
  addStep(slide, 4, "最后再发送", "把真正不可逆的一步留到最后。", 8.2, 3.52, 2.15, 1.8, COLORS.sage);
  addStep(slide, 5, "人始终握住开关", "自动化负责重复动作，人负责验收和决策。", 10.54, 3.52, 1.95, 1.8, COLORS.paper);
}

function addSlide8() {
  const slide = pptx.addSlide();
  addBaseSlide(slide, 8);
  addKicker(slide, "Wrap-up");
  addTitle(slide, "最后的收获，不只是省时间", "这次真正跑通的，是一套“人审查、AI 生成、浏览器执行”的协作方式。");

  addCard(slide, { x: 0.9, y: 2.8, w: 2.8, h: 2.1, fill: COLORS.paper });
  addCard(slide, { x: 3.95, y: 2.8, w: 2.8, h: 2.1, fill: COLORS.paper });
  addCard(slide, { x: 7.0, y: 2.8, w: 2.8, h: 2.1, fill: COLORS.paper });
  addCard(slide, { x: 10.05, y: 2.8, w: 2.35, h: 2.1, fill: COLORS.paper });

  slide.addText("中间产物\n比一步到位更重要", {
    x: 1.2,
    y: 3.28,
    w: 2.2,
    h: 0.62,
    fontFace: FONT.body,
    fontSize: 16,
    bold: true,
    color: COLORS.ink,
    align: "center",
    margin: 0,
  });

  slide.addText("自动化应该分层\n不要一开始就碰发送", {
    x: 4.25,
    y: 3.28,
    w: 2.2,
    h: 0.62,
    fontFace: FONT.body,
    fontSize: 16,
    bold: true,
    color: COLORS.ink,
    align: "center",
    margin: 0,
  });

  slide.addText("双模型交叉核对\n能显著降低风险", {
    x: 7.3,
    y: 3.28,
    w: 2.2,
    h: 0.62,
    fontFace: FONT.body,
    fontSize: 16,
    bold: true,
    color: COLORS.ink,
    align: "center",
    margin: 0,
  });

  slide.addText("人保留\n最后验收权", {
    x: 10.32,
    y: 3.28,
    w: 1.8,
    h: 0.62,
    fontFace: FONT.body,
    fontSize: 16,
    bold: true,
    color: COLORS.ink,
    align: "center",
    margin: 0,
  });

  addQuoteBar(slide, "AI 不是魔法棒，而是把体力活拆成可验证的装配线。", 1.35, 5.55, 10.4);

  slide.addText("下一步可以继续把“负责人信息校验”和“模板参数化”结构化，离真正的一键完成就只差最后一道验收开关。", {
    x: 1.35,
    y: 6.38,
    w: 10.4,
    h: 0.34,
    fontFace: FONT.body,
    fontSize: 10.5,
    color: COLORS.muted,
    align: "center",
    margin: 0,
  });
}

async function main() {
  addCover();
  addSlide2();
  addSlide3();
  addSlide4();
  addSlide5();
  addSlide6();
  addSlide7();
  addSlide8();

  const outputDir = path.join(__dirname, "..", "dist");
  fs.mkdirSync(outputDir, { recursive: true });
  const fileName = path.join(outputDir, "billing-storytelling-light.pptx");
  await pptx.writeFile({ fileName });
  console.log(fileName);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
