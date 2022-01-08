import { v4 } from "uuid";
import invariant from "tiny-invariant";
import React, { useRef, useEffect, useState } from "react";
import { arweave, getTodos, postTodos } from "./api";
import Transaction from "arweave/web/lib/transaction";
import type { ITodo, IWallet } from "./types";
import "./App.css";

function App() {
  const [value, setValue] = useState("");
  const [address, setAddress] = useState("");
  const [confirmations, setConfirmations] = useState(0);
  const [wallet, setWallet] = useState<IWallet | null>(null);
  // TODO: Refactor this to be a single state object.
  const [todos, setTodos] = useState<ITodo[]>([]);
  const [transaction, setTransaction] = useState<Transaction>();

  // should not run when a new transaction is posted
  useEffect(() => {
    const run = async () => {
      invariant(wallet, "A wallet must be uploaded");

      const { todos, transactionId: lastTransactionId } = await getTodos(
        wallet
      );

      setTodos(todos);
      setTransaction({ id: lastTransactionId } as Transaction);
    };

    if (wallet) run();
  }, [wallet]);

  const timer = useRef<ReturnType<typeof setInterval>>();

  // useStatusInterval
  useEffect(() => {
    if (transaction && transaction.id) {
      // Interval to check for status
      const lookupTransaction = async () => {
        const { confirmed } = await arweave.transactions.getStatus(
          transaction.id
        );

        if (confirmed) {
          setConfirmations(confirmed.number_of_confirmations);
        } else {
          setConfirmations(0);
        }
      };

      lookupTransaction();

      timer.current = setInterval(lookupTransaction, 10 * 2000);

      return () => {
        invariant(timer.current, "Timer must be set");
        clearInterval(timer.current);
      };
    }
  }, [transaction]);

  useEffect(() => {
    if (confirmations >= 2) {
      invariant(timer.current, "Timer must be set");
      clearInterval(timer.current);
    }
  }, [confirmations]);

  const updateTodos = async (todos: ITodo[]) => {
    try {
      invariant(wallet, "A wallet must be uploaded");
      invariant(timer.current, "Timer must be set");
      clearInterval(timer.current);
      const pendingTransaction = await postTodos(todos, wallet);
      setTransaction(pendingTransaction);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdd: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();

    const todo = { id: v4(), value, complete: false };
    const updatedTodos = [...todos, todo];

    setValue("");
    setTodos(updatedTodos);
    setConfirmations(0);

    updateTodos(updatedTodos);
  };

  const handleCheck = async (id: string) => {
    const updatedTodos = todos.map((todo) =>
      todo.id === id ? { ...todo, complete: !todo.complete } : todo
    );

    setTodos(updatedTodos);
    updateTodos(updatedTodos);
  };

  const handleDeleteAll = () => {
    setTodos([]);
    updateTodos([]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const reader = new FileReader();
    invariant(e.target.files, "A file must be uploaded");
    reader.readAsText(e.target.files[0]);
    reader.onload = async (event) => {
      invariant(event.target, "event.target must be defined");
      invariant(
        typeof event.target.result === "string",
        "event.target.result must be a stringx"
      );
      const jwk = JSON.parse(event.target.result);
      const address = await arweave.wallets.jwkToAddress(jwk);

      setWallet(jwk);
      setAddress(address);
    };
  };

  if (!wallet) {
    return (
      <div style={{ padding: 12 }}>
        <h1>Arweave todo app</h1>
        <p>
          A todo app deployed onto{" "}
          <a href="https://www.arweave.org/">Arweave</a> — a decentralized data
          storage protocol that stores data in perpetuity.
        </p>
        <h2>Getting started</h2>
        <p>
          A wallet with Arweave tokens is required to interact with this todo
          app.
        </p>
        <label htmlFor="Wallet">Upload Wallet (.JSON key file):</label>
        <input
          type="file"
          id="wallet"
          name="wallet"
          accept=".json"
          onChange={handleFileUpload}
        />
        <h2
          style={{
            width: "100%",
            textAlign: "center",
            lineHeight: "0.1em",
            margin: "40px 0 40px",
            borderBottom: "1px solid #000"
          }}
        >
          <span
            style={{
              background: "#fff",
              padding: "0 10px"
            }}
          >
            or
          </span>
        </h2>
        <p>
          Create a new wallet and get started with some free Arweave tokens
          (0.02 AR, valued at about $1).
        </p>
        <p>
          Follow the steps at{" "}
          <a href="https://faucet.arweave.net/">https://faucet.arweave.net/</a>.
          Once you've created a wallet and received free AR, return to this app
          and upload your wallet (.JSON key file).
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 12 }}>
      <h4>Wallet: {address}</h4>
      <>
        <hr />
        <div>
          Last Transaction:{" "}
          {transaction && transaction.id ? transaction.id : "Searching..."}
        </div>
        <div>
          Status: {confirmations >= 2 ? null : <div className="spinner" />}
          {confirmations >= 2 ? (
            <span style={{ color: "green" }}>
              Confirmed &nbsp;
              {transaction && (
                <a
                  target="_blank"
                  href={`https://viewblock.io/arweave/tx/${transaction.id}`}
                  rel="noreferrer"
                >
                  (View on explorer)
                </a>
              )}
            </span>
          ) : (
            <span style={{ color: "#144a75" }}>&nbsp;Confirming…</span>
          )}
        </div>
        <hr />
      </>
      <form onSubmit={handleAdd}>
        <label htmlFor="add-input">Add a Todo:</label>
        <input
          required
          type="text"
          id="add-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit">Add</button>
        <button type="button" onClick={handleDeleteAll}>
          Delete all
        </button>
      </form>
      {todos.length ? (
        <ul>
          {todos.map((todo) => (
            <li key={todo.id}>
              <label
                style={{
                  textDecoration: todo.complete ? "line-through" : "none"
                }}
              >
                <input
                  type="checkbox"
                  checked={todo.complete}
                  onChange={() => handleCheck(todo.id)}
                />
                {todo.value}
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <div>Empty todo list… Add a todo!</div>
      )}
    </div>
  );
}

export default App;
