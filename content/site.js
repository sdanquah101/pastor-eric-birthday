/* ------------------------------------------------------------------
   EDIT THIS FILE to change the words on the site.
   Anything in [square brackets] is a placeholder to replace.
   Photos are listed in content/photos.json (run `npm run photos`);
   here you only pick which ones appear in the opening and the story.
   ------------------------------------------------------------------ */
export default {
  name: { first: "Eric", middle: "Obeng", last: "Kwakye" },
  title: "Pastor",
  organisation: "Phanerosis Network International",
  orgShort: "PHANET",

  // Optional. Format "YYYY-MM-DD". When set, the hero shows the date
  // and the age he turns. Leave empty ("") to hide both.
  birthDate: "",
  birthdayThisYear: "", // e.g. "2026-10-18" — shown as the celebration date

  heroKicker: "Happy birthday,",
  heroLine: "Executive Director, Phanerosis Network International",

  // The four stoles on the home page. `short` is the label in the phone tab bar.
  rooms: [
    { id: "story", label: "His story", short: "Story", seed: 23, length: 0.70 },
    { id: "wishes", label: "Wishes", short: "Wishes", seed: 37, length: 0.82 },
    { id: "gallery", label: "Gallery", short: "Gallery", seed: 11, length: 0.62 },
    { id: "give", label: "Give a gift", short: "Give", seed: 52, length: 0.76 },
  ],

  meaning: {
    word: "phanerōsis",
    gloss: "Greek, noun. A manifestation; a making visible of what was hidden.",
    ref: "1 Corinthians 12:7",
  },

  story: {
    title: "The man in the white pinstripe",
    photo: "portrait-mic", // a photo id from content/photos.json
  },

  bio: [
    "Pastor Eric Obeng Kwakye is the Executive Director of Phanerosis Network International (PHANET), a ministry built on a single conviction: that what God has placed in a person is meant to be made visible.",
    "[Add a paragraph on his calling and early ministry: where he started, when, and what drew him to this work.]",
    "[Add a paragraph on his work with young people, students and the PHANET boards, and the outreaches he has led in Ghana and beyond.]",
    "[Add a paragraph on his family and on the things those closest to him know him for.]",
  ],

  // Short facts shown beside the bio. Remove any you don't need.
  facts: [
    { term: "Role", detail: "Executive Director, Phanerosis Network International" },
    { term: "Calling", detail: "[Pastor, teacher, mentor — edit as appropriate]" },
    { term: "Based in", detail: "[City, Ghana]" },
  ],

  // Opening sequence: four photos weave together, then become the final portrait.
  // Use photo ids from content/photos.json. Portrait (tall) photos work best.
  intro: {
    weave: ["portrait-mic", "preaching", "gesture", "trio"],
    final: "portrait-seated",
  },

  gallery: {
    heading: "Gallery",
    // seconds between photos when nobody is touching the gallery (0 = off)
    autoplay: 5,
  },

  giving: {
    heading: "Send a birthday gift",
    text: "Gifts are received securely through Paystack by mobile money or card. [State who receives the gifts and how they will be used.]",
    currency: "GHS",
    presets: [50, 100, 200, 500, 1000],
    defaultAmount: 200,
    // Your Paystack PUBLIC key (pk_live_… or pk_test_…). Safe to put here.
    // Optional if you set PAYSTACK_PUBLIC_KEY in Vercel instead.
    publicKey: "",
  },

  relations: ["Family", "PHANET", "Church", "Friend", "Colleague", "Mentee", "Other"],

  footer: "With love from the PHANET family.",

  // Shown only in preview mode, when the database is not connected.
  sampleWishes: [
    { id: "s1", name: "Ama", relation: "PHANET", message: "Happy birthday, Pastor. Thank you for believing in us before we believed in ourselves." },
    { id: "s2", name: "Kojo", relation: "Mentee", message: "Your counsel changed the direction of my life. May this year be your best yet." },
    { id: "s3", name: "Efua", relation: "Church", message: "Many more years of grace, strength and joy." },
    { id: "s4", name: "Yaw", relation: "Friend", message: "Happy birthday, my brother. Keep shining." },
    { id: "s5", name: "Abena", relation: "Family", message: "We love you and we thank God for you." },
    { id: "s6", name: "Kwame", relation: "Colleague", message: "It is an honour to serve alongside you. Happy birthday!" },
    { id: "s7", name: "Adwoa", relation: "PHANET", message: "Thank you for every early morning prayer and every late night call." },
  ],
};
