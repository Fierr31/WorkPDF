// js/fonts.js
const fonts = [
  "Arial",
  "Verdana",
  "Georgia",
  "Times New Roman",
  "Courier New"
];

export function loadFonts(selectId) {
  const select = document.getElementById(selectId);

  fonts.forEach(font => {
    const opt = document.createElement("option");
    opt.value = font;
    opt.textContent = font;
    opt.style.fontFamily = font;
    select.appendChild(opt);
  });
}

export function onFontChange(selectId, callback) {
  const select = document.getElementById(selectId);
  select.addEventListener("change", () => {
    callback(select.value);
  });
}
