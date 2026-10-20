/*
 * Armazém de dados do app (offline primeiro).
 * - Tudo fica em memória para a tela ler na hora, e é gravado no aparelho em segundo plano:
 *     1) SQLite (cordova-sqlite-storage)  -> banco principal local
 *     2) dados.json na pasta privada      -> espelho em arquivo (também usado para recuperar o banco se ele se perder)
 *     (no navegador, para testes, usa localStorage no lugar do SQLite)
 * - Cada registro tem: id, atualizado_em, excluido (0/1) e sincronizado (0 = pendente, 1 = enviado, 2 = rejeitado pelo servidor).
 */
(function (g) {
  'use strict';
  var C = (g.Costura = g.Costura || {});
  var U = C.util;
  var COLECOES = ['fornecedores', 'cortes', 'entregas', 'metas', 'config'];
  var A = {};

  var dados = {}, meta = {}, ouvintes = [];
  var backend = null;
  var fila = { registros: new Map(), meta: {} };
  var timerGravar = null, timerArquivo = null, gravando = null;
  var estado = { backend: 'memoria', arquivo: false, erro: null, ultimoArquivo: null };
  var versao = 0; // sobe a cada mudança de dados: serve para não recalcular análises à toa

  COLECOES.forEach(function (c) { dados[c] = new Map(); });

  /* ---------------- backends ---------------- */
  function backendSqlite() {
    var db = g.sqlitePlugin.openDatabase({ name: 'costura.db', location: 'default' });
    function exec(sql, params) { return new Promise(function (res, rej) { db.executeSql(sql, params || [], res, rej); }); }
    return {
      nome: 'sqlite',
      iniciar: function () {
        return exec('CREATE TABLE IF NOT EXISTS registros (colecao TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY (colecao, id))')
          .then(function () { return exec('CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor TEXT)'); });
      },
      carregar: function () {
        var saida = { registros: [], meta: {} };
        return exec('SELECT colecao, json FROM registros').then(function (rs) {
          for (var i = 0; i < rs.rows.length; i++) {
            var l = rs.rows.item(i);
            try { saida.registros.push([l.colecao, JSON.parse(l.json)]); } catch (e) { /* linha corrompida: ignora */ }
          }
          return exec('SELECT chave, valor FROM meta');
        }).then(function (rs) {
          for (var i = 0; i < rs.rows.length; i++) {
            var l = rs.rows.item(i);
            try { saida.meta[l.chave] = JSON.parse(l.valor); } catch (e) { /* ignora */ }
          }
          return saida;
        });
      },
      gravar: function (registros, metaObj) {
        return new Promise(function (res, rej) {
          var cmds = [];
          registros.forEach(function (r) { cmds.push(['INSERT OR REPLACE INTO registros (colecao, id, json) VALUES (?, ?, ?)', [r[0], r[1].id, JSON.stringify(r[1])]]); });
          Object.keys(metaObj).forEach(function (k) { cmds.push(['INSERT OR REPLACE INTO meta (chave, valor) VALUES (?, ?)', [k, JSON.stringify(metaObj[k])]]); });
          if (!cmds.length) return res();
          db.sqlBatch(cmds, res, rej);
        });
      },
      limpar: function () {
        return exec('DELETE FROM registros').then(function () { return exec('DELETE FROM meta'); });
      },
    };
  }

  function backendLocalStorage() {
    var K = 'costura:armazem:v1';
    function ler() {
      try { return JSON.parse(g.localStorage.getItem(K)) || { registros: {}, meta: {} }; } catch (e) { return { registros: {}, meta: {} }; }
    }
    function escrever(o) { g.localStorage.setItem(K, JSON.stringify(o)); }
    return {
      nome: 'localStorage',
      iniciar: function () { g.localStorage.getItem(K); return Promise.resolve(); }, // lança erro se bloqueado
      carregar: function () {
        var o = ler(), saida = { registros: [], meta: o.meta || {} };
        Object.keys(o.registros || {}).forEach(function (k) {
          var i = k.indexOf('|');
          saida.registros.push([k.slice(0, i), o.registros[k]]);
        });
        return Promise.resolve(saida);
      },
      gravar: function (registros, metaObj) {
        var o = ler();
        registros.forEach(function (r) { o.registros[r[0] + '|' + r[1].id] = r[1]; });
        Object.keys(metaObj).forEach(function (k) { o.meta[k] = metaObj[k]; });
        try { escrever(o); return Promise.resolve(); } catch (e) { return Promise.reject(e); }
      },
      limpar: function () { try { g.localStorage.removeItem(K); } catch (e) { /* ignora */ } return Promise.resolve(); },
    };
  }

  function backendMemoria() {
    return {
      nome: 'memoria',
      iniciar: function () { return Promise.resolve(); },
      carregar: function () { return Promise.resolve({ registros: [], meta: {} }); },
      gravar: function () { return Promise.resolve(); },
      limpar: function () { return Promise.resolve(); },
    };
  }

  /* ---------------- gravação em segundo plano ---------------- */
  function avisar() {
    ouvintes.slice().forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  }
  var avisoAgendado = false;
  function agendarAviso() {
    if (avisoAgendado) return;
    avisoAgendado = true;
    Promise.resolve().then(function () { avisoAgendado = false; avisar(); });
  }

  function agendarGravacao() {
    if (timerGravar) return;
    timerGravar = setTimeout(A.gravarAgora, 60);
  }
  function agendarArquivo() {
    if (!C.arquivo.disponivel()) return;
    clearTimeout(timerArquivo);
    timerArquivo = setTimeout(A.gravarArquivo, 1500);
  }

  A.gravarAgora = function () {
    clearTimeout(timerGravar);
    timerGravar = null;
    if (!backend) return Promise.resolve();
    var registros = Array.from(fila.registros.values());
    var metaObj = fila.meta;
    if (!registros.length && !Object.keys(metaObj).length) return gravando || Promise.resolve();
    fila = { registros: new Map(), meta: {} };
    var anterior = gravando || Promise.resolve();
    gravando = anterior.then(function () { return backend.gravar(registros, metaObj); }).then(function () {
      estado.erro = null;
    }, function (e) {
      // Não perde nada: devolve para a fila e tenta de novo.
      registros.forEach(function (r) { var k = r[0] + '|' + r[1].id; if (!fila.registros.has(k)) fila.registros.set(k, r); });
      Object.keys(metaObj).forEach(function (k) { if (!(k in fila.meta)) fila.meta[k] = metaObj[k]; });
      estado.erro = (e && e.message) || String(e);
      console.error('Falha ao gravar no aparelho:', e);
      setTimeout(agendarGravacao, 5000);
    });
    agendarArquivo();
    return gravando;
  };

  A.gerarArquivo = function () {
    var corpo = { app: 'Costura', formato: 1, gravado_em: new Date().toISOString(), dispositivo: meta.dispositivo || null, ultimo_sync: meta.ultimo_sync || 0, dados: {} };
    COLECOES.forEach(function (c) { corpo.dados[c] = Array.from(dados[c].values()); });
    return corpo;
  };

  A.gravarArquivo = function () {
    clearTimeout(timerArquivo);
    if (!C.arquivo.disponivel()) return Promise.resolve(false);
    return C.arquivo.gravar(JSON.stringify(A.gerarArquivo())).then(function (ok) {
      estado.arquivo = !!ok;
      estado.ultimoArquivo = Date.now();
      return ok;
    }, function (e) {
      estado.arquivo = false;
      console.error('Falha ao gravar o arquivo no aparelho:', e);
      return false;
    });
  };

  /* ---------------- início ---------------- */
  function carregarNaMemoria(saida) {
    saida.registros.forEach(function (r) { if (dados[r[0]]) dados[r[0]].set(r[1].id, r[1]); });
    meta = saida.meta || {};
    versao++;
  }

  A.iniciar = function () {
    var tentativa;
    if (g.sqlitePlugin) tentativa = backendSqlite();
    else tentativa = backendLocalStorage();
    return tentativa.iniciar().then(function () { backend = tentativa; }, function (e) {
      console.warn('Armazenamento indisponível, usando memória:', e);
      backend = backendMemoria();
      estado.erro = 'Armazenamento local indisponível';
    }).then(function () {
      estado.backend = backend.nome;
      return backend.carregar();
    }).then(function (saida) {
      carregarNaMemoria(saida);
      // Se o banco está vazio mas existe o arquivo na pasta do app, recupera dele.
      if (!meta.dispositivo) return C.arquivo.ler().then(function (txt) { if (txt) A.restaurarDoArquivo(txt); });
    }).then(function () {
      estado.arquivo = C.arquivo.disponivel();
    });
  };

  A.restaurarDoArquivo = function (texto) {
    var o;
    try { o = JSON.parse(texto); } catch (e) { return false; }
    if (!o || o.app !== 'Costura' || !o.dispositivo || !o.dados) return false;
    COLECOES.forEach(function (c) {
      (o.dados[c] || []).forEach(function (r) { if (r && r.id) { dados[c].set(r.id, r); fila.registros.set(c + '|' + r.id, [c, r]); } });
    });
    meta.dispositivo = o.dispositivo;
    meta.ultimo_sync = 0; // reler tudo da nuvem na próxima sincronização
    fila.meta.dispositivo = meta.dispositivo;
    fila.meta.ultimo_sync = 0;
    agendarGravacao();
    return true;
  };

  /* ---------------- leitura ---------------- */
  A.estado = function () { return estado; };
  A.versao = function () { return versao; };
  A.todos = function (col) { return Array.from(dados[col].values()); };
  A.ativos = function (col) { return A.todos(col).filter(function (r) { return !r.excluido; }); };
  A.obter = function (col, id) { return dados[col].get(id) || null; };

  /* ---------------- escrita ---------------- */
  function guardar(col, reg) {
    versao++;
    dados[col].set(reg.id, reg);
    fila.registros.set(col + '|' + reg.id, [col, reg]);
    agendarGravacao();
    agendarAviso();
  }

  A.salvar = function (col, valores) {
    var antigo = valores.id ? dados[col].get(valores.id) : null;
    var reg = Object.assign({}, antigo || {}, valores);
    if (!reg.id) reg.id = U.uid();
    reg.excluido = 0;
    reg.atualizado_em = U.agora();
    reg.sincronizado = 0;
    guardar(col, reg);
    return reg;
  };

  A.excluir = function (col, id) {
    var antigo = dados[col].get(id);
    if (!antigo) return null;
    var reg = Object.assign({}, antigo, { excluido: 1, atualizado_em: U.agora(), sincronizado: 0 });
    guardar(col, reg);
    return reg;
  };

  /* Usado pela sincronização: aplica o que veio do servidor sem marcar como pendente. */
  A.aplicarRemoto = function (col, remoto) {
    var local = dados[col].get(remoto.id);
    if (local && local.atualizado_em >= remoto.atualizado_em) return false;
    guardar(col, Object.assign({}, remoto, { sincronizado: 1 }));
    return true;
  };

  A.marcarSincronizado = function (col, id, atualizadoEm, novoEstado) {
    var local = dados[col].get(id);
    if (!local || local.atualizado_em !== atualizadoEm) return; // foi editado depois do envio: continua pendente
    var reg = Object.assign({}, local, { sincronizado: novoEstado });
    dados[col].set(id, reg);
    fila.registros.set(col + '|' + id, [col, reg]);
    agendarGravacao();
  };

  A.pendentes = function () {
    var lista = {}, total = 0, rejeitados = 0;
    COLECOES.forEach(function (c) {
      lista[c] = [];
      dados[c].forEach(function (r) {
        if (!r.sincronizado) { lista[c].push(r); total++; } else if (r.sincronizado === 2) rejeitados++;
      });
    });
    return { lista: lista, total: total, rejeitados: rejeitados };
  };

  /* ---------------- meta (dispositivo, último sync, etc.) ---------------- */
  A.getMeta = function (k, padrao) { return k in meta ? meta[k] : padrao; };
  A.setMeta = function (k, v) {
    meta[k] = v;
    fila.meta[k] = v;
    agendarGravacao();
    if (k === 'dispositivo') agendarArquivo();
    agendarAviso();
  };

  /* ---------------- configurações (coleção "config", sincronizada) ---------------- */
  A.cfg = function (chave, padrao) {
    var r = dados.config.get(chave);
    return r && !r.excluido && r.valor !== null && r.valor !== undefined ? r.valor : padrao;
  };
  A.cfgJson = function (chave, padrao) {
    var v = A.cfg(chave, null);
    if (v === null) return padrao;
    try { return JSON.parse(v); } catch (e) { return padrao; }
  };
  A.definirCfg = function (chave, valor) {
    return A.salvar('config', { id: chave, valor: valor === null || valor === undefined ? null : String(valor) });
  };
  A.definirCfgJson = function (chave, obj) { return A.definirCfg(chave, JSON.stringify(obj)); };

  A.aoMudar = function (fn) {
    ouvintes.push(fn);
    return function () { ouvintes = ouvintes.filter(function (f) { return f !== fn; }); };
  };

  /* ---------------- apagar tudo do aparelho ---------------- */
  A.apagarTudo = function () {
    clearTimeout(timerGravar); clearTimeout(timerArquivo);
    timerGravar = null; timerArquivo = null;
    fila = { registros: new Map(), meta: {} };
    COLECOES.forEach(function (c) { dados[c].clear(); });
    meta = {};
    versao++;
    return Promise.resolve(gravando).then(function () { return backend ? backend.limpar() : null; })
      .then(function () { return C.arquivo.apagar(); })
      .then(function () { try { g.localStorage.removeItem('costura:pix_qr'); } catch (e) { /* ignora */ } })
      .then(function () { avisar(); });
  };

  A.COLECOES = COLECOES;
  C.armazem = A;
})(window);
