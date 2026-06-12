import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { validateLink } from './tools/validate-link.js'

const TOOLS = [
  {
    name: 'validate_link',
    description: 'Validate a document URL and retrieve its title and metadata. Returns provider, title, last_edited date, and any error.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The document URL to validate' },
      },
      required: ['url'],
    },
  },
]

export async function startMcpServer() {
  const server = new Server(
    { name: 'upstream', version: '0.2.0' },
    { capabilities: { tools: {} } }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    if (name === 'validate_link') {
      const result = await validateLink(args.url)
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    }
    throw new Error(`Unknown tool: ${name}`)
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
}
