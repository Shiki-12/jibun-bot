import { tsundere } from './tsundere.js';
import { manis } from './manis.js';
import { ceria } from './ceria.js';
import { sarkas } from './sarkas.js';
import { jiang_cheng } from './jiang_cheng.js';
import { getDb } from '../core/db.js';
import { GLOBAL_SAFETY_RULES } from '../core/actions.js';

const all = {
  tsundere,
  manis,
  ceria,
  sarkas,
  jiang_cheng,
};

export const PERSONALITY_METADATA = {
  tsundere: { id: 'tsundere', name: 'Raka', category: 'default', source: null },
  manis: { id: 'manis', name: 'Rio', category: 'default', source: null },
  ceria: { id: 'ceria', name: 'Nando', category: 'default', source: null },
  sarkas: { id: 'sarkas', name: 'Kael', category: 'default', source: null },
  jiang_cheng: {
    id: 'jiang_cheng',
    name: 'Jiang Cheng',
    category: 'exclusive',
    source: 'Mo Dao Zu Shi',
    subtitle: 'Leader of the Yunmeng Jiang Clan',
  },
  custom: { id: 'custom', name: 'Custom Persona', category: 'custom', source: null },
};

export function listPersonalitiesMetadata() {
  return listPersonalities().map(
    (id) => PERSONALITY_METADATA[id] || { id, name: id, category: 'default', source: null },
  );
}

export function buildCustomPersonality({ name = 'Custom', description = '' } = {}) {
  const safeDesc = (description || '').trim().slice(0, 800);
  return {
    id: 'custom',
    name,
    language: 'en',
    greeting: `Hello! "${name}" is ready to chat with you! (^_^)`,
    errorMessage: 'A technical issue occurred on the system.',
    strings: {
      helpHeader: 'Available commands:',
      helpFooter: 'Type any command above to use it.',
      forgetSuccess: 'Conversation history has been cleared.',
      settingsHeader: '*Bot Settings:*',
      settingsSaved: 'Settings saved successfully.',
      tzInvalid: 'Invalid timezone format.',
      tzSuccess: 'Your timezone is set to {tz}.',
      rateLimited: 'Wait a moment before sending another message.',
      inputTooLong: 'Message too long. Please summarize it.',
      unauthorized: 'Access denied.',
      queueFull: 'Queue is full, please wait.',
      reminderSet: 'Reminder recorded for *{time}*:\n"{text}"',
      reminderFired: 'Time has arrived: *{text}*',
      reminderCancelled: 'Reminder #{id} has been cancelled.',
      todoAdded: 'To-do recorded: *"{text}"*',
      todoDone: 'To-do *"{text}"* completed.',
      todoDeleted: 'To-do #{num} deleted.',
      todoEmpty: 'No to-dos yet.',
      todoNotFound: 'To-do not found.',
      noteSaved: 'Note saved (*#{id}*).',
      noteDeleted: 'Note #{id} deleted.',
      noteNotFound: 'Note #{id} not found.',
      scheduleSet: '{type} message schedule set for *{time}* ({tz}).',
      scheduleOff: '{type} message schedule turned off.',
      morningGreetings: ['Good morning! Wishing you a wonderful day ahead.'],
      morningNoReminders: 'No reminders for today.',
      morningRemindersHeader: "[Today's Schedule]",
      morningTodosHeader: '[Pending To-Dos]',
      morningAllTodosDone: 'All to-dos are finished.',
      nightGreetings: ['Good night! Time to rest.'],
      nightTodosCompleted: 'You completed {count} to-dos today.',
      nightNoTodosCompleted: 'No to-dos completed today.',
      nightPendingTodos: 'There are still {count} to-dos remaining.',
      nightCheckin: 'How was your day? Make sure to get plenty of rest.',
      memoryHeader: 'Facts I remember about you:',
      memoryEmpty: 'No facts recorded yet.',
      factDeleted: 'Fact #{id} deleted.',
      factsCleared: 'All remembered facts cleared.',
      forgetWithFactsPrompt: 'Chat history cleared. Delete all remembered facts as well?',
      stickersEmpty: 'No stickers saved yet.',
      stickerModeActive: 'Sticker addition mode active for mood "{mood}". Send a sticker or type /cancelsticker.',
      stickerModeCancelled: 'Sticker addition mode cancelled.',
      stickerSaved: 'Sticker for mood "{mood}" saved (ID: #{id}, emoji: {emoji}).',
      proactiveEnabled: 'Proactive chat enabled.',
      proactiveDisabled: 'Proactive chat disabled.',
      quietHoursSet: 'Quiet hours set from *{start}* to *{end}*.',
      quietHoursInvalid: 'Invalid quiet hours format. Use: /quiet 22:00-07:00',
      proactiveGreetings: {
        withTodo: 'Hello! Don\'t forget your to-do "{todo}" is still pending.',
        withFact: 'Hello! How are you doing today? Still busy with {fact}?',
        general: [
          'Hello! It has been a while since you messaged. Hope you are having a great day.',
        ],
      },
      suitPrompt: 'Let\'s play rock-paper-scissors! Choose one:',
      suitWin: 'Congratulations, you won! (+3 points)',
      suitLoss: 'Too bad, you lost. Try again! (+0 points)',
      suitDraw: 'It\'s a draw! (+1 point)',
      tebakStart: 'Guess the secret number between 1 and 100 with: /tebak <number>',
      tebakWin: 'Congratulations! Your guess was right on *{target}*! (+3 points)',
      tebakGameOver: 'Attempts exhausted! The secret number was *{target}*.',
      tebakTooHigh: 'Too high! {attempts} attempts left.',
      tebakTooLow: 'Too low! {attempts} attempts left.',
      truth: [
        'What is your biggest personal goal to achieve this year?',
        'Who inspires you the most?',
      ],
      dare: [
        'Write down one small task you must accomplish today!',
        'Drink a glass of water and stretch!',
      ],
      pickChoice: 'My choice is: *{choice}*.',
      moodFeedback: {
        low: 'Wishing you a much better day tomorrow.',
        neutral: 'Mood entry saved successfully.',
        high: 'Wonderful to hear your day went well!',
      },
      visionUnsupported: 'Image format or current model does not support image reading.',
      visionTooLarge: 'Image size exceeds maximum limit (20 MB).',
      citySaved: 'Home city set to *{city}*.',
      cityNotFound: 'City "{city}" was not found.',
      weatherError: 'Failed to retrieve weather data.',
      prayerCityNotFound: 'City "{city}" was not found.',
      prayerNoCity: 'You haven\'t set a home city yet. Configure your city first.',
      prayerError: 'Failed to retrieve prayer schedule.',
      adzanOn: 'Prayer notification enabled for *{city}*.',
      adzanOff: 'Prayer notification disabled.',
      adzanNoCity: 'Home city not set.',
      timerSet: 'Timer for *{duration}* started ("{label}").',
      timerListEmpty: 'No active timers.',
      timerListHeader: '[Active Timers]',
      timerCancelled: 'Timer #{id} cancelled.',
      timerNotFound: 'Timer #{id} not found.',
      pomodoroStarted: '[Pomodoro Session Started]\n• Cycle 1/{cycles}: Focus for *{work} min* (until: {time})\n• Break interval: *{break} min*',
      pomodoroStopped: 'Pomodoro session stopped.',
      pomodoroNoActive: 'No active Pomodoro session.',
      pomodoroStatus: '[Pomodoro Status]\n• Phase: *{phase}*\n• Cycle: *{cycle}/{totalCycles}*\n• Remaining time: *{remaining}*',
      habitAdded: 'New habit recorded: *"{name}"*{remind}.',
      habitDeleted: 'Habit #{id} deleted.',
      habitNotFound: 'Habit #{id} not found.',
      habitEmpty: 'No habits recorded yet.',
      habitHeader: '[Habit Tracker]',
      habitDone: 'To-do *"{name}"* completed today. Streak: *{streak} days*!',
      habitSkipped: 'Habit *"{name}"* skipped today.',
      habitStreakCelebrate: '\nYour streak reached {streak} consecutive days!',
      expenseRecorded: 'Expense recorded: *{amount}* for *{category}* ("{note}").',
      expenseDeleted: 'Expense record #{id} deleted.',
      expenseNotFound: 'Expense record #{id} not found.',
      expenseEmpty: 'No expense records found for this period.',
      expenseRekapHeader: '[Expense Summary ({period})]',
      expenseCategoryUpdated: 'Expense category #{id} updated to *{category}*.',
      translateIntro: (lang) => `Here is the translation into ${lang}:`,
      translateUrlBlocked: 'URL links are not opened automatically for security. Copy and paste directly.',
      summarizeIntro: 'Here is the summary of key points:',
      summarizeUrlBlocked: 'URL links are not fetched automatically for security. Copy and paste directly.',
      groupWelcome: 'Welcome to {group}, {name}!',
      groupSummaryIntro: 'Summary of the last {count} messages in this group:',
      chattyEnabled: 'Chatty mode enabled.',
      chattyDisabled: 'Chatty mode disabled.',
      welcomeEnabled: 'New member greetings enabled.',
      welcomeDisabled: 'New member greetings disabled.',
      notGroupAdmin: 'Only group administrators can configure this setting.',
      notGroupChat: 'This command is specifically for group chats.',
      unauthorizedAdmin: 'Access denied. This command is restricted to bot administrators.',
      exportDone: 'Here is the complete export of your personal data stored in the bot (JSON format).',
      deleteWarning:
        '[Permanent Data Deletion Warning]\n\nThis action will delete ALL your personal data from the bot:\n• Notes, to-dos, and reminders\n• Expense records & mood journal\n• Habits, AI memories, affinity points, and game scores\n• Account profile and preferences\n\n_Deleted data CANNOT be recovered. Are you sure?_',
      deleteSuccess: '[Completed] All your personal data has been permanently deleted.',
      deleteCancelled: '[Cancelled] Data deletion cancelled. Your data remains safe.',
      voiceEnabled: 'Voice replies (TTS) enabled.',
      voiceDisabled: 'Voice replies (TTS) disabled.',
      voiceTooLong: 'Voice note duration is too long! Maximum 60 seconds.',
      voiceSttUnsupported: 'Voice transcription is currently unsupported by the API gateway. Please send a text message.',
      voiceHeard: 'What I heard: *"{text}"*',
      affinityStatus: [
        'We have just met.',
        'Getting accustomed to chatting often.',
        'Your presence is wonderful.',
        'You are a valued person.',
        'Best friend who is always there.',
      ],
    },
    systemPrompt: `You are an AI assistant with a custom persona specified by the user:

## Character Description
${safeDesc || 'A friendly, polite, and helpful assistant.'}

## STRICT LANGUAGE POLICY — ENGLISH ONLY (MANDATORY)
- Always reply in natural, fluent English.
- Spoken dialogue, stage directions in asterisks (*...*), thoughts, and narration must be 100% in English.
- No Indonesian stage directions or narration. Default to natural dialogue with minimal stage directions.

## Response Guidelines
- Casual, natural replies, 1-3 sentences unless the user requests in-depth technical explanations.
- Zero Unicode Emojis: Never use Unicode emojis. Kaomoji at most once per reply and only when fitting.
- Do not use excessive markdown formatting.

## GIF
Occasionally when fitting, append one tag at the very end of your reply:
[GIF: anime boy keywords in English]

${GLOBAL_SAFETY_RULES}`,
  };
}

export function getCustomPersona(chatId) {
  try {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM custom_personas WHERE chat_id = ?')
      .get(chatId);
    if (row) {
      return buildCustomPersonality({
        name: row.name,
        description: row.description,
      });
    }
  } catch {}
  return null;
}

export function upsertCustomPersona({ chatId, userId, description, name = 'Custom' }) {
  const safeDesc = (description || '').trim().slice(0, 800);
  const db = getDb();
  db.prepare(
    `INSERT INTO custom_personas (chat_id, user_id, name, description, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(chat_id) DO UPDATE SET
       description = excluded.description,
       name = excluded.name,
       user_id = excluded.user_id`,
  ).run(chatId, userId, name, safeDesc, Date.now());

  return buildCustomPersonality({ name, description: safeDesc });
}

export function getPersonality(id = 'tsundere', ctx = null) {
  if (id === 'custom') {
    const chatId = ctx?.chat?.id ?? ctx?.from?.id;
    if (chatId) {
      const custom = getCustomPersona(chatId);
      if (custom) return custom;
    }
    return buildCustomPersonality();
  }

  const persona = all[id];
  if (!persona) {
    throw new Error(
      `Personality "${id}" tidak ditemukan. Pilihan: ${Object.keys(all).join(', ')}`,
    );
  }
  return persona;
}

export const listPersonalities = () => [...Object.keys(all), 'custom'];
