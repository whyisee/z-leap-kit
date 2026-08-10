export const marbleShapeGroups = [
  {
    id: "legacy",
    label: "现有特效",
    shapes: [
      ["orb", "圆珠", "圆"],
      ["candy", "糖芯", "糖"],
      ["star", "星形", "星"],
      ["leaf", "叶片", "叶"],
      ["crystal", "晶体", "晶"],
      ["bomb", "爆弹", "爆"],
      ["flame", "火焰", "火"],
      ["bolt", "电弧", "电"],
      ["snowflake", "雪晶", "雪"],
      ["ring", "星环", "环"],
      ["flower", "花瓣", "花"],
      ["comet", "彗星", "彗"],
    ],
  },
  {
    id: "basic",
    label: "基础形状",
    shapes: [
      ["circle", "圆形", "圆"],
      ["triangle", "三角形", "△"],
      ["square", "正方形", "□"],
      ["hexagon", "六边形", "六"],
      ["heart", "爱心", "心"],
      ["diamond", "钻石", "钻"],
      ["coin", "金币", "币"],
      ["capsule", "胶囊", "胶"],
      ["drop", "水滴", "滴"],
      ["moon", "月牙", "月"],
      ["shield", "盾牌", "盾"],
      ["gear", "齿轮", "齿"],
      ["cross", "十字", "十"],
      ["egg", "蛋形", "蛋"],
    ],
  },
  {
    id: "cute",
    label: "可爱动物",
    shapes: [
      ["cat", "小猫", "猫"],
      ["dog", "小狗", "狗"],
      ["alpaca", "羊驼", "驼"],
      ["rabbit", "兔子", "兔"],
      ["hamster", "仓鼠", "鼠"],
      ["panda", "熊猫", "熊"],
      ["fox", "狐狸", "狐"],
      ["duck", "小鸭", "鸭"],
      ["penguin", "企鹅", "企"],
      ["seal", "海豹", "豹"],
      ["bear", "小熊", "熊"],
      ["frog", "青蛙", "蛙"],
      ["jellyfish", "水母", "母"],
      ["whale", "鲸鱼", "鲸"],
      ["chick", "小鸡", "鸡"],
      ["dinosaur", "恐龙", "龙"],
    ],
  },
  {
    id: "weapon",
    label: "武器招式",
    shapes: [
      ["sword", "剑", "剑"],
      ["blade", "刀", "刀"],
      ["dagger", "匕首", "匕"],
      ["katana", "太刀", "太"],
      ["spear", "枪矛", "矛"],
      ["axe", "斧头", "斧"],
      ["hammer", "锤子", "锤"],
      ["bow", "弓", "弓"],
      ["arrow", "箭", "箭"],
      ["fist", "拳头", "拳"],
      ["palm", "手掌", "掌"],
      ["finger", "手指", "指"],
      ["fan", "扇子", "扇"],
      ["claw", "爪", "爪"],
      ["shuriken", "手里剑", "忍"],
      ["staff", "法杖", "杖"],
      ["shield_weapon", "战盾", "盾"],
      ["scythe", "镰刀", "镰"],
    ],
  },
  {
    id: "funny",
    label: "搞怪梗物",
    shapes: [
      ["kunkun", "坤坤", "坤"],
      ["basketball", "篮球", "篮"],
      ["practice_basketball", "练习篮球", "练"],
      ["snake", "蛇", "蛇"],
      ["roach", "小强", "强"],
      ["slime", "史莱姆", "史"],
      ["poop", "便便", "便"],
      ["banana", "香蕉", "蕉"],
      ["toast", "吐司", "吐"],
      ["eggplant", "茄子", "茄"],
      ["mushroom", "蘑菇", "菇"],
      ["ufo", "飞碟", "碟"],
      ["ghost", "幽灵", "幽"],
      ["mask", "面具", "面"],
      ["sock", "袜子", "袜"],
      ["fishbone", "鱼骨", "骨"],
      ["brick", "板砖", "砖"],
      ["toilet_plunger", "马桶搋子", "搋"],
      ["rubber_duck", "橡皮鸭", "鸭"],
    ],
  },
] as const;

export type MarbleVisualShape = (typeof marbleShapeGroups)[number]["shapes"][number][0];

export const marbleShapeIds = marbleShapeGroups.flatMap((group) => group.shapes.map(([id]) => id)) as MarbleVisualShape[];
export const marbleShapeLabels = Object.fromEntries(marbleShapeGroups.flatMap((group) => group.shapes.map(([id, label]) => [id, label]))) as Record<MarbleVisualShape, string>;
export const marbleShapeSymbols = Object.fromEntries(marbleShapeGroups.flatMap((group) => group.shapes.map(([id, , symbol]) => [id, symbol]))) as Record<MarbleVisualShape, string>;

const animalShapes = new Set(["cat", "dog", "alpaca", "rabbit", "hamster", "panda", "fox", "duck", "penguin", "seal", "bear", "frog", "jellyfish", "whale", "chick", "dinosaur"]);
const weaponShapes = new Set(["sword", "blade", "dagger", "katana", "spear", "axe", "hammer", "bow", "arrow", "fist", "palm", "finger", "fan", "claw", "shuriken", "staff", "shield_weapon", "scythe"]);
const fireShapes = new Set(["bomb", "flame", "comet", "kunkun", "basketball", "practice_basketball", "banana", "eggplant", "mushroom", "brick", "toilet_plunger"]);
const frostShapes = new Set(["snowflake", "penguin", "seal", "whale", "jellyfish"]);
const petalShapes = new Set(["leaf", "flower", "cat", "dog", "alpaca", "rabbit", "hamster", "panda", "fox", "duck", "bear", "frog", "chick", "dinosaur", "rubber_duck"]);
const crystalShapes = new Set(["crystal", "diamond", "coin", "gear"]);
const galaxyShapes = new Set(["ring", "moon", "ufo", "ghost", "mask"]);
const electricShapes = new Set(["bolt", "triangle", "sword", "blade", "dagger", "katana", "spear", "arrow", "shuriken", "claw", "scythe"]);

export function marbleShapeLabel(shape: string) {
  return marbleShapeLabels[shape as MarbleVisualShape] || marbleShapeLabels.orb;
}

export function marbleShapeSymbol(shape: string) {
  return marbleShapeSymbols[shape as MarbleVisualShape] || "";
}

export function marbleShapeImpactStyle(shape: string) {
  if (electricShapes.has(shape)) return "electric";
  if (fireShapes.has(shape)) return "flare";
  if (frostShapes.has(shape)) return "frost";
  if (petalShapes.has(shape)) return "petal";
  if (galaxyShapes.has(shape)) return "galaxy";
  if (crystalShapes.has(shape)) return "crystal";
  if (shape === "capsule" || shape === "snake" || shape === "sock" || shape === "fishbone") return "ribbon";
  return "spark";
}

export function marbleShapeRotation(shape: string, now: number) {
  if (shape === "ring" || shape === "star" || shape === "flower" || shape === "gear" || shape === "shuriken") return now * 2.4;
  if (shape === "bolt" || shape === "sword" || shape === "blade" || shape === "dagger" || shape === "katana" || shape === "spear" || shape === "arrow" || shape === "scythe") {
    return -0.18 + Math.sin(now * 5) * 0.06;
  }
  if (shape === "leaf" || shape === "comet" || shape === "banana" || shape === "snake") return -0.32;
  return now * 1.05;
}

export function drawMarbleShapePath(ctx: CanvasRenderingContext2D, shape: string, radius: number) {
  if (shape === "triangle") return polygonPath(ctx, radius * 1.1, 3, -Math.PI / 2);
  if (shape === "square" || shape === "brick") return roundedRectPath(ctx, -radius * 0.86, -radius * 0.86, radius * 1.72, radius * 1.72, shape === "brick" ? radius * 0.12 : radius * 0.18);
  if (shape === "hexagon") return polygonPath(ctx, radius * 1.08, 6, Math.PI / 6);
  if (shape === "heart") return heartPath(ctx, radius);
  if (shape === "diamond" || shape === "crystal") return polygonPath(ctx, radius * 1.12, shape === "diamond" ? 4 : 6, -Math.PI / 2);
  if (shape === "coin" || shape === "kunkun" || shape === "basketball" || shape === "practice_basketball") return ellipsePath(ctx, 0, 0, radius * 1.02, radius * 1.02);
  if (shape === "capsule" || shape === "staff" || shape === "finger") return roundedRectPath(ctx, -radius * 0.42, -radius * 1.06, radius * 0.84, radius * 2.12, radius * 0.42);
  if (shape === "drop") return dropPath(ctx, radius);
  if (shape === "moon") return ellipsePath(ctx, 0, 0, radius, radius);
  if (shape === "shield" || shape === "shield_weapon") return shieldPath(ctx, radius);
  if (shape === "gear") return gearPath(ctx, radius);
  if (shape === "cross") return crossPath(ctx, radius);
  if (shape === "egg") return ellipsePath(ctx, 0, radius * 0.08, radius * 0.82, radius * 1.08);
  if (shape === "star") return starPath(ctx, 0, 0, radius * 1.18, radius * 0.52, 5);
  if (shape === "leaf") return leafPath(ctx, radius);
  if (shape === "bomb") return ellipsePath(ctx, 0, radius * 0.08, radius * 0.92, radius * 0.92);
  if (shape === "flame") return flamePath(ctx, radius);
  if (shape === "bolt") return boltPath(ctx, radius);
  if (shape === "snowflake") return polygonPath(ctx, radius * 0.96, 8, -Math.PI / 8);
  if (shape === "flower") return flowerPath(ctx, radius);
  if (shape === "comet") return cometPath(ctx, radius);
  if (shape === "cat") return catHeadPath(ctx, radius);
  if (shape === "dog") return dogHeadPath(ctx, radius);
  if (shape === "alpaca") return alpacaPath(ctx, radius);
  if (shape === "rabbit") return rabbitPath(ctx, radius);
  if (shape === "hamster" || shape === "bear" || shape === "panda" || shape === "frog") return roundAnimalPath(ctx, radius, shape);
  if (shape === "fox") return foxPath(ctx, radius);
  if (shape === "duck" || shape === "rubber_duck" || shape === "chick") return birdPath(ctx, radius);
  if (shape === "penguin" || shape === "seal" || shape === "whale" || shape === "roach" || shape === "slime") return ellipsePath(ctx, 0, radius * 0.06, radius * 1.02, radius * 0.78);
  if (shape === "jellyfish") return jellyfishPath(ctx, radius);
  if (shape === "dinosaur") return dinosaurPath(ctx, radius);
  if (shape === "sword" || shape === "dagger" || shape === "katana") return swordPath(ctx, radius, shape);
  if (shape === "blade") return bladePath(ctx, radius);
  if (shape === "spear" || shape === "arrow") return spearPath(ctx, radius, shape);
  if (shape === "axe") return axePath(ctx, radius);
  if (shape === "hammer") return hammerPath(ctx, radius);
  if (shape === "bow") return bowPath(ctx, radius);
  if (shape === "fist") return fistPath(ctx, radius);
  if (shape === "palm") return palmPath(ctx, radius);
  if (shape === "fan") return fanPath(ctx, radius);
  if (shape === "claw") return clawPath(ctx, radius);
  if (shape === "shuriken") return starPath(ctx, 0, 0, radius * 1.12, radius * 0.38, 4);
  if (shape === "scythe") return scythePath(ctx, radius);
  if (shape === "snake") return snakePath(ctx, radius);
  if (shape === "poop") return poopPath(ctx, radius);
  if (shape === "banana") return bananaPath(ctx, radius);
  if (shape === "toast") return toastPath(ctx, radius);
  if (shape === "eggplant") return eggplantPath(ctx, radius);
  if (shape === "mushroom") return mushroomPath(ctx, radius);
  if (shape === "ufo") return ufoPath(ctx, radius);
  if (shape === "ghost") return ghostPath(ctx, radius);
  if (shape === "mask") return maskPath(ctx, radius);
  if (shape === "sock") return sockPath(ctx, radius);
  if (shape === "fishbone") return fishbonePath(ctx, radius);
  if (shape === "toilet_plunger") return plungerPath(ctx, radius);
  return ellipsePath(ctx, 0, 0, radius, radius);
}

export function drawMarbleShapeDetail(
  ctx: CanvasRenderingContext2D,
  shape: string,
  radius: number,
  options: { color?: string; accent?: string; highlight?: string; label?: string; drawLabel?: boolean; background?: string } = {},
) {
  const accent = options.accent || "#ffffff";
  const highlight = options.highlight || accent;
  const background = options.background || "rgba(4, 9, 16, 0.86)";
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = rgba(highlight, 0.74);
  ctx.fillStyle = "rgba(255,255,255,0.76)";
  ctx.lineWidth = Math.max(1.2, radius * 0.08);

  if (shape === "ring" || shape === "moon") {
    ctx.fillStyle = background;
    ctx.beginPath();
    ctx.arc(shape === "moon" ? radius * 0.32 : 0, 0, radius * (shape === "moon" ? 0.88 : 0.44), 0, Math.PI * 2);
    ctx.fill();
    if (shape === "ring") {
      ctx.strokeStyle = "rgba(255,255,255,0.64)";
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (shape === "candy") {
    line(ctx, -radius * 0.78, radius * 0.56, radius * 0.72, -radius * 0.52, "rgba(255,255,255,0.76)", Math.max(2, radius * 0.22));
  } else if (shape === "leaf") {
    line(ctx, -radius * 0.62, 0, radius * 0.58, 0, "rgba(255,255,255,0.5)", 1.2);
  } else if (shape === "crystal" || shape === "diamond") {
    line(ctx, 0, -radius * 0.9, 0, radius * 0.86, "rgba(255,255,255,0.42)", 1);
    line(ctx, -radius * 0.82, -radius * 0.1, radius * 0.82, -radius * 0.1, "rgba(255,255,255,0.42)", 1);
  } else if (shape === "bomb") {
    ctx.fillStyle = accent;
    roundedRectPath(ctx, -radius * 0.25, -radius * 1.1, radius * 0.5, radius * 0.32, radius * 0.08);
    ctx.fill();
    curve(ctx, 0, -radius * 1.1, radius * 0.48, -radius * 1.45, radius * 0.84, -radius * 1.08, accent, 2);
  } else if (shape === "flame" || shape === "comet") {
    curve(ctx, -radius * 0.34, radius * 0.28, radius * 0.08, -radius * 0.48, radius * 0.42, radius * 0.18, rgba(highlight, 0.58), 1.2);
  } else if (shape === "bolt") {
    linePath(ctx, [[-0.2, -0.42], [0.22, -0.05], [-0.04, 0.02], [0.16, 0.48]], radius, "rgba(255,255,255,0.62)", 1.4);
  } else if (shape === "snowflake") {
    for (let i = 0; i < 6; i += 1) {
      const a = i * (Math.PI / 3);
      line(ctx, Math.cos(a) * radius * 0.18, Math.sin(a) * radius * 0.18, Math.cos(a) * radius * 1.06, Math.sin(a) * radius * 1.06, accent, 1.6);
    }
  } else if (shape === "star") {
    starPath(ctx, 0, 0, radius * 0.46, radius * 0.22, 5);
    ctx.strokeStyle = rgba(highlight, 0.7);
    ctx.stroke();
  } else if (shape === "coin") {
    ctx.strokeStyle = rgba(highlight, 0.72);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    line(ctx, 0, -radius * 0.38, 0, radius * 0.38, rgba(highlight, 0.68), 1.8);
  } else if (shape === "kunkun" || shape === "basketball" || shape === "practice_basketball") {
    ctx.strokeStyle = rgba(background, 0.72);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.78, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.78, Math.PI / 2, Math.PI * 1.5);
    ctx.stroke();
    line(ctx, -radius * 0.82, 0, radius * 0.82, 0, rgba(background, 0.72), 1.4);
    line(ctx, 0, -radius * 0.82, 0, radius * 0.82, rgba(background, 0.72), 1.4);
  } else if (animalShapes.has(shape)) {
    drawAnimalDetail(ctx, shape, radius, accent, highlight, background);
  } else if (weaponShapes.has(shape)) {
    drawWeaponDetail(ctx, shape, radius, accent, highlight, background);
  } else {
    drawObjectDetail(ctx, shape, radius, accent, highlight, background);
  }

  if (shape !== "ring" && shape !== "moon" && shape !== "sword" && shape !== "blade" && shape !== "dagger" && shape !== "katana" && shape !== "spear" && shape !== "arrow" && shape !== "staff") {
    ctx.fillStyle = "rgba(255,255,255,0.76)";
    ctx.beginPath();
    ctx.arc(-radius * 0.28, -radius * 0.34, Math.max(2, radius * 0.18), 0, Math.PI * 2);
    ctx.fill();
  }

  const label = String(options.label || "").slice(0, 2);
  if (options.drawLabel && label && !animalShapes.has(shape) && !weaponShapes.has(shape) && shape !== "bolt" && shape !== "leaf" && shape !== "flame" && shape !== "comet") {
    ctx.fillStyle = "rgba(7, 16, 27, 0.78)";
    ctx.font = "800 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, shape === "bomb" ? radius * 0.12 : 1);
  }
  ctx.restore();
}

function drawAnimalDetail(ctx: CanvasRenderingContext2D, shape: string, r: number, accent: string, highlight: string, background: string) {
  if (shape === "duck" || shape === "rubber_duck" || shape === "chick") {
    ctx.fillStyle = accent;
    triangle(ctx, r * 0.7, -r * 0.06, r * 1.08, -r * 0.2, r * 0.74, r * 0.12);
    ctx.fill();
  }
  if (shape === "whale" || shape === "seal" || shape === "penguin") {
    line(ctx, -r * 0.56, r * 0.25, r * 0.56, r * 0.25, rgba(highlight, 0.4), 1.2);
  }
  if (shape === "jellyfish") {
    for (let i = -2; i <= 2; i += 1) curve(ctx, i * r * 0.18, r * 0.18, i * r * 0.12, r * 0.62, i * r * 0.22, r * 0.9, accent, 1.2);
  }
  if (shape === "dinosaur") {
    for (let i = 0; i < 4; i += 1) {
      triangle(ctx, -r * 0.56 + i * r * 0.3, -r * 0.72, -r * 0.42 + i * r * 0.3, -r * 1.02, -r * 0.26 + i * r * 0.3, -r * 0.72);
      ctx.fillStyle = accent;
      ctx.fill();
    }
  }
  drawEyes(ctx, r, background);
  if (shape === "frog") {
    ctx.strokeStyle = rgba(highlight, 0.64);
    ctx.beginPath();
    ctx.arc(0, r * 0.1, r * 0.32, 0.1, Math.PI - 0.1);
    ctx.stroke();
  } else if (shape !== "jellyfish" && shape !== "whale") {
    line(ctx, -r * 0.14, r * 0.22, r * 0.14, r * 0.22, rgba(background, 0.72), 1.2);
  }
}

function drawWeaponDetail(ctx: CanvasRenderingContext2D, shape: string, r: number, accent: string, highlight: string, background: string) {
  if (shape === "fan") {
    for (let i = -2; i <= 2; i += 1) line(ctx, 0, r * 0.58, i * r * 0.32, -r * 0.58, rgba(highlight, 0.5), 1);
    return;
  }
  if (shape === "fist" || shape === "palm") {
    for (let i = -2; i <= 1; i += 1) line(ctx, i * r * 0.2, -r * 0.5, i * r * 0.2, r * 0.1, rgba(background, 0.56), 1);
    return;
  }
  if (shape === "bow") {
    line(ctx, r * 0.42, -r * 0.78, r * 0.42, r * 0.78, rgba(highlight, 0.66), 1);
    return;
  }
  if (shape === "hammer" || shape === "axe" || shape === "scythe") {
    line(ctx, 0, -r * 0.92, 0, r * 0.92, rgba(background, 0.58), 2);
    return;
  }
  line(ctx, 0, -r * 0.82, 0, r * 0.82, rgba(highlight, 0.54), 1);
}

function drawObjectDetail(ctx: CanvasRenderingContext2D, shape: string, r: number, accent: string, highlight: string, background: string) {
  if (shape === "roach") {
    line(ctx, -r * 0.42, -r * 0.24, r * 0.42, -r * 0.24, rgba(background, 0.5), 1);
    line(ctx, -r * 0.5, r * 0.12, r * 0.5, r * 0.12, rgba(background, 0.5), 1);
    for (let i = -1; i <= 1; i += 1) line(ctx, -r * 0.68, i * r * 0.22, -r * 0.95, i * r * 0.35, rgba(background, 0.52), 1);
    for (let i = -1; i <= 1; i += 1) line(ctx, r * 0.68, i * r * 0.22, r * 0.95, i * r * 0.35, rgba(background, 0.52), 1);
  } else if (shape === "snake") {
    drawEyes(ctx, r * 0.75, background);
    line(ctx, r * 0.48, r * 0.06, r * 0.78, r * 0.02, accent, 1.2);
  } else if (shape === "brick") {
    line(ctx, -r * 0.86, 0, r * 0.86, 0, rgba(highlight, 0.5), 1);
    line(ctx, 0, -r * 0.86, 0, 0, rgba(highlight, 0.5), 1);
    line(ctx, -r * 0.36, 0, -r * 0.36, r * 0.86, rgba(highlight, 0.5), 1);
    line(ctx, r * 0.36, 0, r * 0.36, r * 0.86, rgba(highlight, 0.5), 1);
  } else if (shape === "fishbone") {
    line(ctx, -r * 0.68, 0, r * 0.72, 0, rgba(highlight, 0.8), 2);
    for (let i = -2; i <= 2; i += 1) {
      line(ctx, i * r * 0.22, 0, (i - 0.08) * r * 0.22, -r * 0.32, rgba(highlight, 0.7), 1.2);
      line(ctx, i * r * 0.22, 0, (i - 0.08) * r * 0.22, r * 0.32, rgba(highlight, 0.7), 1.2);
    }
  } else if (shape === "ghost" || shape === "mask") {
    drawEyes(ctx, r, background);
  } else if (shape === "ufo") {
    for (let i = -1; i <= 1; i += 1) {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(i * r * 0.32, r * 0.1, r * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function ellipsePath(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function polygonPath(ctx: CanvasRenderingContext2D, radius: number, sides: number, offset = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = offset + i * ((Math.PI * 2) / sides);
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, outer: number, inner: number, points: number) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + i * (Math.PI / points);
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function heartPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(0, r * 0.82);
  ctx.bezierCurveTo(-r * 1.18, r * 0.12, -r * 0.94, -r * 0.8, -r * 0.32, -r * 0.74);
  ctx.bezierCurveTo(0, -r * 0.72, 0, -r * 0.38, 0, -r * 0.38);
  ctx.bezierCurveTo(0, -r * 0.38, 0, -r * 0.72, r * 0.32, -r * 0.74);
  ctx.bezierCurveTo(r * 0.94, -r * 0.8, r * 1.18, r * 0.12, 0, r * 0.82);
  ctx.closePath();
}

function dropPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.1);
  ctx.bezierCurveTo(r * 0.82, -r * 0.28, r * 0.88, r * 0.72, 0, r * 0.98);
  ctx.bezierCurveTo(-r * 0.88, r * 0.72, -r * 0.82, -r * 0.28, 0, -r * 1.1);
  ctx.closePath();
}

function shieldPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.05);
  ctx.lineTo(r * 0.86, -r * 0.62);
  ctx.lineTo(r * 0.72, r * 0.24);
  ctx.quadraticCurveTo(r * 0.44, r * 0.78, 0, r * 1.08);
  ctx.quadraticCurveTo(-r * 0.44, r * 0.78, -r * 0.72, r * 0.24);
  ctx.lineTo(-r * 0.86, -r * 0.62);
  ctx.closePath();
}

function gearPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 16; i += 1) {
    const a = -Math.PI / 2 + i * (Math.PI / 8);
    const rr = i % 2 === 0 ? r * 1.08 : r * 0.78;
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function crossPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(-r * 0.28, -r);
  ctx.lineTo(r * 0.28, -r);
  ctx.lineTo(r * 0.28, -r * 0.28);
  ctx.lineTo(r, -r * 0.28);
  ctx.lineTo(r, r * 0.28);
  ctx.lineTo(r * 0.28, r * 0.28);
  ctx.lineTo(r * 0.28, r);
  ctx.lineTo(-r * 0.28, r);
  ctx.lineTo(-r * 0.28, r * 0.28);
  ctx.lineTo(-r, r * 0.28);
  ctx.lineTo(-r, -r * 0.28);
  ctx.lineTo(-r * 0.28, -r * 0.28);
  ctx.closePath();
}

function leafPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(-r * 1.12, 0);
  ctx.bezierCurveTo(-r * 0.35, -r * 0.92, r * 0.86, -r * 0.72, r * 1.08, 0);
  ctx.bezierCurveTo(r * 0.54, r * 0.72, -r * 0.48, r * 0.9, -r * 1.12, 0);
  ctx.closePath();
}

function flamePath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(r * 0.95, 0);
  ctx.bezierCurveTo(r * 0.32, -r * 1.12, -r * 0.82, -r * 0.52, -r * 0.78, r * 0.28);
  ctx.bezierCurveTo(-r * 0.68, r * 1.02, r * 0.34, r * 0.9, r * 0.95, 0);
  ctx.closePath();
}

function boltPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(-r * 0.28, -r * 1.08);
  ctx.lineTo(r * 0.74, -r * 0.16);
  ctx.lineTo(r * 0.2, -r * 0.04);
  ctx.lineTo(r * 0.4, r * 1.08);
  ctx.lineTo(-r * 0.74, r * 0.04);
  ctx.lineTo(-r * 0.18, -r * 0.08);
  ctx.closePath();
}

function flowerPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = i * (Math.PI / 3);
    ctx.ellipse(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, r * 0.46, r * 0.26, a, 0, Math.PI * 2);
  }
  ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
}

function cometPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(r * 1.14, 0);
  ctx.quadraticCurveTo(-r * 0.1, -r * 0.95, -r * 1.08, -r * 0.34);
  ctx.quadraticCurveTo(-r * 0.42, 0, -r * 1.08, r * 0.34);
  ctx.quadraticCurveTo(-r * 0.1, r * 0.95, r * 1.14, 0);
  ctx.closePath();
}

function catHeadPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(-r * 0.76, -r * 0.34);
  ctx.lineTo(-r * 0.52, -r * 1.02);
  ctx.lineTo(-r * 0.16, -r * 0.62);
  ctx.lineTo(r * 0.16, -r * 0.62);
  ctx.lineTo(r * 0.52, -r * 1.02);
  ctx.lineTo(r * 0.76, -r * 0.34);
  ctx.arc(0, 0, r * 0.82, -0.42, Math.PI + 0.42, true);
  ctx.closePath();
}

function dogHeadPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.ellipse(-r * 0.62, -r * 0.04, r * 0.26, r * 0.58, -0.25, 0, Math.PI * 2);
  ctx.ellipse(r * 0.62, -r * 0.04, r * 0.26, r * 0.58, 0.25, 0, Math.PI * 2);
  ctx.ellipse(0, 0, r * 0.82, r * 0.78, 0, 0, Math.PI * 2);
}

function alpacaPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.ellipse(-r * 0.34, -r * 0.76, r * 0.14, r * 0.28, -0.15, 0, Math.PI * 2);
  ctx.ellipse(r * 0.34, -r * 0.76, r * 0.14, r * 0.28, 0.15, 0, Math.PI * 2);
  ctx.ellipse(0, -r * 0.06, r * 0.62, r * 1, 0, 0, Math.PI * 2);
}

function rabbitPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, -r * 0.76, r * 0.18, r * 0.54, -0.12, 0, Math.PI * 2);
  ctx.ellipse(r * 0.28, -r * 0.76, r * 0.18, r * 0.54, 0.12, 0, Math.PI * 2);
  ctx.ellipse(0, r * 0.12, r * 0.78, r * 0.72, 0, 0, Math.PI * 2);
}

function roundAnimalPath(ctx: CanvasRenderingContext2D, r: number, shape: string) {
  ctx.beginPath();
  if (shape === "frog") {
    ctx.ellipse(-r * 0.42, -r * 0.62, r * 0.24, r * 0.22, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.42, -r * 0.62, r * 0.24, r * 0.22, 0, 0, Math.PI * 2);
  } else {
    ctx.ellipse(-r * 0.5, -r * 0.56, r * 0.24, r * 0.26, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.5, -r * 0.56, r * 0.24, r * 0.26, 0, 0, Math.PI * 2);
  }
  ctx.ellipse(0, 0, r * 0.82, r * 0.78, 0, 0, Math.PI * 2);
}

function foxPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(-r * 0.82, -r * 0.74);
  ctx.lineTo(-r * 0.4, -r * 0.18);
  ctx.lineTo(0, r * 0.92);
  ctx.lineTo(r * 0.4, -r * 0.18);
  ctx.lineTo(r * 0.82, -r * 0.74);
  ctx.quadraticCurveTo(0, -r * 1.02, -r * 0.82, -r * 0.74);
  ctx.closePath();
}

function birdPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.ellipse(0, r * 0.08, r * 0.84, r * 0.72, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.44, -r * 0.2, r * 0.36, r * 0.34, 0, 0, Math.PI * 2);
}

function jellyfishPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(-r * 0.86, r * 0.2);
  ctx.quadraticCurveTo(-r * 0.72, -r * 0.84, 0, -r * 0.88);
  ctx.quadraticCurveTo(r * 0.72, -r * 0.84, r * 0.86, r * 0.2);
  ctx.lineTo(-r * 0.86, r * 0.2);
  ctx.closePath();
}

function dinosaurPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.ellipse(-r * 0.08, r * 0.05, r * 0.88, r * 0.62, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.55, -r * 0.38, r * 0.38, r * 0.34, 0, 0, Math.PI * 2);
}

function swordPath(ctx: CanvasRenderingContext2D, r: number, shape: string) {
  const width = shape === "dagger" ? 0.2 : shape === "katana" ? 0.3 : 0.26;
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.14);
  ctx.lineTo(r * width, r * 0.42);
  ctx.lineTo(r * 0.62, r * 0.42);
  ctx.lineTo(r * 0.62, r * 0.62);
  ctx.lineTo(r * 0.18, r * 0.62);
  ctx.lineTo(r * 0.18, r);
  ctx.lineTo(-r * 0.18, r);
  ctx.lineTo(-r * 0.18, r * 0.62);
  ctx.lineTo(-r * 0.62, r * 0.62);
  ctx.lineTo(-r * 0.62, r * 0.42);
  ctx.lineTo(-r * width, r * 0.42);
  ctx.closePath();
}

function bladePath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(-r * 0.22, -r * 1.08);
  ctx.quadraticCurveTo(r * 0.72, -r * 0.58, r * 0.28, r * 0.58);
  ctx.lineTo(r * 0.08, r);
  ctx.lineTo(-r * 0.18, r * 0.58);
  ctx.quadraticCurveTo(-r * 0.56, -r * 0.28, -r * 0.22, -r * 1.08);
  ctx.closePath();
}

function spearPath(ctx: CanvasRenderingContext2D, r: number, shape: string) {
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.12);
  ctx.lineTo(r * 0.42, -r * 0.42);
  ctx.lineTo(r * 0.14, -r * 0.42);
  ctx.lineTo(r * 0.14, r * 1.08);
  ctx.lineTo(-r * 0.14, r * 1.08);
  ctx.lineTo(-r * 0.14, -r * 0.42);
  ctx.lineTo(-r * 0.42, -r * 0.42);
  ctx.closePath();
  if (shape === "arrow") {
    ctx.moveTo(-r * 0.48, r * 0.24);
    ctx.lineTo(0, r * 0.56);
    ctx.lineTo(r * 0.48, r * 0.24);
  }
}

function axePath(ctx: CanvasRenderingContext2D, r: number) {
  roundedRectPath(ctx, -r * 0.12, -r * 1.06, r * 0.24, r * 2.02, r * 0.08);
  ctx.moveTo(r * 0.08, -r * 0.82);
  ctx.quadraticCurveTo(r * 0.94, -r * 0.72, r * 0.68, -r * 0.06);
  ctx.quadraticCurveTo(r * 0.38, r * 0.12, r * 0.08, -r * 0.06);
  ctx.closePath();
}

function hammerPath(ctx: CanvasRenderingContext2D, r: number) {
  roundedRectPath(ctx, -r * 0.12, -r * 0.36, r * 0.24, r * 1.36, r * 0.08);
  ctx.moveTo(-r * 0.72, -r * 0.86);
  ctx.lineTo(r * 0.72, -r * 0.86);
  ctx.lineTo(r * 0.72, -r * 0.42);
  ctx.lineTo(-r * 0.72, -r * 0.42);
  ctx.closePath();
}

function bowPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(r * 0.4, -r * 1.02);
  ctx.quadraticCurveTo(-r * 0.78, 0, r * 0.4, r * 1.02);
  ctx.quadraticCurveTo(r * 0.08, 0, r * 0.4, -r * 1.02);
  ctx.closePath();
}

function fistPath(ctx: CanvasRenderingContext2D, r: number) {
  roundedRectPath(ctx, -r * 0.68, -r * 0.64, r * 1.36, r * 1.26, r * 0.34);
}

function palmPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = -2; i <= 2; i += 1) ctx.ellipse(i * r * 0.18, -r * 0.58, r * 0.13, r * 0.46, 0, 0, Math.PI * 2);
  ctx.ellipse(0, r * 0.22, r * 0.58, r * 0.62, 0, 0, Math.PI * 2);
}

function fanPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(0, r * 0.72);
  ctx.arc(0, r * 0.72, r * 1.18, -Math.PI * 0.82, -Math.PI * 0.18);
  ctx.closePath();
}

function clawPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = -1; i <= 1; i += 1) {
    ctx.moveTo(i * r * 0.32, -r);
    ctx.quadraticCurveTo(i * r * 0.18, 0, i * r * 0.1, r);
    ctx.lineTo(i * r * 0.5, r * 0.82);
    ctx.quadraticCurveTo(i * r * 0.4, -r * 0.1, i * r * 0.32, -r);
  }
}

function scythePath(ctx: CanvasRenderingContext2D, r: number) {
  roundedRectPath(ctx, -r * 0.09, -r * 0.86, r * 0.18, r * 1.74, r * 0.08);
  ctx.moveTo(r * 0.02, -r * 0.9);
  ctx.quadraticCurveTo(r * 1.12, -r * 0.58, r * 0.58, r * 0.32);
  ctx.quadraticCurveTo(r * 0.42, -r * 0.22, r * 0.02, -r * 0.52);
  ctx.closePath();
}

function snakePath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.ellipse(-r * 0.2, 0, r * 0.78, r * 0.36, -0.35, 0, Math.PI * 2);
  ctx.ellipse(r * 0.48, -r * 0.18, r * 0.34, r * 0.28, 0.2, 0, Math.PI * 2);
}

function poopPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.ellipse(0, r * 0.5, r * 0.78, r * 0.34, 0, 0, Math.PI * 2);
  ctx.ellipse(0, r * 0.1, r * 0.58, r * 0.32, 0, 0, Math.PI * 2);
  ctx.ellipse(0, -r * 0.32, r * 0.38, r * 0.28, 0, 0, Math.PI * 2);
}

function bananaPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(-r * 0.88, -r * 0.06);
  ctx.quadraticCurveTo(-r * 0.1, r * 1.08, r * 0.92, -r * 0.42);
  ctx.quadraticCurveTo(r * 0.38, r * 0.18, -r * 0.66, r * 0.1);
  ctx.closePath();
}

function toastPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(-r * 0.78, r * 0.82);
  ctx.lineTo(r * 0.78, r * 0.82);
  ctx.lineTo(r * 0.78, -r * 0.18);
  ctx.bezierCurveTo(r * 0.78, -r * 1.02, -r * 0.78, -r * 1.02, -r * 0.78, -r * 0.18);
  ctx.closePath();
}

function eggplantPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.ellipse(0, r * 0.16, r * 0.5, r * 0.92, -0.55, 0, Math.PI * 2);
}

function mushroomPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, -r * 0.1);
  ctx.quadraticCurveTo(0, -r * 1.08, r * 0.9, -r * 0.1);
  ctx.bezierCurveTo(r * 0.64, r * 0.18, -r * 0.64, r * 0.18, -r * 0.9, -r * 0.1);
  ctx.moveTo(-r * 0.32, r * 0.08);
  ctx.lineTo(r * 0.32, r * 0.08);
  ctx.lineTo(r * 0.24, r * 0.92);
  ctx.lineTo(-r * 0.24, r * 0.92);
  ctx.closePath();
}

function ufoPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.ellipse(0, r * 0.16, r * 1.08, r * 0.34, 0, 0, Math.PI * 2);
  ctx.ellipse(0, -r * 0.08, r * 0.5, r * 0.42, 0, Math.PI, Math.PI * 2);
}

function ghostPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(-r * 0.78, r * 0.92);
  ctx.lineTo(-r * 0.78, -r * 0.12);
  ctx.quadraticCurveTo(-r * 0.72, -r * 0.92, 0, -r * 0.96);
  ctx.quadraticCurveTo(r * 0.72, -r * 0.92, r * 0.78, -r * 0.12);
  ctx.lineTo(r * 0.78, r * 0.92);
  ctx.quadraticCurveTo(r * 0.52, r * 0.68, r * 0.26, r * 0.92);
  ctx.quadraticCurveTo(0, r * 0.68, -r * 0.26, r * 0.92);
  ctx.quadraticCurveTo(-r * 0.52, r * 0.68, -r * 0.78, r * 0.92);
  ctx.closePath();
}

function maskPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.96, r * 0.62, 0, 0, Math.PI * 2);
}

function sockPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(-r * 0.38, -r * 1);
  ctx.lineTo(r * 0.34, -r * 1);
  ctx.lineTo(r * 0.28, r * 0.16);
  ctx.quadraticCurveTo(r * 0.78, r * 0.24, r * 0.78, r * 0.66);
  ctx.quadraticCurveTo(r * 0.56, r, -r * 0.24, r * 0.8);
  ctx.quadraticCurveTo(-r * 0.52, r * 0.46, -r * 0.38, -r);
  ctx.closePath();
}

function fishbonePath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.ellipse(-r * 0.68, 0, r * 0.22, r * 0.28, 0, 0, Math.PI * 2);
  ctx.moveTo(r * 0.68, 0);
  ctx.lineTo(r * 1.02, -r * 0.34);
  ctx.lineTo(r * 0.92, 0);
  ctx.lineTo(r * 1.02, r * 0.34);
  ctx.closePath();
}

function plungerPath(ctx: CanvasRenderingContext2D, r: number) {
  roundedRectPath(ctx, -r * 0.1, -r * 1.02, r * 0.2, r * 1.36, r * 0.08);
  ctx.moveTo(-r * 0.56, r * 0.32);
  ctx.lineTo(r * 0.56, r * 0.32);
  ctx.lineTo(r * 0.76, r * 0.92);
  ctx.lineTo(-r * 0.76, r * 0.92);
  ctx.closePath();
}

function drawEyes(ctx: CanvasRenderingContext2D, r: number, color: string) {
  ctx.fillStyle = color;
  for (const x of [-r * 0.26, r * 0.26]) {
    ctx.beginPath();
    ctx.arc(x, -r * 0.1, Math.max(1.4, r * 0.08), 0, Math.PI * 2);
    ctx.fill();
  }
}

function triangle(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function curve(ctx: CanvasRenderingContext2D, x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, color: string, width: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cx, cy, x2, y2);
  ctx.stroke();
}

function linePath(ctx: CanvasRenderingContext2D, points: Array<[number, number]>, r: number, color: string, width: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x * r, y * r);
    else ctx.lineTo(x * r, y * r);
  });
  ctx.stroke();
}

function rgba(color: string, alpha: number) {
  if (!color.startsWith("#")) return color;
  const normalized = color.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  if (!Number.isFinite(value)) return color;
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
