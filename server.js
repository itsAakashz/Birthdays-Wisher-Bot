const { Telegraf, Markup } = require("telegraf");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { CronJob } = require("cron"); 

dotenv.config();


const bot = new Telegraf(process.env.BOT_TOKEN);

// Counters for analytics
let groupsServed = new Set();
let usersStartedBot = new Set();

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Successfully connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));

// Define the schemas for the Telegram user
const groupBirthdaySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  chatId: { type: String, required: true }, // This is for group context
});

const personalBirthdaySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  name: { type: String, required: true }, // This is for personal context
});

// Create models for the birthday data
const BirthdayGroupData = mongoose.model(
  "BirthdayGroupData",
  groupBirthdaySchema,
);
const BirthdayPersonalData = mongoose.model(
  "BirthdayPersonalData",
  personalBirthdaySchema,
);

// Define schemas and models for tracking users and groups
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
});

const groupSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },
});

const User = mongoose.model("User", userSchema);
const Group = mongoose.model("Group", groupSchema);

bot.use(async (ctx, next) => {
  if (ctx.message) {
    const userId = ctx.message.from.id.toString();
    const chatId = ctx.message.chat.id.toString();

    if (ctx.message.chat.type === "private") {
      // Track users who start the bot
      try {
        await User.updateOne({ userId }, { userId }, { upsert: true });
      } catch (err) {
        console.error("Error tracking user:", err);
      }
    } else if (
      ctx.message.chat.type === "group" ||
      ctx.message.chat.type === "supergroup"
    ) {
      // Track groups the bot is added to
      try {
        await Group.updateOne({ chatId }, { chatId }, { upsert: true });
      } catch (err) {
        console.error("Error tracking group:", err);
      }
    }
  }
  return next();
});

// Start command
bot.start((ctx) => {
  const chatId = ctx.message.chat.id;
  const userId = ctx.message.from.id;
  const isGroup = chatId < 0;

  if (isGroup) {
    groupsServed.add(chatId);
  } else {
    usersStartedBot.add(userId);
  }

  const message = isGroup
    ? `🎉 Hi everyone! I'm here to help you keep track of everyone's birthdays in this group! 🎂

Here's what you can do:
- Add your birthday by typing /mybirthday [your birthday in DD-MM-YYYY format]. Example: /mybirthday 15-08-2006
- Remove your birthday by typing /deletebirthday
- See the list of birthdays added in this group with /birthdaylist

I'll send a special message on your birthday! 😊`
    : `🎉 Welcome! I'm delighted to meet you!

I'm here to help you keep track of your friends' birthdays and ensure you never miss a special day. Here's what you can do:

🎂 Command for DM only:

Add your friend's birthday by typing /addbirthday [Friend's Name] DD-MM-YYYY.
Example: /addbirthday Aakash_Gupta 15-08-2006
Remove your birthday by typing /deletebirthday
See the list of birthdays added in this group with /birthdaylist
I'll make sure your friends receive warm wishes on their special day! 🎈
`;

  ctx.reply(message);
});

// Command to add birthdays (for DM only)------------------------------------------------------------------------------------------
bot.command("addbirthday", async (ctx) => {
  // Get user ID and check if the command is used in a private message
  const userId = ctx.message.from.id.toString();
  if (ctx.message.chat.type !== "private") {
    ctx.reply(
      "This command only works in direct messages (DM).\nPlease send it in a private message.\nUse /help for more info.",
    );
    return;
  }

  // Extract arguments and check for correct format
  const args = ctx.message.text.split(" ").slice(1);
  if (args.length !== 2) {
    ctx.reply(
      "Please use the correct format:\n Example: /addbirthday Aakash_Gupta 15-08-2006",
    );
    return;
  }

  const name = args[0]; // Use the provided name instead of username
  const date = args[1];

  // Validate date format
  const datePattern = /^\d{2}-\d{2}-\d{4}$/;
  if (!datePattern.test(date)) {
    ctx.reply(`Invalid date format for ${name}. Please use DD-MM-YYYY format.`);
    return;
  }

  try {
    // Check for existing birthdays with the same name and date
    const existingBirthday = await BirthdayPersonalData.findOne({
      userId,
      name,
      date,
    });
    if (existingBirthday) {
      ctx.reply(`You have already added a birthday for ${name} on ${date}.`);
      return; // No need to proceed if birthday already exists
    }

    // Create a new birthday entry
    await BirthdayPersonalData.create({ userId, name, date });
    ctx.reply(`Birthday for ${name} on ${date} added successfully!`);
  } catch (err) {
    console.error("Error adding birthday:", err);
    ctx.reply("There was an error adding the birthday. Please try again.");
  }
});

// Command to add a birthday (for groups only)---------------------------------------------------------------------------------------
bot.command("mybirthday", async (ctx) => {
  const userId = ctx.message.from.id.toString();
  const chatId = ctx.message.chat.id.toString();
  const datePattern = /^\d{2}-\d{2}-\d{4}$/;
  const args = ctx.message.text.split(" ").slice(1);

  // Check if the command was used in a direct message
  if (ctx.message.chat.type === "private") {
    ctx.reply(
      "This command does not work in DM.\nPlease use /addbirthday for adding your friends' birthdays in List.\nUse /help for more info.",
    );
    return;
  }

  if (!datePattern.test(args[0])) {
    ctx.reply("Please use the correct date format: DD-MM-YYYY");
    return;
  }

  const [date] = args;

  try {
    const existingBirthday = await BirthdayGroupData.findOne({
      userId,
      chatId,
    });
    if (existingBirthday) {
      ctx.reply(
        "Your birthday is already added. If you want to change it, please delete it first using /deletebirthday and then add it again.",
      );
      return;
    }

    await BirthdayGroupData.create({
      userId,
      date,
      chatId,
    });
    ctx.reply("Your birthday is added. Thank you!");
  } catch (err) {
    console.error("Error adding birthday:", err);
    ctx.reply("There was an error adding your birthday. Please try again.");
  }
});

// Command to delete a birthday-----------------------------------------------------------------------------------------------------
bot.command("deletebirthday", async (ctx) => {
  const userId = ctx.message.from.id.toString();
  const chatType = ctx.message.chat.type;

  if (chatType === "private") {
    const name = ctx.message.text.split(" ")[1];

    if (!name) {
      ctx.reply(
        "Please provide the name of the friend whose birthday you want to delete.\n Enter names as it is you have written while adding.",
      );
      return;
    }

    try {
      const result = await BirthdayPersonalData.findOneAndDelete({
        userId,
        name,
      });
      if (result) {
        ctx.reply(`Birthday for ${name} has been deleted.`);
      } else {
        ctx.reply(`No birthday found for ${name}.`);
      }
    } catch (err) {
      console.error("Error deleting birthday:", err);
      ctx.reply("There was an error deleting the birthday. Please try again.");
    }
  } else {
    try {
      const result = await BirthdayGroupData.findOneAndDelete({
        userId,
        chatId: ctx.message.chat.id.toString(),
      });

      if (result) {
        ctx.reply("Your birthday has been deleted.");
      } else {
        ctx.reply("No birthday found for you in this group.");
      }
    } catch (err) {
      console.error("Error deleting birthday:", err);
      ctx.reply("There was an error deleting your birthday. Please try again.");
    }
  }
});

// Command to list all birthdays in a group or private chat----------------------------------------------------------------------
bot.command("birthdaylist", async (ctx) => {
  const chatId = ctx.message.chat.id.toString();
  const chatType = ctx.message.chat.type;

  if (chatType === "private") {
    const userId = ctx.message.from.id.toString();
    try {
      const birthdays = await BirthdayPersonalData.find({ userId });
      if (birthdays.length === 0) {
        ctx.reply("No birthdays found.");
        return;
      }

      const birthdayList = birthdays
        .map((birthday) => `${birthday.name}: ${birthday.date}`)
        .join("\n");

      ctx.reply(`Here are the birthdays you've added:\n\n${birthdayList}`);
    } catch (err) {
      console.error("Error fetching birthday list:", err);
      ctx.reply(
        "There was an error fetching the birthday list. Please try again.",
      );
    }
  } else {
    try {
      const birthdays = await BirthdayGroupData.find({ chatId });
      if (birthdays.length === 0) {
        ctx.reply("No birthdays found in this group.");
        return;
      }

      const birthdayList = await Promise.all(
        birthdays.map(async (birthday) => {
          const userInfo = await bot.telegram.getChatMember(
            chatId,
            birthday.userId,
          );
          return `- @${userInfo.user.username || userInfo.user.first_name}: ${birthday.date}`;
        }),
      );

      ctx.reply(
        `Here are the birthdays in this group:\n\n${birthdayList.join("\n")}`,
      );
    } catch (err) {
      console.error("Error fetching birthday list:", err);
      ctx.reply(
        "There was an error fetching the birthday list. Please try again.",
      );
    }
  }
});

// Function to check for birthdays and send messages in private messages only----------------------------------------------------
async function checkBirthdayPrivate() {
  const today = new Date();
  const formattedToday = `${String(today.getDate()).padStart(2, "0")}-${String(
    today.getMonth() + 1,
  ).padStart(2, "0")}`;

  try {
    const oneDayBefore = new Date(today);
    oneDayBefore.setDate(today.getDate() + 1);
    const formattedOneDayBefore = `${String(oneDayBefore.getDate()).padStart(
      2,
      "0",
    )}-${String(oneDayBefore.getMonth() + 1).padStart(2, "0")}`;

    const twoDaysBefore = new Date(today);
    twoDaysBefore.setDate(today.getDate() + 2);
    const formattedTwoDaysBefore = `${String(twoDaysBefore.getDate()).padStart(
      2,
      "0",
    )}-${String(twoDaysBefore.getMonth() + 1).padStart(2, "0")}`;

    const birthdaysToday = await BirthdayPersonalData.find({
      date: new RegExp(`^${formattedToday}-\\d{4}$`),
    });

    const birthdaysOneDayBefore = await BirthdayPersonalData.find({
      date: new RegExp(`^${formattedOneDayBefore}-\\d{4}$`),
    });

    const birthdaysTwoDaysBefore = await BirthdayPersonalData.find({
      date: new RegExp(`^${formattedTwoDaysBefore}-\\d{4}$`),
    });

    for (const birthday of birthdaysToday) {
      const userId = birthday.userId;
      await bot.telegram.sendMessage(
        userId,
        `🎉 Hey! Today is your friend ${birthday.name}'s birthday! Don't forget to wish them a fantastic day! 🎂`,
      );
    }

    for (const birthday of birthdaysOneDayBefore) {
      const userId = birthday.userId;
      await bot.telegram.sendMessage(
        userId,
        `🎉 Just a friendly reminder: Tomorrow is your friend ${birthday.name}'s birthday! Don't forget to send them your best wishes! 🎈`,
      );
    }

    for (const birthday of birthdaysTwoDaysBefore) {
      const userId = birthday.userId;
      await bot.telegram.sendMessage(
        userId,
        `🎉 Just a friendly reminder: In two days, it's your friend ${birthday.name}'s birthday! Don't forget to send them your best wishes! 🎈`,
      );
    }
  } catch (err) {
    console.error("Error checking birthdays in private messages:", err);
  }
}

// Function to check for birthdays and send messages in group chats-----------------------------------------------------------------
// Utility function to format a date as DD-MM
function formatDate(date) {
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Utility function to add days to a date
function addDays(date, days) {
  const newDate = new Date(date);
  newDate.setDate(date.getDate() + days);
  return newDate;
}

// Function to generate a birthday wish message
function generateBirthdayWish(name) {
  return `🎂🎉 Happy Birthday, ${name}! 🎈🥳\n\nMay your special day be filled with love, joy, and unforgettable moments. Wishing you all the happiness in the world on your birthday and always! 🎁🎈`;
}

// Function to generate a birthday notification message
function generateBirthdayNotification(daysLeft, birthdayPerson) {
  return `🎉 Hey everyone, just a reminder: ${daysLeft} day(s) left for @${birthdayPerson}'s birthday! Let's get ready to celebrate together! 🎈🥳`;
}

// Main function to check birthdays and send messages in group chats
async function checkBirthdayGroup() {
  const today = new Date();
  const formattedToday = formatDate(today);
  const formattedOneDayBefore = formatDate(addDays(today, 1));
  const formattedTwoDaysBefore = formatDate(addDays(today, 2));

  console.log(`Checking birthdays for today (${formattedToday}), one day before (${formattedOneDayBefore}), and two days before (${formattedTwoDaysBefore}).`);

  try {
    // Log all birthdays for debugging
    const allBirthdays = await BirthdayGroupData.find({});
    console.log("All Birthdays in Group Data:", allBirthdays);

    // Fetch birthdays for today, one day before, and two days before
    const [birthdaysToday, birthdaysOneDayBefore, birthdaysTwoDaysBefore] = await Promise.all([
      BirthdayGroupData.find({ date: new RegExp(`^${formattedToday}`) }),
      BirthdayGroupData.find({ date: new RegExp(`^${formattedOneDayBefore}`) }),
      BirthdayGroupData.find({ date: new RegExp(`^${formattedTwoDaysBefore}`) }),
    ]);

    console.log("Birthdays Today:", birthdaysToday);
    console.log("Birthdays One Day Before:", birthdaysOneDayBefore);
    console.log("Birthdays Two Days Before:", birthdaysTwoDaysBefore);

    if (!birthdaysToday.length && !birthdaysOneDayBefore.length && !birthdaysTwoDaysBefore.length) {
      console.log("No birthdays to notify for today, one day before, or two days before.");
      return;
    }

    // Send notifications for one day before birthdays
    for (const birthday of birthdaysOneDayBefore) {
      try {
        const { chatId, userId } = birthday;
        const userInfo = await bot.telegram.getChatMember(chatId, userId);
        const notification = generateBirthdayNotification("one", userInfo.user.username || userInfo.user.first_name);
        await bot.telegram.sendMessage(chatId, notification);
      } catch (err) {
        console.error("Error sending one day before birthday notification:", err);
      }
    }

    // Send notifications for two days before birthdays
    for (const birthday of birthdaysTwoDaysBefore) {
      try {
        const { chatId, userId } = birthday;
        const userInfo = await bot.telegram.getChatMember(chatId, userId);
        const notification = generateBirthdayNotification("two", userInfo.user.username || userInfo.user.first_name);
        await bot.telegram.sendMessage(chatId, notification);
      } catch (err) {
        console.error("Error sending two days before birthday notification:", err);
      }
    }

    // Send birthday wishes for today
    for (const birthday of birthdaysToday) {
      try {
        const { chatId, userId } = birthday;
        const userInfo = await bot.telegram.getChatMember(chatId, userId);
        const taggedName = `@${userInfo.user.username || userInfo.user.first_name}`;
        const birthdayWish = generateBirthdayWish(taggedName);
        const message = await bot.telegram.sendMessage(chatId, birthdayWish, { parse_mode: "Markdown" });
        await bot.telegram.pinChatMessage(chatId, message.message_id);
      } catch (err) {
        console.error("Error sending today birthday wish and pinning message:", err);
      }
    }
  } catch (err) {
    console.error("Error checking birthdays in group:", err);
  }
}


// Schedule tasks using cron
const checkBirthdayPrivateJob = new CronJob(
  '0 0 0 * * *',
  checkBirthdayPrivate,
  null,
  true,
  'Asia/Kolkata'
);

const checkBirthdayGroupJob = new CronJob(
  '0 0 0 * * *',
  checkBirthdayGroup,
  null,
  true,
  'Asia/Kolkata'
);

// Start the jobs
checkBirthdayPrivateJob.start();
checkBirthdayGroupJob.start();

// Help command with buttons and features explanation-----------------------------------------------------------------------------
bot.command("help", (ctx) => {
  const helpMessage = `🤖 *Welcome to Birthday Reminder Bot* 🎉

    This bot helps you manage birthdays and sends reminders for upcoming birthdays. Here are some things you can do:

    Add Your Birthday:

    -In Group Chats: 
    Use /mybirthday [DD-MM-YYYY] to add your birthday.
    Example: /mybirthday 15-08-2006

    -In Private Messages: 
    Use /addbirthday [Friend's Name] [DD-MM-YYYY] to add a friend's birthday.
    Example: /addbirthday Aakashuu 15-08-2006

    **Commands for both Groups and Private**
    -Remove Your Birthday:
    Use /deletebirthday to remove your birthday from the list.

    -View Birthday List:
    Use /birthdaylist to see all birthdays added in the group or in your personal list.
    Special Birthday Messages:

    The bot will send a custom birthday message on your special day, and even pin the message in group chats!

    Click the buttons below for more information or to get started!`;

  const buttons = Markup.inlineKeyboard([
    Markup.button.url("📘 Documentation", "https://techtutezs-organization.gitbook.io/docs/"),
    Markup.button.callback("🎂 About", "about"),
    Markup.button.callback("📞 Support", "support"),
  ]);

  ctx.reply(helpMessage, buttons);
});

// Handle button callbacks
bot.action("support", (ctx) =>
  ctx.reply(
    "Birthday Reminder Bot v1.0. Developed by @itsAkashz.\n Feel free to DM for any support and reporting bugs.",
  ),
);

ABOUT_REPLY = `🎉 About Birthday Reminder Bot 🎉

    Welcome to the Birthday Reminder Bot, your personal assistant for managing and remembering birthdays! Developed by YourName, this bot ensures that you never miss a special day, whether it's your birthday or your friends'. Here's what you can do with the bot:

    🎂 Key Features
    Add Your Birthday:

    -In Group Chats: 
    Use /mybirthday [DD-MM-YYYY] to add your birthday.
    Example: /mybirthday 15-08-2006

    -In Private Messages: 
    Use /addbirthday [Friend's Name] [DD-MM-YYYY] to add a friend's birthday.
    Example: /addbirthday Aakashuu 15-08-2006

    **Commands for both Groups and Private**
    -Remove Your Birthday:
    Use /deletebirthday to remove your birthday from the list.

    -View Birthday List:
    Use /birthdaylist to see all birthdays added in the group or in your personal list.
    Special Birthday Messages:

    The bot will send a custom birthday message on your special day, and even pin the message in group chats!

    📚 Additional Commands
    Help: Use /help to see a list of available commands and get more information about how to use the bot.
    Contact Support: Get in touch with support if you have any questions or need assistance. Use the command /contact.

    🤖 Developed By
    Developer: Aakash Gupta
    Contact: gzatrop@mail.com
    Thank you for using Birthday Reminder Bot! We hope it makes your special days even more memorable. 🎈`;
bot.action("about", (ctx) => ctx.reply(ABOUT_REPLY));

// Basic responses
bot.on("sticker", (ctx) => ctx.reply("👍"));

//Analytics command--------------------------------------------------------------------------------------------------------------
bot.command("analytics", (ctx) => {
  const chatId = ctx.message.chat.id;
  const isGroup = chatId < 0;

  if (!isGroup) {
    const groupCount = groupsServed.size;
    const userCount = usersStartedBot.size;

    ctx.reply(`📊 Bot Analytics:
- Number of groups served: ${groupCount}
- Number of users who started the bot: ${userCount}`);
  } else {
    ctx.reply("This command can only be used in direct messages.");
  }
});

//broadcast command start here------------------------------------------------------------------------------------------------------
const BOT_OWNER_ID = process.env.BOT_OWNER_ID; // Add the bot owner's Telegram user ID to your .env file

bot.command('broadcast', async (ctx) => {
  const userId = ctx.message.from.id.toString();

  if (userId !== BOT_OWNER_ID) {
    ctx.reply('You are not authorized to use this command.');
    return;
  }

  const messageText = ctx.message.text.split(' ').slice(1).join(' ');
  if (!messageText) {
    ctx.reply('Please provide a message to broadcast. Usage: /broadcast [message]');
    return;
  }

  const results = {
    groups: { success: 0, failed: 0 },
    users: { success: 0, failed: 0 }
  };

  try {
    const groups = await Group.find({});
    const users = await User.find({});

    const sendMessageToGroup = async (groupId) => {
      try {
        await bot.telegram.sendMessage(groupId, messageText);
        results.groups.success += 1;
      } catch (err) {
        console.error(`Failed to send message to group ${groupId}:`, err);
        results.groups.failed += 1;
      }
    };

    const sendMessageToUser = async (userId) => {
      try {
        await bot.telegram.sendMessage(userId, messageText);
        results.users.success += 1;
      } catch (err) {
        console.error(`Failed to send message to user ${userId}:`, err);
        results.users.failed += 1;
      }
    };

    // Broadcast to all groups
    for (const group of groups) {
      await sendMessageToGroup(group.chatId);
    }

    // Broadcast to all users
    for (const user of users) {
      await sendMessageToUser(user.userId);
    }

    ctx.reply(`Broadcast message sent successfully.
Groups: ${results.groups.success} succeeded, ${results.groups.failed} failed.
Users: ${results.users.success} succeeded, ${results.users.failed} failed.`);
  } catch (err) {
    console.error('Error broadcasting message:', err);
    ctx.reply('There was an error broadcasting the message. Please try again.');
  }
});



// Launch the bot
bot
  .launch()
  .then(() => {
    console.log("Bot started successfully");
  })
  .catch((err) => {
    console.error("Error starting the bot:", err);
  });

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
