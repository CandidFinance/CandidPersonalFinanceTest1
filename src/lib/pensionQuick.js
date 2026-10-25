// Pension's quick start (quickStart.js). Opened directly: work, pay and age
// as bands, whether they pay in, how their employer pays in, each side's
// percentage on a slider (with what it comes to in £ a year as it moves),
// and a band for what's in the pension now. From Student loan (ctx.direct
// false) only what its verdict uses: whether they pay in, and the
// percentages. "Not sure" of a percentage takes the legal minimum (5% from
// them, 3% from the employer), as the module does already, and says so.
// Unit tested in quickStart.test.js.
import { withEstimates, addAsked, SALARY_BANDS, SALARY_DEFAULT, MEDIAN_BANDS } from "./quickStart.js";
import { estimatePensionPot } from "./pension.js";
import { fmt } from "./format.js";

export const LEGAL_MIN_YOU = 5, LEGAL_MIN_EMPLOYER = 3;

// The middle of each band; the oldest a step beyond its floor.
export const AGE_BANDS = [
  { value:"u25", label:"Under 25", figure:22 },
  { value:"25-34", label:"25 to 34", figure:30 },
  { value:"35-44", label:"35 to 44", figure:40 },
  { value:"45-54", label:"45 to 54", figure:50 },
  { value:"55-64", label:"55 to 64", figure:60 },
  { value:"65+", label:"65 or over", figure:68 },
];
export const POT_BANDS = [
  { value:"none", label:"Nothing yet", figure:0 },
  { value:"u10", label:"Under £10k", figure:5000 },
  { value:"10-25", label:"£10k to £25k", figure:17500 },
  { value:"25-50", label:"£25k to £50k", figure:37500 },
  { value:"50-100", label:"£50k to £100k", figure:75000 },
  { value:"100-250", label:"£100k to £250k", figure:175000 },
  { value:"250+", label:"£250k or more", figure:350000 },
  { value:"unsure", label:"Not sure" },
];

// The same answers, and the same fields they set, as the module's own
// pension question (moduleGuide.js).
const STATUS_ALSO = {
  yes: { pensionUnknown: false, hasPension: "yes", pensionKind: "dc" },
  db: { pensionUnknown: false, hasPension: "yes", pensionKind: "db" },
  no: { pensionUnknown: false, hasPension: "no", pensionKind: "" },
  unsure: { pensionUnknown: true, pensionKind: "" },
};

const band = (list, value) => list.find(b => b.value === value);
const employmentOf = ({ d, a }) => a.employment || d.employmentStatus;
// Whether they earn: not asked about pay or a scheme's percentages if not.
const earns = ctx => employmentOf(ctx) !== "not_working";
const employed = ctx => earns(ctx) && employmentOf(ctx) !== "self_employed";
// Their pay, from the band just chosen or the answers already in.
const salaryOf = ({ d, m, a }) => band(SALARY_BANDS, a.salary)?.figure ?? (+d.salary > 0 ? +d.salary : m?.salary);
// Whether they pay in, or not known yet while the first question is still
// to answer: the follow-ups are counted from the start, so "1 of N" only
// ever shrinks.
const paysIn = ({ d, a }) => a.payIn ? a.payIn === "yes" : !(d.askedFields || []).includes("pensionStatus");
const payInAsked = ctx => earns(ctx) && !(ctx.d.askedFields || []).includes("pensionStatus");
const potAsked = ({ d, a }) => !["db", "unsure"].includes(a.payIn) && d.pensionStatus !== "db" && !(+d.potValue > 0);

export const PENSION_QUICK = {
  module: "pension",
  intro: { title: "Pension", subtitle: "Your employer may be paying you more than your salary.", question: "Are you getting all of it?" },
  order: ["employment", "notWorking", "salary", "age", "payIn", "type", "mine", "employer", "pot"],
  questions: {
    employment: {
      ask: "Are you employed, self-employed or not working?", why: "Changes which tax breaks and employer benefits you can use.",
      options: () => [{ value:"employed", label:"Employed" }, { value:"self_employed", label:"Self-employed" }, { value:"not_working", label:"Not working" }],
      when: ({ d, direct }) => direct && !d.employmentAsked && !(+d.salary > 0),
    },
    notWorking: {
      ask: "Are you retired, or between jobs?", why: "Retired, your pension is for drawing on now. Otherwise, it's for later.",
      options: () => [{ value:"retired", label:"Retired" }, { value:"break", label:"Between jobs", sub:"or a break" }],
      when: ctx => ctx.direct && employmentOf(ctx) === "not_working" && !ctx.d.notWorkingReason,
    },
    salary: {
      ask: "Roughly what do you earn a year, before tax?", why: "Employer contributions and tax relief are a share of your pay.",
      options: () => SALARY_BANDS,
      default: () => SALARY_DEFAULT,
      when: ctx => ctx.direct && earns(ctx) && !(+ctx.d.salary > 0),
    },
    age: {
      ask: "How old are you?", why: "Sets how long your money has to grow.",
      options: () => AGE_BANDS,
      default: () => MEDIAN_BANDS.age,
      when: ({ d, direct }) => direct && !(+d.age > 0),
    },
    payIn: {
      ask: ctx => employmentOf(ctx) === "self_employed" ? "Do you pay into a personal pension?" : "Do you pay into a workplace pension?",
      why: "Most employers add to what you pay in.",
      options: () => [
        { value:"yes", label:"Yes" }, { value:"db", label:"Final salary", sub:"NHS, teachers, civil service" },
        { value:"no", label:"No" }, { value:"unsure", label:"Not sure" },
      ],
      when: payInAsked,
    },
    type: {
      ask: "How does your employer pay in?", why: "A match pays more when you pay more. A set amount doesn't.",
      options: () => [
        { value:"match", label:"Matches what I pay", sub:"up to a limit" },
        { value:"fixed", label:"A set amount", sub:"whatever I pay" },
        { value:"unsure", label:"Not sure" },
      ],
      when: ctx => employed(ctx) && paysIn(ctx),
    },
    mine: {
      kind: "slider", ask: ctx => employmentOf(ctx) === "self_employed" ? "What share of your earnings do you pay in?" : "What do you pay in?",
      why: "A share of your salary. Your payslip shows it.",
      min: 1, max: 15, start: () => LEGAL_MIN_YOU,
      live: (ctx, v) => { const s = salaryOf(ctx); return s > 0 ? `${fmt(Math.round(s * v / 100))} a year of your ${fmt(s)} salary` : null; },
      when: ctx => earns(ctx) && paysIn(ctx),
    },
    employer: {
      kind: "slider", ask: ({ a }) => a.type === "fixed" ? "What does your employer pay in?" : "Up to what does your employer match?", why: "Your pension scheme's guide or HR can say.",
      min: 1, max: 15, start: () => LEGAL_MIN_EMPLOYER,
      live: (ctx, v) => {
        const s = salaryOf(ctx), a = ctx.a;
        if (!(s > 0)) return null;
        // A match pays no more than they pay in themselves.
        const capped = a.type === "match" && +a.mine > 0 && v > +a.mine;
        return `${fmt(Math.round(s * (capped ? +a.mine : v) / 100))} a year from your employer${capped ? `, at the ${a.mine}% you pay` : ""}`;
      },
      when: ctx => employed(ctx) && paysIn(ctx) && ctx.a.type !== "unsure",
    },
    pot: {
      ask: ({ d, a }) => (a.payIn || d.pensionStatus) === "yes" ? "Roughly how much is in your pension now?" : "Roughly how much is in your pensions altogether?",
      why: "Sets where your retirement income starts from.",
      options: () => POT_BANDS,
      default: () => MEDIAN_BANDS.pensionPot,
      when: ctx => ctx.direct && potAsked(ctx),
    },
  },
  patch(d, m, a) {
    const patch = {}, items = [], asked = [];
    if (a.employment) {
      patch.employmentStatus = a.employment;
      patch.employmentAsked = true;
      if (a.notWorking) patch.notWorkingReason = a.notWorking;
    }
    const salary = band(SALARY_BANDS, a.salary);
    if (salary) {
      patch.salary = String(salary.figure);
      items.push({ phrase: `${salary.label} salary`, field: "salary", value: patch.salary });
    }
    const age = band(AGE_BANDS, a.age);
    if (age) {
      patch.age = String(age.figure);
      items.push({ phrase: `aged ${age.label.toLowerCase()}`, field: "age", value: patch.age });
    }
    if (a.payIn) {
      Object.assign(patch, { pensionStatus: a.payIn, ...STATUS_ALSO[a.payIn] });
      asked.push("pensionStatus");
      if (a.payIn === "yes") {
        if (a.type) patch.employerContributionType = a.type === "unsure" ? "" : a.type;
        if (a.mine) {
          patch.myContribution = String(a.mine === "unsure" ? LEGAL_MIN_YOU : a.mine);
          if (a.mine === "unsure") items.push({ phrase: `you paying in ${LEGAL_MIN_YOU}%, the legal minimum`, field: "myContribution", value: patch.myContribution });
        }
        if (a.employer) {
          patch.employerMatch = String(a.employer === "unsure" ? LEGAL_MIN_EMPLOYER : a.employer);
          if (a.employer === "unsure") items.push({ phrase: `your employer adding ${LEGAL_MIN_EMPLOYER}%, the legal minimum`, field: "employerMatch", value: patch.employerMatch });
        }
      }
    } else if (a.employment === "not_working") {
      // Nothing paid in while not working: the pension is a pot to build or
      // draw on (as the module's own "a pension you no longer pay into").
      Object.assign(patch, STATUS_ALSO.no, { pensionStatus: "no" });
      asked.push("pensionStatus");
    }
    const pot = band(POT_BANDS, a.pot);
    if (pot) {
      const known = pot.figure ?? estimatePensionPot({ ...d, ...patch });
      patch.potValue = known > 0 ? String(known) : "";
      if (patch.pensionStatus === "no" || d.pensionStatus === "no") patch.hasPensionPot = known > 0 ? "yes" : "no";
      if (pot.figure == null) {
        if (known > 0) items.push({ phrase: `about ${fmt(known)} in your pension, estimated from your age and pay`, field: "potValue", value: patch.potValue });
      } else if (pot.figure > 0) items.push({ phrase: `${pot.label} in your pension`, field: "potValue", value: patch.potValue });
    }
    return { ...patch, ...addAsked(d, asked), ...withEstimates(d, "pension", items) };
  },
};
