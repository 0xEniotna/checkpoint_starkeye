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

  const format = 'from, to, value(uint256)';
  const data: any = getEvent(rawEvent.data, format);
  let token: Token;
  let fromAccount: Account;
  let toAccount: Account;
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
  // If accounts aren't indexed yet we add them, else we load them
  // First with fromAccount
  const fromId = `${token.id.slice(2)}-${data.from.slice(2)}`;
  if (await newAccount(fromId, mysql)) {
    fromAccount = await createAccount(token, fromId, tx, block);
    await mysql.queryAsync(`INSERT IGNORE INTO accounttokens SET ?`, [fromAccount]);
  } else {
    fromAccount = await loadAccount(fromId, mysql);
  }

  // Then with toAccount
  const toId = `${token.id.slice(2)}-${data.to.slice(2)}`;
  if (await newAccount(toId, mysql)) {
    toAccount = await createAccount(token, toId, tx, block);
    await mysql.queryAsync(`INSERT IGNORE INTO accounttokens SET ?`, [toAccount]);
  } else {
    toAccount = await loadAccount(toId, mysql);
  }

  const agrFromId = `${data.from.slice(2)}-${data.to.slice(2)}`;
  if (await newAggreg(agrFromId, mysql)) {
    aggregatedTxFrom = await createAggregated(agrFromId, token, data.from, data.to, block);
    await mysql.queryAsync(`INSERT IGNORE INTO aggregatedtransactions SET ?`, [aggregatedTxFrom]);
  } else {
    aggregatedTxFrom = await loadAggregated(agrFromId, mysql);
  }

  const agrToId = `${data.to.slice(2)}-${data.from.slice(2)}`;

  // Then with toAccount
  if (await newAggreg(agrToId, mysql)) {
    aggregatedTxTo = await createAggregated(agrToId, token, data.to, data.from, block);
    await mysql.queryAsync(`INSERT IGNORE INTO aggregatedtransactions SET ?`, [aggregatedTxTo]);
  } else {
    aggregatedTxTo = await loadAggregated(agrToId, mysql);
  }

  // Updating raw balances
  aggregatedTxFrom.rawValue = BigInt(aggregatedTxFrom.rawValue) - BigInt(data.value);
  aggregatedTxTo.rawValue = BigInt(aggregatedTxTo.rawValue) + BigInt(data.value);
  // Updating balances
  aggregatedTxFrom.value -= convertToDecimal(data.value, token.decimals);
  aggregatedTxTo.value += convertToDecimal(data.value, token.decimals);
  // Updating modified field
  aggregatedTxFrom.modified = block.timestamp;
  aggregatedTxTo.modified = block.timestamp;

  await mysql.queryAsync(
    `UPDATE aggregatedtransactions SET rawValue=${aggregatedTxFrom.rawValue.toString()}, value=${
      aggregatedTxFrom.value
    }, token='${aggregatedTxFrom.token}', modified=${aggregatedTxFrom.modified} WHERE id='${
      aggregatedTxFrom.id
    }'`
  );

  await mysql.queryAsync(
    `UPDATE aggregatedtransactions SET rawValue=${aggregatedTxTo.rawValue.toString()}, value=${
      aggregatedTxTo.value
    }, token='${aggregatedTxTo.token}', modified=${aggregatedTxTo.modified} WHERE id='${
      aggregatedTxTo.id
    }'`
  );

  // Updating balances
  fromAccount.balance -= convertToDecimal(data.value, token.decimals);
  toAccount.balance += convertToDecimal(data.value, token.decimals);
  // Updating raw balances
  fromAccount.rawBalance = BigInt(fromAccount.rawBalance) - BigInt(data.value);
  toAccount.rawBalance = BigInt(toAccount.rawBalance) + BigInt(data.value);
  // Updating modified field
  fromAccount.modified = block.timestamp;
  toAccount.modified = block.timestamp;
  // Updating tx field
  fromAccount.tx = tx.transaction_hash || '';
  toAccount.tx = tx.transaction_hash || '';

  // Indexing accounts
  await mysql.queryAsync(
    `UPDATE accounttokens SET balance=${
      fromAccount.balance
    }, rawBalance=${fromAccount.rawBalance.toString()}, modified=${fromAccount.modified}, tx='${
      fromAccount.tx
    }' WHERE id='${fromAccount.id}'`
  );
  await mysql.queryAsync(
    `UPDATE accounttokens SET balance=${
      toAccount.balance
    }, rawBalance=${toAccount.rawBalance.toString()}, modified=${toAccount.modified}, tx='${
      toAccount.tx
    }' WHERE id='${toAccount.id}'`
  );
}
