/* eslint-disable no-process-env */
/* eslint-disable no-promise-executor-return */

import { test, expect } from "@jest/globals";
import { faker } from "@faker-js/faker";
import { v4 as uuidv4 } from "uuid";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { RedisVectorStore } from "../redis.js";
import { Document } from "../../document.js";
import { RedisClientType, createClient } from "redis";

describe("RedisVectorStore", () => {
  let vectorStore: RedisVectorStore;

  beforeEach(async () => {
    expect(process.env.REDIS_URL).toBeDefined();

    const client = createClient({ url: process.env.REDIS_URL! });
    await client.connect();

    vectorStore = new RedisVectorStore(new OpenAIEmbeddings(), {
      redisClient: client as RedisClientType,
      indexName: "test-index",
      keyPrefix: "test:"
    });
  });

  test("auto-generated ids", async () => {
    const pageContent = faker.lorem.sentence(5);

    await vectorStore.addDocuments([
      { pageContent, metadata: { foo: "bar" } },
    ]);

    const results = await vectorStore.similaritySearch(pageContent, 1);

    expect(results).toEqual([
      new Document({ metadata: { foo: "bar" }, pageContent }),
    ]);
  });

  test("user-provided keys", async () => {
    const documentKey = `test:${uuidv4()}`;
    const pageContent = faker.lorem.sentence(5);

    await vectorStore.addDocuments(
      [{ pageContent, metadata: {} }],
      [documentKey]
    );

    const results = await vectorStore.similaritySearch(pageContent, 1);

    expect(results).toEqual([
      new Document({ metadata: {}, pageContent })
    ]);
  });

  test("metadata filtering", async () => {
    await vectorStore.dropIndex();
    const pageContent = faker.lorem.sentence(5);
    const uuid = uuidv4();

    await vectorStore.addDocuments([
      { pageContent, metadata: { foo: "bar" } },
      { pageContent, metadata: { foo: uuid } },
      { pageContent, metadata: { foo: "qux" } },
    ]);

    // If the filter wasn't working, we'd get all 3 documents back
    const results = await vectorStore.similaritySearch(pageContent, 3, [`${uuid}`]);

    expect(results).toEqual([
      new Document({ metadata: { foo: uuid }, pageContent }),
    ]);
  });
});
