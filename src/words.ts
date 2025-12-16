export type WordItem = {
  id: number; // 序号
  rank: number; // 序号（同 id）
  freq: number;
  word: string;
  meaning: string;
  other: string | null;
};

type RawWord = {
  "序号": number;
  "词频": number;
  "单词": string;
  "释义": string;
  "其他拼写": string | null;
};

type RawDb = Record<string, RawWord[]>;

export async function loadWords(jsonPath: string): Promise<WordItem[]> {
  const text = await Deno.readTextFile(jsonPath);
  const parsed = JSON.parse(text) as RawDb;

  const firstKey = Object.keys(parsed)[0];
  if (!firstKey) throw new Error("JSON has no top-level key");

  const list = parsed[firstKey];
  if (!Array.isArray(list)) throw new Error("Top-level value is not an array");

  return list.map((r) => ({
    id: r["序号"],
    rank: r["序号"],
    freq: r["词频"],
    word: r["单词"],
    meaning: r["释义"],
    other: r["其他拼写"],
  }));
}
