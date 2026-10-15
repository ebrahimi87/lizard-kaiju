export class Random {
  constructor(seed = 0x7f4a7c15) {
    this.state = seed >>> 0 || 0x7f4a7c15;
  }
  next() {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 4294967296;
  }
  range(min, max) {
    return min + (max - min) * this.next();
  }
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  chance(probability) {
    return this.next() < probability;
  }
  pickWeighted(items) {
    let total = 0;
    for (let i = 0; i < items.length; i += 1) total += items[i].weight;
    let cursor = this.next() * total;
    for (let i = 0; i < items.length; i += 1) {
      cursor -= items[i].weight;
      if (cursor <= 0) return items[i];
    }
    return items[items.length - 1];
  }
}
