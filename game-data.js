const MODES = [
  {
    id: "classic",
    name: "Классика",
    description: "Раунды раскрытия и отбор по официальной таблице мест.",
  },
  {
    id: "express",
    name: "Экспресс",
    description: "Меньше раундов обсуждения.",
  },
  {
    id: "hardcore",
    name: "Хардкор",
    description: "Жёсткие решения и давление на группу.",
  },
];

const BACKSTORIES = [
  {
    id: "nuclear",
    scene: "scene0",
    title: "Ядерная зима",
    text: "Взрывы уничтожили города. Радиация и холод снаружи. Запасов хватит на полгода.",
    yearsInBunker: 25,
  },
  {
    id: "pandemic",
    scene: "scene1",
    title: "Пандемия",
    text: "Вирус мутировал. Снаружи — карантин и беспорядки. Фильтры воздуха изношены.",
    yearsInBunker: 3,
  },
  {
    id: "flood",
    scene: "scene2",
    title: "Наводнение",
    text: "Уровень океана поднялся на десятки метров. Генератор бункера на исходе.",
    yearsInBunker: 5,
  },
  {
    id: "meteor",
    scene: "scene3",
    title: "Падение метеорита",
    text: "Удар вызвал «зиму» из пыли. Солнце не пробивается месяцами.",
    yearsInBunker: 10,
  },
  {
    id: "ai",
    scene: "scene4",
    title: "Восстание машин",
    text: "ИИ перехватил инфраструктуру. Дроны патрулируют поверхность.",
    yearsInBunker: 7,
  },
  {
    id: "solar",
    scene: "scene5",
    title: "Солнечный гипершторм",
    text: "Вспышка на Солнце вывела из строя электронику. Снаружи — жара и сбои сетей.",
    yearsInBunker: 2,
  },
  {
    id: "fungus",
    scene: "scene6",
    title: "Грибковая биоинвазия",
    text: "Споры проникли везде. Фильтры и герметичность — единственная защита.",
    yearsInBunker: 8,
  },
  {
    id: "evolution",
    scene: "scene7",
    title: "Обратная эволюция",
    text: "Неизвестный фактор меняет ДНК. Мир снаружи становится непредсказуемым.",
    yearsInBunker: 12,
  },
];

function formatYearsInBunker(years) {
  const n = Math.abs(Math.floor(years));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} год`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} года`;
  return `${n} лет`;
}

function getScenarioPreview(settings) {
  if (settings.backstoryRandom) {
    return {
      isRandom: true,
      title: "Случайный сценарий",
      text: "Катастрофа будет выбрана при старте. Готовьтесь к любому исходу.",
      scene: null,
      yearsInBunker: null,
      yearsLabel: null,
    };
  }
  const story = BACKSTORIES.find((b) => b.id === settings.backstoryId) || BACKSTORIES[0];
  return {
    isRandom: false,
    id: story.id,
    scene: story.scene,
    title: story.title,
    text: story.text,
    yearsInBunker: story.yearsInBunker,
    yearsLabel: formatYearsInBunker(story.yearsInBunker),
  };
}

/** Порядок карт в досье персонажа */
const CARD_TYPES = [
  { key: "gender", label: "Пол" },
  { key: "age", label: "Возраст" },
  { key: "body", label: "Телосложение" },
  { key: "trait", label: "Человеческая черта" },
  { key: "profession", label: "Профессия" },
  { key: "health", label: "Здоровье" },
  { key: "hobby", label: "Хобби / Увлечение" },
  { key: "phobia", label: "Фобия / Страх" },
  { key: "large_inventory", label: "Крупный инвентарь" },
  { key: "backpack", label: "Рюкзак" },
  { key: "extra", label: "Дополнительное сведение" },
];

const CARD_POOLS = {
  gender: ["Мужской", "Женский"],
  body: [
    "Худощавое",
    "Среднее",
    "Крепкое",
    "Полное",
    "Хрупкое",
    "Атлетическое",
  ],
  trait: [
    "Оптимист",
    "Пессимист",
    "Лидер",
    "Эгоист",
    "Альтруист",
    "Параноик",
    "Юморист",
    "Молчун",
    "Дипломат",
    "Импульсивный",
  ],
  profession: [
    "Хирург",
    "Пожарный",
    "Программист",
    "Учитель",
    "Фермер",
    "Полицейский",
    "Повар",
    "Электрик",
    "Безработный",
    "Ветеринар",
    "Инженер",
    "Психолог",
  ],
  health: [
    "Абсолютно здоров",
    "Аллергия",
    "Диабет",
    "Астма",
    "Плохое зрение",
    "Мигрени",
    "Артрит",
    "Беременность",
    "Хроническая усталость",
  ],
  hobby: [
    "Шахматы",
    "Охота",
    "Вязание",
    "Кулинария",
    "Выживание",
    "Гитара",
    "Садоводство",
    "Рыбалка",
    "Настольные игры",
  ],
  phobia: [
    "Темнота",
    "Пауки",
    "Высота",
    "Замкнутые пространства",
    "Вода",
    "Одиночество",
    "Крысы",
    "Огонь",
    "Кровь",
  ],
  large_inventory: [
    "Генератор",
    "Велосипед",
    "Канистра с бензином",
    "Сейф с инструментами",
    "Лодка надувная",
    "Манекен для обучения",
    "Клетка с попугаем",
    "Сварочный аппарат",
    "Пианино",
  ],
  backpack: [
    "Аптечка",
    "Фонарик",
    "Верёвка 20 м",
    "Зажигалка",
    "Компас",
    "Нож",
    "Блокнот и ручка",
    "Сухпаёк на 3 дня",
    "Пустой рюкзак",
  ],
  extra: [
    "Знает азбуку Морзе",
    "Имеет водительские права грузовика",
    "Курит",
    "Веган",
    "Говорит на трёх языках",
    "Бывший военный",
    "Имеет пару очков",
    "Ни разу не летал на самолёте",
    "Коллекционирует монеты",
  ],
};

const PROFESSION_LEVELS = [
  "Новичок",
  "Любитель",
  "Опытный",
  "Профессионал",
  "Мастер",
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomAge() {
  return 8 + Math.floor(Math.random() * (120 - 8 + 1));
}

function formatAge(years) {
  const mod10 = years % 10;
  const mod100 = years % 100;
  if (mod10 === 1 && mod100 !== 11) return `${years} год`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${years} года`;
  }
  return `${years} лет`;
}

function rollProfessionCard() {
  const profession = pickRandom(CARD_POOLS.profession);
  const level = pickRandom(PROFESSION_LEVELS);
  return {
    value: `${profession} (${level})`,
    profession,
    professionLevel: level,
  };
}

function rollCardValue(key) {
  if (key === "age") {
    return formatAge(randomAge());
  }
  return pickRandom(CARD_POOLS[key]);
}

function dealPlayerCards() {
  return CARD_TYPES.map(({ key, label }) => {
    if (key === "profession") {
      const prof = rollProfessionCard();
      return {
        type: key,
        label,
        value: prof.value,
        profession: prof.profession,
        professionLevel: prof.professionLevel,
        opened: false,
      };
    }
    return {
      type: key,
      label,
      value: rollCardValue(key),
      opened: false,
    };
  });
}

function getRevealPerRound(playerCount, round) {
  const n = Math.max(playerCount, 6);

  if (round >= 4 && round <= 7) {
    if (n <= 6) return 0;
    return 1;
  }
  if (round === 1) {
    if (n <= 10) return 3;
    return 2;
  }
  if (round === 2) {
    if (n <= 6) return 3;
    if (n <= 8) return 2;
    if (n <= 10) return 2;
    if (n <= 12) return 2;
    return 1;
  }
  if (round === 3) {
    if (n <= 6) return 2;
    if (n <= 8) return 2;
  }
  return 1;
}

function getMaxRound(playerCount) {
  const n = Math.max(playerCount, 6);
  return n <= 6 ? 3 : 7;
}

function getBunkerSpots(playerCount) {
  const n = playerCount;
  if (n <= 7) return 3;
  if (n <= 9) return 4;
  if (n <= 11) return 5;
  if (n <= 13) return 6;
  return 7;
}

function buildActiveBackstory(settings, playerCount) {
  let story;
  if (settings.backstoryRandom) {
    story = pickRandom(BACKSTORIES);
  } else {
    story =
      BACKSTORIES.find((b) => b.id === settings.backstoryId) || BACKSTORIES[0];
  }
  const spots = getBunkerSpots(playerCount);
  return {
    id: story.id,
    scene: story.scene,
    title: story.title,
    text: story.text,
    yearsInBunker: story.yearsInBunker,
    yearsLabel: formatYearsInBunker(story.yearsInBunker),
    bunkerSpots: spots,
    spotsText: `Мест в бункере: ${spots} (из ${playerCount} претендентов).`,
  };
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = {
  MODES,
  BACKSTORIES,
  CARD_TYPES,
  dealPlayerCards,
  pickRandom,
  getRevealPerRound,
  getMaxRound,
  getBunkerSpots,
  buildActiveBackstory,
  getScenarioPreview,
  formatYearsInBunker,
  shuffleArray,
  PROFESSION_LEVELS,
};
