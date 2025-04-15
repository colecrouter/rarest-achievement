import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./src/repositories/db/schema.ts",
    dbCredentials: {
        url: "file://../site/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/8a58c34c43f4816e1d8141ccb7adb5217b630c50a2dd4bf26239ffbae1ca08d5.sqlite",
    },
    verbose: true,
    strict: true,
    dialect: "sqlite",
});
