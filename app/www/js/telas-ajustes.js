/* Ajustes: oficina, preços, tecidos, Pix, sincronização, recuperação, arquivo no aparelho e privacidade. */
(function (g) {
  'use strict';
  var C = (g.Costura = g.Costura || {});
  var U = C.util, M = C.armazem, N = C.nuvem, ui = C.ui, X = C.comum, h = ui.h;
  var T = (C.telas = C.telas || {});

  function cartao(titulo, ajuda) {
    var el = h('div', { class: 'cartao' }, h('h2', null, titulo), ajuda ? h('div', { class: 'mini', style: { marginTop: '-6px', marginBottom: '10px' } }, ajuda) : null);
    return el;
  }
  function hora(ms) {
    if (!ms) return 'ainda não';
    var d = new Date(ms);
    return U.fmtData(U.dataStr(d)) + ' às ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  T.ajustes = function () {
    var d = M.getMeta('dispositivo');
    var pagina = h('div', { class: 'pagina' });
    pagina.appendChild(h('div', { class: 'titulo-secao' }, h('h2', null, 'Ajustes')));

    /* --- oficina --- */
    var inOficina = ui.entrada({ valor: X.oficina(), max: 120, capitalizar: 'words' });
    var cOficina = ui.campo('Nome da oficina', inOficina);
    var c1 = cartao('Oficina');
    c1.appendChild(h('div', { class: 'form' }, cOficina, h('button', { class: 'btn primario pequeno', type: 'button', onclick: function () {
      var v = inOficina.value.trim();
      cOficina.mostrarErro(v ? '' : 'Digite um nome.');
      if (!v) return;
      M.definirCfg('oficina', v);
      ui.aviso('Salvo', 'ok');
    } }, 'Salvar')));
    pagina.appendChild(c1);

    /* --- preços padrão e dias --- */
    var pr = X.precoPadrao();
    var inPala = ui.entradaDinheiro(pr.pala), inGancho = ui.entradaDinheiro(pr.gancho);
    var cPala = ui.campo('Pala (R$)', inPala), cGancho = ui.campo('Gancho (R$)', inGancho);
    var c2 = cartao('Preços padrão', 'Valores sugeridos ao cadastrar um corte. Em cada corte você pode mudar.');
    c2.appendChild(h('div', { class: 'form' }, h('div', { class: 'duas' }, cPala, cGancho), h('button', { class: 'btn primario pequeno', type: 'button', onclick: function () {
      var p = U.lerNumero(inPala.value), gn = U.lerNumero(inGancho.value);
      cPala.mostrarErro(p !== null && p >= 0 && p <= 999 ? '' : 'Valor inválido.');
      cGancho.mostrarErro(gn !== null && gn >= 0 && gn <= 999 ? '' : 'Valor inválido.');
      if (p === null || p < 0 || p > 999 || gn === null || gn < 0 || gn > 999) return;
      M.definirCfg('preco_pala', p); M.definirCfg('preco_gancho', gn);
      ui.aviso('Preços padrão salvos', 'ok');
    } }, 'Salvar preços')));
    c2.appendChild(h('div', { class: 'separador', style: { margin: '14px 0 6px' } }));
    c2.appendChild(ui.interruptor('Trabalho também aos domingos', X.domingo(), function (v) { M.definirCfg('trabalha_domingo', v ? '1' : '0'); }));
    c2.appendChild(h('div', { class: 'mini' }, 'Usado nas previsões: dias sem trabalho não contam como dia parado.'));
    pagina.appendChild(c2);

    /* --- tecidos --- */
    var c3 = cartao('Tecidos', 'Opções que aparecem ao cadastrar um corte.');
    var tecidos = X.tecidos().filter(function (t) { return t !== 'Outro'; });
    var listaT = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' } }, tecidos.map(function (t) {
      return h('span', { class: 'chip primaria', style: { paddingRight: '4px' } }, t,
        h('button', { type: 'button', 'aria-label': 'Remover ' + t, style: { border: 0, background: 'none', color: 'inherit', fontSize: '18px', lineHeight: 1, padding: '2px 6px' }, onclick: function () {
          M.definirCfgJson('tecidos', tecidos.filter(function (x) { return x !== t; }));
        } }, '×'));
    }));
    var inTec = ui.entrada({ placeholder: 'Novo tecido (ex.: Sarja)', max: 60, capitalizar: 'words' });
    c3.appendChild(listaT);
    c3.appendChild(h('div', { style: { display: 'flex', gap: '8px' } }, inTec, h('button', { class: 'btn primario', type: 'button', onclick: function () {
      var v = inTec.value.trim();
      if (!v) return;
      if (tecidos.some(function (t) { return U.semAcento(t) === U.semAcento(v); })) { ui.aviso('Esse tecido já está na lista', 'erro'); return; }
      M.definirCfgJson('tecidos', tecidos.concat([v]));
    } }, 'Adicionar')));
    pagina.appendChild(c3);

    /* --- pix --- */
    var c4 = cartao('Pix', 'QR Code fixo (sem valor): o fornecedor lê e digita o valor cobrado.');
    var inChave = ui.entrada({ valor: M.cfg('pix_chave', ''), placeholder: 'CPF, telefone, e-mail ou chave aleatória', max: 120, capitalizar: 'none' });
    var arquivo = h('input', { type: 'file', accept: 'image/*', class: 'oculto' });
    arquivo.addEventListener('change', function () { if (arquivo.files && arquivo.files[0]) lerImagem(arquivo.files[0]); });
    c4.appendChild(h('div', { class: 'form' },
      T.imagemPix(),
      h('div', { class: 'linha-botoes' },
        h('button', { class: 'btn', type: 'button', onclick: function () { arquivo.click(); } }, M.getMeta('pix_qr', null) ? 'Trocar imagem do QR' : 'Escolher imagem do QR'),
        M.getMeta('pix_qr', null) ? h('button', { class: 'btn contorno-perigo', type: 'button', onclick: function () { M.setMeta('pix_qr', null); ui.aviso('Imagem removida'); } }, 'Remover') : null),
      arquivo,
      ui.campo('Chave Pix (opcional)', inChave, { dica: 'Aparece na cobrança com botão de copiar.' }),
      h('button', { class: 'btn primario pequeno', type: 'button', onclick: function () { M.definirCfg('pix_chave', inChave.value.trim() || null); ui.aviso('Chave salva', 'ok'); } }, 'Salvar chave'),
      h('div', { class: 'mini' }, 'Dica: a imagem também pode ser colocada no projeto em www/img/pix-qr.png antes de gerar o APK. A imagem escolhida aqui fica só neste aparelho.')));
    pagina.appendChild(c4);

    /* --- sincronização --- */
    var est = N.estado(), pend = M.pendentes();
    var c5 = cartao('Sincronização com a nuvem (Aiven)');
    var inUrl = ui.entrada({ tipo: 'url', valor: N.urlApi(), placeholder: 'https://seu-app.onrender.com', capitalizar: 'none', modo: 'url' });
    var cUrl = ui.campo('Endereço do servidor', inUrl);
    c5.appendChild(h('div', { class: 'form' },
      h('div', null,
        h('span', { class: 'chip ' + (est.fase === 'ok' ? 'ok' : est.fase === 'erro' ? 'perigo' : est.fase === 'offline' || est.fase === 'sem-servidor' ? 'aviso' : '') }, est.mensagem || 'Aguardando'),
        h('div', { class: 'mini num', style: { marginTop: '8px' } }, 'Pendentes de envio: ' + pend.total + ' · última sincronização: ' + hora(est.ultimo || (M.getMeta('ultimo_sync', 0) || null)))),
      pend.rejeitados ? h('div', { class: 'aviso-caixa' }, pend.rejeitados + (pend.rejeitados === 1 ? ' registro foi recusado' : ' registros foram recusados') + ' pelo servidor (dados inválidos). Edite e salve de novo para tentar outra vez.') : null,
      h('button', { class: 'btn primario', type: 'button', onclick: function (e) {
        var b = e.currentTarget; b.disabled = true; b.textContent = 'Sincronizando…';
        N.sincronizar().then(function (r) { ui.aviso(r && r.ok ? 'Sincronizado' : (N.estado().mensagem || 'Não foi possível sincronizar'), r && r.ok ? 'ok' : 'erro'); }).then(function () { b.disabled = false; b.textContent = 'Sincronizar agora'; });
      } }, 'Sincronizar agora'),
      cUrl,
      h('div', { class: 'linha-botoes' },
        h('button', { class: 'btn', type: 'button', onclick: function () {
          var v = inUrl.value.trim().replace(/\/+$/, '');
          if (!/^https:\/\/[^/\s]+/i.test(v) && !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(v)) { cUrl.mostrarErro('Use um endereço https:// completo.'); return; }
          cUrl.mostrarErro('');
          M.setMeta('api_url', v);
          ui.aviso('Endereço salvo', 'ok');
          N.sincronizar();
        } }, 'Salvar endereço'),
        h('button', { class: 'btn', type: 'button', onclick: function (e) {
          var b = e.currentTarget; b.disabled = true; b.textContent = 'Testando…';
          N.testarServidor().then(function (r) { ui.aviso(r.ok ? 'Servidor respondeu e o banco está ok' : 'Servidor não respondeu', r.ok ? 'ok' : 'erro'); }).then(function () { b.disabled = false; b.textContent = 'Testar servidor'; });
        } }, 'Testar servidor'))));
    pagina.appendChild(c5);

    /* --- recuperação --- */
    var c6 = cartao('Código de recuperação', 'Com ele você recupera seus dados se trocar de celular ou reinstalar o app.');
    var visivel = false;
    var codigoEl = h('div', { class: 'codigo' }, '•••••-•••••');
    var botaoVer = h('button', { class: 'btn', type: 'button' }, 'Mostrar código');
    botaoVer.addEventListener('click', function () {
      visivel = !visivel;
      codigoEl.textContent = visivel && d ? U.formatarCodigo(d.codigo) : '•••••-•••••';
      botaoVer.textContent = visivel ? 'Esconder código' : 'Mostrar código';
    });
    c6.appendChild(h('div', { class: 'form' }, codigoEl, h('div', { class: 'linha-botoes' }, botaoVer,
      h('button', { class: 'btn', type: 'button', onclick: function () { if (d) X.copiar(U.formatarCodigo(d.codigo)).then(function (ok) { ui.aviso(ok ? 'Código copiado' : 'Não foi possível copiar', ok ? 'ok' : 'erro'); }); } }, 'Copiar')),
      h('div', { class: 'mini' }, 'Anote em papel. Quem tiver este código consegue acessar seus dados — não compartilhe.'),
      h('button', { class: 'btn fantasma', type: 'button', onclick: function () { T.recuperarComCodigo(); } }, 'Recuperar dados com outro código')));
    pagina.appendChild(c6);

    /* --- arquivo no aparelho --- */
    var ea = M.estado();
    var c7 = cartao('Arquivo no aparelho', 'Seus dados também ficam num arquivo na pasta privada do app.');
    c7.appendChild(h('div', { class: 'form' },
      h('div', { class: 'mini', style: { overflowWrap: 'anywhere' } }, ea.arquivo ? 'Pasta: ' + C.config.PASTA + '/' + C.config.ARQUIVO + ' (área privada do app)' : 'Arquivo indisponível neste ambiente (funciona no aplicativo instalado no Android).'),
      h('div', { class: 'mini' }, 'Banco local: ' + (ea.backend === 'sqlite' ? 'SQLite' : ea.backend === 'localStorage' ? 'navegador (modo de teste)' : 'memória') + ' · última gravação do arquivo: ' + hora(ea.ultimoArquivo)),
      ea.erro ? h('div', { class: 'aviso-caixa perigo' }, 'Erro ao gravar no aparelho: ' + ea.erro) : null,
      ea.arquivo ? h('button', { class: 'btn', type: 'button', onclick: function () { M.gravarArquivo().then(function (ok) { ui.aviso(ok ? 'Arquivo atualizado' : 'Não foi possível gravar o arquivo', ok ? 'ok' : 'erro'); T.recarregar(); }); } }, 'Gravar arquivo agora') : null));
    pagina.appendChild(c7);

    /* --- fornecedores --- */
    var forns = M.ativos('fornecedores').sort(function (a, b) { return U.semAcento(a.nome) < U.semAcento(b.nome) ? -1 : 1; });
    var c8 = cartao('Fornecedores');
    c8.appendChild(forns.length
      ? h('div', { class: 'lista' }, forns.map(function (f) {
        return h('button', { class: 'item', type: 'button', onclick: function () { editarFornecedor(f.id); } },
          h('div', { class: 'nome' }, f.nome), f.telefone ? h('div', { class: 'detalhe' }, f.telefone) : null);
      }))
      : h('div', { class: 'mini' }, 'Os fornecedores aparecem aqui quando você cadastra o primeiro corte.'));
    pagina.appendChild(c8);

    /* --- privacidade --- */
    var c9 = cartao('Privacidade e dados');
    c9.appendChild(h('div', { class: 'form' },
      d ? h('div', { class: 'mini' }, 'Termos aceitos em ' + U.fmtData(String(d.termos_aceitos_em).slice(0, 10)) + ' (versão ' + d.termos_versao + ').') : null,
      h('button', { class: 'btn', type: 'button', onclick: function () { T.mostrarTermos(); } }, 'Ler os termos'),
      h('button', { class: 'btn contorno-perigo', type: 'button', onclick: apagarTudo }, 'Apagar tudo (aparelho e nuvem)')));
    pagina.appendChild(c9);

    pagina.appendChild(h('div', { class: 'mini', style: { textAlign: 'center' } }, 'Costura ' + C.config.APP_VERSAO));
    return pagina;
  };

  /* Reduz a foto do QR Code (PNG, para manter o código nítido) antes de guardar no aparelho. */
  function lerImagem(arq) {
    if (!/^image\//.test(arq.type)) { ui.aviso('Escolha um arquivo de imagem', 'erro'); return; }
    var url = URL.createObjectURL(arq);
    var img = new Image();
    img.onload = function () {
      var lado = 700, esc = Math.min(1, lado / Math.max(img.width, img.height));
      var cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(img.width * esc)); cv.height = Math.max(1, Math.round(img.height * esc));
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      var dados = cv.toDataURL('image/png');
      M.setMeta('pix_qr', dados);
      ui.aviso('QR Code do Pix salvo', 'ok');
    };
    img.onerror = function () { URL.revokeObjectURL(url); ui.aviso('Não foi possível ler essa imagem', 'erro'); };
    img.src = url;
  }

  function editarFornecedor(id) {
    var f = M.obter('fornecedores', id);
    if (!f) return;
    var inNome = ui.entrada({ valor: f.nome, max: 120, capitalizar: 'words' }), inTel = ui.entrada({ valor: f.telefone || '', tipo: 'tel', modo: 'tel', max: 30 });
    var cNome = ui.campo('Nome', inNome);
    var emUso = M.ativos('cortes').filter(function (c) { return c.fornecedor_id === id; }).length;
    var folha = ui.folha('Fornecedor', h('div', { class: 'form' }, cNome, ui.campo('Telefone', inTel, { opcional: true }),
      h('button', { class: 'btn primario bloco', type: 'button', onclick: function () {
        var v = inNome.value.trim();
        cNome.mostrarErro(v ? '' : 'Digite o nome.');
        if (!v) return;
        M.salvar('fornecedores', { id: id, nome: v, telefone: inTel.value.trim() || null });
        folha.fechar(); ui.aviso('Fornecedor atualizado', 'ok');
      } }, 'Salvar'),
      emUso ? h('div', { class: 'mini' }, 'Este fornecedor tem ' + emUso + (emUso === 1 ? ' corte' : ' cortes') + ' e não pode ser removido.')
        : h('button', { class: 'btn contorno-perigo bloco', type: 'button', onclick: function () {
          ui.confirmar('Remover fornecedor?', f.nome + ' será removido da lista.', 'Remover', true).then(function (ok) { if (ok) { M.excluir('fornecedores', id); folha.fechar(); ui.aviso('Fornecedor removido'); } });
        } }, 'Remover fornecedor')));
  }

  /* =============== termos, recuperação e apagar tudo =============== */
  T.mostrarTermos = function () {
    ui.folha('Termos de uso e privacidade', h('div', { class: 'form' }, C.termos.map(function (s) { return h('div', null, h('h3', { style: { fontSize: '15px', marginBottom: '4px' } }, s.t), h('p', { class: 'mini', style: { fontSize: '14px' } }, s.p)); })));
  };

  T.recuperarComCodigo = function (aoConcluir) {
    var inCodigo = ui.entrada({ placeholder: 'XXXXX-XXXXX', max: 14, capitalizar: 'characters', modo: 'text' });
    var cCodigo = ui.campo('Código de recuperação', inCodigo, { dica: 'O código que o app mostrou quando você começou a usar.' });
    var botao = h('button', { class: 'btn primario bloco', type: 'button' }, 'Recuperar meus dados');
    var precisaAceite = !M.getMeta('dispositivo'); // primeiro uso: também é preciso aceitar os termos
    var aceite = h('input', { type: 'checkbox', id: 'aceite-rec', style: { width: '24px', height: '24px', accentColor: 'var(--primaria)', flex: 'none', marginTop: '2px' } });
    var erroAceite = h('div', { class: 'erro', role: 'alert' });
    var folha = ui.folha('Recuperar com código', h('div', { class: 'form' }, cCodigo,
      h('div', { class: 'aviso-caixa info' }, 'Este aparelho passa a ser o aparelho ligado ao código. O aparelho antigo perde o acesso à nuvem.'),
      precisaAceite ? h('label', { for: 'aceite-rec', style: { display: 'flex', gap: '12px', alignItems: 'flex-start' } }, aceite,
        h('span', null, 'Li e aceito os termos (criação da pasta e do arquivo de dados neste aparelho e envio da cópia para a nuvem).')) : null,
      precisaAceite ? h('button', { class: 'btn fantasma pequeno', type: 'button', onclick: function () { T.mostrarTermos(); } }, 'Ler os termos') : null,
      erroAceite, botao));
    botao.addEventListener('click', function () {
      var cod = U.normalizarCodigo(inCodigo.value);
      if (cod.length !== 10) { cCodigo.mostrarErro('O código tem 10 letras e números.'); return; }
      cCodigo.mostrarErro('');
      erroAceite.textContent = '';
      if (precisaAceite && !aceite.checked) { erroAceite.textContent = 'Para continuar, marque que leu e aceita os termos.'; return; }
      botao.disabled = true; botao.textContent = 'Procurando…';
      N.restaurar(cod).then(function (r) {
        if (!r.ok) { cCodigo.mostrarErro(r.erro); botao.disabled = false; botao.textContent = 'Recuperar meus dados'; return; }
        botao.textContent = 'Baixando seus dados…';
        return N.sincronizar().then(function () { folha.fechar(); ui.aviso('Dados recuperados', 'ok'); if (aoConcluir) aoConcluir(); else T.recarregar(); });
      });
    });
  };

  function apagarTudo() {
    ui.confirmar('Apagar tudo?', 'Todos os cortes, retiradas, valores e metas serão apagados deste aparelho e da nuvem. Isso não pode ser desfeito.', 'Apagar tudo', true).then(function (ok) {
      if (!ok) return;
      N.apagarConta().then(function (r) {
        if (r.ok) return true;
        return ui.confirmar('Sem conexão com a nuvem', (r.erro || 'Não foi possível apagar na nuvem.') + ' Apagar só deste aparelho? Os dados na nuvem continuam e podem ser recuperados com o código.', 'Apagar só aqui', true);
      }).then(function (seguir) {
        if (!seguir) return;
        return M.apagarTudo().then(function () { g.location.reload(); });
      });
    });
  }
})(window);
