const { Telegraf, Markup } = require("telegraf");
const mongoose = require("mongoose");
const axios = require("axios");
const dotenv = require("dotenv");


const bot = new Telegraf(process.env.BOT_TOKEN);

const MONGO_URI =process.env.MONGO_URI
// Connect to MongoDB
mongoose
  .connect(MONGO_URI)
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

// Function to generate a custom birthday message
// async function generateCustomMessage(name) {
//   try {
//     const response = await axios.post("YOUR_GENERATIVE_AI_API_URL", {
//       prompt: `Generate a birthday message for ${name}`,
//     });
//     return response.data.message; // Adjust this line based on your API's response format
//   } catch (err) {
//     console.error("Error generating custom message:", err);
//     return "Happy Birthday!";
//   }
// }

// Start command
bot.start((ctx) => {
  const chatId = ctx.message.chat.id;
  const isGroup = chatId < 0;

  const message = isGroup
    ? `🎉 Hi everyone! I'm here to help you keep track of everyone's birthdays in this group! 🎂

Here's what you can do:
- Add your birthday by typing /mybirthday [your birthday in DD-MM-YYYY format]. Example: /mybirthday 15-08-2006
- Remove your birthday by typing /deletebirthday
- See the list of birthdays added in this group with /birthdayList

I'll send a special message on your birthday! 😊`
    : `🎉 Welcome! I'm delighted to meet you!

I'm here to help you keep track of your friends' birthdays and ensure you never miss a special day. Here's what you can do:

🎂 Command for DM only:

Add your friend's birthday by typing /addbirthday YOUR_FRIEND_NAME DD-MM-YYYY.
Example: /addbirthday Aakashuu 15-08-2006
Remove your birthday by typing /deletebirthday
See the list of birthdays added in this group with /birthdayList
I'll make sure your friends receive warm wishes on their special day! 🎈
`;

  ctx.reply(message);
});

// Command to add birthdays (for DM only)
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

// Command to add a birthday (for groups only)
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

// Command to delete a birthday
bot.command("deletebirthday", async (ctx) => {
  const userId = ctx.message.from.id.toString();
  const chatType = ctx.message.chat.type;

  if (chatType === "private") {
    const name = ctx.message.text.split(" ")[1];

    if (!name) {
      ctx.reply(
        "Please provide the name of the friend whose birthday you want to delete.",
      );
      return;
    }

    try {
      const result = await BirthdayPersonalData.findOneAndDelete({
        userId,
        name,
      });
      if (result) {
        ctx.reply(`Birthday for ${name} deleted successfully.`);
      } else {
        ctx.reply(`No birthday found for ${name} to delete.`);
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
        ctx.reply("Your birthday deleted successfully.");
      } else {
        ctx.reply("No birthday found to delete.");
      }
    } catch (err) {
      console.error("Error deleting birthday in group:", err);
      ctx.reply(
        "There was an error deleting the birthday in group. Please try again.",
      );
    }
  }
});

// Command to list birthdays in the group and direct message
bot.command("birthdayList", async (ctx) => {
  const chatId = ctx.message.chat.id;
  const isGroup = chatId < 0;
  let birthdays = [];

  try {
    if (isGroup) {
      birthdays = await BirthdayGroupData.find({ chatId });
    } else {
      const userId = ctx.message.from.id.toString();
      birthdays = await BirthdayPersonalData.find({ userId });
    }

    if (birthdays.length === 0) {
      ctx.reply("No birthdays found.");
      return;
    }

    const birthdayList = [];

    for (const bday of birthdays) {
      let displayName = "Unknown";
      if (bday.name) {
        displayName = bday.name;
      } else {
        try {
          const userInfo = await bot.telegram.getChatMember(
            bday.chatId || ctx.message.chat.id,
            bday.userId,
          );
          displayName =
            userInfo.user.username ||
            `${userInfo.user.first_name} ${userInfo.user.last_name || ""}`;
        } catch (error) {
          console.error("Error getting user info:", error);
        }
      }
      birthdayList.push(`${displayName} - ${bday.date}`);
    }

    ctx.reply(`Birthday List:\n${birthdayList.join("\n")}`);
  } catch (err) {
    console.error("Error fetching birthdays:", err);
    ctx.reply("There was an error fetching the birthdays. Please try again.");
  }
});

// Function to check for birthdays and send messages in private messages only
async function checkBirthdayPrivate() {
  const today = new Date();
  const formattedToday = `${String(today.getDate()).padStart(2, "0")}-${String(
    today.getMonth() + 1,
  ).padStart(2, "0")}-${today.getFullYear()}`;

  try {
    // Get birthdays for today and two days later
    const birthdaysToday = await BirthdayPersonalData.find({
      date: formattedToday,
    });
    const twoDaysLater = new Date(today);
    twoDaysLater.setDate(today.getDate() + 2);
    const formattedTwoDaysLater = `${String(twoDaysLater.getDate()).padStart(2, "0")}-${String(
      twoDaysLater.getMonth() + 1,
    ).padStart(2, "0")}-${twoDaysLater.getFullYear()}`;
    const birthdaysTwoDaysLater = await BirthdayPersonalData.find({
      date: formattedTwoDaysLater,
    });

    for (const birthday of birthdaysToday) {
      const userId = birthday.userId;

      // Send notification for the birthday today
      await bot.telegram.sendMessage(
        userId,
        `🎉 Hey! Today is your friend ${birthday.name}'s birthday! Don't forget to wish them a fantastic day! 🎂`,
      );
    }

    for (const birthday of birthdaysTwoDaysLater) {
      const userId = birthday.userId;

      // Send notification for the birthday approaching in two days
      await bot.telegram.sendMessage(
        userId,
        `🎉 Just a friendly reminder: In two days, it's your friend ${birthday.name}'s birthday! Don't forget to send them your best wishes! 🎈`,
      );
    }
  } catch (err) {
    console.error("Error checking birthdays in private messages:", err);
  }
}

// Function to check for birthdays and send messages in group chats
async function checkBirthdayGroup() {
  const today = new Date();
  const formattedToday = `${String(today.getDate()).padStart(2, "0")}-${String(
    today.getMonth() + 1,
  ).padStart(2, "0")}-${today.getFullYear()}`;

  try {
    // Get birthdays for today, one day before, and two days before
    const birthdaysToday = await BirthdayGroupData.find({
      date: formattedToday,
    });
    const oneDayBefore = new Date(today);
    oneDayBefore.setDate(today.getDate() + 1);
    const formattedOneDayBefore = `${String(oneDayBefore.getDate()).padStart(2, "0")}-${String(
      oneDayBefore.getMonth() + 1,
    ).padStart(2, "0")}-${oneDayBefore.getFullYear()}`;
    const birthdaysOneDayBefore = await BirthdayGroupData.find({
      date: formattedOneDayBefore,
    });
    const twoDaysBefore = new Date(today);
    twoDaysBefore.setDate(today.getDate() + 2);
    const formattedTwoDaysBefore = `${String(twoDaysBefore.getDate()).padStart(2, "0")}-${String(
      twoDaysBefore.getMonth() + 1,
    ).padStart(2, "0")}-${twoDaysBefore.getFullYear()}`;
    const birthdaysTwoDaysBefore = await BirthdayGroupData.find({
      date: formattedTwoDaysBefore,
    });

    // Function to generate the birthday wish message
    function generateBirthdayWish(name) {
      return `🎂🎉 Happy Birthday, ${name}! 🎈🥳\n\nMay your special day be filled with love, joy, and unforgettable moments. Wishing you all the happiness in the world on your birthday and always! 🎁🎈`;
    }

    // Function to generate the birthday notification message
    function generateBirthdayNotification(day, birthdayPerson) {
      return `🎉 Hey everyone, just a reminder: ${day} day left for @${birthdayPerson}'s birthday! Let's get ready to celebrate together! 🎈🥳`;
    }

    // Send notification one day before birthday
    for (const birthday of birthdaysOneDayBefore) {
      const chatId = birthday.chatId;
      const userInfo = await bot.telegram.getChatMember(
        chatId,
        birthday.userId,
      );
      const notification = generateBirthdayNotification(
        "one",
        userInfo.user.username,
      );
      await bot.telegram.sendMessage(chatId, notification);
    }

    // Send notification two days before birthday
    for (const birthday of birthdaysTwoDaysBefore) {
      const chatId = birthday.chatId;
      const userInfo = await bot.telegram.getChatMember(
        chatId,
        birthday.userId,
      );
      const notification = generateBirthdayNotification(
        "two",
        userInfo.user.username,
      );
      await bot.telegram.sendMessage(chatId, notification);
    }

    // Send birthday wishes and pin the message on the birthday
    for (const birthday of birthdaysToday) {
      const userId = birthday.userId;
      const chatId = birthday.chatId;
      const userInfo = await bot.telegram.getChatMember(chatId, userId);
      const taggedName = `@${userInfo.user.username || userInfo.user.first_name}`;

      // Generate birthday wish message
      const birthdayWish = generateBirthdayWish(taggedName);

      // Send birthday greeting message in the group
      const message = await bot.telegram.sendMessage(chatId, birthdayWish, {
        parse_mode: "Markdown",
      });

      // Pin the birthday message in the group
      await bot.telegram.pinChatMessage(chatId, message.message_id);
    }
  } catch (err) {
    console.error("Error checking birthdays in group:", err);
  }
}

// Set an interval to check birthdays in private messages every day at midnight
setInterval(checkBirthdayPrivate, 24 * 60 * 60 * 1000);

// Set an interval to check birthdays every day at midnight
setInterval(checkBirthdayGroup, 24 * 60 * 60 * 1000);

// Help command with buttons and features explanation
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
    Use /birthdayList to see all birthdays added in the group or in your personal list.
    Special Birthday Messages:

    The bot will send a custom birthday message on your special day, and even pin the message in group chats!

    Click the buttons below for more information or to get started!`;

  const buttons = Markup.inlineKeyboard([
    Markup.button.url("📘 Documentation", "https://example.com/documentation"),
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
    Use /birthdayList to see all birthdays added in the group or in your personal list.
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
