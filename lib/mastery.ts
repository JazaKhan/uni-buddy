export function weightedScore(isCorrect: boolean, confidence: string): number {
  if (isCorrect) {
    if (confidence === "CONFIDENT") return 1.0;
    if (confidence === "UNSURE") return 0.7;
    return 0.5; // GUESSED
  } else {
    if (confidence === "CONFIDENT") return 0.0;
    if (confidence === "UNSURE") return 0.2;
    return 0.1; // GUESSED
  }
}
