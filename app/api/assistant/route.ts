export const runtime = "nodejs"; // Ensure Node.js runtime for PostgreSQL

import { NextRequest, NextResponse } from "next/server";
import { parseAction, handleAction } from "@/lib/actions";
import {
  createThread,
  saveMessage,
  saveToolExecution,
  listMessages
} from "@/lib/db";

// Get LLM client (adjust import based on your LLM setup)
async function callLLM(userMessage: string, isRepair = false, conversationHistory: any[] = [], userTimezone = 'UTC'): Promise<string> {
  // Import your LLM function dynamically to avoid module loading issues
  try {
    const { generateText } = await import("@/lib/llm");
    
    const systemPrompt = isRepair 
      ? `CRITICAL: Return ONLY valid JSON with NO comments or explanations.

The user is asking for help with their previous request. They want to provide additional information for the SAME action that was previously attempted.

IMPORTANT: Keep the same action type - DO NOT change from createTask to logNote or createCalendarEvent etc.

Return a valid JSON response in this exact format:
{"action": "createProject|createTask|logNote|createContent|createCalendarEvent|updateCalendarEvent|deleteCalendarEvent|listCalendarEvents|draftJournal", "params": {"key": "value"}}

Rules:
- NO // comments in JSON
- NO placeholder text 
- Use "MISSING_INFO" for missing required values
- All strings must be properly quoted
- Use current date/time: ${new Date().toISOString()} (Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})
- Calculate relative dates from current date above
- MAINTAIN the original action intent

User is providing more details: "${userMessage}"`
      
      : `You are a Life OS assistant that helps users manage their projects, tasks, journal entries, content in Notion, and calendar events in Google Calendar.

CRITICAL: You must respond with ONLY a valid JSON object. NO comments, NO explanations, NO additional text.

Analyze the user's request and respond with a JSON object in this exact format:
{
  "action": "createProject|createTask|logNote|createContent|createCalendarEvent|updateCalendarEvent|deleteCalendarEvent|listCalendarEvents|draftJournal",
  "params": {
    "key": "value"
  }
}

IMPORTANT:
- Do NOT include ANY comments in the JSON (no // comments)
- Do NOT include placeholder text like "your_project_id_here"
- ONLY use "MISSING_INFO" for REQUIRED fields that are truly missing
- Do NOT include optional fields in params unless the user specifically mentions them
- For optional fields not mentioned by user: simply omit them from the JSON entirely
- Ensure all strings are properly quoted
- Ensure the JSON is valid and parseable
- ALWAYS use current dates and times based on the provided current date/time above
- For relative dates like "tomorrow", "next Friday", calculate from the current date provided
- Use ISO 8601 format for all date/time values (YYYY-MM-DDTHH:mm:ss or YYYY-MM-DD)
- For calendar events, ALWAYS include the user's timezone in timeZone field: "${userTimezone}"
- When converting times (e.g. "12pm", "2:00 PM"), interpret them as local time in the user's timezone

Actions available:
NOTION CREATE ACTIONS:
- createProject: requires "name", optional: "lifeDomainId", "flagship" (true/false), "status", "due", "dod", "kpi", "notes"
- createTask: requires "name", "projectId" OR "projectName", "status", "priority", "due", optional: "shippable" (true/false), "notes"
- logNote: requires "title", "type" (Note|Idea|Research), "content" (extract from user's message - everything after title/with content/etc.), optional: "date", "projectId" OR "projectName", "lifeDomainId", "actionItemIds" OR "taskNames". Always ask user if they want to link to projects or tasks.
- createContent: requires "title", optional: "type", "tags", "projectId", "lifeDomainId", "date", "body"
- draftJournal: requires "content" (text to summarize/paraphrase), optional: "title", "type" (Note|Idea|Research), "format" (summary|paraphrase)

FIELD OPTIONS (must match existing Notion database selections):
- Task priority: EXACTLY "P0 - Critical", "P1 - High", "P2 - Medium", "P3 - Low" - use these exact strings only
- Task status: EXACTLY "Next", "Blocked", "Doing", "Verify", "Done" - use these exact strings only, DO NOT create new status values
- Project status: Use existing project status options from Notion (e.g., "In Build", "Planning", "Completed")
- Note type: Note, Idea, Research
- Boolean fields: true or false only

CRITICAL FIELD VALIDATION RULES:
- ALWAYS use existing field options from the Notion database
- NEVER create new select/status options
- If user provides a status that doesn't match existing options, use "MISSING_INFO" and ask for clarification
- For status fields, use the exact names that exist in the Notion database

IMPORTANT PRIORITY RULES:
- NEVER create new priority values
- ONLY use these exact priority strings: "P0 - Critical", "P1 - High", "P2 - Medium", "P3 - Low"
- If user says "critical" or "urgent" → use "P0 - Critical"
- If user says "high" → use "P1 - High"
- If user says "normal" or "medium" → use "P2 - Medium"
- If user says "low" → use "P3 - Low"

IMPORTANT RULES:
- For createTask action: ALWAYS require Name, Project (projectId OR projectName), Status, Priority, and Due date - if ANY of these are missing, use "MISSING_INFO"
- For logNote action: After creating the basic journal entry, ALWAYS ask the user if they want to link it to any projects or tasks. Use prompts like "Would you like to link this journal entry to any projects or tasks?"
- For updateCalendarEvent action: PREFER eventName over eventId. If user mentions updating a calendar event by name, use "eventName" field instead of "eventId"
- Only include optional fields that are mentioned or clearly implied by the user
- Do NOT request optional fields unless the user specifically mentions them
- For required fields that are missing, use "MISSING_INFO" - do NOT make assumptions
- Validate that all required fields are present before creating tasks

CALENDAR UPDATE RULES:
- When updating calendar events, if the date/time context is ambiguous (e.g., "tomorrow" but multiple events exist), use "MISSING_INFO" for eventName to ask for clarification
- Always preserve the original event title unless user specifically requests to change it
- Use eventName (not eventId) when user refers to event by name

ACTION CONTINUITY RULES:
- If conversation context shows a previous action attempt, CONTINUE with that same action unless user explicitly requests something completely different
- When user provides clarifying information (project names, dates, etc.), use it to complete the CURRENT action in progress
- ONLY start a new action type if user clearly requests something entirely different (e.g. "instead, create a calendar event")
- If you must change action type, the user should be explicitly asking for something completely different, not just providing clarification

JOURNAL LINKING RULES:
- For logNote: ALWAYS ask user about project/task linking if not provided initially - DO NOT create incomplete journal entries
- If user says "no", "create it as-is", "without links", etc., then proceed with logNote action without project/task fields
- If user provides project or task names in response to linking question, include them in the logNote action
- Use projectName and taskNames parameters to allow fuzzy matching

CONTENT EXTRACTION RULES:
- For logNote: ALWAYS extract content from user's message. Look for patterns like "log [title] with content [content]", "journal entry: [content]", or any descriptive text after the title
- If user just says "log daily journal" without content, set content to a brief summary or ask for content
- Content should capture the essence of what the user wants to record

NOTION UPDATE ACTIONS:
- updateTask: requires "taskId" OR "taskName", optional: "name", "projectId", "status", "priority", "due", "shippable", "notes"
- updateProject: requires "projectId", optional: "name", "lifeDomainId", "flagship", "status", "due", "dod", "kpi", "notes"
- updateContent: requires "contentId", optional: "title", "type", "tags", "projectId", "lifeDomainId", "date", "body"
- updateJournal: requires "journalId", optional: "title", "type" (Note|Idea|Research), "date", "projectId" OR "projectName", "lifeDomainId", "actionItemIds" OR "taskNames"

GOOGLE CALENDAR ACTIONS:
- createCalendarEvent: requires "title", "startDateTime" (ISO 8601), "endDateTime" (ISO 8601), optional: "description", "location", "attendees" (array of emails), "timeZone" (default: user's timezone), "reminderMinutes"
- updateCalendarEvent: requires "eventName" (preferred) OR "eventId", optional: "title", "startDateTime", "endDateTime", "description", "location", "attendees", "timeZone", "reminderMinutes"  
- deleteCalendarEvent: requires "eventId"
- listCalendarEvents: optional: "timeMin" (ISO 8601), "timeMax" (ISO 8601), "maxResults", "query"

Current date and time: ${new Date().toISOString()}
Today is: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
User timezone: ${userTimezone}

${conversationHistory.length > 0 ? `\nRECENT CONVERSATION CONTEXT:\n${conversationHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n')}\n` : ''}

Current user request: "${userMessage}"

IMPORTANT: If the conversation shows a previous failed request (like project not found), and the user is providing clarification, use that context to complete the ORIGINAL intended action.`;

    return await generateText(systemPrompt, userMessage);
  } catch (error) {
    throw new Error(`LLM call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { message, conversationHistory, userTimezone, threadId: providedThreadId, userId } = body;

    // Thread management - create if not provided
    let threadId = providedThreadId;
    if (!threadId) {
      threadId = await createThread({
        userId,
        title: message.slice(0, 50) + (message.length > 50 ? "..." : "")
      });
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Message is required and must be a string'
      }, { status: 400 });
    }

    // Save user message to database
    await saveMessage({ threadId, role: "user", content: message });

    // Step 1: Call LLM to get action and params
    console.log('Calling LLM with message:', message);
    console.log('Conversation history:', conversationHistory);

    // Get conversation history from database if not provided
    let recentHistory = conversationHistory;
    if (!recentHistory && threadId) {
      const messages = await listMessages(threadId, 6);
      recentHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.role === 'assistant' ?
          (() => {
            try {
              const parsed = JSON.parse(msg.content);
              return typeof parsed === 'object' ? JSON.stringify(parsed) : msg.content;
            } catch {
              return msg.content;
            }
          })() : msg.content
      }));
    } else {
      // Limit provided history to prevent token overflow
      recentHistory = recentHistory ? recentHistory.slice(-6) : [];
    }
    
    const llmResponse = await callLLM(message, false, recentHistory, userTimezone || 'UTC');
    console.log('LLM response:', llmResponse);

    // Save LLM response to database
    await saveMessage({ threadId, role: "assistant", content: llmResponse });

    // Step 2: Parse the LLM response
    let parseResult = parseAction(llmResponse);
    
    // Step 3: One-time repair if parsing fails
    if (!parseResult.success) {
      console.log('Initial parsing failed, attempting repair:', parseResult.error);
      
      try {
        // Pass the original response context to help maintain action intent
        const repairResponse = await callLLM(`${message}\n\nPrevious attempt: ${llmResponse}`, true, recentHistory, userTimezone || 'UTC');
        console.log('Repair LLM response:', repairResponse);
        parseResult = parseAction(repairResponse);
        
        if (!parseResult.success) {
          return NextResponse.json({
            success: false,
            error: 'Failed to parse LLM response after repair attempt',
            details: parseResult.error,
            originalResponse: llmResponse,
            repairResponse: repairResponse
          }, { status: 400 });
        }
      } catch (repairError) {
        return NextResponse.json({
          success: false,
          error: 'Repair attempt failed',
          details: repairError instanceof Error ? repairError.message : 'Unknown error',
          originalError: 'success' in parseResult && !parseResult.success ? parseResult.error : 'Unknown parsing error'
        }, { status: 500 });
      }
    }

    // Step 4: Check for MISSING_INFO values and provide user-friendly prompts
    const missingInfoFields = [];
    const params = parseResult.data.params || {};

    for (const [key, value] of Object.entries(params)) {
      if (value === "MISSING_INFO") {
        missingInfoFields.push(key);
      }
    }

    // Step 4.5: Special handling for journal entries - prompt for project/task linking if not provided
    if (parseResult.data.action === 'logNote') {
      const hasProjectLink = params.projectId || params.projectName;
      const hasTaskLink = params.actionItemIds || params.taskNames;

      // Check if user is responding to a previous follow-up prompt
      const isRespondingToFollowUp = recentHistory && recentHistory.some((msg: { role: string; content: string }) =>
        msg.role === 'assistant' &&
        msg.content.includes('Would you like to link this journal entry to any projects or tasks?')
      );

      // Only prompt if no links AND not responding to previous prompt
      if (!hasProjectLink && !hasTaskLink && !isRespondingToFollowUp) {
        return NextResponse.json({
          success: false,
          error: `I can create the journal entry "${params.title || 'Untitled'}" for you.`,
          userPrompt: `Would you like to link this journal entry to any projects or tasks? You can:\n\n1. Say "no" or "create it as-is" to create the journal entry without links\n2. Specify project names or task names to link them\n\nFor example: "Link it to project X and task Y" or just "no, create it"`
        }, { status: 400 });
      }
    }

    if (missingInfoFields.length > 0) {
      const fieldPrompts = {
        projectId: "Which project should this task be added to? Please provide the project ID.",
        projectName: "Which project should this be linked to? Please provide the project name.",
        taskId: "Which task should be updated? Please provide the task ID.",
        taskName: "Which task should be updated? Please provide the task name.",
        taskNames: "Which tasks are related to this journal entry? Please provide task names (comma-separated).",
        actionItemIds: "Which tasks are action items for this journal entry? Please provide task IDs.",
        eventId: "Which calendar event should be updated? Please provide the event ID.",
        eventName: "Which calendar event should be updated? Please provide the event name.",
        lifeDomainId: "Which life domain does this belong to? (e.g., Health, Work, Personal, etc.)",
        name: "What should this item be called?",
        title: "What's the title for this item?",
        startDateTime: "When should this event start? Please provide a date and time.",
        endDateTime: "When should this event end? Please provide a date and time.",
        due: "When is this due? Please provide a date.",
        content: "What content would you like to add?",
        type: "What type is this? Options: Note, Idea, Research",
        status: "What's the task status? Please choose from: Next, Blocked, Doing, Verify, Done",
        priority: "What's the priority? Options: P0 - Critical (urgent), P1 - High, P2 - Medium (normal), P3 - Low"
      };

      const promptMessages = missingInfoFields.map(field => 
        fieldPrompts[field as keyof typeof fieldPrompts] || `Please provide the ${field}.`
      );

      return NextResponse.json({
        success: false,
        error: `I need more information to complete this request.`,
        missingFields: missingInfoFields,
        userPrompt: `To create this ${parseResult.data.action.replace('create', '').toLowerCase()}, I need:\n\n${promptMessages.map((prompt, i) => `${i + 1}. ${prompt}`).join('\n')}\n\nPlease provide this information and I'll create it for you.`
      }, { status: 400 });
    }

    // Step 5: Handle the parsed action
    console.log('Handling action:', parseResult.data);
    const handleResult = await handleAction(parseResult.data);
    const executionTime = Date.now() - startTime;

    // Save action execution audit trail
    await saveToolExecution({
      threadId,
      toolName: parseResult.data.action,
      args: parseResult.data.params || {},
      result: handleResult.success ? handleResult.data : { error: handleResult.error },
      status: handleResult.success ? "ok" : "error",
      executionTimeMs: executionTime
    });

    // Step 6: Return the result
    if (handleResult.success) {
      return NextResponse.json({
        success: true,
        message: `Successfully executed ${parseResult.data.action}`,
        data: handleResult.data,
        threadId,
        executionTime
      });
    } else {
      return NextResponse.json({
        success: false,
        error: handleResult.error,
        missingFields: 'missingFields' in handleResult ? handleResult.missingFields : undefined,
        threadId,
        executionTime
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Assistant API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
