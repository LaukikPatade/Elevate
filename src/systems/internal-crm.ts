import type { Locator, RobustTarget, Step } from "../types.js";
import type { SystemDefinition } from "./definition.js";

const target = (primary: Locator, ...fallbacks: Locator[]): RobustTarget => ({ primary, fallbacks });
const role = (roleName: string, value: string): Locator => ({ strategy: "role", role: roleName, value });
const testid = (value: string): Locator => ({ strategy: "testid", value });
const css = (value: string): Locator => ({ strategy: "css", value });
const placeholder = (value: string): Locator => ({ strategy: "placeholder", value });

const loggedIn = (): Step["verify"] => ({ kind: "elementVisible", value: '[data-test="create"]' });

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
      {
        action: "type",
        target: target(testid("username"), placeholder("Username")),
        value: "{secret:username}",
      },
      {
        action: "type",
        target: target(testid("password"), placeholder("Password")),
        value: "{secret:password}",
      },
      {
        action: "click",
        target: target(testid("signin"), role("button", "Sign in")),
        verify: loggedIn(),
      },
    ],
  },
  intents: [
    {
      name: "list_tickets",
      description: "Read the open support tickets in the CRM.",
      params: [],
      mutating: false,
      build: () => [
        {
          action: "extract",
          target: target(css(".ticket"), testid("tickets")),
          value: "tickets",
        },
      ],
    },
    {
      name: "create_ticket",
      description: "Open a new support ticket. Writes to the system of record.",
      params: [
        { name: "subject", required: true, description: "One-line ticket summary." },
        { name: "priority", required: false, description: "Low | Medium | High." },
      ],
      mutating: true,
      build: () => [
        {
          action: "type",
          target: target(testid("subject"), placeholder("Subject")),
          value: "{subject}",
        },
        {
          action: "select",
          target: target(testid("priority")),
          value: "{priority}",
        },
        {
          action: "click",
          target: target(testid("create"), role("button", "Create ticket")),
          commit: true,
          verify: {
            kind: "valueEquals",
            value: "{subject}",
            target: css(".ticket:first-child .subject"),
          },
        },
      ],
    },
  ],
};
