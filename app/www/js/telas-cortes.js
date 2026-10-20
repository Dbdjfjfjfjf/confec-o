/* Cortes: lista, detalhe, formulário de corte e formulário de retirada (entrega). */
(function (g) {
  'use strict';
  var C = (g.Costura = g.Costura || {});
  var U = C.util, K = C.calculo, M = C.armazem, ui = C.ui, X = C.comum, h = ui.h;
  var T = (C.telas = C.telas || {});

  var filtro = { situacao: 'abertos', busca: '' };

  /* =============== lista =============== */
  T.cortes = function () {
    var a = X.analise();
    var pagina = h('div', { class: 'pagina' });
    pagina.appendChild(h('div', { class: 'titulo-secao' }, h('h2', null, 'Cortes')));

    pagina.appendChild(ui.segmento([
      { valor: 'abertos', rotulo: 'Em aberto' }, { valor: 'concluidos', rotulo: 'Concluídos' }, { valor: 'todos', rotulo: 'Todos' },
    ], filtro.situacao, function (v) { filtro.situacao = v; T.recarregar(); }));

    var busca = ui.entrada({ tipo: 'search', valor: filtro.busca, placeholder: 'Buscar por fornecedor, referência ou tecido', capitalizar: 'none' });
    pagina.appendChild(busca);
    var listaEl = h('div');
    pagina.appendChild(listaEl);
    // Digitar na busca refaz só a lista (a caixa de busca continua com o foco).
    busca.addEventListener('input', U.debounce(function () { filtro.busca = busca.value; desenharLista(); }, 200));

    function desenharLista() {
      var termo = U.semAcento(filtro.busca);
      var lista = a.cortes.filter(function (c) {
        var s = a.sit.get(c.id), fechado = s.concluido || c.encerrado;
        if (filtro.situacao === 'abertos' && fechado) return false;
        if (filtro.situacao === 'concluidos' && !fechado) return false;
        if (!termo) return true;
        return U.semAcento([X.nomeFornecedor(c.fornecedor_id), c.referencia, c.tecido, c.tipo_linha, c.modelo, c.grupo].join(' ')).indexOf(termo) >= 0;
      });
      lista.sort(function (x, y) {
        if (filtro.situacao === 'abertos') {
          var px = x.prazo || '9999-99-99', py = y.prazo || '9999-99-99';
          return px < py ? -1 : px > py ? 1 : (y.data_recebimento > x.data_recebimento ? 1 : -1);
        }
        return y.data_recebimento > x.data_recebimento ? 1 : y.data_recebimento < x.data_recebimento ? -1 : 0;
      });
      ui.limpar(listaEl);
      if (!lista.length) {
        listaEl.appendChild(X.vazio(a.cortes.length ? 'Nenhum corte aqui' : 'Nenhum corte ainda',
          a.cortes.length ? 'Mude o filtro ou a busca.' : 'Quando um fornecedor trouxer peças, cadastre o corte para acompanhar a produção.',
          a.cortes.length ? null : h('button', { class: 'btn primario', type: 'button', onclick: function () { T.novoCorte(); } }, 'Cadastrar primeiro corte')));
      } else {
        listaEl.appendChild(h('div', { class: 'lista' }, lista.map(function (c) { return X.cartaoCorte(c, a, T.abrirCorte); })));
      }
    }
    desenharLista();
    pagina.appendChild(h('button', { class: 'fab', type: 'button', onclick: function () { T.novoCorte(); } }, ui.icone('mais'), 'Novo corte'));
    return pagina;
  };

  /* =============== detalhe =============== */
  T.abrirCorte = function (id) {
    var folha = ui.folha('Corte', h('div'), { });
    function desenhar() {
      var a = X.analise();
      var corte = M.obter('cortes', id);
      if (!corte || corte.excluido) { folha.fechar(); return; }
      var s = a.sit.get(id), r = a.prev.cortes.get(id) || {};
      r.hoje = a.hoje;
      var forn = M.obter('fornecedores', corte.fornecedor_id);
      var entregas = (a.entPorCorte.get(id) || []).slice().sort(function (x, y) { return y.data > x.data ? 1 : y.data < x.data ? -1 : y.atualizado_em - x.atualizado_em; });

      var info = [
        ['Tecido', corte.tecido], ['Serviço', K.rotuloServico(corte.servico)],
        ['Preço por peça', U.moeda(K.precoPeca(corte)) + (corte.servico === 'ambos' ? ' (pala ' + U.moeda(corte.preco_pala) + ' + gancho ' + U.moeda(corte.preco_gancho) + ')' : '')],
        corte.referencia ? ['Referência', corte.referencia] : null,
        corte.tipo_linha ? ['Tipo de linha', corte.tipo_linha] : null,
        corte.modelo ? ['Peça/modelo', corte.modelo] : null,
        ['Recebido em', U.fmtData(corte.data_recebimento)],
        corte.prazo ? ['Prazo', U.fmtData(corte.prazo)] : null,
        corte.grupo || corte.pessoas > 1 ? ['Grupo', (corte.grupo ? corte.grupo + ' · ' : '') + corte.pessoas + (corte.pessoas === 1 ? ' pessoa' : ' pessoas')] : null,
        corte.observacao ? ['Observação', corte.observacao] : null,
      ].filter(Boolean);

      var corpo = h('div', { class: 'form' },
        h('div', null,
          h('div', { class: 'linha1', style: { display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' } },
            h('div', { style: { minWidth: 0, overflowWrap: 'anywhere' } }, h('strong', { style: { fontSize: '19px' } }, X.nomeFornecedor(corte.fornecedor_id)),
              forn && forn.telefone ? h('div', { class: 'mini' }, forn.telefone) : null),
            h('div', { style: { flex: 'none' } }, X.seloCorte(corte, r)))),

        h('div', { class: 'cartao' },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' } },
            h('span', { class: 'num' }, h('strong', { style: { fontSize: '26px' } }, U.num(s.entregue)), ' de ' + U.num(corte.quantidade) + ' peças'),
            h('span', { class: 'mini' }, U.pct(s.pctEntregue))),
          h('div', { style: { margin: '8px 0' } }, X.barra(s.pctEntregue, s.concluido ? 'ok' : '')),
          h('div', { class: 'num', style: { fontWeight: '700' } }, s.concluido ? (s.excedente ? 'Entregue — ' + U.num(s.excedente) + ' a mais que o recebido' : 'Corte concluído') : 'Faltam ' + U.num(s.restante) + ' peças')),

        h('div', { class: 'duas' },
          h('div', { class: 'kpi' }, h('div', { class: 'rotulo' }, 'Valor do corte'), h('div', { class: 'valor num' }, U.moeda(s.valorTotal))),
          h('div', { class: 'kpi' }, h('div', { class: 'rotulo' }, 'A receber agora'), h('div', { class: 'valor num' }, U.moeda(s.valorAReceber)), h('div', { class: 'nota' }, 'já recebido: ' + U.moeda(s.valorRecebido)))),
        s.concluido ? null : h('div', { class: 'mini' }, 'Ainda falta produzir ' + U.moeda(s.valorFaltaProduzir) + ' neste corte.'),

        previsaoCorte(corte, r, a),

        h('div', { class: 'linha-botoes' },
          s.concluido ? null : h('button', { class: 'btn primario', type: 'button', onclick: function () { T.registrarRetirada(id); } }, 'Registrar retirada'),
          h('button', { class: 'btn', type: 'button', onclick: function () { T.editarCorte(id); } }, 'Editar')),

        h('div', { class: 'cartao' }, h('h2', null, 'Detalhes'),
          h('table', { class: 'tabela' }, h('tbody', null, info.map(function (l) { return h('tr', null, h('th', null, l[0]), h('td', null, l[1])); })))),

        h('div', null, h('h2', { style: { fontSize: '16px', margin: '4px 0 8px' } }, 'Retiradas (' + entregas.length + ')'),
          entregas.length
            ? h('div', { class: 'lista' }, entregas.map(function (e) {
              return h('button', { class: 'item', type: 'button', onclick: function () { T.registrarRetirada(id, e.id); } },
                h('div', { class: 'linha1' },
                  h('div', null, h('div', { class: 'nome num' }, U.num(e.quantidade) + ' peças'), h('div', { class: 'detalhe' }, U.fmtData(e.data) + (e.observacao ? ' · ' + e.observacao : ''))),
                  h('div', { style: { textAlign: 'right' } }, h('div', { class: 'dinheiro num' }, U.moeda(e.valor)),
                    h('span', { class: 'chip ' + (e.pago ? 'ok' : 'aviso') }, e.pago ? 'Pago' + (e.forma_pagamento ? ' · ' + e.forma_pagamento : '') : 'A receber'))));
            }))
            : h('div', { class: 'mini' }, 'Nenhuma retirada ainda. Quando o fornecedor buscar peças prontas, use "Registrar retirada" para descontar do corte.')),

        h('div', { class: 'linha-botoes' },
          h('button', { class: 'btn', type: 'button', onclick: function () { alternarEncerrado(corte, s, folha); } }, corte.encerrado ? 'Reabrir corte' : 'Encerrar corte'),
          h('button', { class: 'btn contorno-perigo', type: 'button', onclick: function () { excluirCorte(corte, entregas, folha); } }, 'Excluir corte')));

      ui.limpar(folha.corpo).appendChild(corpo);
    }
    desenhar();
    var parar = M.aoMudar(function () { desenhar(); });
    var antigo = folha.fechar;
    folha.fechar = function (v) { parar(); antigo(v); };
    return folha;
  };

  function previsaoCorte(corte, r, a) {
    if (r.concluido || r.encerrado) return null;
    var caixa = h('div', { class: 'cartao' }, h('h2', null, 'Previsão'));
    if (r.atrasado) {
      caixa.appendChild(h('p', null, 'O prazo (' + U.fmtData(corte.prazo) + ') já passou e ainda faltam ' + U.num(r.restante) + ' peças.'));
      if (r.terminaEm) caixa.appendChild(h('p', { class: 'mini', style: { marginTop: '6px' } }, 'No ritmo atual, termina por volta de ' + U.fmtData(r.terminaEm) + '.'));
      return caixa;
    }
    if (r.semDados) {
      caixa.appendChild(h('p', { class: 'mini' }, 'A previsão aparece depois que houver entregas em pelo menos 3 dias de trabalho (neste ou em outros cortes).'));
      return caixa;
    }
    if (r.prob !== null && r.prob !== undefined) {
      caixa.appendChild(h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '10px' } },
        h('strong', { style: { fontSize: '32px' }, class: 'num' }, U.chance(r.prob)), h('span', null, 'de chance de entregar tudo até ' + U.fmtData(corte.prazo))));
    }
    if (r.terminaEm) {
      caixa.appendChild(h('p', { style: { marginTop: '6px' } }, 'Termina por volta de ', h('strong', null, U.fmtData(r.terminaEm)),
        r.intervalo && r.intervalo[0] && r.intervalo[1] ? h('span', { class: 'mini' }, ' (provável entre ' + U.fmtDataCurta(r.intervalo[0]) + ' e ' + U.fmtDataCurta(r.intervalo[1]) + ')') : null));
    } else {
      caixa.appendChild(h('p', { style: { marginTop: '6px' } }, 'No ritmo atual não dá para estimar um término.'));
    }
    if (r.ritmo) {
      caixa.appendChild(h('p', { class: 'mini', style: { marginTop: '6px' } },
        'Ritmo estimado: ~' + U.num(r.ritmo.media) + ' peças por dia de trabalho' + (r.ritmo.pessoas > 1 ? ' (grupo de ' + r.ritmo.pessoas + ' pessoas, ~' + U.num(r.ritmo.porPessoa) + ' por pessoa)' : '') + '. Confiança da previsão: ' + (r.confianca || '—') + '.'));
    }
    return caixa;
  }

  function alternarEncerrado(corte, s, folha) {
    var fechar = !corte.encerrado;
    var txt = fechar && !s.concluido ? 'O corte ainda tem ' + U.num(s.restante) + ' peças por entregar. Ele deixa de entrar nas previsões e nas metas.' : 'O corte volta a aparecer em aberto.';
    ui.confirmar(fechar ? 'Encerrar corte?' : 'Reabrir corte?', txt, fechar ? 'Encerrar' : 'Reabrir').then(function (ok) {
      if (!ok) return;
      M.salvar('cortes', Object.assign({}, corte, { encerrado: fechar ? 1 : 0 }));
      ui.aviso(fechar ? 'Corte encerrado' : 'Corte reaberto', 'ok');
    });
  }

  function excluirCorte(corte, entregas, folha) {
    var txt = 'O corte de ' + X.nomeFornecedor(corte.fornecedor_id) + (corte.referencia ? ' (ref. ' + corte.referencia + ')' : '') + ' será apagado' +
      (entregas.length ? ', junto com ' + entregas.length + (entregas.length === 1 ? ' retirada' : ' retiradas') + ' e os valores delas' : '') + '. Isso não pode ser desfeito.';
    ui.confirmar('Excluir corte?', txt, 'Excluir', true).then(function (ok) {
      if (!ok) return;
      entregas.forEach(function (e) { M.excluir('entregas', e.id); });
      M.excluir('cortes', corte.id);
      folha.fechar();
      ui.aviso('Corte excluído');
    });
  }

  /* =============== formulário de corte =============== */
  T.novoCorte = function (fornecedorId) { return formCorte(null, fornecedorId); };
  T.editarCorte = function (id) { return formCorte(M.obter('cortes', id)); };

  function formCorte(corte, fornecedorPadrao) {
    var editando = !!corte;
    var a = X.analise();
    var padrao = X.precoPadrao();
    var base = corte || {
      fornecedor_id: fornecedorPadrao || '', tecido: X.tecidos()[0], servico: 'ambos', preco_pala: padrao.pala, preco_gancho: padrao.gancho,
      quantidade: '', referencia: '', tipo_linha: '', modelo: '', data_recebimento: U.hoje(), prazo: '', grupo: '', pessoas: 1, observacao: '',
    };

    // fornecedor
    var forns = a.fornecedores.slice().sort(function (x, y) { return U.semAcento(x.nome) < U.semAcento(y.nome) ? -1 : 1; });
    var NOVO = '__novo__';
    var opcoesForn = forns.map(function (f) { return { valor: f.id, rotulo: f.nome }; }).concat([{ valor: NOVO, rotulo: '+ Novo fornecedor…' }]);
    var selForn = ui.seletor(opcoesForn, forns.length ? (base.fornecedor_id || forns[0].id) : NOVO, atualizarForn);
    var nomeForn = ui.entrada({ placeholder: 'Nome de quem trouxe as peças', max: 120, capitalizar: 'words' });
    var telForn = ui.entrada({ tipo: 'tel', placeholder: '(85) 99999-0000', modo: 'tel', max: 30 });
    var blocoNovo = h('div', { class: 'form' });
    var cNome = ui.campo('Nome do fornecedor', nomeForn), cTel = ui.campo('Telefone', telForn, { opcional: true });
    blocoNovo.appendChild(cNome); blocoNovo.appendChild(cTel);
    var cForn = ui.campo('Quem trouxe as peças', selForn);
    function atualizarForn() { blocoNovo.classList.toggle('oculto', selForn.value !== NOVO); }

    // tecido
    var tecidos = X.tecidos();
    var tecidoNaLista = tecidos.indexOf(base.tecido) >= 0;
    var OUTRO = '__outro__';
    var opcoesTec = tecidos.filter(function (t) { return t !== 'Outro'; }).map(function (t) { return { valor: t, rotulo: t }; }).concat([{ valor: OUTRO, rotulo: 'Outro…' }]);
    var selTec = ui.seletor(opcoesTec, tecidoNaLista && base.tecido !== 'Outro' ? base.tecido : OUTRO, atualizarTec);
    var txtTec = ui.entrada({ placeholder: 'Qual tecido?', valor: tecidoNaLista ? '' : base.tecido, max: 60, capitalizar: 'words' });
    var cTecTxt = ui.campo('Nome do tecido', txtTec);
    var cTec = ui.campo('Tecido', selTec);
    function atualizarTec() { cTecTxt.classList.toggle('oculto', selTec.value !== OUTRO); }

    // serviço e preços
    var servico = base.servico;
    var inPala = ui.entradaDinheiro(base.preco_pala, atualizarTotal), inGancho = ui.entradaDinheiro(base.preco_gancho, atualizarTotal);
    var cPala = ui.campo('Preço da pala (R$)', inPala), cGancho = ui.campo('Preço do gancho (R$)', inGancho);
    var seg = ui.segmento([{ valor: 'pala', rotulo: 'Pala' }, { valor: 'gancho', rotulo: 'Gancho' }, { valor: 'ambos', rotulo: 'Os dois' }], servico, function (v) { servico = v; atualizarServico(); });
    var precos = h('div', { class: 'duas' }, cPala, cGancho);
    function atualizarServico() {
      cPala.classList.toggle('oculto', servico === 'gancho');
      cGancho.classList.toggle('oculto', servico === 'pala');
      precos.style.gridTemplateColumns = servico === 'ambos' ? '' : '1fr';
      atualizarTotal();
    }

    var inQtd = ui.entradaInteiro(base.quantidade, atualizarTotal, 'Ex.: 1000');
    var cQtd = ui.campo('Quantidade de peças', inQtd);
    var totalEl = h('strong', { class: 'num' }, U.moeda(0)), porPecaEl = h('span', { class: 'mini num' });
    var resumo = h('div', { class: 'resumo-valor' }, h('span', null, 'Valor total a receber'), totalEl, porPecaEl);
    function precoAtual() {
      var p = servico === 'gancho' ? 0 : U.lerNumero(inPala.value) || 0, gn = servico === 'pala' ? 0 : U.lerNumero(inGancho.value) || 0;
      return U.arred2(p + gn);
    }
    function atualizarTotal() {
      var q = U.lerInteiro(inQtd.value) || 0, pp = precoAtual();
      totalEl.textContent = U.moeda(pp * q);
      porPecaEl.textContent = U.moeda(pp) + ' por peça';
    }

    // opcionais
    var inRef = ui.entrada({ valor: base.referencia || '', placeholder: 'Ex.: A12, 3B-07', max: 40, capitalizar: 'characters' });
    var inLinha = ui.entrada({ valor: base.tipo_linha || '', placeholder: 'Ex.: poliéster 120, algodão', max: 60 });
    var inModelo = ui.entrada({ valor: base.modelo || '', placeholder: 'Ex.: shortinho, bermuda', max: 60 });
    var inData = ui.entrada({ tipo: 'date', valor: base.data_recebimento });
    var inPrazo = ui.entrada({ tipo: 'date', valor: base.prazo || '' });
    var inGrupo = ui.entrada({ valor: base.grupo || '', placeholder: 'Ex.: Grupo do WhatsApp B', max: 60 });
    var inPessoas = ui.entradaInteiro(base.pessoas || 1, null, '1');
    var inObs = h('textarea', { rows: '2', maxlength: '500', placeholder: 'Anotações sobre o corte' });
    inObs.value = base.observacao || '';
    var cData = ui.campo('Data em que recebeu', inData), cPrazo = ui.campo('Prazo de entrega', inPrazo, { opcional: true, dica: 'Com o prazo, o app calcula a chance de entregar a tempo.' });
    var cPessoas = ui.campo('Pessoas costurando este corte', inPessoas, { dica: 'Quantas pessoas do grupo vão trabalhar nele (ex.: 30 ou 40). Quanto maior o grupo, mais rápido o ritmo estimado.' });

    var erroGeral = h('div', { class: 'aviso-caixa perigo oculto', role: 'alert' });
    var salvar = h('button', { class: 'btn primario bloco', type: 'button' }, editando ? 'Salvar alterações' : 'Salvar corte');

    var conteudo = h('div', { class: 'form' },
      cForn, blocoNovo,
      cTec, cTecTxt,
      h('div', { class: 'campo' }, h('div', { class: 'rotulo' }, 'Serviço'), seg),
      precos, cQtd, resumo,
      ui.campo('Referência do corte', inRef, { opcional: true, dica: 'Letras e números que identificam o pacote.' }),
      ui.campo('Tipo de linha', inLinha, { opcional: true }),
      ui.campo('Peça / modelo', inModelo, { opcional: true }),
      h('div', { class: 'duas' }, cData, cPrazo),
      ui.campo('Nome do grupo', inGrupo, { opcional: true }), cPessoas,
      ui.campo('Observação', inObs, { opcional: true }),
      erroGeral, salvar);

    var folha = ui.folha(editando ? 'Editar corte' : 'Novo corte', conteudo);
    atualizarForn(); atualizarTec(); atualizarServico(); atualizarTotal();

    salvar.addEventListener('click', function () {
      var ok = true;
      function exigir(campo, cond, msg) { campo.mostrarErro(cond ? '' : msg); if (!cond) ok = false; }
      erroGeral.classList.add('oculto');
      var novoForn = selForn.value === NOVO;
      var nome = nomeForn.value.trim();
      exigir(cNome, !novoForn || nome.length > 0, 'Digite o nome de quem trouxe as peças.');
      var tecido = selTec.value === OUTRO ? txtTec.value.trim() : selTec.value;
      exigir(cTecTxt, selTec.value !== OUTRO || tecido.length > 0, 'Digite o nome do tecido.');
      var pala = servico === 'gancho' ? 0 : U.lerNumero(inPala.value), gancho = servico === 'pala' ? 0 : U.lerNumero(inGancho.value);
      exigir(cPala, servico === 'gancho' || (pala !== null && pala >= 0 && pala <= 999), 'Informe o preço da pala (ex.: 0,15).');
      exigir(cGancho, servico === 'pala' || (gancho !== null && gancho >= 0 && gancho <= 999), 'Informe o preço do gancho (ex.: 0,10).');
      var qtd = U.lerInteiro(inQtd.value);
      exigir(cQtd, qtd !== null && qtd >= 1 && qtd <= 10000000, 'Informe a quantidade de peças (inteiro maior que zero).');
      exigir(cData, /^\d{4}-\d{2}-\d{2}$/.test(inData.value), 'Informe a data.');
      var prazo = inPrazo.value || null;
      exigir(cPrazo, !prazo || prazo >= inData.value, 'O prazo não pode ser antes da data de recebimento.');
      var pessoas = U.lerInteiro(inPessoas.value);
      exigir(cPessoas, pessoas !== null && pessoas >= 1 && pessoas <= 10000, 'Informe quantas pessoas (mínimo 1).');
      if (ok && U.arred2((pala || 0) + (gancho || 0)) <= 0) { erroGeral.textContent = 'O preço por peça não pode ser zero.'; erroGeral.classList.remove('oculto'); ok = false; }
      if (!ok) return;

      var fornecedorId = selForn.value;
      if (novoForn) {
        var f = M.salvar('fornecedores', { nome: nome, telefone: telForn.value.trim() || null });
        fornecedorId = f.id;
      }
      var valores = {
        fornecedor_id: fornecedorId, tecido: tecido, servico: servico, preco_pala: pala || 0, preco_gancho: gancho || 0, quantidade: qtd,
        referencia: inRef.value.trim() || null, tipo_linha: inLinha.value.trim() || null, modelo: inModelo.value.trim() || null,
        data_recebimento: inData.value, prazo: prazo, grupo: inGrupo.value.trim() || null, pessoas: pessoas, observacao: inObs.value.trim() || null,
        encerrado: editando ? corte.encerrado || 0 : 0,
      };
      if (editando) valores.id = corte.id;
      var salvo = M.salvar('cortes', valores);
      folha.fechar();

      if (editando) {
        var mudouPreco = K.precoPeca(corte) !== K.precoPeca(salvo);
        var pendentes = (X.analise().entPorCorte.get(salvo.id) || []).filter(function (e) { return !e.pago; });
        if (mudouPreco && pendentes.length) {
          ui.confirmar('Atualizar valores das retiradas?', 'O preço por peça mudou. Recalcular o valor das ' + pendentes.length + (pendentes.length === 1 ? ' retirada ainda não paga' : ' retiradas ainda não pagas') + ' com o novo preço? As já pagas não mudam.', 'Recalcular').then(function (sim) {
            if (!sim) return;
            pendentes.forEach(function (e) { M.salvar('entregas', Object.assign({}, e, { valor: K.valorEntrega(salvo, e.quantidade) })); });
            ui.aviso('Valores atualizados', 'ok');
          });
        }
      }
      ui.aviso(editando ? 'Corte atualizado' : 'Corte cadastrado', 'ok');
      if (!editando) T.abrirCorte(salvo.id);
    });
    return folha;
  }

  /* =============== retirada (entrega de peças prontas) =============== */
  T.registrarRetirada = function (corteId, entregaId) {
    if (!corteId) return escolherCorteParaRetirada();
    var corte = M.obter('cortes', corteId);
    if (!corte || corte.excluido) return null;
    var existente = entregaId ? M.obter('entregas', entregaId) : null;
    var a = X.analise();
    var s = a.sit.get(corteId);
    var disponivel = s.restante + (existente && !existente.excluido ? existente.quantidade : 0); // ao editar, a própria retirada "devolve" as peças
    var padrao = existente || { quantidade: '', data: U.hoje(), pago: 0, forma_pagamento: null, observacao: '' };

    var inQtd = ui.entradaInteiro(padrao.quantidade, atualizar, disponivel ? 'Até ' + U.num(disponivel) : '0');
    var inData = ui.entrada({ tipo: 'date', valor: padrao.data });
    var inObs = ui.entrada({ valor: padrao.observacao || '', placeholder: 'Ex.: buscou à tarde', max: 300 });
    var formas = ['Pix', 'Dinheiro', 'Outro'];
    var selForma = ui.seletor(formas, padrao.forma_pagamento && formas.indexOf(padrao.forma_pagamento) >= 0 ? padrao.forma_pagamento : 'Pix');
    var blocoForma = h('div');
    var pago = ui.interruptor('Já recebi o pagamento desta retirada', !!padrao.pago, function (v) { blocoForma.classList.toggle('oculto', !v); });
    blocoForma.appendChild(ui.campo('Forma de pagamento', selForma));
    blocoForma.classList.toggle('oculto', !padrao.pago);

    var restamEl = h('strong', { class: 'num' }), valorEl = h('strong', { class: 'num' });
    var resumo = h('div', { class: 'cartao' },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '10px' } }, h('span', null, 'Valor desta retirada'), valorEl),
      h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '6px' } }, h('span', null, 'Peças que ainda faltam no corte'), restamEl));
    function atualizar() {
      var q = U.lerInteiro(inQtd.value) || 0;
      valorEl.textContent = U.moeda(K.valorEntrega(corte, q));
      var resta = disponivel - q;
      restamEl.textContent = resta >= 0 ? U.num(resta) : '0 (' + U.num(-resta) + ' a mais)';
    }
    var cQtd = ui.campo('Quantas peças prontas foram retiradas', inQtd), cData = ui.campo('Data da retirada', inData);
    var salvar = h('button', { class: 'btn primario bloco', type: 'button' }, existente ? 'Salvar retirada' : 'Registrar retirada');
    var apagar = existente ? h('button', { class: 'btn contorno-perigo bloco', type: 'button' }, 'Excluir esta retirada') : null;

    var conteudo = h('div', { class: 'form' },
      h('div', { class: 'cartao' },
        h('strong', null, X.nomeFornecedor(corte.fornecedor_id)),
        h('div', { class: 'mini num' }, [corte.tecido, K.rotuloServico(corte.servico), corte.referencia ? 'Ref. ' + corte.referencia : null].filter(Boolean).join(' · ')),
        h('div', { class: 'num', style: { marginTop: '6px' } }, 'Recebeu ' + U.num(corte.quantidade) + ' · já retirou ' + U.num(s.entregue - (existente && !existente.excluido ? existente.quantidade : 0)) + ' · faltam ' + U.num(disponivel))),
      cQtd, cData, resumo, pago, blocoForma,
      ui.campo('Observação', inObs, { opcional: true }), salvar, apagar);
    var folha = ui.folha(existente ? 'Editar retirada' : 'Registrar retirada', conteudo);
    atualizar();

    function gravar() {
      var q = U.lerInteiro(inQtd.value);
      cQtd.mostrarErro(q !== null && q >= 1 && q <= 10000000 ? '' : 'Informe a quantidade (inteiro maior que zero).');
      cData.mostrarErro(/^\d{4}-\d{2}-\d{2}$/.test(inData.value) ? '' : 'Informe a data.');
      if (q === null || q < 1 || q > 10000000 || !/^\d{4}-\d{2}-\d{2}$/.test(inData.value)) return;
      var valores = {
        corte_id: corteId, quantidade: q, data: inData.value, valor: K.valorEntrega(corte, q), pago: pago.marcado ? 1 : 0,
        pago_em: pago.marcado ? (existente && existente.pago_em ? existente.pago_em : U.hoje()) : null,
        forma_pagamento: pago.marcado ? selForma.value : null, observacao: inObs.value.trim() || null,
      };
      if (existente) valores.id = existente.id;
      M.salvar('entregas', valores);
      folha.fechar();
      ui.aviso('Retirada registrada: ' + U.num(q) + ' peças', 'ok');
    }
    salvar.addEventListener('click', function () {
      var q = U.lerInteiro(inQtd.value);
      if (q !== null && q > disponivel) {
        ui.confirmar('Mais peças do que o recebido', 'Você está registrando ' + U.num(q) + ' peças, mas só faltam ' + U.num(disponivel) + ' neste corte. Registrar mesmo assim?', 'Registrar').then(function (ok) { if (ok) gravar(); });
      } else gravar();
    });
    if (apagar) {
      apagar.addEventListener('click', function () {
        ui.confirmar('Excluir retirada?', 'As ' + U.num(existente.quantidade) + ' peças voltam a contar como pendentes neste corte.', 'Excluir', true).then(function (ok) {
          if (!ok) return;
          M.excluir('entregas', existente.id);
          folha.fechar();
          ui.aviso('Retirada excluída');
        });
      });
    }
    return folha;
  };

  function escolherCorteParaRetirada() {
    var a = X.analise();
    if (!a.abertos.length) { ui.aviso(a.cortes.length ? 'Todos os cortes já foram entregues' : 'Cadastre um corte primeiro', 'erro'); return null; }
    if (a.abertos.length === 1) return T.registrarRetirada(a.abertos[0].id);
    var folha = ui.folha('Qual corte?', h('div', { class: 'lista' }, a.abertos.map(function (c) {
      return X.cartaoCorte(c, a, function (id) { folha.fechar(); T.registrarRetirada(id); });
    })));
    return folha;
  }
})(window);
