export const tokenize = (text: string) =>
  text
    .toLowerCase()
    .match(/[\u4e00-\u9fa5]|[a-z0-9]+/g)
    ?.filter((token) => token.length > 0) ?? [];

export const cosineSimilarity = (left: number[], right: number[]) => {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let i = 0; i < left.length; i += 1) {
    dot += left[i] * right[i];
    leftNorm += left[i] * left[i];
    rightNorm += right[i] * right[i];
  }
  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
};
