import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { business, city, stats, topZones } = await req.json()

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Você é especialista em inteligência de localização para negócios no Brasil. Analise "${business}" em "${city}". Responda APENAS com JSON válido sem markdown:\n${JSON.stringify({ ...stats, topZones })}\n\n{"resumo":"2 frases","recomendacao":"1 parágrafo","riscos":["r1","r2","r3"],"oportunidades":["o1","o2","o3"],"melhorZona":"bairro e motivo","veredicto":"ABRIR|CAUTELA|EVITAR"}`
      }]
    })
  })

  const data = await res.json()
  const text = data.content?.map((b: any) => b.text || '').join('') || ''

  try {
    return NextResponse.json(JSON.parse(text.replace(/```json|```/g, '').trim()))
  } catch {
    return NextResponse.json({ error: 'Falha ao gerar insight' }, { status: 500 })
  }
}