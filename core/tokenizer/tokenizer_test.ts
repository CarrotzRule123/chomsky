import { assertEquals } from "https://deno.land/std@0.125.0/testing/asserts.ts";
import { Tokenizer } from "./mod.ts";

const t = new Tokenizer();

Deno.test("empty string", () => {
  const str = "";
  assertEquals(t.encode(str), []);
  assertEquals(t.decode(t.encode(str)), str);
});

Deno.test("space", () => {
  const str = " ";
  assertEquals(t.encode(str), [220]);
  assertEquals(t.decode(t.encode(str)), str);
});

Deno.test("tab", () => {
  const str = "\t";
  assertEquals(t.encode(str), [197]);
  assertEquals(t.decode(t.encode(str)), str);
});

Deno.test("simple text", () => {
  const str = "This is some text";
  assertEquals(t.encode(str), [1212, 318, 617, 2420]);
  assertEquals(t.decode(t.encode(str)), str);
});

Deno.test("multi-token word", () => {
  const str = "indivisible";
  assertEquals(t.encode(str), [521, 452, 12843]);
  assertEquals(t.decode(t.encode(str)), str);
});

Deno.test("emojis", () => {
  const str = "hello 👋 world 🌍";
  assertEquals(t.encode(str), [31373, 50169, 233, 995, 12520, 234, 235]);
  assertEquals(t.decode(t.encode(str)), str);
});
