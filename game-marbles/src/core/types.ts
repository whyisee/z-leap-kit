export type Phase = "menu" | "playing" | "upgrade" | "extraction" | "result" | "paused";
export type MenuView =
  | "home"
  | "settings"
  | "inventory"
  | "roulette"
  | "ranking"
  | "guide"
  | "stagePicker"
  | "heroes"
  | "marbles"
  | "challenges"
  | "collection"
  | "protocols";
export type Rarity = "common" | "rare" | "epic" | "legendary";
export type ExtractionResult = "none" | "extracted" | "cleared" | "failed";
export type BattleMode = "normal" | "endless";
export type CollectibleId = "scrap_shell" | "ancient_chip" | "void_lens" | "boss_core";
export type GemType = "power" | "guard" | "fortune" | "swift" | "focus" | "rupture";
export type EnemyType =
  | "small"
  | "tank"
  | "fast"
  | "splitter"
  | "shield"
  | "healer"
  | "gold"
  | "elite"
  | "boss";
export type MarbleId = "basic" | "split" | "blast" | "burn" | "lightning" | "slow";
export type Speed = 1 | 2 | 4;
export type AutoUpgradeMode = "rarity" | "attack" | "defense" | "income";
export type AutoExtractionMode = "safe" | "balanced" | "deep" | "clear";
export type AutoRunMode = "manual" | "advance" | "repeat";
export type CharacterSortMode = "level" | "rarity" | "power" | "attack";
export type CurrencyId = "coins" | "energyCrystals";
export type ShopCategory = "recommended" | "daily" | "growth" | "crystal" | "bundles";
export type ShopRefreshType = "daily" | "weekly" | "once";
export type ShopTicketId = "insurance" | "scan" | "refresh";
export type CharacterRouteId = string;
export type StageId = string;

export type Vec = {
  x: number;
  y: number;
};

export type SaveData = {
  coins: number;
  energyCrystals: number;
  shards: number;
  runs: number;
  wins: number;
  bestWave: number;
  bestEndlessWave: number;
  selectedStage: StageId;
  progress: StageProgress;
  upgrades: Record<string, number>;
  characters: Record<string, CharacterProgress>;
  lineup: string[];
  inventory: InventoryData;
  marbleLevels: Partial<Record<MarbleId, number>>;
  characterMarbles: Record<string, CharacterMarbleLoadout>;
  baseGems: Array<string | null>;
  tickets: Partial<Record<ShopTicketId, number>>;
  preferences: GamePreferences;
  shop: ShopState;
  collectionRewards: Record<string, boolean>;
};

export type GamePreferences = {
  autoBattleEnabled: boolean;
  autoUpgradeMode: AutoUpgradeMode;
  autoExtractionMode: AutoExtractionMode;
  autoRunMode: AutoRunMode;
  autoSkillEnabled: boolean;
  battleSpeed: Speed;
  characterSortMode: CharacterSortMode;
};

export type StageProgress = {
  unlockedStage: number;
  clearedStages: Record<StageId, StageClearRecord>;
};

export type StageClearRecord = {
  bestWave: number;
  cleared: boolean;
  bestTime: number;
  stars: number;
};

export type InventoryData = {
  collectibles: Partial<Record<CollectibleId, number>>;
  marbleShards: Partial<Record<MarbleId, number>>;
  gems: Record<string, number>;
};

export type ShopState = {
  dailyKey: string;
  weeklyKey: string;
  purchased: Record<string, number>;
  manualRefreshCount: number;
  shardOfferIds: string[];
};

export type ShopItemConfig = {
  id: string;
  category: ShopCategory;
  name: string;
  desc: string;
  price: ShopPrice;
  stock: number;
  refresh: ShopRefreshType;
  unlock?: {
    type: "stage" | "wins";
    value: number;
    desc: string;
  };
  rewards: ShopReward[];
};

export type ShopPrice = {
  currency: CurrencyId;
  amount: number;
};

export type ShopReward =
  | {
      type: "coins";
      amount: number;
    }
  | {
      type: "energyCrystals";
      amount: number;
    }
  | {
      type: "marbleShard";
      marbleId: MarbleId;
      amount: number;
    }
  | {
      type: "randomMarbleShard";
      amount: number;
    }
  | {
      type: "gem";
      gemType: GemType;
      level: number;
      amount: number;
    }
  | {
      type: "collectible";
      collectibleId: CollectibleId;
      amount: number;
    }
  | {
      type: "characterUnlock";
      characterId: string;
    }
  | {
      type: "ticket";
      ticketId: ShopTicketId;
      amount: number;
    };

export type MetaUpgrade = {
  id: string;
  name: string;
  desc: string;
  max: number;
  baseCost: number;
  growth: number;
};

export type CharacterConfig = {
  id: string;
  name: string;
  role: string;
  rarity: Rarity;
  color: string;
  marbles: [MarbleId, MarbleId];
  skillName: string;
  skillDesc: string;
  skillCooldown: number;
  passives: CharacterPassiveSkill[];
  unlock?: CharacterUnlock;
  routes: CharacterRoute[];
};

export type CharacterUnlock =
  | {
      type: "stage";
      stage: number;
      desc: string;
    }
  | {
      type: "wins";
      wins: number;
      desc: string;
    }
  | {
      type: "collectible";
      collectible: CollectibleId;
      amount: number;
      desc: string;
    };

export type CharacterProgress = {
  owned: boolean;
  level: number;
  skillLevel: number;
  routes: Partial<Record<CharacterRouteId, number>>;
};

export type CharacterPassiveSkill = {
  id: string;
  name: string;
  unlockLevel: number;
  desc: string;
};

export type CharacterMarbleLoadout = [MarbleId, MarbleId];

export type CharacterRoute = {
  id: CharacterRouteId;
  name: string;
  focus: string;
  desc: string;
  max: number;
  baseCost: number;
  growth: number;
};

export type CharacterRuntime = CharacterConfig & {
  x: number;
  y: number;
  cooldowns: Record<MarbleId, number>;
  skillTimer: number;
  skillActive: number;
};

export type MarbleConfig = {
  id: MarbleId;
  name: string;
  color: string;
  trail: string;
  tags: string[];
  damage: number;
  cooldown: number;
  speed: number;
  lifetime: number;
  radius: number;
  maxBounce: number;
};

export type CollectibleConfig = {
  id: CollectibleId;
  name: string;
  rarity: Rarity;
  value: number;
  desc: string;
};

export type GemConfig = {
  type: GemType;
  name: string;
  color: string;
  stat: string;
};

export type DropEntry =
  | {
      type: "collectible";
      id: CollectibleId;
      amount: number;
      rarity: Rarity;
    }
  | {
      type: "marbleShard";
      marbleId: MarbleId;
      amount: number;
      rarity: Rarity;
    }
  | {
      type: "gem";
      gemType: GemType;
      level: number;
      amount: number;
      rarity: Rarity;
    };

export type DropVisual = {
  id: number;
  drop: DropEntry;
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  age: number;
  hold: number;
  fly: number;
  seed: number;
  collected: boolean;
};

export type Marble = {
  id: number;
  marbleId: MarbleId;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  lifetime: number;
  bounce: number;
  maxBounce: number;
  hitCount: number;
  pierce: number;
  splitDone: boolean;
  hitCooldown: Map<number, number>;
  trail: Vec[];
  small: boolean;
};

export type EnemyConfig = {
  type: EnemyType;
  name: string;
  color: string;
  hp: number;
  speed: number;
  radius: number;
  exp: number;
  coins: number;
  armor?: number;
};

export type Enemy = {
  id: number;
  type: EnemyType;
  name: string;
  x: number;
  y: number;
  vx: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  exp: number;
  coins: number;
  armor: number;
  rowId: number | null;
  rowSpeed: number | null;
  slowTimer: number;
  slowPower: number;
  burnTimer: number;
  burnDps: number;
  healTimer: number;
  shieldTimer: number;
  bossPhase: number;
  skillTimer: number;
  dead: boolean;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  radius: number;
  color: string;
  text?: string;
};

export type VisualEffect = {
  kind: "engineer-field" | "blast-wave" | "magnet-field";
  x: number;
  y: number;
  life: number;
  maxLife: number;
  radius: number;
  maxRadius: number;
  color: string;
};

export type WaveConfig = {
  wave: number;
  type: "normal" | "pressure" | "reward" | "elite" | "boss";
  targetDuration: number;
  queue: EnemyType[];
  hpMultiplier: number;
  speedMultiplier: number;
  spawnInterval: number;
};

export type StageWaveEvent = {
  wave: number;
  label: string;
  type?: WaveConfig["type"];
  enemies?: EnemyType[];
  countBonus?: number;
  hpMultiplier?: number;
  speedMultiplier?: number;
  spawnIntervalMultiplier?: number;
};

export type StageBossConfig = {
  name: string;
  enemyType: EnemyType;
  desc: string;
  skills: string[];
};

export type StageRewardBias = {
  coins?: number;
  shards?: MarbleId[];
  gems?: GemType[];
  collectibles?: CollectibleId[];
};

export type StageConfig = {
  id: StageId;
  index: number;
  chapter: number;
  stage: number;
  name: string;
  theme: string;
  objective: string;
  enemyBias: EnemyType[];
  featuredEnemies: EnemyType[];
  hpMultiplier: number;
  speedMultiplier: number;
  densityMultiplier: number;
  waveEvents: StageWaveEvent[];
  boss?: StageBossConfig;
  rewardBias: StageRewardBias;
};

export type Modifiers = {
  damageMul: number;
  fireRateMul: number;
  marbleSpeedMul: number;
  critChance: number;
  critDamage: number;
  coinMul: number;
  expMul: number;
  blastRadiusMul: number;
  burnMul: number;
  chainBonus: number;
  slowBonus: number;
  globalPierce: number;
  bounceDamage: number;
  baseRegen: number;
  revive: boolean;
  magnetic: number;
  dropLuck: number;
  tagDamage: Record<string, number>;
  marbleDamage: Partial<Record<MarbleId, number>>;
  cardStacks: Record<string, number>;
};

export type TacticalCardKind = "stackable" | "tiered" | "character" | "utility" | "unique";
export type TacticalTier = "basic" | "middle" | "high";
export type TacticalCardEffectType = "attribute" | "utility" | "hybrid";

export type TacticalUnlock = {
  characters?: string[];
  cards?: string[];
  families?: string[];
};

export type TacticalRarityBoost = {
  uses: number;
  rare?: number;
  epic?: number;
  legendary?: number;
};

export type TacticalState = {
  refreshCharges: number;
  refreshChargesMax: number;
  nextAttributeMultiplier: number;
  nextAttributeMultiplierUses: number;
  rarityBoosts: TacticalRarityBoost[];
  familyBiases: Record<string, number>;
  tagBiases: Record<string, number>;
};

export type UpgradeCard = {
  id: string;
  name: string;
  rarity: Rarity;
  tag: string;
  desc: string;
  kind?: TacticalCardKind;
  effectType?: TacticalCardEffectType;
  familyId?: string;
  tier?: TacticalTier;
  maxStacks?: number | "infinite";
  unlock?: TacticalUnlock;
  weight?: number;
  requires?: (session: Session) => boolean;
  apply: (session: Session) => void;
};

export type Session = {
  phase: Phase;
  mode: BattleMode;
  stageId: StageId;
  wave: number;
  waveConfig: WaveConfig | null;
  spawnQueue: EnemyType[];
  spawnTimer: number;
  waveBannerTimer: number;
  elapsed: number;
  speed: Speed;
  baseHp: number;
  maxBaseHp: number;
  level: number;
  xp: number;
  xpNeed: number;
  coins: number;
  kills: number;
  result: "win" | "lose" | null;
  resultReason: string;
  entities: number;
  characters: CharacterRuntime[];
  enemies: Enemy[];
  marbles: Marble[];
  particles: Particle[];
  effects: VisualEffect[];
  dropVisuals: DropVisual[];
  pendingChoices: UpgradeCard[];
  selectedUpgradeIds: string[];
  drops: DropEntry[];
  insuredDropKeys: string[];
  extractionWindowsSeen: number[];
  extractionResult: ExtractionResult;
  extractedAtWave: number | null;
  lostDrops: DropEntry[];
  heat: number;
  maxHeat: number;
  continueCount: number;
  continueBonus: number;
  tacticState: TacticalState;
  modifiers: Modifiers;
};
