import {
  DB,
  buildProjectProperties,
  buildTaskProperties,
  buildJournalProperties,
  buildContentProperties,
  assertDbIds,
  assertGoogleCalendarId,
  type NotionText,
  TaskProps,
  ProjectProps,
  ContentProps,
  JournalProps,
} from './notion-mapping';
import { callTool } from './mcp/client';
import { z } from 'zod';

// Result types for graceful error handling
type ActionResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
  missingFields?: string[];
};

// Helper function to search for tasks by name (fuzzy matching)
async function findTaskByName(taskName: string): Promise<string | null> {
  try {
    console.log(`Searching for task: "${taskName}"`);
    console.log(`DB.TASKS = "${DB.TASKS}"`);
    
    const searchResult = await callTool('NOTION_SEARCH_NOTION_PAGE', {
      query: taskName,
      filter: 'page'
    });

    if (searchResult.isError || !searchResult.content || !Array.isArray(searchResult.content)) {
      return null;
    }

    const normalizedQuery = taskName.toLowerCase().trim();
    let bestMatch: { id: string; score: number } | null = null;

    // Parse the search results to find the best matching task
    for (const item of searchResult.content) {
      if (item.type === 'text') {
        try {
          const data = JSON.parse(item.text);
          if (data.data?.response_data?.results && Array.isArray(data.data.response_data.results)) {
            for (const result of data.data.response_data.results) {
              console.log(`Checking task result: ${result.id}, object: ${result.object}, parent DB: ${result.parent?.database_id}, expected DB: ${DB.TASKS}`);
              if (result.object === 'page' && result.parent?.database_id === DB.TASKS) {
                const taskTitle = result.properties?.Name?.title?.[0]?.plain_text;
                if (taskTitle) {
                  const normalizedTitle = taskTitle.toLowerCase().trim();
                  
                  console.log(`Comparing "${normalizedQuery}" with "${normalizedTitle}"`);
                  
                  let score = 0;
                  if (normalizedTitle === normalizedQuery) {
                    score = 100;
                  } else if (normalizedTitle.includes(normalizedQuery)) {
                    score = 80;
                  } else if (normalizedQuery.includes(normalizedTitle)) {
                    score = 70;
                  } else {
                    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
                    const titleWords = normalizedTitle.split(/\s+/).filter(w => w.length > 0);
                    let matchingWords = 0;
                    
                    for (const queryWord of queryWords) {
                      for (const titleWord of titleWords) {
                        if (queryWord === titleWord || 
                            queryWord.includes(titleWord) || 
                            titleWord.includes(queryWord)) {
                          matchingWords++;
                          break;
                        }
                      }
                    }
                    
                    if (matchingWords > 0) {
                      score = (matchingWords / Math.max(queryWords.length, titleWords.length)) * 60;
                    }
                  }
                  
                  console.log(`Task "${taskTitle}" scored ${score}`);
                  
                  if (score > 0 && (!bestMatch || score > bestMatch.score)) {
                    bestMatch = { id: result.id, score };
                  }
                }
              }
            }
          }
        } catch (parseError) {
          console.error('Error parsing task search result:', parseError);
        }
      }
    }
    
    console.log(`Final task bestMatch:`, bestMatch);
    const result = bestMatch && bestMatch.score >= 50 ? bestMatch.id : null;
    console.log(`Returning task ID:`, result);
    return result;
  } catch (error) {
    console.error('Error searching for task:', error);
    return null;
  }
}

// Helper function to search for calendar events by name (fuzzy matching)
async function findCalendarEventByName(eventName: string): Promise<string | null> {
  try {
    console.log(`Searching for calendar event: "${eventName}"`);

    // Search for events in the next 30 days
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const searchResult = await listCalendarEvents({
      timeMin: now.toISOString(),
      timeMax: thirtyDaysFromNow.toISOString(),
      maxResults: 50
    });

    if (!searchResult.success || !searchResult.data) {
      console.log('No calendar events found or search failed');
      return null;
    }

    const normalizedQuery = eventName.toLowerCase().trim();
    let bestMatch: { id: string; score: number } | null = null;

    console.log(`Found ${searchResult.data.length} calendar events to search`);

    // Search through the events
    for (const event of searchResult.data) {
      if (event.summary && event.id) {
        const eventTitle = event.summary.toLowerCase().trim();

        // Calculate match score (higher is better)
        let score = 0;

        // Exact match gets highest score
        if (eventTitle === normalizedQuery) {
          score = 100;
        }
        // Contains query as substring
        else if (eventTitle.includes(normalizedQuery)) {
          score = 80;
        }
        // Query contains title (reverse substring)
        else if (normalizedQuery.includes(eventTitle)) {
          score = 70;
        }
        // Fuzzy word matching
        else {
          const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
          const titleWords = eventTitle.split(/\s+/).filter(w => w.length > 0);
          let matchingWords = 0;

          for (const queryWord of queryWords) {
            for (const titleWord of titleWords) {
              if (queryWord === titleWord ||
                  queryWord.includes(titleWord) ||
                  titleWord.includes(queryWord)) {
                matchingWords++;
                break;
              }
            }
          }

          if (matchingWords > 0) {
            score = (matchingWords / Math.max(queryWords.length, titleWords.length)) * 60;
          }
        }

        if (score > 50) {
          console.log(`Calendar event "${event.summary}" scored ${score}`);
        }

        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { id: event.id, score };
        }
      }
    }

    console.log(`Final calendar event bestMatch:`, bestMatch);
    const result = bestMatch && bestMatch.score >= 50 ? bestMatch.id : null;
    console.log(`Returning calendar event ID:`, result);
    return result;
  } catch (error) {
    console.error('Error searching for calendar event:', error);
    return null;
  }
}

// Helper function to search for projects by name (fuzzy matching)
async function findProjectByName(projectName: string): Promise<string | null> {
  try {
    console.log(`Searching for project: "${projectName}"`);
    console.log(`DB.PROJECTS = "${DB.PROJECTS}"`);
    console.log(`DB.TASKS = "${DB.TASKS}"`);

    const searchResult = await callTool('NOTION_QUERY_DATABASE', {
      database_id: DB.PROJECTS!
    });

    if (searchResult.isError || !searchResult.content || !Array.isArray(searchResult.content)) {
      return null;
    }

    const normalizedQuery = projectName.toLowerCase().trim();
    let bestMatch: { id: string; score: number } | null = null;

    // Parse the query results to find the best matching project
    console.log('searchResult:', JSON.stringify(searchResult, null, 2));

    let results = [];
    if (searchResult.results && Array.isArray(searchResult.results)) {
      results = searchResult.results;
    } else if (searchResult.content && Array.isArray(searchResult.content)) {
      const textContent = searchResult.content.find((item: any) => item.type === 'text');
      if (textContent && textContent.text) {
        try {
          const data = JSON.parse(textContent.text);
          if (data.data?.response_data?.results && Array.isArray(data.data.response_data.results)) {
            results = data.data.response_data.results;
          }
        } catch (parseError) {
          console.error('Error parsing content:', parseError);
        }
      }
    }

    console.log(`Found ${results.length} projects to search through`);

    for (const result of results) {
      console.log(`Checking project: ${result.id}, name: ${result.properties?.Name?.title?.[0]?.plain_text}`);
      if (result.object === 'page' && result.parent?.database_id === DB.PROJECTS) {
        const projectTitle = result.properties?.Name?.title?.[0]?.plain_text;
        if (projectTitle) {
          const normalizedTitle = projectTitle.toLowerCase().trim();

          console.log(`Comparing "${normalizedQuery}" with "${normalizedTitle}"`);

          // Calculate match score (higher is better)
          let score = 0;

          // Exact match gets highest score
          if (normalizedTitle === normalizedQuery) {
            score = 100;
          }
          // Contains query as substring
          else if (normalizedTitle.includes(normalizedQuery)) {
            score = 80;
          }
          // Query contains title (reverse substring)
          else if (normalizedQuery.includes(normalizedTitle)) {
            score = 70;
          }
          // Fuzzy word matching
          else {
            const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
            const titleWords = normalizedTitle.split(/\s+/).filter(w => w.length > 0);
            let matchingWords = 0;

            for (const queryWord of queryWords) {
              for (const titleWord of titleWords) {
                if (queryWord === titleWord ||
                    queryWord.includes(titleWord) ||
                    titleWord.includes(queryWord)) {
                  matchingWords++;
                  break;
                }
              }
            }

            if (matchingWords > 0) {
              score = (matchingWords / Math.max(queryWords.length, titleWords.length)) * 60;
            }
          }

          console.log(`Project "${projectTitle}" scored ${score}`);

          if (score > 0 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { id: result.id, score };
          }
        }
      }
    }
    
    // Return best match if score is reasonable (>= 50)
    console.log(`Final bestMatch:`, bestMatch);
    const result = bestMatch && bestMatch.score >= 50 ? bestMatch.id : null;
    console.log(`Returning project ID:`, result);
    return result;
  } catch (error) {
    console.error('Error searching for project:', error);
    return null;
  }
}

type NotionActionPayload = {
  properties: Record<string, any>;
  database_id: string;
};

type NotionUpdatePayload = {
  page_id: string;
  properties: Record<string, any>;
};

// Helper function for graceful validation
function validateRequired<T extends Record<string, any>>(
  data: T,
  requiredFields: (keyof T)[]
): ActionResult<T> {
  const missing = requiredFields.filter(field => !data[field]);
  if (missing.length > 0) {
    return {
      success: false,
      error: `Missing required fields: ${missing.join(', ')}`,
      missingFields: missing as string[]
    };
  }
  return { success: true, data };
}

// Create Project Action
export function createProject(params: {
  name: string;
  lifeDomainId?: string;
  flagship?: boolean | "Yes" | "No";
  status?: string;
  due?: string;
  dod?: NotionText;
  kpi?: NotionText;
  notes?: NotionText;
}): ActionResult<NotionActionPayload> {
  try {
    assertDbIds();
    
    const validation = validateRequired(params, ['name']);
    if (!validation.success) return validation;

    const properties = buildProjectProperties(params);
    
    return {
      success: true,
      data: {
        properties,
        database_id: DB.PROJECTS!
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Create Task Action  
export async function createTask(params: {
  name: string;
  projectId?: string;
  projectName?: string;
  status?: string;
  priority?: "P0 - Critical" | "P1 - High" | "P2 - Medium" | "P3 - Low";
  due?: string;
  shippable?: boolean;
  notes?: NotionText;
}): Promise<ActionResult<NotionActionPayload>> {
  try {
    assertDbIds();
    
    // Validate all mandatory fields for task creation
    const validation = validateRequired(params, ['name', 'status', 'priority', 'due']);
    if (!validation.success) return validation;

    // Resolve project ID if project name is provided
    let resolvedProjectId = params.projectId;
    
    if (!resolvedProjectId && params.projectName) {
      resolvedProjectId = await findProjectByName(params.projectName);
      if (!resolvedProjectId) {
        return {
          success: false,
          error: `Could not find a project matching "${params.projectName}". Please check the project name or provide a specific project ID.`,
          missingFields: ['projectId']
        };
      }
    }

    if (!resolvedProjectId) {
      return {
        success: false,
        error: 'Either projectId or projectName must be provided',
        missingFields: ['projectId']
      };
    }

    // Validate that project requirement is also met
    const projectValidation = validateRequired({ projectId: resolvedProjectId }, ['projectId']);
    if (!projectValidation.success) return projectValidation;

    const properties = buildTaskProperties({
      ...params,
      projectId: resolvedProjectId
    });
    
    return {
      success: true,
      data: {
        properties,
        database_id: DB.TASKS!
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Log Note (Journal) Action
export async function logNote(params: {
  title: string;
  type: "Note" | "Idea" | "Research";
  content?: NotionText;
  date?: string;
  projectId?: string;
  projectName?: string;
  lifeDomainId?: string;
  actionItemIds?: string[];
  taskNames?: string[];
}): Promise<ActionResult<NotionActionPayload & { content?: string }>> {
  try {
    console.log('logNote called with params:', params);
    assertDbIds();
    console.log('DB.JOURNAL:', DB.JOURNAL);

    const validation = validateRequired(params, ['title', 'type']);
    if (!validation.success) {
      console.log('Validation failed:', validation);
      return validation;
    }

    // Resolve project ID if project name is provided
    let resolvedProjectId = params.projectId;

    if (!resolvedProjectId && params.projectName) {
      resolvedProjectId = await findProjectByName(params.projectName);
      if (!resolvedProjectId) {
        return {
          success: false,
          error: `Could not find a project matching "${params.projectName}". Please check the project name or provide a specific project ID.`,
          missingFields: ['projectId']
        };
      }
    }

    // Resolve task IDs if task names are provided
    let resolvedActionItemIds = params.actionItemIds || [];

    if (params.taskNames && params.taskNames.length > 0) {
      for (const taskName of params.taskNames) {
        const taskId = await findTaskByName(taskName);
        if (taskId) {
          resolvedActionItemIds.push(taskId);
        } else {
          console.warn(`Could not find task matching "${taskName}"`);
        }
      }
    }

    const properties = buildJournalProperties({
      ...params,
      projectId: resolvedProjectId,
      actionItemIds: resolvedActionItemIds.length > 0 ? resolvedActionItemIds : undefined
    });

    console.log('Built journal properties:', properties);
    console.log('Returning logNote result with database_id:', DB.JOURNAL);

    return {
      success: true,
      data: {
        properties,
        database_id: DB.JOURNAL!,
        content: params.content
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Create Content Action
export function createContent(params: {
  title: string;
  type?: string;
  tags?: string[];
  projectId?: string;
  lifeDomainId?: string;
  date?: string;
  body?: NotionText;
}): ActionResult<NotionActionPayload> {
  try {
    assertDbIds();
    
    const validation = validateRequired(params, ['title']);
    if (!validation.success) return validation;

    const properties = buildContentProperties(params);
    
    return {
      success: true,
      data: {
        properties,
        database_id: DB.CONTENT!
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Action name mapping from LLM output to internal handlers (MCP server names as gold standard)
const ACTION_NAME_MAP: Record<string, string> = {
  // LLM action names -> Internal handler names (keeping current naming)
  'createProject': 'createProject',
  'createTask': 'createTask',
  'logNote': 'logNote',
  'createContent': 'createContent',
  'updateTask': 'updateTask',
  'updateProject': 'updateProject',
  'updateContent': 'updateContent',
  'updateJournal': 'updateJournal',
  'createCalendarEvent': 'createCalendarEvent',
  'updateCalendarEvent': 'updateCalendarEvent',
  'deleteCalendarEvent': 'deleteCalendarEvent',
  'listCalendarEvents': 'listCalendarEvents',
  // Alternative naming styles that LLM might produce
  'create_project': 'createProject',
  'create_task': 'createTask',
  'log_note': 'logNote',
  'create_content': 'createContent',
  'update_task': 'updateTask',
  'update_project': 'updateProject',
  'update_content': 'updateContent',
  'update_journal': 'updateJournal',
  'create_calendar_event': 'createCalendarEvent',
  'schedule_event': 'createCalendarEvent',
  'update_calendar_event': 'updateCalendarEvent',
  'delete_calendar_event': 'deleteCalendarEvent',
  'list_calendar_events': 'listCalendarEvents',
  // Snake case variations
  'NOTION_CREATE_NOTION_PAGE': 'createProject', // MCP names that might leak through
  'NOTION_UPDATE_PAGE': 'updateTask',
  'GOOGLECALENDAR_CREATE_EVENT': 'createCalendarEvent',
  'GOOGLECALENDAR_UPDATE_EVENT': 'updateCalendarEvent',
  'GOOGLECALENDAR_DELETE_EVENT': 'deleteCalendarEvent',
  'GOOGLECALENDAR_EVENTS_LIST': 'listCalendarEvents'
};

// Zod schema for validating LLM responses
const ActionSchema = z.object({
  action: z.string(),
  params: z.record(z.string(), z.any())
});

// Parsed action type with normalized action names
type ParsedAction = {
  action: 'createProject' | 'createTask' | 'logNote' | 'createContent' | 'updateTask' | 'updateProject' | 'updateContent' | 'updateJournal' | 'createCalendarEvent' | 'updateCalendarEvent' | 'deleteCalendarEvent' | 'listCalendarEvents';
  params: Record<string, any>;
};

// Parse LLM response to extract action and parameters with Zod validation and name normalization
export function parseAction(llmResponse: string): ActionResult<ParsedAction> {
  try {
    // Try to parse as JSON first
    let parsed: any;
    try {
      parsed = JSON.parse(llmResponse);
    } catch {
      // If not JSON, try to extract JSON from text
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return {
          success: false,
          error: 'No valid JSON found in LLM response'
        };
      }
    }

    // Validate basic structure (temporary fallback while debugging Zod)
    if (!parsed.action || typeof parsed.action !== 'string') {
      return {
        success: false,
        error: 'Missing or invalid "action" field'
      };
    }

    if (!parsed.params || typeof parsed.params !== 'object') {
      return {
        success: false,
        error: 'Missing or invalid "params" field'
      };
    }

    const { action: rawAction, params } = parsed;

    // Normalize action name using the mapping
    const normalizedAction = ACTION_NAME_MAP[rawAction];
    if (!normalizedAction) {
      return {
        success: false,
        error: `Unknown action "${rawAction}". Supported actions: ${Object.keys(ACTION_NAME_MAP).join(', ')}`
      };
    }

    return {
      success: true,
      data: {
        action: normalizedAction as ParsedAction['action'],
        params
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse LLM response'
    };
  }
}

// Update Task Action
export async function updateTask(params: {
  taskId?: string;
  taskName?: string;
  name?: string;
  projectId?: string;
  status?: string;
  priority?: "P0 - Critical" | "P1 - High" | "P2 - Medium" | "P3 - Low";
  due?: string;
  shippable?: boolean;
  notes?: NotionText;
  journalId?: string;
}): Promise<ActionResult<NotionUpdatePayload>> {
  try {
    // Resolve task ID if task name is provided
    let resolvedTaskId = params.taskId;
    
    if (!resolvedTaskId && params.taskName) {
      resolvedTaskId = await findTaskByName(params.taskName);
      if (!resolvedTaskId) {
        return {
          success: false,
          error: `Could not find a task matching "${params.taskName}". Please check the task name or provide a specific task ID.`,
          missingFields: ['taskId']
        };
      }
    }

    if (!resolvedTaskId) {
      return {
        success: false,
        error: 'Either taskId or taskName must be provided',
        missingFields: ['taskId']
      };
    }

    // Build only the properties that are being updated
    const updateProperties: Record<string, any> = {};
    
    if (params.name) {
      updateProperties[TaskProps.Name] = { title: [{ text: { content: params.name } }] };
    }
    if (params.projectId) {
      updateProperties[TaskProps.Project] = { relation: [{ id: params.projectId }] };
    }
    if (params.status) {
      updateProperties[TaskProps.Status] = { status: { name: params.status } };
    }
    if (params.priority) {
      updateProperties[TaskProps.Priority] = { select: { name: params.priority } };
    }
    if (params.due) {
      updateProperties[TaskProps.Due] = { date: { start: params.due } };
    }
    if (params.shippable !== undefined) {
      updateProperties[TaskProps.Shippable] = { checkbox: !!params.shippable };
    }
    if (params.notes) {
      updateProperties[TaskProps.Notes] = { rich_text: [{ text: { content: params.notes } }] };
    }
    if (params.journalId) {
      updateProperties[TaskProps.Journal] = { relation: [{ id: params.journalId }] };
    }

    return {
      success: true,
      data: {
        page_id: resolvedTaskId,
        properties: updateProperties
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Update Project Action
export function updateProject(params: {
  projectId: string;
  name?: string;
  lifeDomainId?: string;
  flagship?: boolean | "Yes" | "No";
  status?: string;
  due?: string;
  dod?: NotionText;
  kpi?: NotionText;
  notes?: NotionText;
}): ActionResult<NotionUpdatePayload> {
  try {
    const validation = validateRequired(params, ['projectId']);
    if (!validation.success) return validation;

    const updateProperties: Record<string, any> = {};

    if (params.name) {
      updateProperties[ProjectProps.Name] = { title: [{ text: { content: params.name } }] };
    }
    if (params.lifeDomainId) {
      updateProperties[ProjectProps.LifeDomain] = { relation: [{ id: params.lifeDomainId }] };
    }
    if (params.flagship !== undefined) {
      const flagshipBool =
        typeof params.flagship === "boolean" ? params.flagship :
        typeof params.flagship === "string" ? params.flagship.toLowerCase() === "yes" : undefined;
      if (flagshipBool !== undefined) {
        updateProperties[ProjectProps.Flagship] = { checkbox: flagshipBool };
      }
    }
    if (params.status) {
      updateProperties[ProjectProps.Status] = { select: { name: params.status } };
    }
    if (params.due) {
      updateProperties[ProjectProps.Due] = { date: { start: params.due } };
    }
    if (params.dod) {
      updateProperties[ProjectProps.DoD] = { rich_text: [{ text: { content: params.dod } }] };
    }
    if (params.kpi) {
      updateProperties[ProjectProps.KPI] = { rich_text: [{ text: { content: params.kpi } }] };
    }
    if (params.notes) {
      updateProperties[ProjectProps.Notes] = { rich_text: [{ text: { content: params.notes } }] };
    }

    return {
      success: true,
      data: {
        page_id: params.projectId,
        properties: updateProperties
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Update Content Action
export function updateContent(params: {
  contentId: string;
  title?: string;
  type?: string;
  tags?: string[];
  projectId?: string;
  lifeDomainId?: string;
  date?: string;
  body?: NotionText;
}): ActionResult<NotionUpdatePayload> {
  try {
    const validation = validateRequired(params, ['contentId']);
    if (!validation.success) return validation;

    const updateProperties: Record<string, any> = {};

    if (params.title) {
      updateProperties[ContentProps.Title] = { title: [{ text: { content: params.title } }] };
    }
    if (params.type) {
      updateProperties[ContentProps.Type] = { select: { name: params.type } };
    }
    if (params.tags?.length) {
      updateProperties[ContentProps.Tags] = { multi_select: params.tags.map(t => ({ name: t })) };
    }
    if (params.projectId) {
      updateProperties[ContentProps.Project] = { relation: [{ id: params.projectId }] };
    }
    if (params.lifeDomainId) {
      updateProperties[ContentProps.LifeDomain] = { relation: [{ id: params.lifeDomainId }] };
    }
    if (params.date) {
      updateProperties[ContentProps.Date] = { date: { start: params.date } };
    }
    if (params.body) {
      updateProperties[ContentProps.Body] = { rich_text: [{ text: { content: params.body } }] };
    }

    return {
      success: true,
      data: {
        page_id: params.contentId,
        properties: updateProperties
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Update Journal Entry Action
export async function updateJournal(params: {
  journalId: string;
  title?: string;
  type?: "Note"|"Idea"|"Research";
  content?: NotionText;
  date?: string;
  projectId?: string;
  projectName?: string;
  lifeDomainId?: string;
  actionItemIds?: string[];
  taskNames?: string[];
}): Promise<ActionResult<NotionUpdatePayload>> {
  try {
    const validation = validateRequired(params, ['journalId']);
    if (!validation.success) return validation;

    // Resolve project ID if project name is provided
    let resolvedProjectId = params.projectId;

    if (!resolvedProjectId && params.projectName) {
      resolvedProjectId = await findProjectByName(params.projectName);
      if (!resolvedProjectId) {
        return {
          success: false,
          error: `Could not find a project matching "${params.projectName}". Please check the project name or provide a specific project ID.`,
          missingFields: ['projectId']
        };
      }
    }

    // Resolve task IDs if task names are provided
    let resolvedActionItemIds = params.actionItemIds || [];

    if (params.taskNames && params.taskNames.length > 0) {
      for (const taskName of params.taskNames) {
        const taskId = await findTaskByName(taskName);
        if (taskId) {
          resolvedActionItemIds.push(taskId);
        } else {
          console.warn(`Could not find task matching "${taskName}"`);
        }
      }
    }

    const updateProperties: Record<string, any> = {};

    if (params.title) {
      updateProperties[JournalProps.Title] = { title: [{ text: { content: params.title } }] };
    }
    if (params.type) {
      updateProperties[JournalProps.Type] = { select: { name: params.type } };
    }
    if (params.date) {
      updateProperties[JournalProps.Date] = { date: { start: params.date } };
    }
    if (resolvedProjectId) {
      updateProperties[JournalProps.Project] = { relation: [{ id: resolvedProjectId }] };
    }
    if (params.lifeDomainId) {
      updateProperties[JournalProps.LifeDomain] = { relation: [{ id: params.lifeDomainId }] };
    }
    if (resolvedActionItemIds?.length) {
      updateProperties[JournalProps.ActionItems] = { relation: resolvedActionItemIds.map(id => ({ id })) };
    }

    return {
      success: true,
      data: {
        page_id: params.journalId,
        properties: updateProperties
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Helper function to query projects from Notion
export async function getProjects(): Promise<ActionResult<any[]>> {
  try {
    assertDbIds();
    
    console.log('Calling NOTION_QUERY_DATABASE with:', {
      database_id: DB.PROJECTS!,
      page_size: 10
    });
    
    const result = await callTool('NOTION_QUERY_DATABASE', {
      database_id: DB.PROJECTS!,
      page_size: 10
    });

    console.log('Raw MCP result:', JSON.stringify(result, null, 2));

    // Check if result is undefined or null
    if (!result) {
      throw new Error('MCP call returned undefined/null result');
    }

    // Handle different possible response formats
    let projects = [];
    if (result.results) {
      projects = result.results;
    } else if (Array.isArray(result)) {
      projects = result;
    } else if (result.data && Array.isArray(result.data)) {
      projects = result.data;
    } else if (result.content && Array.isArray(result.content)) {
      // Handle content array format (from Composio MCP responses)
      const textContent = result.content.find((item: any) => item.type === 'text');
      if (textContent && textContent.text) {
        try {
          const parsedContent = JSON.parse(textContent.text);
          if (parsedContent.data && parsedContent.data.response_data && parsedContent.data.response_data.results) {
            projects = parsedContent.data.response_data.results;
            console.log('Extracted projects from content array:', projects.length);
          }
        } catch (parseError) {
          console.log('Failed to parse content text as JSON');
        }
      }
    } else {
      console.log('Unexpected result format:', typeof result, result);
      console.log('Available keys:', Object.keys(result || {}));
    }

    return {
      success: true,
      data: projects
    };
  } catch (error) {
    console.error('getProjects error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to query projects'
    };
  }
}

// Handle action by routing to appropriate builder and calling MCP
export async function handleAction(parsedAction: ParsedAction): Promise<ActionResult<any>> {
  const { action, params } = parsedAction;

  try {
    let builderResult: ActionResult<NotionActionPayload | NotionUpdatePayload>;
    let isUpdateAction = false;

    // Route to appropriate builder
    console.log('handleAction called with action:', action);
    switch (action) {
      case 'createProject':
        builderResult = createProject(params as any);
        break;
      case 'createTask':
        builderResult = await createTask(params as any);
        break;
      case 'logNote':
        console.log('Calling logNote with params:', params);
        builderResult = await logNote(params as any);
        console.log('logNote result:', builderResult);
        break;
      case 'createContent':
        builderResult = createContent(params as any);
        break;
      case 'updateTask':
        builderResult = await updateTask(params as any);
        isUpdateAction = true;
        break;
      case 'updateProject':
        builderResult = updateProject(params as any);
        isUpdateAction = true;
        break;
      case 'updateContent':
        builderResult = updateContent(params as any);
        isUpdateAction = true;
        break;
      case 'updateJournal':
        builderResult = await updateJournal(params as any);
        isUpdateAction = true;
        break;
      case 'createCalendarEvent':
        return await createCalendarEvent(params as any);
      case 'updateCalendarEvent':
        return await updateCalendarEvent(params as any);
      case 'deleteCalendarEvent':
        return await deleteCalendarEvent(params as any);
      case 'listCalendarEvents':
        return await listCalendarEvents(params as any);
      default:
        return {
          success: false,
          error: `Unknown action: ${action}`
        };
    }

    // If builder failed, return the error
    if (!builderResult.success) {
      return builderResult;
    }

    let mcpResult;

    if (isUpdateAction) {
      // Handle update actions using NOTION_UPDATE_PAGE
      const updateData = builderResult.data as NotionUpdatePayload;
      mcpResult = await callTool('NOTION_UPDATE_PAGE', {
        page_id: updateData.page_id,
        properties: updateData.properties
      });
    } else {
      // Handle create actions using two-step approach:
      // 1. Create basic page with title only
      // 2. Update page with all properties
      const createData = builderResult.data as NotionActionPayload;
      
      // Extract title from properties
      let title = 'Untitled';
      if (createData.properties.Name && createData.properties.Name.title) {
        title = createData.properties.Name.title[0]?.text?.content || 'Untitled';
      } else if (createData.properties.Title && createData.properties.Title.title) {
        title = createData.properties.Title.title[0]?.text?.content || 'Untitled';
      }

      // Step 1: Create basic page with title only
      console.log('Creating Notion page with:', {
        parent_id: createData.database_id,
        title: title
      });

      const createResult = await callTool('NOTION_CREATE_NOTION_PAGE', {
        parent_id: createData.database_id,
        title: title
      });

      console.log('Page creation result:', JSON.stringify(createResult, null, 2));

      // Step 2: Extract the created page ID and update with all properties
      let pageId: string | undefined;
      if (createResult && typeof createResult === 'object') {
        // Handle different possible response formats from Composio
        if (createResult.content && Array.isArray(createResult.content)) {
          const textContent = createResult.content.find((item: any) => item.type === 'text');
          if (textContent && textContent.text) {
            try {
              const parsedContent = JSON.parse(textContent.text);
              if (parsedContent.data && parsedContent.data.data && parsedContent.data.data.id) {
                pageId = parsedContent.data.data.id;
              }
            } catch (parseError) {
              console.log('Failed to parse create response for page ID');
            }
          }
        } else if (createResult.data && createResult.data.id) {
          pageId = createResult.data.id;
        } else if (createResult.id) {
          pageId = createResult.id;
        }
      }

      if (!pageId) {
        throw new Error('Failed to get page ID from create response');
      }

      // Step 3: Update the created page with all properties (excluding title)
      const updateProperties = { ...createData.properties };
      // Remove title properties as they're already set during creation
      delete updateProperties.Name;
      delete updateProperties.Title;

      // Update properties if there are any
      let updateResult;
      if (Object.keys(updateProperties).length > 0) {
        console.log('Updating page properties:', {
          page_id: pageId,
          properties: updateProperties
        });

        try {
          updateResult = await callTool('NOTION_UPDATE_PAGE', {
            page_id: pageId,
            properties: updateProperties
          });
          console.log('Property update result:', JSON.stringify(updateResult, null, 2));
        } catch (updateError) {
          console.error('Failed to update page properties:', updateError);
          throw updateError;
        }
      }

      // Step 3.5: Add content to page body if this is a journal entry and has content
      let contentResult;
      console.log('Checking content addition for action:', action);
      console.log('createData has content?', 'content' in createData);
      console.log('createData.content value:', createData.content);

      if (action === 'logNote' && 'content' in createData && createData.content) {
        console.log('Adding content to journal page...');
        try {
          contentResult = await callTool('NOTION_ADD_MULTIPLE_PAGE_CONTENT', {
            parent_block_id: pageId,
            content_blocks: [
              {
                content_block: {
                  type: 'text',
                  content: createData.content
                }
              }
            ]
          });
          console.log('Content append result:', contentResult);
        } catch (contentError) {
          console.error('Failed to append content to journal page:', contentError);
          // Don't fail the entire operation if content append fails
        }
      }

      // Return the combined results
      mcpResult = {
        createResult,
        ...(updateResult && { updateResult }),
        ...(contentResult && { contentResult }),
        pageId
      };
    }

    return {
      success: true,
      data: {
        action,
        result: mcpResult,
        ...(isUpdateAction 
          ? { page_id: (builderResult.data as NotionUpdatePayload).page_id }
          : { database_id: (builderResult.data as NotionActionPayload).database_id }
        )
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to handle action'
    };
  }
}

// ============= GOOGLE CALENDAR ACTIONS =============

// Helper function to fix Google Calendar links
function fixGoogleCalendarLink(apiLink: string, eventId?: string): string {
  // Extract the eid from the old format
  const eidMatch = apiLink.match(/eid=([^&]+)/);
  if (eidMatch) {
    const eid = eidMatch[1];
    // Return the modern working format
    return `https://calendar.google.com/calendar/u/0/r/eventedit/${eid}`;
  }
  
  // Fallback: construct from event ID if available
  if (eventId) {
    try {
      const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
      const base64EventId = Buffer.from(`${eventId} ${calendarId}`).toString('base64').replace(/=/g, '');
      return `https://calendar.google.com/calendar/u/0/r/eventedit/${base64EventId}`;
    } catch {
      // If Buffer fails, return original link
      return apiLink;
    }
  }
  
  return apiLink; // Return original if we can't fix it
}

// Create Google Calendar Event
export async function createCalendarEvent(params: {
  title: string;
  startDateTime: string;
  endDateTime: string;
  description?: string;
  timeZone?: string;
  location?: string;
  attendees?: string[];
  reminderMinutes?: number;
}): Promise<ActionResult<any>> {
  try {
    const calendarId = assertGoogleCalendarId();
    
    const validation = validateRequired(params, ['title', 'startDateTime', 'endDateTime']);
    if (!validation.success) return validation;

    // Calculate duration from start and end times
    const startTime = new Date(params.startDateTime);
    const endTime = new Date(params.endDateTime);
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.floor(durationMs / (1000 * 60));
    const eventDurationHour = Math.floor(durationMinutes / 60);
    const eventDurationMinutes = durationMinutes % 60;
    
    const mcpParams = {
      calendar_id: calendarId,
      summary: params.title,
      start_datetime: params.startDateTime,
      event_duration_hour: eventDurationHour,
      event_duration_minutes: eventDurationMinutes,
      description: params.description,
      timezone: params.timeZone || 'UTC',
      attendees: params.attendees || []
    };
    
    console.log('Calling GOOGLECALENDAR_CREATE_EVENT with:', mcpParams);
    
    const mcpResult = await callTool('GOOGLECALENDAR_CREATE_EVENT', mcpParams);

    console.log('Google Calendar create result:', mcpResult);

    // Fix the Google Calendar link in the response
    if (mcpResult && mcpResult.content && Array.isArray(mcpResult.content)) {
      const textContent = mcpResult.content.find((item: any) => item.type === 'text');
      if (textContent && textContent.text) {
        try {
          const parsedContent = JSON.parse(textContent.text);
          if (parsedContent.data && parsedContent.data.response_data) {
            const eventData = parsedContent.data.response_data;
            if (eventData.htmlLink && eventData.id) {
              eventData.htmlLink = fixGoogleCalendarLink(eventData.htmlLink, eventData.id);
              eventData.fixedLink = eventData.htmlLink; // Add a clear reference
              textContent.text = JSON.stringify(parsedContent);
            }
          }
        } catch (parseError) {
          // If parsing fails, continue without fixing the link
        }
      }
    }

    return {
      success: true,
      data: mcpResult
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Update Google Calendar Event
export async function updateCalendarEvent(params: {
  eventId?: string;
  eventName?: string;
  title?: string;
  startDateTime?: string;
  endDateTime?: string;
  description?: string;
  timeZone?: string;
  location?: string;
  attendees?: string[];
  reminderMinutes?: number;
}): Promise<ActionResult<any>> {
  try {
    const calendarId = assertGoogleCalendarId();

    // Resolve event ID if event name is provided
    let resolvedEventId = params.eventId;

    if (!resolvedEventId && params.eventName) {
      resolvedEventId = await findCalendarEventByName(params.eventName);
      if (!resolvedEventId) {
        return {
          success: false,
          error: `Could not find a calendar event matching "${params.eventName}". Please check the event name or provide a specific event ID.`,
          missingFields: ['eventId']
        };
      }
    }

    if (!resolvedEventId) {
      return {
        success: false,
        error: 'Either eventId or eventName must be provided',
        missingFields: ['eventId']
      };
    }

    // Fetch the existing event to preserve all current data
    console.log('Fetching existing event data for:', resolvedEventId);
    let existingEvent = null;

    // Try to find the existing event in our recent events
    const recentEvents = await listCalendarEvents({
      maxResults: 100,
      timeMin: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
      timeMax: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()  // Next 30 days
    });

    if (recentEvents.success && recentEvents.data) {
      existingEvent = recentEvents.data.find(event => event.id === resolvedEventId);
      if (existingEvent) {
        console.log('Found existing event data:', existingEvent.summary);
      }
    }

    const mcpParams: any = {
      calendar_id: calendarId,
      event_id: resolvedEventId,
      timezone: params.timeZone || 'UTC',
      send_updates: true
    };

    // Preserve existing event data and only override what's being updated
    if (existingEvent) {
      // Preserve existing title unless specifically updating it
      if (existingEvent.summary && !params.title) {
        mcpParams.summary = existingEvent.summary;
      }

      // Preserve existing description unless specifically updating it
      if (existingEvent.description && params.description === undefined) {
        mcpParams.description = existingEvent.description;
      }

      // Preserve existing attendees unless specifically updating them
      if (existingEvent.attendees && !params.attendees) {
        // Convert attendee objects to email strings
        mcpParams.attendees = existingEvent.attendees.map((attendee: any) =>
          typeof attendee === 'string' ? attendee : attendee.email
        ).filter(Boolean);
      }

      // Preserve existing location unless specifically updating it
      if (existingEvent.location && !params.location) {
        mcpParams.location = existingEvent.location;
      }
    }

    // Handle start/end times and duration
    if (params.startDateTime) {
      mcpParams.start_datetime = params.startDateTime;

      // If we have both start and end times, calculate duration
      if (params.endDateTime) {
        const startTime = new Date(params.startDateTime);
        const endTime = new Date(params.endDateTime);
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationMinutes = Math.floor(durationMs / (1000 * 60));
        const eventDurationHour = Math.floor(durationMinutes / 60);
        const eventDurationMinutes = durationMinutes % 60;

        mcpParams.event_duration_hour = eventDurationHour;
        mcpParams.event_duration_minutes = eventDurationMinutes;
      }
    }

    // Apply any explicit updates
    if (params.title) {
      mcpParams.summary = params.title;
    }
    if (params.description !== undefined) {
      mcpParams.description = params.description;
    }
    if (params.attendees?.length) {
      // Ensure attendees are email strings
      mcpParams.attendees = params.attendees.map((attendee: any) =>
        typeof attendee === 'string' ? attendee : attendee.email || attendee
      ).filter(Boolean);
    }
    if (params.location) {
      mcpParams.location = params.location;
    }

    console.log('Calling GOOGLECALENDAR_UPDATE_EVENT with:', mcpParams);
    
    const mcpResult = await callTool('GOOGLECALENDAR_UPDATE_EVENT', mcpParams);

    console.log('Google Calendar update result:', mcpResult);

    // Fix the Google Calendar link in the response
    if (mcpResult && mcpResult.content && Array.isArray(mcpResult.content)) {
      const textContent = mcpResult.content.find((item: any) => item.type === 'text');
      if (textContent && textContent.text) {
        try {
          const parsedContent = JSON.parse(textContent.text);
          if (parsedContent.data && parsedContent.data.response_data) {
            const eventData = parsedContent.data.response_data;
            if (eventData.htmlLink && eventData.id) {
              eventData.htmlLink = fixGoogleCalendarLink(eventData.htmlLink, eventData.id);
              eventData.fixedLink = eventData.htmlLink; // Add a clear reference
              textContent.text = JSON.stringify(parsedContent);
            }
          }
        } catch (parseError) {
          // If parsing fails, continue without fixing the link
        }
      }
    }

    return {
      success: true,
      data: mcpResult
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Delete Google Calendar Event
export async function deleteCalendarEvent(params: {
  eventId: string;
}): Promise<ActionResult<any>> {
  try {
    const calendarId = assertGoogleCalendarId();
    
    const validation = validateRequired(params, ['eventId']);
    if (!validation.success) return validation;

    console.log('Calling GOOGLECALENDAR_DELETE_EVENT with:', {
      calendar_id: calendarId,
      event_id: params.eventId
    });
    
    const mcpResult = await callTool('GOOGLECALENDAR_DELETE_EVENT', {
      calendar_id: calendarId,
      event_id: params.eventId
    });

    console.log('Google Calendar delete result:', mcpResult);

    return {
      success: true,
      data: mcpResult
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// List Google Calendar Events
export async function listCalendarEvents(params?: {
  timeMin?: string;  // ISO 8601
  timeMax?: string;  // ISO 8601
  maxResults?: number;
}): Promise<ActionResult<any[]>> {
  try {
    const calendarId = assertGoogleCalendarId();
    
    console.log('Calling GOOGLECALENDAR_EVENTS_LIST with:', {
      calendarId,
      ...params
    });
    
    const result = await callTool('GOOGLECALENDAR_EVENTS_LIST', {
      calendarId,
      timeMin: params?.timeMin,
      timeMax: params?.timeMax,
      maxResults: params?.maxResults || 10
    });

    console.log('Raw Google Calendar MCP result:', JSON.stringify(result, null, 2));

    // Handle different possible response formats similar to getProjects
    let events = [];
    if (result && typeof result === 'object') {
      if (result.content && Array.isArray(result.content)) {
        const textContent = result.content.find((item: any) => item.type === 'text');
        if (textContent && textContent.text) {
          try {
            const parsedContent = JSON.parse(textContent.text);
            if (parsedContent.data && parsedContent.data.items) {
              events = parsedContent.data.items;
            }
          } catch (parseError) {
            console.log('Failed to parse Google Calendar content text as JSON');
          }
        }
      } else if (result.items && Array.isArray(result.items)) {
        events = result.items;
      } else if (Array.isArray(result)) {
        events = result;
      }
    }

    return {
      success: true,
      data: events
    };
  } catch (error) {
    console.error('listCalendarEvents error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list calendar events'
    };
  }
}
