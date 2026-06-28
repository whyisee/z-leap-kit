import { rarityLabel } from "../../core/rarity";
import type { UpgradeCard } from "../../core/types";
import { upgradeCardTierLabel, upgradeCardTypeLabel } from "../../systems/progression/tactical-upgrades";

export function upgradeCardHtml(card: UpgradeCard, index: number) {
  const tierLabel = upgradeCardTierLabel(card);
  const typeLabel = upgradeCardTypeLabel(card);
  return `
    <button class="choice-card ${card.rarity}" type="button" data-choice="${index}">
      <span class="choice-meta">
        <span>${rarityLabel(card.rarity)}</span>
        <span>${card.tag}</span>
      </span>
      <span class="choice-badges">
        <span>${typeLabel}</span>
        ${tierLabel ? `<span>${tierLabel}阶</span>` : ""}
      </span>
      <strong>${card.name}</strong>
      <p>${card.desc}</p>
    </button>
  `;
}
