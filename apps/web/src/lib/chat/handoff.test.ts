import { describe, expect, it } from "vitest";
import { wantsHuman } from "./handoff";

describe("wantsHuman", () => {
  it("catches explicit requests for a person", () => {
    for (const q of [
      "Can I talk to a human?",
      "I want to speak with someone from support",
      "please connect me to an agent",
      "Is there a real person I can chat with?",
      "Transfer me to a representative",
      "human please",
      "I'd rather talk to someone, not a bot",
    ]) {
      expect(wantsHuman(q), q).toBe(true);
    }
  });

  it("ignores ordinary support questions", () => {
    for (const q of ["How do I return shoes?", "Who is the person in charge of shipping?", "Do you have a human resources policy?", "What is your agent fee?", "Where is my order 48213?"]) {
      expect(wantsHuman(q), q).toBe(false);
    }
  });
});
