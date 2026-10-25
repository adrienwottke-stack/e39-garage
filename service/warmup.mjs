import { pipeline, env } from "@huggingface/transformers";
env.cacheDir = "../model-cache";
env.backends.onnx.numThreads = 2;
const t = Date.now();
const p = await pipeline("feature-extraction", "Xenova/multilingual-e5-small", {
  revision: "761b726dd34fb83930e26aab4e9ac3899aa1fa78",
  dtype: "q8",
  device: "cpu",
});
const o = await p(
  [
    "query: silberne klassische Felgen",
    "passage: silberne Kreuzspeichenfelge 18 Zoll BMW E39",
  ],
  { pooling: "mean", normalize: true },
);
console.log(
  JSON.stringify({
    elapsedMs: Date.now() - t,
    dimensions: o.dims,
    memory: process.memoryUsage().rss,
  }),
);

await p.dispose();
