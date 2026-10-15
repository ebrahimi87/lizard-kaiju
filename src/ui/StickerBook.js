// Sticker book (DOM): one page of stickers. Collected stickers are in full color;
// missing ones are dark shapes with a question mark. Gold stickers get a star.
//   book.open([{ id, image, collected, gold }])

export class StickerBook {
  constructor(onBack) {
    this.grid = document.getElementById("book-grid");
    document.getElementById("book-back").addEventListener("click", () => onBack());
  }

  open(stickers) {
    this.grid.innerHTML = "";
    stickers.forEach((sticker, index) => {
      const cell = document.createElement("div");
      cell.className = "sticker";
      cell.classList.toggle("is-missing", !sticker.collected);
      cell.classList.toggle("is-gold", Boolean(sticker.gold));
      cell.style.setProperty("--tilt", `${((index * 37) % 9) - 4}deg`);
      cell.innerHTML = `<img alt="" src="${sticker.image}">${sticker.collected ? "" : '<span class="sticker-question">?</span>'}${sticker.gold ? '<svg class="sticker-star" viewBox="0 0 64 64"><use href="#i-star" /></svg>' : ""}`;
      this.grid.append(cell);
    });
  }
}
