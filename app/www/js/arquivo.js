/*
 * Arquivo de dados no aparelho (cordova-plugin-file).
 * Fica na área PRIVADA do app (cordova.file.dataDirectory), dentro da pasta "Costura": outros apps não leem.
 * Escreve num arquivo temporário e só depois troca pelo definitivo, para nunca deixar o dados.json pela metade.
 */
(function (g) {
  'use strict';
  var C = (g.Costura = g.Costura || {});
  var A = {};

  A.disponivel = function () {
    return !!(g.cordova && g.cordova.file && g.cordova.file.dataDirectory && g.resolveLocalFileSystemURL);
  };
  A.caminho = function () {
    return A.disponivel() ? g.cordova.file.dataDirectory + C.config.PASTA + '/' + C.config.ARQUIVO : null;
  };

  function pasta(criar) {
    return new Promise(function (res, rej) {
      g.resolveLocalFileSystemURL(g.cordova.file.dataDirectory, function (raiz) {
        raiz.getDirectory(C.config.PASTA, { create: !!criar }, res, rej);
      }, rej);
    });
  }
  function arquivoEm(dir, nome, criar) {
    return new Promise(function (res, rej) { dir.getFile(nome, { create: !!criar }, res, rej); });
  }
  function escrever(fileEntry, texto) {
    return new Promise(function (res, rej) {
      fileEntry.createWriter(function (w) {
        var blob = new Blob([texto], { type: 'application/json' });
        var escreveu = false;
        w.onerror = rej;
        w.onwriteend = function () {
          if (!escreveu) { escreveu = true; w.write(blob); } else res();
        };
        w.truncate(0); // limpa o que havia antes; ao terminar, grava o novo conteúdo
      }, rej);
    });
  }
  function mover(fileEntry, dir, nome) {
    return new Promise(function (res, rej) { fileEntry.moveTo(dir, nome, res, rej); });
  }

  A.gravar = function (texto) {
    if (!A.disponivel()) return Promise.resolve(false);
    var dir;
    return pasta(true).then(function (d) {
      dir = d;
      return arquivoEm(dir, C.config.ARQUIVO + '.tmp', true);
    }).then(function (tmp) {
      return escrever(tmp, texto).then(function () { return mover(tmp, dir, C.config.ARQUIVO); });
    }).then(function () { return true; });
  };

  A.ler = function () {
    if (!A.disponivel()) return Promise.resolve(null);
    return pasta(false).then(function (dir) {
      return arquivoEm(dir, C.config.ARQUIVO, false);
    }).then(function (fe) {
      return new Promise(function (res, rej) {
        fe.file(function (f) {
          var leitor = new FileReader();
          leitor.onloadend = function () { res(leitor.result || null); };
          leitor.onerror = rej;
          leitor.readAsText(f);
        }, rej);
      });
    }).catch(function () { return null; }); // não existe ainda
  };

  A.apagar = function () {
    if (!A.disponivel()) return Promise.resolve();
    return pasta(false).then(function (dir) {
      return new Promise(function (res) { dir.removeRecursively(res, res); });
    }).catch(function () {});
  };

  C.arquivo = A;
})(window);
