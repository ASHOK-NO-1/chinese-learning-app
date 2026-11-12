// Pinyin phonetics content for beginners: tones, initials (聲母), finals (韻母), spelling rules.
// Every playable item has `zh` (characters the voice reads) and `py` (what it sounds like).
import { SYLLABLE_CHARS } from "./syllables.js";
import { RARE_SYLLABLES } from "./rare-syllables.js";
import { numbersToMarks, stripTones, toneOf } from "../pinyin.js";

// ---------------------------------------------------------------- tones
// pitch: Chao tone letters on a 1 (low) – 5 (high) scale
export const TONES = [
  { n: 1, name: "1st tone", short: "high & level", mark: "ˉ", pitch: [5, 5], ex: { py: "mā", zh: "媽", en: "mother" },
    tip: "Start high and stay high and steady — like singing one long note." },
  { n: 2, name: "2nd tone", short: "rising", mark: "ˊ", pitch: [3, 5], ex: { py: "má", zh: "麻", en: "hemp" },
    tip: "Go from middle to high — like asking “What?” in surprise." },
  { n: 3, name: "3rd tone", short: "low dip", mark: "ˇ", pitch: [2, 1, 4], ex: { py: "mǎ", zh: "馬", en: "horse" },
    tip: "Dip down low, then come back up. In normal speech it often just stays low." },
  { n: 4, name: "4th tone", short: "falling", mark: "ˋ", pitch: [5, 1], ex: { py: "mà", zh: "罵", en: "to scold" },
    tip: "Drop sharply from high to low — like a firm “No!”." },
  { n: 5, name: "Neutral tone", short: "light & short", mark: "·", pitch: [3], ex: { py: "ma", zh: "嗎", en: "question particle" },
    tip: "Short and light, no mark. Its pitch depends on the syllable before it." },
];

// tone drill: same syllable in all four tones (characters picked for clear, common readings)
export const DRILL = [
  { s: "ma", en: ["mother", "hemp", "horse", "scold"], zh: ["媽", "麻", "馬", "罵"] },
  { s: "ba", en: ["eight", "pull out", "to hold", "dad"], zh: ["八", "拔", "把", "爸"] },
  { s: "yi", en: ["clothes", "aunt", "chair", "meaning"], zh: ["衣", "姨", "椅", "意"] },
  { s: "wu", en: ["room", "nothing", "five", "fog"], zh: ["屋", "無", "五", "霧"] },
  { s: "shi", en: ["poem", "ten", "history", "to be"], zh: ["詩", "十", "史", "是"] },
  { s: "tang", en: ["soup", "sugar", "lie down", "hot"], zh: ["湯", "糖", "躺", "燙"] },
];

// tone changes in real speech
export const SANDHI = [
  { title: "Two 3rd tones in a row", rule: "The first one becomes a 2nd tone.",
    ex: [{ zh: "你好", written: "nǐ hǎo", said: "ní hǎo", en: "hello" }, { zh: "很好", written: "hěn hǎo", said: "hén hǎo", en: "very good" }] },
  { title: "不 bù before a 4th tone", rule: "不 becomes bú.",
    ex: [{ zh: "不是", written: "bù shì", said: "bú shì", en: "is not" }, { zh: "不要", written: "bù yào", said: "bú yào", en: "don't want" }] },
  { title: "一 yī before a 4th tone", rule: "一 becomes yí.",
    ex: [{ zh: "一個", written: "yī ge", said: "yí ge", en: "one (of something)" }, { zh: "一樣", written: "yī yàng", said: "yí yàng", en: "the same" }] },
  { title: "一 yī before tones 1, 2, 3", rule: "一 becomes yì.",
    ex: [{ zh: "一天", written: "yī tiān", said: "yì tiān", en: "one day" }, { zh: "一年", written: "yī nián", said: "yì nián", en: "one year" }] },
];

// ---------------------------------------------------------------- initials (聲母)
// say: how teachers in Taiwan name the sound (ㄅ bo, ㄆ po, ㄇ mo, ㄈ fo …)
export const INITIAL_GROUPS = [
  { title: "Lips", zh: "唇音", desc: "Made with your lips.", items: [
    { i: "b", zy: "ㄅ", say: { py: "bō", zh: "波" }, tip: "Like p in “spy” — no puff of air.", pair: "p", ex: { py: "bàba", zh: "爸爸", en: "dad" } },
    { i: "p", zy: "ㄆ", say: { py: "pō", zh: "坡" }, tip: "Like p in “pie” — with a strong puff of air.", air: true, pair: "b", ex: { py: "péngyou", zh: "朋友", en: "friend" } },
    { i: "m", zy: "ㄇ", say: { py: "mō", zh: "摸" }, tip: "Like m in “more”.", ex: { py: "māma", zh: "媽媽", en: "mom" } },
    { i: "f", zy: "ㄈ", say: { py: "fó", zh: "佛" }, tip: "Like f in “four” — top teeth on the lower lip.", ex: { py: "fàn", zh: "飯", en: "rice; meal" } },
  ] },
  { title: "Tongue tip", zh: "舌尖音", desc: "Tongue tip touches behind your top teeth.", items: [
    { i: "d", zy: "ㄉ", say: { py: "dé", zh: "德" }, tip: "Like t in “stop” — no puff of air.", pair: "t", ex: { py: "dìdi", zh: "弟弟", en: "younger brother" } },
    { i: "t", zy: "ㄊ", say: { py: "tè", zh: "特" }, tip: "Like t in “top” — with a puff of air.", air: true, pair: "d", ex: { py: "tā", zh: "他", en: "he" } },
    { i: "n", zy: "ㄋ", say: { py: "nè", zh: "訥" }, tip: "Like n in “no”.", ex: { py: "nǐ", zh: "你", en: "you" } },
    { i: "l", zy: "ㄌ", say: { py: "lè", zh: "勒" }, tip: "Like l in “love”.", ex: { py: "lǎoshī", zh: "老師", en: "teacher" } },
  ] },
  { title: "Back of the tongue", zh: "舌根音", desc: "Back of the tongue rises to the soft palate.", items: [
    { i: "g", zy: "ㄍ", say: { py: "gē", zh: "哥" }, tip: "Like k in “skip” — no puff of air.", pair: "k", ex: { py: "gēge", zh: "哥哥", en: "older brother" } },
    { i: "k", zy: "ㄎ", say: { py: "kē", zh: "科" }, tip: "Like k in “kite” — with a puff of air.", air: true, pair: "g", ex: { py: "kāfēi", zh: "咖啡", en: "coffee" } },
    { i: "h", zy: "ㄏ", say: { py: "hē", zh: "喝" }, tip: "Like h in “hot”, but rougher, from the throat (like “loch”).", ex: { py: "hǎo", zh: "好", en: "good" } },
  ] },
  { title: "Flat tongue, smile", zh: "舌面音", desc: "Tongue tip down behind the lower teeth, lips spread. Only with i or ü sounds.", items: [
    { i: "j", zy: "ㄐ", say: { py: "jī", zh: "雞" }, tip: "Like j in “jeep”, with a smile.", pair: "q", ex: { py: "jiějie", zh: "姐姐", en: "older sister" } },
    { i: "q", zy: "ㄑ", say: { py: "qī", zh: "七" }, tip: "Like ch in “cheap” — with a puff of air.", air: true, pair: "j", ex: { py: "qǐng", zh: "請", en: "please" } },
    { i: "x", zy: "ㄒ", say: { py: "xī", zh: "西" }, tip: "Like sh in “sheep”, smiling wide.", ex: { py: "xièxie", zh: "謝謝", en: "thank you" } },
  ] },
  { title: "Curled tongue", zh: "翹舌音", desc: "Curl the tongue tip back toward the roof of the mouth.", items: [
    { i: "zh", zy: "ㄓ", say: { py: "zhī", zh: "知" }, tip: "Like j in “judge”, tongue curled back.", pair: "ch", ex: { py: "Zhōngguó", zh: "中國", en: "China" } },
    { i: "ch", zy: "ㄔ", say: { py: "chī", zh: "吃" }, tip: "Like ch in “church”, curled — with a puff of air.", air: true, pair: "zh", ex: { py: "chá", zh: "茶", en: "tea" } },
    { i: "sh", zy: "ㄕ", say: { py: "shī", zh: "詩" }, tip: "Like sh in “shirt”, tongue curled back.", ex: { py: "shì", zh: "是", en: "to be" } },
    { i: "r", zy: "ㄖ", say: { py: "rì", zh: "日" }, tip: "Between r in “run” and s in “pleasure”, tongue curled.", ex: { py: "rén", zh: "人", en: "person" } },
  ] },
  { title: "Flat tongue tip", zh: "平舌音", desc: "Tongue tip flat behind the top teeth.", items: [
    { i: "z", zy: "ㄗ", say: { py: "zī", zh: "資" }, tip: "Like ds in “kids”.", pair: "c", ex: { py: "zǎoshàng", zh: "早上", en: "morning" } },
    { i: "c", zy: "ㄘ", say: { py: "cí", zh: "詞" }, tip: "Like ts in “cats” — with a puff of air.", air: true, pair: "z", ex: { py: "cài", zh: "菜", en: "dish; vegetables" } },
    { i: "s", zy: "ㄙ", say: { py: "sī", zh: "思" }, tip: "Like s in “see”.", ex: { py: "sān", zh: "三", en: "three" } },
  ] },
  { title: "Half-vowels", zh: "", desc: "Written forms of i and u at the start of a syllable.", items: [
    { i: "y", zy: "ㄧ", say: { py: "yī", zh: "衣" }, tip: "Like y in “yes”. Written for i or ü at the start.", ex: { py: "yǒu", zh: "有", en: "to have" } },
    { i: "w", zy: "ㄨ", say: { py: "wū", zh: "屋" }, tip: "Like w in “way”. Written for u at the start.", ex: { py: "wǒ", zh: "我", en: "I; me" } },
  ] },
];

// ---------------------------------------------------------------- finals (韻母)
export const FINAL_GROUPS = [
  { title: "Simple vowels", zh: "單韻母", desc: "Start here: six basic vowel sounds.", items: [
    { f: "a", zy: "ㄚ", say: { py: "ā", zh: "啊" }, tip: "a in “father”, mouth wide open.", ex: { py: "bàba", zh: "爸爸", en: "dad" } },
    { f: "o", zy: "ㄛ", say: { py: "ō", zh: "喔" }, tip: "aw in “saw”, lips rounded.", ex: { py: "wǒ", zh: "我", en: "I; me" } },
    { f: "e", zy: "ㄜ", say: { py: "é", zh: "鵝" }, tip: "“uh” from the back of the throat, lips relaxed (not like English e).", ex: { py: "hē", zh: "喝", en: "to drink" } },
    { f: "i", zy: "ㄧ", say: { py: "yī", zh: "衣" }, tip: "ee in “see”, lips spread. (After zh ch sh r z c s it's a buzzing sound instead.)", ex: { py: "nǐ", zh: "你", en: "you" } },
    { f: "u", zy: "ㄨ", say: { py: "wū", zh: "屋" }, tip: "oo in “food”, lips tightly rounded.", ex: { py: "shū", zh: "書", en: "book" } },
    { f: "ü", zy: "ㄩ", say: { py: "yú", zh: "魚" }, tip: "Say “ee”, then round your lips without moving the tongue (like German ü).", ex: { py: "nǚ", zh: "女", en: "woman" } },
  ] },
  { title: "Vowel pairs", zh: "複韻母", desc: "Two vowels gliding together.", items: [
    { f: "ai", zy: "ㄞ", say: { py: "ài", zh: "愛" }, tip: "Like “eye”.", ex: { py: "lái", zh: "來", en: "to come" } },
    { f: "ei", zy: "ㄟ", say: { py: "hēi", zh: "黑" }, tip: "ay in “say”.", ex: { py: "bēi", zh: "杯", en: "cup" } },
    { f: "ao", zy: "ㄠ", say: { py: "āo", zh: "凹" }, tip: "ow in “cow”.", ex: { py: "hǎo", zh: "好", en: "good" } },
    { f: "ou", zy: "ㄡ", say: { py: "ōu", zh: "歐" }, tip: "oh in “go”.", ex: { py: "dōu", zh: "都", en: "all" } },
    { f: "er", zy: "ㄦ", say: { py: "èr", zh: "二" }, tip: "“are” with the tongue curled back.", ex: { py: "èr", zh: "二", en: "two" } },
  ] },
  { title: "Nasal endings", zh: "鼻韻母", desc: "-n ends at the teeth, -ng at the back of the mouth.", items: [
    { f: "an", zy: "ㄢ", say: { py: "ān", zh: "安" }, tip: "an in “fan”, but with a more open a.", ex: { py: "sān", zh: "三", en: "three" } },
    { f: "en", zy: "ㄣ", say: { py: "ēn", zh: "恩" }, tip: "en in “taken”.", ex: { py: "hěn", zh: "很", en: "very" } },
    { f: "ang", zy: "ㄤ", say: { py: "áng", zh: "昂" }, tip: "“ahng” — a in father + ng.", ex: { py: "tāng", zh: "湯", en: "soup" } },
    { f: "eng", zy: "ㄥ", say: { py: "fēng", zh: "風" }, tip: "ung in “lung”.", ex: { py: "péngyou", zh: "朋友", en: "friend" } },
    { f: "ong", zy: "ㄨㄥ", say: { py: "dōng", zh: "東" }, tip: "“oong”, lips rounded. Never alone — always after an initial.", ex: { py: "Zhōngguó", zh: "中國", en: "China" } },
  ] },
  { title: "i- sounds", zh: "", desc: "Start with a quick “ee”. Alone they're written with y.", items: [
    { f: "ia", spell: "ya", zy: "ㄧㄚ", say: { py: "yā", zh: "鴨" }, tip: "ya in “yard”.", ex: { py: "jiā", zh: "家", en: "home" } },
    { f: "ie", spell: "ye", zy: "ㄧㄝ", say: { py: "yē", zh: "椰" }, tip: "ye in “yes”.", ex: { py: "xièxie", zh: "謝謝", en: "thank you" } },
    { f: "iao", spell: "yao", zy: "ㄧㄠ", say: { py: "yāo", zh: "腰" }, tip: "“yow”.", ex: { py: "piàoliang", zh: "漂亮", en: "pretty" } },
    { f: "iu", full: "iou", spell: "you", zy: "ㄧㄡ", say: { py: "yōu", zh: "優" }, tip: "“yo” as in “yoga”. Written iu after an initial (liù).", ex: { py: "liù", zh: "六", en: "six" } },
    { f: "ian", spell: "yan", zy: "ㄧㄢ", say: { py: "yān", zh: "煙" }, tip: "Sounds like “yen”, not “yan”!", ex: { py: "diànyǐng", zh: "電影", en: "movie" } },
    { f: "in", spell: "yin", zy: "ㄧㄣ", say: { py: "yīn", zh: "音" }, tip: "een in “seen”.", ex: { py: "yīnyuè", zh: "音樂", en: "music" } },
    { f: "iang", spell: "yang", zy: "ㄧㄤ", say: { py: "yāng", zh: "央" }, tip: "“yahng”.", ex: { py: "liǎng", zh: "兩", en: "two (of)" } },
    { f: "ing", spell: "ying", zy: "ㄧㄥ", say: { py: "yīng", zh: "英" }, tip: "ing in “sing”.", ex: { py: "qǐng", zh: "請", en: "please" } },
    { f: "iong", spell: "yong", zy: "ㄩㄥ", say: { py: "yōng", zh: "擁" }, tip: "“yoong”, lips rounded.", ex: { py: "yóuyǒng", zh: "游泳", en: "to swim" } },
  ] },
  { title: "u- sounds", zh: "", desc: "Start with a quick “oo”. Alone they're written with w.", items: [
    { f: "ua", spell: "wa", zy: "ㄨㄚ", say: { py: "wā", zh: "蛙" }, tip: "wa in “wander”.", ex: { py: "huā", zh: "花", en: "flower" } },
    { f: "uo", spell: "wo", zy: "ㄨㄛ", say: { py: "wō", zh: "窩" }, tip: "wo in “war”.", ex: { py: "duō", zh: "多", en: "many" } },
    { f: "uai", spell: "wai", zy: "ㄨㄞ", say: { py: "wāi", zh: "歪" }, tip: "“why”.", ex: { py: "kuài", zh: "快", en: "fast" } },
    { f: "ui", full: "uei", spell: "wei", zy: "ㄨㄟ", say: { py: "wēi", zh: "威" }, tip: "“way”. Written ui after an initial (duì).", ex: { py: "duì", zh: "對", en: "correct" } },
    { f: "uan", spell: "wan", zy: "ㄨㄢ", say: { py: "wān", zh: "彎" }, tip: "“wahn”.", ex: { py: "wǎnshàng", zh: "晚上", en: "evening" } },
    { f: "un", full: "uen", spell: "wen", zy: "ㄨㄣ", say: { py: "wēn", zh: "溫" }, tip: "“won” (like “one”). Written un after an initial (lùn).", ex: { py: "qǐngwèn", zh: "請問", en: "excuse me" } },
    { f: "uang", spell: "wang", zy: "ㄨㄤ", say: { py: "wāng", zh: "汪" }, tip: "“wahng”.", ex: { py: "wǎngqiú", zh: "網球", en: "tennis" } },
    { f: "ueng", spell: "weng", zy: "ㄨㄥ", say: { py: "wēng", zh: "翁" }, tip: "“wung”. Only used alone.", ex: { py: "wēng", zh: "翁", en: "old man" } },
  ] },
  { title: "ü- sounds", zh: "", desc: "Start with ü. After j q x and alone the dots are dropped (ju, yu).", items: [
    { f: "üe", spell: "yue", zy: "ㄩㄝ", say: { py: "yuē", zh: "約" }, tip: "ü + “eh”.", ex: { py: "xué", zh: "學", en: "to learn" } },
    { f: "üan", spell: "yuan", zy: "ㄩㄢ", say: { py: "yuān", zh: "冤" }, tip: "ü + “en”.", ex: { py: "yuán", zh: "元", en: "yuan (money)" } },
    { f: "ün", spell: "yun", zy: "ㄩㄣ", say: { py: "yūn", zh: "暈" }, tip: "ü + n.", ex: { py: "yùndòng", zh: "運動", en: "exercise" } },
  ] },
];

// ---------------------------------------------------------------- spelling rules
export const RULES = [
  { title: "Where the tone mark goes", body: "Put it on a or e if there is one. In ou, it goes on the o. Otherwise it goes on the last vowel.",
    ex: [{ py: "hǎo", zh: "好" }, { py: "xiè", zh: "謝" }, { py: "dōu", zh: "都" }, { py: "duō", zh: "多" }, { py: "liù", zh: "六" }, { py: "duì", zh: "對" }] },
  { title: "ü loses its dots after j, q, x, y", body: "j, q, x never go with u, so ju, qu, xu, yu always mean ü. After n and l the dots stay, because nu and nü are different words.",
    ex: [{ py: "qù", zh: "去" }, { py: "xué", zh: "學" }, { py: "yú", zh: "魚" }, { py: "nǚ", zh: "女" }, { py: "lǜ", zh: "綠" }, { py: "lù", zh: "路" }] },
  { title: "y and w at the start", body: "Syllables that start with i, u or ü are written with y or w: i → yi, ia → ya, u → wu, uo → wo, ü → yu.",
    ex: [{ py: "yī", zh: "一" }, { py: "yǒu", zh: "有" }, { py: "wǔ", zh: "五" }, { py: "wǒ", zh: "我" }, { py: "yǔ", zh: "雨" }] },
  { title: "Shortened spellings", body: "After an initial, iou is written iu, uei is written ui and uen is written un — but you still hear the middle vowel a little.",
    ex: [{ py: "liù", zh: "六" }, { py: "jiǔ", zh: "九" }, { py: "duì", zh: "對" }, { py: "guì", zh: "貴" }, { py: "lùn", zh: "論" }, { py: "chūn", zh: "春" }] },
  { title: "The “i” after zh ch sh r z c s", body: "Here i is not “ee”: keep the tongue where the initial was and let the sound buzz.",
    ex: [{ py: "zhī", zh: "知" }, { py: "chī", zh: "吃" }, { py: "shì", zh: "是" }, { py: "rì", zh: "日" }, { py: "zì", zh: "字" }, { py: "sì", zh: "四" }] },
  { title: "Aspirated pairs: the paper test", body: "Hold a paper in front of your mouth. p t k q ch c should make it move; b d g j zh z should not.",
    ex: [{ py: "bà", zh: "爸" }, { py: "pà", zh: "怕" }, { py: "dà", zh: "大" }, { py: "tā", zh: "他" }, { py: "gē", zh: "哥" }, { py: "kē", zh: "科" }] },
];

// ---------------------------------------------------------------- syllable chart
export const CHART_INITIALS = ["", "b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "x", "zh", "ch", "sh", "r", "z", "c", "s"];
export const CHART_FINALS = [
  "a", "o", "e", "ai", "ei", "ao", "ou", "an", "en", "ang", "eng", "ong", "er",
  "i", "ia", "ie", "iao", "iou", "ian", "in", "iang", "ing", "iong",
  "u", "ua", "uo", "uai", "uei", "uan", "uen", "uang", "ueng",
  "ü", "üe", "üan", "ün",
];
const ALONE = { i: "yi", ia: "ya", ie: "ye", iao: "yao", iou: "you", ian: "yan", in: "yin", iang: "yang", ing: "ying", iong: "yong",
  u: "wu", ua: "wa", uo: "wo", uai: "wai", uei: "wei", uan: "wan", uen: "wen", uang: "wang", ueng: "weng",
  ü: "yu", üe: "yue", üan: "yuan", ün: "yun" };

// toneless syllable -> { 1: "媽", 2: "麻", ... } for the tones that really exist
const TONE_CHARS = {};
for (const [k, ch] of Object.entries(SYLLABLE_CHARS)) {
  const t = toneOf(k);
  if (t > 4 || RARE_SYLLABLES.has(k)) continue;   // only real, common sounds for beginners
  const base = stripTones(k);
  (TONE_CHARS[base] = TONE_CHARS[base] || {})[t] = ch;
}

/** Correct pinyin spelling of initial + final (applies the y/w, iu/ui/un and ü rules). */
export function spell(initial, final) {
  if (!initial) return ALONE[final] || final;
  if (["j", "q", "x"].includes(initial)) {
    if (final.startsWith("u")) return null;           // j q x only take i and ü sounds
    if (final.startsWith("ü")) final = "u" + final.slice(1);
  }
  if (final === "iou") final = "iu";
  if (final === "uei") final = "ui";
  if (final === "uen") final = "un";
  return initial + final;
}

/** The tones (1–4) that exist for a toneless syllable, with the character the voice reads. */
export function tonesOf(syl) { return TONE_CHARS[syl] || null; }

/** Toned spelling: ("ma", 3) -> "mǎ" */
export function withTone(syl, t) { return numbersToMarks(syl.replace(/ü/g, "v") + t); }

/** All real syllables for one initial, in chart order. */
export function syllablesFor(initial) {
  const out = [];
  for (const f of CHART_FINALS) {
    const s = spell(initial, f);
    if (s && TONE_CHARS[s] && !out.includes(s)) out.push(s);
  }
  return out;
}
