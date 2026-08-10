import { marbleConfigs } from "./marbles";
import type { BondConfig, CharacterRuntime, MarbleId } from "../core/types";

export const bonds: BondConfig[] = [
  {
    id: "refraction_workshop",
    name: "折射工坊",
    desc: "工程师与棱镜师协同，分裂弹珠更容易形成弹幕。",
    color: "#61e6a8",
    requiredCharacters: ["engineer", "prism"],
    requiredMarbles: ["split"],
    unlockedCardIds: ["bond_refraction_workshop"],
    unlockedCoreIds: ["rebound_fracture", "swarm_growth"],
    applyStart: (session) => {
      session.modifiers.marbleDamage.split = (session.modifiers.marbleDamage.split || 0) + 0.08;
      session.modifiers.cardStacks.bondRefractionWorkshop = 1;
    },
  },
  {
    id: "molten_charge",
    name: "热熔装药",
    desc: "爆破手携带燃烧与爆裂体系，解锁灼爆链式扩散。",
    color: "#ff9f43",
    requiredCharacters: ["bomber"],
    requiredMarbles: ["blast", "burn"],
    requiredFormationId: "pyro",
    unlockedCardIds: ["bond_molten_charge", "core_pyro_chain"],
    unlockedCoreIds: ["pyro_chain_core"],
    applyStart: (session) => {
      session.modifiers.burnMul *= 1.08;
      session.modifiers.blastRadiusMul *= 1.06;
    },
  },
  {
    id: "static_frost_ring",
    name: "静电冰环",
    desc: "闪电与减速形成连锁控制，减速目标更容易被电弧击穿。",
    color: "#54c7ff",
    requiredMarbles: ["lightning", "slow"],
    requiredTags: ["elemental", "control"],
    requiredFormationId: "magnetic",
    unlockedCardIds: ["bond_static_frost_ring", "core_static_frost"],
    unlockedCoreIds: ["static_frost_core"],
    applyStart: (session) => {
      session.modifiers.cardStacks.staticFrostBond = 1;
      session.modifiers.slowBonus += 0.05;
    },
  },
  {
    id: "bulwark_suppression",
    name: "坚壁压制",
    desc: "守卫者与减速弹珠构成防线，底线压力越高越能反打。",
    color: "#ff8fb3",
    requiredCharacters: ["sentinel"],
    requiredMarbles: ["slow"],
    unlockedCardIds: ["bond_bulwark_suppression", "core_last_line"],
    unlockedCoreIds: ["last_line_core"],
    applyStart: (session) => {
      session.maxBaseHp += 1;
      session.baseHp += 1;
      session.modifiers.tagDamage.control = (session.modifiers.tagDamage.control || 0) + 0.08;
    },
  },
  {
    id: "golden_fuel",
    name: "点金燃料",
    desc: "宝藏猎人与炼金体系把金币回收转化为燃烧火力。",
    color: "#ffd56a",
    requiredCharacters: ["treasurer", "alchemist"],
    requiredMarbles: ["burn"],
    requiredFormationId: "bounty",
    unlockedCardIds: ["bond_golden_fuel", "gold_damage"],
    unlockedCoreIds: ["pyro_chain_core", "boss_hunter_core"],
    applyStart: (session) => {
      session.modifiers.coinMul *= 1.08;
      session.modifiers.burnMul *= 1.06;
    },
  },
  {
    id: "void_fracture",
    name: "虚空裂变",
    desc: "虚空使与分裂/爆裂弹珠共鸣，裂隙里会涌出更多小弹幕。",
    color: "#b68cff",
    requiredCharacters: ["voidbinder"],
    requiredMarbles: ["split", "blast"],
    unlockedCardIds: ["bond_void_fracture", "core_rebound_fracture"],
    unlockedCoreIds: ["rebound_fracture", "swarm_growth"],
    applyStart: (session) => {
      session.modifiers.cardStacks.splitLife = (session.modifiers.cardStacks.splitLife || 0) + 1;
      session.modifiers.blastRadiusMul *= 1.04;
    },
  },
  {
    id: "high_frequency_matrix",
    name: "高频矩阵",
    desc: "工程师、磁能师和棱镜师形成高频导流，连锁与分裂更稳定。",
    color: "#54c7ff",
    requiredCharacters: ["engineer", "magnetist", "prism"],
    requiredTags: ["chain"],
    unlockedCardIds: ["bond_high_frequency_matrix", "core_static_frost"],
    unlockedCoreIds: ["static_frost_core", "swarm_growth"],
    applyStart: (session) => {
      session.modifiers.fireRateMul *= 1.05;
      session.modifiers.chainBonus += 1;
    },
  },
  {
    id: "hunt_mark",
    name: "猎核标记",
    desc: "霜语者或高暴击体系锁定精英核心，Boss 战更容易进入回充循环。",
    color: "#f7c756",
    requiredCharacters: ["frostseer"],
    requiredMarbles: ["slow"],
    requiredFormationId: "hunter",
    unlockedCardIds: ["bond_hunt_mark", "core_boss_hunter"],
    unlockedCoreIds: ["boss_hunter_core"],
    applyStart: (session) => {
      session.modifiers.critChance += 0.03;
      session.modifiers.cardStacks.bossDamage = (session.modifiers.cardStacks.bossDamage || 0) + 0.4;
    },
  },
];

export function activeBondsForLoadout(characters: CharacterRuntime[], formationId: string): BondConfig[] {
  const characterIds = new Set(characters.map((character) => character.id));
  const marbleIds = new Set<MarbleId>();
  const tags = new Set<string>();

  for (const character of characters) {
    for (const marbleId of character.marbles) {
      marbleIds.add(marbleId);
      for (const tag of marbleConfigs[marbleId].tags) tags.add(tag);
    }
  }

  return bonds.filter((bond) => {
    if (bond.requiredFormationId && bond.requiredFormationId !== formationId) return false;
    if (bond.requiredCharacters?.some((id) => !characterIds.has(id))) return false;
    if (bond.requiredMarbles?.some((id) => !marbleIds.has(id))) return false;
    if (bond.requiredTags?.some((tag) => !tags.has(tag))) return false;
    return true;
  });
}

export function bondById(id: string) {
  return bonds.find((bond) => bond.id === id);
}
