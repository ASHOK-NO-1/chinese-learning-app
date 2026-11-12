# Xué 學 — Learn Chinese (from English)

A small app for learning Mandarin, built from my NFU (National Formosa University, Taiwan) class notebook.
It runs on **PC and phone** from one code base (HTML/CSS/JavaScript, no build tools) and can be
**installed like a normal app** (it's a PWA — Progressive Web App) and used offline.

## Feature 1 — Chinese Pronunciation

- **Load notebook words:** 449 words, phrases and sentences from the 46 notebook pages, in notebook order, grouped into the same 24 topics as `Chinese_Class_NFU_Notes.pdf`.
- **Table:** English · Pinyin (coloured by tone) · Characters · 🔊 speaker with a **Slow | Normal** toggle on every row. Each topic has a **Play all** button.
- **Add word:** type English + pinyin (tone marks *or* numbers: `ni3 hao3` → `nǐ hǎo`). Characters are optional.
  The speaker and speed toggle are added automatically.
- Search (English, pinyin with or without tones, or characters), filter by topic or type, edit or delete rows (with Undo).
- Export / Import a backup to move your own words between phone and PC.
- Words marked **check** were hard to read in the notebook. Hover over the badge for details and compare with the notebook page.

## Feature 2 — Pinyin Phonetics (for beginners)

A 5-step path. Every item can be tapped to hear it, at Slow or Normal speed. Zhuyin (ㄅㄆㄇ) can be shown or hidden.
1. **Tones:** the 4 tones plus neutral, with pitch drawings that animate while playing, a tone drill (ma, ba, yi, wu, shi, tang × 4 tones)
   and the tone changes in real speech (你好 ní hǎo, 不 bú, 一 yí / yì).
2. **Initials (聲母):** b p m f … grouped by mouth position. Each has the Taiwan teaching sound (bō pō mō fō), an English sound tip,
   aspirated "+ air" pairs and an example word.
3. **Finals (韻母):** simple vowels, vowel pairs, nasal endings, i-/u-/ü- sounds.
4. **Syllables:** pick an initial and tap any syllable in one tone or all four (ā á ǎ à). The full pinyin chart is also available.
   Only tones that really exist (with a common character) are offered.
5. **Spelling rules:** tone-mark placement, ü → u after j q x y, y/w, iu/ui/un, the buzzing "i", aspirated pairs.

Content lives in `js/data/phonetics.js`, and every example character was checked against its pinyin.

## Feature 3 — Chinese Speaking (speaking practice)

Press **Start**, speak Mandarin, press **Stop** (or press the Space bar). The result shows in three blocks:
**Characters**, **Pinyin** (tone-coloured) and **English**, plus a word-by-word breakdown from your notebook.
- **Say this** mode: the app picks a notebook word (or one of your own). You say it and get a result:
  ✓ heard correctly, **Close** (orange = right sound but wrong tone), or **heard something else**.
- On a PC your own recording is kept so you can replay it next to the correct voice (🔊 on the Characters block).
- **Add to My words** saves what you said to the Chinese Pronunciation list (and cloud sync).
- **Recent:** the last 20 things you said, on this device.

How it works: speech → text uses the browser's built-in recogniser (Chrome/Edge on PC and Android, Safari on iPhone; needs internet).
Characters → pinyin uses `data/hanzi-pinyin.json`, which handles words with special readings (銀行 yínháng).
Words from your notebook keep the notebook's checked pinyin. English comes, in order, from your notebook, then the browser's
private on-device translator (newer Chrome), then the free MyMemory service.
Recognition guesses whole words, so it's a good check but not a perfect tone judge.

## Feature 4 — Flashcards
Cards from the notebook (and your own words). There are three directions: 漢字 → English, English → 漢字, and Listen → meaning.
After flipping, rate the card **Again / Hard / Good / Easy**. Spaced repetition (Leitner boxes, intervals of 1–90 days) brings hard
cards back sooner and easy ones later, with 15 new cards per session. Keyboard: Space, 1–4, S. Progress is saved on the device.

## Feature 5 — Tone Quiz
Rounds of 10, either single syllables (only syllables where all four tones are common sounds) or two-syllable notebook words.
Words whose tones change in speech (3+3, 一, 不) or that have a neutral tone are left out, so the answer matches what you hear.
You get a score, a streak, your best score, and a review of mistakes.

## Feature 6 — Character Writing
Stroke-order animation, then writing with finger or mouse, either tracing the outline or from memory. Every stroke is checked,
with a hint after 3 misses. Characters are listed by topic (all 336 notebook characters have stroke data), or you can type any character.
Uses [Hanzi Writer](https://hanziwriter.org) (MIT) and hanzi-writer-data from jsDelivr, cached for offline use after the first time.

## Feature 7 — My Notebook
The 46 cleaned notebook pages (`notebook/pages`) with a topic list, swipe or arrow keys, tap to zoom, thumbnails, the words on each page
(tap to hear them) and **Download PDF**. In this public copy, the two email addresses (pages 27 and 39) and the teacher's name are hidden.

Navigation: one page at a time. Choosing a menu item replaces the current tab, and the app reopens on your last page.

### How pronunciation works (and why the tones are right)
The app speaks the **Chinese characters** with the device's built-in Mandarin voice (Web Speech API), not the pinyin letters.
A Mandarin voice reading 你好 automatically applies the correct tones *and* tone changes (nǐ hǎo is spoken ní hǎo).
- It prefers a **Taiwan Mandarin** voice (zh-TW), then Mainland (zh-CN). Cantonese/Hong Kong voices are skipped.
- Words you add without characters are matched against a 30,000-word dictionary (`data/pinyin-dict.json`);
  if there's no match, each syllable is spoken with a common character that has exactly that sound and tone (`js/data/syllables.js`).
- Readings follow **Taiwan Mandarin (國語)**, matching your class and the Taiwan voice: e.g. 星期 xīngqí, 時候 shíhòu, 和 hàn.

**Voices:** Chrome on Windows/Android includes Google's Mandarin voices. Edge has very good free "Natural" voices.
Otherwise add one: Windows → Settings → Time & language → Speech → Add voices → *Chinese (Traditional, Taiwan)*.
Settings → Voice in the app lists every Mandarin voice on the device.

## Cloud sync (your words on every device)

Sign in with Google in **Settings → Cloud sync**. Your own words, edits and hidden words then follow you to every
phone and PC where you sign in. Each device still keeps its own copy, so the app works offline and catches up
when you're back online. When two devices change the same word, the newest change wins. Deleted words stay deleted.

It uses **Firebase** (Google), free "Spark" plan: no credit card, it can't charge you, and the limits
(1 GB, 50,000 reads / 20,000 writes per day) are far beyond one person's use. All of your data is one document,
`users/{your user id}`. The rules in `firestore.rules` let only you read and write it.

### One-time Firebase setup (about 5 minutes)
1. <https://console.firebase.google.com> → **Create a project** → name `xue-learn-chinese` → turn **Google Analytics off** → Create.
2. **Build → Authentication → Get started → Google** → Enable → choose your support email → Save.
3. **Authentication → Settings → Authorized domains → Add domain** → `ashok-no-1.github.io` (`localhost` is already there).
4. **Build → Firestore Database → Create database** → location **asia-east1 (Taiwan)** → **Start in production mode** → Create.
5. **Firestore → Rules** → replace everything with the contents of `firestore.rules` → **Publish**.
6. **⚙ Project settings → General → Your apps → `</>` (Web)** → nickname `Xué web` → Register app → copy the `firebaseConfig = { … }` values
   into `js/firebase-config.js`, then commit and push.

The `firebaseConfig` values are not secret. They identify the project; Google sign-in plus the rules protect the data.

## Run it on your PC

```bash
cd chinese-learning-app
python -m http.server 8642
```
Open <http://localhost:8642> in Chrome or Edge. Click the **Install** icon in the address bar to get a desktop app.
(Opening `index.html` directly as a file won't work — browsers block modules and offline mode on `file://`.)

## Put it on your phone
The phone needs to reach the app over **https**. The free and easy way:
1. Push this folder to a GitHub repository → Settings → Pages → deploy from the main branch
   (or drag the folder onto <https://app.netlify.com/drop>).
2. Open the https link in Chrome on Android → ⋮ → **Add to Home screen / Install app**.
It then opens full-screen like any app and works offline.

## Adding the next page (feature)
1. Create `js/pages/<name>.js` exporting `mount(container, ctx)` (and optionally `unmount()`).
2. Add one entry to `PAGES` in `js/pages/index.js` (or replace a `soon: true` placeholder).
3. Add the file to the `SHELL` list in `sw.js` so it works offline, and bump `CACHE` (`xue-v2`, …).

The menu item, tab and offline caching all come from that.

## Play Store later
Wrap this PWA as an Android app with **Bubblewrap / Trusted Web Activity** (Google's official route for PWAs)
or **Capacitor**. Both reuse this exact code. You need the https site, a Play Console account (one-time US$25 fee) and the app icon (in `icons/`).

## Files
```
index.html               app shell (side menu + tabs)
css/app.css              design: light/dark themes, phone layout
js/app.js                menu, tabs, theme, service-worker registration
js/pages/                one file per page (home, pronunciation, settings) + index.js registry
js/speech.js             Mandarin voice selection + speak (slow/normal)
js/pinyin.js             tone numbers → marks, syllable split, tone colours
js/lookup.js             pinyin → characters (for words added without characters)
js/store.js              saved settings and words (localStorage), export/import, sync merge rules
js/sync.js               cloud sync: Google sign-in + Firestore, live updates between devices
js/firebase-config.js    your Firebase project settings (null = sync switched off)
firestore.rules          database security rules (paste into Firebase console)
data/notebook-words.json the 449 notebook entries (English, pinyin, characters, topic, page)
data/pinyin-dict.json    ~30k common words, pinyin → Traditional characters
js/data/syllables.js     syllable → sound-alike character (fallback)
js/data/phonetics.js     Pinyin page content: tones, initials, finals, rules, syllable chart
js/data/rare-syllables.js tones whose only character is very rare (hidden on the Pinyin page)
js/pages/pinyin.js       Pinyin Phonetics page
js/pages/listener.js     Chinese Speaking page (speech recognition, Say this practice)
js/zhpinyin.js           characters → pinyin (data/hanzi-pinyin.json)
js/translate.js          Chinese → English (notebook, on-device translator, MyMemory)
css/listener.css         Chinese Speaking styles
js/pages/flashcards.js   Flashcards (spaced repetition)
js/pages/quiz.js         Tone Quiz
js/pages/writing.js      Character Writing (Hanzi Writer)
js/pages/notebook.js     My Notebook viewer
css/features.css         styles for the four pages above
data/notebook-pages.json page list for the viewer; notebook/ = page images, thumbnails, PDF (emails hidden)
css/pinyin.css           Pinyin Phonetics styles
sw.js, manifest.webmanifest  install + offline
```
Data sources for the dictionaries: jieba word frequencies and pypinyin readings (MIT licence), OpenCC conversion (Apache-2.0).
