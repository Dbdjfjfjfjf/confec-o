/*
 * Nuvem: fala com a API (que fala com a Aiven). Nunca com o banco direto.
 * Registro do aparelho (sem login) e sincronização nos dois sentidos.
 */
(function (g) {
  'use strict';
  var C = (g.Costura = g.Costura || {});
  var U = C.util, M = C.armazem;
  var N = {};

  var LOTE = 400; // registros por coleção em cada envio (o servidor aceita até 1000)
  var estado = { fase: 'parado', mensagem: '', ultimo: null, erroPermanente: null };
  var emAndamento = null, repetir = false, ouvintes = [];

  function mudou() { ouvintes.slice().forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }
  N.aoMudar = function (f) { ouvintes.push(f); };
  N.estado = function () { return estado; };

  N.urlApi = function () {
    var u = M.getMeta('api_url', null) || C.config.API_URL || '';
    return String(u).replace(/\/+$/, '');
  };
  N.apiConfigurada = function () { return /^https?:\/\/[^/]+/i.test(N.urlApi()) && N.urlApi().indexOf('SEU-APP') < 0; };

  function plataforma() { return (g.device && g.device.platform) || (g.cordova ? 'cordova' : 'navegador'); }

  /* chamada HTTP com tempo limite; devolve { status, json } ou lança { offline: true } */
  function chamar(metodo, rota, corpo, token, timeoutMs) {
    var controle = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controle ? setTimeout(function () { controle.abort(); }, timeoutMs || 45000) : null;
    var cab = { 'Content-Type': 'application/json' };
    if (token) cab.Authorization = 'Bearer ' + token;
    return fetch(N.urlApi() + rota, { method: metodo, headers: cab, body: corpo ? JSON.stringify(corpo) : undefined, signal: controle ? controle.signal : undefined })
      .then(function (r) {
        return r.json().catch(function () { return null; }).then(function (json) { return { status: r.status, json: json }; });
      }, function () { throw { offline: true }; })
      .then(function (x) { if (timer) clearTimeout(timer); return x; }, function (e) { if (timer) clearTimeout(timer); throw e; });
  }

  /* ---------- registro ---------- */
  N.criarDispositivo = function (nome) {
    var disp = {
      id: U.uid(), token: U.token(), codigo: U.codigoRecuperacao(), nome: nome,
      termos_versao: C.config.TERMOS_VERSAO, termos_aceitos_em: new Date().toISOString(), registrado: false,
    };
    M.setMeta('dispositivo', disp);
    return disp;
  };

  function registrar() {
    var d = M.getMeta('dispositivo');
    function enviar(tentativa) {
      return chamar('POST', '/registrar', {
        id: d.id, token: d.token, codigo: d.codigo, nome: d.nome, termos_versao: d.termos_versao,
        termos_aceitos_em: d.termos_aceitos_em, aceitou: true, app_versao: C.config.APP_VERSAO, plataforma: plataforma(),
      }).then(function (r) {
        if (r.status === 200 || r.status === 201) {
          M.setMeta('dispositivo', Object.assign({}, M.getMeta('dispositivo'), { registrado: true }));
          return true;
        }
        if (r.status === 409 && r.json && r.json.erro === 'codigo_em_uso' && tentativa < 3) {
          d = Object.assign({}, M.getMeta('dispositivo'), { codigo: U.codigoRecuperacao() }); // código raro repetido: sorteia outro
          M.setMeta('dispositivo', d);
          return enviar(tentativa + 1);
        }
        if (r.status === 409) { estado.erroPermanente = 'Este aparelho já está registrado com outras credenciais. Use "Recuperar com código".'; return false; }
        if (r.status === 429) throw { offline: true, limite: true };
        estado.erroPermanente = (r.json && r.json.erro) || 'Não foi possível registrar (erro ' + r.status + ').';
        return false;
      });
    }
    return enviar(0);
  }

  /* ---------- sincronização ---------- */
  function sincronizarUmaVez() {
    var d = M.getMeta('dispositivo');
    var pend = M.pendentes();
    var mudancas = {}, enviados = [];
    M.COLECOES.forEach(function (c) {
      var lote = pend.lista[c].slice(0, LOTE);
      if (!lote.length) return;
      mudancas[c] = lote.map(function (r) {
        var limpo = Object.assign({}, r);
        delete limpo.sincronizado;
        enviados.push([c, r.id, r.atualizado_em]);
        return limpo;
      });
    });
    return chamar('POST', '/sync', { since: M.getMeta('ultimo_sync', 0), mudancas: mudancas }, d.token).then(function (r) {
      if (r.status === 401) { estado.erroPermanente = 'Este aparelho perdeu o acesso à nuvem. Em Ajustes, use "Recuperar com código".'; return { ok: false }; }
      if (r.status !== 200 || !r.json || !r.json.ok) {
        var e = new Error((r.json && r.json.erro) || 'Erro ' + r.status);
        e.http = r.status;
        throw e;
      }
      var j = r.json;
      var rejeitados = new Set((j.rejeitados || []).map(function (x) { return x.colecao + '|' + x.id; }));
      enviados.forEach(function (x) { M.marcarSincronizado(x[0], x[1], x[2], rejeitados.has(x[0] + '|' + x[1]) ? 2 : 1); });
      var recebidos = 0;
      M.COLECOES.forEach(function (c) {
        ((j.mudancas && j.mudancas[c]) || []).forEach(function (reg) { if (M.aplicarRemoto(c, reg)) recebidos++; });
      });
      M.setMeta('ultimo_sync', j.agora);
      estado.erroPermanente = null;
      estado.ultimo = Date.now();
      return { ok: true, enviados: enviados.length, recebidos: recebidos, mais: enviados.length >= LOTE };
    });
  }

  function executar() {
    var d = M.getMeta('dispositivo');
    if (!d) return Promise.resolve({ ok: false, motivo: 'sem-cadastro' });
    if (!N.apiConfigurada()) { estado.fase = 'sem-servidor'; estado.mensagem = 'Servidor não configurado'; mudou(); return Promise.resolve({ ok: false, motivo: 'sem-servidor' }); }
    estado.fase = 'sincronizando'; estado.mensagem = 'Sincronizando…'; mudou();

    var passo = d.registrado ? Promise.resolve(true) : registrar();
    return passo.then(function (ok) {
      if (!ok) return { ok: false };
      function laco(n) {
        return sincronizarUmaVez().then(function (r) { return r.ok && r.mais && n < 20 ? laco(n + 1) : r; });
      }
      return laco(0);
    }).then(function (r) {
      if (r && r.ok) { estado.fase = 'ok'; estado.mensagem = 'Sincronizado'; }
      else { estado.fase = 'erro'; estado.mensagem = estado.erroPermanente || 'Falha na sincronização'; }
      mudou();
      return r;
    }, function (e) {
      if (e && e.offline) { estado.fase = 'offline'; estado.mensagem = e.limite ? 'Muitas tentativas, aguarde' : 'Sem conexão — os dados estão salvos no aparelho'; }
      else { estado.fase = 'erro'; estado.mensagem = 'Erro no servidor: ' + ((e && e.message) || e); }
      mudou();
      return { ok: false, erro: e };
    });
  }

  /* Só uma sincronização por vez; se pedirem durante uma, roda de novo no final. */
  N.sincronizar = function () {
    if (emAndamento) { repetir = true; return emAndamento; }
    emAndamento = executar().then(function (r) {
      emAndamento = null;
      if (repetir) { repetir = false; return N.sincronizar(); }
      return r;
    }, function (e) { emAndamento = null; throw e; });
    return emAndamento;
  };

  var timerAgenda = null;
  N.agendar = function (ms) {
    clearTimeout(timerAgenda);
    timerAgenda = setTimeout(function () { N.sincronizar(); }, ms === undefined ? 2500 : ms);
  };

  N.iniciarAutomatico = function () {
    g.addEventListener('online', function () { N.sincronizar(); });
    document.addEventListener('resume', function () { N.sincronizar(); }, false);
    setInterval(function () {
      if (document.visibilityState !== 'hidden' && M.pendentes().total > 0 && estado.fase !== 'sincronizando') N.sincronizar();
    }, 60000);
    M.aoMudar(function () { if (M.pendentes().total > 0) N.agendar(); });
    N.sincronizar();
  };

  /* ---------- recuperar com código (reinstalou ou trocou de celular) ---------- */
  N.restaurar = function (codigo) {
    var token = U.token();
    return chamar('POST', '/restaurar', { codigo: U.normalizarCodigo(codigo), token: token, app_versao: C.config.APP_VERSAO, plataforma: plataforma() }, null, 30000)
      .then(function (r) {
        if (r.status === 200 && r.json && r.json.ok) {
          M.setMeta('dispositivo', {
            id: r.json.id, token: token, codigo: U.normalizarCodigo(codigo), nome: r.json.nome,
            termos_versao: C.config.TERMOS_VERSAO, termos_aceitos_em: new Date().toISOString(), registrado: true,
          });
          M.setMeta('ultimo_sync', 0);
          return { ok: true };
        }
        if (r.status === 404) return { ok: false, erro: 'Código não encontrado. Confira as letras e números.' };
        if (r.status === 429) return { ok: false, erro: 'Muitas tentativas. Aguarde uma hora e tente de novo.' };
        return { ok: false, erro: (r.json && r.json.erro) || 'Erro ' + r.status };
      }, function () { return { ok: false, erro: 'Sem conexão com o servidor. Verifique a internet.' }; });
  };

  /* ---------- apagar tudo na nuvem ---------- */
  N.apagarConta = function () {
    var d = M.getMeta('dispositivo');
    if (!d || !d.registrado) return Promise.resolve({ ok: true, nada: true });
    return chamar('DELETE', '/conta', null, d.token, 30000).then(function (r) {
      if (r.status === 200 || r.status === 401) return { ok: true };
      return { ok: false, erro: (r.json && r.json.erro) || 'Erro ' + r.status };
    }, function () { return { ok: false, erro: 'Sem conexão com o servidor.' }; });
  };

  N.testarServidor = function () {
    return chamar('GET', '/health', null, null, 45000).then(function (r) { return { ok: r.status === 200 && r.json && r.json.ok }; }, function () { return { ok: false }; });
  };

  C.nuvem = N;
})(window);
