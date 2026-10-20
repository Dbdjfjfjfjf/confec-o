/* Financeiro (a receber, cobrança por Pix) e Metas. */
(function (g) {
  'use strict';
  var C = (g.Costura = g.Costura || {});
  var U = C.util, M = C.armazem, P = C.previsao, ui = C.ui, X = C.comum, h = ui.h;
  var T = (C.telas = C.telas || {});

  /* ---------- imagem do QR Code do Pix ---------- */
  function qrLocal() { return M.getMeta('pix_qr', null); }
  T.imagemPix = function () {
    var local = qrLocal();
    var img = h('img', { class: 'pix-qr', alt: 'QR Code do Pix', src: local || 'img/pix-qr.png' });
    var vazio = h('div', { class: 'pix-vazio oculto' }, 'Nenhum QR Code do Pix cadastrado ainda.', h('br'), 'Cadastre em Ajustes > Pix.');
    img.addEventListener('error', function () { img.classList.add('oculto'); vazio.classList.remove('oculto'); });
    return h('div', null, img, vazio);
  };

  /* ---------- financeiro ---------- */
  T.financeiro = function () {
    var a = X.analise();
    var pagina = h('div', { class: 'pagina' });
    pagina.appendChild(h('div', { class: 'titulo-secao' }, h('h2', null, 'Financeiro')));
    pagina.appendChild(h('div', { class: 'grade-kpi' },
      h('div', { class: 'kpi destaque' }, h('div', { class: 'rotulo' }, 'A receber'), h('div', { class: 'valor num' }, U.moeda(a.fin.aReceber))),
      h('div', { class: 'kpi' }, h('div', { class: 'rotulo' }, 'Já recebido'), h('div', { class: 'valor num' }, U.moeda(a.fin.recebido)))));

    var linhas = a.fin.porFornecedor;
    if (!linhas.length) {
      pagina.appendChild(X.vazio('Nada para cobrar ainda', 'Quando você registrar retiradas de peças prontas, o valor de cada fornecedor aparece aqui, com o Pix para cobrar.'));
      return pagina;
    }
    pagina.appendChild(h('div', { class: 'titulo-secao' }, h('h2', null, 'Por fornecedor')));
    pagina.appendChild(h('div', { class: 'lista' }, linhas.map(function (l) {
      var pend = l.entregasPendentes.length;
      return h('div', { class: 'item' },
        h('div', { class: 'linha1' },
          h('div', null, h('div', { class: 'nome' }, l.fornecedor.nome), h('div', { class: 'detalhe num' }, U.num(l.pecas) + ' peças retiradas · recebido ' + U.moeda(l.recebido))),
          h('div', { style: { textAlign: 'right' } }, h('div', { class: 'dinheiro num', style: { fontSize: '18px' } }, U.moeda(l.aReceber)),
            h('span', { class: 'chip ' + (pend ? 'aviso' : 'ok') }, pend ? pend + (pend === 1 ? ' retirada a receber' : ' retiradas a receber') : 'Em dia'))),
        pend ? h('div', { style: { marginTop: '10px' } }, h('button', { class: 'btn acento bloco', type: 'button', onclick: function () { T.cobrar(l.fornecedor.id); } }, 'Cobrar ' + U.moeda(l.aReceber))) : null);
    })));
    return pagina;
  };

  /* Cobrança: mostra o QR fixo e o valor a digitar; marca como pago depois. */
  T.cobrar = function (fornecedorId) {
    var a = X.analise();
    var linha = a.fin.porFornecedor.filter(function (l) { return l.fornecedor.id === fornecedorId; })[0];
    if (!linha || !linha.entregasPendentes.length) { ui.aviso('Nada a receber deste fornecedor'); return null; }
    var cortesMap = new Map(a.cortes.map(function (c) { return [c.id, c]; }));
    var pend = linha.entregasPendentes.slice().sort(function (x, y) { return x.data < y.data ? -1 : 1; });
    var marcadas = new Set(pend.map(function (e) { return e.id; }));

    var valorEl = h('div', { class: 'valor-grande num' });
    var botaoPago = h('button', { class: 'btn primario bloco', type: 'button' });
    var botaoCopiar = h('button', { class: 'btn bloco', type: 'button' }, 'Copiar valor');
    function total() { return U.arred2(pend.filter(function (e) { return marcadas.has(e.id); }).reduce(function (s, e) { return s + e.valor; }, 0)); }
    function atualizar() {
      valorEl.textContent = U.moeda(total());
      botaoPago.textContent = marcadas.size ? 'Marcar ' + (marcadas.size === pend.length ? 'tudo' : marcadas.size + (marcadas.size === 1 ? ' retirada' : ' retiradas')) + ' como pago' : 'Selecione o que foi pago';
      botaoPago.disabled = !marcadas.size;
      botaoCopiar.disabled = !marcadas.size;
    }

    var lista = h('div', { class: 'lista' }, pend.map(function (e) {
      var corte = cortesMap.get(e.corte_id);
      var cx = h('input', { type: 'checkbox', checked: true, 'aria-label': 'Incluir retirada de ' + U.fmtData(e.data) });
      cx.addEventListener('change', function () { if (cx.checked) marcadas.add(e.id); else marcadas.delete(e.id); atualizar(); });
      return h('label', { class: 'item', style: { display: 'flex', gap: '12px', alignItems: 'center' } },
        cx,
        h('div', { style: { flex: '1', minWidth: 0 } }, h('div', { class: 'nome num' }, U.num(e.quantidade) + ' peças · ' + U.fmtData(e.data)),
          h('div', { class: 'detalhe' }, corte ? [corte.tecido, corte.referencia ? 'Ref. ' + corte.referencia : null].filter(Boolean).join(' · ') : '')),
        h('div', { class: 'dinheiro num' }, U.moeda(e.valor)));
    }));

    var chave = M.cfg('pix_chave', '');
    var conteudo = h('div', { class: 'form' },
      h('div', { class: 'cartao' },
        h('div', { class: 'mini', style: { textAlign: 'center' } }, 'Cobrar de ' + linha.fornecedor.nome),
        valorEl,
        h('div', { class: 'mini', style: { textAlign: 'center', margin: '4px 0 12px' } }, 'Peça para ler o QR Code e digitar este valor.'),
        T.imagemPix(),
        chave ? h('div', { style: { marginTop: '12px', textAlign: 'center' } }, h('div', { class: 'mini' }, 'Chave Pix'), h('strong', { style: { overflowWrap: 'anywhere' } }, chave),
          h('div', { style: { marginTop: '6px' } }, h('button', { class: 'btn pequeno', type: 'button', onclick: function () { X.copiar(chave).then(function (ok) { ui.aviso(ok ? 'Chave copiada' : 'Não foi possível copiar', ok ? 'ok' : 'erro'); }); } }, 'Copiar chave'))) : null),
      h('div', null, h('div', { class: 'mini', style: { marginBottom: '6px' } }, 'Retiradas incluídas nesta cobrança:'), lista),
      botaoCopiar, botaoPago);
    var folha = ui.folha('Cobrança por Pix', conteudo);
    atualizar();

    botaoCopiar.addEventListener('click', function () {
      X.copiar(String(total().toFixed(2)).replace('.', ',')).then(function (ok) { ui.aviso(ok ? 'Valor copiado' : 'Não foi possível copiar', ok ? 'ok' : 'erro'); });
    });
    botaoPago.addEventListener('click', function () {
      var ids = Array.from(marcadas), v = total();
      ui.confirmar('Confirmar pagamento?', 'Marcar ' + ids.length + (ids.length === 1 ? ' retirada' : ' retiradas') + ' (' + U.moeda(v) + ') de ' + linha.fornecedor.nome + ' como pagas via Pix?', 'Marcar como pago').then(function (ok) {
        if (!ok) return;
        pend.forEach(function (e) {
          if (marcadas.has(e.id)) M.salvar('entregas', Object.assign({}, e, { pago: 1, pago_em: U.hoje(), forma_pagamento: 'Pix' }));
        });
        folha.fechar();
        ui.aviso(U.moeda(v) + ' recebidos', 'ok');
      });
    });
    return folha;
  };

  /* ---------- metas ---------- */
  var INFO_META = {
    semanal: { titulo: 'Meta da semana', ajuda: 'Semana de segunda a domingo.' },
    mensal: { titulo: 'Meta do mês', ajuda: 'Do dia 1 ao último dia do mês.' },
    anual: { titulo: 'Meta do ano', ajuda: 'De 1º de janeiro a 31 de dezembro.' },
  };

  T.metas = function () {
    var a = X.analise();
    var pagina = h('div', { class: 'pagina' });
    pagina.appendChild(h('div', { class: 'titulo-secao' }, h('h2', null, 'Metas')));
    if (!a.prev.confianca) {
      pagina.appendChild(h('div', { class: 'aviso-caixa info' }, 'A chance de bater cada meta aparece depois que houver entregas registradas em pelo menos 3 dias de trabalho.'));
    }
    ['semanal', 'mensal', 'anual'].forEach(function (tipo) { pagina.appendChild(cartaoMeta(tipo, a)); });
    pagina.appendChild(h('div', { class: 'mini' }, 'Como a chance é calculada: o app simula milhares de vezes os próximos dias de trabalho, usando o seu ritmo real (por pessoa do grupo) e o que ainda resta em cada corte aberto. A chance é a fração das simulações em que a meta é batida. É uma estimativa, não uma garantia.'));
    return pagina;
  };

  function cartaoMeta(tipo, a) {
    var m = a.metas[tipo], info = INFO_META[tipo];
    var salvo = M.obter('metas', tipo);
    var inPecas = ui.entradaInteiro(salvo && !salvo.excluido && salvo.pecas ? salvo.pecas : '', null, 'Ex.: 5000');
    var inValor = ui.entradaDinheiro(salvo && !salvo.excluido ? salvo.valor : null);
    var cPecas = ui.campo('Meta de peças', inPecas), cValor = ui.campo('Meta em R$', inValor, { opcional: true });
    var botao = h('button', { class: 'btn primario pequeno', type: 'button' }, 'Salvar meta');
    botao.addEventListener('click', function () {
      var vazio = inPecas.value.trim() === '';
      var p = vazio ? 0 : U.lerInteiro(inPecas.value);
      var v = inValor.value.trim() === '' ? null : U.lerNumero(inValor.value);
      cPecas.mostrarErro(p === null || p < 0 || p > 1000000000 ? 'Informe um número inteiro de peças.' : '');
      cValor.mostrarErro(inValor.value.trim() !== '' && (v === null || v < 0) ? 'Informe um valor válido.' : '');
      if (p === null || p < 0 || (inValor.value.trim() !== '' && (v === null || v < 0))) return;
      if (vazio && !salvo) return;
      M.salvar('metas', { id: tipo, tipo: tipo, pecas: p, valor: v });
      ui.aviso(p ? 'Meta salva' : 'Meta removida', 'ok');
    });

    var corpo = h('div', { class: 'cartao' },
      h('h2', null, info.titulo), h('div', { class: 'mini', style: { marginTop: '-6px', marginBottom: '10px' } }, info.ajuda + ' Período atual: ' + U.fmtData(m.inicio) + ' a ' + U.fmtData(m.fim) + '.'));

    if (!m.semMeta) {
      var chip;
      if (m.faltam === 0) chip = h('span', { class: 'chip ok' }, 'Meta batida');
      else if (m.prob === null) chip = h('span', { class: 'chip' }, 'Previsão: faltam dados');
      else { var n = P.rotulo(m.prob); chip = h('span', { class: 'chip ' + (n === 'alta' ? 'ok' : n === 'media' ? 'aviso' : 'perigo') }, U.chance(m.prob) + ' de chance de bater'); }
      corpo.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' } },
        h('span', { class: 'num' }, h('strong', { style: { fontSize: '26px' } }, U.num(m.entregues)), ' de ' + U.num(m.alvo) + ' peças'), chip));
      corpo.appendChild(h('div', { style: { margin: '8px 0' } }, X.barra(m.pctAtingido || 0, m.faltam === 0 ? 'ok' : 'acento')));
      var linhas = [];
      if (m.faltam > 0) {
        linhas.push('Faltam ' + U.num(m.faltam) + ' peças em ' + m.diasRestantes + (m.diasRestantes === 1 ? ' dia' : ' dias') + ' de trabalho' + (m.diasRestantes ? ' (precisa de ~' + U.num(m.necessarioPorDia) + ' por dia).' : '.'));
        if (m.projecao !== null && m.diasRestantes > 0) linhas.push('No ritmo atual, deve chegar a ~' + U.num(m.projecao) + ' peças no fim do período.');
        if (m.faltaCorte > 0 && !m.semDados) linhas.push('Atenção: mesmo entregando tudo que resta nos cortes em aberto (' + U.num(m.supply) + ' peças), faltam ' + U.num(m.faltaCorte) + ' peças. Você precisa receber mais cortes.');
      }
      if (m.alvoValor) linhas.push('Valor produzido no período: ' + U.moeda(m.valorEntregue) + ' de ' + U.moeda(m.alvoValor) + ' (' + U.pct(Math.min(1, m.valorEntregue / m.alvoValor)) + ').');
      linhas.forEach(function (t) { corpo.appendChild(h('p', { class: 'mini', style: { marginTop: '4px', fontSize: '13.5px' } }, t)); });
    } else {
      corpo.appendChild(h('p', { class: 'mini', style: { marginBottom: '10px' } }, 'Você ainda não definiu esta meta.'));
    }
    corpo.appendChild(h('div', { class: 'separador', style: { margin: '12px 0' } }));
    corpo.appendChild(h('div', { class: 'form' }, h('div', { class: 'duas' }, cPecas, cValor), botao));
    return corpo;
  }
})(window);
