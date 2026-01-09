// js/main.js
import { loadFonts, onFontChange } from "./fonts.js";

document.addEventListener("DOMContentLoaded", () => {
  loadFonts("fonts");

  onFontChange("fonts", font => {
    document.documentElement.style.setProperty(
      "--font-preview",
      font
    );
  });
});
