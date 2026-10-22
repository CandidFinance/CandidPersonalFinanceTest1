// Pension's quick start (quickStart.js): whether they pay in, how their
// employer pays in, and each side's percentage on a slider, with what it
// comes to in £ a year as it moves. "Not sure" of a
// percentage takes the legal minimum (5% from them, 3% from the employer),
// as the module does already, and says so. Unit tested in quickStart.test.js.
import { withEstimates, addAsked } from "./quickStart.js";
import { fmt } from "./format.js";
export const LEGAL_MIN_YOU = 5, LEGAL_MIN_EMPLOYER = 3;

// The same answers, and the same fields they set, as the module's own
// pension question (moduleGuide.js).
const STATUS_ALSO = {
  yes: { pensionUnknown: false, hasPension: "yes", pensionKind: "dc" },
  db: { pensionUnknown: false, hasPension: "yes", pensionKind: "db" },
  no: { pensionUnknown: false, hasPension: "no", pensionKind: "" },
  unsure: { pensionUnknown: true, pensionKind: "" },
};

// A scheme they pay into, or not known yet while the first question is
// still to answer: the follow-ups are counted from the start, so "1 of N"
// only ever shrinks.
const paysIn = ({ d, a }) => a.payIn ? a.payIn === "yes" : !(d.askedFields || []).includes("pensionStatus");

export const PENSION_QUICK = {
  module: "pension",
  intro: { title: "Pension", subtitle: "Your employer may be paying you more than your salary.", question: "Are you getting all of it?" },
  order: ["payIn", "type", "mine", "employer"],
  questions: {
    payIn: {
      ask: "Do you pay into a workplace pension?", why: "Most employers add to what you pay in.",
      options: () => [
        { value:"yes", label:"Yes" }, { value:"db", label:"Final salary", sub:"NHS, teachers, civil service" },
        { value:"no", label:"No" }, { value:"unsure", label:"Not sure" },
      ],
      when: ({ d }) => !(d.askedFields || []).includes("pensionStatus"),
    },
    type: {
      ask: "How does your employer pay in?", why: "A match pays more when you pay more. A set amount doesn't.",
      options: () => [
        { value:"match", label:"Matches what I pay", sub:"up to a limit" },
        { value:"fixed", label:"A set amount", sub:"whatever I pay" },
        { value:"unsure", label:"Not sure" },
      ],
      when: paysIn,
    },
    mine: {
      kind: "slider", ask: "What do you pay in?", why: "A share of your salary. Your payslip shows it.",
      min: 1, max: 15, start: () => LEGAL_MIN_YOU,
      live: ({ m }, v) => m?.salary > 0 ? `${fmt(Math.round(m.salary * v / 100))} a year of your ${fmt(m.salary)} salary` : null,
      when: paysIn,
    },
    employer: {
      ask: ({ a }) => a.type === "fixed" ? "What does your employer pay in?" : "Up to what does your employer match?", why: "Your pension scheme's guide or HR can say.",
      kind: "slider", min: 1, max: 15, start: () => LEGAL_MIN_EMPLOYER,
      live: ({ m, a }, v) => {
        if (!(m?.salary > 0)) return null;
        // A match pays no more than they pay in themselves.
        const pct = a.type === "match" && +a.mine > 0 ? Math.min(v, +a.mine) : v;
        return `${fmt(Math.round(m.salary * pct / 100))} a year from your employer${a.type === "match" && +a.mine > 0 && v > +a.mine ? `, at the ${a.mine}% you pay` : ""}`;
      },
      when: ctx => paysIn(ctx) && ctx.a.type !== "unsure",
    },
  },
  patch(d, m, a) {
    const patch = {}, items = [];
    if (!a.payIn) return {};
    Object.assign(patch, { pensionStatus: a.payIn, ...STATUS_ALSO[a.payIn] });
    if (a.payIn === "yes") {
      patch.employerContributionType = a.type === "unsure" ? "" : a.type;
      patch.myContribution = String(a.mine === "unsure" ? LEGAL_MIN_YOU : a.mine);
      if (a.mine === "unsure") items.push({ phrase: `you paying in ${LEGAL_MIN_YOU}%, the legal minimum`, field: "myContribution", value: patch.myContribution });
      if (a.employer) {
        patch.employerMatch = String(a.employer === "unsure" ? LEGAL_MIN_EMPLOYER : a.employer);
        if (a.employer === "unsure") items.push({ phrase: `your employer adding ${LEGAL_MIN_EMPLOYER}%, the legal minimum`, field: "employerMatch", value: patch.employerMatch });
      }
    }
    return { ...patch, ...addAsked(d, ["pensionStatus"]), ...withEstimates(d, "pension", items) };
  },
};
