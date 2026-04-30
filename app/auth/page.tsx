'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleSubmit = async () => {
    setLoading(true); setErr('')
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
      if (error) { setErr(error.message); setLoading(false); return }
    } else {
      const { error } = await supabase.auth.signUp({ email, password: pass, options: { data: { name } } })
      if (error) { setErr(error.message); setLoading(false); return }
      // Login automático após cadastro
      const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password: pass })
      if (loginErr) { setErr(loginErr.message); setLoading(false); return }
    }
    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          {mode === 'login' ? 'Entrar na conta' : 'Criar conta'}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {mode === 'login' ? 'Continue suas análises de mercado' : 'Comece gratuitamente, sem cartão'}
        </p>

        {mode === 'register' && (
          <div className="mb-3">
            <label className="text-xs font-medium text-gray-500 block mb-1">Nome</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="João Silva"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-indigo-400" />
          </div>
        )}
        <div className="mb-3">
          <label className="text-xs font-medium text-gray-500 block mb-1">E-mail</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-indigo-400" />
        </div>
        <div className="mb-5">
          <label className="text-xs font-medium text-gray-500 block mb-1">Senha</label>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="mínimo 6 caracteres"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-indigo-400" />
        </div>

        {err && <p className="text-red-600 text-sm mb-3">{err}</p>}

        <button onClick={handleSubmit} disabled={loading}
          className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-semibold mb-4 disabled:opacity-60 hover:bg-indigo-700 transition-colors">
          {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>

        <p className="text-center text-sm text-gray-500">
          {mode === 'login' ? 'Não tem conta? ' : 'Já tem conta? '}
          <span onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr('') }}
            className="text-indigo-600 cursor-pointer font-medium">
            {mode === 'login' ? 'Criar agora' : 'Entrar'}
          </span>
        </p>
      </div>
    </main>
  )
}