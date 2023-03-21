import { convertToDecimal } from './utils';

export type AggregatedTx = {
  id: string;
  from: string;
  to: string;
  rawValue: bigint;
  value: number;
  token: string;
  modified: number;
};

export async function newAggreg(aggregatedId: string, mysql): Promise<boolean> {
  const newAggreg = await loadAggregated(aggregatedId, mysql);

  return !newAggreg;
}

export async function createAggregated(accountId: string, block): Promise<AggregatedTx> {
  return {
    id: accountId,
    from: accountId.split('-')[1],
    to: '',
    rawValue: BigInt(0),
    value: convertToDecimal(0, 18),
    token: '',
    modified: block.timestamp / 1000
  };
}

export async function loadAggregated(aggregatedId: string, mysql): Promise<AggregatedTx> {
  const tx: AggregatedTx = await mysql.queryAsync(
    `SELECT * FROM aggregatedtransactions WHERE id = ?`,
    [aggregatedId]
  );

  return tx[0];
}
