// The £100k tax trap's quick start (quickStart.js), asked in the Chat tab:
// pay in bands fine enough around £100,000 to place them in the trap, a
// bonus, what they pay into a pension and how, and children under 12 (for
// the childcare that stops over £100,000). Each writes the same fields as
// the module's own walk-through (moduleGuide.js TAX_TRAP_QUESTIONS), and is
// asked only when that field is still empty. Unit tested in
// taxTrapQuick.test.js.
import { withEstimates, addAsked } from "./quickStart.js";
import { LEGAL_MIN_YOU } from "./pensionQuick.js";

// Narrower than SALARY_BANDS near the line, where £10k changes the answer.
export const TRAP_SALARY_BANDS = [
  { value:"u80", label:"Under £80k", figure:70000 },
  { value:"80-90", label:"£80k to £90k", figure:85000 },
  { value:"90-100", label:"£90k to £100k", figure:95000 },
  { value:"100-110", label:"£100k to £110k", figure:105000 },
  { value:"110-125", label:"£110k to £125k", figure:117500 },
  { value:"125+", label:"Over £125k", figure:140000 },
];
export const BONUS_BANDS = [
  { value:"none", label:"No bonus", figure:0 },
  { value:"u5", label:"Under £5k", figure:2500 },
  { value:"5-15", label:"£5k to £15k", figure:10000 },
  { value:"15-30", label:"£15k to £30k", figure:22500 },
  { value:"30+", label:"Over £30k", figure:40000 },
];
export const UNDER_12_CHOICES = [
  { value:"0", label:"None" }, { value:"1", label:"1" }, { value:"2", label:"2" }, { value:"3", label:"3 or more" },
];

const band = (list, value) => list.find(b => b.value === value);
const blank = v => v == null || v === "";
const employmentOf = ({ d, a }) => a.employment || d.employmentStatus;
const paysIn = ({ d, a }) => (a.payIn || d.pensionStatus) === "yes";

export const TAX_TRAP_QUICK = {
  module: "taxTrap",
  intro: { title: "£100k tax trap", subtitle: "Between £100,000 and £125,140, each extra £1 can cost 60p or more in tax.", question: "Where does your pay sit?" },
  order: ["employment", "salary", "bonus", "payIn", "mine", "route", "under12", "preschool"],
  questions: {
    employment: {
      ask: "Are you employed or self-employed?", why: "The self-employed pay into a pension from take-home pay, which changes the sums.",
      options: () => [{ value:"employed", label:"Employed" }, { value:"self_employed", label:"Self-employed" }],
      when: ({ d }) => !d.employmentAsked && !(+d.salary > 0),
    },
    salary: {
      ask: ({ d, a }) => employmentOf({ d, a }) === "self_employed" ? "Roughly what do you earn a year, before tax?" : "Roughly what's your salary, before tax?",
      why: "The trap starts at £100,000 of adjusted net income.",
      options: () => TRAP_SALARY_BANDS,
      default: () => "100-110",
      when: ({ d }) => !(+d.salary > 0),
    },
    bonus: {
      ask: "Do you get a bonus? Roughly how much a year?", why: "A bonus counts towards the £100,000 in the year it's paid.",
      options: () => BONUS_BANDS,
      when: ({ d }) => d.hasExtraIncome == null && ![d.bonusAmount, d.dividendIncome, d.otherIncome].some(v => +v > 0),
    },
    payIn: {
      ask: "Do you pay into a pension?", why: "What goes in comes off the figure HMRC checks against £100,000.",
      options: () => [
        { value:"yes", label:"Yes" }, { value:"db", label:"Final salary", sub:"NHS, teachers, civil service" },
        { value:"no", label:"No" }, { value:"unsure", label:"Not sure" },
      ],
      when: ({ d }) => blank(d.pensionStatus),
    },
    mine: {
      kind: "slider", ask: "What share of your pay goes in?", why: "Your payslip shows it.",
      min: 1, max: 30, start: () => LEGAL_MIN_YOU,
      when: ctx => paysIn(ctx) && !(+ctx.d.myContribution > 0),
    },
    route: {
      ask: "Does it come out before tax, or from take-home pay?", why: "Before tax (salary sacrifice) saves National Insurance as well.",
      options: () => [{ value:"sacrifice", label:"Before tax", sub:"Salary sacrifice" }, { value:"relief", label:"Take-home pay", sub:"Relief at source" }, { value:"unsure", label:"Not sure" }],
      when: ctx => paysIn(ctx) && employmentOf(ctx) !== "self_employed" && blank(ctx.d.pensionType),
    },
    under12: {
      ask: "How many children under 12 do you have?", why: "Tax-Free Childcare and funded hours stop at £100,000.",
      options: () => UNDER_12_CHOICES,
      when: ({ d }) => blank(d.kidsStatus),
    },
    preschool: {
      ask: ({ a }) => a.under12 === "1" ? "Have they started school yet?" : "Have they all started school?",
      why: "Funded hours are for children not yet at school.",
      options: () => [{ value:"no", label:"Not yet" }, { value:"yes", label:"Yes" }],
      when: ({ a }) => +a.under12 > 0,
    },
  },
  patch(d, m, a) {
    const patch = {}, items = [], asked = [];
    if (a.employment) Object.assign(patch, { employmentStatus: a.employment, employmentAsked: true });
    const salary = band(TRAP_SALARY_BANDS, a.salary);
    if (salary) {
      patch.salary = String(salary.figure);
      items.push({ phrase: `${salary.label} salary`, field: "salary", value: patch.salary });
    }
    const bonus = band(BONUS_BANDS, a.bonus);
    if (bonus) {
      Object.assign(patch, bonus.figure > 0
        ? { hasExtraIncome: "yes", extraIncomeKinds: ["bonus"], bonusAmount: String(bonus.figure) }
        : { hasExtraIncome: "no", extraIncomeKinds: ["none"] });
      if (bonus.figure > 0) items.push({ phrase: `a bonus of ${bonus.label.toLowerCase()}`, field: "bonusAmount", value: patch.bonusAmount });
    }
    if (a.payIn) {
      // As the module's own pension question sets them (moduleGuide.js).
      Object.assign(patch, { pensionStatus: a.payIn },
        a.payIn === "unsure" ? { pensionUnknown: true, pensionKind: "" }
          : a.payIn === "db" ? { pensionUnknown: false, hasPension: "yes", pensionKind: "db" }
          : { pensionUnknown: false, hasPension: a.payIn, pensionKind: a.payIn === "yes" ? "dc" : "" });
      asked.push("pensionStatus");
    }
    if (a.mine) {
      patch.myContribution = String(a.mine === "unsure" ? LEGAL_MIN_YOU : a.mine);
      if (a.mine === "unsure") items.push({ phrase: `you paying in ${LEGAL_MIN_YOU}%, the legal minimum`, field: "myContribution", value: patch.myContribution });
    }
    if (a.route) patch.pensionType = a.route === "unsure" ? "" : a.route;
    if (a.under12) {
      const n = +a.under12;
      if (n > 0) {
        // "Not yet" puts one child before school (all of them, for one
        // child); the rest at school. An estimate either way.
        const pre = a.preschool === "no" ? 1 : 0;
        Object.assign(patch, { kidsStatus: "yes", kidsCount: String(n), kidsPreschool: String(pre), kidsSchool: String(n - pre) });
        if (n > 1 && pre) items.push({ phrase: "one child not yet at school", field: "kidsPreschool", value: patch.kidsPreschool });
      } else patch.kidsStatus = "no";
    }
    return { ...patch, ...addAsked(d, asked), ...withEstimates(d, "taxTrap", items) };
  },
};
