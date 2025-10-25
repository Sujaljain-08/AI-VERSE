import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ML_SERVER_URL = 'http://aiverse-ml.eastus.azurecontainer.io:8000'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Forward the request to the ML server's HTTP endpoint
    const response = await fetch(`${ML_SERVER_URL}/analyze-frame`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    
    return Response.json(data)
  } catch (error) {
    console.error('ML Proxy Error:', error)
    return Response.json(
      { error: 'Failed to connect to ML server' },
      { status: 500 }
    )
  }
}
