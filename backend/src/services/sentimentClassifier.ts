const positiveTerms = new Set([
  'amazing', 'beautiful', 'best', 'brilliant', 'enjoy', 'excellent', 'fun', 'good', 'gorgeous',
  'great', 'happy', 'love', 'lovely', 'perfect', 'sweet', 'wonderful', 'wow',
]);

const negativeTerms = new Set([
  'awful', 'bad', 'boring', 'dislike', 'hate', 'horrible', 'sad', 'terrible', 'ugly', 'worst',
]);

export function classifyCommentSentiment(text: string): { sentiment: 'Positive' | 'Neutral' | 'Negative'; score: number } {
  const tokens = text.toLowerCase().match(/[a-z]+/g) ?? [];
  let score = tokens.reduce((total, token) => {
    if (positiveTerms.has(token)) return total + 1;
    if (negativeTerms.has(token)) return total - 1;
    return total;
  }, 0);

  if (/[❤️😍🥰😊😁😂👏🔥✨💖💕]/u.test(text)) score += 1;
  if (/[😡😠😭😢👎💔]/u.test(text)) score -= 1;

  return {
    sentiment: score > 0 ? 'Positive' : score < 0 ? 'Negative' : 'Neutral',
    score,
  };
}
