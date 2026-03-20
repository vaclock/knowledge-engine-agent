import { QdrantClient } from "@qdrant/js-client-rest";

export const createQdrantClient = (config: { url: string; apiKey?: string }) =>
  new QdrantClient({
    url: config.url,
    apiKey: config.apiKey
  });

export const listQdrantCollections = async (config: { url: string; apiKey?: string }) => {
  const client = createQdrantClient(config);
  const result = await client.getCollections();
  return result.collections.map((item: { name: string }) => item.name);
};
