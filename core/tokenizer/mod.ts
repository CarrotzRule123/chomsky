const encoder = Deno.readFileSync(new URL("encoder.json", import.meta.url));
const bpe = Deno.readFileSync(new URL("vocab.bpe", import.meta.url));

const pat =
  /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;

function range(x: number, y: number) {
  return Array.from(Array(y).keys()).slice(x);
}

function bytesToUnicode() {
  const bs = range("!".charCodeAt(0), "~".charCodeAt(0) + 1)
    .concat(range("¡".charCodeAt(0), "¬".charCodeAt(0) + 1))
    .concat(range("®".charCodeAt(0), "ÿ".charCodeAt(0) + 1));
  const cs = bs.slice();

  for (let b = 0, n = 0; b < 2 ** 8; b++) {
    if (!bs.includes(b)) {
      bs.push(b);
      cs.push(2 ** 8 + n);
      n += 1;
    }
  }

  return Object.fromEntries(
    bs.map((_, i) => [bs[i], String.fromCharCode(cs[i])]),
  );
}

function getPairs(word: string[]) {
  const pairs: Set<string[]> = new Set();
  let prev_char = word[0];
  for (const char of word.slice(1)) {
    pairs.add([prev_char, char]);
    prev_char = char;
  }
  return pairs;
}

export class Tokenizer {
  #encoder: Record<string, number>;
  #decoder: Record<number, string>;
  #byteEncoder: Record<number, string>;
  #byteDecoder: Record<string, number>;
  #bpeRanks: Map<string, number>;
  #cache: Record<string, string> = {};
  constructor() {
    this.#encoder = JSON.parse(new TextDecoder().decode(encoder));
    this.#decoder = Object.fromEntries(
      Object.entries(this.#encoder).map((a) => a.reverse()),
    );
    this.#byteEncoder = bytesToUnicode();
    this.#byteDecoder = Object.fromEntries(
      Object.entries(this.#byteEncoder).map((a) => a.reverse()),
    );

    const bpeLines = new TextDecoder().decode(bpe).split("\n");
    const bpeMerges = bpeLines.slice(1, bpeLines.length - 1)
      .map((x) => x.split(/(\s+)/).filter((e) => e.trim().length > 0));
    const bpe_index = range(0, bpeMerges.length);
    this.#bpeRanks = new Map(
      bpeMerges.map((_, i) => [bpeMerges[i].toString(), bpe_index[i]]),
    );
  }

  bpe(token: string) {
    if (token in this.#cache) return this.#cache[token];
    let word = token.split("");
    let pairs = getPairs(word);
    if (!pairs) return token;

    while (true) {
      if (pairs.size == 0) break;
      const bigram = Array.from(pairs).reduce((p, c) => {
        const prev = this.#bpeRanks.get(p.toString()) ?? 10e10;
        const curr = this.#bpeRanks.get(c.toString()) ?? 10e10;
        return prev < curr ? p : c;
      });

      if (!this.#bpeRanks.has(bigram.toString())) break;

      const [first, second] = bigram;
      const new_word: string[] = [];
      let i = 0;

      while (i < word.length) {
        const j = word.indexOf(first, i);
        if (j === -1) {
          new_word.push(...word.slice(i));
          break;
        }
        new_word.push(...word.slice(i, j));
        i = j;

        if (
          word[i] === first && i < word.length - 1 && word[i + 1] === second
        ) {
          new_word.push(first + second);
          i = i + 2;
        } else {
          new_word.push(word[i]);
          i = i + 1;
        }
      }

      word = new_word;
      if (word.length === 1) {
        break;
      } else {
        pairs = getPairs(word);
      }
    }

    const res = word.join(" ");
    this.#cache[token] = res;

    return res;
  }

  encode(text: string) {
    const bpeTokens: number[] = [];
    const matches = Array.from(text.matchAll(pat)).map((x) => x[0]);
    for (const token of matches) {
      const strToken = Array.from(new TextEncoder().encode(token))
        .map((x) => this.#byteEncoder[x]).join("");
      const new_tokens = this.bpe(strToken).split(" ")
        .map((x) => this.#encoder[x]);
      bpeTokens.push(...new_tokens);
    }
    return bpeTokens;
  }

  decode(tokens: number[]) {
    const text = tokens.map((x) => this.#decoder[x]).join("");
    const arr = text.split("").map((x) => this.#byteDecoder[x]);
    return new TextDecoder().decode(new Uint8Array(arr));
  }
}
