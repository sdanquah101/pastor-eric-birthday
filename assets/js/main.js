/* Boot: fill the words, build the rooms, then play the opening
   (unless the link points straight at a room, e.g. /#wishes). */
import { $, $$, onResize } from "./lib/dom.js";
import { weaveCloth, strip, clothMotion } from "./lib/kente.js";
import { loadPhotos } from "./lib/photos.js";
import { buildNav, startRouter } from "./rooms/nav.js";
import { intro } from "./rooms/intro.js";
import { fillHome, buildStoles } from "./rooms/home.js";
import { fillStory } from "./rooms/story.js";
import { setupGallery } from "./rooms/gallery.js";
import { setupWishes } from "./rooms/wishes.js";
import { setupGive } from "./rooms/give.js";
import SITE from "../../content/site.js";

const photos = loadPhotos();

fillHome();
buildNav();
buildStoles();
setupWishes();
setupGive();
$("[data-footer]").textContent = SITE.footer || "";
$$("[data-strip]").forEach(strip);

const deep = startRouter();
$$("[data-cloth]").forEach(weaveCloth);
onResize(() => $$("[data-cloth]").forEach(weaveCloth));
clothMotion();
// cloth bands inside a room only have a width once the room is visible
addEventListener("room:shown", () => $$("[data-cloth]").forEach((el) => { if (el.clientWidth && +el.dataset.wovenFor !== el.clientWidth) weaveCloth(el); }));

if (deep) $("#intro").remove();
else intro(() => $(".home").classList.add("js-hang"), photos);

photos.then(() => {
  fillStory();
  setupGallery();
});
