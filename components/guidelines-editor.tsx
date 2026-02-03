"use client"

import { useEffect, useRef } from "react"
import { Plate, PlateContent, usePlateEditor } from "platejs/react"
import { BasicBlocksPlugin, BasicMarksPlugin } from "@platejs/basic-nodes/react"
import { ListStyleType, toggleList } from "@platejs/list"
import { ListPlugin } from "@platejs/list/react"
import { MarkdownPlugin, deserializeMd, serializeMd } from "@platejs/markdown"
import type { Value } from "platejs"
import { FixedToolbar } from "@/components/ui/fixed-toolbar"
import { cn } from "@/lib/utils"
import { Bold, Heading1, Heading2, Heading3, Italic, List, ListOrdered } from "lucide-react"

const emptyValue: Value = [{ type: "p", children: [{ text: "" }] }]

function htmlHeadingsToMarkdown(s: string): string {
  return s
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "# $1\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "## $1\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "### $1\n")
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "#### $1\n")
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "##### $1\n")
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "###### $1\n")
}

function ToolbarBtn({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "p-1.5 rounded hover:bg-accent transition-colors",
        active && "bg-accent text-accent-foreground"
      )}
    >
      {children}
    </button>
  )
}

interface GuidelinesEditorProps {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  className?: string
  id?: string
}

export function GuidelinesEditor({
  value,
  onChange,
  placeholder = "Use Generate from site or write your own brand voice guidelines...",
  className,
  id,
}: GuidelinesEditorProps) {
  const isInternalChange = useRef(false)
  const editor = usePlateEditor(
    { plugins: [MarkdownPlugin, BasicBlocksPlugin, BasicMarksPlugin, ListPlugin], value: emptyValue },
    []
  )

  useEffect(() => {
    if (!editor?.tf?.setValue || isInternalChange.current) {
      if (isInternalChange.current) isInternalChange.current = false
      return
    }
    const s = value.trim()
    let nodes: Value
    if (!s) {
      nodes = JSON.parse(JSON.stringify(emptyValue))
    } else {
      try {
        const next = deserializeMd(editor, htmlHeadingsToMarkdown(s))
        nodes = Array.isArray(next) && next.length > 0 ? JSON.parse(JSON.stringify(next)) : JSON.parse(JSON.stringify(emptyValue))
      } catch {
        return
      }
    }
    editor.tf.reset?.()
    editor.tf.setValue(nodes)
  }, [value, editor])

  const handleChange = () => {
    if (!editor) return
    isInternalChange.current = true
    try {
      onChange(serializeMd(editor))
    } catch {
      onChange("")
    }
  }

  if (!editor) return null

  return (
    <div className={cn("rounded-md border border-input overflow-hidden min-h-[50rem] flex flex-col", className)}>
      <FixedToolbar>
        <ToolbarBtn onClick={() => editor.tf.h1?.toggle?.()} title="Heading 1">
          <Heading1 className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.tf.h2?.toggle?.()} title="Heading 2">
          <Heading2 className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.tf.h3?.toggle?.()} title="Heading 3">
          <Heading3 className="h-4 w-4" />
        </ToolbarBtn>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarBtn onClick={() => editor.tf.bold?.toggle?.()} title="Bold (⌘B)">
          <Bold className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.tf.italic?.toggle?.()} title="Italic (⌘I)">
          <Italic className="h-4 w-4" />
        </ToolbarBtn>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarBtn onClick={() => toggleList(editor, { listStyleType: ListStyleType.Disc })} title="Bullet list">
          <List className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => toggleList(editor, { listStyleType: ListStyleType.Decimal })} title="Numbered list">
          <ListOrdered className="h-4 w-4" />
        </ToolbarBtn>
      </FixedToolbar>
      <Plate editor={editor} onChange={handleChange} className="flex-1 flex flex-col min-h-0">
        <PlateContent
          id={id}
          placeholder={placeholder}
          className="prose prose-sm dark:prose-invert max-w-none min-h-[48rem] flex-1 px-4 py-3 focus:outline-none"
          spellCheck={false}
        />
      </Plate>
    </div>
  )
}
