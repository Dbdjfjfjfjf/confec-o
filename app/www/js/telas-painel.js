/* Painel: peças entregues por dia/semana/mês/ano, valores, metas e cortes que pedem atenção. */
(function (g) {
  'use strict';
  var C = (g.Costura = g.Costura || {});
  var U = C.util, K = C.calculo, P = C.previsao, M = C.armazem, ui = C.ui, X = C.comum, h = ui.h;
  var T = (C.telas = C.telas || {});

  var estado = { periodo: 'semana' };
  var PERIODOS = {
    dia: { rotulo: 'Hoje', titulo: 'por dia', janela: 14, unidade: 'dia', campo: 'dia', valor: 'valorDia' },
    semana: { rotulo: 'Semana', titulo: 'por semana', janela: 12, unidade: 'semana', campo: 'semana', valor: 'valorSemana' },
    mes: { rotulo: 'Mês', titulo: 'por mês', janela: 12, unidade: 'mês', campo: 'mes', valor: 'valorMes' },
    ano: { rotulo: 'Ano', titulo: 'por ano', janela: 5, unidade: 'ano', campo: 'ano', valor: 'valorAno' },
  };
  var NOME_PERIODO = { dia: 'Hoje', semana: 'Esta semana', mes: 'Este mês', ano: 'Este ano' };

  T.painel = function () {
    var a = X.analise();
    var per = PERIODOS[estado.periodo];
    var pagina = h('div', { class: 'pagina' });

    pagina.appendChild(h('div', { class: 'linha-botoes' },
      h('button', { class: 'btn primario', type: 'button', onclick: function () { T.registrarRetirada(); } }, 'Registrar retirada'),
      h('button', { class: 'btn', type: 'button', onclick: function () { T.novoCorte(); } }, 'Novo corte')));

    if (!a.cortes.length) {
      pagina.appendChild(h('div', { class: 'cartao' }, X.vazio('Bem-vindo ao Costura', 'Cadastre o primeiro corte que um fornecedor trouxer. O painel, os valores e as previsões aparecem aqui conforme você registra as retiradas.',
        h('button', { class: 'btn acento', type: 'button', onclick: function () { T.novoCorte(); } }, 'Cadastrar primeiro corte'))));
      return pagina;
    }

    // seletor de período
    pagina.appendChild(ui.segmento(Object.keys(PERIODOS).map(function (k) { return { valor: k, rotulo: PERIODOS[k].rotulo }; }), estado.periodo, function (v) { estado.periodo = v; T.recarregar(); }));

    // KPIs
    var t = a.totais;
    pagina.appendChild(h('div', { class: 'grade-kpi' },
      h('div', { class: 'kpi destaque' }, h('div', { class: 'rotulo' }, NOME_PERIODO[estado.periodo] + ' — peças entregues'), h('div', { class: 'valor num' }, U.num(t[per.campo])), h('div', { class: 'nota num' }, U.moeda(t[per.valor]) + ' produzidos')),
      h('div', { class: 'kpi' }, h('div', { class: 'rotulo' }, 'A receber'), h('div', { class: 'valor num' }, U.moeda(a.fin.aReceber)), h('div', { class: 'nota num' }, 'já recebido: ' + U.moeda(a.fin.recebido))),
      h('div', { class: 'kpi' }, h('div', { class: 'rotulo' }, 'Peças a fazer'), h('div', { class: 'valor num' }, U.num(a.pecasAFazer)), h('div', { class: 'nota' }, a.abertos.length + (a.abertos.length === 1 ? ' corte em aberto' : ' cortes em aberto'))),
      h('div', { class: 'kpi' }, h('div', { class: 'rotulo' }, 'Falta produzir (R$)'), h('div', { class: 'valor num' }, U.moeda(a.abertos.reduce(function (s, c) { return s + a.sit.get(c.id).valorFaltaProduzir; }, 0))), h('div', { class: 'nota' }, 'nos cortes em aberto'))));

    // gráfico de entregas
    var serie = K.serie(a.entregas, per.unidade === 'mês' ? 'mes' : per.unidade, a.hoje, per.janela);
    var total = serie.pecas.reduce(function (s, v) { return s + v; }, 0);
    var com = serie.pecas.filter(function (v) { return v > 0; }).length;
    var canvas = h('canvas', { 'aria-label': 'Gráfico de peças entregues ' + per.titulo, role: 'img' });
    pagina.appendChild(h('div', { class: 'cartao' },
      h('h2', null, 'Peças entregues ' + per.titulo),
      h('div', { class: 'graf' }, canvas),
      h('div', { class: 'mini num', style: { marginTop: '8px' } }, 'No gráfico: ' + U.num(total) + ' peças' + (com ? ' · média de ' + U.num(total / serie.pecas.length) + ' por ' + per.unidade : '') + '. Toque numa barra para ver o valor em R$.')));
    // o gráfico precisa do canvas já na tela; desenha logo após a página entrar no documento
    T.depois(function () {
      ui.graficoBarras(canvas, serie.rotulos, serie.pecas, { rotulo: 'Peças', depois: function (i) { return 'Valor: ' + U.moeda(serie.valor[i]); }, rotulosValor: serie.pecas.length <= 14 });
    });

    // metas
    var temMeta = ['semanal', 'mensal', 'anual'].some(function (k) { return a.metas[k].alvo > 0; });
    pagina.appendChild(h('div', { class: 'titulo-secao' }, h('h2', null, 'Metas'), h('button', { class: 'link', type: 'button', onclick: function () { T.irPara('metas'); } }, temMeta ? 'Ver detalhes' : 'Definir metas')));
    if (temMeta) {
      pagina.appendChild(h('div', { class: 'lista' }, ['semanal', 'mensal', 'anual'].filter(function (k) { return a.metas[k].alvo > 0; }).map(function (k) { return T.resumoMeta(a.metas[k]); })));
    } else {
      pagina.appendChild(h('div', { class: 'cartao mini' }, 'Defina quantas peças quer entregar por semana, mês e ano. O app mostra a chance de bater cada meta.'));
    }

    // cortes que pedem atenção
    var risco = a.abertos.slice().sort(function (x, y) {
      var rx = a.prev.cortes.get(x.id), ry = a.prev.cortes.get(y.id);
      function peso(c, r) { return r.atrasado ? -1 : r.prob === null || r.prob === undefined ? 2 + (c.prazo ? 0 : 1) : r.prob; }
      var d = peso(x, rx) - peso(y, ry);
      return d !== 0 ? d : (x.prazo || '9999') < (y.prazo || '9999') ? -1 : 1;
    }).slice(0, 5);
    pagina.appendChild(h('div', { class: 'titulo-secao' }, h('h2', null, 'Cortes em andamento'), h('button', { class: 'link', type: 'button', onclick: function () { T.irPara('cortes'); } }, 'Ver todos')));
    pagina.appendChild(risco.length
      ? h('div', { class: 'lista' }, risco.map(function (c) { return X.cartaoCorte(c, a, T.abrirCorte); }))
      : h('div', { class: 'cartao mini' }, 'Nenhum corte em aberto. Tudo entregue!'));

    if (a.prev.confianca) {
      pagina.appendChild(h('div', { class: 'mini', style: { textAlign: 'center' } }, 'Confiança das previsões: ' + a.prev.confianca + ' (' + a.prev.global.n + ' dias de trabalho no histórico). Elas melhoram conforme você registra as retiradas.'));
    }
    return pagina;
  };

  /* Linha-resumo de uma meta: usada no painel e na tela de metas. */
  T.resumoMeta = function (m) {
    var nomes = { semanal: 'Meta da semana', mensal: 'Meta do mês', anual: 'Meta do ano' };
    var chip;
    if (m.semMeta) chip = h('span', { class: 'chip' }, 'Sem meta');
    else if (m.prob === null) chip = h('span', { class: 'chip' }, 'Previsão: faltam dados');
    else if (m.faltam === 0) chip = h('span', { class: 'chip ok' }, 'Meta batida');
    else { var n = P.rotulo(m.prob); chip = h('span', { class: 'chip ' + (n === 'alta' ? 'ok' : n === 'media' ? 'aviso' : 'perigo') }, U.chance(m.prob) + ' de chance'); }
    return h('div', { class: 'item' },
      h('div', { class: 'linha1' }, h('div', null, h('div', { class: 'nome' }, nomes[m.tipo]), h('div', { class: 'detalhe' }, U.fmtDataCurta(m.inicio) + ' a ' + U.fmtDataCurta(m.fim))), chip),
      h('div', { style: { marginTop: '10px' } }, X.barra(m.pctAtingido || 0, m.faltam === 0 ? 'ok' : 'acento')),
      h('div', { class: 'rodape num' }, h('span', null, h('strong', null, U.num(m.entregues)), ' de ' + U.num(m.alvo) + ' peças'), h('span', null, m.faltam ? 'faltam ' + U.num(m.faltam) : 'concluída')));
  };
})(window);
