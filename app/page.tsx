'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/dashboard')
    })
  }, [])

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-5 pt-20 text-center">
        <div className="inline-flex bg-indigo-50 text-indigo-600 text-xs font-medium px-3 py-1 rounded-full mb-6">
          Powered by Google Maps + IA
        </div>
        <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-4">
          Descubra onde abrir seu negócio<br />
          com <span className="text-indigo-600">dados reais</span>
        </h1>
        <p className="text-gray-500 text-lg mb-8 leading-relaxed">
          Analise concorrência real do Google Maps, demanda e oportunidades em qualquer cidade do Brasil — em segundos.
        </p>
        <button
          onClick={() => router.push('/auth')}
          className="bg-indigo-600 text-white px-8 py-4 rounded-xl text-base font-semibold hover:bg-indigo-700 transition-colors"
        >
          Começar agora — é grátis
        </button>
        <p className="text-sm text-gray-400 mt-3">2 buscas gratuitas por dia. Sem cartão de crédito.</p>

        <div className="grid grid-cols-2 gap-4 mt-16 text-left">
          {[
            { icon: '📍', t: 'Dados Reais do Google Maps', d: 'Concorrentes reais buscados ao vivo via Google Places API' },
            { icon: '📊', t: 'Score de Oportunidade', d: 'Índice 0–100 baseado em demanda vs. concorrência real' },
            { icon: '🏆', t: 'Ranking de Zonas', d: 'Top 5 melhores bairros calculados por grid geográfico' },
            { icon: '🤖', t: 'Análise com IA', d: 'Insights estratégicos gerados por inteligência artificial' },
          ].map((f, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="text-2xl mb-2">{f.icon}</div>
              <p className="font-medium text-sm text-gray-900 mb-1">{f.t}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}