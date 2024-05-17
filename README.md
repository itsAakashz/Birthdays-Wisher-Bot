
# BirthdaysWisherBot

Birthday Reminder Bot is a Telegram bot designed to help you manage and remember birthdays of your friends and group members. With this bot, you can add, delete, and list birthdays, receive notifications for upcoming birthdays, and send custom birthday messages.

## Features

- Add birthdays for yourself or your friends
- Delete birthdays
- List all birthdays
- Receive notifications for upcoming birthdays
- Send custom birthday messages

##Docs- https://techtutezs-organization.gitbook.io/docs/

## Getting Started

To get started with Birthday Reminder Bot, follow these steps:

1. **Clone the repository:**
   ```sh
   git clone https://github.com/itsAakashz/Birthdays-Wisher-Bot.git
   ```

2. **Install dependencies:**
   ```sh
   cd Birthdays-Wisher-Bot
   npm install
   ```

3. **Set up environment variables:**
   - Create a `.env` file in the root directory.
   - Add your Telegram bot token and MongoDB URI in the `.env` file:
     ```
     BOT_TOKEN=your_bot_token
     MONGO_URI=your_mongo_uri
     ```

4. **Run the bot:**
   ```sh
   npm start
   ```

5. **Interact with the bot:**
   - Start a chat with your bot on Telegram and follow the on-screen instructions to add, delete, or list birthdays.

## Commands

- `/addbirthday [Name] [DD-MM-YYYY]`: Add a birthday for yourself or your friend.
- `/deletebirthday [Name]`: Delete a birthday.
- `/birthdaylist`: List all birthdays.
- `/help`: Get help and see a list of available commands.
- `/about`: Learn more about the bot and its features.

## Contributing

Contributions are welcome! If you'd like to contribute to Birthday Reminder Bot, please follow these guidelines:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/your-feature-name`).
3. Commit your changes (`git commit -am 'Add some feature'`).
4. Push to the branch (`git push origin feature/your-feature-name`).
5. Create a new pull request.

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgements

- This bot was inspired by the need to remember birthdays in busy group chats.
- Special thanks to the Telegram Bot API and MongoDB for making development easier.
```

Feel free to customize the content according to your project's specific details and requirements.
