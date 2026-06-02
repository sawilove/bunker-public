/**
 * Weighted bunker survivability score (0–100) at end of game.
 */

function monthsFromDuration(d) {
  if (!d || typeof d !== "object") return 0;
  const y = Number(d.years) || 0;
  const m = Number(d.months) || 0;
  return y * 12 + m;
}

function collectSurvivorCards(players, playerIds) {
  const cards = [];
  for (const id of playerIds) {
    const p = players[id];
    if (!p || p.excluded || !Array.isArray(p.cards)) continue;
    for (const c of p.cards) cards.push(c);
  }
  return cards;
}

function textIncludesAny(text, keywords) {
  const t = String(text || "").toLowerCase();
  return keywords.some((k) => t.includes(k));
}

function scoreSurvivorRoster(players, survivorIds) {
  const cards = collectSurvivorCards(players, survivorIds);
  const professions = cards
    .filter((c) => c.type === "profession")
    .map((c) => `${c.profession || c.value || ""}`.toLowerCase());
  const healthCards = cards.filter((c) => c.type === "health");

  const hasMedic = professions.some((p) =>
    textIncludesAny(p, ["врач", "медик", "фельдшер", "хирург", "медсест", "фармацевт"])
  );
  const severeHealth = healthCards.filter((c) =>
    textIncludesAny(`${c.condition || ""} ${c.conditionLevel || ""} ${c.value || ""}`, [
      "тяжел",
      "критич",
      "смерт",
      "инвалид",
      "паралич",
      "слеп",
      "глух",
    ])
  );
  const mildRatio =
    healthCards.length > 0 ? 1 - severeHealth.length / healthCards.length : 1;
  const uniqueProfessions = new Set(professions.filter(Boolean)).size;

  return { hasMedic, mildRatio, uniqueProfessions, professionCount: professions.length };
}

function computeBunkerSurvivalScore(game) {
  const backstory = game.activeBackstory || {};
  const bunkerSpots = backstory.bunkerSpots ?? game.bunkerSpots ?? 0;
  const survivorIds = Object.keys(game.players || {}).filter(
    (id) => game.players[id] && !game.players[id].excluded
  );
  const survivorsCount = survivorIds.length;
  const roster = scoreSurvivorRoster(game.players, survivorIds);

  const foodMonths = monthsFromDuration(backstory.foodSupply);
  const stayMonths = monthsFromDuration(backstory.stayDuration);
  const conditionText = `${backstory.bunkerCondition || ""}`.toLowerCase();
  const inventoryText = `${backstory.bunkerInventory || ""}`.toLowerCase();

  const criteria = [];

  const spotsOk = bunkerSpots > 0 && survivorsCount === bunkerSpots;
  criteria.push({
    id: "spots",
    label: "Заполнение бункера",
    weight: 20,
    pass: spotsOk,
    detail: spotsOk
      ? `В бункере ${survivorsCount} из ${bunkerSpots} мест — цель достигнута.`
      : `Выживших ${survivorsCount}, мест ${bunkerSpots}.`,
  });

  const foodOk = foodMonths >= 24 || backstory.bunkerParamsPending;
  criteria.push({
    id: "food",
    label: "Запасы продовольствия",
    weight: 15,
    pass: foodOk,
    detail: backstory.foodSupplyLabel
      ? `Продовольствие: ${backstory.foodSupplyLabel}.`
      : "Параметры питания не заданы.",
  });

  const stayOk = stayMonths >= 60 || backstory.bunkerParamsPending;
  criteria.push({
    id: "stay",
    label: "Срок пребывания в бункере",
    weight: 15,
    pass: stayOk,
    detail: backstory.stayDurationLabel
      ? `Срок: ${backstory.stayDurationLabel}.`
      : backstory.yearsLabel || "Срок не указан.",
  });

  const conditionOk =
    !textIncludesAny(conditionText, ["разруш", "завал", "протеч", "обруш", "гнил", "затоп"]) ||
    textIncludesAny(conditionText, ["отлич", "хорош", "норм", "рабоч"]);
  criteria.push({
    id: "condition",
    label: "Состояние убежища",
    weight: 15,
    pass: conditionOk,
    detail: backstory.bunkerCondition
      ? `Состояние: ${backstory.bunkerCondition}.`
      : "Состояние бункера неизвестно.",
  });

  const inventoryOk = textIncludesAny(inventoryText, [
    "аптеч",
    "генератор",
    "фильтр",
    "семен",
    "инструмент",
    "оружие",
    "радио",
    "книг",
  ]);
  criteria.push({
    id: "inventory",
    label: "Полезный инвентарь бункера",
    weight: 10,
    pass: inventoryOk || !backstory.bunkerInventory,
    detail: backstory.bunkerInventory
      ? `Инвентарь: ${backstory.bunkerInventory}.`
      : "Инвентарь не указан.",
  });

  criteria.push({
    id: "medic",
    label: "Медицинский специалист среди выживших",
    weight: 15,
    pass: roster.hasMedic,
    detail: roster.hasMedic
      ? "Среди выживших есть медицинская профессия."
      : "Медицинская профессия среди выживших не обнаружена.",
  });

  const healthOk = roster.mildRatio >= 0.6 || roster.professionCount === 0;
  criteria.push({
    id: "health",
    label: "Состояние здоровья команды",
    weight: 10,
    pass: healthOk,
    detail: healthOk
      ? "Критических заболеваний у большинства нет."
      : "Много тяжёлых состояний здоровья у выживших.",
  });

  const diversityOk = roster.uniqueProfessions >= 3 || survivorsCount <= 2;
  criteria.push({
    id: "diversity",
    label: "Разнообразие профессий",
    weight: 10,
    pass: diversityOk,
    detail: `Уникальных профессий у выживших: ${roster.uniqueProfessions}.`,
  });

  let score = 0;
  let maxScore = 0;
  for (const c of criteria) {
    maxScore += c.weight;
    if (c.pass) score += c.weight;
  }
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  let verdict = "Критический риск";
  if (percent >= 85) verdict = "Высокая выживаемость";
  else if (percent >= 65) verdict = "Умеренная выживаемость";
  else if (percent >= 45) verdict = "Нестабильная выживаемость";

  return {
    score: percent,
    verdict,
    criteria,
    survivorsCount,
    bunkerSpots,
  };
}

module.exports = { computeBunkerSurvivalScore };
