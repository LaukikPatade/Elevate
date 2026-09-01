import type { Locator, RobustTarget, Step } from "../types.js";
import type { SystemDefinition } from "./definition.js";

const target = (primary: Locator, ...fallbacks: Locator[]): RobustTarget => ({ primary, fallbacks });
const role = (roleName: string, value: string): Locator => ({ strategy: "role", role: roleName, value });
const testid = (value: string): Locator => ({ strategy: "testid", value });
const css = (value: string): Locator => ({ strategy: "css", value });
const placeholder = (value: string): Locator => ({ strategy: "placeholder", value });

const openRow = (): Step => ({
  action: "click",
  target: target(css('.ticket:has-text("{subject}") [data-test="open"]'), testid("open")),
  verify: { kind: "elementVisible", value: '[data-test="save"]' },
});

const saveChanges = (): Step => ({
  action: "click",
  target: target(testid("save"), role("button", "Save changes")),
  commit: true,
  verify: { kind: "textVisible", value: "Changes saved" },
});

export const INTERNAL_CRM_DEMO_CREDENTIALS: Record<string, string> = {
  username: "ops",
  password: "ops-secret",
};

export const internalCrm: SystemDefinition = {
  id: "internal-crm",
  baseUrl: "http://localhost:4599",
  auth: {
    credentialKeys: ["username", "password"],
    loginSteps: [
      { action: "type", target: target(testid("username"), placeholder("Username")), value: "{secret:username}" },
      { action: "type", target: target(testid("password"), placeholder("Password")), value: "{secret:password}" },
      {
        action: "click",
        target: target(testid("signin"), role("button", "Sign in")),
        verify: { kind: "elementVisible", value: '[data-test="create"]' },
      },
    ],
  },
  intents: [
    {
      name: "list_tickets",
      description: "Read the tickets currently shown in the CRM.",
      params: [],
      mutating: false,
      build: () => [{ action: "extract", target: target(css(".ticket"), testid("tickets")), value: "tickets" }],
    },
    {
      name: "search_tickets",
      description: "Filter the ticket list by a keyword and read the matches.",
      params: [{ name: "query", required: true, description: "Text to search subjects for." }],
      mutating: false,
      build: () => [
        { action: "type", target: target(testid("search"), placeholder("Search tickets")), value: "{query}" },
        { action: "extract", target: target(css(".ticket"), testid("tickets")), value: "tickets" },
      ],
    },
    {
      name: "create_ticket",
      description: "Open a new support ticket. Writes to the system of record.",
      params: [
        { name: "subject", required: true, description: "One-line ticket summary." },
        { name: "priority", required: false, description: "Low | Medium | High." },
        { name: "assignee", required: false, description: "Unassigned | Alex Chen | Sam Ortiz | Jordan Lee." },
        { name: "category", required: false, description: "Billing | Technical | Account | Other." },
        { name: "description", required: false, description: "Longer free-text detail." },
        { name: "due", required: false, description: "Due date, YYYY-MM-DD." },
      ],
      mutating: true,
      idempotency: { kind: "textVisible", value: "{subject}" },
      build: () => [
        { action: "type", target: target(testid("subject"), placeholder("Subject")), value: "{subject}" },
        { action: "select", target: target(testid("priority")), value: "{priority}" },
        { action: "select", target: target(testid("assignee")), value: "{assignee}" },
        { action: "select", target: target(testid("category")), value: "{category}" },
        { action: "type", target: target(testid("description"), placeholder("Describe the issue")), value: "{description}" },
        { action: "type", target: target(testid("due"), placeholder("YYYY-MM-DD")), value: "{due}" },
        {
          action: "click",
          target: target(testid("create"), role("button", "Create ticket")),
          commit: true,
          verify: { kind: "valueEquals", value: "{subject}", target: css(".ticket:first-child .subject") },
        },
      ],
    },
    {
      name: "resolve_ticket",
      description: "Open a ticket by subject and mark it Resolved. Multi-view write.",
      params: [{ name: "subject", required: true, description: "Subject of the ticket to resolve." }],
      mutating: true,
      build: () => [
        openRow(),
        { action: "select", target: target(testid("status")), value: "Resolved" },
        saveChanges(),
      ],
    },
    {
      name: "assign_ticket",
      description: "Open a ticket by subject and change its assignee. Multi-view write.",
      params: [
        { name: "subject", required: true, description: "Subject of the ticket to assign." },
        { name: "assignee", required: true, description: "Unassigned | Alex Chen | Sam Ortiz | Jordan Lee." },
      ],
      mutating: true,
      build: () => [
        openRow(),
        { action: "select", target: target(testid("detail-assignee")), value: "{assignee}" },
        saveChanges(),
      ],
    },
  ],
};
