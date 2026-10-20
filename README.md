# confec-o
Aplicativo voltado para gerenciamento de confecções!
cd /workspaces/confec-o && cordova create app com.bvrstudios.costura Costura && cd app && cordova platform add android && cordova plugin add cordova-sqlite-storage && cordova plugin add cordova-plugin-network-information && cordova requirements


bem o aplicativo vai ser para gerenciar/monitorar produções de pala e gancho. Por exemplo:

a confecção que vai utilizar isso vai querer que o app mostre:

O nome da pessoa que trouxe as peças para fazer (pala e gancho)
De opções de tecido(jeans, ... outros ______)
Quanto o confeccionista (costureiro) irá cobrar por cada pala, gancho ou os dois (geralmente fazendo os dois, completo, ganha 25 -30 centavos sendo shortinho - 15 centavos a pala e 10 o gancho, mas de a opção do preco para quem irá fazer as peças )
O valor total em dinheiro que irá receber.
Quantidade de peça para fazer
quantidade de peças entregues (dia, semana, mes e ano) utilizando um painel voltado para esta parte com graficos precisos.
O sistema de desconto de peças (ex.: o fornecedor traz 1000 peças durante à manhã, mas, à tarde ele veio novamente mas só que dessa vez foi para pegar o que já tinha feito dessas peças que pode ser 300 por exemplo - descontando 300 de 1000 peças)
cobrança por pix, nesta parte eu colocarei uma imagem de um qr code fixo, sem valor personalizado, para o fornecedor apenas ler e personalizar o valor
Adicionar a referencia desse corte - se houver. (são letras e números que servem para diferenciar cada pacote)
tipo de linha - opcional
diante desse cenário desenvolva também, mais funcionalidades inovadoras como: - 1 ) probabilidade de entregar o corte - corte quer dizer as peças ex.: corte de mil peças (pense em dois grupos de zap diferente um com 30 pessoas e outro com 40) segue essa logica, 
2) meta semanal, mensal, anual.
3) probabilidade de bater a meta de cada periodo citado, de acordo com a velocidade de entrega de cada pacote e do tamanho de cada corte
(entre outros sistemas)

crie isso tudo compativel com o cordova, utilizando o aiven como banco de dados principal, mas se tiver como por garantia, quando o user instalar o aplicativo ele terá que aceitar alguns termos que serviram para registrar ele no app e para nao ficar precisando do login, salvar tudo no celular do mesmo.

ele terá que aceitar um termo concordando que o app crie uma pasta dentro do aparelho dele em um lugar seguro e ao decorrer do uso do app as informações iram sendo armazenadas dentro de um arquivo que estará dentro desta pasta de arquivos. Mas, tambem será registrado no banco de dados da aiven



# inciar a API

cd /workspaces/confec-o/server && cat > index.js <<'EOF'
require('dotenv').config();
const express = require('express'); 
const cors = require('cors');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT NOW() AS agora');
    res.json({ ok: true, agora: rows[0].agora });
  } catch (e) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log('API no ar'));
EOF
node index.js