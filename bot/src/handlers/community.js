const config = require('../config');

module.exports = function (bot) {
  bot.command('rules', async (ctx) => {
    const lang = ctx.lang;
    const texts = {
      en: `<b>Group Rules</b>

1. Be respectful to all members
2. Stay on topic: AI, programming, and related subjects
3. No spam or self-promotion without permission
4. Questions are welcome at any level
5. Share resources and help others learn
6. Use English or Ukrainian`,
      uk: `<b>Правила групи</b>

1. Поважайте всіх учасників
2. Дотримуйтесь теми: ШІ, програмування та суміжні теми
3. Без спаму та самореклами без дозволу
4. Запитання вітаються на будь-якому рівні
5. Діліться ресурсами та допомагайте іншим навчатися
6. Спілкуйтесь англійською або українською`,
    };
    await ctx.reply(texts[lang] || texts.en, { parse_mode: 'HTML' });
  });

  bot.command('links', async (ctx) => {
    const lang = ctx.lang;
    const texts = {
      en: `<b>Useful Links</b>

📱 <a href="${config.COURSE_BASE_URL}/twa/index.html">Course Mini App</a>
🇬🇧 <a href="${config.COURSE_BASE_URL}/en/index.html">Course (English)</a>
🇺🇦 <a href="${config.COURSE_BASE_URL}/uk/index.html">Course (Ukrainian)</a>`,
      uk: `<b>Корисні посилання</b>

📱 <a href="${config.COURSE_BASE_URL}/twa/index.html">Міні-додаток курсу</a>
🇬🇧 <a href="${config.COURSE_BASE_URL}/en/index.html">Курс (англійською)</a>
🇺🇦 <a href="${config.COURSE_BASE_URL}/uk/index.html">Курс (українською)</a>`,
    };
    await ctx.reply(texts[lang] || texts.en, { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
  });

  bot.command('faq', async (ctx) => {
    const lang = ctx.lang;
    const texts = {
      en: `<b>FAQ</b>

<b>Q: What is this course?</b>
A: A bilingual (EN/UK) AI & Programming course with 42 topics across 5 progressive levels.

<b>Q: How do I access the course?</b>
A: Use /course to browse topics, or open the Mini App via /links.

<b>Q: Can I take a quiz?</b>
A: Yes! Use /quiz for random questions from course material.

<b>Q: How do I switch language?</b>
A: Use /lang to switch between English and Ukrainian.

<b>Q: Where do I search for specific content?</b>
A: Use /search &lt;keyword&gt; or /glossary &lt;term&gt;.`,
      uk: `<b>Часті запитання</b>

<b>П: Що це за курс?</b>
В: Двомовний (EN/UK) курс з ШІ та програмування — 42 теми на 5 рівнях.

<b>П: Як отримати доступ до курсу?</b>
В: Використовуйте /course для перегляду тем або відкрийте міні-додаток через /links.

<b>П: Чи можна пройти квіз?</b>
В: Так! Використовуйте /quiz для випадкових запитань з матеріалу курсу.

<b>П: Як змінити мову?</b>
В: Використовуйте /lang для перемикання між англійською та українською.

<b>П: Де шукати конкретний контент?</b>
В: Використовуйте /search &lt;ключове слово&gt; або /glossary &lt;термін&gt;.`,
    };
    await ctx.reply(texts[lang] || texts.en, { parse_mode: 'HTML' });
  });
};
