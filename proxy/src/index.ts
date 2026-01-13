interface Env {
  ALLOWED_ORIGINS: string;
  SIGNALING_ROOM: DurableObjectNamespace;
  WEBSOCKET_SYNC: DurableObjectNamespace;
}

interface PuzzleRequest {
  source: string;
  date: string;
}

type SourceConfig = {
  getUrl: (date: Date) => string;
};

const SOURCES: Record<string, SourceConfig> = {
  universal: {
    getUrl: (date: Date) => {
      const yy = String(date.getUTCFullYear()).slice(-2);
      const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(date.getUTCDate()).padStart(2, '0');
      const dateStr = `${yy}${mm}${dd}`;
      // Martin Herbach's .puz archive (reliable source for Universal crossword)
      return `https://herbach.dnsalias.com/uc/uc${dateStr}.puz`;
    },
  },
};

// Allowed origins for CORS (comma-separated in env)
const ALLOWED_ORIGIN_LIST = [
  'https://msfstef.dev',
  'http://localhost:5173',
  'http://localhost:4173',
];

function isOriginAllowed(origin: string | null, env: Env): boolean {
  if (!origin) return false;
  // Check env override first, then hardcoded list
  const envOrigins = env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
  const allAllowed = [...ALLOWED_ORIGIN_LIST, ...envOrigins];
  return allAllowed.some(allowed =>
    allowed === '*' || allowed === origin
  );
}

function corsHeaders(origin: string | null, env: Env): HeadersInit {
  // Only allow specific origins
  const allowedOrigin = isOriginAllowed(origin, env) ? origin : ALLOWED_ORIGIN_LIST[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin!,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

async function handlePuzzleRequest(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');

  // Parse request body
  let body: PuzzleRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: {
        ...corsHeaders(origin, env),
        'Content-Type': 'application/json',
      },
    });
  }

  const { source, date } = body;

  // Validate source
  if (!source || !SOURCES[source.toLowerCase()]) {
    return new Response(
      JSON.stringify({
        error: 'Invalid source',
        validSources: Object.keys(SOURCES),
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders(origin, env),
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Parse and validate date
  let puzzleDate: Date;
  try {
    puzzleDate = new Date(date);
    if (isNaN(puzzleDate.getTime())) {
      throw new Error('Invalid date');
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid date format' }), {
      status: 400,
      headers: {
        ...corsHeaders(origin, env),
        'Content-Type': 'application/json',
      },
    });
  }

  // Get URL for source
  const sourceConfig = SOURCES[source.toLowerCase()];
  const url = sourceConfig.getUrl(puzzleDate);

  // Fetch puzzle from upstream with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CrossingWords/1.0',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: 'Puzzle not found',
          upstreamStatus: response.status,
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders(origin, env),
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const puzzleData = await response.arrayBuffer();

    return new Response(puzzleData, {
      status: 200,
      headers: {
        ...corsHeaders(origin, env),
        'Content-Type': 'application/octet-stream',
      },
    });
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      return new Response(JSON.stringify({ error: 'Upstream timeout' }), {
        status: 504,
        headers: {
          ...corsHeaders(origin, env),
          'Content-Type': 'application/json',
        },
      });
    }

    return new Response(
      JSON.stringify({ error: 'Failed to fetch puzzle' }),
      {
        status: 500,
        headers: {
          ...corsHeaders(origin, env),
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const origin = request.headers.get('Origin');

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders(origin, env),
      });
    }

    const url = new URL(request.url);

    // Route: POST /puzzle
    if (url.pathname === '/puzzle' && request.method === 'POST') {
      return handlePuzzleRequest(request, env);
    }

    // Health check
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'crossing-words-proxy',
          sources: Object.keys(SOURCES),
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders(origin, env),
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // WebSocket signaling for P2P
    // Uses single DO instance - y-webrtc handles room isolation via topics
    if (url.pathname === '/signaling') {
      const id = env.SIGNALING_ROOM.idFromName('global');
      const stub = env.SIGNALING_ROOM.get(id);
      return stub.fetch(request);
    }

    // WebSocket sync fallback (y-websocket protocol)
    // Uses per-room DO instances for isolation
    // Route: /ywebsocket/{roomId}
    if (url.pathname.startsWith('/ywebsocket/')) {
      const roomId = url.pathname.slice('/ywebsocket/'.length);
      if (!roomId) {
        return new Response(JSON.stringify({ error: 'Room ID required' }), {
          status: 400,
          headers: {
            ...corsHeaders(origin, env),
            'Content-Type': 'application/json',
          },
        });
      }
      // Each room gets its own DO instance
      const id = env.WEBSOCKET_SYNC.idFromName(roomId);
      const stub = env.WEBSOCKET_SYNC.get(id);
      return stub.fetch(request);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: {
        ...corsHeaders(origin, env),
        'Content-Type': 'application/json',
      },
    });
  },
};

// Export Durable Object classes for Cloudflare
export { SignalingRoom } from './SignalingRoom';
export { WebsocketSync } from './WebsocketSync';
