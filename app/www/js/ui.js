/* Peças de interface: construtor de elementos, folhas (modais), avisos, campos de formulário e gráficos. */
(function (g) {
  'use strict';
  var C = (g.Costura = g.Costura || {});
  var U = C.util;
  var ui = {};

  /* ---------- h(): cria elementos sem innerHTML (seguro contra injeção) ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) anexar(el, arguments[i]);
    return el;
  }
  function anexar(pai, filho) {
    if (filho === null || filho === undefined || filho === false) return;
    if (Array.isArray(filho)) { filho.forEach(function (f) { anexar(pai, f); }); return; }
    pai.appendChild(filho.nodeType ? filho : document.createTextNode(String(filho)));
  }
  ui.h = h;
  ui.limpar = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  /* ---------- ícones (traços simples, sem biblioteca) ---------- */
  var ICONES = {
    painel: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    cortes: '<path d="M4 7l8-4 8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 17l8 4 8-4"/>',
    dinheiro: '<circle cx="12" cy="12" r="9"/><path d="M14.8 9.2c-.5-.9-1.5-1.4-2.8-1.4-1.6 0-2.7.8-2.7 2 0 3 5.6 1.5 5.6 4.3 0 1.2-1.2 2-2.9 2-1.4 0-2.5-.6-3-1.6M12 6v1.8m0 8.4V18"/>',
    metas: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    ajustes: '<path d="M4 6h10m4 0h2M4 12h2m4 0h10M4 18h12m4 0h0"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    agulha: '<path d="M5 19L19 5"/><ellipse cx="17.5" cy="6.5" rx="1" ry="2.4" transform="rotate(45 17.5 6.5)"/><path d="M4 14c3 0 3-4 6-4s3 4 6 4" stroke-dasharray="2 2"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
  };
  ui.icone = function (nome) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONES[nome] || '';
    return s;
  };

  /* ---------- avisos rápidos ---------- */
  ui.aviso = function (texto, tipo) {
    var caixa = document.getElementById('avisos');
    if (!caixa) return;
    var el = h('div', { class: 'aviso-rapido ' + (tipo || ''), role: 'status' }, texto);
    caixa.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, tipo === 'erro' ? 5000 : 2600);
  };

  /* ---------- folhas (modais de baixo para cima) ---------- */
  var pilha = [];
  ui.temFolha = function () { return pilha.length > 0; };
  ui.fecharTopo = function () {
    if (!pilha.length) return false;
    pilha[pilha.length - 1].fechar();
    return true;
  };

  ui.folha = function (titulo, conteudo, opcoes) {
    opcoes = opcoes || {};
    var fundo, painel, fechada = false;
    var api = {
      fechar: function (valor) {
        if (fechada) return;
        fechada = true;
        pilha = pilha.filter(function (p) { return p !== api; });
        if (fundo.parentNode) fundo.parentNode.removeChild(fundo);
        if (opcoes.aoFechar) opcoes.aoFechar(valor);
      },
      corpo: null,
    };
    var corpo = h('div', { class: 'corpo' }, conteudo);
    api.corpo = corpo;
    painel = h('div', { class: 'folha', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
      h('header', null,
        h('h2', null, titulo),
        h('button', { class: 'fechar', type: 'button', 'aria-label': 'Fechar', onclick: function () { api.fechar(); } }, '×')),
      corpo);
    fundo = h('div', { class: 'fundo-folha', onclick: function (e) { if (e.target === fundo && !opcoes.travada) api.fechar(); } }, painel);
    document.body.appendChild(fundo);
    pilha.push(api);
    return api;
  };

  ui.confirmar = function (titulo, texto, rotulo, perigo) {
    return new Promise(function (res) {
      var decidiu = false;
      var f = ui.folha(titulo, h('div', { class: 'form' },
        h('p', null, texto),
        h('div', { class: 'linha-botoes' },
          h('button', { class: 'btn', type: 'button', onclick: function () { decidiu = true; f.fechar(); res(false); } }, 'Cancelar'),
          h('button', { class: 'btn ' + (perigo ? 'perigo' : 'primario'), type: 'button', onclick: function () { decidiu = true; f.fechar(); res(true); } }, rotulo || 'Confirmar'))),
        { aoFechar: function () { if (!decidiu) res(false); } });
    });
  };

  /* ---------- campos de formulário ---------- */
  ui.campo = function (rotulo, controle, opts) {
    opts = opts || {};
    var id = 'c' + Math.random().toString(36).slice(2, 8);
    if (controle.setAttribute && !controle.id && /^(INPUT|SELECT|TEXTAREA)$/.test(controle.tagName)) controle.id = id;
    var erro = h('div', { class: 'erro', role: 'alert' });
    var caixa = h('div', { class: 'campo' },
      h('label', { for: controle.id || id }, rotulo, opts.opcional ? h('span', { class: 'opcional' }, ' (opcional)') : null),
      controle,
      opts.dica ? h('div', { class: 'dica' }, opts.dica) : null,
      erro);
    caixa.mostrarErro = function (msg) {
      erro.textContent = msg || '';
      caixa.classList.toggle('invalido', !!msg);
    };
    return caixa;
  };

  ui.entrada = function (opts) {
    opts = opts || {};
    var el = h('input', {
      type: opts.tipo || 'text', value: opts.valor === undefined || opts.valor === null ? '' : opts.valor,
      placeholder: opts.placeholder, inputmode: opts.modo, maxlength: opts.max, autocomplete: 'off', autocapitalize: opts.capitalizar || 'sentences',
      enterkeyhint: 'next',
    });
    if (opts.aoMudar) el.addEventListener('input', opts.aoMudar);
    return el;
  };
  ui.entradaDinheiro = function (valor, aoMudar) {
    return ui.entrada({ modo: 'decimal', valor: valor === null || valor === undefined || valor === '' ? '' : Number(valor).toFixed(2).replace('.', ','), placeholder: '0,00', aoMudar: aoMudar });
  };
  ui.entradaInteiro = function (valor, aoMudar, placeholder) {
    return ui.entrada({ modo: 'numeric', valor: valor === null || valor === undefined ? '' : valor, placeholder: placeholder || '0', aoMudar: aoMudar });
  };
  ui.seletor = function (opcoes, valor, aoMudar) {
    var s = h('select', null, opcoes.map(function (o) {
      var rotulo = typeof o === 'string' ? o : o.rotulo, v = typeof o === 'string' ? o : o.valor;
      return h('option', { value: v, selected: v === valor }, rotulo);
    }));
    if (aoMudar) s.addEventListener('change', aoMudar);
    return s;
  };
  ui.segmento = function (opcoes, valor, aoMudar) {
    var atual = valor;
    var botoes = opcoes.map(function (o) {
      return h('button', { type: 'button', 'aria-pressed': String(o.valor === atual), dataset: { v: o.valor }, onclick: function () {
        atual = o.valor;
        botoes.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === atual)); });
        if (aoMudar) aoMudar(atual);
      } }, o.rotulo);
    });
    var el = h('div', { class: 'segmento', role: 'group' }, botoes);
    Object.defineProperty(el, 'valor', { get: function () { return atual; } });
    return el;
  };
  ui.interruptor = function (rotulo, marcado, aoMudar) {
    var cx = h('input', { type: 'checkbox', checked: !!marcado });
    if (aoMudar) cx.addEventListener('change', function () { aoMudar(cx.checked); });
    var el = h('label', { class: 'interruptor' }, cx, rotulo);
    Object.defineProperty(el, 'marcado', { get: function () { return cx.checked; }, set: function (v) { cx.checked = !!v; } });
    return el;
  };

  /* ---------- gráficos (Chart.js) ---------- */
  var graficos = [];
  ui.destruirGraficos = function () {
    graficos.forEach(function (c) { try { c.destroy(); } catch (e) { /* já destruído */ } });
    graficos = [];
  };
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

  /* Plugin: escreve o valor em cima de cada barra (gráficos precisos, sem depender de toque). */
  var rotulosBarras = {
    id: 'rotulosBarras',
    afterDatasetsDraw: function (chart, _args, opts) {
      if (!opts || !opts.mostrar) return;
      var ctx = chart.ctx, meta = chart.getDatasetMeta(0), dados = chart.data.datasets[0].data, horiz = chart.options.indexAxis === 'y';
      ctx.save();
      ctx.fillStyle = css('--tinta');
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textBaseline = horiz ? 'middle' : 'alphabetic';
      ctx.textAlign = horiz ? 'left' : 'center';
      meta.data.forEach(function (barra, i) {
        var v = dados[i];
        if (!v) return;
        var txt = (opts.formato || U.num)(v);
        if (horiz) ctx.fillText(txt, barra.x + 5, barra.y); else ctx.fillText(txt, barra.x, barra.y - 5);
      });
      ctx.restore();
    },
  };

  ui.graficoBarras = function (canvas, rotulos, valores, opts) {
    opts = opts || {};
    if (!g.Chart) return null;
    var horiz = !!opts.horizontal;
    var cor = css(opts.corVar || '--c-barra');
    var inst = new g.Chart(canvas, {
      type: 'bar',
      data: { labels: rotulos, datasets: [{ label: opts.rotulo || 'Peças', data: valores, backgroundColor: opts.cores || cor, borderRadius: 5, maxBarThickness: 38 }] },
      options: {
        indexAxis: horiz ? 'y' : 'x', responsive: true, maintainAspectRatio: false, animation: false,
        layout: { padding: horiz ? { right: 56 } : { top: 18 } },
        plugins: {
          legend: { display: false },
          rotulosBarras: { mostrar: opts.rotulosValor !== false, formato: opts.formato },
          tooltip: { callbacks: { label: function (c) { return (opts.formato || U.num)(c.parsed[horiz ? 'x' : 'y']) + (opts.sufixo || ''); }, afterLabel: opts.depois ? function (c) { return opts.depois(c.dataIndex); } : undefined } },
        },
        scales: {
          x: { grid: { display: horiz, color: css('--c-grade') }, ticks: { color: css('--c-texto'), maxRotation: 0, autoSkip: true, font: { size: 11 } }, beginAtZero: true, max: opts.maxX },
          y: { grid: { display: !horiz, color: css('--c-grade') }, ticks: { color: css('--c-texto'), precision: 0, font: { size: 11 } }, beginAtZero: true, max: opts.maxY },
        },
      },
      plugins: [rotulosBarras],
    });
    graficos.push(inst);
    return inst;
  };

  C.ui = ui;
})(window);
