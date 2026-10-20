// Tabelas do Costura na Aiven (MySQL). Seguro rodar várias vezes (IF NOT EXISTS).
// Todas as tabelas de dados são separadas por dispositivo_id: cada instalação só enxerga o que é dela.

const COMUNS = `
  dispositivo_id CHAR(36) NOT NULL,
  id VARCHAR(64) NOT NULL,
  excluido TINYINT(1) NOT NULL DEFAULT 0,
  atualizado_em BIGINT NOT NULL,
  servidor_em BIGINT NOT NULL,
  PRIMARY KEY (dispositivo_id, id),
  KEY idx_servidor (dispositivo_id, servidor_em),
  CONSTRAINT FK_TABELA_disp FOREIGN KEY (dispositivo_id) REFERENCES dispositivos (id) ON DELETE CASCADE
`;

const tabela = (nome, colunas) => `
CREATE TABLE IF NOT EXISTS ${nome} (
  ${colunas},
  ${COMUNS.replace('FK_TABELA', 'fk_' + nome)}
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

const COMANDOS = [
  `CREATE TABLE IF NOT EXISTS dispositivos (
    id CHAR(36) NOT NULL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    recuperacao_hash CHAR(64) NOT NULL,
    termos_versao VARCHAR(20) NOT NULL,
    termos_aceitos_em DATETIME NULL,
    app_versao VARCHAR(20) NULL,
    plataforma VARCHAR(40) NULL,
    registrado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultimo_acesso DATETIME NULL,
    UNIQUE KEY uq_recuperacao (recuperacao_hash),
    KEY idx_token (token_hash)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  tabela('fornecedores', `
    nome VARCHAR(120) NOT NULL,
    telefone VARCHAR(30) NULL`),

  tabela('cortes', `
    fornecedor_id VARCHAR(64) NOT NULL,
    tecido VARCHAR(60) NOT NULL,
    servico VARCHAR(10) NOT NULL,
    preco_pala DECIMAL(8,2) NOT NULL DEFAULT 0,
    preco_gancho DECIMAL(8,2) NOT NULL DEFAULT 0,
    quantidade INT NOT NULL,
    referencia VARCHAR(40) NULL,
    tipo_linha VARCHAR(60) NULL,
    modelo VARCHAR(60) NULL,
    data_recebimento DATE NOT NULL,
    prazo DATE NULL,
    grupo VARCHAR(60) NULL,
    pessoas INT NOT NULL DEFAULT 1,
    observacao VARCHAR(500) NULL,
    encerrado TINYINT(1) NOT NULL DEFAULT 0`),

  tabela('entregas', `
    corte_id VARCHAR(64) NOT NULL,
    quantidade INT NOT NULL,
    data DATE NOT NULL,
    valor DECIMAL(12,2) NOT NULL DEFAULT 0,
    pago TINYINT(1) NOT NULL DEFAULT 0,
    pago_em DATE NULL,
    forma_pagamento VARCHAR(20) NULL,
    observacao VARCHAR(300) NULL`),

  tabela('metas', `
    tipo VARCHAR(10) NOT NULL,
    pecas INT NOT NULL DEFAULT 0,
    valor DECIMAL(12,2) NULL`),

  tabela('config', `
    valor TEXT NULL`),
];

async function criarTabelas(pool) {
  for (const sql of COMANDOS) await pool.query(sql);
}

module.exports = { criarTabelas, COMANDOS };
