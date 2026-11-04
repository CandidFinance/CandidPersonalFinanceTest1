// Candid's voice in the Chat tab: the small phrases around the questions
// and answers, so it reads as a person talking, not a form. Each pool is a
// set of ways to say the same thing; a conversation steps through each pool
// in turn from a random place (makeVoice), so the same words don't come up
// twice running and no two conversations sound quite the same. Pure, unit
// tested in chatStart.test.js. A new phrase only needs adding to its pool.
//
// Copy rules hold here too (CLAUDE.md): no directive advice, no emoji,
// nothing about their pay or what "people like you" do.

export const VOICE = {
  hello: ["Hi", "Hello", "Hey"],
  helloAgain: ["Welcome back", "Good to see you again", "Hello again"],
  // After the areas are picked.
  picked: ["Great, thanks.", "Lovely, thanks.", "Good stuff."],
  whereFirst: ["So, where would you like to start?", "So, which one first?", "Where do you fancy starting?"],
  // A word back on an answer with nothing more particular to say.
  ack: ["Got it.", "Thanks.", "Okay.", "Noted.", "Lovely.", "Perfect.", "Great, thanks.", "Right then.", "Cheers.", "Brilliant."],
  // Before the next question, after `ack` (empty: straight on).
  lead: ["", "Next one: ", "And ", "Next up: ", "Now, ", "Quick one: ", "", "Moving on: "],
  // Before the first question of a module.
  first: ["So, to start: ", "First up: ", "Let's kick off: ", "To begin: "],
  // With "Not sure" and the like.
  noProblem: ["No problem", "No worries", "That's fine", "Not a problem"],
  // Two questions left (this one and one more).
  nearly: ["Nearly there.", "Almost done.", "Not long now.", "Just a couple more."],
  // The last question in a module.
  lastOne: ["Last one for {module}: ", "Final question on {module}: ", "And the last one: "],
  // Bands tapped two questions running where a figure could be typed.
  nudge: [
    "Don't forget, if you know the actual figure, pop it in the chat below. Better figures in, better answer out, as they say.",
    "If you know the exact number, chuck it in the message box. The closer the figures, the sharper the answer.",
    "Quick reminder: you can type real figures in the chat too. Rough in, rough out, as they say.",
  ],
  // After the last answer, before working it out.
  done: ["That's everything I need.", "That's all I need for now.", "That's the lot.", "Done, that's everything."],
  // On savings of £5k to £20k, and of £20k or more.
  savedWell: ["Looks like you've been saving well, nice work.", "That's a good cushion you've built up, nice work.", "Nice, you've clearly been putting money aside."],
  savedLots: [
    "That's a healthy amount put by, nice work. It also means the rate it earns matters more.",
    "Nice, that's a solid pot. The bigger it is, the more the rate it earns matters.",
  ],
  // Over a module's answer.
  result: ["Here's **{module}**, on the figures you've given.", "Here's how **{module}** looks on your figures.", "Right, here's **{module}**, worked out on your numbers."],
  // Before a module's questions, where a figure can be typed.
  howToAnswer: [
    "Your actual figures are best, but estimates are fine. Tap the closest band, or type the real figure in the chat below.",
    "Real figures are ideal, though rough is fine too. Tap a band, or type the number in the chat below.",
  ],
  // Before a module's questions, where every answer is a choice.
  tapToAnswer: ["Just tap whichever fits best.", "Tap whichever fits best, rough is fine."],
};

const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

// One conversation's voice: say("ack") gives the pool's next phrase. The
// default (seed 0) always starts each pool at its first phrase, for tests.
export function makeVoice(seed = 0) {
  const at = {};
  return (pool, vars = {}) => {
    const list = VOICE[pool];
    const i = at[pool] = pool in at ? at[pool] + 1 : seed % list.length;
    return fill(list[i % list.length], vars);
  };
}
