/* Início do app: primeiro uso (termos + cadastro sem login), navegação e atualização das telas. */
(function (g) {
  'use strict';
  var C = (g.Costura = g.Costura || {});
  var U = C.util, M = C.armazem, N = C.nuvem, ui = C.ui, X = C.comum, h = ui.h;
  var T = (C.telas = C.telas || {});

  var ABAS = [
    { id: 'painel', rotulo: 'Painel', icone: 'painel' },
    { id: 'cortes', rotulo: 'Cortes', icone: 'cortes' },
    { id: 'financeiro', rotulo: 'Financeiro', icone: 'dinheiro' },
    { id: 'metas', rotulo: 'Metas', icone: 'metas' },
    { id: 'ajustes', rotulo: 'Ajustes', icone: 'ajustes' },
  ];
  var aba = 'painel', rodando = false, fila = [], renderAgendado = null, renderPendente = false;

  T.depois = function (fn) { fila.push(fn); };
  T.irPara = function (id) { aba = id; document.getElementById('tela').scrollTop = 0; desenharNav(); T.recarregar(); };

  function raiz() { return document.getElementById('app'); }

  /* ---------- desenho da tela atual ---------- */
  T.recarregar = function () {
    var el = document.getElementById('tela');
    if (!el || !rodando) return;
    var rolagem = el.scrollTop;
    ui.destruirGraficos();
    fila = [];
    var no;
    try {
      no = T[aba]();
    } catch (e) {
      console.error(e);
      no = h('div', { class: 'cartao' }, h('h2', null, 'Não foi possível abrir esta tela'), h('p', { class: 'mini' }, String((e && e.message) || e)));
    }
    ui.limpar(el).appendChild(no);
    var tarefas = fila; fila = [];
    tarefas.forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
    el.scrollTop = rolagem;
    desenharTopo();
  };

  function digitando() {
    var a = document.activeElement, el = document.getElementById('tela');
    return !!(a && el && el.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
  }
  /* Atualiza a tela quando os dados mudam, sem tirar o foco de quem está digitando. */
  function agendarRender() {
    clearTimeout(renderAgendado);
    renderAgendado = setTimeout(function () {
      if (digitando()) { renderPendente = true; return; }
      T.recarregar();
    }, 120);
  }
  document.addEventListener('focusout', function () {
    if (!renderPendente) return;
    setTimeout(function () { if (renderPendente && !digitando()) { renderPendente = false; T.recarregar(); } }, 200);
  });

  /* ---------- topo e navegação ---------- */
  function desenharTopo() {
    var topo = document.getElementById('topo');
    if (!topo) return;
    var est = N.estado(), pend = M.pendentes().total;
    var chip;
    if (est.fase === 'sincronizando') chip = h('span', { class: 'chip primaria' }, h('span', { class: 'ponto' }), 'Sincronizando');
    else if (est.fase === 'sem-servidor') chip = h('span', { class: 'chip aviso' }, h('span', { class: 'ponto' }), 'Sem servidor');
    else if (est.fase === 'erro') chip = h('span', { class: 'chip perigo' }, h('span', { class: 'ponto' }), 'Erro de sincronização');
    else if (est.fase === 'offline' || pend > 0) chip = h('span', { class: 'chip aviso' }, h('span', { class: 'ponto' }), pend + (pend === 1 ? ' pendente' : ' pendentes'));
    else if (est.fase === 'ok') chip = h('span', { class: 'chip ok' }, h('span', { class: 'ponto' }), 'Sincronizado');
    else chip = h('span', { class: 'chip' }, 'Salvo no aparelho');
    var botao = h('button', { class: 'link', type: 'button', style: { padding: 0 }, 'aria-label': 'Sincronizar agora', onclick: function () {
      N.sincronizar().then(function (r) { ui.aviso(r && r.ok ? 'Sincronizado' : (N.estado().mensagem || 'Não foi possível sincronizar'), r && r.ok ? 'ok' : 'erro'); });
    } }, chip);
    ui.limpar(topo).appendChild(h('div', { class: 'marca' }, h('strong', null, 'Costura'), h('span', null, X.oficina())));
    topo.appendChild(botao);
  }

  function desenharNav() {
    var nav = document.getElementById('nav');
    if (!nav) return;
    ui.limpar(nav);
    ABAS.forEach(function (a) {
      nav.appendChild(h('button', { type: 'button', 'aria-current': a.id === aba ? 'page' : null, onclick: function () { if (a.id === aba) { document.getElementById('tela').scrollTop = 0; return; } T.irPara(a.id); } },
        ui.icone(a.icone), h('span', null, a.rotulo)));
    });
  }

  /* ---------- app principal ---------- */
  function abrirApp() {
    var r = raiz();
    ui.limpar(r);
    r.appendChild(h('div', { class: 'topo', id: 'topo' }));
    r.appendChild(h('div', { class: 'fio' }));
    r.appendChild(h('div', { id: 'tela', role: 'main' }));
    r.appendChild(h('nav', { class: 'nav', id: 'nav', 'aria-label': 'Navegação principal' }));
    rodando = true;
    desenharNav();
    T.recarregar();
    M.aoMudar(agendarRender);
    N.aoMudar(function () { desenharTopo(); if (aba === 'ajustes') agendarRender(); });
    N.iniciarAutomatico();
    // grava o arquivo ao sair do app
    document.addEventListener('pause', function () { M.gravarAgora(); M.gravarArquivo(); }, false);
    g.addEventListener('pagehide', function () { M.gravarAgora(); });
  }

  /* ---------- primeiro uso ---------- */
  function logo() { var s = ui.icone('agulha'); return h('div', { class: 'logo' }, s); }

  function boasVindas() {
    rodando = false;
    var r = raiz();
    var inNome = ui.entrada({ placeholder: 'Ex.: Oficina da Maria', max: 120, capitalizar: 'words' });
    var cNome = ui.campo('Nome da sua oficina', inNome);
    var aceite = h('input', { type: 'checkbox', id: 'aceite', style: { width: '24px', height: '24px', accentColor: 'var(--primaria)', flex: 'none', marginTop: '2px' } });
    var erro = h('div', { class: 'erro', role: 'alert' });
    var botao = h('button', { class: 'btn acento bloco', type: 'button' }, 'Aceitar e começar');

    ui.limpar(r).appendChild(h('div', { style: { overflowY: 'auto', height: '100%' } }, h('div', { class: 'boasvindas' },
      logo(),
      h('h1', null, 'Costura'),
      h('p', null, 'Controle de produção de pala e gancho: cortes, entregas, valores, metas e previsões. Funciona sem internet e guarda uma cópia segura na nuvem.'),
      cNome,
      h('div', { class: 'termos', tabindex: '0', 'aria-label': 'Termos de uso' }, C.termos.map(function (s) { return h('div', null, h('h3', null, s.t), h('p', null, s.p)); })),
      h('label', { style: { display: 'flex', gap: '12px', alignItems: 'flex-start' }, for: 'aceite' }, aceite,
        h('span', null, 'Li e aceito os termos, inclusive a criação da pasta e do arquivo de dados neste aparelho e o envio da cópia para a nuvem.')),
      erro, botao,
      h('button', { class: 'btn fantasma bloco', type: 'button', onclick: function () { T.recuperarComCodigo(function () { abrirApp(); }); } }, 'Já usei o app: recuperar com código'))));

    botao.addEventListener('click', function () {
      var nome = inNome.value.trim();
      cNome.mostrarErro(nome ? '' : 'Digite o nome da oficina.');
      erro.textContent = '';
      if (!nome) { inNome.focus(); return; }
      if (!aceite.checked) { erro.textContent = 'Para continuar, marque que leu e aceita os termos.'; return; }
      botao.disabled = true;
      var disp = N.criarDispositivo(nome);
      M.definirCfg('oficina', nome);
      M.gravarAgora().then(function () { M.gravarArquivo(); mostrarCodigo(disp); });
    });
  }

  function mostrarCodigo(disp) {
    var r = raiz();
    var anotei = h('input', { type: 'checkbox', id: 'anotei', style: { width: '24px', height: '24px', accentColor: 'var(--primaria)', flex: 'none', marginTop: '2px' } });
    var erro = h('div', { class: 'erro', role: 'alert' });
    var continuar = h('button', { class: 'btn primario bloco', type: 'button' }, 'Continuar');
    ui.limpar(r).appendChild(h('div', { style: { overflowY: 'auto', height: '100%' } }, h('div', { class: 'boasvindas' },
      logo(),
      h('h1', null, 'Seu código de recuperação'),
      h('p', null, 'Não há login: este aparelho é o seu cadastro. Se você trocar de celular ou reinstalar o app, este código traz seus dados de volta.'),
      h('div', { class: 'codigo' }, U.formatarCodigo(disp.codigo)),
      h('button', { class: 'btn bloco', type: 'button', onclick: function () { X.copiar(U.formatarCodigo(disp.codigo)).then(function (ok) { ui.aviso(ok ? 'Código copiado' : 'Anote o código à mão', ok ? 'ok' : 'erro'); }); } }, 'Copiar código'),
      h('div', { class: 'aviso-caixa' }, 'Anote em papel ou tire um print. Depois você também pode vê-lo em Ajustes. Não compartilhe com ninguém.'),
      h('label', { style: { display: 'flex', gap: '12px', alignItems: 'flex-start' }, for: 'anotei' }, anotei, h('span', null, 'Anotei meu código de recuperação.')),
      erro, continuar)));
    continuar.addEventListener('click', function () {
      if (!anotei.checked) { erro.textContent = 'Marque depois de anotar o código.'; return; }
      abrirApp();
    });
  }

  /* ---------- botão voltar do Android ---------- */
  function configurarVoltar() {
    document.addEventListener('backbutton', function (e) {
      if (ui.fecharTopo()) { e.preventDefault(); return; }
      if (rodando && aba !== 'painel') { T.irPara('painel'); return; }
      if (g.navigator.app && g.navigator.app.exitApp) g.navigator.app.exitApp();
    }, false);
  }

  /* ---------- partida ---------- */
  function partir() {
    configurarVoltar();
    M.iniciar().then(function () {
      if (M.getMeta('dispositivo')) abrirApp(); else boasVindas();
    }).catch(function (e) {
      console.error(e);
      ui.limpar(raiz()).appendChild(h('div', { class: 'boasvindas' }, h('h1', null, 'Não foi possível abrir'), h('p', null, 'Erro ao ler os dados do aparelho: ' + ((e && e.message) || e))));
    });
  }

  function aoPronto() {
    if (g.cordova) document.addEventListener('deviceready', partir, false);
    else partir();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aoPronto); else aoPronto();
})(window);
