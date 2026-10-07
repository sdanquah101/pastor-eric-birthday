/* ================= HIS STORY ================= */
import { $, h } from "../lib/dom.js";
import { photo, srcset, bestSrc, altText } from "../lib/photos.js";
import SITE from "../../../content/site.js";

export function fillStory() {
  const m = SITE.meaning;
  if (m) {
    $("[data-meaning-word]").textContent = m.word;
    $("[data-meaning-gloss]").textContent = m.gloss;
    $("[data-meaning-ref]").textContent = m.ref;
  }
  const story = SITE.story || {};
  if (story.title) $("#storyTitle").textContent = story.title;
  $("[data-bio]").append(...(SITE.bio || []).map((t) => h("p", { text: t })));
  $("[data-facts]").append(...(SITE.facts || []).flatMap((f) => [h("dt", { text: f.term }), h("dd", { text: f.detail })]));

  const p = photo(story.photo);
  const fig = $(".story__figure");
  if (!p) { fig.hidden = true; return; }
  fig.append(h("img", {
    src: bestSrc(p, 480, 600), srcset: srcset(p), sizes: "(max-width: 860px) 90vw, 40vw",
    width: p.w, height: p.h, alt: altText(p, 0), loading: "lazy", decoding: "async",
    style: { objectPosition: `50% ${Math.round((p.focus ?? 0.2) * 100)}%`, backgroundColor: p.color },
  }));
}
