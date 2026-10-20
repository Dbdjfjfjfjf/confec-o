/* Funções de apoio: datas (sempre texto AAAA-MM-DD), dinheiro, números, ids e segurança. */
(function (g) {
  'use strict';
  var C = (g.Costura = g.Costura || {});
  var U = {};

  var pad = function (n) { return String(n).padStart(2, '0'); };
  var cripto = g.crypto || (typeof require === 'function' ? require('crypto').webcrypto : null);

  /* ---------- identificadores e segredos ---------- */
  function bytesAleatorios(n) {
    var b = new Uint8Array(n);
    cripto.getRandomValues(b);
    return b;
  }

  U.uid = function () {
    var b = bytesAleatorios(16);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return x.toString(16).padStart(2, '0'); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  };

  U.token = function () {
    return Array.prototype.map.call(bytesAleatorios(32), function (x) { return x.toString(16).padStart(2, '0'); }).join('');
  };

  var ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sem I, L, O, 0 e 1
  U.codigoRecuperacao = function () {
    var saida = '';
    while (saida.length < 10) {
      var b = bytesAleatorios(16);
      for (var i = 0; i < b.length && saida.length < 10; i++) {
        if (b[i] < 248) saida += ALFABETO[b[i] % 31]; // 248 = 31 * 8, evita viés
      }
    }
    return saida;
  };
  U.normalizarCodigo = function (c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  U.formatarCodigo = function (c) { c = U.normalizarCodigo(c); return c.slice(0, 5) + '-' + c.slice(5); };

  var ultimoTempo = 0;
  /* Relógio estritamente crescente: duas edições no mesmo milissegundo não empatam. */
  U.agora = function () {
    ultimoTempo = Math.max(Date.now(), ultimoTempo + 1);
    return ultimoTempo;
  };

  /* ---------- datas ---------- */
  U.dataStr = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  U.hoje = function () { return U.dataStr(new Date()); };
  U.paraDate = function (s) {
    var p = s.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2], 12);
  };
  U.somarDias = function (s, n) {
    var d = U.paraDate(s);
    d.setDate(d.getDate() + n);
    return U.dataStr(d);
  };
  U.diasEntre = function (a, b) { return Math.round((U.paraDate(b) - U.paraDate(a)) / 86400000); };
  U.diaDaSemana = function (s) { return U.paraDate(s).getDay(); }; // 0 = domingo
  U.inicioSemana = function (s) { // semana começa na segunda
    var dow = (U.diaDaSemana(s) + 6) % 7;
    return U.somarDias(s, -dow);
  };
  U.fimSemana = function (s) { return U.somarDias(U.inicioSemana(s), 6); };
  U.inicioMes = function (s) { return s.slice(0, 8) + '01'; };
  U.fimMes = function (s) {
    var d = U.paraDate(s);
    return U.dataStr(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
  };
  U.inicioAno = function (s) { return s.slice(0, 4) + '-01-01'; };
  U.fimAno = function (s) { return s.slice(0, 4) + '-12-31'; };
  U.fmtData = function (s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : ''; };
  U.fmtDataCurta = function (s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) : ''; };
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  U.nomeMes = function (s) { return MESES[Number(s.slice(5, 7)) - 1]; };
  U.nomeDiaSemana = function (s) { return SEMANA[U.diaDaSemana(s)]; };

  U.ehDiaUtil = function (s, trabalhaDomingo) { return trabalhaDomingo || U.diaDaSemana(s) !== 0; };
  /* Lista de datas de ini a fim (inclusive) que são dias de trabalho. */
  U.diasUteis = function (ini, fim, trabalhaDomingo) {
    var lista = [];
    if (!ini || !fim || ini > fim) return lista;
    var d = ini;
    for (var guarda = 0; d <= fim && guarda < 4000; guarda++) {
      if (U.ehDiaUtil(d, trabalhaDomingo)) lista.push(d);
      d = U.somarDias(d, 1);
    }
    return lista;
  };

  /* ---------- números e dinheiro ---------- */
  U.arred2 = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };
  var fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  var fmtNum = new Intl.NumberFormat('pt-BR');
  U.moeda = function (n) { return fmtMoeda.format(U.arred2(n)).replace(/ /g, ' '); };
  U.num = function (n) { return fmtNum.format(Math.round(Number(n) || 0)); };
  U.pct = function (p) {
    if (p === null || p === undefined || Number.isNaN(p)) return '—';
    var v = p * 100;
    if (v > 99 && v < 100) return '99%';
    if (v > 0 && v < 1) return '<1%';
    return Math.round(v) + '%';
  };
  /* Probabilidade de uma previsão: nunca mostra 100% (é estimativa, não garantia). */
  U.chance = function (p) {
    if (p === null || p === undefined || Number.isNaN(p)) return '—';
    if (p >= 0.995) return '>99%';
    if (p <= 0) return '0%';
    if (p < 0.005) return '<1%';
    return Math.round(p * 100) + '%';
  };
  /* Aceita "0,15", "1.234,56", "0.15" e "R$ 2". Devolve null se não for número. */
  U.lerNumero = function (txt) {
    if (txt === null || txt === undefined) return null;
    var s = String(txt).replace(/R\$/gi, '').replace(/\s/g, '');
    if (!s) return null;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    return parseFloat(s);
  };
  U.lerInteiro = function (txt) {
    var s = String(txt === null || txt === undefined ? '' : txt).replace(/[.\s]/g, '');
    if (!/^\d+$/.test(s)) return null;
    return parseInt(s, 10);
  };
  /* Número para campo de texto: 0.15 -> "0,15" */
  U.paraCampo = function (n) { return String(n === null || n === undefined ? '' : n).replace('.', ','); };

  /* ---------- texto ---------- */
  U.esc = function (s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  U.semAcento = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); };
  U.debounce = function (fn, ms) {
    var t;
    return function () {
      var a = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, a); }, ms);
    };
  };

  C.util = U;
  if (typeof module !== 'undefined' && module.exports) module.exports = U;
})(typeof window !== 'undefined' ? window : globalThis);
