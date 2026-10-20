// Sincronização: o app manda o que mudou e recebe o que mudou no servidor desde a última vez.
// Regra de conflito: vence o registro com atualizado_em mais recente ("última edição ganha").

const { ENTIDADES, sanear, Invalido } = require('./entidades');

const MAX_POR_COLECAO = 1000; // registros aceitos por colecao em cada chamada
const LIMITE_PULL = 50000; // registros devolvidos por colecao em cada chamada
const JANELA_MS = 5000; // sobreposição na leitura para não perder gravações simultâneas

const crase = (nome) => `\`${nome}\``;

async function aplicarMudancas(conn, dispositivoId, mudancas, servidorEm) {
  const rejeitados = [];
  let aceitos = 0;

  for (const [colecao, def] of Object.entries(ENTIDADES)) {
    const lista = mudancas ? mudancas[colecao] : undefined;
    if (lista === undefined || lista === null) continue;
    if (!Array.isArray(lista)) {
      rejeitados.push({ colecao, id: null, motivo: 'formato inválido' });
      continue;
    }
    if (lista.length > MAX_POR_COLECAO) {
      const erro = new Error(`Máximo de ${MAX_POR_COLECAO} registros de ${colecao} por chamada`);
      erro.status = 413;
      throw erro;
    }

    const colunas = Object.keys(def.campos);
    const atribuicoes = colunas.map((c) => `${crase(c)} = ?`).join(', ');
    const listaColunas = ['dispositivo_id', 'id', ...colunas, 'excluido', 'atualizado_em', 'servidor_em'].map(crase).join(', ');

    for (const bruto of lista) {
      let r;
      try {
        r = sanear(colecao, bruto);
      } catch (e) {
        if (!(e instanceof Invalido)) throw e;
        rejeitados.push({ colecao, id: bruto && typeof bruto.id === 'string' ? bruto.id : null, motivo: e.message });
        continue;
      }
      const valores = colunas.map((c) => r.valores[c]);

      // 1) edita se o que chegou é mais novo; 2) se não existia, cria (INSERT IGNORE: se já existe mais novo, ignora).
      const [up] = await conn.query(
        `UPDATE ${crase(def.tabela)} SET ${atribuicoes}, excluido = ?, atualizado_em = ?, servidor_em = ?
         WHERE dispositivo_id = ? AND id = ? AND atualizado_em < ?`,
        [...valores, r.excluido, r.atualizado_em, servidorEm, dispositivoId, r.id, r.atualizado_em]
      );
      if (up.affectedRows === 0) {
        await conn.query(`INSERT IGNORE INTO ${crase(def.tabela)} (${listaColunas}) VALUES (?)`, [
          [dispositivoId, r.id, ...valores, r.excluido, r.atualizado_em, servidorEm],
        ]);
      }
      aceitos++;
    }
  }
  return { aceitos, rejeitados };
}

async function buscarMudancas(pool, dispositivoId, since) {
  const desde = Math.max(0, Number(since) || 0) - JANELA_MS;
  const saida = {};
  for (const [colecao, def] of Object.entries(ENTIDADES)) {
    const colunas = ['id', ...Object.keys(def.campos), 'excluido', 'atualizado_em'].map(crase).join(', ');
    const [linhas] = await pool.query(
      `SELECT ${colunas} FROM ${crase(def.tabela)} WHERE dispositivo_id = ? AND servidor_em > ? ORDER BY servidor_em LIMIT ?`,
      [dispositivoId, Math.max(0, desde), LIMITE_PULL]
    );
    saida[colecao] = linhas;
  }
  return saida;
}

module.exports = { aplicarMudancas, buscarMudancas, MAX_POR_COLECAO };
