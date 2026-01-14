interface Env {
  ALLOWED_ORIGINS: string;
  SIGNALING_ROOM: DurableObjectNamespace;
}

interface PuzzleRequest {
  source: string;
  date: string;
}

type SourceConfig = {
  getUrl: (date: Date) => string;
};

function formatDateYYMMDD(date: Date): string {
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

const SOURCES: Record<string, SourceConfig> = {
  universal: {
    getUrl: (date: Date) => {
      const dateStr = formatDateYYMMDD(date);
      return `https://herbach.dnsalias.com/uc/uc${dateStr}.puz`;
    },
  },
  'wapo-sunday': {
    getUrl: (date: Date) => {
      const dateStr = formatDateYYMMDD(date);
      return `https://herbach.dnsalias.com/WaPo/wp${dateStr}.puz`;
    },
  },
  wsj: {
    getUrl: (date: Date) => {
      const dateStr = formatDateYYMMDD(date);
      return `https://herbach.dnsalias.com/wsj/wsj${dateStr}.puz`;
    },
  },
  'universal-sunday': {
    getUrl: (date: Date) => {
      const dateStr = formatDateYYMMDD(date);
      return `https://herbach.dnsalias.com/uc/ucs${dateStr}.puz`;
    },
  },
  jonesin: {
    getUrl: (date: Date) => {
      const dateStr = formatDateYYMMDD(date);
      return `https://herbach.dnsalias.com/Jonesin/jz${dateStr}.puz`;
    },
  },
};

function corsHeaders(_origin: string | null): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

async function handlePuzzleRequest(
  request: Request,
  _env: Env
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
        ...corsHeaders(origin),
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
          ...corsHeaders(origin),
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
        ...corsHeaders(origin),
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
            ...corsHeaders(origin),
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const puzzleData = await response.arrayBuffer();

    return new Response(puzzleData, {
      status: 200,
      headers: {
        ...corsHeaders(origin),
        'Content-Type': 'application/octet-stream',
      },
    });
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      return new Response(JSON.stringify({ error: 'Upstream timeout' }), {
        status: 504,
        headers: {
          ...corsHeaders(origin),
          'Content-Type': 'application/json',
        },
      });
    }

    return new Response(
      JSON.stringify({ error: 'Failed to fetch puzzle' }),
      {
        status: 500,
        headers: {
          ...corsHeaders(origin),
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
    _ctx: ExecutionContext
  ): Promise<Response> {
    const origin = request.headers.get('Origin');

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders(origin),
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
            ...corsHeaders(origin),
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

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: {
        ...corsHeaders(origin),
        'Content-Type': 'application/json',
      },
    });
  },
};

// Export Durable Object class for Cloudflare
export { SignalingRoom } from './SignalingRoom';
