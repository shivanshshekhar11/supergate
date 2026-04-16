import { z } from 'zod'

/**
 * OpenAI-compatible chat message schema
 */
export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1),
})

/**
 * Chat completion request schema (OpenAI-compatible)
 */
export const ChatRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(ChatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional().default(false),
  top_p: z.number().min(0).max(1).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
})

/**
 * Chat completion response schema (OpenAI-compatible)
 */
export const ChatResponseSchema = z.object({
  id: z.string(),
  object: z.literal('chat.completion'),
  created: z.number(),
  model: z.string(),
  choices: z.array(
    z.object({
      index: z.number(),
      message: ChatMessageSchema,
      finish_reason: z.enum(['stop', 'length', 'content_filter', 'tool_calls']).nullable(),
    })
  ),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number(),
  }),
  // Gateway-specific headers
  'x-cache': z.enum(['HIT', 'MISS']).optional(),
  'x-latency-ms': z.number().optional(),
  'x-request-id': z.string().optional(),
})

/**
 * Streaming chunk schema for SSE
 */
export const ChatStreamChunkSchema = z.object({
  id: z.string(),
  object: z.literal('chat.completion.chunk'),
  created: z.number(),
  model: z.string(),
  choices: z.array(
    z.object({
      index: z.number(),
      delta: z.object({
        role: z.enum(['system', 'user', 'assistant']).optional(),
        content: z.string().optional(),
      }),
      finish_reason: z.enum(['stop', 'length', 'content_filter', 'tool_calls']).nullable(),
    })
  ),
})

// Inferred TypeScript types
export type ChatMessage = z.infer<typeof ChatMessageSchema>
export type ChatRequest = z.infer<typeof ChatRequestSchema>
export type ChatResponse = z.infer<typeof ChatResponseSchema>
export type ChatStreamChunk = z.infer<typeof ChatStreamChunkSchema>
