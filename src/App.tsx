/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useRef } from 'react';
import {
  FileText,
  User,
  CreditCard,
  Calendar,
  CheckCircle,
  Printer,
  Eye,
  Download,
  X,
  Plus,
  Trash2,
  Save,
  Search,
  Users,
  History,
  AlertCircle,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  MessageSquare,
  ScanText,
  ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { extenso, extensoSimples } from './utils/numberToWords';
// @ts-ignore
import html2pdf from 'html2pdf.js';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Contratante {
  id: string;
  nome: string;
  nacionalidade: string;
  estadoCivil: string;
  profissao: string;
  cpf: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  email: string;
  telefone: string;
}

interface ContractData {
  contratantes: Contratante[];
  valorTotal: number;
  valorEntrada: number;
  numParcelas: number;
  duracaoMentoria: number;
  duracaoAulas: number;
  dataContrato: string;
  formaPagamentoSaldo: string;
  dataPrimeiraParcela: string;
  formaPagamentoEntrada: string;
  marcas: string[];
  selectedBonuses: number[];
  bonusDurations: { [key: number]: number };
}

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

interface AnalysisItem {
  tipo: 'erro' | 'aviso' | 'ok';
  mensagem: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const AVAILABLE_BONUSES = [
  { id: 0, title: 'Treinamento "Venda, Valor!"', desc: 'Acesso integral ao curso sobre a metodologia de vendas da CONTRATADA.', defaultDuration: 12 },
  { id: 1, title: 'Agência JCV Scale', desc: 'serviços de marketing digital, conforme escopo de atendimento a ser alinhado na reunião de onboarding.', defaultDuration: 3 },
  { id: 2, title: 'Acompanhamento "JCV ASSESSMENT"', desc: 'acompanhamento com especialista, incluindo diagnóstico de perfil (DISC) e Plano de Desenvolvimento Individual (PDI).', defaultDuration: 1 },
  { id: 3, title: 'Programa "Perfumaria Autorizado"', desc: 'Acesso à lista de contatos de distribuidores de perfumaria, cuja liberação observará a condição estratégica prevista na Cláusula 5.7.1.', defaultDuration: 12 },
  { id: 4, title: 'Estrutura de Filial (SC)', desc: 'direito de uso do espaço físico, mediante assinatura de contrato acessório de cessão de uso, sendo os custos operacionais de responsabilidade do(s) CONTRATANTE(S).', defaultDuration: 3 },
  { id: 5, title: 'ORA CRM + IA', desc: 'licença de uso da plataforma de CRM.', defaultDuration: 1 },
];

const DEFAULT_MARCAS = [
  'DRONES DJI', 'HARMAN & JBL', 'GARMIN', 'REALME & TECNO', 'BASEUS', 'UGREEN',
  'HAVIT', 'QCY', 'GOPRO', 'STANLEY', 'PLAYSTATION', 'ROKU', 'TCL & SEMP',
  'XIAOMI', 'POLAR', 'HOLLYLAND', 'XBOX', 'UNITREE', 'AMAZON ELETRÔNICOS',
  'ASUS', 'ACER', 'MOTOROLA', 'SAMSUNG', 'DISTRIBUIDORAS APPLE',
];

const romanize = (num: number) => {
  const lookup: { [key: string]: number } = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
  let roman = '', i;
  for (i in lookup) { while (num >= lookup[i]) { roman += i; num -= lookup[i]; } }
  return roman;
};

const initialContratante = (): Contratante => ({
  id: Math.random().toString(36).substr(2, 9),
  nome: '', nacionalidade: 'brasileiro(a)', estadoCivil: 'solteiro(a)',
  profissao: '', cpf: '', rua: '', numero: '', bairro: '',
  cidade: '', estado: '', cep: '', email: '', telefone: '',
});

const createInitialData = (): ContractData => ({
  contratantes: [initialContratante()],
  valorTotal: 0, valorEntrada: 0, numParcelas: 1,
  duracaoMentoria: 3, duracaoAulas: 12,
  dataContrato: new Date().toISOString().split('T')[0],
  formaPagamentoSaldo: 'boleto bancário',
  dataPrimeiraParcela: new Date().toISOString().split('T')[0],
  formaPagamentoEntrada: 'cartão de crédito',
  marcas: [...DEFAULT_MARCAS],
  selectedBonuses: [0, 1, 2, 3, 4, 5],
  bonusDurations: AVAILABLE_BONUSES.reduce((acc, b) => ({ ...acc, [b.id]: b.defaultDuration }), {}),
});

const maskCpf = (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
const maskPhone = (v: string) => v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{4})\d+?$/, '$1');
const maskCep = (v: string) => v.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{3})\d+?$/, '$1');

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

async function callClaude(systemPrompt: string, messages: { role: string; content: string }[]): Promise<string> {
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1000, system: systemPrompt, messages }),
  });
  const data = await resp.json();
  return data.content?.[0]?.text || '';
}

// ─── AI Panel Component ───────────────────────────────────────────────────────

function AiPanel({ data, onApplyContratante }: { data: ContractData; onApplyContratante: (fields: Partial<Contratante>, index: number) => void }) {
  const [activeTab, setActiveTab] = useState<'extrator' | 'analise' | 'chat'>('extrator');
  const [rawText, setRawText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<Partial<Contratante> | null>(null);
  const [extractObs, setExtractObs] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisItems, setAnalysisItems] = useState<AnalysisItem[] | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'ai', content: 'Olá! Posso tirar dúvidas sobre preenchimento, cláusulas ou condições do contrato. O que precisa?' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [targetContratante, setTargetContratante] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fieldLabels: Record<string, string> = {
    nome: 'Nome', nacionalidade: 'Nacionalidade', estadoCivil: 'Estado civil',
    profissao: 'Profissão', cpf: 'CPF', email: 'Email', telefone: 'Telefone',
    rua: 'Logradouro', numero: 'Número', bairro: 'Bairro', cidade: 'Cidade', estado: 'Estado', cep: 'CEP',
  };

  async function handleExtract() {
    if (!rawText.trim()) return;
    setExtracting(true);
    setExtracted(null);
    try {
      const system = `Você é um extrator de dados para contratos brasileiros. Extraia os campos abaixo e retorne APENAS JSON válido, sem texto fora do JSON. Se um campo não for encontrado, use string vazia "". Campos: nome, nacionalidade, estadoCivil, profissao, cpf, email, telefone, rua, numero, bairro, cidade, estado, cep.`;
      const raw = await callClaude(system, [{ role: 'user', content: rawText }]);
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed: Partial<Contratante> = JSON.parse(clean);
      setExtracted(parsed);
      const missing = Object.entries(parsed).filter(([, v]) => !v).map(([k]) => fieldLabels[k] || k);
      setExtractObs(missing.length ? `Não encontrado: ${missing.join(', ')}.` : 'Todos os campos identificados.');
    } catch {
      setExtractObs('Erro ao processar. Tente novamente.');
    }
    setExtracting(false);
  }

  function handleApply() {
    if (!extracted) return;
    onApplyContratante(extracted, targetContratante);
    setExtractObs('✓ Dados aplicados ao contratante ' + (targetContratante + 1) + '!');
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setAnalysisItems(null);
    const saldo = data.valorTotal - data.valorEntrada;
    const parcela = data.numParcelas > 0 ? (saldo / data.numParcelas).toFixed(2) : 'indefinido';
    const bonus = data.selectedBonuses.map(id => AVAILABLE_BONUSES.find(b => b.id === id)?.title).filter(Boolean).join(', ');
    const system = `Você é um assistente jurídico especialista em contratos de mentoria brasileiros. Analise os dados e retorne APENAS JSON: {"erros":[{"tipo":"erro|aviso|ok","mensagem":"..."}]}. Verifique: entrada maior que total, saldo sem parcelas, valores zerados, duração incomum para o valor, nome ausente. Seja objetivo em português.`;
    const msg = `nome="${data.contratantes[0]?.nome || 'não informado'}", valorTotal=${data.valorTotal}, valorEntrada=${data.valorEntrada}, saldo=${saldo}, parcelas=${data.numParcelas}, valorParcela=${parcela}, duracaoMentoria=${data.duracaoMentoria}meses, duracaoAulas=${data.duracaoAulas}meses, bonus="${bonus || 'nenhum'}"`;
    try {
      const raw = await callClaude(system, [{ role: 'user', content: msg }]);
      const clean = raw.replace(/```json|```/g, '').trim();
      const result = JSON.parse(clean);
      setAnalysisItems(result.erros || []);
    } catch {
      setAnalysisItems([{ tipo: 'erro', mensagem: 'Erro ao analisar. Tente novamente.' }]);
    }
    setAnalyzing(false);
  }

  async function handleChat() {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput('');
    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: msg }];
    setChatMessages(newMessages);
    setChatLoading(true);
    const system = `Você é o assistente do sistema JCV Contract, especializado no contrato "MENTORIA AUTORIZADO" da JCV Academy LTDA. Responda dúvidas sobre cláusulas, valores, bônus, rescisão, LGPD, não concorrência e preenchimento. Seja direto e objetivo em português. Máximo 3 parágrafos.`;
    const apiMessages = newMessages.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }));
    try {
      const reply = await callClaude(system, apiMessages);
      setChatMessages([...newMessages, { role: 'ai', content: reply }]);
    } catch {
      setChatMessages([...newMessages, { role: 'ai', content: 'Erro ao conectar. Tente novamente.' }]);
    }
    setChatLoading(false);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }

  const tabs = [
    { key: 'extrator', label: 'Extrair dados', icon: <ScanText size={13} /> },
    { key: 'analise', label: 'Análise', icon: <ShieldCheck size={13} /> },
    { key: 'chat', label: 'Assistente', icon: <MessageSquare size={13} /> },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200">
      {/* Header */}
      <div className="flex-none px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center">
            <Sparkles size={13} className="text-violet-600" />
          </div>
          <span className="text-sm font-bold text-slate-700">Assistente IA</span>
          <span className="ml-auto px-1.5 py-0.5 bg-violet-50 text-violet-600 text-[9pt] font-bold rounded">Claude</span>
        </div>
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10pt] font-semibold transition-all ${activeTab === t.key ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* ── EXTRATOR ── */}
        {activeTab === 'extrator' && (
          <div className="space-y-3">
            <p className="text-[11pt] text-slate-500 leading-relaxed">Cole qualquer texto com os dados do contratante. A IA extrai os campos automaticamente.</p>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="Ex: João da Silva, CPF 123.456.789-00, solteiro, engenheiro. Rua das Flores 42, Centro, Florianópolis/SC. joao@email.com (48) 99999-0000."
              className="w-full h-28 px-3 py-2.5 text-[11pt] border border-slate-200 rounded-xl resize-none outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50 transition-all"
            />
            {data.contratantes.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-[10pt] text-slate-500">Aplicar ao contratante:</span>
                <select
                  value={targetContratante}
                  onChange={e => setTargetContratante(parseInt(e.target.value))}
                  className="px-2 py-1 border border-slate-200 rounded-lg text-[10pt] outline-none"
                >
                  {data.contratantes.map((c, i) => (
                    <option key={c.id} value={i}>{c.nome || `Contratante ${i + 1}`}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={handleExtract}
              disabled={extracting || !rawText.trim()}
              className="w-full py-2.5 bg-violet-600 text-white rounded-xl text-[11pt] font-bold hover:bg-violet-700 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              {extracting ? (
                <><span className="animate-spin">⟳</span> Extraindo...</>
              ) : (
                <><ScanText size={14} /> Extrair dados</>
              )}
            </button>

            {extracted && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(extracted).map(([k, v]) => (
                    k !== 'id' && (
                      <div key={k} className={`px-2.5 py-2 rounded-lg border text-[10pt] ${v ? 'border-slate-100 bg-slate-50' : 'border-red-100 bg-red-50'}`}>
                        <div className="text-[8.5pt] text-slate-400 uppercase tracking-wider mb-0.5">{fieldLabels[k] || k}</div>
                        <div className={`font-semibold truncate ${v ? 'text-slate-700' : 'text-red-400 italic'}`}>{v || 'não encontrado'}</div>
                      </div>
                    )
                  ))}
                </div>
                {extractObs && (
                  <p className={`text-[10pt] ${extractObs.startsWith('✓') ? 'text-emerald-600' : extractObs.startsWith('Não') ? 'text-amber-600' : 'text-slate-500'}`}>{extractObs}</p>
                )}
                <button
                  onClick={handleApply}
                  className="w-full py-2 bg-emerald-600 text-white rounded-xl text-[11pt] font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle size={14} /> Aplicar ao formulário
                </button>
              </div>
            )}
            {!extracted && extractObs && (
              <p className="text-[10pt] text-red-500">{extractObs}</p>
            )}
          </div>
        )}

        {/* ── ANÁLISE ── */}
        {activeTab === 'analise' && (
          <div className="space-y-3">
            <p className="text-[11pt] text-slate-500 leading-relaxed">A IA analisa os dados atuais do contrato e aponta erros, avisos e confirmações.</p>
            <div className="bg-slate-50 rounded-xl border border-slate-100 p-3 space-y-2 text-[10pt]">
              <div className="flex justify-between text-slate-600"><span>Valor total</span><span className="font-bold text-slate-800">{data.valorTotal > 0 ? `R$ ${data.valorTotal.toLocaleString('pt-BR')}` : '—'}</span></div>
              <div className="flex justify-between text-slate-600"><span>Entrada</span><span className="font-bold text-slate-800">{data.valorEntrada > 0 ? `R$ ${data.valorEntrada.toLocaleString('pt-BR')}` : '—'}</span></div>
              <div className="flex justify-between text-slate-600"><span>Saldo / parcelas</span><span className="font-bold text-slate-800">R$ {(data.valorTotal - data.valorEntrada).toLocaleString('pt-BR')} / {data.numParcelas}x</span></div>
              <div className="flex justify-between text-slate-600"><span>Duração mentoria</span><span className="font-bold text-slate-800">{data.duracaoMentoria} meses</span></div>
              <div className="flex justify-between text-slate-600"><span>Contratante</span><span className="font-bold text-slate-800 truncate max-w-[130px]">{data.contratantes[0]?.nome || '—'}</span></div>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="w-full py-2.5 bg-violet-600 text-white rounded-xl text-[11pt] font-bold hover:bg-violet-700 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              {analyzing ? <><span className="animate-spin">⟳</span> Analisando...</> : <><ShieldCheck size={14} /> Analisar agora</>}
            </button>

            {analysisItems && (
              <div className="space-y-2">
                {analysisItems.length === 0 && (
                  <div className="flex gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <CheckCircle size={15} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span className="text-[11pt] text-emerald-700">Nenhum problema encontrado.</span>
                  </div>
                )}
                {analysisItems.map((item, i) => (
                  <div key={i} className={`flex gap-2 p-3 rounded-xl border text-[11pt] ${item.tipo === 'erro' ? 'bg-red-50 border-red-100 text-red-700' : item.tipo === 'aviso' ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                    {item.tipo === 'erro' ? <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /> : item.tipo === 'aviso' ? <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /> : <CheckCircle size={15} className="flex-shrink-0 mt-0.5" />}
                    <span className="leading-snug">{item.mensagem}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CHAT ── */}
        {activeTab === 'chat' && (
          <div className="space-y-3 flex flex-col h-full">
            <div className="flex-1 space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] px-3 py-2 rounded-xl text-[11pt] leading-relaxed ${m.role === 'user' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl flex gap-1 items-center">
                    {[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />)}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {['Cláusula de não concorrência', 'Direito de arrependimento', 'Multa por rescisão'].map(q => (
                <button key={q} onClick={() => { setChatInput(q); }} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[9.5pt] text-slate-500 hover:border-violet-300 hover:text-violet-600 transition-all">
                  {q}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChat()}
                placeholder="Tire sua dúvida..."
                className="flex-1 px-3 py-2 text-[11pt] border border-slate-200 rounded-xl outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50 transition-all"
              />
              <button
                onClick={handleChat}
                disabled={chatLoading || !chatInput.trim()}
                className="px-3 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-40 transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const sanitizeContractData = (incoming: any): ContractData => {
    let sanitizedContratantes = incoming.contratantes;
    if (!sanitizedContratantes) {
      if (incoming.nome) {
        sanitizedContratantes = [{ id: '1', nome: incoming.nome, nacionalidade: incoming.nacionalidade || 'brasileiro(a)', estadoCivil: incoming.estadoCivil || 'solteiro(a)', profissao: incoming.profissao || '', cpf: incoming.cpf || '', rua: incoming.rua || '', numero: incoming.numero || '', bairro: incoming.bairro || '', cidade: incoming.cidade || '', estado: incoming.estado || '', cep: incoming.cep || '', email: incoming.email || '', telefone: incoming.telefone || '' }];
      } else {
        sanitizedContratantes = [initialContratante()];
      }
    }
    return { ...createInitialData(), ...incoming, contratantes: sanitizedContratantes, marcas: incoming.marcas || createInitialData().marcas, selectedBonuses: incoming.selectedBonuses || createInitialData().selectedBonuses, duracaoMentoria: incoming.duracaoMentoria || 3, duracaoAulas: incoming.duracaoAulas || 12, bonusDurations: incoming.bonusDurations || createInitialData().bonusDurations };
  };

  const [data, setData] = React.useState<ContractData>(() => {
    const saved = localStorage.getItem('jcv-contract-draft');
    if (saved) { try { return sanitizeContractData(JSON.parse(saved)); } catch { return createInitialData(); } }
    return createInitialData();
  });

  const [history, setHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('jcv-contract-history');
    return saved ? JSON.parse(saved) : [];
  });

  const [loadingCep, setLoadingCep] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);

  React.useEffect(() => { localStorage.setItem('jcv-contract-draft', JSON.stringify(data)); }, [data]);
  React.useEffect(() => { localStorage.setItem('jcv-contract-history', JSON.stringify(history)); }, [history]);

  const [showHistory, setShowHistory] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [newMarca, setNewMarca] = useState('');
  const printRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setData(prev => ({ ...prev, [name]: name === 'valorTotal' || name === 'valorEntrada' || name === 'numParcelas' ? parseFloat(value) || 0 : value }));
  };

  const handleContratanteChange = (id: string, field: keyof Contratante, value: string) => {
    let v = value;
    if (field === 'cpf') v = maskCpf(value);
    if (field === 'telefone') v = maskPhone(value);
    if (field === 'cep') v = maskCep(value);
    setData(prev => ({ ...prev, contratantes: prev.contratantes.map(c => c.id === id ? { ...c, [field]: v } : c) }));
    if (field === 'cep' && v.length === 9) fetchCep(id, v.replace('-', ''));
  };

  // Apply extracted AI data to a contratante
  const handleApplyContratante = (fields: Partial<Contratante>, index: number) => {
    setData(prev => {
      const updated = [...prev.contratantes];
      if (updated[index]) {
        updated[index] = { ...updated[index], ...fields };
      }
      return { ...prev, contratantes: updated };
    });
  };

  const fetchCep = async (contratanteId: string, cep: string) => {
    setLoadingCep(contratanteId);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const result = await response.json();
      if (!result.erro) {
        setData(prev => ({ ...prev, contratantes: prev.contratantes.map(c => c.id === contratanteId ? { ...c, rua: result.logradouro || c.rua, bairro: result.bairro || c.bairro, cidade: result.localidade || c.cidade, estado: result.uf || c.estado } : c) }));
      }
    } catch { console.error('CEP error'); } finally { setLoadingCep(null); }
  };

  const addContratante = () => { if (data.contratantes.length < 2) setData(prev => ({ ...prev, contratantes: [...prev.contratantes, initialContratante()] })); };
  const removeContratante = (id: string) => { if (data.contratantes.length > 1) setData(prev => ({ ...prev, contratantes: prev.contratantes.filter(c => c.id !== id) })); };

  const validateContract = () => {
    const newErrors: string[] = [];
    data.contratantes.forEach((c, idx) => {
      const label = `Contratante ${idx + 1}`;
      if (!c.nome) newErrors.push(`${label}: Nome obrigatório`);
      if (c.cpf.length < 14) newErrors.push(`${label}: CPF inválido`);
      if (!c.email) newErrors.push(`${label}: Email obrigatório`);
    });
    if (data.valorTotal <= 0) newErrors.push('Valor total deve ser maior que zero');
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const saveToHistory = () => {
    const entry = { id: Date.now(), date: new Date().toLocaleString(), clientName: data.contratantes[0].nome || 'Rascunho', data: { ...data } };
    setHistory(prev => [entry, ...prev].slice(0, 10));
  };

  const addMarca = () => { if (newMarca.trim()) { setData(prev => ({ ...prev, marcas: [...prev.marcas, newMarca.trim().toUpperCase()] })); setNewMarca(''); } };
  const removeMarca = (index: number) => setData(prev => ({ ...prev, marcas: prev.marcas.filter((_, i) => i !== index) }));

  const toggleBonus = (id: number) => setData(prev => ({ ...prev, selectedBonuses: prev.selectedBonuses.includes(id) ? prev.selectedBonuses.filter(bId => bId !== id) : [...prev.selectedBonuses, id].sort((a, b) => a - b) }));
  const handleBonusDurationChange = (bonusId: number, duration: number) => setData(prev => ({ ...prev, bonusDurations: { ...prev.bonusDurations, [bonusId]: duration } }));

  const downloadPdf = () => {
    if (!validateContract()) return;
    saveToHistory();
    const element = pdfRef.current;
    const opt = { margin: [15, 15, 15, 15], filename: `Contrato_${data.contratantes[0].nome.replace(/\s+/g, '_')}.pdf`, image: { type: 'jpeg' as const, quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false, windowWidth: 794 }, jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }, pagebreak: { mode: ['avoid-all', 'css', 'legacy'] } };
    html2pdf().from(element).set(opt).save();
  };

  const handlePrint = () => { validateContract(); saveToHistory(); setTimeout(() => window.print(), 100); };
  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const saldoRemanescente = data.valorTotal - data.valorEntrada;
  const valorParcela = data.numParcelas > 0 ? saldoRemanescente / data.numParcelas : 0;
  const formatDuration = (months: number) => { const text = months === 1 ? 'mês' : 'meses'; return `${months} (${extensoSimples(months)}) ${text}`; };

  const ContractPreview = ({ isPrint = false, refToUse = null }: { isPrint?: boolean, refToUse?: React.RefObject<HTMLDivElement | null> | null }) => (
    <div
      ref={refToUse}
      className={`bg-white w-full ${isPrint ? 'max-w-none' : 'max-w-[210mm] shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-doc-border min-h-[297mm]'} p-[10mm] md:p-[20mm] text-[11pt] leading-snug text-doc-text font-serif print:shadow-none print:border-none print:p-0 ${isPrint ? '' : 'mx-auto'}`}
    >

      <div className="flex justify-between items-start mb-4 border-b border-doc-divider pb-2 pdf-page-break-avoid">
        <div className="text-[9pt] text-doc-muted font-sans space-y-0"><p>91 98156-6037 • robertomaues@gmail.com</p><p>Rua Municipalidade, n. 985, Sala 1108, Belém/PA</p></div>
        <div className="text-right font-sans"><div className="italic text-base font-bold tracking-tighter text-doc-text leading-none">MAUÉS</div><div className="text-[7pt] uppercase tracking-[0.2em] font-bold text-doc-light">Advogados Associados</div></div>
      </div>
      <div className="text-center font-bold mb-4 uppercase pdf-page-break-avoid"><h1 className="text-[12pt] underline underline-offset-4 decoration-doc-divider">INSTRUMENTO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS DE MENTORIA E INFOPRODUTO – "MENTORIA AUTORIZADO"</h1></div>
      <div className="space-y-2 text-justify">
        {data.contratantes.map((c, idx) => (
          <p key={c.id}>
            <span className="font-bold text-doc-text">CONTRATANTE {data.contratantes.length > 1 ? idx + 1 : ''}:</span>{' '}
            <span className={!c.nome ? 'bg-doc-accent-bg text-doc-accent px-1 font-bold' : ''}>{c.nome || 'NOME DA PESSOA'}</span>, nacionalidade <span className={!c.nacionalidade ? 'bg-doc-accent-bg text-doc-accent px-1 font-bold' : ''}>{c.nacionalidade}</span>, estado civil <span className={!c.estadoCivil ? 'bg-doc-accent-bg text-doc-accent px-1 font-bold' : ''}>{c.estadoCivil}</span>, profissão <span className={!c.profissao ? 'bg-doc-accent-bg text-doc-accent px-1 font-bold' : ''}>{c.profissao || 'PROFISSÃO'}</span>, inscrito no CPF sob o nº <span className={!c.cpf ? 'bg-doc-accent-bg text-doc-accent px-1 font-bold' : ''}>{c.cpf || 'xxx.xxx.xxx-xx'}</span>, residente e domiciliado na Rua: <span className={!c.rua ? 'bg-doc-accent-bg text-doc-accent px-1 font-bold' : ''}>{c.rua || 'xxxx'}</span>, nº <span className={!c.numero ? 'bg-doc-accent-bg text-doc-accent px-1 font-bold' : ''}>{c.numero || 'xxx'}</span>, Bairro: <span className={!c.bairro ? 'bg-doc-accent-bg text-doc-accent px-1 font-bold' : ''}>{c.bairro || 'xxxxx'}</span>, Cidade: <span className={!c.cidade ? 'bg-doc-accent-bg text-doc-accent px-1 font-bold' : ''}>{c.cidade || 'xxxxx'}</span> / Estado: <span className={!c.estado ? 'bg-doc-accent-bg text-doc-accent px-1 font-bold' : ''}>{c.estado || 'XX'}</span>, CEP: <span className={!c.cep ? 'bg-doc-accent-bg text-doc-accent px-1 font-bold' : ''}>{c.cep || 'XXXXX-XXX'}</span>, com endereço de e-mail: <span className={!c.email ? 'bg-doc-accent-bg text-doc-accent px-1 font-bold' : ''}>{c.email || 'XXXXXXX'}</span> e telefone: <span className={!c.telefone ? 'bg-doc-accent-bg text-doc-accent px-1 font-bold' : ''}>{c.telefone || '(XX) XXXXX-XXXX'}</span>.
          </p>
        ))}
        <p><span className="font-bold text-doc-text">CONTRATADA: JCV ACADEMY LTDA</span>, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 52.824.603/0001-01, com sede na Av. Coronel João Fernandes, nº 439, Sala 05, Centro, Araranguá/SC, CEP: 88900-003, neste ato representada por seu sócio-administrador, Sr. <span className="font-bold">VICTOR MATTOS</span>.</p>
        <p>As partes acima identificadas têm, entre si, justo e acertado o presente Instrumento Particular de Prestação de Serviços de Mentoria e Infoproduto, que se regerá pelas cláusulas seguintes e pelas condições de preço, forma e termo de pagamento descritas no presente, bem como nos fundamentos dos arts. 46 a 52 do Código de Defesa do Consumidor e dos arts. 593 a 609 do Código Civil.</p>
        <div className="bg-doc-section-bg py-1 border-y border-doc-divider font-bold text-center uppercase tracking-tight text-[10pt] font-sans mt-2 text-doc-text pdf-page-break-avoid">CLÁUSULA PRIMEIRA- DO OBJETO</div>
        <p>1.1. O objeto do presente instrumento é a prestação de serviços de mentoria e infoproduto, aqui denominado "MENTORIA AUTORIZADO", direcionado à capacitação do(s) CONTRATANTE(S) em gestão, marketing, comercial, suporte e vendas/revendas de produtos eletrônicos. A prestação dos serviços constitui uma obrigação de meio, e não de resultado.</p>
        <p>1.2. O Programa principal será executado conforme o seguinte escopo e metodologia:</p>
        <p className="pl-6">a) O serviço será realizado integralmente na modalidade online e à distância, por meio de aulas ao vivo e/ou gravadas, disponibilizadas em plataforma virtual acessível por equipamentos com os requisitos técnicos mínimos.</p>
        <p className="pl-6">b) A mentoria terá a duração de {formatDuration(data.duracaoMentoria)}, contados a partir da data da primeira aula, compreendendo 1 (um) encontro semanal em grupo e 1 (um) encontro mensal individual.</p>
        <p className="pl-6">c) As aulas gravadas estarão disponíveis na plataforma pelo prazo de {formatDuration(data.duracaoAulas)}, contados da data de liberação do acesso inicial, independentemente do término da duração da mentoria ao vivo.</p>
        <p className="pl-6">d) O acesso à Lista de Fornecedores, Distribuidores e Contatos Comerciais Estratégicos do programa terá caráter perpétuo, pessoal, intransferível e não exclusivo, sendo sua liberação realizada somente após o 8º (oitavo) dia da assinatura deste contrato, nos termos da Cláusula 5.7.1.</p>
        <p className="pl-6">e) O término do prazo da mentoria previsto na alínea 'b' ou do acesso às aulas gravadas previsto na alínea 'c' não extingue o direito de acesso perpétuo referido na alínea 'e', que permanecerá vigente, desde que observadas e cumpridas as obrigações de Propriedade Intelectual, Confidencialidade, Não Concorrência e Proteção do Ecossistema (Cláusulas Sexta e Oitava), sob pena de revogação imediata do acesso.</p>
        <p className="pl-6">f) O aproveitamento das aulas é sequencial. A presença e o acompanhamento são de responsabilidade do(s) CONTRATANTE(S), e o não comparecimento às transmissões ao vivo não implicará direito a reposição de aulas ou alteração de prazos.</p>
        <p>1.3. Adicionalmente, a título de bonificação e como parte integrante da oferta, a CONTRATADA concederá ao(s) CONTRATANTE(S), sem custo adicional e enquanto o contrato estiver vigente e adimplente, acesso aos seguintes serviços e plataformas ("Bônus"):</p>
        <div className="pl-6 space-y-1">
          {data.selectedBonuses.length > 0 ? data.selectedBonuses.map((bonusId, index) => { const bonus = AVAILABLE_BONUSES.find(b => b.id === bonusId); if (!bonus) return null; const duration = data.bonusDurations[bonusId] || bonus.defaultDuration; return (<p key={bonusId}><span className="font-bold">{romanize(index + 1)}. {bonus.title}:</span> {formatDuration(duration)} de {bonus.desc}</p>); }) : <p className="italic text-slate-400">Nenhum bônus selecionado.</p>}
        </div>
        <p>1.4. O acesso aos Bônus é uma liberalidade da CONTRATADA, vinculada à adimplência e vigência deste contrato. A não utilização de qualquer Bônus não gera direito a desconto ou crédito. A continuidade dos serviços listados nos bônus após os períodos de gratuidade dependerá de nova e expressa contratação entre as partes.</p>
        <div className="bg-doc-section-bg py-1 border-y border-doc-divider font-bold text-center uppercase tracking-tight text-[10pt] font-sans mt-2 text-doc-text pdf-page-break-avoid">CLÁUSULA SEGUNDA- DAS OBRIGAÇÕES DA CONTRATADA</div>
        <p>2.1. A CONTRATADA, por meio de seus mentores e equipe, pautará sua atuação conforme os objetivos do(s) CONTRATANTE(S), valendo-se de sua experiência e conhecimento para prestar os serviços de forma ética, sigilosa e diligente, priorizando os interesses do(s) CONTRATANTE(S).</p>
        <p>2.2. Para a fiel execução do objeto contratual, compete especificamente à CONTRATADA:</p>
        <p className="pl-6">a) Liberar Acessos: Conceder ao(s) CONTRATANTE(S), após a devida confirmação financeira, as credenciais de acesso à plataforma virtual do Programa.</p>
        <p className="pl-6">b) Realizar as Entregas do Programa Principal: Cumprir o cronograma de mentorias em grupo e individuais, sendo pontual e transparente com os compromissos assumidos, e manter os conteúdos gravados e materiais de apoio disponíveis na plataforma durante a vigência do contrato.</p>
        <p className="pl-6">c) Assegurar a prestação e o acesso aos serviços de bonificação (listados na Cláusula 1.3), nos termos e prazos ali definidos, condicionada à adimplência do(s) CONTRATANTE(S).</p>
        <p className="pl-6">d) Fornecer direcionamento e feedbacks sobre as ações do(s) CONTRATANTE(S) de maneira franca e didática, bem como oferecer suporte para dúvidas relacionadas ao conteúdo do Programa através dos canais oficiais.</p>
        <p className="pl-6">e) Guardar absoluto sigilo sobre todas as informações e dados do(s) CONTRATANTE(S) a que tiver acesso.</p>
        <p>2.3. A CONTRATADA não será responsável por resultados financeiros ou comerciais não alcançados que dependam exclusivamente da dedicação, empenho, capacidade de execução ou decisões de investimento do(s) CONTRATANTE(S). A obrigação da CONTRATADA é estritamente de meio (fornecer o conhecimento, as ferramentas e a orientação), e não de fim (garantir um resultado específico).</p>
        <div className="bg-doc-section-bg py-1 border-y border-doc-divider font-bold text-center uppercase tracking-tight text-[10pt] font-sans mt-2 text-doc-text pdf-page-break-avoid">CLÁUSULA TERCEIRA- DO ACESSO PERPÉTUO ÀS MARCAS PARCEIRAS</div>
        <p>3.1. A assinatura deste contrato confere ao(à) CONTRATANTE, de forma perpétua, o acesso ao know-how, processos e contatos para buscar a certificação como revendedor autorizado junto às seguintes marcas e distribuidoras parceiras da CONTRATADA:</p>
        <div className="grid grid-cols-3 gap-x-4 text-[10pt] font-mono border border-doc-divider p-2 rounded pdf-page-break-avoid">{data.marcas.map((m, i) => <div key={i}>{m}</div>)}</div>
        <p>3.2. Fica expressamente estabelecido que a CONTRATADA garante o acesso ao caminho para a obtenção da autorização, mas não o resultado final. É de responsabilidade única e exclusiva do(a) CONTRATANTE cumprir todas as exigências, políticas e critérios definidos por cada marca ou distribuidora para obter e manter a certificação.</p>
        <p>3.3. Eventuais novas marcas com as quais a CONTRATADA venha a estabelecer parceria terão seu acesso igualmente disponibilizado ao(à) CONTRATANTE, nos mesmos termos desta cláusula.</p>
        <div className="bg-doc-section-bg py-1 border-y border-doc-divider font-bold text-center uppercase tracking-tight text-[10pt] font-sans mt-2 text-doc-text pdf-page-break-avoid">CLÁUSULA QUARTA- DAS OBRIGAÇÕES DO (S) CONTRATANTES</div>
        <p>4.1. Para o pleno aproveitamento do Programa e a busca por seus objetivos, o(s) CONTRATANTE(S) é(são) parte ativa e essencial do processo.</p>
        <p>4.2. São obrigações fundamentais do(s) CONTRATANTE(S):</p>
        <p className="pl-6">a) Realizar o pagamento do valor do investimento, nos exatos termos e prazos definidos na Cláusula de Investimento, sendo esta sua obrigação principal e condição para o acesso e manutenção dos serviços.</p>
        <p className="pl-6">b) Dedicar tempo e recursos para a aplicação das técnicas e tarefas propostas, bem como fornecer feedbacks honestos sobre seus progressos e desafios, manifestando imediatamente qualquer objeção ou dificuldade encontrada.</p>
        <p className="pl-6">c) Zelar pelo sigilo absoluto de todas as informações e materiais recebidos, sendo-lhe expressamente vedado, sob pena de rescisão imediata e aplicação das multas cabíveis: i. Gravar, copiar, reproduzir, compartilhar ou distribuir a terceiros, por qualquer meio, o conteúdo das aulas, mentorias, vídeos, slides, metodologias e materiais de apoio. ii. Divulgar, compartilhar ou utilizar para benefício próprio ou de terceiros as listas de fornecedores, contatos comerciais e estratégias de negócio que compõem o segredo industrial da CONTRATADA.</p>
        <p className="pl-6">d) Abster-se de exercer, direta ou indiretamente, pelo prazo de 5 (cinco) anos a contar da assinatura deste contrato, atividades de ensino, mentoria, consultoria ou qualquer programa educacional que concorra diretamente com o objeto deste contrato.</p>
        <p className="pl-6">e) i. Não utilizar os contatos, o ambiente e os recursos do Programa para fins comerciais próprios ou de terceiros que não estejam alinhados ao objeto da mentoria, sem autorização expressa da CONTRATADA. ii. Não oferecer, negociar ou divulgar produtos ou serviços próprios a outros participantes do Programa sem autorização prévia e por escrito da CONTRATADA.</p>
        <p className="pl-6">f) Reconhecer que quaisquer relacionamentos comerciais ou interpessoais estabelecidos com outros participantes são de sua inteira responsabilidade, isentando a CONTRATADA de qualquer vínculo, aval ou responsabilidade solidária/subsidiária.</p>
        <p className="pl-6">g) Manter seus dados cadastrais atualizados e responsabilizar-se pela veracidade de todas as informações fornecidas no ato da contratação.</p>
        <div className="bg-doc-section-bg py-1 border-y border-doc-divider font-bold text-center uppercase tracking-tight text-[10pt] font-sans mt-2 text-doc-text pdf-page-break-avoid">CLÁUSULA QUINTA – DO INVESTIMENTO E FORMA DE PAGAMENTO</div>
        <p>5.1. Em contrapartida aos serviços prestados, os CONTRATANTES pagarão em favor da CONTRATADA o valor total de <span className="font-bold underline">{formatCurrency(data.valorTotal)} ({extenso(data.valorTotal)})</span>, a ser quitado da seguinte forma:</p>
        <p className="pl-6">a) Entrada: O valor de <span className="font-bold underline">{formatCurrency(data.valorEntrada)} ({extenso(data.valorEntrada)})</span>, a ser pago por meio de <span className="font-bold underline uppercase">{data.formaPagamentoEntrada}</span> no ato da assinatura deste instrumento;</p>
        <p className="pl-6">b) Saldo Remanescente: O valor de <span className="font-bold underline">{formatCurrency(saldoRemanescente)} ({extenso(saldoRemanescente)})</span>, a ser pago em <span className="font-bold underline">{data.numParcelas} ({extensoSimples(data.numParcelas)})</span> parcelas mensais e sucessivas de <span className="font-bold underline">{formatCurrency(valorParcela)} ({extenso(valorParcela)})</span> cada, por meio de <span className="font-bold underline uppercase">{data.formaPagamentoSaldo}</span>, com o vencimento da primeira parcela em {data.dataPrimeiraParcela ? new Date(data.dataPrimeiraParcela + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '...'} e as demais em igual dia dos meses subsequentes.</p>
        <p>5.2. As partes declaram-se cientes de que o presente instrumento se encontra revestido de força de título executivo extrajudicial, nos termos do art. 784 do Código de Processo Civil, de forma que a inadimplência autoriza a CONTRATADA, independentemente de notificação extrajudicial, a ingressar com ação judicial competente para recebimento dos valores devidos.</p>
        <p>5.3. Os valores descritos nesta cláusula referem-se à participação de uma única pessoa no Programa. A inclusão de participante(s) adicional(is) dependerá de aditivo contratual e do pagamento do valor correspondente.</p>
        <p>5.4. Eventual inadimplência por parte do CONTRATANTE autoriza a suspensão imediata pela CONTRATADA de seu acesso às aulas, plataformas, materiais e bônus, os quais somente serão restabelecidos após a quitação integral dos débitos, não havendo reposição de aulas já ministradas.</p>
        <p>5.5. O atraso no pagamento de qualquer obrigação pecuniária sujeita o CONTRATANTE à incidência de multa moratória de 2% (dois por cento) sobre o valor devido, juros de mora de 1% (um por cento) ao mês, calculados pro rata die, e, se o atraso superar 30 (trinta) dias, correção monetária pelo IPCA. Persistindo o atraso por prazo superior a 30 (trinta) dias, fica facultado à CONTRATADA declarar o vencimento antecipado das parcelas vincendas e rescindir o contrato por culpa do CONTRATANTE, sem prejuízo da cobrança do saldo devedor.</p>
        <p>5.6. Na hipótese de haver mais de um CONTRATANTE, todos responderão solidariamente por todas as obrigações assumidas neste contrato, incluindo o pagamento integral do preço, encargos de mora, multas e indenizações, podendo a CONTRATADA exigir o cumprimento total da obrigação de qualquer um deles, conjunta ou separadamente.</p>
        <p>5.7. Nos termos do artigo 49 do Código de Defesa do Consumidor, o CONTRATANTE poderá exercer o direito de arrependimento no prazo de 7 (sete) dias corridos, a contar da assinatura deste contrato, mediante comunicação por escrito à CONTRATADA. Exercido o direito de arrependimento dentro do prazo legal, será devido o reembolso imediato dos valores pagos, monetariamente atualizados, observadas as seguintes condições:</p>
        <p className="pl-6">5.7.1. Liberação estratégica de conteúdo: para proteção do segredo de negócio da CONTRATADA, o acesso a informações estratégicas e sigilosas, notadamente a lista de fornecedores, distribuidores e respectivos contatos comerciais, será disponibilizado ao CONTRATANTE somente após o 8º (oitavo) dia da assinatura deste contrato. Durante os primeiros 7 (sete) dias, o CONTRATANTE terá acesso aos conteúdos introdutórios e não confidenciais do Programa.</p>
        <p className="pl-6">5.7.2. Retenção proporcional por serviços já prestados: caso o CONTRATANTE tenha participado de sessões de mentoria, recebido diagnósticos, utilizado canais de suporte ou usufruído de bônus não confidenciais dentro do prazo de 7 (sete) dias, a CONTRATADA reterá, do valor a ser restituído, quantia proporcional aos serviços efetivamente prestados e consumidos até a data da comunicação do arrependimento.</p>
        <p className="pl-6">5.7.3. Liberação antecipada e renúncia específica: se o CONTRATANTE solicitar, de forma expressa e documentada, a liberação antecipada do conteúdo estratégico descrito no item 5.7.1 durante o prazo de arrependimento, deverá, previamente à liberação, assinar Termo de Liberação Antecipada e Renúncia ao Direito de Arrependimento quanto a esse conteúdo específico, reconhecendo que se trata de ativo de consumo imediato e integral.</p>
        <p className="pl-6">5.7.4. Hipótese excepcional de divulgação da lista dentro do prazo de arrependimento: ocorrendo, por qualquer motivo, a efetiva disponibilização e acesso do CONTRATANTE à lista de fornecedores e contatos durante o prazo de 7 (sete) dias:</p>
        <p className="pl-12">I) se a liberação tiver sido feita a pedido do CONTRATANTE, sem a assinatura do Termo previsto no item 5.7.3, o arrependimento implicará reembolso parcial, deduzindo-se o valor de referência do "Acesso autorizado a marcas e fornecedores", por se tratar de serviço integralmente consumido;</p>
        <p className="pl-12">II) se a liberação ocorrer por erro operacional da CONTRATADA, o CONTRATANTE poderá optar entre: (a) manter o contrato e renunciar ao arrependimento; ou (b) rescindir com reembolso integral, condicionando-se este à assinatura de Termo de Não Utilização e Destruição de Conteúdo Estratégico, com bloqueio imediato de acessos e obrigação de não uso, não divulgação e exclusão definitiva dos materiais, sujeitando-se o descumprimento às penalidades de confidencialidade e propriedade intelectual.</p>
        <p>5.8. Transcorrido o prazo de 7 (sete) dias, o cancelamento imotivado pelo CONTRATANTE não ensejará reembolso de valores pagos, aplicando-se, em caso de rescisão por iniciativa do CONTRATANTE, a multa compensatória de 50% (cinquenta por cento) do valor total do contrato, sem prejuízo da cobrança das parcelas vencidas.</p>
        <div className="bg-doc-section-bg py-1 border-y border-doc-divider font-bold text-center uppercase tracking-tight text-[10pt] font-sans mt-2 text-doc-text pdf-page-break-avoid">CLÁUSULA SEXTA – DA PROPRIEDADE INTELECTUAL, DA CONFIDENCIALIDADE E DA NÃO CONCORRÊNCIA</div>
        <p>6.1. O(s) CONTRATANTE(S) reconhece(m) que todos os materiais, conteúdos, métodos, marcas, softwares e o know-how que compõem o Programa "MENTORIA AUTORIZADO" e seus Bônus, incluindo, mas não se limitando a vídeos, aulas, slides, documentos, planilhas, metodologias e listas de contatos, são de propriedade única e exclusiva da CONTRATADA, protegidos pela legislação de propriedade intelectual (Lei nº 9.610/98 e Lei nº 9.279/96).</p>
        <p>6.2. A CONTRATADA concede ao(s) CONTRATANTE(S), em caráter pessoal, intransferível, não exclusivo e revogável, uma licença para usar os materiais e acessar o conteúdo do Programa estritamente para fins de seu próprio aprendizado e aplicação em seu negócio, durante o prazo de vigência do contrato e enquanto estiver adimplente.</p>
        <p>6.3. É expressamente vedado ao(s) CONTRATANTE(S), sob pena de rescisão imediata e aplicação das sanções cabíveis:</p>
        <p className="pl-6">a) Reproduzir, copiar, gravar, modificar, distribuir, vender, alugar, sublicenciar ou de qualquer forma transferir ou disponibilizar a terceiros qualquer conteúdo ou material do Programa.</p>
        <p className="pl-6">b) Utilizar o nome, marca ou logo da CONTRATADA ou do Programa para qualquer fim que não seja a simples menção como participante da mentoria.</p>
        <p className="pl-6">c) Criar obras derivadas ou concorrentes a partir do conteúdo ou da metodologia do Programa.</p>
        <p>6.4. O(s) CONTRATANTE(S) obriga(m)-se a manter sigilo absoluto sobre todas as "Informações Confidenciais" da CONTRATADA a que tiver(em) acesso, pelo prazo de 5 (cinco) anos contados do término deste contrato. Consideram-se Informações Confidenciais, entre outras, as estratégias de negócio, dados financeiros, modelos operacionais e, em especial, as listas de fornecedores e contatos comerciais.</p>
        <p>6.5. O(s) CONTRATANTE(S) obriga(m)-se, pelo prazo de 5 (cinco) anos a contar da assinatura deste contrato, a não exercer, direta ou indiretamente, por si ou por meio de terceiros, atividades de ensino, mentoria, consultoria, treinamento ou qualquer programa educacional que concorra diretamente com o objeto deste contrato ou que utilize a metodologia e o conhecimento aqui adquiridos para tal fim.</p>
        <p>6.6. A violação de qualquer disposição desta Cláusula Sexta configurará quebra contratual grave, sujeitando o infrator à rescisão imediata e unilateral do contrato, ao bloqueio de todos os acessos, e à aplicação da multa penal compensatória prevista neste instrumento, sem prejuízo da apuração judicial de perdas e danos e da adoção das medidas cíveis e criminais cabíveis.</p>
        <div className="bg-doc-section-bg py-1 border-y border-doc-divider font-bold text-center uppercase tracking-tight text-[10pt] font-sans mt-2 text-doc-text pdf-page-break-avoid">CLÁUSULA SÉTIMA – DA RESCISÃO E DAS CLÁUSULAS PENAIS</div>
        <p>7.1. O presente contrato poderá ser rescindido de pleno direito nas hipóteses de mútuo acordo, exercício do direito de arrependimento ou por quebra de qualquer obrigação contratual que autoriza a parte inocente a rescindi-lo por culpa da parte infratora.</p>
        <p>7.2. A rescisão por iniciativa imotivada do(s) CONTRATANTE(S) após o prazo de arrependimento, ou por sua culpa em caso de inadimplemento financeiro (conforme itens 5.4 e 5.5), sujeitá-lo(s)-á ao pagamento de multa compensatória de 50% (cinquenta por cento) do valor total do contrato, a título de ressarcimento pelos custos operacionais e pela vaga reservada.</p>
        <p>7.3. A violação, pelo(s) CONTRATANTE(S) ou por qualquer pessoa a ele(s) vinculada, de qualquer obrigação estipulada na Cláusula Sexta (Propriedade Intelectual, Confidencialidade e Não Concorrência) será considerada infração contratual de natureza gravíssima, cujos danos ao modelo de negócio da CONTRATADA são de difícil e onerosa mensuração.</p>
        <p>7.4. A violação, pelo(s) CONTRATANTE(S), de qualquer obrigação estipulada na Cláusula Sexta (Propriedade Intelectual, Confidencialidade e Não Concorrência) sujeitá-lo(s)-á ao pagamento de multa penal compensatória no valor de R$ 1.000.000,00 (um milhão de reais), que servirá como valor mínimo de indenização, não afastando a possibilidade de apuração de perdas e danos suplementares.</p>
        <p>7.5. Em conformidade com o parágrafo único do art. 416 do Código Civil, caso o prejuízo efetivamente comprovado pela CONTRATADA em decorrência da infração seja superior ao valor da multa penal estabelecida na cláusula 7.4, caberá à CONTRATADA o direito de exigir indenização suplementar pelo montante que exceder a referida multa.</p>
        <p>7.6. Em qualquer hipótese de término ou rescisão do contrato, o acesso do(s) CONTRATANTE(S) a todas as plataformas, materiais, grupos e canais de suporte será imediatamente bloqueado, e as obrigações de confidencialidade e não concorrência permanecerão em vigor pelo prazo estipulado na Cláusula Sexta (itens 6.4 e 6.5).</p>
        <div className="bg-doc-section-bg py-1 border-y border-doc-divider font-bold text-center uppercase tracking-tight text-[10pt] font-sans mt-2 text-doc-text pdf-page-break-avoid">CLÁUSULA OITAVA – DA PROTEÇÃO DO ECOSSISTEMA E VEDAÇÃO DE ATIVIDADE COMERCIAL INTERNA</div>
        <p>8.1. O(s) CONTRATANTE(S), bem como seus sócios, administradores, prepostos, colaboradores, e empresas do mesmo grupo econômico, ou quaisquer pessoas físicas ou jurídicas a ele(s) vinculadas, reconhece(m) que o acesso à comunidade de alunos, mentores e parceiros da CONTRATADA é um ativo de grande valor.</p>
        <p>8.2. Em razão disso, obriga(m)-se a não utilizar o acesso privilegiado a este ecossistema para, sob qualquer forma, comercializar, oferecer, divulgar, abordar ou intermediar produtos, serviços, cursos ou mentorias próprios ou de terceiros aos demais participantes, alunos, mentores, parceiros ou qualquer integrante da comunidade da CONTRATADA, sem a autorização prévia, expressa e por escrito da CONTRATADA.</p>
        <p>8.3. A violação desta obrigação será considerada quebra de segredo de negócio e concorrência desleal, sujeitando o(s) infrator(es) à rescisão imediata e por justa causa do contrato, ao bloqueio de todos os acessos, e à aplicação da multa penal específica de R$ 1.000.000,00 (um milhão de reais) prevista na Cláusula 7.4., sem prejuízo das demais medidas cíveis e criminais cabíveis.</p>
        <div className="bg-doc-section-bg py-1 border-y border-doc-divider font-bold text-center uppercase tracking-tight text-[10pt] font-sans mt-2 text-doc-text pdf-page-break-avoid">CLÁUSULA NONA– DA PROTEÇÃO DE DADOS PESSOAIS (LGPD)</div>
        <p>9.1. As partes declaram ciência e se comprometem a cumprir integralmente as disposições da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 – "LGPD") e demais regulamentações aplicáveis, em relação a todos os dados pessoais a que tiverem acesso ou que venham a tratar em decorrência da execução deste contrato.</p>
        <p>9.2. Cada parte atuará como Controladora dos dados pessoais que coletar diretamente. A CONTRATADA é controladora dos dados do(a) CONTRATANTE, e o(a) CONTRATANTE é controlador(a) dos dados de seus próprios clientes e colaboradores que eventualmente compartilhe no contexto da mentoria.</p>
        <p>9.3. O tratamento de dados pessoais pelas partes limitar-se-á estritamente às finalidades de: a) Execução do presente contrato, incluindo a prestação dos serviços, gestão financeira e comunicação; b) Cumprimento de obrigações legais ou regulatórias; c) Exercício regular de direitos em processo judicial, administrativo ou arbitral.</p>
        <p>9.4. As partes obrigam-se a adotar e manter medidas de segurança, técnicas e administrativas, aptas a proteger os dados pessoais de acessos não autorizados e de situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou qualquer forma de tratamento inadequado ou ilícito.</p>
        <p>9.5. Em caso de qualquer incidente de segurança que possa acarretar risco ou dano relevante aos titulares, a parte que dele tomar conhecimento deverá, em prazo razoável, comunicar à outra parte e, se necessário, à Autoridade Nacional de Proteção de Dados (ANPD) e aos titulares, nos termos da LGPD.</p>
        <p>9.6. A parte que, no descumprimento de suas obrigações de proteção de dados, causar dano patrimonial, moral, individual ou coletivo à outra parte ou a terceiros, ficará obrigada a repará-lo integralmente.</p>
        <p>9.7. As obrigações de proteção de dados aqui previstas permanecerão em vigor mesmo após o término ou a rescisão deste contrato.</p>
        <div className="bg-doc-section-bg py-1 border-y border-doc-divider font-bold text-center uppercase tracking-tight text-[10pt] font-sans mt-2 text-doc-text pdf-page-break-avoid">CLÁUSULA DÉCIMA – DAS DISPOSIÇÕES GERAIS</div>
        <p>10.1. Este contrato é celebrado em regime de autonomia, inexistindo entre as partes vínculo de emprego, sociedade, representação ou qualquer outra forma de subordinação jurídica. Cada parte é exclusivamente responsável por suas próprias obrigações tributárias, trabalhistas e previdenciárias.</p>
        <p>10.2. É vedado ao(à) CONTRATANTE ceder ou transferir os direitos e obrigações deste contrato, no todo ou em parte, sem a autorização prévia e por escrito da CONTRATADA.</p>
        <p>10.3. A eventual tolerância de uma das partes quanto ao descumprimento de qualquer obrigação pela outra não constituirá novação, renúncia ao direito de exigi-la, nem precedente para futuras infrações.</p>
        <p>10.4. Este instrumento, incluindo seus anexos, representa o acordo integral entre as partes, substituindo quaisquer acordos, propostas ou comunicações anteriores, verbais ou escritas, relacionadas ao seu objeto.</p>
        <p>10.5. Se qualquer cláusula deste contrato for considerada nula ou inexequível por decisão judicial transitada em julgado, as demais permanecerão em pleno vigor e efeito.</p>
        <p>10.6. Todas as comunicações e notificações entre as partes serão consideradas válidas quando realizadas por escrito, através dos endereços de e-mail informados no preâmbulo deste contrato, considerando-se recebidas no primeiro dia útil subsequente ao envio.</p>
        <p>10.7. Nenhuma das partes será responsabilizada por falhas ou atrasos no cumprimento de suas obrigações que decorram de eventos de caso fortuito ou força maior, nos termos do art. 393 do Código Civil.</p>
        <div className="bg-doc-section-bg py-1 border-y border-doc-divider font-bold text-center uppercase tracking-tight text-[10pt] font-sans mt-2 text-doc-text pdf-page-break-avoid">CLÁUSULA DÉCIMA PRIMEIRA – DO FORO DE ELEIÇÃO</div>
        <p>11.1. Para dirimir quaisquer controvérsias oriundas do presente contrato, as partes elegem o foro da Comarca de Araranguá/SC, com expressa renúncia a qualquer outro, por mais privilegiado que seja.</p>
        <div className="mt-16 space-y-12 pdf-page-break-avoid">
          <div className="text-right italic mb-10 font-sans text-[11pt]">Araranguá/SC, {data.dataContrato ? new Date(data.dataContrato + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '...'}</div>
          <div className="flex flex-col gap-12">
            <div className="relative">
              <div className="flex flex-col items-start pl-4 border-l-4 border-[#10b981] bg-[#ecfdf5] py-4 max-w-fit pr-12 rounded-r-xl">
                <div className="flex items-center gap-2 mb-1"><div className="bg-[#059669] rounded-full p-0.5"><CheckCircle size={10} className="text-white" /></div><span className="text-[9pt] font-sans font-bold text-[#047857] uppercase tracking-widest">Assinado Digitalmente</span></div>
                <p className="font-bold text-[12pt] text-doc-text leading-tight">VICTOR MATTOS</p>
                <p className="text-[10pt] text-doc-muted font-sans">Sócio-Administrador • JCV ACADEMY LTDA</p>
                <p className="text-[9pt] text-doc-light font-mono mt-1">ID: B829-44F1-992C-DECRETO-10543</p>
              </div>
            </div>
            {data.contratantes.map((c, idx) => (
              <div key={c.id} className="flex flex-col items-start pl-4">
                <div className="w-80 border-t border-doc-border border-dashed" />
                <p className="font-bold text-[12pt] mt-2 uppercase text-doc-text">{c.nome || `CONTRATANTE ${data.contratantes.length > 1 ? idx + 1 : ''}`}</p>
                <p className="text-[10pt] text-doc-muted font-sans uppercase">CPF: {c.cpf || 'XXX.XXX.XXX-XX'}</p>
              </div>
            ))}
          </div>
          <div className="text-[9pt] text-doc-light font-sans text-center mt-12 italic border-t border-doc-divider pt-4">E, por estarem justas e acostadas, as partes assinam o presente instrumento na forma digital, nos termos regulamentados pelo Decreto n° 10.543 de 13/11/2020.</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-[#f8fafc] flex flex-col overflow-hidden print:h-auto print:overflow-visible">
      {/* Header */}
      <header className="h-16 flex-none bg-white border-b border-slate-200 px-6 flex items-center justify-between z-10 print:hidden shadow-sm">
        <div className="flex items-center gap-4">
          <div className="font-bold text-blue-600 text-lg tracking-tight">JCV<span className="text-slate-400 font-medium">contract</span></div>
          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10pt] font-bold rounded-md">AUTO-SYNC ON</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-all ${showHistory ? 'bg-slate-100 text-blue-600' : ''}`}
            title="Histórico de Rascunhos"
          >
            <History size={20} />
          </button>
          {/* AI Panel Toggle */}
          <button
            onClick={() => setAiPanelOpen(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all border ${aiPanelOpen ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-white border-slate-200 text-slate-500 hover:border-violet-200 hover:text-violet-600'}`}
            title="Assistente IA"
          >
            <Sparkles size={15} />
            <span className="hidden sm:inline">IA</span>
            {aiPanelOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
          <button onClick={downloadPdf} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900 transition-all flex items-center gap-2 active:scale-95 shadow-sm">
            <Download size={16} /> Exportar PDF
          </button>
          <button onClick={handlePrint} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-md shadow-blue-200 transition-all flex items-center gap-2 active:scale-95">
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </header>

      {/* History Drawer */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowHistory(false)} className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm z-20" />
            <motion.div initial={{ opacity: 0, x: 300 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 300 }} className="fixed top-0 right-0 bottom-0 w-80 bg-white shadow-2xl z-30 border-l border-slate-200 flex flex-col pt-16">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-700 flex items-center gap-2 uppercase tracking-widest text-[9pt]"><History size={16} /> Histórico Recente</h3>
                <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {history.length === 0 && <div className="text-center py-12 flex flex-col items-center gap-2"><History size={24} className="text-slate-200" /><p className="text-slate-400 text-xs">Nenhum histórico salvo.</p></div>}
                {history.map(h => (
                  <div key={h.id} onClick={() => { setData(sanitizeContractData(h.data)); setShowHistory(false); }} className="p-3 border border-slate-100 rounded-xl hover:border-blue-200 hover:bg-blue-50 cursor-pointer transition-all group">
                    <p className="font-bold text-sm text-slate-700 group-hover:text-blue-700 truncate">{h.clientName}</p>
                    <p className="text-[8pt] text-slate-400 mt-1">{h.date}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 flex overflow-hidden print:hidden relative">
        {/* Validation Errors Toast */}
        <AnimatePresence>
          {errors.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 50, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 50, x: '-50%' }} className="fixed bottom-8 left-1/2 bg-red-600 text-white p-4 rounded-2xl shadow-2xl z-50 flex flex-col gap-2 min-w-[320px]">
              <div className="flex items-center justify-between"><span className="font-bold flex items-center gap-2 text-sm"><AlertCircle size={16} /> Atenção</span><button onClick={() => setErrors([])} className="hover:bg-red-500 rounded p-0.5"><X size={16} /></button></div>
              <ul className="text-[10pt] list-disc pl-4 space-y-1 opacity-90">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form Sidebar */}
        <section className="w-[420px] flex-none bg-white border-r border-slate-200 p-6 overflow-y-auto print:hidden">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Editor de Contrato</h2>
              <p className="text-xs text-slate-500 mt-1">Configure as partes e condições.</p>
            </div>
            <button onClick={() => { saveToHistory(); alert('Salvo no histórico!'); }} className="p-2 border border-slate-200 rounded-lg text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all" title="Salvar Rascunho Manual"><Save size={18} /></button>
          </div>

          <div className="space-y-8 pb-10">
            {/* Contratantes */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users size={14} /> Contratantes ({data.contratantes.length}/2)</h3>
                {data.contratantes.length < 2 && <button onClick={addContratante} className="flex items-center gap-1 text-[9pt] font-extrabold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-all"><Plus size={14} /> Adicionar Sócio</button>}
              </div>
              <AnimatePresence mode="popLayout">
                {data.contratantes.map((c, index) => (
                  <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} key={c.id} className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-3 relative">
                    {data.contratantes.length > 1 && <button onClick={() => removeContratante(c.id)} className="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-red-500 transition-all rounded-lg hover:bg-red-50"><Trash2 size={15} /></button>}
                    <div className="space-y-3">
                      <div className="space-y-1"><label className="text-[8.5pt] font-bold text-slate-500 uppercase tracking-wider">Nome Completo</label><input type="text" value={c.nome} onChange={(e) => handleContratanteChange(c.id, 'nome', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none shadow-sm transition-all" /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1"><label className="text-[8.5pt] font-bold text-slate-500 uppercase tracking-wider">CPF</label><input type="text" value={c.cpf} onChange={(e) => handleContratanteChange(c.id, 'cpf', e.target.value)} placeholder="000.000.000-00" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none transition-all shadow-sm" /></div>
                        <div className="space-y-1"><label className="text-[8.5pt] font-bold text-slate-500 uppercase tracking-wider">Email</label><input type="email" value={c.email} onChange={(e) => handleContratanteChange(c.id, 'email', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none transition-all shadow-sm" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1"><label className="text-[8.5pt] font-bold text-slate-500 uppercase tracking-wider">Telefone</label><input type="text" value={c.telefone} onChange={(e) => handleContratanteChange(c.id, 'telefone', e.target.value)} placeholder="(00) 00000-0000" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none transition-all shadow-sm" /></div>
                        <div className="space-y-1"><label className="text-[8.5pt] font-bold text-slate-500 uppercase tracking-wider">CEP</label>
                          <div className="relative"><input type="text" value={c.cep} onChange={(e) => handleContratanteChange(c.id, 'cep', e.target.value)} placeholder="00000-000" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none pr-9 transition-all shadow-sm" /><div className="absolute right-3 top-1/2 -translate-y-1/2">{loadingCep === c.id ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><Search size={14} className="text-blue-500" /></motion.div> : <Search size={14} className="text-slate-300" />}</div></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="col-span-3 space-y-1"><label className="text-[8.5pt] font-bold text-slate-500 uppercase tracking-wider">Logradouro</label><input type="text" value={c.rua} onChange={(e) => handleContratanteChange(c.id, 'rua', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none shadow-sm transition-all" /></div>
                        <div className="space-y-1"><label className="text-[8.5pt] font-bold text-slate-500 uppercase tracking-wider">Nº</label><input type="text" value={c.numero} onChange={(e) => handleContratanteChange(c.id, 'numero', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none shadow-sm transition-all" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1"><label className="text-[8.5pt] font-bold text-slate-500 uppercase tracking-wider">Cidade</label><input type="text" value={c.cidade} onChange={(e) => handleContratanteChange(c.id, 'cidade', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none shadow-sm transition-all" /></div>
                        <div className="space-y-1"><label className="text-[8.5pt] font-bold text-slate-500 uppercase tracking-wider">Estado</label><input type="text" value={c.estado} onChange={(e) => handleContratanteChange(c.id, 'estado', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none shadow-sm transition-all" /></div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                        <div className="space-y-1"><label className="text-[7pt] font-bold text-slate-400 uppercase tracking-widest">Nacionalidade</label><input type="text" value={c.nacionalidade} onChange={(e) => handleContratanteChange(c.id, 'nacionalidade', e.target.value)} className="w-full px-2 py-1.5 bg-white border border-slate-100 rounded-lg text-xs" /></div>
                        <div className="space-y-1"><label className="text-[7pt] font-bold text-slate-400 uppercase tracking-widest">Est. Civil</label><input type="text" value={c.estadoCivil} onChange={(e) => handleContratanteChange(c.id, 'estadoCivil', e.target.value)} className="w-full px-2 py-1.5 bg-white border border-slate-100 rounded-lg text-xs" /></div>
                        <div className="space-y-1"><label className="text-[7pt] font-bold text-slate-400 uppercase tracking-widest">Profissão</label><input type="text" value={c.profissao} onChange={(e) => handleContratanteChange(c.id, 'profissao', e.target.value)} className="w-full px-2 py-1.5 bg-white border border-slate-100 rounded-lg text-xs" /></div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Produtos e Bônus */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2 flex items-center gap-2"><FileText size={14} /> Produtos e Bônus</h3>
              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 space-y-3 mb-4">
                <div className="space-y-1"><label className="text-[8pt] font-bold text-blue-800 uppercase tracking-wider">Duração Mentoria (Meses)</label><input type="number" name="duracaoMentoria" value={data.duracaoMentoria} onChange={handleInputChange} className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-100" /></div>
                <div className="space-y-1"><label className="text-[8pt] font-bold text-blue-800 uppercase tracking-wider">Acesso Aulas Gravadas (Meses)</label><input type="number" name="duracaoAulas" value={data.duracaoAulas} onChange={handleInputChange} className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-100" /></div>
              </div>
              {AVAILABLE_BONUSES.map((bonus) => {
                const isSelected = data.selectedBonuses.includes(bonus.id);
                return (
                  <div key={bonus.id} className={`p-3 rounded-2xl border transition-all ${isSelected ? 'bg-white border-blue-200 shadow-sm' : 'bg-slate-50/50 border-slate-100 grayscale opacity-60'}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleBonus(bonus.id)} className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10pt] font-bold text-slate-800">{bonus.title}</span>
                          {isSelected && (<div className="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded-lg"><span className="text-[7.5pt] font-extrabold text-blue-600 uppercase">Dur.:</span><input type="number" value={data.bonusDurations[bonus.id] || bonus.defaultDuration} onChange={(e) => handleBonusDurationChange(bonus.id, parseInt(e.target.value) || 1)} className="w-10 bg-transparent text-[10pt] font-bold text-blue-700 outline-none border-b border-blue-200 text-center" /><span className="text-[7.5pt] font-bold text-blue-400">meses</span></div>)}
                        </div>
                        <p className="text-[8pt] text-slate-500 leading-tight mt-1">{bonus.desc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Marcas */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2"><CheckCircle size={14} /> Marcas Parceiras</div>
                <div className="flex gap-2">
                  <button onClick={() => setData({ ...data, marcas: [] })} className="text-[10px] text-slate-400 hover:text-red-500 font-bold uppercase tracking-tighter">Nenhuma</button>
                  <button onClick={() => setData({ ...data, marcas: [...DEFAULT_MARCAS] })} className="text-[10px] text-blue-500 hover:text-blue-700 font-bold uppercase tracking-tighter">Todas</button>
                </div>
              </h3>
              <div className="flex gap-2"><input type="text" value={newMarca} onChange={(e) => setNewMarca(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addMarca()} placeholder="Nova Marca..." className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-blue-600" /><button onClick={addMarca} className="px-3 py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700">Add</button></div>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 bg-slate-50 rounded border border-slate-100">
                {data.marcas.map((m, i) => (<span key={i} className="px-2 py-1 bg-white border border-slate-200 rounded text-[9pt] flex items-center gap-1 group">{m}<button onClick={() => removeMarca(i)} className="text-slate-300 hover:text-red-500 transition-colors">×</button></span>))}
              </div>
            </div>

            {/* Pagamento */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2 flex items-center gap-2"><CreditCard size={14} /> Condições de Pagamento</h3>
              <div className="grid grid-cols-1 gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div className="space-y-1"><label className="text-[8.5pt] font-bold text-slate-500 uppercase tracking-wider">Valor Total (Mentoria)</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span><input type="number" name="valorTotal" value={data.valorTotal || ''} onChange={handleInputChange} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-blue-600 outline-none shadow-sm transition-all" /></div></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><label className="text-[8.5pt] font-bold text-slate-500 uppercase tracking-wider">Entrada</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span><input type="number" name="valorEntrada" value={data.valorEntrada || ''} onChange={handleInputChange} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-600 outline-none shadow-sm transition-all" /></div></div>
                  <div className="space-y-1"><label className="text-[8.5pt] font-bold text-slate-500 uppercase tracking-wider">Parcelas Saldo</label><input type="number" name="numParcelas" value={data.numParcelas} onChange={handleInputChange} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-600 outline-none shadow-sm transition-all" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><label className="text-[8.5pt] font-bold text-slate-500 uppercase tracking-wider">Meio Pgtº Entrada</label><select name="formaPagamentoEntrada" value={data.formaPagamentoEntrada} onChange={handleInputChange} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-600 outline-none shadow-sm transition-all"><option value="cartão de crédito">Cartão de Crédito</option><option value="pix">PIX</option><option value="boleto bancário">Boleto Bancário</option><option value="transferência bancária">Transferência Bancária</option><option value="espécie">Em Espécie</option></select></div>
                  <div className="space-y-1"><label className="text-[8.5pt] font-bold text-slate-500 uppercase tracking-wider">Meio Pgtº Saldo</label><select name="formaPagamentoSaldo" value={data.formaPagamentoSaldo} onChange={handleInputChange} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-600 outline-none shadow-sm transition-all"><option value="boleto bancário">Boleto Bancário</option><option value="cartão de crédito">Cartão de Crédito</option><option value="pix">PIX</option><option value="transferência bancária">Transferência Bancária</option></select></div>
                </div>
              </div>
            </div>

            {/* Cronograma */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2 flex items-center gap-2"><Calendar size={14} /> Cronograma</h3>
              <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div className="space-y-1"><label className="text-[8.5pt] font-bold text-slate-500 uppercase tracking-wider">Data do Contrato</label><input type="date" name="dataContrato" value={data.dataContrato} onChange={handleInputChange} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-600 shadow-sm" /></div>
                <div className="space-y-1"><label className="text-[8.5pt] font-bold text-slate-500 uppercase tracking-wider">Venc. 1ª Parcela</label><input type="date" name="dataPrimeiraParcela" value={data.dataPrimeiraParcela} onChange={handleInputChange} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-600 shadow-sm" /></div>
              </div>
            </div>

            {/* Reset */}
            <div className="pt-4 border-t border-slate-100 relative">
              <AnimatePresence>
                {showClearConfirm && (
                  <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute bottom-full left-0 right-0 mb-4 bg-white border border-slate-200 p-5 rounded-2xl shadow-2xl z-20 space-y-4">
                    <div className="flex items-center gap-3 text-red-600"><AlertCircle size={20} /><p className="text-sm font-bold">Apagar todos os dados?</p></div>
                    <p className="text-xs text-slate-500 leading-relaxed">Esta ação irá limpar todos os campos do contrato atual e o rascunho salvo.</p>
                    <div className="flex gap-2">
                      <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:bg-slate-50 rounded-xl transition-all">Cancelar</button>
                      <button onClick={() => { setData(createInitialData()); localStorage.setItem('jcv-contract-draft', JSON.stringify(createInitialData())); setErrors([]); setShowClearConfirm(false); }} className="flex-1 py-2.5 text-[10px] font-bold uppercase tracking-wider text-white bg-red-500 hover:bg-red-600 rounded-xl shadow-lg shadow-red-200 transition-all">Confirmar</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <button onClick={() => setShowClearConfirm(true)} className="w-full py-3 text-red-500 font-bold rounded-xl hover:bg-red-50 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 border border-transparent hover:border-red-100"><Trash2 size={14} /> Limpar Tudo</button>
            </div>
          </div>
        </section>

        {/* AI Panel — slides in/out */}
        <AnimatePresence>
          {aiPanelOpen && (
            <motion.section
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="flex-none overflow-hidden print:hidden"
              style={{ minWidth: 0 }}
            >
              <div className="w-80 h-full">
                <AiPanel data={data} onApplyContratante={handleApplyContratante} />
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Preview */}
        <section className="flex-1 bg-slate-100/50 p-10 overflow-y-auto flex flex-col items-center print:bg-white print:p-0 print:overflow-visible">
          <div className="mb-4 bg-white px-4 py-2 rounded-full border border-slate-200 flex items-center gap-2 text-xs font-bold text-slate-500 shadow-sm print:hidden">
            <Eye size={14} className="text-blue-600" /> VISUALIZAÇÃO EM TEMPO REAL
          </div>
          <ContractPreview refToUse={printRef} />
        </section>
      </main>

      {/* PDF render (hidden) */}
      <div className="fixed top-0 left-0 pointer-events-none opacity-0 -z-50" style={{ width: '794px' }}>
        <div ref={pdfRef} className="bg-white"><ContractPreview isPrint={true} /></div>
      </div>

      {/* Print version */}
      <div className="hidden print:block font-serif">
        <ContractPreview isPrint={true} />
      </div>
    </div>
  );
}
