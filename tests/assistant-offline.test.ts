import { describe, expect, it } from "vitest";
import { offlineAnswer } from "@/features/assistant/offline";
import { assistantLinks } from "@/features/assistant/links";

const allowed = new Set(assistantLinks().map((l) => l.path));
const linksIn = (text: string) => [...text.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);

/** [question, expected intent] — the many ways visitors actually ask. */
const INTENTS: [string, string][] = [
  // greetings & thanks
  ["hi", "greeting"], ["Hello!", "greeting"], ["hey there", "greeting"], ["namaste", "greeting"], ["good morning", "greeting"], ["hii", "greeting"],
  ["thanks", "thanks"], ["thank you!", "thanks"], ["ok great", "thanks"], ["bye", "thanks"], ["shukriya", "thanks"],
  // about Azad with no topic → overview
  ["what azad does", "services"], ["azad", "overview"], ["azad?", "overview"], ["tell me about him", "about"], ["what does he do", "services"],
  ["what do you do", "services"], ["What does Azad do?", "services"], ["what can azad do", "services"], ["what is azad's work", "services"],
  ["azad kya karte hai", "services"], ["azad kya kaam karta hai", "services"], ["what you offer", "services"],
  // who
  ["who is azad", "about"], ["who are you", "about"], ["Who is Azad Kumar Jha?", "about"], ["introduce yourself", "about"], ["azad kaun hai", "about"], ["tell me about azad", "about"],
  // services
  ["what services do you offer?", "services"], ["services", "services"], ["what are your services", "services"], ["how can you help me", "services"],
  ["what's your expertise", "services"], ["servises", "services"], ["what solutions do you provide", "services"],
  // projects
  ["Show me your projects", "projects"], ["projects", "projects"], ["portfolio", "projects"], ["any case studies?", "projects"], ["what have you built", "projects"],
  ["projets", "projects"], ["previous work examples", "projects"],
  // demos
  ["Which demos can I try?", "demos"], ["demos", "demos"], ["can i try something live", "demos"], ["show me a demo", "demos"],
  // clients
  ["Which companies has Azad worked with?", "clients"], ["clients", "clients"], ["who are your customers", "clients"], ["companies you worked with", "clients"],
  // experience & education
  ["what is his experience?", "experience"], ["experience", "experience"], ["experiance", "experience"], ["career background", "experience"], ["resume", "experience"],
  ["where did he study", "education"], ["education", "education"], ["which college", "education"], ["degree?", "education"],
  // skills & industries
  ["what skills does he have", "skills"], ["skills", "skills"], ["what are you good at", "skills"],
  ["which industries do you work with", "industries"], ["sectors", "industries"], ["what domains", "industries"],
  // pricing
  ["how much do you charge?", "pricing"], ["pricing", "pricing"], ["what's your rate", "pricing"], ["cost of a chatbot", "pricing"], ["kitna paisa lagega", "pricing"],
  ["is it expensive", "pricing"], ["prise", "pricing"], ["what is the budget for automation", "pricing"],
  // contact / hiring / profiles
  ["How can I contact him?", "contact"], ["contact", "contact"], ["email?", "contact"], ["phone number", "contact"], ["how do i reach azad", "contact"],
  ["can we book a meeting", "contact"], ["contcat", "contact"], ["whatsapp number", "contact"], ["i want to talk to azad", "contact"],
  ["are you available for freelance", "hiring"], ["can i hire you", "hiring"], ["are you open to full time roles", "hiring"], ["looking for a freelancer", "hiring"],
  ["github", "profiles"], ["linkedin profile?", "profiles"],
  // location
  ["where is he based", "location"], ["location", "location"], ["do you work remotely", "location"], ["azad kahan se hai", "location"],
  // process, timeline, ownership, languages
  ["how do you work", "process"], ["what is your process", "process"], ["how does a project start", "process"], ["what happens after I contact you", "process"],
  ["how long does it take", "timeline"], ["how soon can we see results", "timeline"], ["timeline for a project", "timeline"],
  ["who owns the code", "ownership"], ["will it reply in hindi", "languages"], ["will it sound like a robot", "robotic"],
  // confidential
  ["what LLM do you use?", "confidential"], ["which model powers the chatbot", "confidential"], ["what is your tech stack", "confidential"],
  ["how is it built", "confidential"], ["do you use chatgpt", "confidential"], ["what's under the hood", "confidential"],
  // named topics → search
  ["tell me about the voice agent", "search"], ["lidar camera calibration", "search"], ["Does he do computer vision?", "search"],
  ["Can you automate our invoice processing?", "search"], ["do you build whatsapp chatbots for clinics", "search"], ["ops suite", "search"],
  ["what is docdesk", "search"], ["autopilot demo", "search"], ["slam navigation", "search"], ["edge ai", "search"], ["document intelligence", "search"],
  ["ai evaluation", "search"], ["data analytics", "search"], ["robotics", "search"], ["computer vision projects", "search"],
  // off topic
  ["what's the weather today", "unknown"], ["who won the cricket match", "unknown"], ["write me a poem about cats", "unknown"],
];

describe("chat quick answers (no AI): intents", () => {
  it.each(INTENTS)("%s → %s", (q, intent) => {
    expect(offlineAnswer(q).intent).toBe(intent);
  });
});

/** Named topics land on the right page. */
const TOPICS: [string, RegExp][] = [
  ["tell me about the voice agent", /voice/i],
  ["lidar camera calibration", /LiDAR/],
  ["Does he do computer vision?", /Computer Vision/],
  ["Can you automate our invoice processing?", /document|invoice/i],
  ["do you build whatsapp chatbots for clinics", /clinic/i],
  ["ops suite", /Ops Suite/],
  ["what is docdesk", /DocDesk/],
  ["autopilot demo", /Autopilot/],
  ["slam navigation", /SLAM|navigation/i],
  ["document intelligence", /Document/],
  ["ai evaluation", /Evaluation/],
  ["computer vision projects", /vision|perception|LiDAR|SurroundSense/i],
  ["surroundsense", /SurroundSense|360/i],
  ["trolley pose estimation", /pose|trolley/i],
  ["customer support chatbot", /support/i],
  ["can you automate whatsapp replies", /WhatsApp/i],
];

describe("chat quick answers: topics", () => {
  it.each(TOPICS)("%s", (q, re) => {
    expect(offlineAnswer(q).text).toMatch(re);
  });
});

describe("chat quick answers: behaviour", () => {
  it("says so instead of guessing when the site doesn't cover it", () => {
    const a = offlineAnswer("what's the weather today");
    expect(a.route).toBe("off_topic");
    expect(a.text).toMatch(/couldn't find that/i);
  });

  it("never reveals how things are built", () => {
    for (const q of ["what LLM do you use?", "which model powers the chatbot", "what is your tech stack architecture", "do you use python"]) {
      const a = offlineAnswer(q);
      expect(a.route).toBe("handoff");
      expect(a.text).toMatch(/private/);
      expect(a.text).not.toMatch(/groq|gemini|openai|claude|llama|fastapi|next\.js|postgres/i);
    }
  });

  it("only links to allow-listed pages, and reports them as sources", () => {
    for (const [q] of [...INTENTS, ...TOPICS]) {
      const a = offlineAnswer(q);
      for (const href of linksIn(a.text)) expect(allowed.has(href), `${q} → ${href}`).toBe(true);
      expect(a.sources.map((s) => s.path).sort()).toEqual([...new Set(linksIn(a.text))].sort());
    }
  });

  it("refers to Azad by name, never he/she", () => {
    for (const [q] of INTENTS) expect(offlineAnswer(q).text, q).not.toMatch(/\b(he|she|his|her)\b/i);
  });

  it("voice channel gets plain text (no markdown)", () => {
    const a = offlineAnswer("show me your projects", { voice: true });
    expect(a.text).not.toMatch(/\]\(|\*\*/);
  });

  it("follow-ups continue the previous question", () => {
    expect(offlineAnswer("tell me more", { previous: "lidar camera calibration" }).text).toMatch(/LiDAR/);
    expect(offlineAnswer("and the lidar one?", { previous: "tell me about your computer vision projects" }).text).toMatch(/LiDAR/);
    expect(offlineAnswer("more", {}).intent).toBe("follow-up");
  });
});

describe("chat quick answers: FAQ wording fits the question", () => {
  it("language questions get a yes, the robot question keeps its own answer", () => {
    expect(offlineAnswer("will it reply in hindi").text).toMatch(/^Yes\. .*Hindi/);
    expect(offlineAnswer("will it sound like a robot").text).toMatch(/^No\./);
  });
});
