import type { CheckpointWriter } from '@snapshot-labs/checkpoint';
import { convertToDecimal, getEvent } from './utils/utils';
import { createToken, loadToken, newToken, Token } from './utils/token';
import { createAccount, newAccount, Account, loadAccount } from './utils/account';
import { createAggregated, loadAggregated, AggregatedTx, newAggreg } from './utils/agrTransactions';

export async function handleTransfer({
  block,
  tx,
  rawEvent,
  mysql
}: Parameters<CheckpointWriter>[0]) {
  if (!rawEvent) return;

  if (
    rawEvent.data[1] ===
    '0x1176a1bd84444c89232ec27754698e5d2e7e1a7f1539f12027f28b23ec9f3d8'.toLowerCase()
  )
    return;

  if (rawEvent.data[0] === '0x0'.toLowerCase() || rawEvent.data[1] === '0x0'.toLowerCase()) return;

  console.log('Transfer event found:', rawEvent);

  const format = 'from, to, value(uint256)';
  const data: any = getEvent(rawEvent.data, format);
  let token: Token;

  // aggregatedTx from the account that sent the tokens
  let aggregatedTxFrom: AggregatedTx;
  // aggregatedTx from the account that recieved the tokens
  let aggregatedTxTo: AggregatedTx;

  // If token isn't indexed yet we add it, else we load it
  if (await newToken(rawEvent.from_address, mysql)) {
    token = await createToken(rawEvent.from_address);
    await mysql.queryAsync(`INSERT IGNORE INTO tokens SET ?`, [token]);
  } else {
    token = await loadToken(rawEvent.from_address, mysql);
  }

  const agrFromId = `${data.from.slice(2)}-${data.to.slice(2)}`;
  const agrToId = `${data.to.slice(2)}-${data.from.slice(2)}`;

  if (await newAggreg(agrFromId, agrToId, mysql)) {
    aggregatedTxFrom = await createAggregated(agrFromId, token, data.from, data.to, block);
    await mysql.queryAsync(`INSERT IGNORE INTO aggregatedtransactions SET ?`, [aggregatedTxFrom]);
  } else {
    aggregatedTxFrom = await loadAggregated(agrFromId, agrToId, mysql);
  }

  aggregatedTxFrom.rawValue =
    aggregatedTxFrom.id === agrFromId
      ? BigInt(aggregatedTxFrom.rawValue) - BigInt(data.value)
      : BigInt(aggregatedTxFrom.rawValue) + BigInt(data.value);

  // Updating raw balances
  aggregatedTxFrom.value =
    aggregatedTxFrom.id === agrFromId
      ? aggregatedTxFrom.value - convertToDecimal(data.value, token.decimals)
      : aggregatedTxFrom.value + convertToDecimal(data.value, token.decimals);
  // Updating balances

  aggregatedTxFrom.rawAbsVolume += BigInt(data.value);
  aggregatedTxFrom.absVolume += convertToDecimal(data.value, token.decimals);

  // Updating modified field
  aggregatedTxFrom.modified = block.timestamp;

  await mysql.queryAsync(
    `UPDATE aggregatedtransactions SET rawValue=?, value=?, rawAbsVolume=?, absVolume=?, token=?, modified=? WHERE id=?`,
    [
      aggregatedTxFrom.rawValue.toString(),
      aggregatedTxFrom.value,
      aggregatedTxFrom.rawAbsVolume.toString(),
      aggregatedTxFrom.absVolume,
      aggregatedTxFrom.token,
      aggregatedTxFrom.modified,
      aggregatedTxFrom.id
    ]
  );
}
