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
    "Ps. Eric Obeng Kwakye is a father, mentor, life coach and pastor to the thousands of phaneteers who have passed through the network.",
    "He has pursued excellence in everything he puts his hand to, and he has taught many of us to do the same. As Executive Director of Phanerosis Network International, he has given himself to raising young people who know God and do their work well, in the lecture hall, on the stage and in every room they walk into.",
    "Many of us first heard from him that God is interested in our academics, and we have watched him live what he teaches. Through camps, conferences, counsel and countless conversations, he has helped a generation find its feet, its voice and its calling.",
    "Today we celebrate him: for the example he has set, for the lives he has built up, and for the many more years of fruitful ministry ahead. Happy birthday, Ps. Eric.",
  ],

  // Short facts shown beside the bio. Remove any you don't need.
  facts: [
    { term: "Role", detail: "Executive Director, Phanerosis Network International" },
    { term: "Calling", detail: "Father, mentor, life coach and pastor" },
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
    text: "Send Ps. Eric a birthday blessing from the PHANET family, straight to his MoMo.",
    // Direct MoMo: when set, the Give page shows this number instead of a payment provider.
    // Givers send money themselves, then tell the site so their gift appears on his cloth.
    // Remove (or empty `number`) to go back to Paystack/Hubtel.
    momo: { number: "0242631352", name: "Eric Obeng Kwakye", network: "MTN MoMo" },
    currency: "GHS",
    presets: [50, 100, 200, 500, 1000],
    defaultAmount: 200,
    // Your Paystack PUBLIC key (pk_live_… or pk_test_…). Safe to put here.
    // Optional if you set PAYSTACK_PUBLIC_KEY in Vercel instead.
    publicKey: "pk_live_24444d9f7c60d06000f3ab6139f020b2d6e2dbd5",
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
