/**
 * Weighted bunker survivability score (0–100) at end of game.
 */

function monthsFromDuration(d) {
  if (!d || typeof d !== "object") return 0;
  const y = Number(d.years) || 0;
  const m = Number(d.months) || 0;
  return y * 12 + m;
}

function textIncludesAny(text, keywords) {
  const t = String(text || "").toLowerCase();
  return keywords.some((k) => t.includes(k));
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

function parseGenderAgeCard(card) {
  const val = String(card?.value || "");
  const genderMatch = val.match(/^(Мужской|Женский)/i);
  let gender = null;
  if (genderMatch) {
    gender = genderMatch[1].toLowerCase().startsWith("муж") ? "male" : "female";
  }
  const ageMatch = val.match(/(\d{1,3})\s*(?:год|года|лет)/i);
  const age = ageMatch ? parseInt(ageMatch[1], 10) : null;
  return { gender, age, raw: val };
}

function analyzeSurvivorDemographics(players, survivorIds) {
  const people = [];
  for (const id of survivorIds) {
    const cards = players[id]?.cards || [];
    const ga = cards.find((c) => c.type === "gender_age");
    if (ga) people.push(parseGenderAgeCard(ga));
  }
  const ages = people.map((p) => p.age).filter((a) => Number.isFinite(a));
  const males = people.filter((p) => p.gender === "male");
  const females = people.filter((p) => p.gender === "female");
  const reproMale = males.filter((p) => p.age >= 16 && p.age <= 55);
  const reproFemale = females.filter((p) => p.age >= 16 && p.age <= 50);
  const elderly = ages.filter((a) => a >= 65);
  const children = ages.filter((a) => a < 12);
  const workingAge = ages.filter((a) => a >= 18 && a <= 60);

  return {
    people,
    ages,
    males: males.length,
    females: females.length,
    reproMale: reproMale.length,
    reproFemale: reproFemale.length,
    elderly: elderly.length,
    children: children.length,
    workingAge: workingAge.length,
  };
}

/**
 * Связь запаса еды и срока пребывания: общий и «на душу» баланс.
 */
function analyzeFoodStayBalance(backstory, survivorCount, bunkerSpots) {
  if (backstory.bunkerParamsPending) {
    return {
      pending: true,
      pass: true,
      label: "без данных сценария",
      foodMonths: 0,
      stayMonths: 0,
      mouths: survivorCount,
      bunkerCoverage: null,
      perCapitaRatio: null,
      surplusMonths: null,
      perCapitaSurplusMonths: null,
      detail: "Параметры бункера будут известны после старта.",
      analysis: [],
    };
  }

  const foodMonths = monthsFromDuration(backstory.foodSupply);
  const stayMonths = monthsFromDuration(backstory.stayDuration);
  const mouths = Math.max(survivorCount, 1);
  const spots = Math.max(bunkerSpots || mouths, mouths);

  const bunkerCoverage = stayMonths > 0 ? foodMonths / stayMonths : null;
  const perCapitaFood = foodMonths / mouths;
  const perCapitaNeed = stayMonths;
  const perCapitaRatio = perCapitaNeed > 0 ? perCapitaFood / perCapitaNeed : null;
  const surplusMonths = foodMonths - stayMonths;
  const perCapitaSurplusMonths = perCapitaFood - perCapitaNeed;
  const strainFactor = mouths / spots;
  const adjustedCoverage =
    bunkerCoverage != null ? bunkerCoverage / strainFactor : null;

  let status = "critical";
  let pass = false;
  if (bunkerCoverage == null) {
    status = "unknown";
    pass = true;
  } else if (adjustedCoverage >= 1.15 && perCapitaRatio >= 1) {
    status = "comfortable";
    pass = true;
  } else if (adjustedCoverage >= 1 && perCapitaRatio >= 0.85) {
    status = "balanced";
    pass = true;
  } else if (adjustedCoverage >= 0.75 || perCapitaRatio >= 0.7) {
    status = "tight";
    pass = false;
  } else {
    status = "critical";
    pass = false;
  }

  const foodLabel = backstory.foodSupplyLabel || `${foodMonths} мес.`;
  const stayLabel = backstory.stayDurationLabel || backstory.yearsLabel || `${stayMonths} мес.`;

  const analysis = [
    `Срок в бункере: ${stayLabel} (${stayMonths} мес.).`,
    `Запас еды: ${foodLabel} (${foodMonths} мес. при базовой норме).`,
    bunkerCoverage != null
      ? `Соотношение еда/срок (бункер): ×${bunkerCoverage.toFixed(2)} — ${
          bunkerCoverage >= 1 ? "еды хватает на весь срок" : "еды не хватает на весь срок"
        }.`
      : null,
    perCapitaRatio != null
      ? `На ${mouths} чел.: ${perCapitaFood.toFixed(1)} мес. еды на человека при потребности ${perCapitaNeed} мес. (коэф. ${perCapitaRatio.toFixed(2)}).`
      : null,
    strainFactor > 1
      ? `Бункер переполнен (${mouths} из ${spots} мест) — расход еды на человека ниже номинала.`
      : strainFactor < 1
        ? `Запас рассчитан на ${spots} мест, выживших ${mouths} — запас на душу выше.`
        : null,
    surplusMonths != null
      ? `Запас сверх срока: ${surplusMonths >= 0 ? "+" : ""}${surplusMonths} мес. (всего по бункеру).`
      : null,
  ].filter(Boolean);

  const statusRu = {
    comfortable: "комфортный запас",
    balanced: "сбалансировано",
    tight: "на грани",
    critical: "критический дефицит",
    unknown: "не оценено",
  };

  return {
    pending: false,
    pass,
    status,
    foodMonths,
    stayMonths,
    mouths,
    bunkerSpots: spots,
    bunkerCoverage,
    perCapitaRatio,
    adjustedCoverage,
    surplusMonths,
    perCapitaSurplusMonths,
    strainFactor,
    foodLabel,
    stayLabel,
    detail: `Баланс еды и срока: ${statusRu[status] || status}. ${analysis[analysis.length - 1] || ""}`,
    analysis,
  };
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
  const demo = analyzeSurvivorDemographics(game.players, survivorIds);
  const foodStay = analyzeFoodStayBalance(backstory, survivorsCount, bunkerSpots);

  const stayMonths = foodStay.stayMonths;
  const conditionText = `${backstory.bunkerCondition || ""}`.toLowerCase();
  const inventoryText = `${backstory.bunkerInventory || ""}`.toLowerCase();

  const criteria = [];

  const spotsOk = bunkerSpots > 0 && survivorsCount === bunkerSpots;
  criteria.push({
    id: "spots",
    label: "Заполнение бункера",
    weight: 15,
    pass: spotsOk,
    detail: spotsOk
      ? `В бункере ${survivorsCount} из ${bunkerSpots} мест — цель достигнута.`
      : `Выживших ${survivorsCount}, мест ${bunkerSpots}.`,
  });

  criteria.push({
    id: "food_stay",
    label: "Баланс еды и срока пребывания",
    weight: 20,
    pass: foodStay.pass,
    detail: foodStay.detail,
  });

  const conditionOk =
    !textIncludesAny(conditionText, ["разруш", "завал", "протеч", "обруш", "гнил", "затоп"]) ||
    textIncludesAny(conditionText, ["отлич", "хорош", "норм", "рабоч"]);
  criteria.push({
    id: "condition",
    label: "Состояние убежища",
    weight: 12,
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
    weight: 8,
    pass: inventoryOk || !backstory.bunkerInventory,
    detail: backstory.bunkerInventory
      ? `Инвентарь: ${backstory.bunkerInventory}.`
      : "Инвентарь не указан.",
  });

  criteria.push({
    id: "medic",
    label: "Медицинский специалист среди выживших",
    weight: 12,
    pass: roster.hasMedic,
    detail: roster.hasMedic
      ? "Среди выживших есть медицинская профессия."
      : "Медицинская профессия среди выживших не обнаружена.",
  });

  const healthOk = roster.mildRatio >= 0.6 || roster.professionCount === 0;
  criteria.push({
    id: "health",
    label: "Состояние здоровья команды",
    weight: 8,
    pass: healthOk,
    detail: healthOk
      ? "Критических заболеваний у большинства нет."
      : "Много тяжёлых состояний здоровья у выживших.",
  });

  const diversityOk = roster.uniqueProfessions >= 3 || survivorsCount <= 2;
  criteria.push({
    id: "diversity",
    label: "Разнообразие профессий",
    weight: 8,
    pass: diversityOk,
    detail: `Уникальных профессий у выживших: ${roster.uniqueProfessions}.`,
  });

  const agesKnown = demo.ages.length;
  const tooOld = demo.ages.filter((a) => a > 72);
  const tooYoung = demo.ages.filter((a) => a < 8);
  const stayYears = stayMonths / 12;
  const longStayHard = stayYears >= 15 && tooOld.length > 0;
  const ageOk =
    agesKnown === 0 ||
    (!longStayHard &&
      tooYoung.length === 0 &&
      demo.workingAge >= Math.min(2, survivorsCount) &&
      demo.elderly <= 1);
  criteria.push({
    id: "age",
    label: "Возраст выживших и срок в бункере",
    weight: 9,
    pass: ageOk,
    detail:
      agesKnown === 0
        ? "Карты возраста не раскрыты — оценка пропущена."
        : ageOk
          ? `Возраста совместимы с пребыванием ~${stayYears.toFixed(1)} лет: рабочих ${demo.workingAge}, детей ${demo.children}, пожилых ${demo.elderly}.`
          : `Риск: при сроке ~${stayYears.toFixed(1)} лет не все смогут дожить (пожилых ${demo.elderly}, детей ${demo.children}, крайних возрастов ${tooOld.length + tooYoung.length}).`,
  });

  const reproOk =
    demo.people.length === 0 ||
    (demo.reproMale >= 1 && demo.reproFemale >= 1 && survivorsCount >= 2);
  criteria.push({
    id: "reproduction",
    label: "Продолжение рода (пол и возраст)",
    weight: 8,
    pass: reproOk,
    detail: reproOk
      ? `Среди выживших есть мужчины и женщины репродуктивного возраста (♂ ${demo.reproMale}, ♀ ${demo.reproFemale}).`
      : `Недостаточно пар для продолжения рода: мужчин 16–55 лет — ${demo.reproMale}, женщин 16–50 — ${demo.reproFemale}.`,
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
    foodStayAnalysis: foodStay,
    demographics: {
      ages: demo.ages,
      males: demo.males,
      females: demo.females,
      reproMale: demo.reproMale,
      reproFemale: demo.reproFemale,
    },
  };
}

module.exports = {
  computeBunkerSurvivalScore,
  analyzeFoodStayBalance,
  analyzeSurvivorDemographics,
};
