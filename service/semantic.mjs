import { pipeline, env } from "@huggingface/transformers";
import { fileURLToPath } from "node:url";
const MODEL = "Xenova/multilingual-e5-small";
const REVISION = "761b726dd34fb83930e26aab4e9ac3899aa1fa78";
env.cacheDir =
  process.env.MODEL_CACHE ||
  fileURLToPath(new URL("../model-cache", import.meta.url));
env.backends.onnx.numThreads = 2;
export class SemanticSearch {
  constructor() {
    this.status = "loading";
    this.vectors = new Map();
    this.extractor = null;
    this.pending = 0;
    this.chain = Promise.resolve();
  }
  async warm(items) {
    try {
      this.extractor = await pipeline("feature-extraction", MODEL, {
        revision: REVISION,
        dtype: "q8",
        device: "cpu",
        session_options: {
          intraOpNumThreads: 1,
          interOpNumThreads: 1,
          executionMode: "sequential",
          extra: { session: { "intra_op.allow_spinning": "0", "inter_op.allow_spinning": "0" } },
        },
        local_files_only: process.env.MODEL_LOCAL_ONLY === "1",
      });
      for (const item of items) {
        const o = await this.extractor(
          "passage: " +
            item.name +
            " " +
            item.style +
            " " +
            item.color +
            " " +
            item.evidence,
          {
            pooling: "mean",
            normalize: true,
            truncation: true,
            max_length: 96,
          },
        );
        this.vectors.set(item.id, Array.from(o.data));
      }
      this.status = "ready";
    } catch {
      this.status = "unavailable";
      console.error(
        "E39 semantic model unavailable; catalog search remains available.",
      );
    }
  }
  async scores(query, items) {
    if (this.status !== "ready") return null;
    if (this.pending >= 2) throw Error("SEARCH_BUSY");
    this.pending++;
    const run = this.chain.then(async () => {
      const t = Date.now(),
        o = await this.extractor("query: " + query, {
          pooling: "mean",
          normalize: true,
          truncation: true,
          max_length: 96,
        });
      const scores = items.map((item) => {
        const v = this.vectors.get(item.id);
        return v.reduce((s, n, i) => s + n * o.data[i], 0);
      });
      return {
        scores,
        elapsedMs: Date.now() - t,
        model: MODEL,
        revision: REVISION,
      };
    });
    this.chain = run.catch(() => {});
    try {
      return await run;
    } finally {
      this.pending--;
    }
  }
}
