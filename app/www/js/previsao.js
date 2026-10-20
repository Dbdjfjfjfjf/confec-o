/*
 * Previsões do Costura (rodam no celular, funcionam offline).
 *
 * Como funciona, em palavras simples:
 *  1. Olha o histórico de entregas e calcula quantas peças POR PESSOA saem por dia de trabalho
 *     (média e variação). Dias sem entrega, depois que o corte começou, contam como zero.
 *  2. Cada corte tem o seu ritmo: ritmo por pessoa x nº de pessoas do grupo. Com poucos dados do corte,
 *     o ritmo se aproxima do ritmo geral da oficina; com mais dados, vale mais o do próprio corte.
 *  3. Simula o futuro milhares de vezes (Monte Carlo): em cada dia sorteia um volume de entrega coerente com
 *     a média e a variação, até acabar as peças do corte. A fração das simulações que termina no prazo
 *     é a probabilidade. A mediana das simulações é a data estimada de término.
 *  4. Metas: simula todos os cortes em aberto ao mesmo tempo; nenhum corte entrega mais do que o que
 *     ainda resta nele. A fração das simulações que alcança a meta no fim do período é a probabilidade.
 *
 * É uma estimativa estatística, não uma garantia. Quanto mais entregas registradas, melhor ela fica.
 */
(function (g) {
  'use strict';
  var C = (g.Costura = g.Costura || {});
  var U = C.util || require('./util.js');
  var P = {};

  var PADRAO = { domingo: false, janela: 60, sims: 1500, seed: 20260, maxDias: 400 };
  function opcoes(o) { return Object.assign({}, PADRAO, o || {}); }

  /* ---------- aleatório com semente (mesmo resultado a cada abertura da tela) ---------- */
  P.mulberry32 = function (semente) {
    var a = semente >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  function normal(rand) { // Box-Muller
    var u = 0;
    while (u === 0) u = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  }
  function hashTexto(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* ---------- entregas indexadas por corte e dia ---------- */
  P.indexar = function (entregas) {
    var porCorte = new Map();
    entregas.forEach(function (e) {
      if (e.excluido) return;
      var m = porCorte.get(e.corte_id);
      if (!m) { m = new Map(); porCorte.set(e.corte_id, m); }
      m.set(e.data, (m.get(e.data) || 0) + e.quantidade);
    });
    return porCorte;
  };
  P.totalEntregue = function (dias) {
    var s = 0;
    if (dias) dias.forEach(function (v) { s += v; });
    return s;
  };

  function estat(a) {
    var n = a.length;
    if (!n) return { n: 0, media: 0, dp: 0 };
    var m = a.reduce(function (s, x) { return s + x; }, 0) / n;
    var v = n > 1 ? a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (n - 1) : 0;
    return { n: n, media: m, dp: Math.sqrt(v) };
  }

  /* Peças por pessoa em cada dia de trabalho, a partir da primeira entrega do corte. */
  function amostrasCorte(corte, dias, hoje, o) {
    if (!dias || !dias.size) return [];
    var datas = Array.from(dias.keys()).sort();
    var inicio = datas[0];
    var concluido = P.totalEntregue(dias) >= corte.quantidade || corte.encerrado;
    var fim = concluido ? datas[datas.length - 1] : hoje;
    if (!concluido && !dias.has(hoje)) fim = U.somarDias(hoje, -1); // hoje ainda não acabou: não conta como dia zero
    if (fim < inicio) fim = inicio;
    var limite = U.somarDias(hoje, -o.janela);
    var ini = inicio > limite ? inicio : limite;
    var conjunto = new Set(U.diasUteis(ini, fim, o.domingo));
    dias.forEach(function (_q, d) { if (d >= ini && d <= fim) conjunto.add(d); }); // entrega em dia "de folga" também conta
    var pessoas = Math.max(1, corte.pessoas || 1);
    return Array.from(conjunto).map(function (d) { return (dias.get(d) || 0) / pessoas; });
  }

  function ritmoCorte(corte, dias, global, hoje, o) {
    var e = estat(amostrasCorte(corte, dias, hoje, o));
    var w = e.n / (e.n + 5); // peso do histórico do próprio corte
    var media = w * e.media + (1 - w) * global.media;
    var dp = Math.max(w * e.dp + (1 - w) * global.dp, 0.25 * media);
    var pessoas = Math.max(1, corte.pessoas || 1);
    return { media: media * pessoas, dp: dp * pessoas, porPessoa: media, pessoas: pessoas, diasProprios: e.n };
  }

  P.dataDoDiaUtil = function (hoje, k, domingo) {
    var d = hoje, n = 0;
    for (var i = 0; i < 6000; i++) {
      if (U.ehDiaUtil(d, domingo)) { n++; if (n === k) return d; }
      d = U.somarDias(d, 1);
    }
    return null;
  };

  function simularConclusao(restante, ritmo, maxDias, rand, sims) {
    var saida = new Array(sims);
    for (var s = 0; s < sims; s++) {
      var acum = 0, d = 0;
      while (acum < restante && d < maxDias) {
        d++;
        var x = ritmo.media + ritmo.dp * normal(rand);
        if (x > 0) acum += x;
      }
      saida[s] = acum >= restante ? d : Infinity;
    }
    return saida;
  }
  var cmp = function (a, b) { return a < b ? -1 : a > b ? 1 : 0; };
  function quantil(ordenado, q) { return ordenado[Math.min(ordenado.length - 1, Math.floor(ordenado.length * q))]; }

  /*
   * Avalia todos os cortes de uma vez.
   * Devolve { confianca, global, cortes: Map(id -> resultado), abertos: [...] }.
   * Resultado de um corte: entregue, restante, concluido, ritmo, prob (0..1 ou null), terminaEm, intervalo, atrasado.
   */
  P.avaliar = function (cortes, entregas, hoje, opts) {
    var o = opcoes(opts);
    var idx = P.indexar(entregas);
    var vivos = cortes.filter(function (c) { return !c.excluido; });

    var todas = [];
    vivos.forEach(function (c) { Array.prototype.push.apply(todas, amostrasCorte(c, idx.get(c.id), hoje, o)); });
    var global = estat(todas);
    var confianca = global.n < 3 ? null : global.n < 10 ? 'baixa' : global.n < 30 ? 'média' : 'boa';

    var ctx = { hoje: hoje, o: o, global: global, confianca: confianca, cortes: new Map(), abertos: [] };

    vivos.forEach(function (c) {
      var dias = idx.get(c.id);
      var entregue = P.totalEntregue(dias);
      var restante = Math.max(0, c.quantidade - entregue);
      var r = { id: c.id, quantidade: c.quantidade, entregue: entregue, restante: restante, concluido: restante === 0, encerrado: !!c.encerrado, confianca: confianca, prob: null, terminaEm: null, intervalo: null, atrasado: false, semDados: false, ritmo: null };
      ctx.cortes.set(c.id, r);
      if (restante === 0 || c.encerrado) return;

      var atrasado = !!(c.prazo && c.prazo < hoje);
      if (atrasado) { r.atrasado = true; r.prob = 0; }
      if (!confianca) { r.semDados = true; return; }

      r.ritmo = ritmoCorte(c, dias, global, hoje, o);
      ctx.abertos.push({ corte: c, restante: restante, ritmo: r.ritmo });

      var rand = P.mulberry32(hashTexto(c.id) ^ o.seed);
      var comp = simularConclusao(restante, r.ritmo, o.maxDias, rand, o.sims);
      var ord = comp.slice().sort(cmp);
      var mediana = quantil(ord, 0.5), p10 = quantil(ord, 0.1), p90 = quantil(ord, 0.9);
      if (isFinite(mediana)) r.terminaEm = P.dataDoDiaUtil(hoje, mediana, o.domingo);
      if (isFinite(p90)) r.intervalo = [P.dataDoDiaUtil(hoje, p10, o.domingo), P.dataDoDiaUtil(hoje, p90, o.domingo)];
      if (c.prazo && !atrasado) {
        var D = U.diasUteis(hoje, c.prazo, o.domingo).length;
        r.diasAtePrazo = D;
        r.prob = comp.filter(function (x) { return x <= D; }).length / comp.length;
      }
    });
    return ctx;
  };

  P.periodoAtual = function (tipo, hoje) {
    if (tipo === 'semanal') return { inicio: U.inicioSemana(hoje), fim: U.fimSemana(hoje) };
    if (tipo === 'mensal') return { inicio: U.inicioMes(hoje), fim: U.fimMes(hoje) };
    return { inicio: U.inicioAno(hoje), fim: U.fimAno(hoje) };
  };

  /* Avalia uma meta (semanal, mensal ou anual) no período que contém "hoje". */
  P.avaliarMeta = function (meta, ctx, entregas, hoje, opts) {
    var o = opcoes(opts);
    var per = P.periodoAtual(meta.tipo, hoje);
    var entregues = 0, valor = 0;
    entregas.forEach(function (e) {
      if (!e.excluido && e.data >= per.inicio && e.data <= per.fim) { entregues += e.quantidade; valor += e.valor || 0; }
    });
    var alvo = meta.pecas || 0;
    var faltam = Math.max(0, alvo - entregues);
    var dias = U.diasUteis(hoje, per.fim, o.domingo).length;
    var supply = ctx.abertos.reduce(function (s, a) { return s + a.restante; }, 0);
    var r = {
      tipo: meta.tipo, inicio: per.inicio, fim: per.fim, alvo: alvo, entregues: entregues, faltam: faltam,
      valorEntregue: U.arred2(valor), alvoValor: meta.valor || null,
      pctAtingido: alvo > 0 ? entregues / alvo : null,
      diasRestantes: dias, necessarioPorDia: dias > 0 ? faltam / dias : faltam,
      supply: supply, faltaCorte: Math.max(0, faltam - supply),
      prob: null, projecao: null, semDados: false, semMeta: false,
    };
    if (alvo <= 0) { r.semMeta = true; return r; }
    if (faltam === 0) { r.prob = 1; return r; }
    if (dias === 0) { r.prob = 0; return r; }
    if (!ctx.confianca) { r.semDados = true; return r; }
    if (!ctx.abertos.length) { r.prob = 0; r.projecao = entregues; return r; }

    var lista = ctx.abertos.slice().sort(function (a, b) { return b.restante - a.restante; }).slice(0, 40);
    var rand = P.mulberry32(hashTexto(meta.tipo + per.inicio) ^ o.seed);
    // Períodos longos (ano) com muitos cortes: menos simulações para não pesar no celular.
    var sims = Math.max(150, Math.min(o.sims, 800, Math.floor(400000 / (dias * lista.length)))), ok = 0;
    for (var s = 0; s < sims; s++) {
      var rem = lista.map(function (a) { return a.restante; });
      var total = 0;
      externo:
      for (var d = 0; d < dias; d++) {
        for (var i = 0; i < lista.length; i++) {
          var x = lista[i].ritmo.media + lista[i].ritmo.dp * normal(rand);
          if (x > 0) {
            var pega = Math.min(x, rem[i]);
            rem[i] -= pega;
            total += pega;
          }
        }
        if (total >= faltam) break externo;
      }
      if (total >= faltam) ok++;
    }
    r.prob = ok / sims;
    r.projecao = Math.round(entregues + lista.reduce(function (s, a) {
      return s + Math.min(a.restante, dias * a.ritmo.media);
    }, 0));
    return r;
  };

  P.rotulo = function (prob) {
    if (prob === null || prob === undefined) return 'sem-dados';
    return prob >= 0.75 ? 'alta' : prob >= 0.4 ? 'media' : 'baixa';
  };

  C.previsao = P;
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
