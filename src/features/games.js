import { InlineKeyboard } from 'grammy';
import {
  rollDice,
  flipCoin,
  pickOption,
  playSuit,
  startTebakGame,
  getTebakGame,
  guessTebakGame,
  getRandomQuizQuestion,
  checkQuizAnswer,
  recordGameResult,
  getUserScore,
  getChatLeaderboard,
} from '../core/games.js';

const SUIT_EMOJI = {
  batu: 'Rock',
  gunting: 'Scissors',
  kertas: 'Paper',
};

function buildSuitKeyboard() {
  return new InlineKeyboard()
    .text('Rock', 'suit:batu')
    .text('Scissors', 'suit:gunting')
    .text('Paper', 'suit:kertas');
}

function buildQuizKeyboard(question) {
  const kb = new InlineKeyboard();
  const letters = ['A', 'B', 'C', 'D'];
  question.options.forEach((opt, idx) => {
    kb.text(`${letters[idx]}. ${opt}`, `quiz:${question.id}:${idx}`).row();
  });
  return kb;
}

export default {
  id: 'games',

  commands: [
    {
      name: 'suit',
      description: 'Play rock-paper-scissors against the bot',
      handler: async (ctx) => {
        const p = ctx.persona ?? { strings: {} };
        const prompt =
          p.strings?.suitPrompt ??
          "Let's play rock-paper-scissors! Choose rock, paper, or scissors:";
        await ctx.reply(prompt, { reply_markup: buildSuitKeyboard() });
      },
    },

    {
      name: 'tebak',
      description: 'Guess secret number 1-100 (e.g., /tebak 45)',
      handler: async (ctx) => {
        const chatId = ctx.chat.id;
        const userId = ctx.from?.id;
        const p = ctx.persona ?? { strings: {} };
        const text = ctx.message?.text ?? '';
        const parts = text.split(/\s+/).slice(1);
        const arg = parts[0];

        if (!arg) {
          const existing = getTebakGame(chatId);
          if (existing) {
            await ctx.reply(
              `Number guessing game in progress!\nRemaining attempts: *${existing.attemptsLeft}/${existing.maxAttempts}*.\nGuess with: \`/tebak <number>\``,
              { parse_mode: 'Markdown' },
            );
            return;
          }

          startTebakGame(chatId);
          const startMsg =
            p.strings?.tebakStart ??
            'I picked a secret number between 1 and 100! You have 7 attempts. Guess with: `/tebak <number>`';
          await ctx.reply(startMsg, { parse_mode: 'Markdown' });
          return;
        }

        const guessNum = parseInt(arg, 10);
        if (isNaN(guessNum) || guessNum < 1 || guessNum > 100) {
          await ctx.reply('Enter a whole number between 1 and 100! Example: `/tebak 50`', {
            parse_mode: 'Markdown',
          });
          return;
        }

        if (!getTebakGame(chatId)) {
          startTebakGame(chatId);
        }

        const res = guessTebakGame(chatId, guessNum);

        if (res.status === 'win') {
          if (userId) recordGameResult({ userId, chatId, result: 'win' });
          const winMsg =
            p.strings?.tebakWin?.replace('{target}', res.target) ??
            `Congratulations! Your guess of *${res.target}* is correct! (+3 points)`;
          await ctx.reply(winMsg, { parse_mode: 'Markdown' });
          return;
        }

        if (res.status === 'game_over') {
          if (userId) recordGameResult({ userId, chatId, result: 'loss' });
          const lossMsg =
            p.strings?.tebakGameOver?.replace('{target}', res.target) ??
            `Out of attempts! The secret number was *${res.target}*. (+0 points)`;
          await ctx.reply(lossMsg, { parse_mode: 'Markdown' });
          return;
        }

        if (res.status === 'too_high') {
          const highMsg =
            p.strings?.tebakTooHigh?.replace('{attempts}', res.attemptsLeft) ??
            `Too high! ${res.attemptsLeft} attempts remaining.`;
          await ctx.reply(highMsg);
          return;
        }

        if (res.status === 'too_low') {
          const lowMsg =
            p.strings?.tebakTooLow?.replace('{attempts}', res.attemptsLeft) ??
            `Too low! ${res.attemptsLeft} attempts remaining.`;
          await ctx.reply(lowMsg);
          return;
        }
      },
    },

    {
      name: 'quiz',
      description: 'Multiple choice trivia quiz',
      handler: async (ctx) => {
        const question = getRandomQuizQuestion();
        if (!question) {
          await ctx.reply('Trivia quiz bank is not available.');
          return;
        }

        const letters = ['A', 'B', 'C', 'D'];
        const optionsList = question.options
          .map((opt, i) => `${letters[i]}. ${opt}`)
          .join('\n');

        const text = `*Trivia Quiz*\n\n*${question.question}*\n\n${optionsList}`;
        await ctx.reply(text, {
          parse_mode: 'Markdown',
          reply_markup: buildQuizKeyboard(question),
        });
      },
    },

    {
      name: 'truth',
      description: 'Truth challenge',
      handler: async (ctx) => {
        const p = ctx.persona ?? { strings: {} };
        const list = Array.isArray(p.strings?.truth) && p.strings.truth.length > 0
          ? p.strings.truth
          : [
              'What is the most embarrassing thing that ever happened to you?',
              'When was the last time you lied, and what was it about?',
            ];
        const item = list[Math.floor(Math.random() * list.length)];
        await ctx.reply(`*Truth:*\n"${item}"\n\n_Answer honestly!_`, {
          parse_mode: 'Markdown',
        });
      },
    },

    {
      name: 'dare',
      description: 'Dare challenge',
      handler: async (ctx) => {
        const p = ctx.persona ?? { strings: {} };
        const list = Array.isArray(p.strings?.dare) && p.strings.dare.length > 0
          ? p.strings.dare
          : [
              'Send a funny sticker to your top chat right now!',
              'Drink a full glass of water right now!',
            ];
        const item = list[Math.floor(Math.random() * list.length)];
        await ctx.reply(`*Dare:*\n"${item}"\n\n_Do it now, do not back out!_`, {
          parse_mode: 'Markdown',
        });
      },
    },

    {
      name: 'pilih',
      description: 'Help choose between options (e.g., /pilih coffee, tea, milk)',
      handler: async (ctx) => {
        const text = ctx.message?.text ?? '';
        const rawArg = text.replace(/^\/pilih(@\w+)?/i, '').trim();

        if (!rawArg) {
          await ctx.reply('Invalid format! Example: `/pilih coffee, tea, milk` or `/pilih pizza or pasta`', {
            parse_mode: 'Markdown',
          });
          return;
        }

        const delimiter = rawArg.includes(' or ') || rawArg.includes(' atau ') ? /\s+(?:or|atau)\s+/i : /,/;
        const options = rawArg
          .split(delimiter)
          .map((s) => s.trim())
          .filter(Boolean);

        if (options.length < 2) {
          await ctx.reply('Provide at least 2 options! Example: `/pilih movie, sleep`', {
            parse_mode: 'Markdown',
          });
          return;
        }

        const choice = pickOption(options);
        const p = ctx.persona ?? { strings: {} };
        const replyText =
          p.strings?.pickChoice?.replace('{choice}', choice) ??
          `I pick: *${choice}*!`;

        await ctx.reply(replyText, { parse_mode: 'Markdown' });
      },
    },

    {
      name: 'dadu',
      description: 'Roll a random 6-sided dice',
      handler: async (ctx) => {
        const roll = rollDice();
        await ctx.reply(`*Dice Roll Result:* [ *${roll}* ]`, {
          parse_mode: 'Markdown',
        });
      },
    },

    {
      name: 'koin',
      description: 'Flip a coin (Heads / Tails)',
      handler: async (ctx) => {
        const flip = flipCoin();
        await ctx.reply(`*Coin Flip Result:* [ *${flip}* ]`, {
          parse_mode: 'Markdown',
        });
      },
    },

    {
      name: 'skor',
      description: 'View game leaderboard in this chat',
      handler: async (ctx) => {
        const chatId = ctx.chat.id;
        const userId = ctx.from?.id;
        const rows = getChatLeaderboard(chatId, 10);

        if (rows.length === 0) {
          await ctx.reply(
            'No scores recorded in this chat yet.\nPlay /suit, /tebak, or /quiz to start earning points!',
          );
          return;
        }

        const medals = ['1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.', '10.'];
        const listText = rows
          .map((r, i) => `${medals[i] || `${i + 1}.`} *${r.first_name}*: *${r.points}* points (${r.wins}W / ${r.draws}D / ${r.losses}L)`)
          .join('\n');

        let footer = '';
        if (userId) {
          const myScore = getUserScore(userId, chatId);
          footer = `\n\n*Your Score:* *${myScore.points}* points (${myScore.wins} Wins / ${myScore.draws} Draws / ${myScore.losses} Losses)`;
        }

        const response = `*Game Leaderboard*\n\n${listText}${footer}`;
        await ctx.reply(response, { parse_mode: 'Markdown' });
      },
    },
  ],

  callbacks: [
    {
      prefix: 'suit:',
      handler: async (ctx) => {
        const data = ctx.callbackQuery?.data ?? '';
        const choice = data.replace('suit:', '');

        if (choice === 'again') {
          const p = ctx.persona ?? { strings: {} };
          const prompt =
            p.strings?.suitPrompt ??
            "Let's play rock-paper-scissors again! Choose rock, paper, or scissors:";
          await ctx.editMessageText(prompt, { reply_markup: buildSuitKeyboard() });
          await ctx.answerCallbackQuery().catch(() => {});
          return;
        }

        let playRes;
        try {
          playRes = playSuit(choice);
        } catch {
          await ctx.answerCallbackQuery({ text: 'Invalid choice!' });
          return;
        }

        const userId = ctx.from?.id;
        const chatId = ctx.chat?.id;
        if (userId && chatId) {
          recordGameResult({ userId, chatId, result: playRes.result });
        }

        const p = ctx.persona ?? { strings: {} };
        let comment = '';
        if (playRes.result === 'win') {
          comment = p.strings?.suitWin ?? 'You won! (+3 points)';
        } else if (playRes.result === 'loss') {
          comment = p.strings?.suitLoss ?? 'You lost! (+0 points)';
        } else {
          comment = p.strings?.suitDraw ?? "It's a draw! (+1 point)";
        }

        const uEmoji = SUIT_EMOJI[playRes.userChoice] || playRes.userChoice;
        const bEmoji = SUIT_EMOJI[playRes.botChoice] || playRes.botChoice;

        const resultText =
          `*Rock Paper Scissors Result*\n\n` +
          `• You: ${uEmoji}\n` +
          `• Bot: ${bEmoji}\n\n` +
          `${comment}`;

        const againKb = new InlineKeyboard().text('Play Again', 'suit:again');
        await ctx.editMessageText(resultText, {
          parse_mode: 'Markdown',
          reply_markup: againKb,
        });
        await ctx.answerCallbackQuery().catch(() => {});
      },
    },

    {
      prefix: 'quiz:',
      handler: async (ctx) => {
        const data = ctx.callbackQuery?.data ?? '';
        const parts = data.replace('quiz:', '').split(':');

        if (parts[0] === 'next') {
          const question = getRandomQuizQuestion();
          if (!question) {
            await ctx.answerCallbackQuery({ text: 'No questions available.' });
            return;
          }
          const letters = ['A', 'B', 'C', 'D'];
          const optionsList = question.options
            .map((opt, i) => `${letters[i]}. ${opt}`)
            .join('\n');
          const text = `*Trivia Quiz*\n\n*${question.question}*\n\n${optionsList}`;
          await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: buildQuizKeyboard(question),
          });
          await ctx.answerCallbackQuery().catch(() => {});
          return;
        }

        const qId = parseInt(parts[0], 10);
        const optIdx = parseInt(parts[1], 10);
        const check = checkQuizAnswer(qId, optIdx);

        if (!check) {
          await ctx.answerCallbackQuery({ text: 'Question not found.' });
          return;
        }

        const userId = ctx.from?.id;
        const chatId = ctx.chat?.id;
        if (userId && chatId) {
          recordGameResult({
            userId,
            chatId,
            result: check.correct ? 'win' : 'loss',
          });
        }

        let resultMsg = '';
        if (check.correct) {
          resultMsg =
            `*Your answer is CORRECT!* (+3 points)\n\n` +
            `*Question:* ${check.question.question}\n` +
            `*Answer:* ${check.correctText}\n\n` +
            `_${check.explanation}_`;
        } else {
          resultMsg =
            `*Your answer is WRONG!*\n\n` +
            `*Question:* ${check.question.question}\n` +
            `*Correct answer:* ${check.correctText}\n\n` +
            `_${check.explanation}_`;
        }

        const nextKb = new InlineKeyboard().text('Next Question', 'quiz:next');
        await ctx.editMessageText(resultMsg, {
          parse_mode: 'Markdown',
          reply_markup: nextKb,
        });
        await ctx.answerCallbackQuery().catch(() => {});
      },
    },
  ],
};

