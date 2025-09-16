/* Notion schema mapping generated from your CSV exports.
   DBs: Life Domains, Projects, Tasks, Content, Journal

   How to use:
   - Read DB IDs from env (see bottom).
   - Use builders like buildProjectProperties(), buildTaskProperties(), etc.
   - Pass the returned `properties` to NOTION_CREATE_NOTION_PAGE / NOTION_UPDATE_PAGE via Composio.
*/

export type NotionText = string;

export const DB = {
  LIFE_DOMAINS: process.env.NOTION_DB_AREAS,     // "Life Domains"
  PROJECTS:     process.env.NOTION_DB_PROJECTS,  // "Projects"
  TASKS:        process.env.NOTION_DB_TASKS,     // "Tasks"
  CONTENT:      process.env.NOTION_DB_CONTENT,   // "Content"
  JOURNAL:      process.env.NOTION_DB_JOURNAL,   // "Journal"
} as const;

/** ---- LIFE DOMAINS (Name, North Star (90D), Progress, Color) ----
 * Name:        title
 * North Star:  rich_text
 * Progress:    select   (e.g., "In Progress", "Sprint")
 * Color:       select   (e.g., "Yellow", "Blue", "Purple")
 */
export const LifeDomainProps = {
  Name: "Name",
  NorthStar: "North Star (90D)",
  Progress: "Progress",
  Color: "Color",
} as const;

export function buildLifeDomainProperties(p: {
  name: string;
  northStar?: NotionText;
  progress?: string; // select
  color?: string;    // select
}) {
  return {
    [LifeDomainProps.Name]: { title: [{ text: { content: p.name } }] },
    ...(p.northStar ? { [LifeDomainProps.NorthStar]: { rich_text: [{ text: { content: p.northStar } }] } } : {}),
    ...(p.progress  ? { [LifeDomainProps.Progress]:  { select: { name: p.progress } } } : {}),
    ...(p.color     ? { [LifeDomainProps.Color]:     { select: { name: p.color } } } : {}),
  };
}

/** ---- PROJECTS (Name, Life Domains, Flagship, Status, Due, DoD, KPI, Notes, Tasks) ----
 * Name:        title
 * Life Domains: relation -> Life Domains DB (single relation)
 * Flagship:    checkbox ("Yes"/"No" in CSV; treat as boolean)
 * Status:      select   (e.g., "In Build")
 * Due:         date     (CSV like "November 10, 2025" — normalize to ISO if possible at caller)
 * DoD:         rich_text
 * KPI:         rich_text
 * Notes:       rich_text
 * Tasks:       rollup/relation (we don't set directly on create; it's derived)
 */
export const ProjectProps = {
  Name: "Name",
  LifeDomain: "Life Domains",
  Flagship: "Flagship",
  Status: "Status",
  Due: "Due",
  DoD: "DoD",
  KPI: "KPI",
  Notes: "Notes",
  // Tasks: "Tasks" // rollup; ignore on write
} as const;

export function buildProjectProperties(p: {
  name: string;
  lifeDomainId?: string;   // Notion page id from Life Domains
  flagship?: boolean | "Yes" | "No";
  status?: string;         // select
  due?: string;            // ISO date (YYYY-MM-DD or datetime)
  dod?: NotionText;
  kpi?: NotionText;
  notes?: NotionText;
}) {
  const flagshipBool =
    typeof p.flagship === "boolean" ? p.flagship :
    typeof p.flagship === "string" ? p.flagship.toLowerCase() === "yes" : undefined;

  return {
    [ProjectProps.Name]: { title: [{ text: { content: p.name } }] },
    ...(p.lifeDomainId ? { [ProjectProps.LifeDomain]: { relation: [{ id: p.lifeDomainId }] } } : {}),
    ...(flagshipBool !== undefined ? { [ProjectProps.Flagship]: { checkbox: flagshipBool } } : {}),
    ...(p.status ? { [ProjectProps.Status]: { select: { name: p.status } } } : {}),
    ...(p.due ? { [ProjectProps.Due]: { date: { start: p.due } } } : {}),
    ...(p.dod ? { [ProjectProps.DoD]: { rich_text: [{ text: { content: p.dod } }] } } : {}),
    ...(p.kpi ? { [ProjectProps.KPI]: { rich_text: [{ text: { content: p.kpi } }] } } : {}),
    ...(p.notes ? { [ProjectProps.Notes]: { rich_text: [{ text: { content: p.notes } }] } } : {}),
  };
}

/** ---- TASKS (observed columns: Name, Status, Priority?, Due, Shippable?, Notes, Project, Journal) ----
 * Name:      title
 * Project:   relation -> Projects
 * Status:    select
 * Priority:  select (if your Tasks DB has this; CSV shows Status and Due; priority inferred)
 * Due:       date
 * Shippable: checkbox (if present)
 * Notes:     rich_text
 * Journal:   relation (optional; not set on create unless provided)
 */
export const TaskProps = {
  Name: "Name",
  Project: "Project",
  Status: "Status",
  Priority: "Priority",       // add only if exists in your DB
  Due: "Due",
  Shippable: "Shippable",     // add only if exists in your DB
  Notes: "Notes",
  Journal: "Journal",         // relation, optional
} as const;

export function buildTaskProperties(p: {
  name: string;
  projectId: string;          // relation target
  status?: string;            // status field (not select)
  priority?: "P0 - Critical"|"P1 - High"|"P2 - Medium"|"P3 - Low";  // select (optional, if defined)
  due?: string;               // ISO date/datetime
  shippable?: boolean;
  notes?: NotionText;
}) {
  return {
    [TaskProps.Name]: { title: [{ text: { content: p.name } }] },
    [TaskProps.Project]: { relation: [{ id: p.projectId }] },
    // Note: Status field is a 'status' type, not 'select' type in this Notion database
    ...(p.status ? { [TaskProps.Status]: { status: { name: p.status } } } : {}),
    ...(p.priority ? { [TaskProps.Priority]: { select: { name: p.priority } } } : {}),
    ...(p.due ? { [TaskProps.Due]: { date: { start: p.due } } } : {}),
    ...(p.shippable !== undefined ? { [TaskProps.Shippable]: { checkbox: !!p.shippable } } : {}),
    ...(p.notes ? { [TaskProps.Notes]: { rich_text: [{ text: { content: p.notes } }] } } : {}),
  };
}

/** ---- CONTENT (assumed typical: Title, Type/Tags, Project, Life Domain, Date, Content) ----
 * Because CSV shows only headings, we map common fields conservatively.
 * Adjust names if your Content CSV has different column names.
 */
export const ContentProps = {
  Title: "Title",
  Type: "Type",                 // select or multi_select
  Tags: "Tags",                 // multi_select (if present)
  Project: "Project",           // relation (optional)
  LifeDomain: "Life Domains",   // relation (optional)
  Date: "Date",                 // date (optional)
  Body: "Content",              // rich_text (optional)
} as const;

export function buildContentProperties(p: {
  title: string;
  type?: string;            // select
  tags?: string[];          // multi_select
  projectId?: string;
  lifeDomainId?: string;
  date?: string;            // ISO
  body?: NotionText;
}) {
  return {
    [ContentProps.Title]: { title: [{ text: { content: p.title } }] },
    ...(p.type ? { [ContentProps.Type]: { select: { name: p.type } } } : {}),
    ...(p.tags?.length ? { [ContentProps.Tags]: { multi_select: p.tags.map(t => ({ name: t })) } } : {}),
    ...(p.projectId ? { [ContentProps.Project]: { relation: [{ id: p.projectId }] } } : {}),
    ...(p.lifeDomainId ? { [ContentProps.LifeDomain]: { relation: [{ id: p.lifeDomainId }] } } : {}),
    ...(p.date ? { [ContentProps.Date]: { date: { start: p.date } } } : {}),
    ...(p.body ? { [ContentProps.Body]: { rich_text: [{ text: { content: p.body } }] } } : {}),
  };
}

/** ---- JOURNAL (Title, Type, Content, Date, Project, Life Domain) ----
 * Title:       title
 * Type:        select ("Note","Meeting","Decision","Daily","Weekly")
 * Content:     rich_text
 * Date:        date
 * Project:     relation -> Projects
 * Life Domain: relation -> Life Domains
 */
export const JournalProps = {
  Title: "Title",
  Type: "Type",
  Content: "Content",
  Date: "Date",
  Project: "Project",
  LifeDomain: "Life Domains",
  ActionItems: "Action Items (Tasks)",
} as const;

export function buildJournalProperties(p: {
  title: string;
  type: "Note"|"Meeting"|"Decision"|"Daily"|"Weekly";
  content: NotionText;
  date?: string;              // ISO
  projectId?: string;
  lifeDomainId?: string;
  actionItemIds?: string[];   // Task IDs for action items
}) {
  return {
    [JournalProps.Title]: { title: [{ text: { content: p.title } }] },
    [JournalProps.Type]:  { select: { name: p.type } },
    [JournalProps.Content]: { rich_text: [{ text: { content: p.content } }] },
    ...(p.date ? { [JournalProps.Date]: { date: { start: p.date } } } : {}),
    ...(p.projectId ? { [JournalProps.Project]: { relation: [{ id: p.projectId }] } } : {}),
    ...(p.lifeDomainId ? { [JournalProps.LifeDomain]: { relation: [{ id: p.lifeDomainId }] } } : {}),
    ...(p.actionItemIds?.length ? { [JournalProps.ActionItems]: { relation: p.actionItemIds.map(id => ({ id })) } } : {}),
  };
}

/** ---------- Utilities ---------- */

export function ensureISO(input?: string): string | undefined {
  if (!input) return undefined;
  // If already ISO-ish, return as-is; otherwise, let caller normalize.
  return input.trim();
}

export function asRichText(s?: string) {
  return s ? [{ text: { content: s } }] : [];
}

/** ---- GOOGLE CALENDAR EVENT ----
 * Google Calendar Event structure for Composio MCP tools
 * Uses Google Calendar API event format
 */
export interface GoogleCalendarEvent {
  summary: string;           // Event title
  description?: string;      // Event description
  start: {
    dateTime: string;        // ISO 8601 format
    timeZone?: string;       // e.g., "America/New_York"
  };
  end: {
    dateTime: string;        // ISO 8601 format  
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  }>;
  location?: string;
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
}

export function buildGoogleCalendarEvent(p: {
  title: string;
  description?: string;
  startDateTime: string;     // ISO 8601
  endDateTime: string;       // ISO 8601
  timeZone?: string;
  location?: string;
  attendees?: string[];      // Array of email addresses
  reminderMinutes?: number;  // Minutes before event
}): GoogleCalendarEvent {
  return {
    summary: p.title,
    description: p.description,
    start: {
      dateTime: p.startDateTime,
      timeZone: p.timeZone || 'UTC'
    },
    end: {
      dateTime: p.endDateTime,
      timeZone: p.timeZone || 'UTC'
    },
    ...(p.location ? { location: p.location } : {}),
    ...(p.attendees?.length ? { 
      attendees: p.attendees.map(email => ({ email })) 
    } : {}),
    ...(p.reminderMinutes ? {
      reminders: {
        useDefault: false,
        overrides: [{ method: 'popup' as const, minutes: p.reminderMinutes }]
      }
    } : {})
  };
}

/** Validate presence of DB IDs early */
export function assertDbIds() {
  const missing: string[] = [];
  if (!DB.LIFE_DOMAINS) missing.push("NOTION_DB_AREAS (Life Domains)");
  if (!DB.PROJECTS)     missing.push("NOTION_DB_PROJECTS");
  if (!DB.TASKS)        missing.push("NOTION_DB_TASKS");
  if (!DB.JOURNAL)      missing.push("NOTION_DB_JOURNAL");
  if (!DB.CONTENT)      missing.push("NOTION_DB_CONTENT");
  if (missing.length) {
    throw new Error("Missing Notion DB env vars: " + missing.join(", "));
  }
}

/** Validate Google Calendar ID */
export function assertGoogleCalendarId() {
  if (!process.env.GOOGLE_CALENDAR_ID) {
    throw new Error("Missing GOOGLE_CALENDAR_ID environment variable");
  }
  return process.env.GOOGLE_CALENDAR_ID;
}