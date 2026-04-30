'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const STRIPE_LINK = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK!

const STEPS = ['Geocodificando cidade...', 'Buscando no Google Maps...', 'Calculando densidade...', 'Computando scores...']
const BUSINESS_TYPES = ['Barbearia','Salão de Beleza','Farmácia','Academia','Restaurante','Padaria','Pizzaria','Clínica Médica','Pet Shop','Escola de Idiomas','Loja de Roupas','Supermercado','Lanchonete','Oficina Mecânica','Dentista']
const CITIES = ['Osasco, SP','São Paulo, SP','Campinas, SP','Santos, SP','Guarulhos, SP','Curitiba, PR','Belo Horizonte, MG','Rio de Janeiro, RJ','Salvador, BA','Fortaleza, CE','Manaus, AM','Recife, PE','Porto Alegre, RS','Goiânia, GO']

function scoreColor(s: number) {
  if (s >= 70) return { bg: '#D1FAE5', text: '#065F46', label: 'Alta' }
  if (s >= 40) return { bg: '#FEF3C7', text: '#92400E', label: 'Média' }
  return { bg: '#FEE2E2', text: '#991B1B', label: 'Baixa' }
}

function generateMockData(business: string, city: string) {
  const coords: Record<string, {lat: number, lng: number}> = {
    'Osasco, SP':{lat:-23.532,lng:-46.792},'São Paulo, SP':{lat:-23.550,lng:-46.633},
    'Campinas, SP':{lat:-22.905,lng:-47.063},'Curitiba, PR':{lat:-25.429,lng:-49.271},
    'Rio de Janeiro, RJ':{lat:-22.906,lng:-43.172},'Belo Horizonte, MG':{lat:-19.912,lng:-43.940},
    'Santos, SP':{lat:-23.960,lng:-46.333},'Guarulhos, SP':{lat:-23.462,lng:-46.533},
    'Salvador, BA':{lat:-12.971,lng:-38.501},'Fortaleza, CE':{lat:-3.717,lng:-38.543},
    'Manaus, AM':{lat:-3.119,lng:-60.021},'Recife, PE':{lat:-8.054,lng:-34.881},
    'Porto Alegre, RS':{lat:-30.034,lng:-51.217},'Goiânia, GO':{lat:-16.686,lng:-49.264}
  }
  const base = coords[city] || { lat: -23.532, lng: -46.792 }
  const seed = (business+city).split('').reduce((a,c)=>a+c.charCodeAt(0),0)
  const rng = (o=0) => { const x=Math.sin(seed+o)*10000; return x-Math.floor(x) }
  const nbhds = ['Centro','Vila Nova','Jardim América','Bom Retiro','Jardins','Vila Esperança','Parque Industrial','Cohab','Cidade Nova','Bairro Alto']
  const dirs = ['Norte','Sul','Leste','Oeste','Central','Vila Nova','Jardim','Centro']
  const bCount = 12+Math.floor(rng(1)*20)
  const competitors = Array.from({length:bCount},(_,i)=>({
    id:i, name:`${business} ${dirs[i%8]}`,
    lat:base.lat+(rng(i*3+10)-0.5)*0.08, lng:base.lng+(rng(i*3+11)-0.5)*0.1,
    rating:+(3.2+rng(i+30)*1.8).toFixed(1), reviews:Math.floor(50+rng(i+40)*800),
    address:`Rua ${['das Flores','Brasil','São João','Principal','das Palmeiras'][i%5]}, ${100+i*23} - ${city.split(',')[0]}`,
  }))
  const zones: any[] = []
  for (let r=0;r<5;r++) for (let c=0;c<5;c++) {
    const zlat=base.lat+(r/5-0.5)*0.09, zlng=base.lng+(c/5-0.5)*0.11
    const near=competitors.filter(x=>Math.abs(x.lat-zlat)<0.018&&Math.abs(x.lng-zlng)<0.022)
    const comp=Math.min(near.length/5,1)
    const avgR=near.length>0?near.reduce((s,x)=>s+x.reviews,0)/near.length:100+rng(r*7+c)*200
    const raw=near.length===0?0.6+rng(r*5+c+99)*0.35:(Math.min(avgR/500,1)/Math.max(comp,0.1))
    zones.push({id:`z${r}-${c}`,lat:zlat,lng:zlng,neighborhood:nbhds[(r*5+c)%nbhds.length],
      competitorCount:near.length,avgReviews:Math.round(avgR),score:Math.round(Math.min(raw*60,100))})
  }
  zones.sort((a,b)=>b.score-a.score)
  const totalReviews=competitors.reduce((s,c)=>s+c.reviews,0)
  return {competitors,zones,stats:{
    totalCompetitors:competitors.length,
    avgRating:+(competitors.reduce((s,c)=>s+c.rating,0)/competitors.length).toFixed(1),
    topScore:zones[0]?.score||0,
    demandLevel:totalReviews>8000?'Alta':totalReviews>3000?'Média':'Baixa',
    totalReviews, source:'simulado'
  }}
}

function MiniMap({zones,competitors,city}:{zones:any[],competitors:any[],city:string}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(()=>{
    const canvas=ref.current; if(!canvas||!zones.length) return
    const ctx=canvas.getContext('2d')!,W=canvas.width,H=canvas.height
    ctx.clearRect(0,0,W,H)
    const allLat=[...zones.map((z:any)=>z.lat),...competitors.map((c:any)=>c.lat)]
    const allLng=[...zones.map((z:any)=>z.lng),...competitors.map((c:any)=>c.lng)]
    const[minLat,maxLat]=[Math.min(...allLat)-0.01,Math.max(...allLat)+0.01]
    const[minLng,maxLng]=[Math.min(...allLng)-0.01,Math.max(...allLng)+0.01]
    const toX=(lng:number)=>((lng-minLng)/(maxLng-minLng||1))*(W-40)+20
    const toY=(lat:number)=>H-(((lat-minLat)/(maxLat-minLat||1))*(H-40)+20)
    ctx.fillStyle='#EFF6FF'; ctx.fillRect(0,0,W,H)
    ;(['#DBEAFE','#BFDBFE','#93C5FD'] as string[]).forEach((c,i)=>{ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(W*(0.3+i*0.2),H*(0.3+i*0.15),50+i*20,35+i*15,i*0.5,0,Math.PI*2);ctx.fill()})
    zones.slice(0,5).forEach((z:any)=>{
      const x=toX(z.lng),y=toY(z.lat),c=scoreColor(z.score)
      ctx.globalAlpha=0.4;ctx.fillStyle=c.bg;ctx.beginPath();ctx.roundRect(x-20,y-20,40,40,5);ctx.fill()
      ctx.globalAlpha=1;ctx.strokeStyle=c.text;ctx.lineWidth=1.5;ctx.stroke()
      ctx.fillStyle=c.text;ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText(String(z.score),x,y+5)
    })
    competitors.forEach((c:any)=>{
      const x=toX(c.lng),y=toY(c.lat)
      ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2)
      ctx.fillStyle='#4F46E5';ctx.globalAlpha=0.85;ctx.fill()
      ctx.globalAlpha=1;ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke()
    })
    ctx.fillStyle='#1E3A5F';ctx.font='bold 11px sans-serif';ctx.textAlign='left';ctx.fillText(city.split(',')[0],10,16)
  },[zones,competitors,city])
  return <canvas ref={ref} width={340} height={220} style={{width:'100%',height:220,borderRadius:10,border:'1px solid #E5E7EB'}}/>
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createBrowserClient(SUPA_URL, SUPA_KEY)
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [business, setBusiness] = useState('')
  const [city, setCity] = useState('')
  const [step, setStep] = useState(0)
  const [results, setResults] = useState<any>(null)
  const [aiInsight, setAiInsight] = useState<any>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('mapa')
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [toast, setToast] = useState<any>(null)
  const [recentSearches, setRecentSearches] = useState<any[]>([])

  const showToast = (msg: string, type='info') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000) }

  useEffect(()=>{
    supabase.auth.getSession().then(async({data:{session}})=>{
      if(!session){router.push('/auth');return}
      setSession(session)
      const{data:prof}=await supabase.from('profiles').select('*').eq('id',session.user.id).single()
      if(prof) setProfile(prof)
      const{data:recent}=await supabase.from('searches').select('id,business_type,city,created_at').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(5)
      if(recent) setRecentSearches(recent)
    })
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>{if(!s)router.push('/auth')})
    return()=>subscription.unsubscribe()
  },[])

  const isPro = ()=> profile?.plan==='pro'
  const canSearch = ()=>{
    if(!session)return 0
    if(isPro())return 999
    const today=new Date().toISOString().split('T')[0]
    if(profile?.last_search_date!==today)return 2
    return Math.max(0,2-(profile?.searches_today||0))
  }

  const handleSearch = () => {
    if(!business.trim()||!city.trim())return
    if(canSearch()<=0){setShowUpgrade(true);return}
    setResults(null);setAiInsight(null);setStep(1)
    setTimeout(()=>setStep(2),700)
    setTimeout(()=>setStep(3),1400)
    setTimeout(()=>setStep(4),2100)
    setTimeout(async()=>{
      // Tenta Google Maps real primeiro
      let data:any
      try{
        const r=await fetch(`${SUPA_URL}/functions/v1/google-places`,{
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
          body:JSON.stringify({business,city}),
        })
        if(r.ok) data=await r.json()
        else throw new Error()
      }catch{ data=generateMockData(business,city) }

      setResults(data);setStep(5);setActiveTab('mapa')

      const today=new Date().toISOString().split('T')[0]
      const newCount=profile?.last_search_date===today?(profile.searches_today||0)+1:1
      await supabase.from('profiles').update({searches_today:newCount,last_search_date:today}).eq('id',session.user.id)
      setProfile((p:any)=>({...p,searches_today:newCount,last_search_date:today}))

      showToast(data.source==='google_maps'?'Dados reais do Google Maps!':'Análise concluída!','success')

      setAiLoading(true)
      try{
        const ir=await fetch('/api/insight',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({business,city,stats:data.stats,topZones:data.zones.slice(0,3)})})
        const insight=await ir.json()
        setAiInsight(insight)
      }catch{}
      setAiLoading(false)

      await supabase.from('searches').insert({user_id:session.user.id,business_type:business,city,result_data:data})
      const{data:recent}=await supabase.from('searches').select('id,business_type,city,created_at').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(5)
      if(recent) setRecentSearches(recent)
    },2700)
  }

  const handleLogout = async()=>{ await supabase.auth.signOut(); router.push('/') }
  const searching = step>=1&&step<=4
  const pro = isPro()
  const remaining = canSearch()

  return(
    <div className="min-h-screen bg-gray-50">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {toast&&(
        <div style={{position:'fixed',top:16,right:16,zIndex:999,background:toast.type==='success'?'#D1FAE5':toast.type==='warn'?'#FEF3C7':'#EFF6FF',color:toast.type==='success'?'#065F46':toast.type==='warn'?'#92400E':'#1E40AF',border:`1px solid ${toast.type==='success'?'#6EE7B7':toast.type==='warn'?'#FCD34D':'#BFDBFE'}`,borderRadius:10,padding:'10px 16px',fontSize:14,fontWeight:500,maxWidth:300}}>
          {toast.msg}
        </div>
      )}

      {showUpgrade&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div className="bg-white rounded-2xl p-7 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-start mb-5">
              <div>
                <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded-full">PLANO PRO</span>
                <h3 className="text-2xl font-bold mt-2">R$ 97<span className="text-sm font-normal text-gray-500">/mês</span></h3>
              </div>
              <button onClick={()=>setShowUpgrade(false)} className="text-gray-400 text-xl">×</button>
            </div>
            {['Buscas ilimitadas','Lista completa de concorrentes','Análise IA avançada','Suporte prioritário'].map((f,i)=>(
              <div key={i} className="flex items-center gap-3 mb-3">
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg width="10" height="10" viewBox="0 0 10 10"><polyline points="2,5 4,7 8,3" stroke="#065F46" strokeWidth="1.8" fill="none"/></svg>
                </div>
                <span className="text-sm">{f}</span>
              </div>
            ))}
            <button onClick={()=>{const p=new URLSearchParams();if(session?.user?.email)p.set('prefilled_email',session.user.email);if(session?.user?.id)p.set('client_reference_id',session.user.id);window.open(`${STRIPE_LINK}?${p}`,'_blank')}}
              className="w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold mt-4 hover:bg-indigo-700">
              Assinar agora — R$ 97/mês
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={()=>{setResults(null);setStep(0)}}>
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="6" r="2.5" fill="white"/><path d="M8 2C5.2 2 3 4.2 3 7c0 4 5 9 5 9s5-5 5-9c0-2.8-2.2-5-5-5z" stroke="white" strokeWidth="1.2" fill="none"/></svg>
          </div>
          <span className="font-semibold text-gray-900">GeoSpot <span className="text-indigo-600">AI</span></span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{profile?.name||session?.user?.email?.split('@')[0]}</span>
          {pro?<span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-semibold">Pro</span>
            :<button onClick={()=>setShowUpgrade(true)} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-full">Upgrade Pro</button>}
          <button onClick={handleLogout} className="text-sm text-gray-400">Sair</button>
        </div>
      </div>

      {!results?(
        <div className="max-w-lg mx-auto px-4 py-10">
          <div className="text-center mb-7">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Nova análise de mercado</h2>
            <p className="text-sm text-gray-500 mb-3">Dados reais do Google Maps · Análise com IA</p>
            {!pro&&(
              <span className={`text-xs px-3 py-1.5 rounded-lg inline-block ${remaining===0?'bg-red-50 text-red-700':remaining===1?'bg-yellow-50 text-yellow-700':'bg-indigo-50 text-indigo-600'}`}>
                {remaining===0?'Limite atingido hoje':remaining===1?'Última busca gratuita':`${remaining} buscas gratuitas restantes`}
              </span>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Tipo de negócio</label>
              <input list="biz" value={business} onChange={e=>setBusiness(e.target.value)} placeholder="Ex: barbearia, farmácia..."
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-indigo-400"/>
              <datalist id="biz">{BUSINESS_TYPES.map(b=><option key={b} value={b}/>)}</datalist>
            </div>
            <div className="mb-5">
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Cidade / Região</label>
              <input list="cits" value={city} onChange={e=>setCity(e.target.value)} placeholder="Ex: Osasco, SP"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-indigo-400"/>
              <datalist id="cits">{CITIES.map(c=><option key={c} value={c}/>)}</datalist>
            </div>
            <button onClick={handleSearch} disabled={searching||!business||!city||remaining<=0}
              className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50 hover:bg-indigo-700 transition-colors">
              {searching?'Analisando...':'Analisar oportunidades'}
            </button>
          </div>

          {searching&&(
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              {STEPS.map((s,i)=>(
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <div style={{width:20,height:20,borderRadius:99,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:step>i+1?'#4F46E5':step===i+1?'#4F46E5':'#F3F4F6',border:`2px solid ${step>=i+1?'#4F46E5':'#E5E7EB'}`}}>
                    {step>i+1&&<svg width="10" height="10" viewBox="0 0 10 10"><polyline points="2,5 4,7 8,3" stroke="white" strokeWidth="2" fill="none"/></svg>}
                    {step===i+1&&<div style={{width:8,height:8,borderRadius:99,background:'white'}}/>}
                  </div>
                  <span className={`text-sm ${step>=i+1?'text-gray-900 font-medium':'text-gray-400'}`}>{s}</span>
                </div>
              ))}
            </div>
          )}

          {recentSearches.length>0&&!searching&&(
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mt-4">
              <p className="text-xs font-medium text-gray-400 mb-3">BUSCAS RECENTES</p>
              {recentSearches.map((s,i)=>(
                <div key={s.id} onClick={()=>{setBusiness(s.business_type);setCity(s.city)}}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 rounded px-1">
                  <span className="text-sm text-gray-800">{s.business_type} em {s.city}</span>
                  <span className="text-xs text-indigo-600">Repetir →</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ):(
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-base font-semibold text-gray-900">{business} em {city}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${results.stats.source==='google_maps'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>
                  {results.stats.source==='google_maps'?'📍 Google Maps':'🔮 Simulado'}
                </span>
              </div>
              <p className="text-xs text-gray-500">{results.stats.totalCompetitors} concorrentes · {pro?'ilimitado':`${remaining} busca(s) restante(s)`}</p>
            </div>
            <button onClick={()=>{setResults(null);setStep(0)}} className="text-sm bg-gray-100 px-3 py-1.5 rounded-lg text-gray-700 font-medium">Nova busca</button>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {[{l:'Concorrentes',v:results.stats.totalCompetitors},{l:'Avaliação Média',v:results.stats.avgRating+'★'},{l:'Demanda',v:results.stats.demandLevel},{l:'Melhor Score',v:results.stats.topScore+'/100'}].map((s,i)=>(
              <div key={i} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">{s.l}</p>
                <p className="text-lg font-semibold text-gray-900">{s.v}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
            {[{id:'mapa',l:'Mapa'},{id:'ranking',l:'Ranking'},{id:'concorrentes',l:'Concorrentes'},{id:'ia',l:`IA${aiLoading?' ⟳':''}`}].map(t=>(
              <button key={t.id} onClick={()=>setActiveTab(t.id)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab===t.id?'bg-white text-gray-900 shadow-sm':'text-gray-500'}`}>
                {t.l}
              </button>
            ))}
          </div>

          {activeTab==='mapa'&&(
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
              <div className="flex justify-between items-center mb-3">
                <p className="font-medium text-sm text-gray-900">Mapa de oportunidades</p>
                <div className="flex gap-3">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-600"/><span className="text-xs text-gray-400">Concorrente</span></div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-green-100 border border-green-600"/><span className="text-xs text-gray-400">Zona</span></div>
                </div>
              </div>
              <MiniMap zones={results.zones.slice(0,5)} competitors={results.competitors} city={city}/>
            </div>
          )}

          {activeTab==='ranking'&&results.zones.slice(0,5).map((z:any,i:number)=>{
            const c=scoreColor(z.score)
            return(
              <div key={z.id} className="bg-white border rounded-xl p-4 mb-2 shadow-sm" style={{borderColor:i===0?'#4F46E5':'#F3F4F6'}}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div style={{width:26,height:26,borderRadius:7,background:i===0?'#4F46E5':'#F3F4F6',color:i===0?'white':'#6B7280',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12}}>#{i+1}</div>
                    <div>
                      <p className="font-medium text-sm text-gray-900">{z.neighborhood}</p>
                      <p className="text-xs text-gray-400">{z.competitorCount} concorrentes · {z.avgReviews} aval. médias</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div style={{background:c.bg,color:c.text,borderRadius:99,padding:'3px 12px',fontWeight:600,fontSize:14}}>{z.score}</div>
                    <p style={{fontSize:11,color:c.text,marginTop:2}}>{c.label}</p>
                  </div>
                </div>
                <div className="bg-gray-100 rounded-full h-1.5">
                  <div style={{background:c.text,height:6,borderRadius:6,width:`${z.score}%`,transition:'width 0.6s ease'}}/>
                </div>
              </div>
            )
          })}

          {activeTab==='concorrentes'&&(
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              {results.competitors.slice(0,pro?200:8).map((c:any,i:number,arr:any[])=>(
                <div key={c.id} className="px-4 py-3 flex items-center justify-between" style={{borderBottom:i<arr.length-1?'1px solid #F9FAFB':'none'}}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 mb-0.5">{c.name}</p>
                    <p className="text-xs text-gray-400 truncate">{c.address}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-sm font-medium text-gray-900">{c.rating}★</p>
                    <p className="text-xs text-gray-400">{c.reviews.toLocaleString('pt-BR')} aval.</p>
                  </div>
                </div>
              ))}
              {!pro&&results.competitors.length>8&&(
                <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                  <span className="text-sm text-gray-500">+{results.competitors.length-8} no Pro</span>
                  <button onClick={()=>setShowUpgrade(true)} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg">Upgrade</button>
                </div>
              )}
            </div>
          )}

          {activeTab==='ia'&&(
            aiLoading?(
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8 text-center">
                <div style={{width:34,height:34,border:'3px solid #E0E7FF',borderTop:'3px solid #4F46E5',borderRadius:99,margin:'0 auto 12px',animation:'spin 0.8s linear infinite'}}/>
                <p className="text-sm text-gray-500">Gerando análise com IA...</p>
              </div>
            ):aiInsight?(
              <div className="flex flex-col gap-3">
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold text-gray-900">Veredicto</p>
                    <span style={{background:aiInsight.veredicto==='ABRIR'?'#D1FAE5':aiInsight.veredicto==='CAUTELA'?'#FEF3C7':'#FEE2E2',color:aiInsight.veredicto==='ABRIR'?'#065F46':aiInsight.veredicto==='CAUTELA'?'#92400E':'#991B1B',borderRadius:8,padding:'4px 12px',fontWeight:700,fontSize:13}}>
                      {aiInsight.veredicto==='ABRIR'?'✅ Recomendado abrir':aiInsight.veredicto==='CAUTELA'?'⚠️ Proceder com cautela':'🚫 Não recomendado'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{aiInsight.resumo}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
                  <p className="font-semibold text-gray-900 mb-2">Recomendação estratégica</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{aiInsight.recomendacao}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                    <p className="font-semibold text-xs text-green-800 mb-2">Oportunidades</p>
                    {aiInsight.oportunidades?.map((o:string,i:number)=>(
                      <div key={i} className="flex gap-2 mb-1.5"><span className="text-green-600 text-xs">+</span><p className="text-xs text-green-700 leading-relaxed">{o}</p></div>
                    ))}
                  </div>
                  <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
                    <p className="font-semibold text-xs text-yellow-800 mb-2">Riscos</p>
                    {aiInsight.riscos?.map((r:string,i:number)=>(
                      <div key={i} className="flex gap-2 mb-1.5"><span className="text-yellow-600 text-xs">!</span><p className="text-xs text-yellow-700 leading-relaxed">{r}</p></div>
                    ))}
                  </div>
                </div>
                {aiInsight.melhorZona&&(
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                    <p className="font-semibold text-xs text-indigo-800 mb-1">Melhor zona recomendada</p>
                    <p className="text-sm text-indigo-700">{aiInsight.melhorZona}</p>
                  </div>
                )}
              </div>
            ):(
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8 text-center">
                <p className="text-sm text-gray-500">Análise IA indisponível. Verifique a chave ANTHROPIC_API_KEY.</p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}