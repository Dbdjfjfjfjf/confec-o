/* Cálculos de negócio: valores, saldo de peças, agrupamento por período. Sem tela, sem banco. */
(function (g) {
  'use strict';
  var C = (g.Costura = g.Costura || {});
  var U = C.util || require('./util.js');
  var K = {};

  /* Preço de UMA peça pronta, conforme o serviço do corte. */
  K.precoPeca = function (corte) {
    var pala = corte.servico === 'gancho' ? 0 : Number(corte.preco_pala) || 0;
    var gancho = corte.servico === 'pala' ? 0 : Number(corte.preco_gancho) || 0;
    return U.arred2(pala + gancho);
  };
  K.valorEntrega = function (corte, quantidade) { return U.arred2(K.precoPeca(corte) * quantidade); };
  K.valorTotalCorte = function (corte) { return K.valorEntrega(corte, corte.quantidade); };

  K.rotuloServico = function (s) { return s === 'pala' ? 'Pala' : s === 'gancho' ? 'Gancho' : 'Pala + gancho'; };

  /*
   * Situação de um corte.
   * Desconto de peças: restante = quantidade recebida - soma das entregas (ex.: 1000 - 300 = 700).
   */
  K.situacaoCorte = function (corte, entregasDoCorte) {
    var ativas = entregasDoCorte.filter(function (e) { return !e.excluido; });
    var entregue = ativas.reduce(function (s, e) { return s + e.quantidade; }, 0);
    var valorEntregue = ativas.reduce(function (s, e) { return s + (e.valor || 0); }, 0);
    var recebido = ativas.filter(function (e) { return e.pago; }).reduce(function (s, e) { return s + (e.valor || 0); }, 0);
    var restante = Math.max(0, corte.quantidade - entregue);
    return {
      entregue: entregue,
      restante: restante,
      excedente: Math.max(0, entregue - corte.quantidade),
      pctEntregue: corte.quantidade ? Math.min(1, entregue / corte.quantidade) : 0,
      valorTotal: K.valorTotalCorte(corte),
      valorEntregue: U.arred2(valorEntregue),
      valorRecebido: U.arred2(recebido),
      valorAReceber: U.arred2(valorEntregue - recebido),
      valorFaltaProduzir: K.valorEntrega(corte, restante),
      concluido: restante === 0,
    };
  };

  /* Série de peças entregues agrupada por dia, semana, mês ou ano. Preenche períodos vazios com zero. */
  K.serie = function (entregas, tipo, hoje, quantos) {
    var ativas = entregas.filter(function (e) { return !e.excluido; });
    var chaves = [], rotulos = [];
    var i;
    if (tipo === 'dia') {
      for (i = quantos - 1; i >= 0; i--) { var d = U.somarDias(hoje, -i); chaves.push(d); rotulos.push(U.fmtDataCurta(d)); }
    } else if (tipo === 'semana') {
      var ini = U.inicioSemana(hoje);
      for (i = quantos - 1; i >= 0; i--) { var s = U.somarDias(ini, -7 * i); chaves.push(s); rotulos.push(U.fmtDataCurta(s)); }
    } else if (tipo === 'mes') {
      var base = U.paraDate(U.inicioMes(hoje));
      for (i = quantos - 1; i >= 0; i--) {
        var m = new Date(base.getFullYear(), base.getMonth() - i, 1, 12);
        var chave = U.dataStr(m);
        chaves.push(chave); rotulos.push(U.nomeMes(chave) + (m.getMonth() === 0 || i === quantos - 1 ? '/' + String(m.getFullYear()).slice(2) : ''));
      }
    } else {
      var ano = Number(hoje.slice(0, 4));
      for (i = quantos - 1; i >= 0; i--) { chaves.push(String(ano - i) + '-01-01'); rotulos.push(String(ano - i)); }
    }
    var pecas = chaves.map(function () { return 0; });
    var valor = chaves.map(function () { return 0; });
    var pos = new Map(chaves.map(function (c, k) { return [c, k]; }));
    ativas.forEach(function (e) {
      var chaveEntrega = tipo === 'dia' ? e.data : tipo === 'semana' ? U.inicioSemana(e.data) : tipo === 'mes' ? U.inicioMes(e.data) : U.inicioAno(e.data);
      var k = pos.get(chaveEntrega);
      if (k !== undefined) { pecas[k] += e.quantidade; valor[k] += e.valor || 0; }
    });
    return { chaves: chaves, rotulos: rotulos, pecas: pecas, valor: valor.map(U.arred2) };
  };

  /* Totais de hoje / semana / mês / ano. */
  K.totaisPeriodos = function (entregas, hoje) {
    var out = { dia: 0, semana: 0, mes: 0, ano: 0, valorDia: 0, valorSemana: 0, valorMes: 0, valorAno: 0 };
    var iS = U.inicioSemana(hoje), iM = U.inicioMes(hoje), iA = U.inicioAno(hoje);
    entregas.forEach(function (e) {
      if (e.excluido || e.data > hoje) return;
      var v = e.valor || 0;
      if (e.data === hoje) { out.dia += e.quantidade; out.valorDia += v; }
      if (e.data >= iS) { out.semana += e.quantidade; out.valorSemana += v; }
      if (e.data >= iM) { out.mes += e.quantidade; out.valorMes += v; }
      if (e.data >= iA) { out.ano += e.quantidade; out.valorAno += v; }
    });
    ['valorDia', 'valorSemana', 'valorMes', 'valorAno'].forEach(function (k) { out[k] = U.arred2(out[k]); });
    return out;
  };

  /* Quanto há para receber, no geral, e por fornecedor. */
  K.financeiro = function (cortes, entregas, fornecedores) {
    var mapaCortes = new Map(cortes.map(function (c) { return [c.id, c]; }));
    var porForn = new Map();
    fornecedores.filter(function (f) { return !f.excluido; }).forEach(function (f) {
      porForn.set(f.id, { fornecedor: f, aReceber: 0, recebido: 0, pecas: 0, entregas: [] });
    });
    var aReceber = 0, recebido = 0;
    entregas.forEach(function (e) {
      if (e.excluido) return;
      var c = mapaCortes.get(e.corte_id);
      if (!c || c.excluido) return;
      var linha = porForn.get(c.fornecedor_id);
      if (e.pago) { recebido += e.valor || 0; if (linha) linha.recebido += e.valor || 0; }
      else { aReceber += e.valor || 0; if (linha) { linha.aReceber += e.valor || 0; linha.entregas.push(e); } }
      if (linha) linha.pecas += e.quantidade;
    });
    return {
      aReceber: U.arred2(aReceber), recebido: U.arred2(recebido),
      porFornecedor: Array.from(porForn.values()).map(function (l) {
        return { fornecedor: l.fornecedor, aReceber: U.arred2(l.aReceber), recebido: U.arred2(l.recebido), pecas: l.pecas, entregasPendentes: l.entregas };
      }).filter(function (l) { return l.aReceber > 0 || l.recebido > 0; }).sort(function (a, b) { return b.aReceber - a.aReceber; }),
    };
  };

  C.calculo = K;
  if (typeof module !== 'undefined' && module.exports) module.exports = K;
})(typeof window !== 'undefined' ? window : globalThis);
