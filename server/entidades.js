// Definição e validação de cada coleção sincronizada.
// O app manda registros; aqui eles são conferidos campo a campo antes de ir para o banco.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const CHAVE = /^[a-z0-9_]{1,60}$/;

class Invalido extends Error {}
const falha = (mensagem) => {
  throw new Invalido(mensagem);
};
const vazio = (v) => v === undefined || v === null || v === '';

const t = {
  texto: (max, obrigatorio = false) => (v, campo) => {
    if (vazio(v)) return obrigatorio ? falha(`${campo} é obrigatório`) : null;
    if (typeof v !== 'string') falha(`${campo} deve ser texto`);
    const s = v.trim();
    if (!s) return obrigatorio ? falha(`${campo} é obrigatório`) : null;
    if (s.length > max) falha(`${campo} passa de ${max} caracteres`);
    return s;
  },
  inteiro: (min, max, padrao) => (v, campo) => {
    if (vazio(v)) return padrao !== undefined ? padrao : falha(`${campo} é obrigatório`);
    if (typeof v !== 'number' || !Number.isInteger(v)) falha(`${campo} deve ser inteiro`);
    if (v < min || v > max) falha(`${campo} fora do limite`);
    return v;
  },
  decimal: (min, max, obrigatorio = true) => (v, campo) => {
    if (vazio(v)) return obrigatorio ? 0 : null;
    if (typeof v !== 'number' || !Number.isFinite(v)) falha(`${campo} deve ser número`);
    if (v < min || v > max) falha(`${campo} fora do limite`);
    return Math.round(v * 100) / 100;
  },
  data: (obrigatorio = false) => (v, campo) => {
    if (vazio(v)) return obrigatorio ? falha(`${campo} é obrigatório`) : null;
    if (typeof v !== 'string' || !DATA.test(v)) falha(`${campo} deve ser AAAA-MM-DD`);
    const d = new Date(`${v}T12:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) falha(`${campo} é uma data inválida`);
    if (v < '2000-01-01' || v > '2100-12-31') falha(`${campo} fora do limite`);
    return v;
  },
  uuid: (v, campo) => {
    if (typeof v !== 'string' || !UUID.test(v)) falha(`${campo} inválido`);
    return v.toLowerCase();
  },
  opcao: (lista) => (v, campo) => {
    if (!lista.includes(v)) falha(`${campo} deve ser um de: ${lista.join(', ')}`);
    return v;
  },
  booleano: () => (v) => (v === true || v === 1 || v === '1' ? 1 : 0),
  chave: (v, campo) => {
    if (typeof v !== 'string' || !CHAVE.test(v)) falha(`${campo} inválido`);
    return v;
  },
};

const METAS = ['semanal', 'mensal', 'anual'];

const ENTIDADES = {
  fornecedores: {
    tabela: 'fornecedores',
    id: t.uuid,
    campos: {
      nome: t.texto(120, true),
      telefone: t.texto(30),
    },
  },
  cortes: {
    tabela: 'cortes',
    id: t.uuid,
    campos: {
      fornecedor_id: t.uuid,
      tecido: t.texto(60, true),
      servico: t.opcao(['pala', 'gancho', 'ambos']),
      preco_pala: t.decimal(0, 999),
      preco_gancho: t.decimal(0, 999),
      quantidade: t.inteiro(1, 10000000),
      referencia: t.texto(40),
      tipo_linha: t.texto(60),
      modelo: t.texto(60),
      data_recebimento: t.data(true),
      prazo: t.data(false),
      grupo: t.texto(60),
      pessoas: t.inteiro(1, 10000, 1),
      observacao: t.texto(500),
      encerrado: t.booleano(),
    },
  },
  entregas: {
    tabela: 'entregas',
    id: t.uuid,
    campos: {
      corte_id: t.uuid,
      quantidade: t.inteiro(1, 10000000),
      data: t.data(true),
      valor: t.decimal(0, 9999999999),
      pago: t.booleano(),
      pago_em: t.data(false),
      forma_pagamento: t.texto(20),
      observacao: t.texto(300),
    },
  },
  metas: {
    tabela: 'metas',
    id: t.opcao(METAS),
    campos: {
      tipo: t.opcao(METAS),
      pecas: t.inteiro(0, 1000000000, 0),
      valor: t.decimal(0, 9999999999, false),
    },
  },
  config: {
    tabela: 'config',
    id: t.chave,
    campos: {
      valor: t.texto(4000),
    },
  },
};

// Confere um registro vindo do app e devolve só o que pode ir para o banco.
function sanear(colecao, bruto) {
  const def = ENTIDADES[colecao];
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) falha('registro inválido');
  const id = def.id(bruto.id, 'id');
  if (typeof bruto.atualizado_em !== 'number' || !Number.isFinite(bruto.atualizado_em) || bruto.atualizado_em < 1) {
    falha('atualizado_em inválido');
  }
  // Relógio do celular errado não pode "ganhar" de todas as edições futuras.
  const atualizado_em = Math.min(Math.floor(bruto.atualizado_em), Date.now() + 10 * 60 * 1000);
  const valores = {};
  for (const [campo, validar] of Object.entries(def.campos)) valores[campo] = validar(bruto[campo], campo);
  return { id, atualizado_em, excluido: bruto.excluido ? 1 : 0, valores };
}

module.exports = { ENTIDADES, sanear, Invalido, t };
