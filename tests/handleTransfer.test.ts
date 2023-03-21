import { handleTransfer } from '../src/writers';
import type { CheckpointWriter } from '@snapshot-labs/checkpoint';
import type { RPC } from 'starknet';

export type Block = RPC.GetBlockWithTxs;
export type Transaction = RPC.Transaction;
export type Event = RPC.GetEventsResponse['events'][number];
export type FullBlock = Block & {
    block_number: number;
};

// Mock the required dependencies
const mockAsyncMySqlPool = {
  queryAsync: jest.fn()
};

const sampleEvent : Event = {
    from_address: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
    keys: ['0x99cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9'],
    data: ['0x12345', '0x67891', '0x01', '0x00'],
    block_hash: '0x12345',
    block_number: 1,
    transaction_hash: '0x12345',
  // ... other event properties
};

const sampleBlock : FullBlock = {
    
  // ... sample block properties
  
};

const sampleTx : Transaction= {
  // ... sample transaction properties
};

const params: Parameters<CheckpointWriter>[0] = {
    block : ,
    tx,
    rawEvent: sampleEvent,
    mysql: mockAsyncMySqlPool
  };

describe('handleTransfer', () => {
  test('should process the event with the specified contract address', async () => {
    await handleTransfer(params);

    // Check if the function called the queryAsync method with the expected arguments
    expect(mockAsyncMySqlPool.queryAsync).toHaveBeenCalled();
  });
});
