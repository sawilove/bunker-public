/** Скопируйте в config.js и подставьте URL после деплоя server.js */
window.BUNKER_CONFIG = {
  wsUrl: "https://your-bunker-api.onrender.com",
  apiUrl: "https://your-bunker-api.onrender.com",

  /** Прямая ссылка: cloudtips.ru → «Донаты» → скопировать ссылку на страницу оплаты */
  donateUrl: "https://tips.yandex.ru/guest/pay/YOUR_PAGE",
  /** Либо layout id из CloudTips для виджета (оплата картой / T-Pay / СБП) */
  donateCloudTipsLayoutId: "",
};
