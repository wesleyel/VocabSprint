export type StatusStore = {
  setMastered(id: number, mastered: boolean): Promise<void>;
  getAllStatuses(): Promise<Map<number, boolean>>;
};

export async function openStatusStore(kvPath: string): Promise<StatusStore> {
  const kv = await Deno.openKv(kvPath);

  return {
    async setMastered(id: number, mastered: boolean) {
      await kv.set(["mastered", id], mastered);
    },

    async getAllStatuses() {
      const result = new Map<number, boolean>();
      for await (const entry of kv.list<boolean>({ prefix: ["mastered"] })) {
        const id = entry.key[1];
        if (typeof id === "number") result.set(id, entry.value ?? false);
      }
      return result;
    },
  };
}
