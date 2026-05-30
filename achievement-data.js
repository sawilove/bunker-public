/** Определения достижений Бункера. type: once | unique | goal */

const MAX_DISPLAYED_ACHIEVEMENTS = 3;

const ACHIEVEMENTS = {
  register: {
    id: "register",
    type: "once",
    name: "Новобранец",
    description: "Создал аккаунт в Бункере",
    icon: "register.svg",
  },
  first_game: {
    id: "first_game",
    type: "once",
    name: "Дебют",
    description: "Сыграл первую партию — бронзовая медаль",
    icon: "first-game.svg",
  },
  first_survival: {
    id: "first_survival",
    type: "once",
    name: "За стальной дверью",
    description: "Выжил в бункере впервые — бронзовая медаль",
    icon: "first-survival.svg",
  },
  avatar_upload: {
    id: "avatar_upload",
    type: "once",
    name: "Лицо выжившего",
    description: "Загрузил аватар в профиль",
    icon: "avatar-upload.svg",
  },
  bio_filled: {
    id: "bio_filled",
    type: "once",
    name: "Досье заполнено",
    description: "Написал «О себе» в профиле",
    icon: "bio-filled.svg",
  },
  first_friend: {
    id: "first_friend",
    type: "once",
    name: "Связь установлена",
    description: "Добавил первого друга — бронзовая медаль",
    icon: "first-friend.svg",
  },
  scenario_published: {
    id: "scenario_published",
    type: "once",
    name: "Сценарист катастроф",
    description: "Опубликовал первый сценарий — бронзовая медаль",
    icon: "scenario-published.svg",
  },
  premium_member: {
    id: "premium_member",
    type: "once",
    name: "Статус выжившего+",
    description: "Оформил подписку Premium",
    icon: "premium-member.svg",
  },
  bunker_dev: {
    id: "bunker_dev",
    type: "unique",
    name: "Архитектор Бункера",
    description: "Разработчик проекта Бункер",
    icon: "bunker-dev.svg",
  },
  games_10: {
    id: "games_10",
    type: "goal",
    name: "Стажёр",
    description: "Серебряная медаль — 10 партий",
    icon: "games-10.svg",
    goalTarget: 10,
    goalKey: "gamesPlayed",
  },
  games_50: {
    id: "games_50",
    type: "goal",
    name: "Бывалый",
    description: "Золотая медаль — 50 партий",
    icon: "games-50.svg",
    goalTarget: 50,
    goalKey: "gamesPlayed",
  },
  games_100: {
    id: "games_100",
    type: "goal",
    name: "Легенда бункера",
    description: "Платиновая медаль — 100 партий",
    icon: "games-100.svg",
    goalTarget: 100,
    goalKey: "gamesPlayed",
  },
  survivals_5: {
    id: "survivals_5",
    type: "goal",
    name: "Хранитель",
    description: "Серебряная медаль — 5 выживаний",
    icon: "survivals-5.svg",
    goalTarget: 5,
    goalKey: "bunkerSurvivals",
  },
  survivals_20: {
    id: "survivals_20",
    type: "goal",
    name: "Страж бункера",
    description: "Золотая медаль — 20 выживаний",
    icon: "survivals-20.svg",
    goalTarget: 20,
    goalKey: "bunkerSurvivals",
  },
  survivals_50: {
    id: "survivals_50",
    type: "goal",
    name: "Последний из нас",
    description: "Платиновая медаль — 50 выживаний",
    icon: "survivals-50.svg",
    goalTarget: 50,
    goalKey: "bunkerSurvivals",
  },
  friends_5: {
    id: "friends_5",
    type: "goal",
    name: "Сеть выживших",
    description: "Серебряная медаль — 5 друзей",
    icon: "friends-5.svg",
    goalTarget: 5,
    goalKey: "friendsCount",
  },
  friends_15: {
    id: "friends_15",
    type: "goal",
    name: "Опора сообщества",
    description: "Золотая медаль — 15 друзей",
    icon: "friends-15.svg",
    goalTarget: 15,
    goalKey: "friendsCount",
  },
  friends_30: {
    id: "friends_30",
    type: "goal",
    name: "Сердце сети",
    description: "Платиновая медаль — 30 друзей",
    icon: "friends-30.svg",
    goalTarget: 30,
    goalKey: "friendsCount",
  },
  scenarios_3: {
    id: "scenarios_3",
    type: "goal",
    name: "Автор катастроф",
    description: "Серебряная медаль — 3 сценария в каталоге",
    icon: "scenarios-3.svg",
    goalTarget: 3,
    goalKey: "publishedScenarios",
  },
  scenarios_8: {
    id: "scenarios_8",
    type: "goal",
    name: "Мастер катастроф",
    description: "Золотая медаль — 8 сценариев в каталоге",
    icon: "scenarios-8.svg",
    goalTarget: 8,
    goalKey: "publishedScenarios",
  },
  scenarios_20: {
    id: "scenarios_20",
    type: "goal",
    name: "Легенда каталога",
    description: "Платиновая медаль — 20 сценариев в каталоге",
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
  achievementIconPath,
};
