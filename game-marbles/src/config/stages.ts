import type { CollectibleId, EnemyType, GemType, MarbleId, StageBossConfig, StageConfig, StageRewardBias, StageWaveEvent } from "../core/types";

type StageSeed = {
  name: string;
  theme: string;
  objective: string;
  enemyBias: EnemyType[];
  featuredEnemies: EnemyType[];
  events: StageWaveEvent[];
  boss?: StageBossConfig;
  rewardBias?: StageRewardBias;
};

const chapterThemes = [
  {
    name: "废城外环",
    rewardBias: {
      shards: ["basic", "split"] as MarbleId[],
      gems: ["power", "swift"] as GemType[],
      collectibles: ["scrap_shell"] as CollectibleId[],
    },
  },
  {
    name: "磁轨工厂",
    rewardBias: {
      shards: ["lightning", "slow"] as MarbleId[],
      gems: ["guard", "focus"] as GemType[],
      collectibles: ["ancient_chip"] as CollectibleId[],
    },
  },
  {
    name: "熔火管道",
    rewardBias: {
      shards: ["blast", "burn"] as MarbleId[],
      gems: ["power", "rupture"] as GemType[],
      collectibles: ["void_lens"] as CollectibleId[],
    },
  },
  {
    name: "幽蓝数据层",
    rewardBias: {
      shards: ["lightning", "slow", "split"] as MarbleId[],
      gems: ["fortune", "focus", "rupture"] as GemType[],
      collectibles: ["void_lens"] as CollectibleId[],
    },
  },
  {
    name: "天穹防线",
    rewardBias: {
      shards: ["basic", "split", "blast", "burn", "lightning", "slow"] as MarbleId[],
      gems: ["power", "guard", "fortune", "swift", "focus", "rupture"] as GemType[],
      collectibles: ["boss_core"] as CollectibleId[],
    },
  },
];

const stageSeeds: StageSeed[][] = [
  [
    stage("外环巡检", "基础小怪", "清理废城入口，守住第一条防线。", ["small", "fast"], ["small"], [
      event(5, "小怪群", ["small"], 4),
      event(10, "轻量快速怪", ["fast", "small"], 2),
      event(15, "厚血小怪", ["small", "tank"], 3, 1.12),
    ]),
    stage("斜街追击", "快速怪初登场", "适应更快的突破节奏。", ["small", "fast", "fast"], ["fast"], [
      event(5, "快速怪", ["fast"], 3, 1, 1.08),
      event(10, "左右夹击", ["fast", "small"], 4, 1, 1.08),
      event(15, "快速混编", ["fast", "fast", "small"], 4, 1, 1.12),
    ]),
    stage("铁壳路障", "厚甲怪初登场", "击穿高生命敌人的推进。", ["small", "tank", "tank"], ["tank"], [
      event(5, "厚甲队", ["tank"], 2, 1.12),
      event(10, "厚甲护小怪", ["tank", "small"], 4, 1.1),
      event(15, "厚甲连队", ["tank", "tank", "small"], 4, 1.16),
    ]),
    stage("裂片巷口", "分裂怪初登场", "处理分裂后的二次压力。", ["small", "splitter", "fast"], ["splitter"], [
      event(5, "分裂队", ["splitter"], 2),
      event(10, "分裂追击", ["splitter", "fast"], 3),
      event(15, "分裂密集", ["splitter", "splitter", "small"], 5, 1.08),
    ]),
    stage("废街看守", "小 BOSS 关", "击败街区守卫。", ["small", "tank", "splitter", "fast"], ["tank", "splitter"], [
      event(5, "厚甲护卫", ["tank", "small"], 3, 1.12),
      event(10, "分裂护卫", ["splitter", "small"], 4),
      event(15, "快速夹击", ["fast", "fast", "tank"], 5, 1.12, 1.1),
      bossEvent("街区守卫"),
    ], boss("街区守卫", "大型灰色方块，四角有护甲边。", ["召唤小方块", "半血获得短暂护甲"])),
    stage("金属回收线", "金币怪诱饵", "在收益和防线之间做取舍。", ["small", "gold", "fast"], ["gold"], [
      event(5, "金币怪", ["gold", "small"], 3),
      event(10, "金币追击", ["gold", "fast"], 4),
      event(15, "金币后压", ["gold", "tank", "fast"], 4, 1.12),
    ], undefined, { coins: 1.18 }),
    stage("断桥压力", "双段压力波", "处理慢速厚甲和快速冲刺的节奏变化。", ["small", "tank", "fast"], ["tank", "fast"], [
      event(5, "慢速厚甲", ["tank", "small"], 3, 1.14, 0.95),
      event(10, "快速冲刺", ["fast", "fast"], 4, 1, 1.14),
      event(15, "混合压力", ["tank", "fast", "splitter"], 5, 1.12),
    ]),
    stage("弹幕试验场", "反弹收益", "用多弹和反弹处理高密度敌群。", ["small", "splitter", "gold"], ["splitter"], [
      event(5, "数量提升", ["small", "splitter"], 5),
      event(10, "密集小怪", ["small", "small", "fast"], 6),
      event(15, "分裂弹幕", ["splitter", "splitter", "small"], 6, 1.08),
    ]),
    stage("外环总攻", "混合复习", "应对第一章全部基础机制。", ["small", "fast", "tank", "splitter"], ["fast", "tank", "splitter"], [
      event(5, "快速波", ["fast", "small"], 4, 1, 1.12),
      event(10, "厚甲波", ["tank", "tank", "small"], 4, 1.15),
      event(15, "分裂诱饵", ["splitter", "gold", "fast"], 5, 1.12),
    ]),
    stage("旧城核心", "章节 BOSS", "摧毁废城外环核心。", ["small", "fast", "tank", "splitter", "shield"], ["shield", "splitter"], [
      event(5, "精英护卫", ["elite", "small"], 2, 1.14),
      event(10, "分裂海", ["splitter", "splitter", "small"], 6, 1.12),
      event(15, "厚甲队", ["tank", "shield", "small"], 5, 1.18),
      bossEvent("旧城核心"),
    ], boss("旧城核心", "发光核心方块，外圈旋转护盾。", ["释放护盾波", "低血量加速", "分段召唤分裂怪"]), { coins: 1.25, collectibles: ["ancient_chip"] }),
  ],
  [
    stage("工厂入口", "护盾怪初登场", "识别并处理护盾单位。", ["small", "shield", "tank"], ["shield"], [event(5, "护盾队", ["shield"], 3), event(10, "护盾小队", ["shield", "small"], 4), event(15, "护盾厚甲", ["shield", "tank"], 4, 1.14)]),
    stage("传送履带", "速度提高", "压制履带上的高速敌人。", ["fast", "fast", "shield"], ["fast"], [event(5, "快速怪", ["fast"], 4, 1, 1.12), event(10, "快速护盾", ["fast", "shield"], 4, 1.08, 1.12), event(15, "高速冲刺", ["fast", "fast", "shield"], 5, 1.1, 1.16)]),
    stage("修复车间", "治疗怪初登场", "优先清除治疗源。", ["small", "healer", "tank"], ["healer"], [event(5, "治疗护卫", ["healer", "small"], 2), event(10, "治疗厚甲", ["healer", "tank"], 4, 1.12), event(15, "双治疗", ["healer", "healer", "tank"], 4, 1.15)]),
    stage("高压磁道", "连续压力", "承受更短间隔的持续出怪。", ["fast", "shield", "small"], ["fast", "shield"], [event(5, "短间隔", ["fast", "small"], 5, 1, 1.08, 0.84), event(10, "护盾短间隔", ["shield", "fast"], 5, 1.08, 1.1, 0.82), event(15, "连续高压", ["fast", "shield", "tank"], 6, 1.12, 1.12, 0.78)]),
    stage("履带监管者", "小 BOSS 关", "击败履带监管者。", ["fast", "shield", "healer", "tank"], ["shield", "healer"], [event(5, "护盾波", ["shield", "small"], 4, 1.12), event(10, "治疗波", ["healer", "tank"], 4, 1.15), event(15, "快速护卫", ["fast", "fast", "shield"], 5, 1.12, 1.14), bossEvent("履带监管者")], boss("履带监管者", "履带核心监管单元。", ["周期推进", "召唤护盾块", "低血量提速"])),
    stage("磁能仓库", "护盾密集", "拆解大面积护盾阵型。", ["shield", "shield", "tank"], ["shield"], [event(5, "护盾群", ["shield", "shield"], 5), event(10, "厚甲护盾", ["tank", "shield"], 5, 1.15), event(15, "护盾治疗", ["shield", "healer", "tank"], 5, 1.18)]),
    stage("故障流水线", "分批出怪", "处理间歇性爆发。", ["small", "fast", "shield"], ["fast"], [event(4, "第一批爆发", ["fast", "small"], 5, 1, 1.08, 0.8), event(8, "第二批爆发", ["shield", "fast"], 5, 1.1, 1.1, 0.8), event(12, "第三批爆发", ["fast", "tank"], 5, 1.15, 1.12, 0.78), event(16, "终段爆发", ["shield", "fast", "healer"], 6, 1.2, 1.14, 0.76)]),
    stage("维修中枢", "治疗链", "打断治疗链条。", ["healer", "shield", "tank"], ["healer"], [event(5, "治疗链", ["healer", "small"], 3), event(10, "治疗护盾", ["healer", "shield"], 4, 1.12), event(15, "双治疗精英", ["healer", "healer", "elite"], 3, 1.18)]),
    stage("磁轨暴走", "快速护盾混合", "章末压力预演。", ["fast", "shield", "healer", "tank"], ["fast", "shield"], [event(5, "快速", ["fast", "fast"], 5, 1, 1.14), event(10, "护盾", ["shield", "shield"], 5, 1.14), event(15, "快速护盾", ["fast", "shield", "healer"], 6, 1.18, 1.16)]),
    stage("磁轨主控机", "章节 BOSS", "摧毁磁轨主控机。", ["fast", "shield", "healer", "tank", "elite"], ["shield", "healer"], [event(5, "护盾护卫", ["shield", "shield", "small"], 5, 1.15), event(10, "治疗队", ["healer", "tank"], 5, 1.2), event(15, "高速冲锋", ["fast", "fast", "shield"], 7, 1.18, 1.18), bossEvent("磁轨主控机")], boss("磁轨主控机", "磁轨工厂主控核心。", ["群体套盾", "召唤治疗块", "磁暴提速"]), { coins: 1.28, gems: ["guard", "focus", "swift"] }),
  ],
  [
    stage("热管入口", "厚甲增多", "击穿熔火管道入口。", ["tank", "tank", "small"], ["tank"], [event(5, "厚甲", ["tank"], 4, 1.18), event(10, "厚甲群", ["tank", "tank"], 5, 1.2), event(15, "厚甲治疗", ["tank", "healer"], 5, 1.22)]),
    stage("裂焰支路", "分裂密集", "清理持续裂变敌群。", ["splitter", "splitter", "tank"], ["splitter"], [event(5, "分裂", ["splitter"], 4), event(10, "分裂海", ["splitter", "splitter"], 7, 1.12), event(15, "分裂厚甲", ["splitter", "tank"], 6, 1.2)]),
    stage("高温压力阀", "高密度", "承受高温阀门持续释放。", ["small", "tank", "splitter"], ["tank"], [event(5, "数量提升", ["small", "tank"], 6, 1.14, 1.05, 0.85), event(10, "中段密度", ["splitter", "tank"], 6, 1.18, 1.06, 0.82), event(15, "高温洪流", ["small", "splitter", "tank"], 8, 1.22, 1.08, 0.78)]),
    stage("熔渣回收站", "金币诱饵厚甲", "在收益诱惑后处理厚甲压力。", ["gold", "tank", "fast"], ["gold", "tank"], [event(5, "金币诱饵", ["gold", "small"], 5), event(10, "厚甲回收", ["gold", "tank"], 5, 1.18), event(15, "收益后压", ["gold", "tank", "fast"], 6, 1.22, 1.1)], undefined, { coins: 1.22 }),
    stage("熔炉巡卫", "小 BOSS 关", "击败熔炉巡卫。", ["tank", "splitter", "healer"], ["tank", "splitter"], [event(5, "厚甲", ["tank", "tank"], 5, 1.22), event(10, "分裂", ["splitter", "splitter"], 6, 1.14), event(15, "治疗厚甲", ["healer", "tank", "tank"], 5, 1.25), bossEvent("熔炉巡卫")], boss("熔炉巡卫", "熔火管道巡逻装甲。", ["周期减伤", "召唤厚甲", "低血量分裂怪群"])),
    stage("灼热转角", "生命提升", "面对更厚的敌人基础盘。", ["tank", "small", "healer"], ["tank"], [event(5, "高生命", ["tank", "small"], 5, 1.25), event(10, "高生命队", ["tank", "tank"], 5, 1.28), event(15, "厚甲治疗", ["tank", "healer"], 5, 1.3)]),
    stage("管道塌方", "小怪洪流", "用范围输出清理塌方怪潮。", ["small", "splitter", "fast"], ["splitter"], [event(5, "小怪洪流", ["small", "small"], 8), event(10, "分裂洪流", ["splitter", "small"], 7, 1.12), event(15, "高速洪流", ["fast", "splitter", "small"], 8, 1.14, 1.12)]),
    stage("熔火护送", "精英治疗", "击破治疗护送阵型。", ["elite", "healer", "tank"], ["elite", "healer"], [event(8, "精英", ["elite", "tank"], 2, 1.22), event(12, "治疗护送", ["healer", "tank"], 5, 1.22), event(15, "治疗护精英", ["healer", "elite"], 3, 1.26)]),
    stage("赤热线圈", "混合高压", "处理高生命混合总攻。", ["fast", "tank", "splitter", "healer"], ["tank", "splitter"], [event(5, "快速厚甲", ["fast", "tank"], 5, 1.22, 1.12), event(10, "分裂厚甲", ["splitter", "tank"], 6, 1.24), event(15, "混合高压", ["fast", "tank", "splitter", "healer"], 7, 1.28, 1.12)]),
    stage("熔火巨像", "章节 BOSS", "击倒熔火巨像。", ["tank", "splitter", "healer", "elite"], ["tank", "healer"], [event(5, "厚甲护卫", ["tank", "tank"], 6, 1.28), event(10, "分裂群", ["splitter", "splitter"], 7, 1.2), event(15, "治疗队", ["healer", "tank", "elite"], 5, 1.32), bossEvent("熔火巨像")], boss("熔火巨像", "地下熔炉中的巨型装甲核心。", ["硬化减伤", "分段召唤厚甲", "低血量分裂怪潮"]), { coins: 1.32, collectibles: ["void_lens"] }),
  ],
  [
    stage("数据浅层", "快速重组", "压制数据层高速重组体。", ["fast", "fast", "splitter"], ["fast"], [event(5, "快速重组", ["fast"], 6, 1.12, 1.18), event(10, "快速分裂", ["fast", "splitter"], 6, 1.16, 1.18), event(15, "高速潮", ["fast", "fast", "shield"], 7, 1.2, 1.2)]),
    stage("蓝屏裂缝", "护盾治疗", "拆解护盾治疗组合。", ["shield", "healer", "fast"], ["shield", "healer"], [event(5, "护盾", ["shield", "small"], 5, 1.16), event(10, "护盾治疗", ["shield", "healer"], 5, 1.2), event(15, "治疗裂缝", ["healer", "shield", "fast"], 6, 1.22, 1.12)]),
    stage("回声队列", "分裂快速", "处理分裂死亡后的高速压力。", ["splitter", "fast", "fast"], ["splitter", "fast"], [event(5, "分裂回声", ["splitter", "fast"], 6, 1.16), event(10, "快速队列", ["fast", "fast"], 7, 1.14, 1.18), event(15, "回声爆发", ["splitter", "splitter", "fast"], 7, 1.2, 1.18)]),
    stage("数据潮汐", "波次压缩", "承受每 5 波后的高密度潮汐。", ["small", "fast", "shield"], ["fast", "shield"], [event(5, "潮汐一", ["fast", "small"], 7, 1.16, 1.12, 0.78), event(10, "潮汐二", ["shield", "fast"], 7, 1.2, 1.14, 0.76), event(15, "潮汐三", ["fast", "shield", "healer"], 8, 1.25, 1.16, 0.74)]),
    stage("镜像守门人", "小 BOSS 关", "击败镜像守门人。", ["shield", "healer", "fast", "splitter"], ["shield", "healer"], [event(5, "护盾", ["shield", "shield"], 5, 1.2), event(10, "治疗", ["healer", "shield"], 5, 1.22), event(15, "快速分裂", ["fast", "splitter", "shield"], 7, 1.24, 1.16), bossEvent("镜像守门人")], boss("镜像守门人", "幽蓝数据层的镜像守卫。", ["复制低血量镜像", "镜像存活本体减伤", "镜像死亡召唤快速怪"])),
    stage("幽蓝缓存", "护盾刷新", "持续拆盾并维持输出。", ["shield", "shield", "healer"], ["shield"], [event(5, "护盾刷新", ["shield", "small"], 6, 1.18), event(10, "厚盾缓存", ["shield", "tank"], 6, 1.24), event(15, "护盾治疗", ["shield", "healer"], 6, 1.26)]),
    stage("递归分裂", "分裂强化", "面对更高生命的分裂怪。", ["splitter", "splitter", "shield"], ["splitter"], [event(5, "递归一", ["splitter"], 6, 1.22), event(10, "递归二", ["splitter", "splitter"], 7, 1.25), event(15, "递归三", ["splitter", "shield"], 7, 1.28)]),
    stage("数据清道夫", "精英频繁", "在高频精英中稳定推进。", ["elite", "fast", "shield"], ["elite"], [event(8, "精英一", ["elite", "fast"], 3, 1.25), event(12, "精英二", ["elite", "shield"], 3, 1.28), event(16, "精英三", ["elite", "healer"], 3, 1.3)]),
    stage("蓝层崩塌", "全机制混合", "处理幽蓝层全部机制。", ["fast", "shield", "healer", "splitter", "elite"], ["fast", "healer", "shield"], [event(5, "快速", ["fast", "fast"], 7, 1.2, 1.18), event(10, "护盾治疗", ["shield", "healer"], 6, 1.26), event(15, "分裂混合", ["splitter", "fast", "shield"], 8, 1.3, 1.16)]),
    stage("幽蓝主脑", "章节 BOSS", "击破幽蓝主脑。", ["fast", "shield", "healer", "splitter", "elite"], ["shield", "healer", "elite"], [event(5, "快速", ["fast", "fast", "shield"], 7, 1.24, 1.18), event(10, "治疗护盾", ["healer", "shield"], 6, 1.3), event(15, "精英混合", ["elite", "shield", "healer"], 4, 1.34), bossEvent("幽蓝主脑")], boss("幽蓝主脑", "幽蓝数据层的污染主脑。", ["周期加盾", "召唤治疗", "制造镜像干扰"]), { coins: 1.36, gems: ["fortune", "focus", "rupture"] }),
  ],
  [
    stage("防线集结", "混合基础", "适应终章混合敌群。", ["small", "fast", "tank", "shield", "splitter"], ["fast", "tank"], [event(5, "混合一", ["small", "fast", "tank"], 7, 1.28, 1.12), event(10, "混合二", ["shield", "splitter"], 7, 1.3), event(15, "混合三", ["fast", "tank", "shield"], 8, 1.34, 1.16)]),
    stage("高速突围", "快速强化", "用控制阻止高速突围。", ["fast", "fast", "shield", "healer"], ["fast"], [event(5, "高速一", ["fast", "fast"], 8, 1.24, 1.22), event(10, "高速护盾", ["fast", "shield"], 7, 1.3, 1.24), event(15, "高速治疗", ["fast", "healer"], 7, 1.34, 1.25)]),
    stage("装甲洪流", "厚甲护盾", "击穿终章装甲阵线。", ["tank", "tank", "shield"], ["tank", "shield"], [event(5, "厚甲", ["tank", "tank"], 7, 1.36), event(10, "厚甲护盾", ["tank", "shield"], 7, 1.4), event(15, "装甲洪流", ["tank", "tank", "shield"], 8, 1.45)]),
    stage("维修堡垒", "治疗核心", "突破治疗保护的精英。", ["healer", "tank", "elite", "shield"], ["healer", "elite"], [event(5, "治疗护卫", ["healer", "tank"], 6, 1.34), event(10, "治疗精英", ["healer", "elite"], 4, 1.42), event(15, "维修堡垒", ["healer", "shield", "elite"], 5, 1.46)]),
    stage("防线破坏者", "小 BOSS 关", "阻止防线破坏者冲刺。", ["fast", "tank", "shield", "healer"], ["fast", "shield"], [event(5, "厚甲", ["tank", "tank"], 7, 1.38), event(10, "护盾", ["shield", "shield"], 7, 1.4), event(15, "治疗快速", ["healer", "fast", "shield"], 8, 1.45, 1.2), bossEvent("防线破坏者")], boss("防线破坏者", "专门冲击基地防线的突击核心。", ["周期冲刺", "冲刺后召唤快速怪", "低血量获得护盾"])),
    stage("双线危机", "两段压力", "同时应对速度和厚甲。", ["fast", "tank", "shield"], ["fast", "tank"], [event(5, "前半快速", ["fast", "fast"], 8, 1.3, 1.24), event(10, "后半厚甲", ["tank", "tank"], 7, 1.45), event(15, "双线混合", ["fast", "tank", "shield"], 8, 1.48, 1.2)]),
    stage("精英集群", "精英高频", "检验局外养成强度。", ["elite", "shield", "healer", "tank"], ["elite"], [event(8, "精英一", ["elite", "shield"], 4, 1.42), event(12, "精英二", ["elite", "healer"], 4, 1.46), event(16, "精英三", ["elite", "tank"], 4, 1.5), event(19, "精英四", ["elite", "shield", "healer"], 4, 1.52)]),
    stage("终端过载", "极高密度", "用成熟构筑处理过载洪流。", ["small", "fast", "splitter", "shield"], ["splitter", "fast"], [event(5, "过载一", ["small", "fast"], 9, 1.32, 1.18, 0.72), event(10, "过载二", ["splitter", "fast"], 9, 1.42, 1.2, 0.7), event(15, "过载三", ["shield", "splitter", "fast"], 10, 1.5, 1.22, 0.68)]),
    stage("最后一夜", "全机制总攻", "最终 BOSS 前的综合压测。", ["small", "fast", "tank", "splitter", "shield", "healer", "elite"], ["elite", "healer", "shield"], [event(5, "主题一", ["fast", "tank"], 8, 1.38, 1.2), event(10, "主题二", ["shield", "healer"], 7, 1.46), event(15, "主题三", ["splitter", "elite"], 7, 1.54), event(19, "BOSS 护卫", ["elite", "shield", "healer"], 5, 1.58)]),
    stage("天穹核心", "最终 BOSS", "击败天穹核心，完成前期最终挑战。", ["small", "fast", "tank", "splitter", "shield", "healer", "elite"], ["elite", "boss"], [event(5, "精英", ["elite", "tank"], 5, 1.5), event(10, "双机制", ["shield", "healer", "fast"], 8, 1.56, 1.22), event(15, "全场压迫", ["elite", "shield", "healer", "splitter"], 8, 1.65, 1.24), bossEvent("天穹核心")], boss("天穹核心", "前期最终核心。", ["四阶段转换", "周期护盾", "治疗精英护卫", "最终压迫"]), { coins: 1.5, collectibles: ["boss_core"], gems: ["power", "guard", "fortune", "swift", "focus", "rupture"] }),
  ],
];

export const stages: StageConfig[] = stageSeeds.flatMap((chapterStages, chapterIndex) => {
  const chapter = chapterIndex + 1;
  return chapterStages.map((seed, stageIndex) => {
    const stageNo = stageIndex + 1;
    const index = chapterIndex * 10 + stageNo;
    const chapterBase = chapterThemes[chapterIndex];
    const bossBonus = stageNo === 10 ? 0.2 : stageNo === 5 ? 0.1 : 0;
    return {
      id: stageId(chapter, stageNo),
      index,
      chapter,
      stage: stageNo,
      name: seed.name,
      theme: seed.theme,
      objective: seed.objective,
      enemyBias: seed.enemyBias,
      featuredEnemies: seed.featuredEnemies,
      hpMultiplier: round(0.82 + chapter * 0.48 + stageNo * 0.105 + bossBonus),
      speedMultiplier: round(0.95 + chapter * 0.045 + stageNo * 0.012 + bossBonus * 0.18),
      densityMultiplier: round(0.86 + chapter * 0.065 + stageNo * 0.018 + bossBonus * 0.2),
      waveEvents: seed.events,
      boss: seed.boss,
      rewardBias: {
        ...chapterBase.rewardBias,
        ...(seed.rewardBias || {}),
      },
    };
  });
});

export function stageId(chapter: number, stage: number) {
  return `c${chapter}s${stage}`;
}

export function getStageById(id: string | undefined) {
  return stages.find((stage) => stage.id === id) || stages[0];
}

export function getStageByIndex(index: number) {
  return stages[Math.max(0, Math.min(stages.length - 1, Math.floor(index) - 1))] || stages[0];
}

function stage(
  name: string,
  theme: string,
  objective: string,
  enemyBias: EnemyType[],
  featuredEnemies: EnemyType[],
  events: StageWaveEvent[],
  boss?: StageBossConfig,
  rewardBias?: StageRewardBias,
): StageSeed {
  return { name, theme, objective, enemyBias, featuredEnemies, events, boss, rewardBias };
}

function event(
  wave: number,
  label: string,
  enemies: EnemyType[],
  countBonus = 0,
  hpMultiplier = 1,
  speedMultiplier = 1,
  spawnIntervalMultiplier = 1,
): StageWaveEvent {
  return {
    wave,
    label,
    enemies,
    countBonus,
    hpMultiplier,
    speedMultiplier,
    spawnIntervalMultiplier,
  };
}

function bossEvent(label: string): StageWaveEvent {
  return {
    wave: 20,
    label,
    type: "boss",
    enemies: ["boss"],
    hpMultiplier: 1.2,
    speedMultiplier: 1,
  };
}

function boss(name: string, desc: string, skills: string[]): StageBossConfig {
  return {
    name,
    enemyType: "boss",
    desc,
    skills,
  };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
