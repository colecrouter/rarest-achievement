import type { BatchItem, BatchResponse } from "drizzle-orm/batch";

export const chunk = <U extends BatchItem<"sqlite">, T extends Readonly<[U, ...U[]]>>(maxSize: number, batch: T) => {
    const chunks: U[][] = [];
    for (let i = 0; i < batch.length; i += maxSize) {
        chunks.push(batch.slice(i, i + maxSize));
    }

    const responses = Promise.all(chunks.map((chunk) => chunk));

    return responses.then((r) => r.flat());
};
