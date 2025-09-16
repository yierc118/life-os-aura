"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  Menu,
  MessageCircle,
  Settings,
  User,
  Send,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  Mic,
  Calendar,
  Search,
  Wand2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useMobile } from "@/hooks/use-mobile"
import { ChatMessage } from "@/components/chat-message"
import { ChatSkeletonLoader } from "@/components/chat-skeleton"

const sidebarItems = [
  { icon: MessageCircle, label: "Chat", active: true },
  { icon: Sparkles, label: "AI Tools" },
  { icon: User, label: "Profile" },
  { icon: Settings, label: "Settings" },
]

const quickActions = [
  { icon: Search, label: "Search" },
  { icon: Calendar, label: "Calendar" },
  { icon: Wand2, label: "Improve prompt" },
]

const mockMessages: any[] = []

function WelcomeScreen({ onStartChat }: { onStartChat: () => void }) {
  const quickTopics = ["Create Calendar Event", "Set Reminder", "Initiate Weekly Review", "Update Notion DB"]

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-2xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-display font-bold text-foreground mb-2">Hello, Yier</h1>
        <h2 className="text-2xl font-display text-foreground-secondary mb-4">How can I help?</h2>
      </div>

      <div className="w-full mb-12">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
          {quickTopics.map((topic) => (
            <Button
              key={topic}
              variant="outline"
              className="h-auto p-4 text-left justify-start bg-[#DDE3FD] hover:bg-[#DDE3FD]/80 border-[#DDE3FD] rounded-xl text-gray-800"
              onClick={onStartChat}
            >
              <span className="text-sm font-medium">{topic}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <div
      className={cn(
        "flex flex-col h-full bg-sidebar/80 backdrop-blur-sm border-r border-sidebar-border/50 transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border/50">
        {!collapsed && <h2 className="font-display font-semibold text-sidebar-foreground">Aura</h2>}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2">
        <div className="space-y-1">
          {sidebarItems.map((item) => (
            <Button
              key={item.label}
              variant={item.active ? "default" : "ghost"}
              className={cn(
                "w-full justify-start gap-3 text-sidebar-foreground",
                collapsed && "justify-center px-2",
                item.active && "bg-sidebar-primary text-sidebar-primary-foreground",
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Button>
          ))}
        </div>
      </nav>
    </div>
  )
}

function TopBar() {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-surface/80 backdrop-blur-sm border-b border-border-subtle/50 shadow-monument-xs">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="font-display font-semibold text-foreground">Aura - Yier's Life OS</h1>
          <p className="text-sm text-foreground-secondary">Your personal AI assistant</p>
        </div>
      </div>
    </header>
  )
}

function ChatThread({ messages, isLoading }: { messages: any; isLoading: boolean }) {
  // Group messages by proximity (within 5 minutes of same user)
  const groupedMessages = messages.reduce(
    (groups: Array<any & { isGrouped: boolean }>, message: any, index: number) => {
      const prevMessage = messages[index - 1]
      const isGrouped =
        prevMessage &&
        prevMessage.role === message.role &&
        message.timestamp.getTime() - prevMessage.timestamp.getTime() < 5 * 60 * 1000

      groups.push({ ...message, isGrouped })
      return groups
    },
    [] as Array<any & { isGrouped: boolean }>,
  )

  return (
    <ScrollArea className="flex-1">
      <div className="pb-6">
        {groupedMessages.map((message: any, index: number) => {
          const showUnreadDivider = message.isUnread && (index === 0 || !groupedMessages[index - 1].isUnread)

          return (
            <ChatMessage
              key={message.id}
              message={message}
              showUnreadDivider={showUnreadDivider}
              isGrouped={message.isGrouped}
            />
          )
        })}

        {isLoading && <ChatSkeletonLoader />}
      </div>
    </ScrollArea>
  )
}

function ChatComposer({ handleSendMessage }: { handleSendMessage: (content: string) => void }) {
  const [message, setMessage] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const maxChars = 2000

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim() && message.length <= maxChars) {
      handleSendMessage(message.trim())
      setMessage("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const isNearLimit = message.length >= 1900
  const isAtLimit = message.length >= maxChars

  return (
    <div className="sticky bottom-0 bg-gradient-to-r from-[#C2E9FB] to-[#E0D1F7] border-t border-border shadow-monument-md">
      <div className="p-4">
        <div className="bg-white border border-border-subtle p-4 shadow-monument-sm">
          <div className="flex items-start gap-3">
            {/* Attachment button */}
            <Button
              variant="ghost"
              size="sm"
              disabled
              className="mt-2 text-foreground-tertiary hover:text-foreground-secondary"
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            {/* Message input */}
            <div className="flex-1">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Aura anything…"
                className="min-h-[44px] max-h-32 resize-none border-0 bg-transparent px-3 py-2 text-base placeholder:text-foreground-tertiary focus-visible:ring-0 break-words overflow-wrap-anywhere"
                disabled={isAtLimit}
                style={{
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  whiteSpace: "pre-wrap",
                }}
              />
            </div>

            {/* Voice and Send buttons */}
            <div className="flex items-center gap-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                onMouseDown={() => setIsRecording(true)}
                onMouseUp={() => setIsRecording(false)}
                onMouseLeave={() => setIsRecording(false)}
                className={cn(
                  "text-foreground-tertiary hover:text-foreground-secondary",
                  isRecording && "text-primary bg-primary/10",
                )}
              >
                <Mic className="h-4 w-4" />
              </Button>

              <Button
                type="submit"
                disabled={!message.trim() || isAtLimit}
                onClick={handleSubmit}
                className="h-10 w-10 rounded-full bg-primary hover:bg-primary-hover p-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Character counter */}
          {message.length > 0 && (
            <div className="flex justify-end mt-2">
              <span className={cn("text-xs", isNearLimit ? "text-amber-600" : "text-foreground-tertiary")}>
                {message.length} / {maxChars}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showWelcome, setShowWelcome] = useState(true)
  const [messages, setMessages] = useState(mockMessages)
  const [isLoading, setIsLoading] = useState(false)
  const [userTimezone, setUserTimezone] = useState<string>('UTC')
  const isMobile = useMobile()

  // Detect user's timezone on component mount
  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    setUserTimezone(timezone)
    console.log('Detected user timezone:', timezone)
  }, [])

  const handleSendMessage = async (content: string) => {
    if (showWelcome) {
      setShowWelcome(false)
    }

    // Add user message
    const userMessage = {
      id: Date.now(),
      role: "user" as const,
      content,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      // Get recent conversation history (last 6 messages for context)
      const recentMessages = messages.slice(-6).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Call the real API endpoint
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          message: content,
          conversationHistory: recentMessages,
          userTimezone: userTimezone
        })
      })

      const result = await response.json()

      if (result.success) {
        const assistantMessage = {
          id: Date.now() + 1,
          role: "assistant" as const,
          content: result.message,
          timestamp: new Date(),
          actionChips: ["Create Calendar Event", "Set Reminder", "Update Notion DB"],
        }

        setMessages((prev) => [...prev, assistantMessage])
      } else {
        const errorContent = result.userPrompt ? result.userPrompt : 
          `Sorry, I encountered an error: ${result.error}${result.details ? `\n\nDetails: ${result.details}` : ''}`;

        const errorMessage = {
          id: Date.now() + 1,
          role: "assistant" as const,
          content: errorContent,
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, errorMessage])
      }
    } catch (error) {
      console.error('API call failed:', error)
      
      const errorMessage = {
        id: Date.now() + 1,
        role: "assistant" as const,
        content: `Sorry, I couldn't process your request. Please check your connection and try again.`,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex items-center justify-between p-4 bg-surface/80 backdrop-blur-sm border-b border-border-subtle/50">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 [&>button]:hidden">
              <Sidebar collapsed={false} onToggle={() => {}} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
            <span className="font-display font-semibold text-foreground">Aura</span>
          </div>
          <div className="w-10" />
        </div>

        <div className="flex-1 flex flex-col">
          {showWelcome ? (
            <WelcomeScreen onStartChat={() => setShowWelcome(false)} />
          ) : (
            <ChatThread messages={messages} isLoading={isLoading} />
          )}
          <ChatComposer handleSendMessage={handleSendMessage} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className="flex-1 flex flex-col">
        <TopBar />
        <div className="flex-1 flex flex-col">
          {showWelcome ? (
            <WelcomeScreen onStartChat={() => setShowWelcome(false)} />
          ) : (
            <ChatThread messages={messages} isLoading={isLoading} />
          )}
          <ChatComposer handleSendMessage={handleSendMessage} />
        </div>
      </div>
    </div>
  )
}
