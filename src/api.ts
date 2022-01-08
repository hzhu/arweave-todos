import Arweave from "arweave";
import type { ITodo, IWallet } from "./types";

export const APP_TAG = "ar-todo-0.1.8pre";

export const arweave = Arweave.init({
  host: "arweave.net",
  port: 443,
  protocol: "https"
});

// Retreive transaction IDs for the todo app
// Can immediately retrieve IDs once transaction is posted to Arweave
const getTodoTransactionIds = async (wallet: IWallet) => {
  const address = await arweave.wallets.jwkToAddress(wallet);
  const transactionIds = await arweave.arql({
    op: "and",
    expr1: {
      op: "equals",
      expr1: "from",
      expr2: address
    },
    expr2: {
      op: "equals",
      expr1: APP_TAG,
      expr2: address
    }
  });

  return transactionIds;
};

export const getTodos = async (wallet: IWallet) => {
  const todoTransactionIds = await getTodoTransactionIds(wallet);

  // If no todos = first time user.
  // Use this opportunity to seed the initial data on Arweave.
  if (todoTransactionIds.length === 0) {
    const { id: transactionId } = await postTodos([], wallet);
    return { todos: [], transactionId };
  }

  const txIds = await getTodoTransactionIds(wallet);
  const transactions = await Promise.all(
    txIds.map(async (txId) => fetch(`https://arweave.net/${txId}`))
  );
  const buffers = await Promise.all(
    transactions.map(async (response) => {
      return await response.arrayBuffer();
    })
  );

  return buffers
    .map((buffer, index) => {
      const text = new TextDecoder("utf-8").decode(buffer);

      return { ...JSON.parse(text), transactionId: txIds[index] };
    })
    .reduce((acc, curr) => (acc.timestamp > curr.timestamp ? acc : curr));
};

export const postTodos = async (todos: ITodo[], wallet: IWallet) => {
  const data = JSON.stringify({ todos, timestamp: Date.now() });
  const address = await arweave.wallets.jwkToAddress(wallet);
  const pendingTransaction = await arweave.createTransaction({ data }, wallet);

  pendingTransaction.addTag("Content-Type", "application/json");
  pendingTransaction.addTag(APP_TAG, address);
  pendingTransaction.addTag("timestamp", Date.now().toString());

  await arweave.transactions.sign(pendingTransaction, wallet);
  await arweave.transactions.post(pendingTransaction);

  return pendingTransaction;
};
