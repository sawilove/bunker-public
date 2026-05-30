/** Определения достижений Бункера. type: once | unique | goal */

const MAX_DISPLAYED_ACHIEVEMENTS = 3;

/** Пороги для уникальных достижений */
const PIONEER_MAX_RANK = 200;
const CATALOG_STAR_MIN_RATINGS = 25;

const ACHIEVEMENTS = {
  register: {
    id: "register",
    type: "once",
    name: "Пропуск в бункер",
    description: "Зарегистрировался — добро пожаловать на объект, гражданин",
    icon: "register.svg",
  },
  first_game: {
    id: "first_game",
    type: "once",
    name: "За столом",
    description: "Первая партия — как первый раунд «Что? Где? Когда?»",
    icon: "first-game.svg",
  },
  first_survival: {
    id: "first_survival",
    type: "once",
    name: "Не в списке",
    description: "Выжил при отборе — мимо титров «покинувших бункер»",
    icon: "first-survival.svg",
  },
  avatar_upload: {
    id: "avatar_upload",
    type: "once",
    name: "Фото на пропуск",
    description: "Загрузил аватар — лицо для проходной и профиля",
    icon: "avatar-upload.svg",
  },
  bio_filled: {
    id: "bio_filled",
    type: "once",
    name: "Личное дело",
    description: "Заполнил «О себе» — анкета как в кадровой службе",
    icon: "bio-filled.svg",
  },
  first_friend: {
    id: "first_friend",
    type: "once",
    name: "Сосед по подъезду",
    description: "Первый друг — как в «Иронии судьбы», только по выбору",
    icon: "first-friend.svg",
  },
  scenario_published: {
    id: "scenario_published",
    type: "once",
    name: "ЧП в эфире",
    description: "Опубликовал катастрофу — сюжет на уровне «Времён»",
    icon: "scenario-published.svg",
  },
  premium_member: {
    id: "premium_member",
    type: "once",
    name: "Золотой пропуск",
    description: "Premium — доступ «для избранных», как в рекламе нулевых",
    icon: "premium-member.svg",
  },
  bunker_dev: {
    id: "bunker_dev",
    type: "unique",
    name: "Архитектор Бункера",
    description: "Разработчик — автор сценария до первого эфира",
    icon: "bunker-dev.svg",
  },
  pioneer_bunker: {
    id: "pioneer_bunker",
    type: "unique",
    name: "Пионер бункера",
    description: "Среди первых 200 пропусков — как значок «будь готов!»",
    icon: "pioneer-bunker.svg",
  },
  news_voice: {
    id: "news_voice",
    type: "unique",
    name: "Голос «Времён»",
    description: "Опубликовал новость — вышел в эфир Первого",
    icon: "news-voice.svg",
  },
  catalog_star: {
    id: "catalog_star",
    type: "unique",
    name: "Звезда эфира",
    description: "Сценарий набрал 25+ оценок — рейтинг как у prime-time",
    icon: "catalog-star.svg",
  },
  catalog_editor: {
    id: "catalog_editor",
    type: "unique",
    name: "Редактор проката",
    description: "Одобрил сценарий в каталоге — зелёный свет от цензуры",
    icon: "catalog-editor.svg",
  },
  games_10: {
    id: "games_10",
    type: "goal",
    name: "Десятый выпуск",
    description: "10 партий — марафон короче «Ералаша», но уже серьёзно",
    icon: "games-10.svg",
    goalTarget: 10,
    goalKey: "gamesPlayed",
  },
  games_50: {
    id: "games_50",
    type: "goal",
    name: "Знаток",
    description: "50 партий — уровень клуба «Что? Где? Когда?»",
    icon: "games-50.svg",
    goalTarget: 50,
    goalKey: "gamesPlayed",
  },
  games_100: {
    id: "games_100",
    type: "goal",
    tier: "platinum",
    name: "Народный артист",
    description: "100 партий — заслуженный ветеран эфира",
    icon: "games-100.svg",
    goalTarget: 100,
    goalKey: "gamesPlayed",
  },
  survivals_5: {
    id: "survivals_5",
    type: "goal",
    name: "Местный",
    description: "5 выживаний — свой на станции, как в «Метро»",
    icon: "survivals-5.svg",
    goalTarget: 5,
    goalKey: "bunkerSurvivals",
  },
  survivals_20: {
    id: "survivals_20",
    type: "goal",
    name: "Сталкер с опытом",
    description: "20 выживаний — прошёл зону и вернулся с артефактом",
    icon: "survivals-20.svg",
    goalTarget: 20,
    goalKey: "bunkerSurvivals",
  },
  survivals_50: {
    id: "survivals_50",
    type: "goal",
    tier: "platinum",
    name: "Последний герой",
    description: "50 выживаний — финал сезона, титры ещё не показали",
    icon: "survivals-50.svg",
    goalTarget: 50,
    goalKey: "bunkerSurvivals",
  },
  friends_5: {
    id: "friends_5",
    type: "goal",
    name: "Своя компания",
    description: "5 друзей — sitcom на минималках, но уже с laugh track",
    icon: "friends-5.svg",
    goalTarget: 5,
    goalKey: "friendsCount",
  },
  friends_15: {
    id: "friends_15",
    type: "goal",
    name: "Клуб по интересам",
    description: "15 друзей — полноценный кружок выживших",
    icon: "friends-15.svg",
    goalTarget: 15,
    goalKey: "friendsCount",
  },
  friends_30: {
    id: "friends_30",
    type: "goal",
    tier: "platinum",
    name: "Семья",
    description: "30 друзей — «мы команда», как после финала «Бригады»",
    icon: "friends-30.svg",
    goalTarget: 30,
    goalKey: "friendsCount",
  },
  scenarios_3: {
    id: "scenarios_3",
    type: "goal",
    name: "Мини-сериал",
    description: "3 сценария — три серии, можно посмотреть за вечер",
    icon: "scenarios-3.svg",
    goalTarget: 3,
    goalKey: "publishedScenarios",
  },
  scenarios_8: {
    id: "scenarios_8",
    type: "goal",
    name: "Полный сезон",
    description: "8 сценариев — полный сезон, как у «\u042D\u043F\u0438\u0434\u0435\u043C\u0438\u0438»",
    icon: "scenarios-8.svg",
    goalTarget: 8,
    goalKey: "publishedScenarios",
  },
  scenarios_20: {
    id: "scenarios_20",
    type: "goal",
    tier: "platinum",
    name: "Киностудия",
    description: "20 сценариев — библиотека катастроф уровня «Мосфильма»",
    icon: "scenarios-20.svg",
    goalTarget: 20,
    goalKey: "publishedScenarios",
  },
};

const ACHIEVEMENT_LIST = Object.values(ACHIEVEMENTS);

const TYPE_LABELS = {
  once: "Разовые",
  unique: "Уникальные",
  goal: "Целевые",
};

function achievementIconPath(achievementId) {
  const ach = ACHIEVEMENTS[achievementId];
  if (!ach) return null;
  return `/icons/achievements/${ach.icon}`;
}

module.exports = {
  ACHIEVEMENTS,
  ACHIEVEMENT_LIST,
  TYPE_LABELS,
  MAX_DISPLAYED_ACHIEVEMENTS,
  PIONEER_MAX_RANK,
  CATALOG_STAR_MIN_RATINGS,
  achievementIconPath,
};
