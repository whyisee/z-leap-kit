import { rarityLabel } from "../../core/rarity";
import type { TacticalChoiceSource, UpgradeCard } from "../../core/types";
import { upgradeCardTierLabel, upgradeCardTypeLabel } from "../../systems/progression/tactical-upgrades";

const sourceLabel: Record<TacticalChoiceSource, string> = {
  deck: "卡组",
  formation: "阵法",
  bond: "羁绊",
  core: "核心",
  wild: "随机",
};

export function upgradeCardHtml(card: UpgradeCard, index: number) {
  const tierLabel = upgradeCardTierLabel(card);
  const typeLabel = upgradeCardTypeLabel(card);
  const source = card.choiceSource ? sourceLabel[card.choiceSource] : "";
  return `
    <div class="choice-card-wrap">
      <button class="choice-card ${card.rarity}" type="button" data-choice="${index}">
        <span class="choice-meta">
          <span>${rarityLabel(card.rarity)}</span>
          <span>${card.tag}</span>
        </span>
        <span class="choice-badges">
          ${source ? `<span>${source}</span>` : ""}
          <span>${typeLabel}</span>
          ${tierLabel ? `<span>${tierLabel}阶</span>` : ""}
        </span>
        <strong>${card.name}</strong>
        <p>${card.desc}</p>
      </button>
      <button class="choice-card-lock" type="button" data-upgrade-lock="${index}">锁定</button>
    </div>
  `;
}
