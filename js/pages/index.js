// Page registry — the side menu is built from this list.
// To add a new page later: create js/pages/<name>.js exporting `mount(container, ctx)`
// (and optionally `unmount()`), then add one entry here. That's all.

// Order = menu order. Pinyin first: beginners learn the sounds before practising words.
export const PAGES = [
  {
    id: "pinyin",
    title: "Pinyin Phonetics",
    menu: "Pinyin Phonetics",
    icon: "waves",
    load: () => import("./pinyin.js"),
  },
  {
    id: "pronunciation",
    title: "Chinese Pronunciation",
    menu: "Chinese Pronunciation",
    icon: "speaker",
    load: () => import("./pronunciation.js"),
  },
  {
    id: "speaking",
    title: "Chinese Speaking",
    menu: "Chinese Speaking",
    icon: "mic",
    load: () => import("./listener.js"),
  },
  { id: "flashcards", title: "Flashcards", menu: "Flashcards", icon: "cards", load: () => import("./flashcards.js") },
  { id: "quiz", title: "Tone Quiz", menu: "Tone Quiz", icon: "quiz", load: () => import("./quiz.js") },
  { id: "writing", title: "Character Writing", menu: "Character Writing", icon: "pen", load: () => import("./writing.js") },
  { id: "notebook", title: "My Notebook", menu: "My Notebook", icon: "book", load: () => import("./notebook.js") },
  // Add a placeholder with `soon: true` to show a future idea greyed out in the menu.
];

export const FOOTER_PAGES = [
  { id: "settings", title: "Settings", menu: "Settings", icon: "settings", load: () => import("./settings.js") },
];

export const HOME = { id: "home", title: "Home", icon: "home", load: () => import("./home.js"), pinned: true };

export const ALL_PAGES = [HOME, ...PAGES, ...FOOTER_PAGES];
