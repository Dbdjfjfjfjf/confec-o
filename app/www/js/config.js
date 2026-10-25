/* Configuração do app. Troque API_URL pelo endereço da sua API (Render) antes de gerar o APK. */
(function (g) {
  'use strict';
  var C = (g.Costura = g.Costura || {});

  C.config = {
    // Endereço da API Node que fala com a Aiven. Também dá para mudar depois em Ajustes > Servidor.
    API_URL: ' https://costura-ltit.onrender.com',
    APP_VERSAO: '1.0.0',
    TERMOS_VERSAO: '1.0',
    PASTA: 'Costura',
    ARQUIVO: 'dados.json',
    TECIDOS_PADRAO: ['Jeans', 'Sarja', 'Brim', 'Tactel', 'Moletom', 'Malha', 'Outro'],
    PRECO_PALA_PADRAO: 0.15,
    PRECO_GANCHO_PADRAO: 0.1,
  };

  /* Texto dos termos. É um modelo: leia, ajuste e, se possível, peça revisão de um profissional antes de publicar. */
  C.termos = [
    { t: 'O que este aplicativo faz', p: 'O Costura ajuda você a controlar a produção de pala e gancho: cortes recebidos, quem trouxe, quanto cobrar, peças entregues, valores a receber, metas e previsões.' },
    { t: 'Sem login: este aparelho é o seu cadastro', p: 'Você não precisa de e-mail nem senha. Ao aceitar, o app cria um cadastro anônimo ligado a este aparelho, com um identificador e um código de recuperação. Guarde o código: com ele você recupera seus dados se trocar de celular ou reinstalar o app.' },
    { t: 'Pasta e arquivo no seu aparelho', p: 'Você autoriza o app a criar a pasta "Costura" na área privada do aplicativo neste aparelho e a manter nela um arquivo (dados.json) com todas as suas informações, atualizado conforme você usa o app. Essa área é protegida pelo Android: outros aplicativos não conseguem ler. Se você desinstalar o app ou limpar os dados dele, a pasta é apagada; para esse caso existe o código de recuperação.' },
    { t: 'Cópia na nuvem', p: 'Os mesmos dados também são enviados, quando há internet, para um banco de dados online (Aiven) por meio do servidor do app. Isso serve para ter uma cópia de segurança e permitir a recuperação. Os dados enviados são: nome da oficina, nomes e telefones dos fornecedores, cortes, entregas, valores, metas e configurações.' },
    { t: 'Dados de outras pessoas', p: 'Ao cadastrar fornecedores, você registra nome (e, se quiser, telefone) de terceiros. Cadastre só o necessário para o seu controle e avise essas pessoas, se for o caso.' },
    { t: 'Seus direitos', p: 'Você pode, a qualquer momento, ver seus dados no app, corrigi-los e apagar tudo (aparelho e nuvem) em Ajustes > Apagar tudo. Seus dados não são vendidos nem usados para propaganda.' },
    { t: 'Limites', p: 'As previsões de prazo e de metas são estimativas estatísticas feitas com o seu histórico, não garantias. Confira os valores antes de cobrar.' },
  ];
})(window);
