import { convertToDecimal } from './utils';
import { Token } from './token';

export type AggregatedTx = {
  id: string;
  from: string;
  to: string;
  rawValue: bigint;
  value: number;
  rawAbsVolume: bigint;
  absVolume: number;
  token: string;
  modified: number;
};

export async function newAggreg(
  aggregatedId: string,
  aggregatedToId: string,
  mysql
): Promise<boolean> {
  const newAggreg = await loadAggregated(aggregatedId, aggregatedToId, mysql);

  return !newAggreg;
}

export async function createAggregated(
  aggregatedId: string,
  token: Token,
  account: string,
  accountTo: string,
  block
): Promise<AggregatedTx> {
  return {
    id: aggregatedId,
    from: account,
    to: accountTo,
    rawValue: BigInt(0),
    value: convertToDecimal(0, token.decimals),
    rawAbsVolume: BigInt(0),
    absVolume: convertToDecimal(0, token.decimals),
    token: token.id,
    modified: block.timestamp / 1000
  };
}
export async function loadAggregated(
  aggregatedId: string,
  aggregatedToId: string,
  mysql
): Promise<AggregatedTx> {
  const tx = await mysql.queryAsync(`SELECT * FROM aggregatedtransactions WHERE id = ? OR id= ?`, [
    aggregatedId,
    aggregatedToId
  ]);
  // if (tx.length === 0) {
  //   console.error('No Aggregated data found for the provided ID:', aggregatedId);
  // }

  return tx[0];
}
