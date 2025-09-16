"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Copy, Check, Calendar, Bell, FileText, RotateCcw, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: number
  role: "user" | "assistant"
  content: string
  timestamp: Date
  isUnread?: boolean
  actionChips?: string[]
}

interface ChatMessageProps {
  message: Message
  showUnreadDivider?: boolean
  isGrouped?: boolean
}

// Simple markdown renderer for basic formatting
function renderMarkdown(content: string) {
  // Handle code blocks
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
  const inlineCodeRegex = /`([^`]+)`/g

  const rendered = content
    .replace(codeBlockRegex, (match, lang, code) => {
      return `<pre class="code-block" data-lang="${lang || ""}">${code.trim()}</pre>`
    })
    .replace(inlineCodeRegex, '<code class="inline-code">$1</code>')
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>")

  return rendered
}

function CodeBlock({ content, language }: { content: string; language?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group">
      <pre className="bg-muted/30 border border-border-subtle rounded-lg p-4 overflow-x-auto text-sm font-mono">
        <code>{content}</code>
      </pre>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleCopy}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 hover:bg-muted/50"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  )
}

function ActionChips({ chips, messageContent }: { chips: string[]; messageContent: string }) {
  const allowedChips = [
    { id: "calendar", label: "Create Calendar Event", icon: Calendar },
    { id: "reminder", label: "Set Reminder", icon: Bell },
    { id: "review", label: "Initiate Weekly Review", icon: RotateCcw },
    { id: "notion", label: "Update Notion DB", icon: FileText },
  ]

  // Determine relevance based on message content
  const getRelevantChips = (content: string) => {
    const lowerContent = content.toLowerCase()
    const relevantChips = []

    // Calendar event relevance
    if (
      lowerContent.includes("schedule") ||
      lowerContent.includes("meeting") ||
      lowerContent.includes("appointment") ||
      lowerContent.includes("event") ||
      lowerContent.includes("calendar") ||
      lowerContent.includes("time")
    ) {
      relevantChips.push(allowedChips[0]) // Calendar
    }

    // Reminder relevance
    if (
      lowerContent.includes("remind") ||
      lowerContent.includes("remember") ||
      lowerContent.includes("don't forget") ||
      lowerContent.includes("follow up") ||
      lowerContent.includes("later") ||
      lowerContent.includes("tomorrow")
    ) {
      relevantChips.push(allowedChips[1]) // Reminder
    }

    // Weekly review relevance
    if (
      lowerContent.includes("progress") ||
      lowerContent.includes("review") ||
      lowerContent.includes("reflect") ||
      lowerContent.includes("goals") ||
      lowerContent.includes("weekly") ||
      lowerContent.includes("track")
    ) {
      relevantChips.push(allowedChips[2]) // Weekly Review
    }

    // Notion save relevance
    if (
      lowerContent.includes("save") ||
      lowerContent.includes("note") ||
      lowerContent.includes("document") ||
      lowerContent.includes("record") ||
      lowerContent.includes("important") ||
      lowerContent.includes("reference") ||
      lowerContent.includes("database") ||
      lowerContent.includes("update")
    ) {
      relevantChips.push(allowedChips[3]) // Notion
    }

    // If no specific relevance found, show default set
    if (relevantChips.length === 0) {
      relevantChips.push(allowedChips[1], allowedChips[2], allowedChips[3]) // Reminder, Review, Notion
    }

    // Return max 3 chips
    return relevantChips.slice(0, 3)
  }

  const relevantChips = getRelevantChips(messageContent)

  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {relevantChips.map((chip) => {
        const Icon = chip.icon
        return (
          <Button
            key={chip.id}
            variant="outline"
            size="sm"
            className="action-chip h-8 text-xs hover:bg-chat-assistant-bubble/80 text-foreground hover:text-foreground transition-all duration-200 rounded-full bg-transparent"
          >
            <Icon className="h-3 w-3 mr-1.5" />
            {chip.label}
          </Button>
        )
      })}
    </div>
  )
}

export function ChatMessage({ message, showUnreadDivider, isGrouped }: ChatMessageProps) {
  const isAssistant = message.role === "assistant"
  const renderedContent = renderMarkdown(message.content)

  // Extract code blocks for special rendering
  const codeBlocks = message.content.match(/```(\w+)?\n([\s\S]*?)```/g) || []

  return (
    <>
      {showUnreadDivider && (
        <div className="flex items-center gap-4 py-6 px-6">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <Badge variant="secondary" className="text-xs font-medium bg-secondary/10 text-secondary border-secondary/20">
            New messages
          </Badge>
          <div className="flex-1 h-px bg-gradient-to-r from-border to-border to-transparent" />
        </div>
      )}

      <div className={cn("group relative", !isGrouped && "pt-6", isGrouped && "pt-2")}>
        <div className={cn("flex gap-4 px-6 pb-4", isAssistant ? "justify-start" : "justify-end")}>
          {/* Avatar - only show if not grouped and for assistant */}
          {!isGrouped && isAssistant && (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0 shadow-monument-sm">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
          )}

          {/* Message content */}
          <div className={cn("max-w-[80%] space-y-2", isGrouped && isAssistant && "ml-12")}>
            {/* Header - only show if not grouped */}
            {!isGrouped && (
              <div className={cn("flex items-center gap-2", !isAssistant && "justify-end")}>
                <span className="font-medium text-foreground text-sm">{isAssistant ? "Aura" : "You"}</span>
                <span className="text-xs text-foreground-tertiary">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}

            {/* Message bubble */}
            <div
              className={cn(
                "rounded-2xl px-4 py-3 shadow-monument-sm transition-all duration-200",
                isAssistant
                  ? "chat-assistant-bubble border border-border-subtle text-foreground"
                  : "chat-user-bubble text-white",
              )}
            >
              {/* Handle code blocks separately */}
              {codeBlocks.length > 0 ? (
                <div className="space-y-4">
                  {message.content.split(/```(\w+)?\n([\s\S]*?)```/).map((part, index) => {
                    if (index % 3 === 0) {
                      // Regular text
                      return part.trim() ? (
                        <div
                          key={index}
                          className={cn("leading-relaxed", isAssistant ? "text-foreground" : "text-white")}
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(part) }}
                        />
                      ) : null
                    } else if (index % 3 === 2) {
                      // Code block content
                      const language = message.content.split(/```(\w+)?\n([\s\S]*?)```/)[index - 1]
                      return <CodeBlock key={index} content={part.trim()} language={language} />
                    }
                    return null
                  })}
                </div>
              ) : (
                <div
                  className={cn("leading-relaxed", isAssistant ? "text-foreground" : "text-white")}
                  dangerouslySetInnerHTML={{ __html: renderedContent }}
                />
              )}
            </div>

            {/* Action chips for assistant messages */}
            {isAssistant && message.actionChips && (
              <ActionChips chips={message.actionChips} messageContent={message.content} />
            )}

            {/* Timestamp for grouped messages */}
            {isGrouped && (
              <div className={cn("opacity-0 group-hover:opacity-100 transition-opacity", !isAssistant && "text-right")}>
                <span className="text-xs text-foreground-tertiary">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
          </div>

          {/* User avatar space - invisible but maintains layout */}
          {!isGrouped && !isAssistant && <div className="w-8 h-8 flex-shrink-0" />}
        </div>
      </div>
    </>
  )
}
