/* Dados derivados e pedaços de tela usados em várias telas. */
(function (g) {
  'use strict';
  var C = (g.Costura = g.Costura || {});
  var U = C.util, K = C.calculo, P = C.previsao, M = C.armazem, ui = C.ui, h = ui.h;
  var X = {};

  X.domingo = function () { return M.cfg('trabalha_domingo', '0') === '1'; };
  X.tecidos = function () {
    var l = M.cfgJson('tecidos', null);
    return Array.isArray(l) && l.length ? l : C.config.TECIDOS_PADRAO.slice();
  };
  X.precoPadrao = function () {
    return {
      pala: Number(M.cfg('preco_pala', C.config.PRECO_PALA_PADRAO)),
      gancho: Number(M.cfg('preco_gancho', C.config.PRECO_GANCHO_PADRAO)),
    };
  };
  X.oficina = function () {
    var d = M.getMeta('dispositivo');
    return M.cfg('oficina', d ? d.nome : '') || 'Minha oficina';
  };

  /* Tudo que as telas precisam, calculado uma vez por versão dos dados. */
  var cache = { chave: null, valor: null };
  X.analise = function () {
    var hoje = U.hoje();
    var chave = M.versao() + '|' + hoje + '|' + X.domingo();
    if (cache.chave === chave) return cache.valor;

    var cortes = M.ativos('cortes'), fornecedores = M.ativos('fornecedores');
    var entregas = M.ativos('entregas');
    var mapaForn = new Map(fornecedores.map(function (f) { return [f.id, f]; }));
    var cortesIds = new Set(cortes.map(function (c) { return c.id; }));
    entregas = entregas.filter(function (e) { return cortesIds.has(e.corte_id); });
    var entPorCorte = new Map();
    entregas.forEach(function (e) {
      var l = entPorCorte.get(e.corte_id);
      if (!l) { l = []; entPorCorte.set(e.corte_id, l); }
      l.push(e);
    });
    var sit = new Map(cortes.map(function (c) { return [c.id, K.situacaoCorte(c, entPorCorte.get(c.id) || [])]; }));
    var opcoes = { domingo: X.domingo() };
    var prev = P.avaliar(cortes, entregas, hoje, opcoes);
    var metas = {};
    ['semanal', 'mensal', 'anual'].forEach(function (t) {
      var m = M.obter('metas', t);
      metas[t] = P.avaliarMeta({ tipo: t, pecas: m && !m.excluido ? m.pecas : 0, valor: m && !m.excluido ? m.valor : null }, prev, entregas, hoje, opcoes);
    });
    var abertos = cortes.filter(function (c) { return !c.encerrado && !sit.get(c.id).concluido; });
    var v = {
      hoje: hoje, cortes: cortes, fornecedores: fornecedores, entregas: entregas, mapaForn: mapaForn, entPorCorte: entPorCorte,
      sit: sit, prev: prev, metas: metas, abertos: abertos,
      totais: K.totaisPeriodos(entregas, hoje), fin: K.financeiro(cortes, entregas, fornecedores),
      pecasAFazer: abertos.reduce(function (s, c) { return s + sit.get(c.id).restante; }, 0),
    };
    cache = { chave: chave, valor: v };
    return v;
  };

  X.nomeFornecedor = function (id) {
    var f = M.obter('fornecedores', id);
    return f && !f.excluido ? f.nome : '(fornecedor removido)';
  };

  /* Selo de situação/probabilidade de um corte. */
  X.seloCorte = function (corte, r) {
    if (r.concluido) return h('span', { class: 'chip ok' }, 'Concluído');
    if (r.encerrado) return h('span', { class: 'chip' }, 'Encerrado');
    if (r.atrasado) return h('span', { class: 'chip perigo' }, 'Atrasado');
    if (r.semDados) return h('span', { class: 'chip' }, 'Previsão: faltam dados');
    if (r.prob === null || r.prob === undefined) {
      return r.terminaEm ? h('span', { class: 'chip primaria' }, 'Termina ~' + U.fmtDataCurta(r.terminaEm)) : h('span', { class: 'chip' }, 'Em aberto');
    }
    var nivel = P.rotulo(r.prob);
    return h('span', { class: 'chip ' + (nivel === 'alta' ? 'ok' : nivel === 'media' ? 'aviso' : 'perigo') }, U.chance(r.prob) + ' no prazo');
  };

  X.prazoTexto = function (corte, r) {
    if (!corte.prazo) return 'Sem prazo';
    var d = U.diasEntre(r.hoje || U.hoje(), corte.prazo);
    var base = 'Prazo ' + U.fmtDataCurta(corte.prazo);
    if (r.concluido) return base;
    if (d < 0) return base + ' · venceu há ' + (-d) + (d === -1 ? ' dia' : ' dias');
    if (d === 0) return base + ' · é hoje';
    return base + ' · ' + d + (d === 1 ? ' dia' : ' dias');
  };

  X.barra = function (pct, classe) {
    var el = h('div', { class: 'barra ' + (classe || ''), role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(pct * 100)) },
      h('i', { style: { width: Math.max(0, Math.min(1, pct)) * 100 + '%' } }));
    return el;
  };

  /* Cartão de um corte para listas. */
  X.cartaoCorte = function (corte, a, aoAbrir) {
    var s = a.sit.get(corte.id), r = a.prev.cortes.get(corte.id) || {};
    r.hoje = a.hoje;
    var linhaInfo = [corte.tecido, K.rotuloServico(corte.servico)];
    if (corte.referencia) linhaInfo.push('Ref. ' + corte.referencia);
    return h('button', { class: 'item', type: 'button', onclick: function () { aoAbrir(corte.id); } },
      h('div', { class: 'linha1' },
        h('div', null,
          h('div', { class: 'nome' }, X.nomeFornecedor(corte.fornecedor_id)),
          h('div', { class: 'detalhe' }, linhaInfo.join(' · '))),
        X.seloCorte(corte, r)),
      h('div', { style: { marginTop: '10px' } }, X.barra(s.pctEntregue, s.concluido ? 'ok' : '')),
      h('div', { class: 'rodape' },
        h('span', { class: 'num' }, h('strong', null, U.num(s.entregue)), ' de ' + U.num(corte.quantidade) + ' · ',
          s.concluido ? 'tudo entregue' : 'faltam ' + U.num(s.restante)),
        h('span', { class: 'dinheiro num' }, U.moeda(s.valorTotal))),
      h('div', { class: 'mini', style: { marginTop: '4px' } }, X.prazoTexto(corte, r)));
  };

  X.vazio = function (titulo, texto, botao) {
    return h('div', { class: 'vazio' }, h('strong', null, titulo), texto, botao ? h('div', { style: { marginTop: '14px' } }, botao) : null);
  };

  X.copiar = function (texto) {
    function plano() {
      var t = h('textarea', { style: { position: 'fixed', opacity: '0', top: '0' } });
      t.value = texto;
      document.body.appendChild(t);
      t.focus(); t.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(t);
      return ok;
    }
    if (g.navigator.clipboard && g.navigator.clipboard.writeText) {
      return g.navigator.clipboard.writeText(texto).then(function () { return true; }, function () { return plano(); });
    }
    return Promise.resolve(plano());
  };

  C.comum = X;
})(window);
