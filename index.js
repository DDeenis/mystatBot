/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-shadow */
/* eslint-disable max-len */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-use-before-define */
const {
  Telegraf,
  session,
  Stage,
} = require('telegraf');

const WizardScene = require('telegraf/scenes/wizard');

const {
  MenuTemplate,
  MenuMiddleware,
  deleteMenuFromContext,
  editMenuOnContext,
} = require('telegraf-inline-menu');

const Enumerable = require('linq');
const mystat = require('./mystat');

require('mysql2'); // mock
const repository = require('./database');

repository.checkDatabase();

const botToken = process.env.MYSTAT_BOT_TOKEN;

const bot = new Telegraf(botToken);

async function getUserData(chatId) {
  const users = await repository.getUserByChat(chatId);

  const userData = users[0];

  return {
    username: userData.mystatLogin,
    password: userData.mystatPassword,
  };
}

let username = '';
let password = '';
let currentResponseText = '';

let profile;

/// //////////////// START LOGIN SCENE ///////////////////

const loginScene = new WizardScene(
  'login',
  (ctx) => {
    ctx.reply('📲 Отправьте свой логин от mystat');

    return ctx.wizard.next();
  },
  (ctx) => {
    username = ctx.message.text;

    ctx.reply('🔑 Теперь оправьте свой пароль от mystat');

    return ctx.wizard.next();
  },
  async (ctx) => {
    password = ctx.message.text;

    ctx.reply('🔍 Обработка информации');

    // mystat.setLoginParameters(username, password);

    try {
      // await setUserName();

      // await mystat.setLoginParameters(username, password);

      profile = await mystat.loadProfileInfo({ username, password });

      await repository.createUser(username, password, ctx.chat.id);

      username = '';
      password = '';

      await ctx.reply('🔓 Вход успешно выполнен');

      // eslint-disable-next-line no-use-before-define
      mainMenuMiddleware.replyToContext(ctx);
    } catch (error) {
      console.log(error);

      ctx.reply('🔒 При входе возникла ошибка. Проверьте логин и пароль.');
    }

    return ctx.scene.leave();
  },
);

/// //////////////// END LOGIN SCENE ///////////////////

/// //////////////// START LOGIN MENU ///////////////////

const loginMenuTemplate = new MenuTemplate((ctx) => `Здравствуйте, ${ctx.from.first_name}`);

loginMenuTemplate.interact('Войти в mystat', 'unique', {
  do: async (ctx) => {
    ctx.scene.enter('login');

    return false;
  },
});

const loginMiddleware = new MenuMiddleware('/login/', loginMenuTemplate);

/// //////////////// END LOGIN MENU ///////////////////

/// //////////////// START MAIN MENU ///////////////////

const mainMenuTemplate = new MenuTemplate(() => 'Выберите действие');

mainMenuTemplate.interact('📅 Посмотреть расписание на сегодня', 'todaySchedule', {
  do: async (ctx) => {
    // await checkLoginCredentials(ctx.chat.id);
    const userData = await getUserData(ctx.chat.id);

    let todaySchedule;

    try {
      todaySchedule = await mystat.getScheduleByDate(userData);
    } catch (error) {
      await ctx.reply('🚫 При получении расписания возникла ошибка');

      console.log(error);

      return false;
    }

    if (todaySchedule.length <= 0) {
      await ctx.reply('🎉 У вас сегодня нет пар');

      return false;
    }

    let scheduleFormatted = 'Расписание на сегодня:\n\n';

    // eslint-disable-next-line no-restricted-syntax
    for (const scheduleEntry of todaySchedule) {
      scheduleFormatted += `✏️ Предмет: ${scheduleEntry.subject_name}\n`;
      scheduleFormatted += `💡 Преподаватель: ${scheduleEntry.teacher_name}\n`;
      scheduleFormatted += `🗝 Аудитория: ${scheduleEntry.room_name}\n`;
      scheduleFormatted += `⏰ Время: ${scheduleEntry.started_at} - ${scheduleEntry.finished_at}\n`;
      scheduleFormatted += '\n';
    }

    await replyWithUniversalMenu(ctx, scheduleFormatted);

    return false;
  },
});

// Расписание на завтра
mainMenuTemplate.interact('📅 Посмотреть расписание на завтра', 'tomorrowSchedule', {
  do: async (ctx) => {
    // await checkLoginCredentials(ctx.chat.id);
    const userData = await getUserData(ctx.chat.id);

    let tomorrowSchedule;

    try {
      const tomorrowDate = new Date();
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);

      tomorrowSchedule = await mystat.getScheduleByDate(userData, tomorrowDate);
    } catch (error) {
      await ctx.reply('🚫 При получении расписания возникла ошибка');

      console.log(error);

      return false;
    }

    if (tomorrowSchedule.length <= 0) {
      await ctx.reply('🎉 У вас завтра нет пар');

      return false;
    }

    let scheduleFormatted = 'Расписание на завтра:\n\n';

    for (const scheduleEntry of tomorrowSchedule) {
      scheduleFormatted += `✏️ Предмет: ${scheduleEntry.subject_name}\n`;
      scheduleFormatted += `💡 Преподаватель: ${scheduleEntry.teacher_name}\n`;
      scheduleFormatted += `🗝 Аудитория: ${scheduleEntry.room_name}\n`;
      scheduleFormatted += `⏰ Время: ${scheduleEntry.started_at} - ${scheduleEntry.finished_at}\n`;
      scheduleFormatted += '\n';
    }

    await replyWithUniversalMenu(ctx, scheduleFormatted);

    return false;
  },
});

// remove or re-work
mainMenuTemplate.interact('🗓 Посмотреть расписание на месяц', 'monthSchedule', {
  do: async (ctx) => {
    // await checkLoginCredentials(ctx.chat.id);
    const userData = await getUserData(ctx.chat.id);

    let monthSchedule;

    try {
      monthSchedule = await mystat.getMonthSchedule(userData);
    } catch (error) {
      await ctx.reply('🚫 При получении расписания возникла ошибка');

      console.log(error);

      return false;
    }

    if (monthSchedule.length <= 0) {
      await ctx.reply('🎉 В этом месяце у вас нет пар');

      return false;
    }

    monthSchedule = Enumerable.from(monthSchedule).orderBy((element) => element.date).groupBy((element) => element.date);

    function getButtonTitle(element) {
      return `${element.key().split('-')[2]}`;
    }

    function getFormattedString(element) {
      let formattedString = '';

      for (const scheduleEntry of element) {
        formattedString += `📅 Дата: ${scheduleEntry.date}\n`;
        formattedString += `✏️ Предмет: ${scheduleEntry.subject_name}\n`;
        formattedString += `💡 Преподаватель: ${scheduleEntry.teacher_name}\n`;
        formattedString += `🗝 Аудитория: ${scheduleEntry.room_name}\n`;
        formattedString += `⏰ Время: ${scheduleEntry.started_at} - ${scheduleEntry.finished_at}\n`;
        formattedString += '\n';
      }

      return formattedString;
    }

    function getActionString(element) {
      return `${element.key()} - ${Math.random() * 1000}`;
    }

    await replyWithListedMenu(ctx, monthSchedule, 'Выберите число', '/month-schedule/', getButtonTitle, getFormattedString, getActionString);

    return false;
  },
});

mainMenuTemplate.interact('✉️ Посмотреть домашние задания', 'homework', {
  do: async (ctx) => {
    // await checkLoginCredentials(ctx.chat.id);
    // const userData = await getUserData(ctx.chat.id);

    let homeworkList;

    function getButtonTitle(element) {
      return element.name_spec;
    }

    function getActionString(element) {
      return `show homework ${element.creation_time + Math.random() * 1000}`;
    }

    const homeworkSelectTemplate = new MenuTemplate(() => 'Выберите тип домашнего задания');

    homeworkSelectTemplate.interact('📨 Текущие', 'show current homeworks', {
      do: async (ctx) => {
        const userData = await getUserData(ctx.chat.id);

        try {
          homeworkList = await mystat.getHomeworkList(userData, 3);
        } catch (error) {
          await ctx.reply('🚫 При получении списка домашних заданий возникла ошибка');

          console.log(error);

          return false;
        }

        if (homeworkList === undefined || homeworkList.length <= 0) {
          await ctx.reply('🎉 У вас нет текущих домашних заданий');

          return false;
        }

        function getFormattedString(element) {
          let formattedString = '';

          formattedString += `✏️ Предмет: ${element.name_spec}\n`;
          formattedString += `📖 Тема: ${element.theme}\n`;
          formattedString += `💡 Преподаватель: ${element.fio_teach}\n`;
          formattedString += `📅 Дата выдачи: ${element.creation_time}\n`;
          formattedString += `❕ Сдать до: ${element.completion_time}\n`;
          formattedString += `❗️ Истекает: ${element.overdue_time}\n`;
          formattedString += `✒️ Комментарий: ${element.comment}\n`;
          formattedString += `📁 Путь к файлу: ${element.file_path}\n`;

          formattedString += '\n';

          return formattedString;
        }

        await replyWithListedMenu(ctx, homeworkList, 'Текущие домашние задания', '/current-homework/', getButtonTitle, getFormattedString, getActionString);

        return false;
      },
    });

    homeworkSelectTemplate.interact('📩 Проверенные', 'show checked homeworks', {
      do: async (ctx) => {
        const userData = await getUserData(ctx.chat.id);

        try {
          homeworkList = await mystat.getHomeworkList(userData, 1);
        } catch (error) {
          await ctx.reply('🚫 При получении списка домашних заданий возникла ошибка');

          console.log(error);

          return false;
        }

        if (homeworkList === undefined || homeworkList.length <= 0) {
          await ctx.reply('❕ У вас нет проверенных домашних заданий');

          return false;
        }

        function getFormattedString(element) {
          let formattedString = '';

          formattedString += `✏️ Предмет: ${element.name_spec}\n`;
          formattedString += `📖 Тема: ${element.theme}\n`;
          formattedString += `💡 Преподаватель: ${element.fio_teach}\n`;
          formattedString += `📅 Дата выдачи: ${element.creation_time}\n`;
          formattedString += `❕ Сдать до: ${element.completion_time}\n`;
          formattedString += `✒️ Комментарий: ${element.comment}\n`;
          formattedString += `📁 Путь к файлу: ${element.file_path}\n`;
          formattedString += `📂 Путь к загруженному файлу: ${element.homework_stud.file_path}\n`;
          formattedString += `✅ Проверенно: ${element.homework_stud.creation_time}\n`;
          formattedString += `🎉 Оценка: ${element.homework_stud.mark}\n`;

          if (element.homework_comment !== null) {
            formattedString += `🖊 Комментарий преподавателя: ${element.homework_comment.text_comment}\n`;
          }

          if (element.homework_comment !== null && element.homework_comment.attachment_path !== null) {
            formattedString += `📌 Приложение: ${element.homework_comment.attachment_path}\n`;
          }

          formattedString += '\n';

          return formattedString;
        }

        await replyWithListedMenu(ctx, homeworkList, 'Проверенные домашние задания', '/checked-homework/', getButtonTitle, getFormattedString, getActionString);

        return false;
      },
    });

    homeworkSelectTemplate.interact('📥 Загруженные', 'show uploaded homeworks', {
      do: async (ctx) => {
        const userData = await getUserData(ctx.chat.id);

        try {
          homeworkList = await mystat.getHomeworkList(userData, 2);
        } catch (error) {
          await ctx.reply('🚫 При получении списка домашних заданий возникла ошибка');

          console.log(error);

          return false;
        }

        if (homeworkList === undefined || homeworkList.length <= 0) {
          await ctx.reply('❕ У вас нет загруженных домашних заданий');

          return false;
        }

        function getFormattedString(element) {
          let formattedString = '';

          formattedString += `✏️ Предмет: ${element.name_spec}\n`;
          formattedString += `📖 Тема: ${element.theme}\n`;
          formattedString += `💡 Преподаватель: ${element.fio_teach}\n`;
          formattedString += `📅 Дата выдачи: ${element.creation_time}\n`;
          formattedString += `❕ Сдать до: ${element.completion_time}\n`;
          formattedString += `✒️ Комментарий: ${element.comment}\n`;
          formattedString += `📁 Путь к файлу: ${element.file_path}\n`;
          formattedString += `📥 Загруженно: ${element.creation_time}\n`;

          formattedString += '\n';

          return formattedString;
        }

        await replyWithListedMenu(ctx, homeworkList, 'Загруженные домашние задания', '/uploaded-homework/', getButtonTitle, getFormattedString, getActionString);

        return false;
      },
    });

    homeworkSelectTemplate.interact('🗑 Просроченные', 'show overdue homeworks', {
      do: async (ctx) => {
        const userData = await getUserData(ctx.chat.id);

        try {
          homeworkList = await mystat.getHomeworkList(userData, 0);
        } catch (error) {
          await ctx.reply('🚫 При получении списка домашних заданий возникла ошибка');

          console.log(error);

          return false;
        }

        if (homeworkList === undefined || homeworkList.length <= 0) {
          await ctx.reply('🎉 У вас нет просроченных домашних заданий');

          return false;
        }

        function getFormattedString(element) {
          let formattedString = '';

          formattedString += `✏️ Предмет: ${element.name_spec}\n`;
          formattedString += `📖 Тема: ${element.theme}\n`;
          formattedString += `💡 Преподаватель: ${element.fio_teach}\n`;
          formattedString += `📅 Дата выдачи: ${element.creation_time}\n`;
          formattedString += `❕ Сдать до: ${element.completion_time}\n`;
          formattedString += `✒️ Комментарий: ${element.comment}\n`;
          formattedString += `📁 Путь к файлу: ${element.file_path}\n`;
          formattedString += `🗑 Просрочено: ${element.overdue_time}\n`;
          formattedString += `⚰️ Автооценка: ${element.homework_stud.auto_mark}\n`;

          formattedString += '\n';

          return formattedString;
        }

        await replyWithListedMenu(ctx, homeworkList, 'Просроченные домашние задания', '/overdue-homework/', getButtonTitle, getFormattedString, getActionString);

        return false;
      },
    });

    homeworkSelectTemplate.navigate('⬅️ В меню', '/main-menu/');

    const homeworkSelectMiddleware = new MenuMiddleware('/homework-select-menu/', homeworkSelectTemplate);

    bot.use(homeworkSelectMiddleware);

    try {
      await deleteMenuFromContext(ctx);
    } catch (error) {
      console.log(error);
    }

    homeworkSelectMiddleware.replyToContext(ctx);

    return false;
  },
});

mainMenuTemplate.interact('🕯 Посмотреть назначенные экзамены', 'futureExams', {
  do: async (ctx) => {
    // await checkLoginCredentials(ctx.chat.id);
    const userData = await getUserData(ctx.chat.id);

    let futureExams;

    try {
      futureExams = await mystat.getFutureExams(userData);
    } catch (error) {
      await ctx.reply('🚫 При получении расписания экзаменов возникла ошибка');

      console.log(error);

      return false;
    }

    if (futureExams.length <= 0) {
      await ctx.reply('🎉 У вас нет назначеных экзаменов');

      return false;
    }

    let examsFormatted = 'Ваши экзамены\n\n';

    for (const exam of futureExams) {
      examsFormatted += `✏️ Предмет: ${exam.spec}\n`;
      examsFormatted += `⏰ Дата: ${exam.date}\n`;
      examsFormatted += '\n';
    }

    await replyWithUniversalMenu(ctx, examsFormatted);

    return false;
  },
});

mainMenuTemplate.interact('⚰️ Посмотреть все экзамены', 'allExams', {
  do: async (ctx) => {
    // await checkLoginCredentials(ctx.chat.id);
    const userData = await getUserData(ctx.chat.id);

    let allExams;

    try {
      allExams = await mystat.getExams(userData);
    } catch (error) {
      await ctx.reply('🚫 При получении экзаменов возникла ошибка');

      console.log(error);

      return false;
    }

    if (allExams.length <= 0) {
      await ctx.reply('🎉 У вас нет экзаменов');

      return false;
    }

    function getButtonTitle(element) {
      return element.spec;
    }

    function getFormattedString(element) {
      let formattedString = '';

      formattedString += `✏️ Предмет: ${element.spec}\n`;
      formattedString += `⏰ Дата: ${element.date}\n`;
      formattedString += `💰 Преподаватель: ${element.teacher}\n`;
      formattedString += `🕯 Оценка: ${element.mark}\n`;
      formattedString += '\n';

      return formattedString;
    }

    function getActionString() {
      return `show exam ${Math.random() * Math.random()}`;
    }

    await replyWithListedMenu(ctx, allExams, 'Ваши экзамены', '/all-exams/', getButtonTitle, getFormattedString, getActionString);

    return false;
  },
});

mainMenuTemplate.interact('📄 Посмотреть новости', 'news', {
  do: async (ctx) => {
    // await checkLoginCredentials(ctx.chat.id);
    const userData = await getUserData(ctx.chat.id);

    let news;

    try {
      news = await mystat.getNews(userData);
    } catch (error) {
      await ctx.reply('🚫 При получении новостей возникла ошибка');

      console.log(error);

      return false;
    }

    if (news.length <= 0) {
      await ctx.reply('❔ У вас нет новостей');

      return false;
    }

    function getButtonTitle(element) {
      return element.theme;
    }

    async function getFormattedString(element) {
      let formattedString = '';

      formattedString += `✏️ Тема: ${element.theme}\n`;
      formattedString += `📅 Дата: ${element.time}\n`;
      formattedString += '\n';
      formattedString += (await mystat.getNewsDetails(userData, element.id_bbs)).text_bbs.replace(/<[^>]*>?/gm, '\n').replace(/(\n\n\n\n)/gm, '\n\n').replace(/(\n\n\n)/gm, '\n').replace(/(\n\n)/gm, '\n');
      formattedString += '\n';

      return formattedString;
    }

    function getActionString(element) {
      return `show news ${element.id_bbs}`;
    }

    await replyWithListedMenu(ctx, news, 'Новости', '/news-menu/', getButtonTitle, getFormattedString, getActionString);

    return false;
  },
});

mainMenuTemplate.interact('⛏ Посмотреть список группы', 'groupList', {
  do: async (ctx) => {
    // await checkLoginCredentials(ctx.chat.id);
    const userData = await getUserData(ctx.chat.id);

    let groupList;

    try {
      groupList = await mystat.getGroupLeaders(userData);
    } catch (error) {
      await ctx.reply('🚫 При получении списка группы возникла ошибка');

      console.log(error);

      return false;
    }

    if (groupList.length <= 0) {
      await ctx.reply('🎉 Вы не состоите в группе');

      return false;
    }

    function getButtonTitle(element) {
      return `${element.full_name} - ${element.position}`;
    }

    function getFormattedString(element) {
      let formattedString = '';

      formattedString += `📝 Имя: ${element.full_name}\n`;
      formattedString += `📊 Количество очков: ${element.amount}\n`;
      formattedString += `📱 Фото: ${element.photo_path}\n`;
      formattedString += `🔑 ID: ${element.id}\n`;

      return formattedString;
    }

    function getActionString(element) {
      return `show student ${element.id}`;
    }

    await replyWithListedMenu(ctx, groupList, 'Список группы', '/group-menu/', getButtonTitle, getFormattedString, getActionString);

    return false;
  },
});

mainMenuTemplate.interact('🖨 Посмотреть информацию о себе', 'aboutMe', {
  do: async (ctx) => {
    // await checkLoginCredentials(ctx.chat.id);
    const userData = await getUserData(ctx.chat.id);

    let settings;

    try {
      profile = await mystat.loadProfileInfo(userData);
      settings = await mystat.getUserSettings(userData);
    } catch (error) {
      await ctx.reply('🚫 При получении информации о профиле возникла ошибка');

      console.log(error);

      return false;
    }

    let profileInfo = '';

    profileInfo += `📝 ФИО: ${profile.full_name}\n`;
    profileInfo += `🧭 Группа: ${profile.group_name}\n`;
    profileInfo += `🖥 Поток: ${profile.stream_name}\n`;
    profileInfo += `🔍 Фото: ${profile.photo}\n`;
    profileInfo += `💰 Количество монет: ${profile.gaming_points[1].points}\n`;
    profileInfo += `💎 Количество кристаллов: ${profile.gaming_points[0].points}\n`;
    profileInfo += `📈 Всего поинтов: ${profile.gaming_points[0].points + profile.gaming_points[1].points}\n`;
    profileInfo += `💡 Количество достижений: ${profile.achieves_count}\n`;
    profileInfo += `⚙️ Уровень профиля: ${profile.level}\n`;
    profileInfo += `📡 Почта для входа в Azure: ${settings.azure_login}\n`;
    profileInfo += `🪓 Почта: ${settings.email}\n`;
    profileInfo += `📱 Телефон: ${settings.phones[0].phone_number}\n`;

    await replyWithUniversalMenu(ctx, profileInfo);

    return false;
  },
});

mainMenuTemplate.interact('🏳️ Выйти из аккаунта', 'logout', {
  do: async (ctx) => {
    username = '';
    password = '';

    // await mystat.setLoginParameters(username, password);

    await repository.deleteUser(ctx.chat.id);

    await deleteMenuFromContext(ctx);

    await ctx.reply('Вы вышли из аккаунта');

    return false;
  },
});

const mainMenuMiddleware = new MenuMiddleware('/main-menu/', mainMenuTemplate);

/// //////////////// END MAIN MENU ///////////////////

// menu for arrays
// getButtonTitle and getFormattedString and getActionString are functions that accept 1 argument (element of array dataList)

async function replyWithListedMenu(ctx, dataList, menuTitle, path, getButtonTitle, getFormattedString, getActionString) {
  const listedMenuTemplate = new MenuTemplate(() => menuTitle);

  for (const element of dataList) {
    listedMenuTemplate.interact(await getButtonTitle(element), await getActionString(element), {
      do: async (ctx) => {
        const formattedString = await getFormattedString(element);

        await replyWithUniversalMenu(ctx, formattedString);

        return false;
      },
    });
  }

  listedMenuTemplate.navigate('⬅️ В меню', '/main-menu/');

  const listedMenuMiddleware = new MenuMiddleware(path, listedMenuTemplate);

  bot.use(listedMenuMiddleware);

  try {
    // await deleteMenuFromContext(ctx);
    await editMenuOnContext(listedMenuTemplate, ctx, path);
  } catch (error) {
    await listedMenuMiddleware.replyToContext(ctx);

    console.log(error);
  }

  // await listedMenuMiddleware.replyToContext(ctx);

  return false;
}

/// //////////////// START UNIVERSAL MENU ///////////////////

const universalMenuTemplate = new MenuTemplate(() => `${currentResponseText}`);

universalMenuTemplate.navigate('⬅️ В меню', '/main-menu/');

const universalMenuMiddleware = new MenuMiddleware('/universal-menu/', universalMenuTemplate);

async function replyWithUniversalMenu(ctx, content) {
  try {
    await deleteMenuFromContext(ctx);
    // await editMenuOnContext(universalMenuTemplate, ctx, '/universal-menu/');
  } catch (error) {
    console.log(error);
  }

  currentResponseText = content;

  universalMenuMiddleware.replyToContext(ctx);
}

/// //////////////// END UNIVERSAL MENU ///////////////////

const stage = new Stage([loginScene], {
  // default: 'main',
  ttl: 360,
});

// middleware

bot.use(session());
bot.use(stage.middleware());
bot.use(loginMiddleware);
bot.use(mainMenuMiddleware);
bot.use(universalMenuMiddleware);

// bot actions

bot.command('start', (ctx) => {
  console.log(`Recieved message from ${ctx.chat.first_name}`);
  loginMiddleware.replyToContext(ctx);
});
bot.command('login', (ctx) => loginMiddleware.replyToContext(ctx));

bot.command('menu', (ctx) => mainMenuMiddleware.replyToContext(ctx));

const crashCommand = process.env.CRASH_COMMAND;
bot.command(crashCommand, () => mainMenuMiddleware.replyToContext(42));

bot.command('help', (ctx) => ctx.reply('Основные команды:\n\n/login - вход в аккаунт\n/menu - открыть главное меню\n/help - показать это сообщение'));

// start bot

bot.launch();
