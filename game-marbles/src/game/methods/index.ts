import { gameStatsMethods } from "./stats";
import { gameUiShellMethods } from "./ui-shell";
import { gameHeroUiMethods } from "./ui-heroes";
import { gameCollectionUiMethods } from "./ui-collection";
import { gameShopInventoryUiMethods } from "./ui-shop-inventory";
import { gameBattleFlowMethods } from "./battle-flow";
import { gameBattleCombatMethods } from "./battle-combat";
import { gameBattleUpgradeMethods } from "./battle-upgrades";
import { gameBattleResultLootMethods } from "./battle-results-loot";
import { gameBattleRenderMethods } from "./battle-render";

export const gameMethods = {
  ...gameStatsMethods,
  ...gameUiShellMethods,
  ...gameHeroUiMethods,
  ...gameCollectionUiMethods,
  ...gameShopInventoryUiMethods,
  ...gameBattleFlowMethods,
  ...gameBattleCombatMethods,
  ...gameBattleUpgradeMethods,
  ...gameBattleResultLootMethods,
  ...gameBattleRenderMethods,
} as Record<string, (this: any, ...args: any[]) => any>;
